//! The `ledger-snapshot` phase: the day's queue depth for every ledger state, every timeline step
//! and the Needs attention count.

use chrono::{DateTime, Duration, NaiveTime, Utc};
use headless_lms_models::credit_registration_daily_snapshots::{
    count_states_for_day, write_attention_snapshot_for_date, write_snapshot_for_date,
    write_step_snapshot_for_date,
};
use headless_lms_models::credit_registrations::{
    count_by_step_and_engagement, count_needing_attention,
};
use sqlx::PgPool;

use crate::attention::attention_rules;
use crate::error::CreditRegistrationResult;
use crate::workflow::Counts;

/// Its own phase rather than folded into `config-validation`'s per-module check: a scoped run must
/// never write a snapshot that claims to cover every course, and `ScopeSupport::NONE` only enforces
/// that if the write has no other job sharing its dispatch.
pub(crate) async fn run(
    pool: &PgPool,
    account_linking_since: Option<DateTime<Utc>>,
) -> CreditRegistrationResult<Counts> {
    let mut conn = pool.acquire().await?;
    let today = Utc::now().date_naive();
    let day_start = today.and_time(NaiveTime::MIN).and_utc();
    let counts = count_states_for_day(&mut conn, day_start, day_start + Duration::days(1)).await?;
    write_snapshot_for_date(&mut conn, today, &counts).await?;
    let step_counts = count_by_step_and_engagement(&mut conn, account_linking_since).await?;
    write_step_snapshot_for_date(&mut conn, today, &step_counts).await?;
    let rules = attention_rules(&mut conn, account_linking_since).await?;
    let needs_attention_count = count_needing_attention(&mut conn, &rules).await?;
    write_attention_snapshot_for_date(&mut conn, today, needs_attention_count).await?;
    Ok(Counts::processed(counts.len() as i64))
}
