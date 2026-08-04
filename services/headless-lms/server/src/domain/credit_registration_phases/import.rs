//! The `import` phase: the one call that creates something in the study registry.
//!
//! A row is committed as `submitting` before the request leaves, and no path leads from that state
//! or `submission_uncertain` back into a batch: a second import for one row would put a second
//! attainment on a real transcript, and we could neither see it nor undo it.

use headless_lms_models::course_module_completion_registered_to_study_registries::completion_ids_registered_by_other_registrars;
use headless_lms_models::credit_registration_events::CreditRegistrationEventKind;
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationErrorCode, CreditRegistrationState, Transition,
    claim_due, map_code, set_sisu_attainment_if_unclaimed, set_submitted_attainment, transition,
};
use headless_lms_models::library::credit_registration::classification::VERIFY_FIRST_DELAY_SECS;
use headless_lms_models::library::credit_registration::grade_mapping::is_known_grade;
use headless_lms_models::library::credit_registration::legacy_mirror::SUOTAR_PUSH_REGISTRAR_ID;
use headless_lms_models::library::credit_registration::outcomes::{
    Outcome, import_success_state, submission_uncertain, submit_error_outcome,
    unanswered_item_outcome,
};
use headless_lms_models::suotar_api_calls::SuotarEndpoint as AuditEndpoint;
use headless_lms_utils::services::suotar::{
    ImportAttainmentRequestItem, SuotarAttainment, SuotarCallContext, SuotarEndpoint,
    SuotarItemStatus,
};
use sqlx::{Connection, PgConnection};

use super::{
    CreditRegistrationPhase, OutcomeEvent, PhaseContext, PhaseScope, apply_outcome,
    every_item_failed_transiently, request_level_failure, response_item_json, row_facts,
};

