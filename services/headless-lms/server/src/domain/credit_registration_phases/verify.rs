//! The `verify` phase: asking the study registry what became of a submission.
//!
//! The only way out of `submission_uncertain`. Nothing here fails a row: the attainment may exist,
//! and a failed row is one an admin retries, which for an uncertain submission would mean sending
//! it twice. The one way back to `import` is Suotar itself answering `notRegistered`.

use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::credit_registration_events::CreditRegistrationEventKind;
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationErrorCode, CreditRegistrationState, Transition,
    claim_due, increment_verify_attempt_counts, mark_partially_registered, reset_for_resubmission,
    schedule_next_attempts, set_resubmit_not_before, set_sisu_attainment_if_unclaimed, transition,
};
use headless_lms_models::library::credit_registration::classification::{WireOutcome, outcome_of};
use headless_lms_models::library::credit_registration::enrolment_selection::attainment_matching_submission;
use headless_lms_models::library::credit_registration::outcomes::{
    Outcome, RowFacts, uncertain_recheck_outcome, verify_error_outcome,
    verify_inconclusive_outcome, verify_not_registered_outcome, verify_partial_outcome,
    verify_poll_lease_until,
};
use headless_lms_models::library::credit_registration::submission_context::get_submission_contexts;
use headless_lms_utils::error::util_error::UtilError;
use headless_lms_utils::prelude::Utc;
use headless_lms_utils::services::suotar::{
    ATTAINMENT_TYPE_COURSE_UNIT, EnrolmentResolutionResult, ResolveEnrolmentRequestItem,
    SuotarAttainment, SuotarBatchResponse, SuotarCallContext, SuotarEndpoint, SuotarItemStatus,
    SuotarResponseItem, VerifyAttainmentRequestItem, VerifyAttainmentResult, new_request_item_id,
};
use sqlx::{Connection, PgConnection};

use super::{
    CreditRegistrationPhase, OutcomeEvent, PhaseContext, PhaseScope, Prepared, SuotarBatchPhase,
    apply_outcome, counts_as_failed, row_facts, run_suotar_batch_phase,
};

/// Both states the poller owns. Withdrawal moves a row out of both, which is what stops the polling
/// without any query having to know about withdrawal.
const CLAIMED_STATES: [CreditRegistrationState; 2] = [
    CreditRegistrationState::AwaitingVerification,
    CreditRegistrationState::SubmissionUncertain,
];

/// One claimed row and the poll it was claimed for. The attempt count travels with it because it
/// sets the backoff the answer is scheduled by.
struct Poll {
    row: CreditRegistration,
    attempt: i32,
    submitted_attainment_id: String,
}

/// A row whose submission we lost track of: nothing to poll by, so the lookup goes through
/// `resolve-enrolments` instead.
struct Recovery {
    row: CreditRegistration,
    attempt: i32,
}

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
    let attempts = increment_verify_attempt_counts(
        &mut tx,
        &claimed.iter().map(|row| row.id).collect::<Vec<_>>(),
    )
    .await?;
    // Pushed out of reach before the request leaves, so a concurrent iteration cannot poll the same
    // row. Each answer overwrites its own row's schedule.
    let now = Utc::now();
    let scheduled: Vec<_> = attempts
        .iter()
        .map(|(id, attempt)| (*id, verify_poll_lease_until(now, *attempt)))
        .collect();
    schedule_next_attempts(&mut tx, &scheduled).await?;

    let mut polls = Vec::new();
    let mut recoveries = Vec::new();
    for row in claimed {
        let Some(attempt) = attempts.get(&row.id).copied() else {
            continue;
        };
        match row.submitted_attainment_id.clone() {
            Some(submitted_attainment_id) => polls.push(Poll {
                row,
                attempt,
                submitted_attainment_id,
            }),
            None if row.state == CreditRegistrationState::SubmissionUncertain => {
                recoveries.push(Recovery { row, attempt })
            }
            None => {
                warn!(
                    "Credit registration {} is awaiting verification with no submitted attainment id.",
                    row.id
                );
            }
        }
    }
    tx.commit().await?;
    // Held only for the claim; the two flows below re-acquire around their own Suotar calls.
    drop(conn);

    let mut outcome = PhaseRunOutcome::default();
    if !polls.is_empty() {
        add(
            &mut outcome,
            run_suotar_batch_phase(&mut VerifyPoll { polls }, ctx, scope).await?,
        );
    }
    // Recoveries go out on `resolve-enrolments`, whose batch limit need not match the one these rows
    // were claimed at, and an oversized set would be refused whole before anything was sent.
    let batch_size = SuotarEndpoint::ResolveEnrolments.max_batch_size();
    while !recoveries.is_empty() {
        let rest = recoveries.split_off(batch_size.min(recoveries.len()));
        let mut flow = UncertainRecovery { recoveries };
        add(
            &mut outcome,
            run_suotar_batch_phase(&mut flow, ctx, scope).await?,
        );
        recoveries = rest;
    }
    Ok(outcome)
}

