//! The loop both credit registration workers run.
//!
//! The processes differ only in which phases they own and how often they look, so the scheduling
//! lives here instead of in each of them.

use std::{
    sync::Arc,
    time::{Duration, Instant},
};

use chrono::{DateTime, Utc};
use sqlx::PgPool;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::credit_registration_phase_state::{
    self, CreditRegistrationPhaseState, set_next_run_at,
};
use headless_lms_models::suotar_api_calls::PgSuotarCallAudit;
use headless_lms_utils::services::suotar::SuotarClient;
use tokio_util::sync::CancellationToken;

use headless_lms_utils::periodic_worker::{
    PeriodicWorkerConfig, StillRunningLog, run_periodic_worker_until,
};

use crate::dispatch::{PhaseContext, PhaseSkipReason, PhaseTick, run_phase_once};
use crate::error::{CreditRegistrationError, CreditRegistrationResult};
use crate::error_reporting::report_error;
use crate::phase::{CreditRegistrationPhase, PhaseScope, WorkerProcess};
use crate::process_local::ProcessLocalMap;

/// How often each phase's loop looks whether it is due; each phase's own interval lives in
/// `credit_registration_phase_state`.
const TICK_INTERVAL: Duration = Duration::from_secs(10);

/// Ten minutes of ticks. The per-phase heartbeat in the database is the machine-readable half.
const STILL_RUNNING_MESSAGE_TICKS: u32 = 60;

/// Runs the phases `process` owns until SIGTERM or Ctrl-C. Each phase loops on its own, so an
/// hour-long call in one does not hold up the others. On shutdown no phase starts another
/// iteration, and the function returns once the iterations already running have finished.
pub async fn run(
    process: WorkerProcess,
    db_pool: PgPool,
    app_configuration: ApplicationConfiguration,
    still_running_message: &str,
) -> CreditRegistrationResult<()> {
    let suotar_client = SuotarClient::new(
        &app_configuration.suotar_configuration,
        Arc::new(PgSuotarCallAudit::new(db_pool.clone())),
    );
    let shutdown = CancellationToken::new();
    tokio::spawn(cancel_on_termination_signal(shutdown.clone()));
    let ctx = PhaseContext {
        owning_process: Some(process),
        shutdown: Some(&shutdown),
        ..PhaseContext::from_app(
            &db_pool,
            &suotar_client,
            &app_configuration,
            process.as_str(),
        )
    };

    let still_running = run_periodic_worker_until(
        PeriodicWorkerConfig {
            tick_interval: TICK_INTERVAL,
            still_running: Some(StillRunningLog {
                every: STILL_RUNNING_MESSAGE_TICKS,
                message: still_running_message,
                initial_ticks: 0,
            }),
            delay_missed_ticks: true,
        },
        &shutdown,
        async || Ok::<(), CreditRegistrationError>(()),
    );
    // Futures of one task rather than spawned tasks: the phase bodies are not `Send`. They only
    // need to wait on the study registry side by side, not to run in parallel.
    let phase_loops = CreditRegistrationPhase::ALL
        .into_iter()
        .filter(|phase| phase.spec().process == process)
        .map(|phase| run_phase_loop(&ctx, phase, &shutdown));
    let (still_running, phase_loops) =
        tokio::join!(still_running, futures::future::join_all(phase_loops));
    still_running?;
    phase_loops
        .into_iter()
        .collect::<CreditRegistrationResult<()>>()?;
    info!("{} stopped.", process.as_str());
    Ok(())
}

