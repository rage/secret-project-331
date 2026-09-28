//! Leasing the rows a verify iteration asks about, so no concurrent iteration asks about them too.

use chrono::{DateTime, Utc};
use headless_lms_models::credit_registrations::{
    VerifyFlow, claim_due_for_verify, increment_verify_attempt_counts, schedule_next_attempts,
};
use headless_lms_models::library::credit_registration::outcomes::{
    RowFacts, verify_poll_lease_until,
};
use sqlx::PgConnection;

use crate::error::CreditRegistrationResult;
use crate::use_cases::batch_flow::BatchFlowContext;
use crate::workflow::{Claimed, ClaimedRegistration};

/// A claimed row, leased where it stands, with the verify attempt the lease counted for it.
pub(super) type Leased = Claimed<VerifyAttempt>;

/// The verify attempt a lease counted for its row, which sets the backoff the answer is scheduled
/// by. Only [`claim_and_lease`] makes one, so it is always the count the lease wrote.
pub(super) struct VerifyAttempt(i32);

/// The row's facts under the attempt the lease counted, not the count the row was claimed with, so
/// the backoff advances once per attempt.
pub(super) fn attempt_facts(leased: &Leased, now: DateTime<Utc>) -> RowFacts {
    RowFacts {
        verify_attempt_count: leased.extra.0,
        ..leased.claim.facts(now)
    }
}

/// Claims up to `limit` of `flow`'s due rows, counts an attempt on each and leases it until its
/// poll's backoff, or the iteration's registry calls, run out, so a concurrent iteration cannot
/// poll the same row. Each answer overwrites its own row's schedule.
pub(super) async fn claim_and_lease(
    ctx: &BatchFlowContext<'_>,
    conn: &mut PgConnection,
    flow: VerifyFlow,
    limit: usize,
) -> CreditRegistrationResult<Vec<Leased>> {
    let claimed = claim_due_for_verify(
        conn,
        flow,
        ctx.scope,
        i64::try_from(limit).unwrap_or(i64::MAX),
    )
    .await?;
    let attempts = increment_verify_attempt_counts(
        conn,
        &claimed.iter().map(|row| row.id).collect::<Vec<_>>(),
    )
    .await?;
    let now = Utc::now();
    let scheduled: Vec<_> = attempts
        .iter()
        .map(|(id, attempt)| {
            (
                *id,
                verify_poll_lease_until(now, *attempt, ctx.study_registry_wait),
            )
        })
        .collect();
    schedule_next_attempts(conn, &scheduled).await?;
    Ok(claimed
        .into_iter()
        .filter_map(|row| {
            // Not expected while the claim holds the row's lock; if it happens anyway, the row is
            // left unpolled rather than polled under an attempt the lease never wrote.
            let Some(attempt) = attempts.get(&row.id).copied() else {
                warn!(
                    credit_registration_id = %row.id,
                    "Verify attempt was not counted for a claimed credit registration; leaving it unpolled"
                );
                return None;
            };
            Some(Claimed {
                claim: ClaimedRegistration::left_in_place(row),
                extra: VerifyAttempt(attempt),
            })
        })
        .collect())
}
