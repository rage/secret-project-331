//! The `ledger-snapshot` phase: the day's queue-depth snapshot for every ledger state.
//!
//! Database-only. Its own phase rather than folded into `config-validation`'s per-module check: a
//! scoped run must never write a snapshot that claims to cover every course, and `ScopeSupport::NONE`
//! only enforces that if the write has no other job sharing its dispatch.

use chrono::{Duration, NaiveTime, Utc};
use headless_lms_models::credit_registration_daily_snapshots::{
    count_states_for_day, write_snapshot_for_date,
};
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;

use super::{PhaseContext, PhaseScope};

pub async fn run(ctx: &PhaseContext<'_>, _scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let today = Utc::now().date_naive();
    let day_start = today.and_time(NaiveTime::MIN).and_utc();
    let counts = count_states_for_day(&mut conn, day_start, day_start + Duration::days(1)).await?;
    write_snapshot_for_date(&mut conn, today, &counts).await?;
    Ok(PhaseRunOutcome::processed(counts.len() as i64))
}
