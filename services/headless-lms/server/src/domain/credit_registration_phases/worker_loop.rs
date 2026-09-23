//! The loop both credit registration workers run.
//!
//! The processes differ only in which phases they own and how often they look, so the scheduling
//! lives here instead of in each of them.

use std::{sync::Arc, time::Duration};

use chrono::{DateTime, Utc};
use sqlx::PgPool;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::credit_registration_phase_state::{
    self, CreditRegistrationPhaseState, set_next_run_at,
};
use headless_lms_models::suotar_api_calls::PgSuotarCallAudit;
use headless_lms_utils::services::suotar::SuotarClient;
use tokio_util::sync::CancellationToken;

use crate::programs::periodic_worker::{
    PeriodicWorkerConfig, StillRunningLog, is_db_disconnect, run_periodic_worker_until,
};

use super::{CreditRegistrationPhase, PhaseContext, PhaseScope, PhaseTick, run_phase_once};

/// How often each phase's loop looks whether it is due; each phase's own interval lives in
/// `credit_registration_phase_state`.
const TICK_INTERVAL_SECS: u64 = 10;

/// Ten minutes of ticks. The per-phase heartbeat in the database is the machine-readable half.
const STILL_RUNNING_MESSAGE_TICKS: u32 = 60;

/// Runs the phases this process owns until SIGTERM or Ctrl-C, matching `process_name` against
/// [`CreditRegistrationPhase::process_name`]. Each phase loops on its own, so an hour-long call in
/// one does not hold up the others. On shutdown no phase starts another iteration, and the function
/// returns once the iterations already running have finished.
pub async fn run(
    process_name: &'static str,
    db_pool: PgPool,
    app_configuration: ApplicationConfiguration,
    still_running_message: &str,
) -> anyhow::Result<()> {
    let suotar_client = SuotarClient::new(
        &app_configuration.suotar_configuration,
        Arc::new(PgSuotarCallAudit::new(db_pool.clone())),
    );
    let ctx = PhaseContext::from_app(&db_pool, &suotar_client, &app_configuration, process_name);
    let shutdown = CancellationToken::new();
    tokio::spawn(cancel_on_termination_signal(shutdown.clone()));

    let still_running = run_periodic_worker_until(
        PeriodicWorkerConfig {
            tick_interval: Duration::from_secs(TICK_INTERVAL_SECS),
            still_running: Some(StillRunningLog {
                every: STILL_RUNNING_MESSAGE_TICKS,
                message: still_running_message,
                initial_ticks: 0,
            }),
            delay_missed_ticks: true,
        },
        &shutdown,
        async || Ok(()),
    );
    // Futures of one task rather than spawned tasks: the phase bodies are not `Send`. They only
    // need to wait on the study registry side by side, not to run in parallel.
    let phase_loops = CreditRegistrationPhase::ALL
        .into_iter()
        .filter(|phase| phase.process_name() == process_name)
        .map(|phase| run_phase_loop(&ctx, phase, &shutdown));
    let (still_running, phase_loops) =
        tokio::join!(still_running, futures::future::join_all(phase_loops));
    still_running?;
    phase_loops.into_iter().collect::<anyhow::Result<()>>()?;
    info!("{process_name} stopped.");
    Ok(())
}

async fn run_phase_loop(
    ctx: &PhaseContext<'_>,
    phase: CreditRegistrationPhase,
    shutdown: &CancellationToken,
) -> anyhow::Result<()> {
    run_periodic_worker_until(
        PeriodicWorkerConfig {
            tick_interval: Duration::from_secs(TICK_INTERVAL_SECS),
            // `run` logs one message for the whole process.
            still_running: None,
            // A slow iteration should push later ticks out, not fire them back to back (tokio's
            // default).
            delay_missed_ticks: true,
        },
        shutdown,
        async || {
            // Logged and swallowed: the phase-state row already carries the failure for the
            // dashboard, and the loop must keep going.
            if let Err(error) = run_if_due(ctx, phase).await {
                log_failure(
                    ctx.caller,
                    &format!("Credit registration phase {}", phase.as_str()),
                    &error,
                );
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
                error!("Could not listen for SIGTERM: {error}");
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

async fn run_if_due(ctx: &PhaseContext<'_>, phase: CreditRegistrationPhase) -> anyhow::Result<()> {
    let state = {
        let mut conn = ctx.pool.acquire().await?;
        credit_registration_phase_state::get_by_phase(&mut conn, phase.as_str()).await?
    };
    if !is_due(&state, Utc::now()) {
        return Ok(());
    }
    run_due_phase(ctx, phase, &state).await
}

fn log_failure(process_name: &str, subject: &str, error: &anyhow::Error) {
    error!("{subject} failed: {error}");
    if is_db_disconnect(error.source()) {
        info!("{process_name} may have lost its connection to the database.");
    }
}

/// Runs one due phase, and schedules the next run.
async fn run_due_phase(
    ctx: &PhaseContext<'_>,
    phase: CreditRegistrationPhase,
    state: &CreditRegistrationPhaseState,
) -> anyhow::Result<()> {
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

    // Always unscoped: a worker that narrowed would leave rows nobody sweeps.
    match run_phase_once(ctx, phase, &PhaseScope::default()).await? {
        PhaseTick::Ran(outcome) if outcome.items_processed > 0 || outcome.items_failed > 0 => {
            info!(
                "Credit registration phase {} processed {} rows, {} of them unsuccessfully.",
                phase.as_str(),
                outcome.items_processed,
                outcome.items_failed
            );
        }
        // Nothing to do, paused, or waiting out a cooldown: quiet on purpose, because the heartbeat
        // is what says the loop is alive.
        _ => {}
    }
    Ok(())
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
        for process in ["credit-registrar", "suotar-syncer"] {
            owned.extend(
                CreditRegistrationPhase::ALL
                    .into_iter()
                    .filter(|phase| phase.process_name() == process)
                    .map(|phase| phase.as_str()),
            );
        }
        assert_eq!(owned.len(), CreditRegistrationPhase::ALL.len());
    }
}
