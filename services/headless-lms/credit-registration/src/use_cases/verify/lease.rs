//! Leasing the rows a verify iteration asks about, so no concurrent iteration asks about them too.

use chrono::Utc;
use headless_lms_models::credit_registrations::{
    VerifyFlow, claim_due_for_verify, increment_verify_attempt_counts, schedule_next_attempts,
};
use headless_lms_models::library::credit_registration::outcomes::{
    RowFacts, verify_poll_lease_until,
};
use sqlx::PgConnection;

use crate::domain::ClaimedRegistration;
use crate::error::CreditRegistrationResult;
use crate::phase::PhaseScope;

/// One claimed row, leased where it stands, and the verify attempt it was claimed for, which sets
/// the backoff the answer is scheduled by.
pub(super) struct Leased {
    pub(super) claim: ClaimedRegistration,
    pub(super) attempt: i32,
}

impl AsRef<ClaimedRegistration> for Leased {
    fn as_ref(&self) -> &ClaimedRegistration {
        &self.claim
    }
}

impl Leased {
    /// The count this attempt was made under, not the one the row was claimed with, so the backoff
    /// advances once per attempt.
    pub(super) fn facts(&self) -> RowFacts {
        RowFacts {
            verify_attempt_count: self.attempt,
            ..self.claim.facts(Utc::now())
        }
    }
}

/// Claims up to `limit` of `flow`'s due rows, counts an attempt on each and leases it until its
/// poll's backoff, so a concurrent iteration cannot poll the same row. Each answer overwrites its
/// own row's schedule.
pub(super) async fn claim_and_lease(
    conn: &mut PgConnection,
    scope: &PhaseScope,
    flow: VerifyFlow,
    limit: usize,
) -> CreditRegistrationResult<Vec<Leased>> {
    let claimed = claim_due_for_verify(conn, flow, scope, limit as i64).await?;
    let attempts = increment_verify_attempt_counts(
        conn,
        &claimed.iter().map(|row| row.id).collect::<Vec<_>>(),
    )
    .await?;
    let now = Utc::now();
    let scheduled: Vec<_> = attempts
        .iter()
        .map(|(id, attempt)| (*id, verify_poll_lease_until(now, *attempt)))
        .collect();
    schedule_next_attempts(conn, &scheduled).await?;
    Ok(claimed
        .into_iter()
        .filter_map(|row| {
            let attempt = attempts.get(&row.id).copied()?;
            Some(Leased {
                claim: ClaimedRegistration::left_in_place(row),
                attempt,
            })
        })
        .collect())
}