/// The only state this phase claims; the absence of `submitting` and `submission_uncertain` is what
/// makes a second import for one row unreachable.
const CLAIMED_STATES: [CreditRegistrationState; 1] = [CreditRegistrationState::CheckingEnrolment];

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let endpoint = SuotarEndpoint::ImportAttainments;
    let mut conn = ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let claimed = claim_due(
        &mut tx,
        &CLAIMED_STATES,
        scope,
        endpoint.max_batch_size() as i64,
    )
    .await?;
    // Every registrar but ours: a grade improvement is deliberately a second submission for the
    // same completion.
    let already_registered = completion_ids_registered_by_other_registrars(
        &mut tx,
        &claimed
            .iter()
            .map(|row| row.course_module_completion_id)
            .collect::<Vec<_>>(),
        SUOTAR_PUSH_REGISTRAR_ID,
    )
    .await?;

    let claimed_count = i32::try_from(claimed.len()).unwrap_or(i32::MAX);
    let mut items = Vec::new();
    let mut rows = Vec::new();
    let mut items_failed = 0;
    for row in claimed {
        if already_registered.contains(&row.course_module_completion_id) {
            transition(
                &mut tx,
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
            continue;
        }
        match request_item(&row) {
            Ok(item) => {
                // Committed before the request leaves: a row found in `submitting` after a restart
                // has an unknown outcome and is never sent again.
                transition(
                    &mut tx,
                    row.id,
                    &Transition::to(CreditRegistrationState::Submitting),
                )
                .await?;
                items.push(item);
                rows.push(row);
            }
            Err(problem) => {
                transition(&mut tx, row.id, &problem.transition()).await?;
                items_failed += 1;
            }
        }
    }
    tx.commit().await?;
    // Held only for the claim; the Suotar call below can pin it for the whole request timeout.
    drop(conn);

    if items.is_empty() {
        return Ok(PhaseRunOutcome {
            items_processed: claimed_count,
            items_failed,
            error: None,
        });
    }

    let requests: Vec<serde_json::Value> = items
        .iter()
        .map(|item| serde_json::to_value(item).unwrap_or_default())
        .collect();
    let response = ctx
        .suotar_client
        .import_attainments(
            SuotarCallContext::new(ctx.worker_name(CreditRegistrationPhase::Import))
                .for_registrations(rows.iter().map(|row| row.id).collect()),
            items,
        )
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => {
            return request_level_failure(
                ctx,
                AuditEndpoint::ImportAttainments,
                &error,
                &rows,
                &requests,
            )
            .await;
        }
    };

    let mut conn = ctx.pool.acquire().await?;
    for (row, request) in rows.iter().zip(requests.iter()) {
        let response_json = response_item_json(&response.raw_response, &row.request_item_id);
        let event = OutcomeEvent {
            suotar_api_call_id: response.call_id,
            request: Some(request),
            response: response_json.as_ref(),
            sent_student_number: row.student_number.as_deref(),
            ..OutcomeEvent::default()
        };
        let facts = row_facts(row);
        let item = response.item(&row.request_item_id);
        let failed = match item {
            // Sent and unanswered: verified from here, never re-sent.
            None => {
                apply_outcome(
                    &mut conn,
                    row,
                    &unanswered_item_outcome(AuditEndpoint::ImportAttainments, row.state, &facts),
                    OutcomeEvent {
                        message: Some(
                            "The study registry did not answer for this item, so whether the \
                             attainment was created is unknown.",
                        ),
                        ..event
                    },
                )
                .await?;
                true
            }
            Some(item) if item.status == SuotarItemStatus::Error => {
                let code = map_code(AuditEndpoint::ImportAttainments, &item.code)
                    .unwrap_or(CreditRegistrationErrorCode::Unknown);
                let outcome = submit_error_outcome(AuditEndpoint::ImportAttainments, code, &facts);
                if outcome.to_state == CreditRegistrationState::SubmissionUncertain
                    && let Some(disclosed) = item
                        .error
                        .as_ref()
                        .and_then(|error| error.submitted_attainment_id.as_deref())
                {
                    // A disclosed id turns the recovery into plain verification instead of a hunt
                    // through the student's existing attainments.
                    set_submitted_attainment(&mut conn, row.id, disclosed, None).await?;
                }
                apply_outcome(
                    &mut conn,
                    row,
                    &outcome,
                    OutcomeEvent {
                        error_message: item.error.as_ref().map(|error| error.message.as_str()),
                        ..event
                    },
                )
                .await?;
                true
            }
            Some(item) => {
                let result = item.result.as_ref();
                match import_success_state(&item.code) {
                    // A success code we do not know cannot be read as "nothing was created".
                    None => {
                        apply_outcome(
                            &mut conn,
                            row,
                            &submission_uncertain(),
                            OutcomeEvent {
                                message: Some(
                                    "The study registry answered with a success code we do not \
                                     know, so whether the attainment was created is unknown.",
                                ),
                                ..event
                            },
                        )
                        .await?;
                        true
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
                                set_submitted_attainment(&mut conn, row.id, id, attainment_type)
                                    .await?;
                                apply_outcome(
                                    &mut conn,
                                    row,
                                    &Outcome {
                                        delay_secs: Some(VERIFY_FIRST_DELAY_SECS),
                                        ..Outcome::to(CreditRegistrationState::AwaitingVerification)
                                    },
                                    event,
                                )
                                .await?;
                                false
                            }
                            // Accepted with nothing to verify by; recovery is a lookup among the
                            // student's existing attainments, never a second import.
                            None => {
                                apply_outcome(
                                    &mut conn,
                                    row,
                                    &submission_uncertain(),
                                    OutcomeEvent {
                                        message: Some(
                                            "The submission was accepted without an id to verify \
                                             it by.",
                                        ),
                                        ..event
                                    },
                                )
                                .await?;
                                true
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
                        record_attainment(&mut conn, row, attainment).await?;
                        apply_outcome(
                            &mut conn,
                            row,
                            &Outcome::to(state),
                            OutcomeEvent {
                                message: settled_message(state),
                                ..event
                            },
                        )
                        .await?;
                        false
                    }
                }
            }
        };
        if failed {
            items_failed += 1;
        }
    }

    Ok(PhaseRunOutcome {
        items_processed: claimed_count,
        items_failed,
        error: every_item_failed_transiently(&response)
            .then(|| "Every item of the batch came back transiently unavailable.".to_string()),
    })
}

fn settled_message(state: CreditRegistrationState) -> Option<&'static str> {
    match state {
        CreditRegistrationState::Duplicate => {
            Some("The study registry already held a matching attainment.")
        }
        CreditRegistrationState::NotImproved => {
            Some("The study registry already holds an equal or better attainment.")
        }
        _ => None,
    }
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
        request_item_id: row.request_item_id.clone(),
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
            CreditRegistrationState::AbandonedByConsentWithdrawal,
        ] {
            assert!(!CLAIMED_STATES.contains(&state), "{state:?}");
        }
    }
}
