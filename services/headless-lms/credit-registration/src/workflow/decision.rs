//! What one answer does to its row, and writing it there, guarded by the state the claim expects.

use chrono::{DateTime, Utc};
use headless_lms_models::credit_registration_events::CreditRegistrationEventKind;
use headless_lms_models::credit_registrations::{
    self, CreditRegistrationState, PayloadSnapshot, Transition, Transitioned,
    set_resubmit_not_before, set_sisu_attainment_if_unclaimed, set_submitted_attainment,
};
use headless_lms_models::library::credit_registration::enrolment_checks::{
    self, EnrolmentCheckAnswer, record_enrolment_check,
};
use headless_lms_models::library::credit_registration::grade_mapping::MappedGrade;
use headless_lms_models::library::credit_registration::outcomes::{
    NextAttempt, Outcome, UnaskedMove,
};
use headless_lms_models::library::credit_registration::scrub::{
    scrub_text, suotar_exchange_details,
};
use headless_lms_models::library::credit_registration::study_registry::RegistryAttainment;
use headless_lms_models::verified_student_numbers;
use secrecy::ExposeSecret;
use sqlx::{Connection, PgConnection, Postgres, Transaction};
use uuid::Uuid;

use super::claim::ClaimedRegistration;
use crate::error::CreditRegistrationResult;
use crate::registry::{ExchangeAudit, StudentNumber, SubmittedAttainmentRef};

/// What one answer does to its row: the move, the timeline line and error that go with it, and the
/// writes it asks for, grouped by whether they outlive a lost race. The exchange behind the answer
/// is the caller's [`crate::registry::ExchangeAudit`], not part of the decision.
pub(crate) struct Decision<'a> {
    pub outcome: Outcome,
    /// The timeline line for the move.
    pub message: Option<String>,
    /// The item's own error, or a refused request's, persisted on the row once scrubbed.
    pub row_error: Option<&'a str>,
    pub pre_transition: PreTransitionChanges<'a>,
    pub atomic: AtomicChanges<'a>,
}

impl<'a> Decision<'a> {
    pub(crate) fn new(outcome: Outcome) -> Self {
        Self {
            outcome,
            message: None,
            row_error: None,
            pre_transition: PreTransitionChanges::default(),
            atomic: AtomicChanges::default(),
        }
    }

    pub(crate) fn with_message(self, message: impl Into<String>) -> Self {
        Self {
            message: Some(message.into()),
            ..self
        }
    }

    pub(crate) fn with_row_error(self, row_error: Option<&'a str>) -> Self {
        Self { row_error, ..self }
    }

    /// The submission an import answer named, and its attainment type.
    pub(crate) fn with_submitted_attainment(
        mut self,
        submission: Option<&'a SubmittedAttainmentRef>,
    ) -> Self {
        self.pre_transition.submitted_attainment = submission;
        self
    }

    /// The Sisu attainment that settles the row.
    pub(crate) fn with_sisu_attainment(
        mut self,
        attainment: Option<&'a RegistryAttainment>,
    ) -> Self {
        self.pre_transition.sisu_attainment = attainment;
        self
    }

    /// Suotar's own bound on when resending becomes safe.
    pub(crate) fn with_resubmit_not_before(
        mut self,
        resubmit_not_before: Option<DateTime<Utc>>,
    ) -> Self {
        self.pre_transition.resubmit_not_before = resubmit_not_before;
        self
    }

    pub(crate) fn with_payload(mut self, payload: PayloadChange) -> Self {
        self.atomic.payload = Some(payload);
        self
    }

    pub(crate) fn with_enrolment_check(mut self, check: Option<EnrolmentCheckAnswer<'a>>) -> Self {
        self.atomic.enrolment_check = check;
        self
    }
}

/// Written before the guarded transition and kept even when the row moved on meanwhile: each
/// records something the registry already did or said.
#[derive(Default)]
pub(crate) struct PreTransitionChanges<'a> {
    /// Kept on a row that moved on, so support can still find what the submission created.
    pub submitted_attainment: Option<&'a SubmittedAttainmentRef>,
    /// Written outside any transaction: a lost race for it surfaces as a unique violation, which
    /// would abort the transaction, so the caller must not hold one open either.
    pub sisu_attainment: Option<&'a RegistryAttainment>,
    pub resubmit_not_before: Option<DateTime<Utc>>,
}

/// Written in the transition's transaction, alongside the retry count and next enrolment check
/// the outcome asks for, so they roll back with a row that moved on.
#[derive(Default)]
pub(crate) struct AtomicChanges<'a> {
    pub payload: Option<PayloadChange>,
    /// Set for a row on its enrolment check schedule, whose check is logged with the answer.
    pub enrolment_check: Option<EnrolmentCheckAnswer<'a>>,
}

