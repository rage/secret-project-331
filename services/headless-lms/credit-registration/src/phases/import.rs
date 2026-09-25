//! The `import` phase: the one call that creates something in the study registry.
//!
//! A row is committed as `submitting` before the request leaves. Only Suotar's own `notRegistered`
//! leads from that state or `submission_uncertain` back into a batch: a second import on a guess
//! would put a second attainment on a real transcript, and we could neither see it nor undo it.

use headless_lms_models::course_module_completion_registered_to_study_registries::completion_ids_registered_by_a_registrar;
use headless_lms_models::credit_registration_events::{
    self, CreditRegistrationEventKind, NewCreditRegistrationEvent, scrub_text,
};
use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationErrorCode, CreditRegistrationState, Transition,
    claim_due_for_import, restamp_submitting, schedule_next_attempt, set_needs_admin_attention,
    transition, transition_unless_moved_on,
};
use headless_lms_models::library::credit_registration::backoff::SUBMIT_MAX_BACKOFF;
use headless_lms_models::library::credit_registration::classification::{
    DUPLICATE_REQUEST_ITEM_CODE, map_code,
};
use headless_lms_models::library::credit_registration::grade_mapping::is_known_grade;
use headless_lms_models::library::credit_registration::outcomes::{
    Outcome, RowFacts, import_success_outcome, import_success_state, submission_uncertain,
    submit_error_outcome, unanswered_item_outcome,
};
use headless_lms_models::{ModelError, ModelResult};
use headless_lms_utils::prelude::Utc;
use headless_lms_utils::services::suotar::{
    ImportAttainmentRequestItem, ImportAttainmentResult, SuotarAttainment, SuotarEndpoint,
    SuotarItemStatus, SuotarResponseItem, endpoints, new_request_item_id,
};
use secrecy::ExposeSecret;
use sqlx::{Connection, PgConnection};
use std::collections::HashSet;
use uuid::Uuid;

use crate::apply::{Applied, Decision, Effects, OutcomeEvent, apply_decision};
use crate::batch_phase::{Prepared, Refusal, SuotarBatchPhase, run_suotar_batch_phase};
use crate::dispatch::{Counts, Iteration};
use crate::error::CreditRegistrationResult;

const ENDPOINT: SuotarEndpoint = SuotarEndpoint::ImportAttainments;

pub(crate) async fn run(it: &mut Iteration<'_>) -> CreditRegistrationResult<Counts> {
    run_suotar_batch_phase(&mut Import, it).await
}

struct Import;

impl SuotarBatchPhase for Import {
    type Endpoint = endpoints::ImportAttainments;
    type Row = CreditRegistration;

    const ALL_UNAVAILABLE_ERROR: &'static str =
        "Every item of the batch timed out in Sisu or came back unavailable.";

    async fn claim(
        &mut self,
        it: &Iteration<'_>,
        conn: &mut PgConnection,
        limit: usize,
    ) -> CreditRegistrationResult<Prepared<Self::Row, ImportAttainmentRequestItem>> {
        let claimed = claim_due_for_import(conn, it.scope, limit as i64).await?;
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

        let mut prepared = Prepared::default();
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
                continue;
            }
            // One row's database error must not roll back the whole claim, which would leave the
            // same row at the head of the next one.
            let mut savepoint = conn.begin().await?;
            match preflight(&mut savepoint, &row, &already_registered).await {
                Ok(Preflight::Send(item)) => {
                    savepoint.commit().await?;
                    prepared.sendable.push((row, item));
                }
                Ok(Preflight::Decided { failed }) => {
                    savepoint.commit().await?;
                    prepared.decided += 1;
                    prepared.failed += i32::from(failed);
                }
                Err(error) => {
                    savepoint.rollback().await?;
                    hold_back(conn, &row, &error).await?;
                    prepared.decided += 1;
                    prepared.failed += 1;
                }
            }
        }
        Ok(prepared)
    }

    async fn apply(
        &self,
        conn: &mut PgConnection,
        row: &Self::Row,
        item: Option<&SuotarResponseItem<ImportAttainmentResult>>,
        event: OutcomeEvent<'_>,
    ) -> CreditRegistrationResult<Applied> {
        let decision = decide(row, item, &RowFacts::of(row, Utc::now()));
        apply_decision(
            conn,
            row,
            decision,
            event,
            Some(CreditRegistrationState::Submitting),
        )
        .await
    }

    fn on_refusal(&self, _row: &Self::Row) -> Refusal {
        Refusal::RequestLevel {
            in_flight: CreditRegistrationState::Submitting,
        }
    }

    async fn keep_in_flight(
        &self,
        conn: &mut PgConnection,
        rows: &[&Self::Row],
    ) -> CreditRegistrationResult<()> {
        restamp_submitting(conn, &rows.iter().map(|row| row.id).collect::<Vec<_>>()).await?;
        Ok(())
    }

    async fn release_unsent(
        &self,
        conn: &mut PgConnection,
        rows: &[&Self::Row],
    ) -> CreditRegistrationResult<()> {
        for row in rows {
            transition_unless_moved_on(
                conn,
                row.id,
                &Transition {
                    event_message: Some(
                        "The worker shut down before this row's part of a split batch was sent, so \
                         nothing was submitted."
                            .to_string(),
                    ),
                    expected_from_state: Some(CreditRegistrationState::Submitting),
                    ..Transition::to(CreditRegistrationState::Pending)
                },
            )
            .await?;
        }
        Ok(())
    }
}

