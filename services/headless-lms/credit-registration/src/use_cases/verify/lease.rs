//! Leasing the rows a verify iteration asks about, so no concurrent iteration asks about them too.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use headless_lms_models::credit_registrations::{
    VerifyFlow, claim_due_for_verify, increment_verify_attempt_counts, schedule_next_attempts,
};
use headless_lms_models::library::credit_registration::course_unit_poll_slots::next_course_unit_polls;
use headless_lms_models::library::credit_registration::outcomes::{
    RowFacts, verify_poll_lease_until,
};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::error::CreditRegistrationResult;
use crate::use_cases::batch_flow::BatchFlowContext;
use crate::workflow::{Claimed, ClaimedRegistration};

/// A claimed row, leased where it stands, with the verify attempt the lease counted for it.
pub(super) type Leased = Claimed<VerifyAttempt>;

/// What the lease wrote for its row: the attempt count that sets an uncertain row's backoff, and
/// the next course unit poll. Only [`claim_and_lease`] makes one.
pub(super) struct VerifyAttempt {
    count: i32,
    course_unit_poll_at: Option<DateTime<Utc>>,
}

/// The row's facts under the attempt the lease counted, not the count the row was claimed with, so
/// the backoff advances once per attempt.
pub(super) fn attempt_facts(leased: &Leased, now: DateTime<Utc>) -> RowFacts {
    RowFacts {
        verify_attempt_count: leased.extra.count,
        course_unit_poll_at: leased.extra.course_unit_poll_at,
        ..leased.claim.facts(now)
    }
}

/// Claims up to `limit` of `flow`'s due rows, counts an attempt on each and leases it until its
/// next poll would be due, or the iteration's registry calls run out, so a concurrent iteration cannot
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
    let course_unit_polls: HashMap<Uuid, DateTime<Utc>> =
        if flow == VerifyFlow::Poll && !claimed.is_empty() {
            let first_seen_at: Vec<_> = claimed
                .iter()
                .map(|row| row.partially_registered_at.unwrap_or(now))
                .collect();
            claimed
                .iter()
                .map(|row| row.id)
                .zip(next_course_unit_polls(conn, now, &first_seen_at).await?)
                .collect()
        } else {
            HashMap::new()
        };
    let leased: Vec<Leased> = claimed
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
            let course_unit_poll_at = course_unit_polls.get(&row.id).copied();
            Some(Claimed {
                claim: ClaimedRegistration::left_in_place(row),
                extra: VerifyAttempt {
                    count: attempt,
                    course_unit_poll_at,
                },
            })
        })
        .collect();
    let scheduled: Vec<_> = leased
        .iter()
        .map(|leased| {
            let row = leased.claim.registration();
            (
                row.id,
                verify_poll_lease_until(
                    row.state,
                    &attempt_facts(leased, now),
                    ctx.study_registry_wait,
                ),
            )
        })
        .collect();
    schedule_next_attempts(conn, &scheduled).await?;
    Ok(leased)
}