/// What a resolved enrolment does to the payload a row carries.
#[derive(Debug)]
pub(crate) enum PayloadChange {
    /// Frozen for import, replacing the registered credits of the student's other attempts once it
    /// is registered.
    Frozen {
        snapshot: Box<PayloadSnapshot>,
        supersedes: Vec<Uuid>,
    },
    /// Not sent, since the registry already holds the credit: see
    /// [`headless_lms_models::credit_registrations::prepare_unsent_duplicate`].
    Unsent { weighed_grade: Option<MappedGrade> },
}

/// What writing one answer did to its row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Applied {
    /// `is_failure` when the row now carries an error code that is no waiting answer, which is what
    /// `items_failed` counts; `is_waiting` when it carries one that is.
    Written { is_failure: bool, is_waiting: bool },
    /// Another writer moved the row since it was read, so the row is theirs and nothing was
    /// written. The rest of the batch carries on: aborting would leave it in the state the phase's
    /// own preflight wrote, which no phase claims again.
    MovedOn { found: CreditRegistrationState },
}

/// Writes a decision made from the registry's answer, or its refusal, to the claimed row, with the
/// exchange behind it on the event. Lands only if the row is still in the claim's expected state.
pub(crate) async fn write_decision(
    conn: &mut PgConnection,
    claim: &ClaimedRegistration,
    decision: Decision<'_>,
    audit: &ExchangeAudit,
) -> CreditRegistrationResult<Applied> {
    let transition = Transition {
        error_message: decision.row_error.map(scrub_text),
        event_kind: CreditRegistrationEventKind::SuotarResponse,
        event_message: decision.message.clone(),
        suotar_api_call_id: audit.call_id,
        suotar_endpoint: Some(audit.endpoint),
        suotar_requested_at: Some(audit.requested_at),
        suotar_answered_at: Some(audit.answered_at),
        event_details: Some(suotar_exchange_details(
            Some(&audit.request),
            audit.response.as_ref(),
        )),
        request_item_id: Some(audit.request_item_id.clone()),
        ..decision
            .outcome
            .transition(Some(claim.expected_state()), Utc::now())
    };
    write_outcome(
        conn,
        claim,
        &decision,
        audit.sent_student_number.as_ref(),
        &transition,
    )
    .await
}

/// [`write_decision`] as the last write of `tx`, committing it only if the decision landed, so
/// everything `tx` wrote for a row that moved on meanwhile rolls back with it.
pub(crate) async fn write_decision_committing_if_written(
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

/// [`write_decision`] for a move made without asking the study registry, which has no exchange to
/// record. A claim's own moves go through here too, so they are guarded like every other write.
pub(crate) async fn write_unasked_move(
    conn: &mut PgConnection,
    claim: &ClaimedRegistration,
    unasked: UnaskedMove,
) -> CreditRegistrationResult<Applied> {
    let transition = unasked.transition(Some(claim.expected_state()), Utc::now());
    write_outcome(
        conn,
        claim,
        &Decision::new(unasked.outcome),
        None,
        &transition,
    )
    .await
}

/// `transition` is `decision`'s move, with the event it is recorded under.
async fn write_outcome(
    conn: &mut PgConnection,
    claim: &ClaimedRegistration,
    decision: &Decision<'_>,
    sent_student_number: Option<&StudentNumber>,
    transition: &Transition,
) -> CreditRegistrationResult<Applied> {
    let registration = claim.registration();
    let outcome = &decision.outcome;
    let atomic = &decision.atomic;
    write_before_transition(conn, registration.id, &decision.pre_transition).await?;
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
    write_payload_change(&mut tx, registration.id, atomic.payload.as_ref()).await?;
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
    record_enrolment_check(&mut tx, atomic.enrolment_check.as_ref(), &after).await?;
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
        is_waiting: outcome.is_waiting(),
    })
}

async fn write_before_transition(
    conn: &mut PgConnection,
    id: Uuid,
    changes: &PreTransitionChanges<'_>,
) -> CreditRegistrationResult<()> {
    if let Some(submission) = changes.submitted_attainment {
        set_submitted_attainment(
            conn,
            id,
            submission.id.as_str(),
            submission.attainment_type.as_deref(),
        )
        .await?;
    }
    if let Some(attainment) = changes.sisu_attainment {
        set_sisu_attainment_if_unclaimed(
            conn,
            id,
            attainment.id.as_str(),
            Some(attainment.attainment_type.as_str()),
        )
        .await?;
    }
    if let Some(resubmit_not_before) = changes.resubmit_not_before {
        set_resubmit_not_before(conn, id, resubmit_not_before).await?;
    }
    Ok(())
}

async fn write_payload_change(
    conn: &mut PgConnection,
    id: Uuid,
    payload: Option<&PayloadChange>,
) -> CreditRegistrationResult<()> {
    match payload {
        None => {}
        Some(PayloadChange::Frozen {
            snapshot,
            supersedes,
        }) => {
            for &replaced in supersedes {
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
