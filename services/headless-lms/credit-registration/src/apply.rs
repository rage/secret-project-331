//! Writing a decided outcome, and the exchange behind it, to one ledger row.

use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::credit_registration_events::{
    CreditRegistrationEventKind, scrub_text, suotar_exchange_details,
};
use headless_lms_models::credit_registrations::{
    self, CreditRegistration, CreditRegistrationState, Transition,
};
use headless_lms_models::library::credit_registration::backoff::next_attempt_at;
use headless_lms_models::library::credit_registration::enrolment_checks::{
    self, EnrolmentCheckAnswer, record_enrolment_check,
};
use headless_lms_models::library::credit_registration::outcomes::{Outcome, RowFacts};
use headless_lms_models::secret::DbSecret;
use headless_lms_models::verified_student_numbers;
use headless_lms_utils::prelude::Utc;
use secrecy::ExposeSecret;
use sqlx::{Connection, PgConnection};
use uuid::Uuid;

/// Applies one decided outcome to one row, with the exchange that produced it.
///
/// `expected_from_state` guards against writing back a decision made from a row snapshot that an
/// `await` (an external call, or just the gap since claiming) has let go stale: pass the state the
/// phase itself put the row in before that `await`, or `Some(registration.state)` when the phase
/// never moved the row before its own `await`.
pub(crate) async fn apply_outcome(
    conn: &mut PgConnection,
    registration: &CreditRegistration,
    outcome: &Outcome,
    event: OutcomeEvent<'_>,
    expected_from_state: Option<CreditRegistrationState>,
) -> anyhow::Result<()> {
    // Only if the request carried this number: a student who linked a working one while the request
    // was out must not lose the link they just made.
    if outcome.drop_verified_student_number
        && let Some(linked) =
            verified_student_numbers::get_by_user_id(conn, registration.user_id).await?
        && event.sent_student_number.map(ExposeSecret::expose_secret)
            == Some(linked.student_number.expose_secret())
    {
        verified_student_numbers::soft_delete(conn, linked.id).await?;
    }
    let mut tx = conn.begin().await?;
    if outcome.increment_submit_retry_count {
        credit_registrations::increment_submit_retry_count(&mut tx, registration.id).await?;
    }
    let after = credit_registrations::transition(
        &mut tx,
        registration.id,
        &Transition {
            error_message: event.error_message.map(scrub_text),
            event_kind: CreditRegistrationEventKind::SuotarResponse,
            event_message: event.message.map(str::to_string),
            suotar_api_call_id: event.suotar_api_call_id,
            event_details: Some(suotar_exchange_details(event.request, event.response)),
            request_item_id: event.request_item_id.map(str::to_string),
            ..outcome_transition(outcome, expected_from_state)
        },
    )
    .await?;
    if outcome.schedules_next_enrolment_check {
        enrolment_checks::schedule_next_check(&mut tx, registration.id).await?;
    }
    record_enrolment_check(&mut tx, event.enrolment_check, &after).await?;
    tx.commit().await?;
    if outcome.to_state == CreditRegistrationState::SubmissionUncertain
        && registration.state != CreditRegistrationState::SubmissionUncertain
    {
        warn!(
            credit_registration_id = %registration.id,
            "Credit registration entered submission_uncertain; Sisu's outcome could not be confirmed"
        );
    }
    Ok(())
}

/// The ledger write one decided outcome asks for, without the audit half [`apply_outcome`] adds.
/// For the paths that decide an outcome without an exchange to record.
pub(crate) fn outcome_transition(
    outcome: &Outcome,
    expected_from_state: Option<CreditRegistrationState>,
) -> Transition {
    Transition {
        error_code: outcome.error_code,
        needs_admin_attention: outcome.needs_admin_attention,
        expected_from_state,
        next_attempt_at: outcome.next_attempt_at.or_else(|| {
            outcome
                .delay_secs
                .map(|delay_secs| next_attempt_at(Utc::now(), delay_secs))
        }),
        keeps_enrolment_checked_at: outcome.keeps_enrolment_checked_at,
        ..Transition::to(outcome.to_state)
    }
}

/// Whether the error is `transition` refusing to write because another writer moved the row since
/// the snapshot the decision was made from.
///
/// A phase that hits this on one row of a batch must skip that row and carry on: the row belongs to
/// whoever moved it, and aborting the loop would leave every row after it in the state the phase's
/// own preflight wrote, with no phase claiming that state again.
pub(crate) fn row_moved_on(error: &anyhow::Error) -> bool {
    error
        .downcast_ref::<headless_lms_models::ModelError>()
        .is_some_and(|error| {
            matches!(
                error.error_type(),
                headless_lms_models::ModelErrorType::PreconditionFailed
            )
        })
}

/// Whether an outcome counts against the iteration's `items_failed`: an error code is a failed
/// item, so a verify poll that is still waiting is not one.
pub(crate) fn counts_as_failed(outcome: &Outcome) -> bool {
    outcome.error_code.is_some()
}

/// The scheduling history one outcome decision needs from a row.
pub(crate) fn row_facts(row: &CreditRegistration) -> RowFacts {
    RowFacts {
        now: Utc::now(),
        first_failed_at: row.first_failed_at,
        submit_retry_count: row.submit_retry_count,
        verify_attempt_count: row.verify_attempt_count,
        submitted_at: row.submitted_at,
        is_waiting_for_enrolment: row.is_waiting_for_enrolment(),
        error_code: row.error_code,
    }
}

/// The audit half of applying an outcome. Both bodies are scrubbed on the way into the event row.
#[derive(Default)]
pub(crate) struct OutcomeEvent<'a> {
    /// The student number this row's request actually carried, which may no longer be the linked
    /// one by the time the answer is applied.
    pub sent_student_number: Option<&'a DbSecret>,
    pub message: Option<&'a str>,
    /// Persisted on the ledger row, so it is scrubbed before it is written.
    pub error_message: Option<&'a str>,
    pub suotar_api_call_id: Option<Uuid>,
    /// The requestItemId the row went out under in that call.
    pub request_item_id: Option<&'a str>,
    pub request: Option<&'a serde_json::Value>,
    pub response: Option<&'a serde_json::Value>,
    /// Set for a row on its enrolment check schedule, whose check is logged with the answer.
    pub enrolment_check: Option<&'a EnrolmentCheckAnswer<'a>>,
}
