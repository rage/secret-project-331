//! The heartbeat a running iteration keeps refreshing.

use headless_lms_models::credit_registration_phase_state;
use headless_lms_utils::periodic_worker::{PeriodicWorkerConfig, run_periodic_worker_until};
use sqlx::PgPool;
use std::convert::Infallible;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

use crate::error::CreditRegistrationResult;
use crate::phase::CreditRegistrationPhase;

/// How often a running iteration refreshes its heartbeat. Under half the shortest phase interval,
/// so even the 10-second phases never read as stale mid-call.
const KEEP_ALIVE_INTERVAL: Duration = Duration::from_secs(5);

/// Refreshes one phase's heartbeat until dropped, so a long study registry call does not raise the
/// stale-worker alert.
pub(super) async fn keep_alive(pool: &PgPool, phase: CreditRegistrationPhase) -> Infallible {
    let never_cancelled = CancellationToken::new();
    let refreshing = run_periodic_worker_until(
        PeriodicWorkerConfig {
            tick_interval: KEEP_ALIVE_INTERVAL,
            still_running: None,
            delay_missed_ticks: true,
        },
        &never_cancelled,
        async || {
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
            Ok::<(), Infallible>(())
        },
    );
    // The helper returns only once its token is cancelled, which this one never is.
    let Ok(()) = refreshing.await;
    std::future::pending().await
}
