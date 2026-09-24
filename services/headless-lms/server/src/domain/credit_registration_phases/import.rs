//! The `import` phase: the one call that creates something in the study registry.
//!
//! A row is committed as `submitting` before the request leaves. Only Suotar's own `notRegistered`
//! leads from that state or `submission_uncertain` back into a batch: a second import on a guess
//! would put a second attainment on a real transcript, and we could neither see it nor undo it.

use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::course_module_completion_registered_to_study_registries::completion_ids_registered_by_a_registrar;
use headless_lms_models::credit_registration_events::CreditRegistrationEventKind;
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationErrorCode, CreditRegistrationState, Transition,
    claim_due_for_import, restamp_submitting, set_sisu_attainment_if_unclaimed,
    set_submitted_attainment, transition,
};
use headless_lms_models::library::credit_registration::classification::map_code;
use headless_lms_models::library::credit_registration::grade_mapping::is_known_grade;
use headless_lms_models::library::credit_registration::outcomes::{
    import_success_outcome, import_success_state, isolated_malformed_request_outcome,
    submission_uncertain, submit_error_outcome, unanswered_item_outcome,
};
use headless_lms_models::secret::DbSecret;
use headless_lms_utils::error::util_error::{SuotarErrorVariant, UtilError};
use headless_lms_utils::services::suotar::{
    ImportAttainmentRequestItem, ImportAttainmentResult, SuotarAttainment, SuotarBatchResponse,
    SuotarCallContext, SuotarEndpoint, SuotarItemStatus, SuotarResponseItem, new_request_item_id,
};
use secrecy::ExposeSecret;
use sqlx::PgConnection;
use std::collections::HashSet;

use super::{
    CreditRegistrationPhase, OutcomeEvent, PhaseContext, PhaseScope, Prepared, SuotarBatchPhase,
    apply_outcome, apply_request_level_outcome, row_facts, row_moved_on, run_suotar_batch_phase,
    suotar_error_variant,
};

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    run_suotar_batch_phase(&mut Import, ctx, scope).await
}

struct Import;

/// Suotar's answer for a later item of a batch that repeats an earlier one; it names the earlier
/// item's submission.
const DUPLICATE_REQUEST_ITEM_CODE: &str = "duplicateRequestItem";

impl SuotarBatchPhase for Import {
    type Row = CreditRegistration;
    type Item = ImportAttainmentRequestItem;
    type Result = ImportAttainmentResult;

    const ALL_UNAVAILABLE_ERROR: &'static str =
        "Every item of the batch timed out in Sisu or came back unavailable.";

