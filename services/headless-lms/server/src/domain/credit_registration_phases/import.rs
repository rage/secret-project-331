//! The `import` phase: the one call that creates something in the study registry.
//!
//! A row is committed as `submitting` before the request leaves, and no path leads from that state
//! or `submission_uncertain` back into a batch: a second import for one row would put a second
//! attainment on a real transcript, and we could neither see it nor undo it.

use headless_lms_models::course_module_completion_registered_to_study_registries::completion_ids_registered_by_a_registrar;
use headless_lms_models::credit_registration_events::CreditRegistrationEventKind;
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationErrorCode, CreditRegistrationState, RequestPurpose,
    Transition, claim_due, request_item_id, set_sisu_attainment_if_unclaimed,
    set_submitted_attainment, transition,
};
use headless_lms_models::library::credit_registration::classification::map_code;
use headless_lms_models::library::credit_registration::grade_mapping::is_known_grade;
use headless_lms_models::library::credit_registration::outcomes::{
    import_success_outcome, import_success_state, submission_uncertain, submit_error_outcome,
    unanswered_item_outcome,
};
use headless_lms_utils::error::util_error::UtilError;
use headless_lms_utils::services::suotar::{
    ImportAttainmentRequestItem, ImportAttainmentResult, SuotarAttainment, SuotarBatchResponse,
    SuotarCallContext, SuotarEndpoint, SuotarItemStatus, SuotarResponseItem,
};
use sqlx::PgConnection;

use super::{
    CreditRegistrationPhase, OutcomeEvent, PhaseContext, PhaseScope, Prepared, SuotarBatchPhase,
    apply_outcome, apply_request_level_outcome, row_facts, run_suotar_batch_phase,
};

/// The only state this phase claims; the absence of `submitting`, `submission_uncertain` and
/// `resolving_enrolment` is what makes a second import for one row, or an import before its
/// enrolment is resolved, unreachable.
const CLAIMED_STATES: [CreditRegistrationState; 1] = [CreditRegistrationState::CheckingEnrolment];

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    run_suotar_batch_phase(&mut Import, ctx, scope).await
}

struct Import;

impl SuotarBatchPhase for Import {
    type Row = CreditRegistration;
    type Item = ImportAttainmentRequestItem;
    type Result = ImportAttainmentResult;

    const ALL_TRANSIENT_ERROR: &'static str =
        "Every item of the batch came back transiently unavailable.";

    async fn prepare(
        &mut self,
        _ctx: &PhaseContext<'_>,
        conn: &mut PgConnection,
        scope: &PhaseScope,
    ) -> anyhow::Result<Prepared<Self::Row, Self::Item>> {
        let claimed = claim_due(
            conn,
            &CLAIMED_STATES,
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
        for row in claimed {
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

    fn request_item_id(row: &Self::Row) -> String {
        request_item_id(row, RequestPurpose::Submission)
    }

    fn sent_student_number(row: &Self::Row) -> Option<&str> {
        row.student_number.as_deref()
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
        error: &UtilError,
    ) -> anyhow::Result<bool> {
        apply_request_level_outcome(
            conn,
            SuotarEndpoint::ImportAttainments,
            row,
            request,
            error,
            CreditRegistrationState::Submitting,
        )
        .await
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
        Some(item) if item.status == SuotarItemStatus::Error => {
            let code = map_code(SuotarEndpoint::ImportAttainments, &item.code)
                .unwrap_or(CreditRegistrationErrorCode::Unknown);
            let outcome = submit_error_outcome(SuotarEndpoint::ImportAttainments, code, &facts);
            if outcome.to_state == CreditRegistrationState::SubmissionUncertain
                && let Some(disclosed) = item
                    .error
                    .as_ref()
                    .and_then(|error| error.submitted_attainment_id.as_deref())
            {
                // A disclosed id turns the recovery into plain verification instead of a hunt
                // through the student's existing attainments.
                set_submitted_attainment(conn, row.id, disclosed, None).await?;
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
        Some(item) => {
            let result = item.result.as_ref();
            match import_success_state(&item.code) {
                // A success code we do not know cannot be read as "nothing was created".
                None => {
                    apply_outcome(
                        conn,
                        row,
                        &submission_uncertain(),
                        OutcomeEvent {
                            message: Some(
                                "The study registry answered with a success code we do not know, \
                                 so whether the attainment was created is unknown.",
                            ),
                            ..event
                        },
                        Some(CreditRegistrationState::Submitting),
                    )
                    .await?;
                    Ok(true)
                }
                Some(CreditRegistrationState::AwaitingVerification) => {
                    let submitted = result.and_then(|result| {
                        result
                            .submitted_attainment_id
                            .as_deref()
                            .map(|id| (id, result.submitted_attainment_type.as_deref()))
                    });
                    match submitted {
                        Some((id, attainment_type)) => {
                            set_submitted_attainment(conn, row.id, id, attainment_type).await?;
                            apply_outcome(
                                conn,
                                row,
                                &import_success_outcome(
                                    CreditRegistrationState::AwaitingVerification,
                                ),
                                event,
                                Some(CreditRegistrationState::Submitting),
                            )
                            .await?;
                            Ok(false)
                        }
                        // Accepted with nothing to verify by; recovery is a lookup among the
                        // student's existing attainments, never a second import.
                        None => {
                            apply_outcome(
                                conn,
                                row,
                                &submission_uncertain(),
                                OutcomeEvent {
                                    message: Some(
                                        "The submission was accepted without an id to verify it \
                                         by.",
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
                    let attainment = result.and_then(|result| {
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
            }
        }
    }
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

/// A frozen snapshot that cannot be sent; either would come back as a request-level rejection that
/// takes the rest of the batch with it.
enum Unsendable {
    Incomplete,
    UnknownGrade,
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
        }
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
        row.student_number.as_deref(),
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
    // The registry rejects an unknown scale or grade for the whole request, so this row leaves the
    // batch rather than failing the rows around it.
    if !is_known_grade(grade_scale_id, grade_id) {
        return Err(Unsendable::UnknownGrade);
    }
    Ok(ImportAttainmentRequestItem {
        request_item_id: request_item_id(row, RequestPurpose::Submission),
        student_number: student_number.to_string(),
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
/// never finer than a hundredth, and 2.7f32 would otherwise be sent as 2.700000047683716.
fn round_credits(credits: f32) -> f64 {
    (f64::from(credits) * 1000.0).round() / 1000.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_claim_states_cannot_reach_a_row_that_may_already_have_been_sent() {
        for state in [
            CreditRegistrationState::Submitting,
            CreditRegistrationState::SubmissionUncertain,
            CreditRegistrationState::AwaitingVerification,
            CreditRegistrationState::Registered,
            CreditRegistrationState::Cancelled,
            CreditRegistrationState::ResolvingEnrolment,
        ] {
            assert!(!CLAIMED_STATES.contains(&state), "{state:?}");
        }
    }
}
