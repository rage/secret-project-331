//! The `verify` phase: asking the study registry what became of a submission.
//!
//! The only way out of `submission_uncertain`. Nothing here fails a row: the attainment may exist,
//! and a failed row is one an admin retries, which for an uncertain submission would mean sending
//! it twice. The one way back to `import` is Suotar itself answering `notRegistered`.

use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationErrorCode, CreditRegistrationState, claim_due,
    increment_verify_attempt_counts, mark_partially_registered, reset_for_resubmission,
    schedule_next_attempts,
};
use headless_lms_models::library::credit_registration::classification::{WireOutcome, outcome_of};
use headless_lms_models::library::credit_registration::enrolment_selection::attainment_matching_submission;
use headless_lms_models::library::credit_registration::outcomes::{
    Outcome, RowFacts, uncertain_recheck_outcome, verify_error_outcome,
    verify_inconclusive_outcome, verify_not_registered_outcome, verify_partial_outcome,
    verify_poll_lease_until,
};
use headless_lms_models::library::credit_registration::submission_context::get_submission_contexts;
use headless_lms_utils::prelude::Utc;
use headless_lms_utils::services::suotar::{
    ATTAINMENT_TYPE_COURSE_UNIT, EnrolmentResolutionResult, ResolveEnrolmentRequestItem,
    SuotarEndpoint, SuotarItemStatus, SuotarResponseItem, VerifyAttainmentRequestItem,
    VerifyAttainmentResult, endpoints, new_request_item_id,
};
use sqlx::{Connection, PgConnection};

use crate::apply::{Applied, Decision, Effects, OutcomeEvent, apply_decision};
use crate::batch_phase::{Prepared, Refusal, SuotarBatchPhase, run_suotar_batch_phase};
use crate::dispatch::{Counts, Iteration};
use crate::error::CreditRegistrationResult;

const ENDPOINT: SuotarEndpoint = SuotarEndpoint::VerifyAttainments;

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

pub(crate) async fn run(it: &mut Iteration<'_>) -> CreditRegistrationResult<Counts> {
    let (polls, mut recoveries) = claim_polls(
        it,
        it.registry.allowance(SuotarEndpoint::VerifyAttainments),
        it.registry.allowance(SuotarEndpoint::ResolveEnrolments),
    )
    .await?;

    let mut counts = Counts::default();
    if !polls.is_empty() {
        counts += run_suotar_batch_phase(&mut VerifyPoll { polls }, it).await?;
    }
    // Recoveries go out on `resolve-enrolments`, whose batch limit need not match the one these rows
    // were claimed at, and an oversized set would be refused whole before anything was sent.
    let batch_size = SuotarEndpoint::ResolveEnrolments.max_batch_size();
    while !recoveries.is_empty() {
        let rest = recoveries.split_off(batch_size.min(recoveries.len()));
        counts += run_suotar_batch_phase(&mut UncertainRecovery { recoveries }, it).await?;
        recoveries = rest;
    }
    Ok(counts)
}

/// Claims up to `poll_limit` due rows and splits them into polls and recoveries, keeping at most
/// `recovery_limit` of the recoveries. Only the rows kept, and the stuck ones, count an attempt and
/// are leased: the rest are left due, rather than counted as polled without having been asked.
async fn claim_polls(
    it: &Iteration<'_>,
    poll_limit: usize,
    recovery_limit: usize,
) -> CreditRegistrationResult<(Vec<Poll>, Vec<Recovery>)> {
    if poll_limit == 0 {
        return Ok((Vec::new(), Vec::new()));
    }
    let mut conn = it.ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let claimed = claim_due(&mut tx, &CLAIMED_STATES, it.scope, poll_limit as i64).await?;
    let mut recovery_count = 0;
    let kept: Vec<CreditRegistration> = claimed
        .into_iter()
        .filter(|row| {
            let is_recovery = row.submitted_attainment_id.is_none()
                && row.state == CreditRegistrationState::SubmissionUncertain;
            if !is_recovery {
                return true;
            }
            recovery_count += 1;
            recovery_count <= recovery_limit
        })
        .collect();
    let attempts = increment_verify_attempt_counts(
        &mut tx,
        &kept.iter().map(|row| row.id).collect::<Vec<_>>(),
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
    for row in kept {
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
                error!(
                    credit_registration_id = %row.id,
                    "Credit registration is awaiting verification with no submitted attainment id; stuck"
                );
            }
        }
    }
    tx.commit().await?;
    Ok((polls, recoveries))
}

/// Polls the rows that have something to poll by.
struct VerifyPoll {
    polls: Vec<Poll>,
}