    async fn prepare(
        &mut self,
        _ctx: &PhaseContext<'_>,
        conn: &mut PgConnection,
        scope: &PhaseScope,
    ) -> anyhow::Result<Prepared<Self::Row, Self::Item>> {
        let claimed = claim_due_for_import(
            conn,
            scope,
            SuotarEndpoint::ImportAttainments.max_batch_size() as i64,
        )
        .await?;
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
            if already_registered.contains(&row.course_module_completion_id) {
                transition(
                    conn,
                    row.id,
                    &Transition {
                        event_message: Some(
                            "Another registrar had already registered this completion, so nothing \
                             was submitted."
                                .to_string(),
                        ),
                        ..Transition::to(CreditRegistrationState::Duplicate)
                    },
                )
                .await?;
                prepared.decided += 1;
                continue;
            }
            match request_item(&row) {
                Ok(item) => {
                    // Committed before the request leaves: a row found in `submitting` after a
                    // restart has an unknown outcome and is never sent again.
                    transition(
                        conn,
                        row.id,
                        &Transition::to(CreditRegistrationState::Submitting),
                    )
                    .await?;
                    prepared.sendable.push((row, item));
                }
                Err(problem) => {
                    transition(conn, row.id, &problem.transition()).await?;
                    prepared.decided += 1;
                    prepared.failed += 1;
                }
            }
        }
        Ok(prepared)
    }

    fn registration(row: &Self::Row) -> &CreditRegistration {
        row
    }

    fn sent_student_number(row: &Self::Row) -> Option<&DbSecret> {
        row.student_number.as_ref()
    }

    async fn send(
        &self,
        ctx: &PhaseContext<'_>,
        rows: &[Self::Row],
        items: Vec<Self::Item>,
    ) -> Result<SuotarBatchResponse<Self::Result>, UtilError> {
        ctx.suotar_client
            .import_attainments(
                SuotarCallContext::new(ctx.worker_name(CreditRegistrationPhase::Import))
                    .for_registrations(rows.iter().map(|row| row.id).collect()),
                items,
            )
            .await
    }

    async fn apply(
        &self,
        conn: &mut PgConnection,
        row: &Self::Row,
        item: Option<&SuotarResponseItem<Self::Result>>,
        event: OutcomeEvent<'_>,
    ) -> anyhow::Result<bool> {
        apply_answer(conn, row, item, event).await
    }

    async fn apply_request_rejection(
        &self,
        conn: &mut PgConnection,
        row: &Self::Row,
        request: &serde_json::Value,
        request_item_id: &str,
        error: &UtilError,
    ) -> anyhow::Result<bool> {
        apply_request_level_outcome(
            conn,
            SuotarEndpoint::ImportAttainments,
            row,
            request,
            request_item_id,
            error,
            CreditRegistrationState::Submitting,
        )
        .await
    }

    /// Suotar validates every item before acting on any, so a malformed-request refusal proves
    /// nothing was written, and one bad row takes its whole batch down with it.
    fn isolates_request_rejection(error: &UtilError) -> bool {
        suotar_error_variant(error) == SuotarErrorVariant::MalformedRequest
    }

    async fn keep_in_flight(
        &self,
        conn: &mut PgConnection,
        rows: &[&Self::Row],
    ) -> anyhow::Result<()> {
        restamp_submitting(conn, &rows.iter().map(|row| row.id).collect::<Vec<_>>()).await?;
        Ok(())
    }

    async fn release_unsent(
        &self,
        conn: &mut PgConnection,
        rows: &[&Self::Row],
    ) -> anyhow::Result<()> {
        for row in rows {
            let released = transition(
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
            .await;
            if let Err(error) = released.map_err(anyhow::Error::from)
                && !row_moved_on(&error)
            {
                return Err(error);
            }
        }
        Ok(())
    }

    async fn apply_isolated_rejection(
        &self,
        conn: &mut PgConnection,
        row: &Self::Row,
        request: &serde_json::Value,
        request_item_id: &str,
        error: &UtilError,
    ) -> anyhow::Result<bool> {
        apply_outcome(
            conn,
            row,
            &isolated_malformed_request_outcome(),
            OutcomeEvent {
                message: Some(
                    "The study registry refused this row as a malformed request even when sent \
                     alone.",
                ),
                error_message: Some(error.message()),
                request_item_id: Some(request_item_id),
                request: Some(request),
                ..OutcomeEvent::default()
            },
            Some(CreditRegistrationState::Submitting),
        )
        .await?;
        Ok(true)
    }
}

/// Applies the study registry's answer for one submitted row. Returns whether the row ended up in a
/// failure state; errors with `PreconditionFailed` if the row left `submitting` meanwhile.
///
/// Anything the answer disclosed about the attainment is written before the transition, so a row
/// that did move on still keeps the id support needs to find what was created.
async fn apply_answer(
    conn: &mut PgConnection,
    row: &CreditRegistration,
    item: Option<&SuotarResponseItem<ImportAttainmentResult>>,
    event: OutcomeEvent<'_>,
) -> anyhow::Result<bool> {
    let facts = row_facts(row);
    match item {
        // Sent and unanswered: verified from here, never re-sent.
        None => {
            apply_outcome(
                conn,
                row,
                &unanswered_item_outcome(SuotarEndpoint::ImportAttainments, row.state, &facts),
                OutcomeEvent {
                    message: Some(
                        "The study registry did not answer for this item, so whether the \
                         attainment was created is unknown.",
                    ),
                    ..event
                },
                Some(CreditRegistrationState::Submitting),
            )
            .await?;
            Ok(true)
        }
        Some(item) => match import_success_state(&item.code) {
            // `sent` or `duplicateRequestItem`: both name a submission to verify.
            Some(CreditRegistrationState::AwaitingVerification) => {
                let submitted = item.result.as_ref().and_then(|result| {
                    result
                        .submitted_attainment_id
                        .as_deref()
                        .map(|id| (id, result.submitted_attainment_type.as_deref()))
                });
                match submitted {
                    Some((id, attainment_type)) => {
                        set_submitted_attainment(conn, row.id, id, attainment_type).await?;
                        let mut outcome =
                            import_success_outcome(CreditRegistrationState::AwaitingVerification);
                        let mut event = event;
                        if item.code == DUPLICATE_REQUEST_ITEM_CODE {
                            error!(
                                "Suotar answered duplicateRequestItem for credit registration {}: \
                                 a batch carried the same completion twice.",
                                row.id
                            );
                            outcome.needs_admin_attention = Some(true);
                            event.message = Some(
                                "Suotar found this completion twice in one batch and submitted \
                                 only the first; the batch should never have held both.",
                            );
                        }
                        apply_outcome(
                            conn,
                            row,
                            &outcome,
                            event,
                            Some(CreditRegistrationState::Submitting),
                        )
                        .await?;
                        Ok(false)
                    }
                    // Accepted with nothing to verify by; recovery is a lookup among the student's
                    // existing attainments, never a second import.
                    None => {
                        apply_outcome(
                            conn,
                            row,
                            &submission_uncertain(),
                            OutcomeEvent {
                                message: Some(
                                    "The submission was accepted without an id to verify it by.",
                                ),
                                ..event
                            },
                            Some(CreditRegistrationState::Submitting),
                        )
                        .await?;
                        Ok(true)
                    }
                }
            }
            Some(state) => {
                let attainment = item.result.as_ref().and_then(|result| {
                    result
                        .attainment
                        .as_ref()
                        .or(result.previous_attainment.as_ref())
                });
                record_attainment(conn, row, attainment).await?;
                let message = settled_message(state, attainment);
                apply_outcome(
                    conn,
                    row,
                    &import_success_outcome(state),
                    OutcomeEvent {
                        message: message.as_deref(),
                        ..event
                    },
                    Some(CreditRegistrationState::Submitting),
                )
                .await?;
                Ok(false)
            }
            None if item.status == SuotarItemStatus::Error => {
                apply_error_answer(conn, row, item, event).await
            }
            // A success code we do not know cannot be read as "nothing was created".
            None => {
                apply_outcome(
                    conn,
                    row,
                    &submission_uncertain(),
                    OutcomeEvent {
                        message: Some(
                            "The study registry answered with a success code we do not know, so \
                             whether the attainment was created is unknown.",
                        ),
                        ..event
                    },
                    Some(CreditRegistrationState::Submitting),
                )
                .await?;
                Ok(true)
            }
        },
    }
}

