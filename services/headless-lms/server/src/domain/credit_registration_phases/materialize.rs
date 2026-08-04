//! The `materialize` phase: ledger rows for completions that may be registered.

use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::library::credit_registration::materialize::{
    MATERIALIZE_LIMIT, ensure_registration_rows_for_eligible_completions,
};

use super::{PhaseContext, PhaseScope};

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let created =
        ensure_registration_rows_for_eligible_completions(&mut conn, scope, MATERIALIZE_LIMIT)
            .await?;
    Ok(PhaseRunOutcome::processed(created))
}
