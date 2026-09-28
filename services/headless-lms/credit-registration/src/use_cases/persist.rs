//! Writing a decision, and the exchange behind it, to one claimed ledger row.

use headless_lms_models::credit_registration_events::{
    CreditRegistrationEventKind, scrub_text, suotar_exchange_details,
};
use headless_lms_models::credit_registrations::{
    self, CreditRegistrationState, Transition, Transitioned, set_resubmit_not_before,
    set_sisu_attainment_if_unclaimed, set_submitted_attainment,
};
use headless_lms_models::library::credit_registration::enrolment_checks::{
    self, record_enrolment_check,
};
use headless_lms_models::library::credit_registration::outcomes::{NextAttempt, Outcome};
use headless_lms_models::verified_student_numbers;
use secrecy::ExposeSecret;
use sqlx::{Connection, PgConnection, Postgres, Transaction};
use uuid::Uuid;

use crate::domain::{
    Applied, AtomicChanges, ClaimedRegistration, Decision, PayloadChange, PreTransitionChanges,
};
use crate::error::CreditRegistrationResult;
use crate::registry::{ExchangeAudit, StudentNumber};

/// Writes a decision made from the registry's answer, or its refusal, to the claimed row, with the
/// exchange behind it on the event. Lands only if the row is still in the claim's expected state.
pub(super) async fn write_decision(
    conn: &mut PgConnection,
    claim: &ClaimedRegistration,
    decision: Decision<'_>,
    audit: &ExchangeAudit,
) -> CreditRegistrationResult<Applied> {
    let transition = Transition {
        error_message: decision.row_error().map(scrub_text),
        event_kind: CreditRegistrationEventKind::SuotarResponse,
        event_message: decision.message().map(str::to_string),
        suotar_api_call_id: audit.call_id,
        event_details: Some(suotar_exchange_details(
            Some(&audit.request),
            audit.response.as_ref(),
        )),
        request_item_id: Some(audit.request_item_id.clone()),
        ..decision.outcome().transition(Some(claim.expected_state()))
    };
    write_outcome(
        conn,
        claim,
        decision.outcome(),
        decision.pre_transition(),
        decision.atomic(),
        audit.sent_student_number.as_ref(),
        &transition,
    )
    .await
}

/// [`write_decision`] as the last write of `tx`, committing it only if the decision landed, so
/// everything `tx` wrote for a row that moved on meanwhile rolls back with it.
pub(super) async fn write_decision_committing_if_written(
    mut tx: Transaction<'_, Postgres>,
    claim: &ClaimedRegistration,
    decision: Decision<'_>,
    audit: &ExchangeAudit,
) -> CreditRegistrationResult<Applied> {
    let applied = write_decision(&mut tx, claim, decision, audit).await?;
    if matches!(applied, Applied::Written { .. }) {
        tx.commit().await?;
    }
    Ok(applied)
}

/// [`write_decision`] for a decision made without asking the study registry, which has no exchange
/// to record.
pub(super) async fn write_unasked_outcome(
    conn: &mut PgConnection,
    claim: &ClaimedRegistration,
    outcome: &Outcome,
    message: &str,
) -> CreditRegistrationResult<Applied> {
    let transition = Transition {
        event_message: Some(message.to_string()),
        ..outcome.transition(Some(claim.expected_state()))
    };
    write_outcome(
        conn,
        claim,
        outcome,
        &PreTransitionChanges::default(),
        &AtomicChanges::default(),
        None,
        &transition,
    )
    .await
}

async fn write_outcome(
    conn: &mut PgConnection,
    claim: &ClaimedRegistration,
    outcome: &Outcome,
    pre_transition: &PreTransitionChanges<'_>,
    atomic: &AtomicChanges<'_>,
    sent_student_number: Option<&StudentNumber>,
    transition: &Transition,
) -> CreditRegistrationResult<Applied> {
    let registration = claim.registration();
    write_before_transition(conn, registration.id, pre_transition).await?;
    // Only if the request carried this number: a student who linked a working one while the request
    // was out must not lose the link they just made.
    if outcome.drop_verified_student_number
        && let Some(linked) =
            verified_student_numbers::get_by_user_id(conn, registration.user_id).await?
        && sent_student_number.map(StudentNumber::expose)
            == Some(linked.student_number.expose_secret())
    {
        verified_student_numbers::soft_delete(conn, linked.id).await?;
    }
    let mut tx = conn.begin().await?;
    if outcome.increment_submit_retry_count {
        credit_registrations::increment_submit_retry_count(&mut tx, registration.id).await?;
    }
    write_payload_change(&mut tx, registration.id, atomic.payload()).await?;
    let written =
        credit_registrations::transition_unless_moved_on(&mut tx, registration.id, transition)
            .await?;
    let after = match written {
        Transitioned::Written(after) => *after,
        Transitioned::MovedOn { found } => return Ok(Applied::MovedOn { found }),
    };
    debug!(
        credit_registration_id = %after.id,
        from_state = ?registration.state,
        to_state = ?after.state,
        next_attempt_at = %after.next_attempt_at,
        "Credit registration transitioned"
    );
    if outcome.next == NextAttempt::NextEnrolmentRung {
        enrolment_checks::schedule_next_check(&mut tx, registration.id).await?;
    }
    record_enrolment_check(&mut tx, atomic.enrolment_check(), &after).await?;
    tx.commit().await?;
    if outcome.to_state == CreditRegistrationState::SubmissionUncertain
        && registration.state != CreditRegistrationState::SubmissionUncertain
    {
        warn!(
            credit_registration_id = %registration.id,
            "Credit registration entered submission_uncertain; Sisu's outcome could not be confirmed"
        );
    }
    Ok(Applied::Written {
        is_failure: outcome.is_failure(),
    })
}

async fn write_before_transition(
    conn: &mut PgConnection,
    id: Uuid,
    changes: &PreTransitionChanges<'_>,
) -> CreditRegistrationResult<()> {
    if let Some(submission) = changes.submitted_attainment() {
        set_submitted_attainment(
            conn,
            id,
            submission.id.as_str(),
            submission.attainment_type.as_deref(),
        )
        .await?;
    }
    if let Some(attainment) = changes.sisu_attainment() {
        set_sisu_attainment_if_unclaimed(
            conn,
            id,
            attainment.id.as_str(),
            Some(attainment.attainment_type.as_str()),
        )
        .await?;
    }
    if let Some(resubmit_not_before) = changes.resubmit_not_before() {
        set_resubmit_not_before(conn, id, resubmit_not_before).await?;
    }
    Ok(())
}

async fn write_payload_change(
    conn: &mut PgConnection,
    id: Uuid,
    payload: Option<&PayloadChange<'_>>,
) -> CreditRegistrationResult<()> {
    match payload {
        None => {}
        Some(PayloadChange::Frozen {
            snapshot,
            supersedes,
        }) => {
            for &replaced in *supersedes {
                credit_registrations::mark_pending_superseded(conn, replaced, id).await?;
            }
            credit_registrations::set_payload_snapshot(conn, id, snapshot).await?;
        }
        Some(PayloadChange::Unsent { weighed_grade }) => {
            credit_registrations::prepare_unsent_duplicate(conn, id, weighed_grade.as_ref())
                .await?;
        }
    }
    Ok(())
}