impl SuotarBatchPhase for VerifyPoll {
    type Endpoint = endpoints::VerifyAttainments;
    type Row = Poll;

    const ALL_UNAVAILABLE_ERROR: &'static str = "Every verify poll came back unavailable.";

    /// The rows were claimed by [`claim_polls`], at this endpoint's limit, so there is nothing left
    /// to decide here.
    async fn claim(
        &mut self,
        _it: &Iteration<'_>,
        _conn: &mut PgConnection,
        _limit: usize,
    ) -> CreditRegistrationResult<Prepared<Self::Row, VerifyAttainmentRequestItem>> {
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

    async fn apply(
        &self,
        conn: &mut PgConnection,
        poll: &Self::Row,
        item: Option<&SuotarResponseItem<VerifyAttainmentResult>>,
        event: OutcomeEvent<'_>,
    ) -> CreditRegistrationResult<Applied> {
        apply_poll_answer(conn, poll, item, event).await
    }

    /// Deliberately not the shared request-level outcome: a failure to ask proves nothing was or
    /// was not created, and moving the row towards `failed_retryable` would let an admin resubmit
    /// it. The iteration still reports the refusal, and the gate still records it.
    fn on_refusal(&self, poll: &Self::Row) -> Refusal {
        Refusal::KeepWaiting {
            outcome: verify_inconclusive_outcome(poll.row.state, &poll.facts()),
            message: "Could not verify this submission this time.",
        }
    }
}

impl AsRef<CreditRegistration> for Poll {
    fn as_ref(&self) -> &CreditRegistration {
        &self.row
    }
}

impl Poll {
    /// The count this poll was made under, not the one the row was claimed with, so the backoff
    /// doubles once per poll.
    fn facts(&self) -> RowFacts {
        RowFacts {
            verify_attempt_count: self.attempt,
            ..RowFacts::of(&self.row, Utc::now())
        }
    }
}

/// Applies one poll's answer.
async fn apply_poll_answer(
    conn: &mut PgConnection,
    poll: &Poll,
    item: Option<&SuotarResponseItem<VerifyAttainmentResult>>,
    event: OutcomeEvent<'_>,
) -> CreditRegistrationResult<Applied> {
    let row = &poll.row;
    let facts = poll.facts();
    let expected = Some(row.state);
    let error_message =
        item.and_then(|item| item.error.as_ref().map(|error| error.message.as_str()));
    match decide_poll(poll, item, &facts) {
        PollAnswer::Decided(decision) => apply_decision(conn, row, decision, event, expected).await,
        PollAnswer::PartiallyRegistered => {
            let partially_registered_at = mark_partially_registered(conn, row.id).await?;
            let decision = Decision::new(verify_partial_outcome(&facts, partially_registered_at))
                .with_error_message(error_message);
            apply_decision(conn, row, decision, event, expected).await
        }
        PollAnswer::NotRegistered => {
            let mut tx = conn.begin().await?;
            let reimport_count = reset_for_resubmission(&mut tx, row.id).await?;
            let decision = Decision::new(verify_not_registered_outcome(&facts, reimport_count))
                .with_message("Sisu has no trace of the submission, so it will be sent again.")
                .with_error_message(error_message);
            let applied = apply_decision(&mut tx, row, decision, event, expected).await?;
            if matches!(applied, Applied::Written { .. }) {
                tx.commit().await?;
            }
            Ok(applied)
        }
    }
}

/// What a poll's answer comes to, where that needs no more than the answer.
enum PollAnswer<'a> {
    Decided(Decision<'a>),
    /// Only the assessment item attainment is there yet; the outcome depends on when a poll first
    /// saw that.
    PartiallyRegistered,
    /// Suotar has no trace of the submission; the outcome depends on how often that happened.
    NotRegistered,
}

/// Only a course unit attainment registers the row, and only `notRegistered` sends it back towards
/// import; anything else keeps it polling.
fn decide_poll<'a>(
    poll: &Poll,
    item: Option<&'a SuotarResponseItem<VerifyAttainmentResult>>,
    facts: &RowFacts,
) -> PollAnswer<'a> {
    let state = poll.row.state;
    let Some(item) = item else {
        return PollAnswer::Decided(Decision::new(verify_inconclusive_outcome(state, facts)));
    };
    let result = item.result.as_ref();
    let decision = match outcome_of(ENDPOINT, &item.code) {
        WireOutcome::Settled(CreditRegistrationState::Registered)
            if item.status == SuotarItemStatus::Ok =>
        {
            match result.and_then(|result| result.attainment.as_ref()) {
                Some(attainment) if attainment.attainment_type == ATTAINMENT_TYPE_COURSE_UNIT => {
                    Decision::new(Outcome {
                        // Confirmed, so whatever an operator was asked to look at is settled.
                        needs_admin_attention: Some(false),
                        ..Outcome::to(CreditRegistrationState::Registered)
                    })
                    .with_effects(Effects {
                        sisu_attainment: Some((
                            attainment.id.as_str(),
                            attainment.attainment_type.as_str(),
                        )),
                        ..Effects::default()
                    })
                }
                // The assessment item attainment's id can equal the submitted one, and verify
                // records only the final course unit attainment.
                _ => return PollAnswer::PartiallyRegistered,
            }
        }
        // `submissionPending`: polled on as usual, since the attainment usually shows up long
        // before `retryAfter`, which only bounds when a resubmission becomes safe.
        WireOutcome::Unsettled => Decision::new(verify_inconclusive_outcome(state, facts))
            .with_effects(Effects {
                resubmit_not_before: result.and_then(|result| result.retry_after),
                ..Effects::default()
            }),
        WireOutcome::Failure(CreditRegistrationErrorCode::NotRegistered) => {
            return PollAnswer::NotRegistered;
        }
        WireOutcome::Failure(code) => Decision::new(verify_error_outcome(state, code, facts)),
        WireOutcome::Settled(_) => Decision::new(verify_inconclusive_outcome(state, facts)),
    };
    PollAnswer::Decided(
        decision.with_error_message(item.error.as_ref().map(|error| error.message.as_str())),
    )
}

