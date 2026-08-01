//! The `legacy-mirror` phase: our successes recorded in the legacy study-registry ledger.

use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::library::credit_registration::legacy_mirror::{
    LEGACY_MIRROR_LIMIT, mirror_successes_to_legacy_ledger,
};

use super::{PhaseContext, PhaseScope};

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let mirrored = mirror_successes_to_legacy_ledger(&mut conn, scope, LEGACY_MIRROR_LIMIT).await?;
    Ok(PhaseRunOutcome {
        items_processed: mirrored.try_into().unwrap_or(i32::MAX),
        items_failed: 0,
        error: None,
    })
}
