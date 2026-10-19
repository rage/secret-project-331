//! Leasing the rows a verify iteration asks about, so no concurrent iteration asks about them too.

use chrono::{DateTime, Utc};
use headless_lms_models::credit_registrations::{
    VerifyFlow, claim_due_for_verify, increment_verify_attempt_counts, schedule_next_attempts,
};
use headless_lms_models::library::credit_registration::course_unit_poll_slots::next_course_unit_polls;
use headless_lms_models::library::credit_registration::outcomes::{
    RowFacts, verify_poll_lease_until,
};
use sqlx::PgConnection;

use crate::error::CreditRegistrationResult;
use crate::use_cases::batch_flow::BatchFlowContext;
use crate::workflow::{Claimed, ClaimedRegistration};

/// A claimed row, leased where it stands, with the verify attempt the lease counted for it.
pub(super) type Leased = Claimed<VerifyAttempt>;

/// The verify attempt a lease counted for its row, which sets the backoff an uncertain row's answer
/// is scheduled by, and the course unit poll the lease chose for the row. Only [`claim_and_lease`]
/// makes one, so it is always what the lease wrote.
pub(super) struct VerifyAttempt {
    count: i32,
    /// `None` in a flow whose rows cannot become partially registered.
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
    let course_unit_polls: Vec<Option<DateTime<Utc>>> =
        if flow == VerifyFlow::Poll && !claimed.is_empty() {
            next_course_unit_polls(
                conn,
                now,
                &claimed
                    .iter()
                    .map(|row| row.partially_registered_at.unwrap_or(now))
                    .collect::<Vec<_>>(),
            )
            .await?
            .into_iter()
            .map(Some)
            .collect()
        } else {
            vec![None; claimed.len()]
        };
    let scheduled: Vec<_> = claimed
        .iter()
        .zip(&course_unit_polls)
        .filter(|(row, _)| attempts.contains_key(&row.id))
        .map(|(row, &course_unit_poll_at)| {
            let facts = RowFacts {
                course_unit_poll_at,
                ..RowFacts::of(row, now)
            };
            (
                row.id,
                verify_poll_lease_until(row.state, &facts, ctx.study_registry_wait),
            )
        })
        .collect();
    schedule_next_attempts(conn, &scheduled).await?;
    Ok(claimed
        .into_iter()
        .zip(course_unit_polls)
        .filter_map(|(row, course_unit_poll_at)| {
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
                extra: VerifyAttempt {
                    count: attempt,
                    course_unit_poll_at,
                },
            })
        })
        .collect())
}
