//! The `legacy-mirror` phase: copying successful registrations to the legacy ledger.

use headless_lms_models::library::credit_registration::legacy_mirror::{
    LEGACY_MIRROR_LIMIT, mirror_successes_to_legacy_ledger,
};
use sqlx::PgPool;

use crate::error::CreditRegistrationResult;
use crate::workflow::Counts;
use headless_lms_models::credit_registrations::RegistrationScope;

pub(crate) async fn run(
    pool: &PgPool,
    scope: &RegistrationScope,
) -> CreditRegistrationResult<Counts> {
    let mut conn = pool.acquire().await?;
    let mirrored = mirror_successes_to_legacy_ledger(&mut conn, scope, LEGACY_MIRROR_LIMIT).await?;
    if mirrored > 0 {
        debug!(
            mirrored,
            "Mirrored successful registrations to the legacy ledger"
        );
    }
    Ok(Counts::processed(mirrored))
}
