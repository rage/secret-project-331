//! The `retention-sweep` phase: the call log's 90-day window, the enrolment check log's own longer
//! one, and the expired linking tokens.
//!
//! Bounded per iteration and run hourly, so the first sweep after the window opens clears a backlog
//! over several hours instead of in one statement that locks every
//! `credit_registration_events` row referencing it.

use chrono::{Duration, Utc};
use headless_lms_models::credit_registration_enrolment_check_outcomes;
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::student_number_verification_tokens::soft_delete_expired;
use headless_lms_models::suotar_api_calls::{RETENTION_DAYS, delete_older_than};

use super::{PhaseContext, PhaseScope};

/// How much one iteration removes from each table.
const SWEEP_LIMIT: i64 = 500;
/// Above the tens of thousands of checks a day the hourly sweep has to keep up with.
const OUTCOME_SWEEP_LIMIT: i64 = 5000;

pub async fn run(ctx: &PhaseContext<'_>, _scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let cutoff = Utc::now() - Duration::days(RETENTION_DAYS);
    let purged_calls = delete_older_than(&mut conn, cutoff, SWEEP_LIMIT).await?;
    let purged_outcomes = credit_registration_enrolment_check_outcomes::delete_older_than(
        &mut conn,
        Utc::now() - Duration::days(credit_registration_enrolment_check_outcomes::RETENTION_DAYS),
        OUTCOME_SWEEP_LIMIT,
    )
    .await?;
    let retired_tokens = soft_delete_expired(&mut conn, SWEEP_LIMIT).await?;
    if purged_calls > 0 || purged_outcomes > 0 || retired_tokens > 0 {
        info!(
            "Purged {purged_calls} study registry call rows past the {RETENTION_DAYS} day window, {purged_outcomes} enrolment check outcomes past theirs, and retired {retired_tokens} expired student number verification tokens."
        );
    }
    Ok(PhaseRunOutcome::processed(
        i64::try_from(purged_calls + purged_outcomes + retired_tokens).unwrap_or(i64::MAX),
    ))
}