/// Sums what the two flows of one iteration did; the first error stands for the iteration.
fn add(total: &mut PhaseRunOutcome, part: PhaseRunOutcome) {
    total.items_processed += part.items_processed;
    total.items_failed += part.items_failed;
    total.error = total.error.take().or(part.error);
}

/// Polls the rows that have something to poll by.
struct VerifyPoll {
    polls: Vec<Poll>,
}

impl SuotarBatchPhase for VerifyPoll {
    type Row = Poll;
    type Item = VerifyAttainmentRequestItem;
    type Result = VerifyAttainmentResult;

    const ALL_UNAVAILABLE_ERROR: &'static str = "Every verify poll came back unavailable.";

    /// The rows are claimed by the phase itself, which splits them between this flow and the
    /// recovery one, so there is nothing left to decide here.
    async fn prepare(
        &mut self,
        _ctx: &PhaseContext<'_>,
        _conn: &mut PgConnection,
        _scope: &PhaseScope,
    ) -> anyhow::Result<Prepared<Self::Row, Self::Item>> {
        Ok(Prepared {
            sendable: std::mem::take(&mut self.polls)
                .into_iter()
                .map(|poll| {
                    let item = VerifyAttainmentRequestItem {
                        request_item_id: new_request_item_id(),
                        submitted_attainment_id: poll.submitted_attainment_id.clone(),
                    };
                    (poll, item)
                })
                .collect(),
            ..Prepared::default()
        })
    }

    fn registration(poll: &Self::Row) -> &CreditRegistration {
        &poll.row
    }

    async fn send(
        &self,
        ctx: &PhaseContext<'_>,
        rows: &[Self::Row],
        items: Vec<Self::Item>,
    ) -> Result<SuotarBatchResponse<Self::Result>, UtilError> {
        ctx.suotar_client
            .verify_attainments(
                SuotarCallContext::new(ctx.worker_name(CreditRegistrationPhase::Verify))
                    .for_registrations(rows.iter().map(|poll| poll.row.id).collect()),
                items,
            )
            .await
    }

    async fn apply(
        &self,
        conn: &mut PgConnection,
        poll: &Self::Row,
        item: Option<&SuotarResponseItem<Self::Result>>,
        event: OutcomeEvent<'_>,
    ) -> anyhow::Result<bool> {
        apply_poll_answer(conn, poll, item, event).await
    }

    /// Deliberately not the shared request-level outcome: a failure to ask proves nothing was or
    /// was not created, and moving the row towards `failed_retryable` would let an admin resubmit
    /// it. The iteration is still reported as failed, so the breaker sees it.
    async fn apply_request_rejection(
        &self,
        conn: &mut PgConnection,
        poll: &Self::Row,
        request: &serde_json::Value,
        request_item_id: &str,
        error: &UtilError,
    ) -> anyhow::Result<bool> {
        apply_outcome(
            conn,
            &poll.row,
            &verify_inconclusive_outcome(poll.row.state, &poll.facts()),
            OutcomeEvent {
                message: Some("Could not verify this submission this time."),
                error_message: Some(error.message()),
                request_item_id: Some(request_item_id),
                request: Some(request),
                ..OutcomeEvent::default()
            },
            Some(poll.row.state),
        )
        .await?;
        Ok(false)
    }
}

impl Poll {
    /// The count this poll was made under, not the one the row was claimed with, so the backoff
    /// doubles once per poll.
    fn facts(&self) -> RowFacts {
        RowFacts {
            verify_attempt_count: self.attempt,
            ..row_facts(&self.row)
        }
    }
}