/// What the preflight made of one claimed row.
enum Preflight {
    /// Committed as `submitting`; the item goes in the batch.
    Send(ImportAttainmentRequestItem),
    /// Moved somewhere without a request; `failed` if it now carries an error code.
    Decided { failed: bool },
}

async fn preflight(
    conn: &mut PgConnection,
    row: &CreditRegistration,
    already_registered: &[Uuid],
) -> ModelResult<Preflight> {
    if already_registered.contains(&row.course_module_completion_id) {
        transition(
            conn,
            row.id,
            &Transition {
                event_message: Some(
                    "Another registrar had already registered this completion, so nothing was \
                     submitted."
                        .to_string(),
                ),
                ..Transition::to(CreditRegistrationState::Duplicate)
            },
        )
        .await?;
        return Ok(Preflight::Decided { failed: false });
    }
    match request_item(row) {
        Ok(item) => {
            // Committed before the request leaves: a row found in `submitting` after a restart has
            // an unknown outcome and is never sent again.
            transition(
                conn,
                row.id,
                &Transition::to(CreditRegistrationState::Submitting),
            )
            .await?;
            Ok(Preflight::Send(item))
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
    conn: &mut PgConnection,
    row: &CreditRegistration,
    error: &ModelError,
) -> CreditRegistrationResult<()> {
    error!(
        credit_registration_id = %row.id,
        error = ?error,
        "Could not prepare credit registration for import; holding it back"
    );
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

/// What the study registry's answer for one submitted row does to it. Anything the answer disclosed
/// about the attainment rides along as an effect, written before the move.
fn decide<'a>(
    row: &CreditRegistration,
    item: Option<&'a SuotarResponseItem<ImportAttainmentResult>>,
    facts: &RowFacts,
) -> Decision<'a> {
    // Sent and unanswered: verified from here, never re-sent.
    let Some(item) = item else {
        return Decision::new(unanswered_item_outcome(ENDPOINT, row.state, facts)).with_message(
            "Sisu did not answer for this item, so we do not know yet whether the credits were \
             registered.",
        );
    };
    let submitted = item.result.as_ref().and_then(|result| {
        result
            .submitted_attainment_id
            .as_deref()
            .map(|id| (id, result.submitted_attainment_type.as_deref()))
    });
    match import_success_state(&item.code) {
        // `sent` or `duplicateRequestItem`: both name a submission to verify.
        Some(CreditRegistrationState::AwaitingVerification) => {
            let Some(submitted) = submitted else {
                // Accepted with nothing to verify by; recovery is a lookup among the student's
                // existing attainments, never a second import.
                return Decision::new(submission_uncertain())
                    .with_message("The submission was accepted without an id to verify it by.");
            };
            let effects = Effects {
                submitted_attainment: Some(submitted),
                ..Effects::default()
            };
            let outcome = import_success_outcome(CreditRegistrationState::AwaitingVerification);
            if item.code != DUPLICATE_REQUEST_ITEM_CODE {
                return Decision::new(outcome).with_effects(effects);
            }
            error!(
                credit_registration_id = %row.id,
                "Suotar answered duplicateRequestItem; a batch carried the same completion twice"
            );
            Decision::new(Outcome {
                needs_admin_attention: Some(true),
                ..outcome
            })
            .with_effects(effects)
            .with_message(
                "Suotar found this completion twice in one batch and submitted only the first; the \
                 batch should never have held both.",
            )
        }
        Some(state) => {
            let attainment = item.result.as_ref().and_then(|result| {
                result
                    .attainment
                    .as_ref()
                    .or(result.previous_attainment.as_ref())
            });
            let decision = Decision::new(import_success_outcome(state)).with_effects(Effects {
                sisu_attainment: attainment.map(|attainment| {
                    (attainment.id.as_str(), attainment.attainment_type.as_str())
                }),
                ..Effects::default()
            });
            match settled_message(state, attainment) {
                Some(message) => decision.with_message(message),
                None => decision,
            }
        }
        // A `sisuTimeout` still names the submission it may have made, which turns its recovery
        // into plain verification instead of a hunt through the student's existing attainments.
        None if item.status == SuotarItemStatus::Error => {
            let code =
                map_code(ENDPOINT, &item.code).unwrap_or(CreditRegistrationErrorCode::Unknown);
            let outcome = submit_error_outcome(ENDPOINT, code, facts);
            let effects = Effects {
                submitted_attainment: submitted
                    .filter(|_| outcome.to_state == CreditRegistrationState::SubmissionUncertain),
                ..Effects::default()
            };
            Decision::new(outcome)
                .with_effects(effects)
                .with_error_message(item.error.as_ref().map(|error| error.message.as_str()))
        }
        // A success code we do not know cannot be read as "nothing was created".
        None => Decision::new(submission_uncertain()).with_message(
            "Sisu answered with a success code we do not know, so we do not know yet whether the \
             credits were registered.",
        ),
    }
}

/// The timeline line for an answer that settled the row. `not_improved` names the grade the registry
/// held, because "already equal or better" without it reads as a bug to whoever raised the grade.
fn settled_message(
    state: CreditRegistrationState,
    attainment: Option<&SuotarAttainment>,
) -> Option<String> {
    match state {
        CreditRegistrationState::Duplicate => Some("Sisu already had these credits.".to_string()),
        CreditRegistrationState::NotImproved => Some(match held_grade(attainment) {
            Some(grade) => format!("Sisu already has an equal or better grade: {grade}."),
            None => "Sisu already has an equal or better grade.".to_string(),
        }),
        _ => None,
    }
}

/// The registry's own grade for an attainment, with its scale named: "1" is a pass on one scale and
/// a one out of five on the other.
fn held_grade(attainment: Option<&SuotarAttainment>) -> Option<String> {
    let attainment = attainment?;
    let grade_id = attainment.grade_id.as_deref()?;
    Some(match attainment.grade_scale_id.as_deref() {
        Some(scale) => format!("{grade_id} on {scale}"),
        None => grade_id.to_string(),
    })
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
            Self::Incomplete => Transition {
                event_kind: CreditRegistrationEventKind::StateChanged,
                event_message: Some(
                    "The frozen payload is incomplete, so the enrolment is resolved again."
                        .to_string(),
                ),
                ..Transition::to(CreditRegistrationState::ReadyToSubmit)
            },
            Self::UnknownGrade => Transition {
                error_code: Some(CreditRegistrationErrorCode::NoGradeScaleMapping),
                needs_admin_attention: Some(true),
                event_message: Some("Sisu does not accept this grade.".to_string()),
                ..Transition::to(CreditRegistrationState::FailedPermanent)
            },
            Self::Invalid(field) => Transition {
                error_code: Some(CreditRegistrationErrorCode::Unknown),
                needs_admin_attention: Some(true),
                event_message: Some(format!(
                    "Sisu does not accept the {field} we would send, so nothing was \
                     sent."
                )),
                ..Transition::to(CreditRegistrationState::FailedPermanent)
            },
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

/// Builds the request item from the frozen snapshot, or says why the row cannot go into a batch.
fn request_item(row: &CreditRegistration) -> Result<ImportAttainmentRequestItem, Unsendable> {
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
    Ok(ImportAttainmentRequestItem {
        request_item_id: new_request_item_id(),
        student_number: student_number.into(),
        course_code: course_code.to_string(),
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
