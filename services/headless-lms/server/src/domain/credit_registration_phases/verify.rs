//! The `verify` phase: asking the study registry what became of a submission.
//!
//! The only way out of `submission_uncertain`, and never a way back to `import`. A row with an id
//! is polled; a row without one is looked for among the student's existing attainments, which is
//! the recovery for a submission whose answer never arrived.
//!
//! Nothing here ever fails a row: the attainment may exist, and a failed row is one an admin
//! retries, which for an uncertain submission would mean sending it twice.

use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::credit_registration_events::CreditRegistrationEventKind;
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationState, Transition, claim_due,
    increment_verify_attempt_count, map_code, schedule_next_attempt,
    set_sisu_attainment_if_unclaimed, transition, verify_request_item_id,
};
use headless_lms_models::library::credit_registration::classification::{
    next_attempt_at, verify_backoff_secs,
};
use headless_lms_models::library::credit_registration::enrolment_selection::attainment_matching_submission;
use headless_lms_models::library::credit_registration::outcomes::{
    Outcome, RowFacts, uncertain_recheck_outcome, verify_error_outcome,
    verify_not_registered_outcome,
};
use headless_lms_models::library::credit_registration::submission_context::get_submission_contexts;
use headless_lms_models::suotar_api_calls::SuotarEndpoint as AuditEndpoint;
use headless_lms_utils::error::util_error::UtilError;
use headless_lms_utils::prelude::Utc;
use headless_lms_utils::services::suotar::{
    ResolveEnrolmentRequestItem, SuotarCallContext, SuotarEndpoint, SuotarItemStatus,
    VerifyAttainmentRequestItem,
};
use sqlx::Connection;

use super::{
    CreditRegistrationPhase, OutcomeEvent, PhaseContext, PhaseScope, apply_outcome,
    counts_as_failed, every_item_failed_transiently, response_item_json, row_facts,
};

/// The one code that means the submission became an attainment.
const REGISTERED_CODE: &str = "registered";

/// Both states the poller owns. Withdrawal moves a row out of both, which is what stops the polling
/// without any query having to remember withdrawal.
const CLAIMED_STATES: [CreditRegistrationState; 2] = [
    CreditRegistrationState::AwaitingVerification,
    CreditRegistrationState::SubmissionUncertain,
];

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let claimed = claim_due(
        &mut tx,
        &CLAIMED_STATES,
        scope,
        SuotarEndpoint::VerifyAttainments.max_batch_size() as i64,
    )
    .await?;
    let mut polls = Vec::new();
    let mut recoveries = Vec::new();
    for row in claimed {
        // Counted before the call, because the count is part of the request item id: two polls of
        // one row are distinguishable in the registry's log.
        let attempt = increment_verify_attempt_count(&mut tx, row.id).await?;
        // Pushed out of reach before the request leaves, so a concurrent iteration cannot poll the
        // same row. The outcome overwrites this.
        schedule_next_attempt(
            &mut tx,
            row.id,
            next_attempt_at(Utc::now(), verify_backoff_secs(attempt)),
        )
        .await?;
        match row.submitted_attainment_id.clone() {
            Some(submitted_attainment_id) => polls.push((row, attempt, submitted_attainment_id)),
            None if row.state == CreditRegistrationState::SubmissionUncertain => {
                recoveries.push((row, attempt))
            }
            None => {
                // Nothing to poll and nothing to recover from. Left alone rather than guessed at.
                warn!(
                    "Credit registration {} is awaiting verification with no submitted attainment id.",
                    row.id
                );
            }
        }
    }
    tx.commit().await?;
    // Held only for the claim; `poll` and `recover` re-acquire around their own Suotar calls.
    drop(conn);

    let mut processed = 0;
    let mut items_failed = 0;
    let mut error = None;

    if !polls.is_empty() {
        let outcome = poll(ctx, &polls).await?;
        processed += outcome.items_processed;
        items_failed += outcome.items_failed;
        error = error.or(outcome.error);
    }
    // Claimed at `VerifyAttainments`'s batch size (100), but a recovery is sent on
    // `resolve-enrolments`, whose limit is 50: chunked so a recovery set over that limit is not
    // refused whole by `check_batch` before anything is sent.
    for chunk in recoveries.chunks(SuotarEndpoint::ResolveEnrolments.max_batch_size()) {
        let outcome = recover(ctx, chunk).await?;
        processed += outcome.items_processed;
        items_failed += outcome.items_failed;
        error = error.or(outcome.error);
    }
    Ok(PhaseRunOutcome {
        items_processed: processed,
        items_failed,
        error,
    })
}