async fn run_phase_loop(
    ctx: &PhaseContext<'_>,
    phase: CreditRegistrationPhase,
    shutdown: &CancellationToken,
) -> CreditRegistrationResult<()> {
    run_periodic_worker_until(
        PeriodicWorkerConfig {
            tick_interval: TICK_INTERVAL,
            // `run` logs one message for the whole process.
            still_running: None,
            // A slow iteration should push later ticks out, not fire them back to back (tokio's
            // default).
            delay_missed_ticks: true,
        },
        shutdown,
        async || {
            trace!(phase = phase.as_str(), "Checking whether phase is due");
            // Logged and swallowed: the phase-state row already carries the failure for the
            // dashboard, and the loop must keep going.
            if let Err(error) = run_if_due(ctx, phase).await {
                log_failure(ctx.caller, phase.as_str(), &error);
                report_error(
                    ctx.pool,
                    ctx.owning_process,
                    phase,
                    &error.cause_chain(),
                    Some(format!("{error:?}")),
                    serde_json::json!({}),
                )
                .await;
            }
            Ok(())
        },
    )
    .await
}

/// Kubernetes sends SIGTERM and waits `terminationGracePeriodSeconds` before killing the pod.
async fn cancel_on_termination_signal(shutdown: CancellationToken) {
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(error) => {
                error!(error = %error, "Could not listen for SIGTERM");
                std::future::pending::<()>().await;
            }
        }
    };
    tokio::select! {
        _ = terminate => info!("Received SIGTERM; finishing the phase iterations already running."),
        _ = tokio::signal::ctrl_c() => info!("Received Ctrl-C; finishing the phase iterations already running."),
    }
    shutdown.cancel();
}

async fn run_if_due(
    ctx: &PhaseContext<'_>,
    phase: CreditRegistrationPhase,
) -> CreditRegistrationResult<()> {
    let state = {
        let mut conn = ctx.pool.acquire().await?;
        credit_registration_phase_state::get_by_phase(&mut conn, phase.as_str()).await?
    };
    if !is_due(&state, Utc::now()) {
        return Ok(());
    }
    run_due_phase(ctx, phase, &state).await
}

fn log_failure(process_name: &str, phase: &str, error: &CreditRegistrationError) {
    error!(phase, error = %error, "Credit registration phase iteration failed");
    if error.is_db_disconnect() {
        info!(process_name, "May have lost its connection to the database");
    }
}

/// Runs one due phase, and schedules the next run.
async fn run_due_phase(
    ctx: &PhaseContext<'_>,
    phase: CreditRegistrationPhase,
    state: &CreditRegistrationPhaseState,
) -> CreditRegistrationResult<()> {
    let mut conn = ctx.pool.acquire().await?;
    // Stamped before the work, so a phase whose iteration takes longer than its interval does not
    // run back to back.
    set_next_run_at(
        &mut conn,
        phase.as_str(),
        Utc::now() + chrono::Duration::seconds(state.expected_interval_secs.into()),
    )
    .await?;
    drop(conn);

    let started_at = Instant::now();
    // Always unscoped: a worker that narrowed would leave rows nobody sweeps.
    let tick = run_phase_once(ctx, phase, &PhaseScope::default()).await?;
    let duration_ms = started_at.elapsed().as_millis() as u64;
    match tick {
        PhaseTick::Ran(outcome) if outcome.items_processed > 0 || outcome.items_failed > 0 => {
            clear_skip_state(phase);
            let processed = outcome.items_processed;
            let failed = outcome.items_failed;
            info!(
                phase = phase.as_str(),
                processed,
                failed,
                duration_ms,
                "processed {processed} rows ({failed} failed), took {duration_ms}ms"
            );
        }
        PhaseTick::Ran(_) => {
            clear_skip_state(phase);
            // Nothing to do this run: too routine to log above debug, or the heartbeat interval
            // would read as a stream of info lines once a phase catches up with its queue.
            debug!(
                phase = phase.as_str(),
                duration_ms, "Credit registration phase run found nothing to do"
            );
        }
        // Waiting out a cooldown, or turned off: the phase-state row already carries this for the
        // dashboard, so only the state change is worth a log line, not every retry.
        PhaseTick::Skipped(reason) => log_skip_if_changed(phase, reason),
        PhaseTick::ScopeNotSupported => {}
    }
    Ok(())
}