/// Looks for the attainment a submission we lost track of would have produced. The row stays
/// `submission_uncertain` unless it is found: never failed, never re-imported.
struct UncertainRecovery {
    recoveries: Vec<Recovery>,
}

impl SuotarBatchPhase for UncertainRecovery {
    type Endpoint = endpoints::ResolveEnrolments;
    type Row = Recovery;

    const ALL_UNAVAILABLE_ERROR: &'static str = "Every recovery lookup came back unavailable.";

    /// The rows were claimed by [`claim_polls`], already fit to this endpoint's limit. A row with
    /// nothing to ask about is left where it is: it is uncertain, which no answer of ours may turn
    /// into a failure, and it is already scheduled for the next check.
    async fn claim(
        &mut self,
        _it: &Iteration<'_>,
        conn: &mut PgConnection,
        _limit: usize,
    ) -> CreditRegistrationResult<Prepared<Self::Row, ResolveEnrolmentRequestItem>> {
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

    async fn apply(
        &self,
        conn: &mut PgConnection,
        recovery: &Self::Row,
        item: Option<&SuotarResponseItem<EnrolmentResolutionResult>>,
        event: OutcomeEvent<'_>,
    ) -> CreditRegistrationResult<Applied> {
        apply_decision(
            conn,
            &recovery.row,
            decide_recovery(recovery, item),
            event,
            Some(recovery.row.state),
        )
        .await
    }

    /// Not the shared request-level outcome either: these rows must stay uncertain whatever the
    /// call did.
    fn on_refusal(&self, recovery: &Self::Row) -> Refusal {
        Refusal::KeepWaiting {
            outcome: uncertain_recheck_outcome(&recovery.facts()),
            message: "Could not check Sisu for the credits this time.",
        }
    }
}

impl AsRef<CreditRegistration> for Recovery {
    fn as_ref(&self) -> &CreditRegistration {
        &self.row
    }
}

impl Recovery {
    /// The count this lookup was made under, so the recheck cadence advances once per lookup.
    fn facts(&self) -> RowFacts {
        RowFacts {
            verify_attempt_count: self.attempt,
            ..RowFacts::of(&self.row, Utc::now())
        }
    }
}

/// Settles an uncertain row as `duplicate` if the lookup found the attainment it would have created,
/// and otherwise leaves it uncertain.
fn decide_recovery<'a>(
    recovery: &Recovery,
    item: Option<&'a SuotarResponseItem<EnrolmentResolutionResult>>,
) -> Decision<'a> {
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
        return Decision::new(uncertain_recheck_outcome(&recovery.facts())).with_message(
            "No matching attainment yet, so whether the submission landed is still unknown.",
        );
    };
    Decision::new(Outcome {
        needs_admin_attention: Some(false),
        ..Outcome::to(CreditRegistrationState::Duplicate)
    })
    .with_effects(Effects {
        sisu_attainment: Some((attainment.id.as_str(), attainment.attainment_type.as_str())),
        ..Effects::default()
    })
    .with_message(
        "The credits this submission would have created are in Sisu, so it was registered after \
         all.",
    )
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
