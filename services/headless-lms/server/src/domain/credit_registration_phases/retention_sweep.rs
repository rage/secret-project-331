//! The `retention-sweep` phase: the call log's 90-day window and the expired linking tokens.
//!
//! Bounded per iteration and run hourly, so the first sweep after the window opens clears a backlog
//! over several hours instead of in one statement that locks every
//! `credit_registration_events` row referencing it.

use chrono::{Duration, Utc};
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::student_number_verification_tokens::soft_delete_expired;
use headless_lms_models::suotar_api_calls::{RETENTION_DAYS, delete_older_than};

use super::{PhaseContext, PhaseScope};

/// How much one iteration removes from each table.
const SWEEP_LIMIT: i64 = 500;

pub async fn run(ctx: &PhaseContext<'_>, _scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let cutoff = Utc::now() - Duration::days(RETENTION_DAYS);
    let purged_calls = delete_older_than(&mut conn, cutoff, SWEEP_LIMIT).await?;
    let retired_tokens = soft_delete_expired(&mut conn, SWEEP_LIMIT).await?;
    if purged_calls > 0 || retired_tokens > 0 {
        info!(
            "Purged {purged_calls} study registry call rows past the {RETENTION_DAYS} day window and retired {retired_tokens} expired student number verification tokens."
        );
    }
    Ok(PhaseRunOutcome::processed(
        i64::try_from(purged_calls + retired_tokens).unwrap_or(i64::MAX),
    ))
}
