//! Asking for an enrolment check of a row waiting for one, from the student's or a teacher's view.

use headless_lms_models::credit_registration_enrolment_check_signals;
use headless_lms_models::credit_registration_events::{
    CreditRegistrationEventKind, NewCreditRegistrationEvent,
};
use headless_lms_models::credit_registrations::CreditRegistrationState;
use headless_lms_models::library::credit_registration::enrolment_check_schedule::{
    EnrolmentCheckSource, STUDENT_CHECK_REQUEST_MIN_ROW_AGE,
};
use headless_lms_models::library::credit_registration::enrolment_checks::{
    self, CheckRequestOutcome,
};

use crate::prelude::*;

/// Whether a row's student or a teacher may ask for an enrolment check right now, which is when
/// their buttons show.
pub fn can_request_enrolment_recheck(
    state: CreditRegistrationState,
    enrolment_check_requested_at: Option<DateTime<Utc>>,
    enrolment_checked_at: Option<DateTime<Utc>>,
) -> bool {
    state == CreditRegistrationState::NoUsableEnrolment
        && !enrolment_checks::is_check_request_limited(
            enrolment_check_requested_at,
            enrolment_checked_at,
            Utc::now(),
        )
}

/// Whether the row's student may ask for a check right now: [`can_request_enrolment_recheck`], and
/// not within the first hour of the row. A teacher's request has no such wait.
pub fn can_student_request_enrolment_recheck(
    state: CreditRegistrationState,
    row_created_at: DateTime<Utc>,
    enrolment_check_requested_at: Option<DateTime<Utc>>,
    enrolment_checked_at: Option<DateTime<Utc>>,
) -> bool {
    Utc::now() - row_created_at >= STUDENT_CHECK_REQUEST_MIN_ROW_AGE
        && can_request_enrolment_recheck(state, enrolment_check_requested_at, enrolment_checked_at)
}

/// A row waiting for an enrolment to check, and the completion it registers.
#[derive(Debug, Clone, Copy)]
pub struct RecheckTarget {
    pub registration_id: Uuid,
    pub course_module_completion_id: Uuid,
}

/// Asks for an enrolment check of a row waiting for one, and records who asked.
///
/// Shared by the student's recheck button, pressing Done and the teacher's recheck, which differ in
/// `source` and the event. Every kind shares one limit on asking; see
/// [`enrolment_checks::request_check`]. The completion's check signal is recorded unless the row
/// turned out not to be waiting, even for a request refused as too soon.
pub async fn start_enrolment_recheck(
    conn: &mut PgConnection,
    actor_user_id: Uuid,
    target: RecheckTarget,
    source: EnrolmentCheckSource,
    event_kind: CreditRegistrationEventKind,
    message: &str,
) -> Result<CheckRequestOutcome, ControllerError> {
    let registration_id = target.registration_id;
    let mut tx = conn.begin().await?;
    let outcome =
        enrolment_checks::request_check(&mut tx, registration_id, source, Utc::now()).await?;
    if outcome == CheckRequestOutcome::NotWaiting {
        tx.commit().await?;
        return Ok(outcome);
    }
    credit_registration_enrolment_check_signals::record_check_request(
        &mut tx,
        target.course_module_completion_id,
        source,
    )
    .await?;
    if outcome == CheckRequestOutcome::TooSoon {
        tx.commit().await?;
        return Ok(outcome);
    }
    models::credit_registration_events::insert(
        &mut tx,
        &NewCreditRegistrationEvent {
            actor_user_id: Some(actor_user_id),
            message: Some(message.to_string()),
            ..NewCreditRegistrationEvent::new(registration_id, event_kind)
        },
    )
    .await?;
    tx.commit().await?;
    Ok(outcome)
}
