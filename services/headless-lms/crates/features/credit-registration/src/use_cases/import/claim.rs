//! Claiming the rows an import iteration sends: which of them may go out, and the submission each
//! one carries.

use headless_lms_data_operations::library::credit_registration::backoff::SUBMIT_MAX_BACKOFF;
use headless_lms_data_operations::library::credit_registration::grade_mapping::{
    MappedGrade, is_known_grade,
};
use headless_lms_data_operations::library::credit_registration::outcomes::{
    UnaskedMove, duplicate_of_other_registrar, incomplete_payload, invalid_payload_field,
    submitting, unknown_grade,
};
use headless_lms_data_operations::library::credit_registration::scrub::scrub_text;
use headless_lms_models::course_module_completion_registered_to_study_registries::completion_ids_registered_by_a_registrar;
use headless_lms_models::credit_registration_events::{
    self, CreditRegistrationEventKind, NewCreditRegistrationEvent,
};
use headless_lms_models::credit_registrations::{
    AdminAttention, CreditRegistration, CreditRegistrationState, claim_due_for_import,
    schedule_next_attempt, set_needs_admin_attention,
};
use headless_lms_utils::prelude::Utc;
use secrecy::ExposeSecret;
use sqlx::{Connection, PgConnection};
use uuid::Uuid;

use crate::error::{CreditRegistrationError, CreditRegistrationResult};
use crate::error_reports::ErrorReporter;
use crate::registry::{AttainmentSubmission, CourseCode, Credits, StudentNumber};
use crate::use_cases::batch_flow::{BatchFlowContext, Prepared};
use crate::workflow::{Applied, Claimed, ClaimedRegistration, write_unasked_move};

/// Claims at most `limit` rows due for import, moves each one it may send to `submitting`, and
/// settles the rest where they stand.
pub(super) async fn claim_import_candidates(
    ctx: &BatchFlowContext<'_>,
    conn: &mut PgConnection,
    limit: usize,
) -> CreditRegistrationResult<Prepared<(), AttainmentSubmission>> {
    let claimed =
        claim_due_for_import(conn, ctx.scope, i64::try_from(limit).unwrap_or(i64::MAX)).await?;
    // Registrars only, not our own mirror rows: a grade improvement is deliberately a second
    // submission for the same completion.
    let already_registered = completion_ids_registered_by_a_registrar(
        conn,
        &claimed
            .iter()
            .map(|row| row.course_module_completion_id)
            .collect::<Vec<_>>(),
    )
    .await?;

    let mut prepared = Prepared::new();
    for row in claimed {
        let (unasked, submission) = match preflight_submission(&row, &already_registered) {
            Preflight::Send(submission) => (submitting(), Some(submission)),
            Preflight::Settle(unasked) => (unasked, None),
        };
        // The claim holds the row's lock, so the guard only confirms the state it read.
        let claim = ClaimedRegistration::left_in_place(row);
        // One row's database error must not roll back the whole claim, which would leave the
        // same row at the head of the next one.
        let mut savepoint = conn.begin().await?;
        match write_unasked_move(&mut savepoint, &claim, unasked).await {
            Ok(applied) => {
                savepoint.commit().await?;
                match (submission, applied) {
                    (Some(submission), Applied::Written { .. }) => prepared.send(
                        Claimed {
                            claim: ClaimedRegistration::moved_to(
                                claim.into_registration(),
                                CreditRegistrationState::Submitting,
                            ),
                            extra: (),
                        },
                        submission,
                    ),
                    (_, applied) => prepared.record_applied(claim.id(), applied),
                }
            }
            Err(error) => {
                savepoint.rollback().await?;
                hold_back(&ctx.errors, conn, claim.registration(), &error).await?;
                prepared.record_failed();
            }
        }
    }
    Ok(prepared)
}

/// What the preflight made of one claimed row.
enum Preflight {
    /// Moved to `submitting`, and the submission goes in the batch.
    Send(AttainmentSubmission),
    /// Settled where the move says, without a request.
    Settle(UnaskedMove),
}