/// Applies one poll's answer. Only a course unit attainment registers the row, and only
/// `notRegistered` sends it back towards import; anything else keeps it polling.
async fn apply_poll_answer(
    conn: &mut PgConnection,
    poll: &Poll,
    item: Option<&SuotarResponseItem<VerifyAttainmentResult>>,
    event: OutcomeEvent<'_>,
) -> anyhow::Result<bool> {
    let row = &poll.row;
    let facts = poll.facts();
    let Some(item) = item else {
        return apply_poll_outcome(
            conn,
            row,
            &verify_inconclusive_outcome(row.state, &facts),
            event,
        )
        .await;
    };
    let event = OutcomeEvent {
        error_message: item.error.as_ref().map(|error| error.message.as_str()),
        ..event
    };
    let result = item.result.as_ref();
    match outcome_of(SuotarEndpoint::VerifyAttainments, &item.code) {
        WireOutcome::Settled(CreditRegistrationState::Registered)
            if item.status == SuotarItemStatus::Ok =>
        {
            match result.and_then(|result| result.attainment.as_ref()) {
                Some(attainment) if attainment.attainment_type == ATTAINMENT_TYPE_COURSE_UNIT => {
                    apply_registered(conn, row, attainment, event).await
                }
                // The assessment item attainment's id can equal the submitted one, and verify
                // records only the final course unit attainment.
                _ => {
                    let partially_registered_at = mark_partially_registered(conn, row.id).await?;
                    apply_poll_outcome(
                        conn,
                        row,
                        &verify_partial_outcome(&facts, partially_registered_at),
                        event,
                    )
                    .await
                }
            }
        }
        // `submissionPending`: polled on as usual, since the attainment usually shows up long
        // before `retryAfter`, which only bounds when a resubmission becomes safe.
        WireOutcome::Unsettled => {
            if let Some(retry_after) = result.and_then(|result| result.retry_after) {
                set_resubmit_not_before(conn, row.id, retry_after).await?;
            }
            apply_poll_outcome(
                conn,
                row,
                &verify_inconclusive_outcome(row.state, &facts),
                event,
            )
            .await
        }
        WireOutcome::Failure(CreditRegistrationErrorCode::NotRegistered) => {
            let mut tx = conn.begin().await?;
            let reimport_count = reset_for_resubmission(&mut tx, row.id).await?;
            let outcome = verify_not_registered_outcome(&facts, reimport_count);
            let event = OutcomeEvent {
                message: Some("Sisu has no trace of the submission, so it will be sent again."),
                ..event
            };
            apply_outcome(&mut tx, row, &outcome, event, Some(row.state)).await?;
            tx.commit().await?;
            Ok(counts_as_failed(&outcome))
        }
        WireOutcome::Failure(code) => {
            apply_poll_outcome(
                conn,
                row,
                &verify_error_outcome(row.state, code, &facts),
                event,
            )
            .await
        }
        WireOutcome::Settled(_) => {
            apply_poll_outcome(
                conn,
                row,
                &verify_inconclusive_outcome(row.state, &facts),
                event,
            )
            .await
        }
    }
}

async fn apply_registered(
    conn: &mut PgConnection,
    row: &CreditRegistration,
    attainment: &SuotarAttainment,
    event: OutcomeEvent<'_>,
) -> anyhow::Result<bool> {
    set_sisu_attainment_if_unclaimed(
        conn,
        row.id,
        &attainment.id,
        Some(&attainment.attainment_type),
    )
    .await?;
    apply_outcome(
        conn,
        row,
        &Outcome {
            // Confirmed, so whatever an operator was asked to look at is settled.
            needs_admin_attention: Some(false),
            ..Outcome::to(CreditRegistrationState::Registered)
        },
        event,
        Some(row.state),
    )
    .await?;
    Ok(false)
}

async fn apply_poll_outcome(
    conn: &mut PgConnection,
    row: &CreditRegistration,
    outcome: &Outcome,
    event: OutcomeEvent<'_>,
) -> anyhow::Result<bool> {
    apply_outcome(conn, row, outcome, event, Some(row.state)).await?;
    Ok(counts_as_failed(outcome))
}

/// Looks for the attainment a submission we lost track of would have produced. The row stays
/// `submission_uncertain` unless it is found: never failed, never re-imported.
struct UncertainRecovery {
    recoveries: Vec<Recovery>,
}

impl SuotarBatchPhase for UncertainRecovery {
    type Row = Recovery;
    type Item = ResolveEnrolmentRequestItem;
    type Result = EnrolmentResolutionResult;

    const ALL_UNAVAILABLE_ERROR: &'static str = "Every recovery lookup came back unavailable.";

    /// A row with nothing to ask about is left where it is: it is uncertain, which no answer of
    /// ours may turn into a failure, and it is already scheduled for the next check.
    async fn prepare(
        &mut self,
        _ctx: &PhaseContext<'_>,
        conn: &mut PgConnection,
        _scope: &PhaseScope,
    ) -> anyhow::Result<Prepared<Self::Row, Self::Item>> {
        let recoveries = std::mem::take(&mut self.recoveries);
        let contexts = get_submission_contexts(
            conn,
            &recoveries
                .iter()
                .map(|recovery| recovery.row.id)
                .collect::<Vec<_>>(),
        )
        .await?;
        let mut prepared = Prepared::default();
        for recovery in recoveries {
            let Some(context) = contexts.get(&recovery.row.id) else {
                continue;
            };
            let (Some(student_number), Some(course_code)) = (
                recovery
                    .row
                    .student_number
                    .clone()
                    .or_else(|| context.student_number.clone()),
                recovery
                    .row
                    .uh_course_code
                    .clone()
                    .or_else(|| context.uh_course_code.clone()),
            ) else {
                continue;
            };
            let item = ResolveEnrolmentRequestItem {
                request_item_id: new_request_item_id(),
                student_number: student_number.into(),
                course_code,
            };
            prepared.sendable.push((recovery, item));
        }
        Ok(prepared)
    }

