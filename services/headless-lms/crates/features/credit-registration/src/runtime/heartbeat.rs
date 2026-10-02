//! The heartbeat a running iteration keeps refreshing.

use headless_lms_models::credit_registration_phase_state;
use sqlx::PgPool;
use std::convert::Infallible;
use std::time::Duration;
use tokio::time::MissedTickBehavior;

use crate::error::CreditRegistrationResult;
use crate::phase::CreditRegistrationPhase;

/// How often a running iteration refreshes its heartbeat. Under half the shortest phase interval,
/// so even the 10-second phases never read as stale mid-call.
const KEEP_ALIVE_INTERVAL: Duration = Duration::from_secs(5);

/// Refreshes one phase's heartbeat until dropped, so a long study registry call does not raise the
/// stale-worker alert.
pub(super) async fn keep_alive(pool: &PgPool, phase: CreditRegistrationPhase) -> Infallible {
    let mut interval = tokio::time::interval(KEEP_ALIVE_INTERVAL);
    interval.set_missed_tick_behavior(MissedTickBehavior::Delay);
    loop {
        interval.tick().await;
        let refreshed = async {
            let mut conn = pool.acquire().await?;
            credit_registration_phase_state::keep_alive(&mut conn, phase.as_str()).await?;
            CreditRegistrationResult::Ok(())
        }
        .await;
        match refreshed {
            Ok(()) => trace!(phase = phase.as_str(), "Refreshed phase heartbeat"),
            Err(error) => {
                warn!(phase = phase.as_str(), error = %error, "Failed to refresh phase heartbeat");
            }
        }
    }
}