/// Polls the rows that have something to poll by.
async fn poll(
    ctx: &PhaseContext<'_>,
    polls: &[(CreditRegistration, i32, String)],
) -> anyhow::Result<PhaseRunOutcome> {
    let items: Vec<VerifyAttainmentRequestItem> = polls
        .iter()
        .map(
            |(row, attempt, submitted_attainment_id)| VerifyAttainmentRequestItem {
                request_item_id: verify_request_item_id(row.id, *attempt),
                submitted_attainment_id: submitted_attainment_id.clone(),
            },
        )
        .collect();
    let requests: Vec<serde_json::Value> = items
        .iter()
        .map(|item| serde_json::to_value(item).unwrap_or_default())
        .collect();
    let response = ctx
        .suotar_client
        .verify_attainments(
            SuotarCallContext::new(ctx.worker_name(CreditRegistrationPhase::Verify))
                .for_registrations(polls.iter().map(|(row, _, _)| row.id).collect()),
            items,
        )
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => return poll_request_failure(ctx, polls, &requests, &error).await,
    };

    let mut conn = ctx.pool.acquire().await?;
    let mut items_failed = 0;
    for ((row, attempt, _), request) in polls.iter().zip(requests.iter()) {
        let request_item_id = verify_request_item_id(row.id, *attempt);
        let response_json = response_item_json(&response.raw_response, &request_item_id);
        let event = OutcomeEvent {
            suotar_api_call_id: response.call_id,
            request: Some(request),
            response: response_json.as_ref(),
            ..OutcomeEvent::default()
        };
        // The count this poll was made under, not the one the row was claimed with, so the backoff
        // doubles once per poll.
        let facts = RowFacts {
            verify_attempt_count: *attempt,
            ..row_facts(row)
        };
        let item = response.item(&request_item_id);
        let registered = item.is_some_and(|item| {
            item.status == SuotarItemStatus::Ok && item.code == REGISTERED_CODE
        });
        if registered {
            if let Some(result) = item.and_then(|item| item.result.as_ref()) {
                set_sisu_attainment_if_unclaimed(
                    &mut conn,
                    row.id,
                    &result.attainment.id,
                    Some(&result.attainment.attainment_type),
                )
                .await?;
            }
            apply_outcome(
                &mut conn,
                row,
                &Outcome {
                    to_state: CreditRegistrationState::Registered,
                    error_code: None,
                    // Confirmed, so whatever an operator was asked to look at is settled.
                    needs_admin_attention: Some(false),
                    delay_secs: None,
                    drop_verified_student_number: false,
                    increment_submit_retry_count: false,
                },
                event,
            )
            .await?;
            continue;
        }
        // Everything else keeps the row where it is: `notRegistered` is a normal polling answer and
        // maps to no error code of ours, and any other answer is one we will not act on blindly.
        let outcome = item
            .and_then(|item| map_code(AuditEndpoint::VerifyAttainments, &item.code))
            .map(|code| verify_error_outcome(row.state, code, &facts))
            .unwrap_or_else(|| verify_not_registered_outcome(row.state, &facts));
        apply_outcome(
            &mut conn,
            row,
            &outcome,
            OutcomeEvent {
                error_message: item
                    .and_then(|item| item.error.as_ref())
                    .map(|error| error.message.as_str()),
                ..event
            },
        )
        .await?;
        if counts_as_failed(&outcome) {
            items_failed += 1;
        }
    }
    Ok(PhaseRunOutcome {
        items_processed: i32::try_from(polls.len()).unwrap_or(i32::MAX),
        items_failed,
        error: every_item_failed_transiently(&response)
            .then(|| "Every verify poll came back transiently unavailable.".to_string()),
    })
}