fn preflight_submission(row: &CreditRegistration, already_registered: &[Uuid]) -> Preflight {
    if already_registered.contains(&row.course_module_completion_id) {
        debug!(
            credit_registration_id = %row.id,
            "Another registrar already registered this completion; marking duplicate"
        );
        return Preflight::Settle(duplicate_of_other_registrar());
    }
    match build_submission(row) {
        Ok(submission) => Preflight::Send(submission),
        Err(problem) => {
            match &problem {
                Unsendable::Incomplete => {}
                Unsendable::UnknownGrade => {
                    warn!(
                        credit_registration_id = %row.id,
                        "Credit registration's frozen grade is not one Sisu accepts; needs admin attention"
                    );
                }
                Unsendable::Invalid(field) => {
                    warn!(
                        credit_registration_id = %row.id,
                        field = *field,
                        "Sisu does not accept a required field; needs admin attention"
                    );
                }
            }
            Preflight::Settle(problem.unasked_move())
        }
    }
}

/// Parks a row the preflight could not write, flagged for an admin, so the rest of the claim still
/// goes out.
async fn hold_back(
    errors: &ErrorReporter<'_>,
    conn: &mut PgConnection,
    row: &CreditRegistration,
    error: &CreditRegistrationError,
) -> CreditRegistrationResult<()> {
    error!(
        credit_registration_id = %row.id,
        error = ?error,
        "Could not prepare credit registration for import; holding it back"
    );
    errors
        .report(
            &error.to_string(),
            Some(format!("{error:?}")),
            serde_json::json!({ "credit_registration_id": row.id }),
        )
        .await;
    set_needs_admin_attention(conn, row.id, AdminAttention::Raise).await?;
    schedule_next_attempt(conn, row.id, Utc::now() + SUBMIT_MAX_BACKOFF).await?;
    credit_registration_events::insert(
        conn,
        &NewCreditRegistrationEvent {
            message: Some(format!(
                "Import could not prepare this row, so it was held back: {}",
                scrub_text(&error.to_string())
            )),
            ..NewCreditRegistrationEvent::new(row.id, CreditRegistrationEventKind::RetryScheduled)
        },
    )
    .await?;
    Ok(())
}

/// A frozen snapshot that cannot be sent. Suotar validates every item before acting on any, so one
/// it would refuse takes the rest of the batch down with it.
enum Unsendable {
    Incomplete,
    UnknownGrade,
    /// A field Suotar requires to be non-empty, or `credits`, which it requires to be finite.
    Invalid(&'static str),
}

impl Unsendable {
    fn unasked_move(&self) -> UnaskedMove {
        match self {
            Self::Incomplete => incomplete_payload(),
            Self::UnknownGrade => unknown_grade(),
            Self::Invalid(field) => invalid_payload_field(field),
        }
    }
}

fn required_field<'a>(field: &'static str, value: &'a str) -> Result<&'a str, Unsendable> {
    let value = value.trim();
    if value.is_empty() {
        Err(Unsendable::Invalid(field))
    } else {
        Ok(value)
    }
}

/// Builds the submission from the frozen snapshot, or says why the row cannot go into a batch.
fn build_submission(row: &CreditRegistration) -> Result<AttainmentSubmission, Unsendable> {
    let (
        Some(student_number),
        Some(course_code),
        Some(enrolment_id),
        Some(attainment_date),
        Some(attainment_language),
        Some(grade_scale_id),
        Some(grade_id),
        Some(credits),
    ) = (
        row.student_number.as_ref().map(ExposeSecret::expose_secret),
        row.uh_course_code.as_deref(),
        row.selected_enrolment_id.as_deref(),
        row.attainment_date,
        row.attainment_language.as_deref(),
        row.grade_scale_id.as_deref(),
        row.grade_id.as_deref(),
        row.credits,
    )
    else {
        return Err(Unsendable::Incomplete);
    };
    let student_number = required_field("studentNumber", student_number)?;
    let course_code = CourseCode::parse(course_code).ok_or(Unsendable::Invalid("courseCode"))?;
    let enrolment_id = required_field("enrolmentId", enrolment_id)?;
    let attainment_language = required_field("attainmentLanguage", attainment_language)?;
    let grade = MappedGrade {
        grade_scale_id: required_field("gradeScaleId", grade_scale_id)?.to_string(),
        grade_id: required_field("gradeId", grade_id)?.to_string(),
    };
    let credits = Credits::from_stored(credits).ok_or(Unsendable::Invalid("credits"))?;
    // Suotar would refuse it as `invalidGradeForGradeScale`; refused here, the row fails on our
    // mapping without a round trip.
    if !is_known_grade(&grade) {
        return Err(Unsendable::UnknownGrade);
    }
    Ok(AttainmentSubmission {
        student_number: StudentNumber::new(student_number),
        course_code,
        enrolment_id: enrolment_id.to_string(),
        attainment_date,
        attainment_language: attainment_language.to_string(),
        grade,
        credits,
    })
}