/// The skip reason last logged for a phase, so a paused phase or an open breaker logs once per
/// state change instead of on every tick until it clears.
static LAST_LOGGED_SKIP: ProcessLocalMap<CreditRegistrationPhase, PhaseSkipReason> =
    ProcessLocalMap::new();

fn log_skip_if_changed(phase: CreditRegistrationPhase, reason: PhaseSkipReason) {
    let mut last = LAST_LOGGED_SKIP.lock();
    if last.get(&phase) == Some(&reason) {
        return;
    }
    last.insert(phase, reason);
    drop(last);
    match reason {
        PhaseSkipReason::Paused => {
            info!(
                phase = phase.as_str(),
                "Credit registration phase is paused; skipping"
            );
        }
        PhaseSkipReason::CircuitBreakerOpen => {
            info!(
                phase = phase.as_str(),
                "Credit registration phase skipped: circuit breaker is open"
            );
        }
        PhaseSkipReason::AccountLinkingDisabled => {
            debug!(
                phase = phase.as_str(),
                "Credit registration phase skipped: account linking is disabled"
            );
        }
    }
}

fn clear_skip_state(phase: CreditRegistrationPhase) {
    LAST_LOGGED_SKIP.lock().remove(&phase);
}

/// A phase is due when an admin asked for it, or when its interval has elapsed since it last began.
fn is_due(state: &CreditRegistrationPhaseState, now: DateTime<Utc>) -> bool {
    if let Some(next_run_at) = state.next_run_at {
        return next_run_at <= now;
    }
    state.last_run_started_at.is_none_or(|started| {
        (now - started).num_seconds() >= i64::from(state.expected_interval_secs)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn state(
        next_run_at: Option<DateTime<Utc>>,
        last_run_started_at: Option<DateTime<Utc>>,
    ) -> CreditRegistrationPhaseState {
        CreditRegistrationPhaseState {
            id: Uuid::new_v4(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
            phase: "verify".to_string(),
            process_name: "credit-registrar".to_string(),
            expected_interval_secs: 60,
            last_heartbeat_at: None,
            last_run_started_at,
            last_run_finished_at: None,
            last_success_at: None,
            next_run_at,
            items_processed_last_run: None,
            items_failed_last_run: None,
            consecutive_failures: 0,
            last_error: None,
            paused_at: None,
            paused_by_user_id: None,
            pause_reason: None,
        }
    }

    #[test]
    fn a_phase_that_has_never_run_is_due() {
        assert!(is_due(&state(None, None), Utc::now()));
    }

    #[test]
    fn a_phase_is_due_again_once_its_interval_has_elapsed() {
        let now = Utc::now();
        assert!(!is_due(
            &state(None, Some(now - chrono::Duration::seconds(30))),
            now
        ));
        assert!(is_due(
            &state(None, Some(now - chrono::Duration::seconds(90))),
            now
        ));
    }

    /// How "run now" works: the admin endpoint stamps the timestamp and the loop notices.
    #[test]
    fn an_explicit_next_run_beats_the_interval() {
        let now = Utc::now();
        let asked_for = state(Some(now), Some(now));
        assert!(is_due(&asked_for, now));

        let scheduled = state(Some(now + chrono::Duration::seconds(30)), None);
        assert!(!is_due(&scheduled, now));
    }

    /// A phase belonging to neither process would look merely idle rather than unrun.
    #[test]
    fn the_two_processes_between_them_own_every_phase() {
        let mut owned: Vec<&str> = Vec::new();
        for process in WorkerProcess::ALL {
            owned.extend(
                CreditRegistrationPhase::ALL
                    .into_iter()
                    .filter(|phase| phase.spec().process == process)
                    .map(|phase| phase.as_str()),
            );
        }
        assert_eq!(owned.len(), CreditRegistrationPhase::ALL.len());
    }
}