/// A request-level failure of the poll itself (transport, a 5xx, a malformed response, ...).
///
/// Deliberately not the shared `request_level_failure`: every row here already holds a submitted
/// attainment id, so a failure to ask about it proves nothing was or was not created. Each row is
/// left exactly where it was claimed — the same outcome an unanswered item gets — rather than moved
/// towards `failed_retryable`, which is a state an admin resubmits from and would send it twice.
/// Still reported as an error so the breaker sees it.
async fn poll_request_failure(
    ctx: &PhaseContext<'_>,
    polls: &[(CreditRegistration, i32, String)],
    requests: &[serde_json::Value],
    error: &UtilError,
) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    for ((row, attempt, _), request) in polls.iter().zip(requests.iter()) {
        let facts = RowFacts {
            verify_attempt_count: *attempt,
            ..row_facts(row)
        };
        apply_outcome(
            &mut conn,
            row,
            &verify_not_registered_outcome(row.state, &facts),
            OutcomeEvent {
                message: Some("Could not verify this submission this time."),
                error_message: Some(error.message()),
                request: Some(request),
                ..OutcomeEvent::default()
            },
        )
        .await?;
    }
    Ok(PhaseRunOutcome {
        items_processed: i32::try_from(polls.len()).unwrap_or(i32::MAX),
        items_failed: 0,
        error: Some(error.message().to_string()),
    })
}