/// An error item. A `sisuTimeout` still names the submission it may have made, which turns its
/// recovery into plain verification instead of a hunt through the student's existing attainments.
async fn apply_error_answer(
    conn: &mut PgConnection,
    row: &CreditRegistration,
    item: &SuotarResponseItem<ImportAttainmentResult>,
    event: OutcomeEvent<'_>,
) -> anyhow::Result<bool> {
    let code = map_code(SuotarEndpoint::ImportAttainments, &item.code)
        .unwrap_or(CreditRegistrationErrorCode::Unknown);
    let outcome = submit_error_outcome(SuotarEndpoint::ImportAttainments, code, &row_facts(row));
    if outcome.to_state == CreditRegistrationState::SubmissionUncertain
        && let Some(result) = item.result.as_ref()
        && let Some(submitted) = result.submitted_attainment_id.as_deref()
    {
        set_submitted_attainment(
            conn,
            row.id,
            submitted,
            result.submitted_attainment_type.as_deref(),
        )
        .await?;
    }
    apply_outcome(
        conn,
        row,
        &outcome,
        OutcomeEvent {
            error_message: item.error.as_ref().map(|error| error.message.as_str()),
            ..event
        },
        Some(CreditRegistrationState::Submitting),
    )
    .await?;
    Ok(true)
}

/// The timeline line for an answer that settled the row. `not_improved` names the grade the registry
/// held, because "already equal or better" without it reads as a bug to whoever raised the grade.
fn settled_message(
    state: CreditRegistrationState,
    attainment: Option<&SuotarAttainment>,
) -> Option<String> {
    match state {
        CreditRegistrationState::Duplicate => {
            Some("The study registry already held a matching attainment.".to_string())
        }
        CreditRegistrationState::NotImproved => Some(match held_grade(attainment) {
            Some(grade) => format!(
                "The study registry already holds an equal or better attainment, graded {grade}."
            ),
            None => "The study registry already holds an equal or better attainment.".to_string(),
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

async fn record_attainment(
    conn: &mut PgConnection,
    row: &CreditRegistration,
    attainment: Option<&SuotarAttainment>,
) -> anyhow::Result<()> {
    if let Some(attainment) = attainment {
        set_sisu_attainment_if_unclaimed(
            conn,
            row.id,
            &attainment.id,
            Some(&attainment.attainment_type),
        )
        .await?;
    }
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
                event_message: Some(
                    "The frozen grade is not one the study registry accepts.".to_string(),
                ),
                ..Transition::to(CreditRegistrationState::FailedPermanent)
            },
            Self::Invalid(field) => Transition {
                error_code: Some(CreditRegistrationErrorCode::Unknown),
                needs_admin_attention: Some(true),
                event_message: Some(format!(
                    "The frozen payload's {field} is one the study registry refuses, so it was not \
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