    fn registration(recovery: &Self::Row) -> &CreditRegistration {
        &recovery.row
    }

    async fn send(
        &self,
        ctx: &PhaseContext<'_>,
        rows: &[Self::Row],
        items: Vec<Self::Item>,
    ) -> Result<SuotarBatchResponse<Self::Result>, UtilError> {
        ctx.suotar_client
            .resolve_enrolments(
                SuotarCallContext::new(ctx.worker_name(CreditRegistrationPhase::Verify))
                    .for_registrations(rows.iter().map(|recovery| recovery.row.id).collect()),
                items,
            )
            .await
    }

    async fn apply(
        &self,
        conn: &mut PgConnection,
        recovery: &Self::Row,
        item: Option<&SuotarResponseItem<Self::Result>>,
        event: OutcomeEvent<'_>,
    ) -> anyhow::Result<bool> {
        apply_recovery_answer(conn, recovery, item, event).await
    }

    /// Not the shared request-level outcome either: these rows must stay uncertain whatever the
    /// call did.
    async fn apply_request_rejection(
        &self,
        conn: &mut PgConnection,
        recovery: &Self::Row,
        request: &serde_json::Value,
        request_item_id: &str,
        error: &UtilError,
    ) -> anyhow::Result<bool> {
        apply_outcome(
            conn,
            &recovery.row,
            &uncertain_recheck_outcome(&recovery.facts()),
            OutcomeEvent {
                message: Some("Could not check Sisu for the credits this time."),
                error_message: Some(error.message()),
                request_item_id: Some(request_item_id),
                request: Some(request),
                ..OutcomeEvent::default()
            },
            Some(recovery.row.state),
        )
        .await?;
        Ok(false)
    }
}

impl Recovery {
    /// The count this lookup was made under, so the recheck cadence advances once per lookup.
    fn facts(&self) -> RowFacts {
        RowFacts {
            verify_attempt_count: self.attempt,
            ..row_facts(&self.row)
        }
    }
}

async fn apply_recovery_answer(
    conn: &mut PgConnection,
    recovery: &Recovery,
    item: Option<&SuotarResponseItem<EnrolmentResolutionResult>>,
    event: OutcomeEvent<'_>,
) -> anyhow::Result<bool> {
    let row = &recovery.row;
    // An enrolment error still lists the attainments, and the enrolment may be gone by now.
    let found = item
        .and_then(|item| item.result.as_ref())
        .zip(row.attainment_date)
        .and_then(|(result, attainment_date)| {
            attainment_matching_submission(
                &result.existing_attainments,
                attainment_date,
                row.submitted_at,
                row.grade_scale_id.as_deref().unwrap_or_default(),
                row.grade_id.as_deref().unwrap_or_default(),
            )
        });
    let Some(attainment) = found else {
        apply_outcome(
            conn,
            row,
            &uncertain_recheck_outcome(&recovery.facts()),
            OutcomeEvent {
                message: Some(
                    "No matching attainment yet, so whether the submission landed is still unknown.",
                ),
                ..event
            },
            Some(row.state),
        )
        .await?;
        // A row still waiting to be resolved is not a failed item; the recheck raises the admin
        // flag once it has waited long enough instead.
        return Ok(false);
    };
    set_sisu_attainment_if_unclaimed(
        conn,
        row.id,
        &attainment.id,
        Some(&attainment.attainment_type),
    )
    .await?;
    transition(
        conn,
        row.id,
        &Transition {
            event_kind: CreditRegistrationEventKind::SuotarResponse,
            event_message: Some(
                "The credits this submission would have created are in Sisu, so it was \
                 registered after all."
                    .to_string(),
            ),
            needs_admin_attention: Some(false),
            suotar_api_call_id: event.suotar_api_call_id,
            request_item_id: event.request_item_id.map(str::to_string),
            event_details: Some(
                headless_lms_models::credit_registration_events::suotar_exchange_details(
                    event.request,
                    event.response,
                ),
            ),
            expected_from_state: Some(row.state),
            ..Transition::to(CreditRegistrationState::Duplicate)
        },
    )
    .await?;
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The poller claims only the states a submission may still be in, never one import sends from.
    #[test]
    fn the_poller_owns_exactly_the_two_states_a_submission_can_still_be_in() {
        assert!(CLAIMED_STATES.contains(&CreditRegistrationState::AwaitingVerification));
        assert!(CLAIMED_STATES.contains(&CreditRegistrationState::SubmissionUncertain));
        assert!(!CLAIMED_STATES.contains(&CreditRegistrationState::Submitting));
        assert!(!CLAIMED_STATES.contains(&CreditRegistrationState::Cancelled));
    }
}
