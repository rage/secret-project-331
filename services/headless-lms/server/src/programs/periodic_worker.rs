//! The tick-interval scaffold shared by every background worker that polls the database on a fixed
//! period: `regrader`, `chatbot_syncer` and the credit registration phase runners.

use std::error::Error as StdError;
use std::time::Duration;

use tokio_util::sync::CancellationToken;

/// How a worker's ticking loop should behave, so the loop itself carries none of that per-worker
/// detail.
pub struct PeriodicWorkerConfig<'a> {
    pub tick_interval: Duration,
    pub still_running: Option<StillRunningLog<'a>>,
    /// `true` pushes a slow iteration's next tick out instead of firing it immediately
    /// (`tokio::time::MissedTickBehavior::Delay`); `false` keeps tokio's default (`Burst`).
    pub delay_missed_ticks: bool,
}

/// The "still running" heartbeat line a worker logs every `every` ticks.
pub struct StillRunningLog<'a> {
    pub every: u32,
    pub message: &'a str,
    /// Starting value of the tick counter, so a worker that wants its first line sooner than `every`
    /// ticks can seed it.
    pub initial_ticks: u32,
}

/// Runs `body` on `config.tick_interval` forever, logging the still-running line if there is one. A
/// `body` that returns `Err` stops the loop and becomes this function's return value.
pub async fn run_periodic_worker(
    config: PeriodicWorkerConfig<'_>,
    body: impl AsyncFnMut() -> anyhow::Result<()>,
) -> anyhow::Result<()> {
    run_periodic_worker_until(config, &CancellationToken::new(), body).await
}

/// [`run_periodic_worker`] that returns `Ok` once `shutdown` is cancelled. An iteration already
/// running is left to finish; only the wait for the next tick is cut short.
pub async fn run_periodic_worker_until(
    config: PeriodicWorkerConfig<'_>,
    shutdown: &CancellationToken,
    mut body: impl AsyncFnMut() -> anyhow::Result<()>,
) -> anyhow::Result<()> {
    let mut interval = tokio::time::interval(config.tick_interval);
    if config.delay_missed_ticks {
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    }
    let mut ticks = config
        .still_running
        .as_ref()
        .map_or(0, |still_running| still_running.initial_ticks);
    loop {
        tokio::select! {
            biased;
            _ = shutdown.cancelled() => return Ok(()),
            _ = interval.tick() => {}
        }
        if let Some(still_running) = &config.still_running {
            ticks += 1;
            if ticks >= still_running.every {
                ticks = 0;
                info!("{}", still_running.message);
            }
        }
        body().await?;
    }
}

/// True when an error's source is a `sqlx::Error::Io`, which is usually the database being reset
/// underneath a local development cluster: the caller's cue to log its own hint and, if it keeps a
/// connection open across ticks, reacquire one. Takes the source directly (`error.source()`)
/// rather than the error, since `anyhow::Error` does not implement `std::error::Error`.
pub fn is_db_disconnect(source: Option<&(dyn StdError + 'static)>) -> bool {
    matches!(
        source.and_then(|source| source.downcast_ref::<sqlx::Error>()),
        Some(sqlx::Error::Io(..))
    )
}
