//! The phases that only read and write the database, so they keep running while the study registry
//! is unreachable.

use chrono::{Duration, NaiveTime, Utc};
use headless_lms_models::credit_registration_daily_snapshots::{
    count_states_for_day, write_snapshot_for_date,
};
use headless_lms_models::credit_registration_enrolment_check_outcomes;
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::library::credit_registration::legacy_mirror::{
    LEGACY_MIRROR_LIMIT, mirror_successes_to_legacy_ledger,
};
use headless_lms_models::library::credit_registration::materialize::{
    GRADE_IMPROVEMENT_LIMIT, MATERIALIZE_LIMIT, ensure_registration_rows_for_eligible_completions,
    start_re_attempts_for_improved_grades,
};
use headless_lms_models::library::credit_registration::preconditions::{
    PRECONDITIONS_LIMIT, recompute_preconditions,
};
use headless_lms_models::student_number_verification_tokens::soft_delete_expired;
use headless_lms_models::suotar_api_calls::{RETENTION_DAYS, delete_older_than};

use crate::dispatch::PhaseContext;
use crate::phase::PhaseScope;

/// Both statements that create ledger rows, bounded apart from each other. Together in one phase so
/// the Workers tab's row-creation counter accounts for every row the pipeline invented.
pub(crate) async fn run_materialize(
    ctx: &PhaseContext<'_>,
    scope: &PhaseScope,
) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let created =
        ensure_registration_rows_for_eligible_completions(&mut conn, scope, MATERIALIZE_LIMIT)
            .await?;
    let re_attempted =
        start_re_attempts_for_improved_grades(&mut conn, scope, GRADE_IMPROVEMENT_LIMIT).await?;
    Ok(PhaseRunOutcome::processed(created + re_attempted))
}

pub(crate) async fn run_preconditions(
    ctx: &PhaseContext<'_>,
    scope: &PhaseScope,
) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let moved = recompute_preconditions(&mut conn, scope, PRECONDITIONS_LIMIT).await?;
    Ok(PhaseRunOutcome::processed(moved))
}

pub(crate) async fn run_legacy_mirror(
    ctx: &PhaseContext<'_>,
    scope: &PhaseScope,
) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let mirrored = mirror_successes_to_legacy_ledger(&mut conn, scope, LEGACY_MIRROR_LIMIT).await?;
    Ok(PhaseRunOutcome::processed(mirrored))
}

/// The day's queue-depth snapshot for every ledger state.
///
/// Its own phase rather than folded into `config-validation`'s per-module check: a scoped run must
/// never write a snapshot that claims to cover every course, and `ScopeSupport::NONE` only enforces
/// that if the write has no other job sharing its dispatch.
pub(crate) async fn run_ledger_snapshot(
    ctx: &PhaseContext<'_>,
    _scope: &PhaseScope,
) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let today = Utc::now().date_naive();
    let day_start = today.and_time(NaiveTime::MIN).and_utc();
    let counts = count_states_for_day(&mut conn, day_start, day_start + Duration::days(1)).await?;
    write_snapshot_for_date(&mut conn, today, &counts).await?;
    Ok(PhaseRunOutcome::processed(counts.len() as i64))
}

/// How much one retention sweep removes from each table.
const SWEEP_LIMIT: i64 = 500;
/// Above the tens of thousands of checks a day the hourly sweep has to keep up with.
const OUTCOME_SWEEP_LIMIT: i64 = 5000;

/// The call log's 90-day window, the enrolment check log's own longer one, and the expired linking
/// tokens.
///
/// Bounded per iteration and run hourly, so the first sweep after the window opens clears a backlog
/// over several hours instead of in one statement that locks every `credit_registration_events` row
/// referencing it.
pub(crate) async fn run_retention_sweep(
    ctx: &PhaseContext<'_>,
    _scope: &PhaseScope,
) -> anyhow::Result<PhaseRunOutcome> {
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
            purged_calls,
            purged_outcomes,
            retired_tokens,
            "Retention sweep purged expired credit registration records"
        );
    }
    Ok(PhaseRunOutcome::processed(
        i64::try_from(purged_calls + purged_outcomes + retired_tokens).unwrap_or(i64::MAX),
    ))
}
