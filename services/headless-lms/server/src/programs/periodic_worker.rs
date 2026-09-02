//! The tick-interval scaffold shared by every background worker that polls the database on a fixed
//! period: `regrader`, `chatbot_syncer` and the credit registration phase runners.

use std::error::Error as StdError;
use std::time::Duration;

/// How a worker's ticking loop should behave, so the loop itself carries none of that per-worker
/// detail.
pub struct PeriodicWorkerConfig<'a> {
    pub tick_interval: Duration,
    /// Ticks between "still running" heartbeat logs.
    pub still_running_every: u32,
    pub still_running_message: &'a str,
    /// Starting value of the tick counter, so a worker that wants its first heartbeat sooner than
    /// `still_running_every` ticks can seed it.
    pub initial_ticks: u32,
    /// `true` pushes a slow iteration's next tick out instead of firing it immediately
    /// (`tokio::time::MissedTickBehavior::Delay`); `false` keeps tokio's default (`Burst`).
    pub delay_missed_ticks: bool,
}

/// Runs `body` on `config.tick_interval` forever, logging `config.still_running_message` every
/// `config.still_running_every` ticks. A `body` that returns `Err` stops the loop and becomes this
/// function's return value, the same as an unhandled error used to exit the worker's `main`.
pub async fn run_periodic_worker(
    config: PeriodicWorkerConfig<'_>,
    mut body: impl AsyncFnMut() -> anyhow::Result<()>,
) -> anyhow::Result<()> {
    let mut interval = tokio::time::interval(config.tick_interval);
    if config.delay_missed_ticks {
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    }
    let mut ticks = config.initial_ticks;
    loop {
        interval.tick().await;
        ticks += 1;
        if ticks >= config.still_running_every {
            ticks = 0;
            info!("{}", config.still_running_message);
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
