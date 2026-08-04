//! The `preconditions` phase: moving rows along the chain, and out of it.
//!
//! Database-only, so it keeps running while the study registry is unreachable.

use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::library::credit_registration::preconditions::{
    PRECONDITIONS_LIMIT, recompute_preconditions,
};

use super::{PhaseContext, PhaseScope};

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let moved = recompute_preconditions(&mut conn, scope, PRECONDITIONS_LIMIT).await?;
    Ok(PhaseRunOutcome::processed(moved))
}
