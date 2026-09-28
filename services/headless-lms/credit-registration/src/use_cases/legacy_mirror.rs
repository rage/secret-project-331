//! The `legacy-mirror` phase: copying successful registrations to the legacy ledger.

use headless_lms_models::library::credit_registration::legacy_mirror::{
    LEGACY_MIRROR_LIMIT, mirror_successes_to_legacy_ledger,
};

use crate::domain::Counts;
use crate::error::CreditRegistrationResult;
use crate::use_cases::contexts::DatabaseContext;

pub(crate) async fn run(ctx: &DatabaseContext<'_>) -> CreditRegistrationResult<Counts> {
    let mut conn = ctx.pool.acquire().await?;
    let mirrored =
        mirror_successes_to_legacy_ledger(&mut conn, ctx.scope, LEGACY_MIRROR_LIMIT).await?;
    if mirrored > 0 {
        debug!(
            mirrored,
            "Mirrored successful registrations to the legacy ledger"
        );
    }
    Ok(Counts::processed(mirrored))
}