/// Looks for the attainment a submission we lost track of would have produced.
///
/// Diagnostic only: whatever comes back, the row stays `submission_uncertain` unless the attainment
/// is found. It is never failed and never re-imported.
async fn recover(
    ctx: &PhaseContext<'_>,
    rows: &[(CreditRegistration, i32)],
) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let contexts = get_submission_contexts(
        &mut conn,
        &rows.iter().map(|(row, _)| row.id).collect::<Vec<_>>(),
    )
    .await?;
    let mut items = Vec::new();
    let mut asked = Vec::new();
    for (row, attempt) in rows {
        let Some(context) = contexts.get(&row.id) else {
            continue;
        };
        let (Some(student_number), Some(course_code)) = (
            row.student_number
                .clone()
                .or_else(|| context.student_number.clone()),
            row.uh_course_code
                .clone()
                .or_else(|| context.uh_course_code.clone()),
        ) else {
            continue;
        };
        items.push(ResolveEnrolmentRequestItem {
            request_item_id: row.request_item_id.clone(),
            student_number,
            course_code,
        });
        asked.push((row.clone(), *attempt));
    }
    // Held only for `get_submission_contexts` above; the Suotar call below can take up to the
    // request timeout.
    drop(conn);
    if items.is_empty() {
        return Ok(PhaseRunOutcome::default());
    }

    let requests: Vec<serde_json::Value> = items
        .iter()
        .map(|item| serde_json::to_value(item).unwrap_or_default())
        .collect();
    let response = ctx
        .suotar_client
        .resolve_enrolments(
            SuotarCallContext::new(ctx.worker_name(CreditRegistrationPhase::Verify))
                .for_registrations(asked.iter().map(|(row, _)| row.id).collect()),
            items,
        )
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => {
            // Not `request_level_failure`: these rows must stay uncertain whatever the call did.
            let mut conn = ctx.pool.acquire().await?;
            for ((row, attempt), request) in asked.iter().zip(requests.iter()) {
                let facts = RowFacts {
                    verify_attempt_count: *attempt,
                    ..row_facts(row)
                };
                apply_outcome(
                    &mut conn,
                    row,
                    &uncertain_recheck_outcome(&facts),
                    OutcomeEvent {
                        message: Some("Could not look for the attainment this time."),
                        error_message: Some(error.message()),
                        request: Some(request),
                        ..OutcomeEvent::default()
                    },
                )
                .await?;
            }
            return Ok(PhaseRunOutcome {
                items_processed: i32::try_from(asked.len()).unwrap_or(i32::MAX),
                items_failed: i32::try_from(asked.len()).unwrap_or(i32::MAX),
                error: Some(error.message().to_string()),
            });
        }
    };

    let mut conn = ctx.pool.acquire().await?;
    for ((row, attempt), request) in asked.iter().zip(requests.iter()) {
        let response_json = response_item_json(&response.raw_response, &row.request_item_id);
        let event = OutcomeEvent {
            suotar_api_call_id: response.call_id,
            request: Some(request),
            response: response_json.as_ref(),
            ..OutcomeEvent::default()
        };
        let found = match response.item(&row.request_item_id) {
            Some(item) if item.status == SuotarItemStatus::Ok => {
                item.result.as_ref().zip(row.attainment_date).and_then(
                    |(result, attainment_date)| {
                        attainment_matching_submission(
                            &result.existing_attainments,
                            attainment_date,
                            row.grade_scale_id.as_deref().unwrap_or_default(),
                            row.grade_id.as_deref().unwrap_or_default(),
                        )
                    },
                )
            }
            _ => None,
        };
        match found {
            Some(attainment) => {
                set_sisu_attainment_if_unclaimed(
                    &mut conn,
                    row.id,
                    &attainment.id,
                    Some(&attainment.attainment_type),
                )
                .await?;
                transition(
                    &mut conn,
                    row.id,
                    &Transition {
                        event_kind: CreditRegistrationEventKind::SuotarResponse,
                        event_message: Some(
                            "The attainment this submission would have created is in the study \
                             registry, so it landed after all."
                                .to_string(),
                        ),
                        needs_admin_attention: Some(false),
                        suotar_api_call_id: event.suotar_api_call_id,
                        event_details: Some(
                            headless_lms_models::credit_registration_events::suotar_exchange_details(
                                event.request,
                                event.response,
                            ),
                        ),
                        ..Transition::to(CreditRegistrationState::Duplicate)
                    },
                )
                .await?;
            }
            None => {
                let facts = RowFacts {
                    verify_attempt_count: *attempt,
                    ..row_facts(row)
                };
                apply_outcome(
                    &mut conn,
                    row,
                    &uncertain_recheck_outcome(&facts),
                    OutcomeEvent {
                        message: Some(
                            "No matching attainment yet, so whether the submission landed is still \
                             unknown.",
                        ),
                        ..event
                    },
                )
                .await?;
            }
        }
    }
    Ok(PhaseRunOutcome {
        items_processed: i32::try_from(asked.len()).unwrap_or(i32::MAX),
        // A row still waiting to be resolved is not a failed item: it carries no error code, and the
        // signal that it needs a human is the admin flag the recheck raises after enough tries.
        items_failed: 0,
        error: every_item_failed_transiently(&response)
            .then(|| "Every recovery lookup came back transiently unavailable.".to_string()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Nothing this phase claims can lead back to a batch, and it claims the only two states from
    /// which a submitted row is still moving.
    #[test]
    fn the_poller_owns_exactly_the_two_states_a_submission_can_still_be_in() {
        assert!(CLAIMED_STATES.contains(&CreditRegistrationState::AwaitingVerification));
        assert!(CLAIMED_STATES.contains(&CreditRegistrationState::SubmissionUncertain));
        assert!(!CLAIMED_STATES.contains(&CreditRegistrationState::Submitting));
        assert!(
            !CLAIMED_STATES.contains(&CreditRegistrationState::AbandonedByConsentWithdrawal),
            "withdrawal has to stop the polling"
        );
    }

    /// A registry log line has to name one poll, not one row.
    #[test]
    fn two_polls_of_one_row_are_addressed_apart() {
        let id = uuid::Uuid::new_v4();
        assert_eq!(verify_request_item_id(id, 1), format!("vf-{id}-1"));
        assert_ne!(verify_request_item_id(id, 1), verify_request_item_id(id, 2));
    }
}
