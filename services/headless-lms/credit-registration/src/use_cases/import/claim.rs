//! Claiming the rows an import iteration sends: which of them may go out, and the submission each
//! one carries.

use headless_lms_models::course_module_completion_registered_to_study_registries::completion_ids_registered_by_a_registrar;
use headless_lms_models::credit_registration_events::{
    self, CreditRegistrationEventKind, NewCreditRegistrationEvent, scrub_text,
};
use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationState, Transition, claim_due_for_import,
    schedule_next_attempt, set_needs_admin_attention, transition,
};
use headless_lms_models::library::credit_registration::backoff::SUBMIT_MAX_BACKOFF;
use headless_lms_models::library::credit_registration::grade_mapping::is_known_grade;
use headless_lms_models::{ModelError, ModelResult};
use headless_lms_utils::prelude::Utc;
use secrecy::ExposeSecret;
use sqlx::{Connection, PgConnection};
use std::collections::HashSet;
use uuid::Uuid;

use crate::domain::{ClaimedRegistration, Prepared, transitions};
use crate::error::CreditRegistrationResult;
use crate::error_reports::ErrorReporter;
use crate::registry::{AttainmentSubmission, CourseCode, StudentNumber};
use crate::use_cases::contexts::BatchFlowContext;

/// Claims at most `limit` rows due for import, moves each one it may send to `submitting`, and
/// settles the rest where they stand.
pub(super) async fn claim_import_candidates(
    ctx: &BatchFlowContext<'_>,
    conn: &mut PgConnection,
    limit: usize,
) -> CreditRegistrationResult<Prepared<ClaimedRegistration, AttainmentSubmission>> {
    let claimed = claim_due_for_import(conn, ctx.scope, limit as i64).await?;
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
    let mut batched_student_courses = HashSet::new();
    for row in claimed {
        // Left claimable where it is: once its twin is in flight the claim holds it back until
        // that one settles.
        let student_course = (
            row.student_number
                .as_ref()
                .map(|number| number.expose_secret().to_string()),
            row.uh_course_code.clone(),
        );
        if !batched_student_courses.insert(student_course) {
            debug!(
                credit_registration_id = %row.id,
                "Leaving row claimable: another attempt for the same student and course is already in this batch"
            );
            continue;
        }
        // One row's database error must not roll back the whole claim, which would leave the
        // same row at the head of the next one.
        let mut savepoint = conn.begin().await?;
        match preflight_submission(&mut savepoint, &row, &already_registered).await {
            Ok(Preflight::Send(submission)) => {
                savepoint.commit().await?;
                prepared.send(
                    ClaimedRegistration::moved_to(row, CreditRegistrationState::Submitting),
                    submission,
                );
            }
            Ok(Preflight::Decided { failed }) => {
                savepoint.commit().await?;
                prepared.record_decided(failed);
            }
            Err(error) => {
                savepoint.rollback().await?;
                hold_back(&ctx.errors, conn, &row, &error).await?;
                prepared.record_decided(true);
            }
        }
    }
    Ok(prepared)
}

/// What the preflight made of one claimed row.
enum Preflight {
    /// Committed as `submitting`; the submission goes in the batch.
    Send(AttainmentSubmission),
    /// Moved somewhere without a request; `failed` if it now carries an error code.
    Decided { failed: bool },
}

async fn preflight_submission(
    conn: &mut PgConnection,
    row: &CreditRegistration,
    already_registered: &[Uuid],
) -> ModelResult<Preflight> {
    if already_registered.contains(&row.course_module_completion_id) {
        debug!(
            credit_registration_id = %row.id,
            "Another registrar already registered this completion; marking duplicate"
        );
        transition(conn, row.id, &transitions::duplicate_of_other_registrar()).await?;
        return Ok(Preflight::Decided { failed: false });
    }
    match build_submission(row) {
        Ok(submission) => {
            transition(conn, row.id, &transitions::submitting()).await?;
            Ok(Preflight::Send(submission))
        }
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
            transition(conn, row.id, &problem.transition()).await?;
            Ok(Preflight::Decided { failed: true })
        }
    }
}

/// Parks a row the preflight could not write, flagged for an admin, so the rest of the claim still
/// goes out.
async fn hold_back(
    errors: &ErrorReporter<'_>,
    conn: &mut PgConnection,
    row: &CreditRegistration,
    error: &ModelError,
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
    set_needs_admin_attention(conn, row.id, true).await?;
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
    fn transition(&self) -> Transition {
        match self {
            Self::Incomplete => transitions::unsendable_incomplete_payload(),
            Self::UnknownGrade => transitions::unsendable_unknown_grade(),
            Self::Invalid(field) => transitions::unsendable_field(field),
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
    let course_code = required_field("courseCode", course_code)?;
    let enrolment_id = required_field("enrolmentId", enrolment_id)?;
    let attainment_language = required_field("attainmentLanguage", attainment_language)?;
    let grade_scale_id = required_field("gradeScaleId", grade_scale_id)?;
    let grade_id = required_field("gradeId", grade_id)?;
    if !credits.is_finite() {
        return Err(Unsendable::Invalid("credits"));
    }
    // Suotar would refuse it as `invalidGradeForGradeScale`; refused here, the row fails on our
    // mapping without a round trip.
    if !is_known_grade(grade_scale_id, grade_id) {
        return Err(Unsendable::UnknownGrade);
    }
    Ok(AttainmentSubmission {
        student_number: StudentNumber::new(student_number),
        course_code: CourseCode::new(course_code),
        enrolment_id: enrolment_id.to_string(),
        attainment_date,
        attainment_language: attainment_language.to_string(),
        grade_scale_id: grade_scale_id.to_string(),
        grade_id: grade_id.to_string(),
        credits: round_credits(credits),
    })
}

/// Rounds away the f32-to-f64 widening error before the value goes on the wire: ECTS credits are
/// never finer than 0.1, and 2.7f32 would otherwise be sent as 2.700000047683716.
fn round_credits(credits: f32) -> f64 {
    (f64::from(credits) * 10.0).round() / 10.0
}
