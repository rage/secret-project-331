//! The worker that owns the credit registration ledger.
//!
//! One process, several phases: creating rows, moving them along, resolving enrolments, importing,
//! verifying and mirroring the successes. Each phase has its own interval and its own row in
//! `credit_registration_phase_state`, because an operator reasons about phases rather than pods.
//!
//! Every iteration goes through the same dispatcher the test tick endpoint uses, so a phase cannot
//! behave one way for a worker and another for a test.

use std::{env, sync::Arc, time::Duration};

use chrono::{DateTime, Utc};
use sqlx::PgPool;

use crate::config::program_config::ProgramConfig;
use crate::domain::credit_registration_phases::{
    CreditRegistrationPhase, PhaseContext, PhaseScope, PhaseTick, run_phase_once,
};
use crate::setup_tracing;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::credit_registration_phase_state::{
    self, CreditRegistrationPhaseState, set_next_run_at,
};
use headless_lms_models::suotar_api_calls::PgSuotarCallAudit;
use headless_lms_utils::services::suotar::SuotarClient;

const PROCESS_NAME: &str = "credit-registrar";
const TICK_INTERVAL_SECS: u64 = 10;
/// Ten minutes of ticks: often enough to tell a running worker from a stopped one in the log,
/// rarely enough to be ignorable. The per-phase heartbeat in the database is the machine-readable
/// half.
const STILL_RUNNING_MESSAGE_TICKS: u32 = 60;

pub async fn main() -> anyhow::Result<()> {
    // TODO: Audit that the environment access only happens in single-threaded code.
    unsafe { env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn") };
    dotenvy::dotenv().ok();
    setup_tracing()?;

    let db_url = ProgramConfig::database_url_with_default();
    // Fails at boot without credentials rather than idling, so a misconfigured production deploy is
    // loud instead of silently registering nobody's credits.
    let app_configuration = ApplicationConfiguration::try_from_env()?;
    let db_pool = PgPool::connect(&db_url).await?;
    let suotar_client = SuotarClient::new(
        &app_configuration.suotar_configuration,
        Arc::new(PgSuotarCallAudit::new(db_pool.clone())),
    );
    let phases: Vec<CreditRegistrationPhase> = CreditRegistrationPhase::ALL
        .into_iter()
        .filter(|phase| phase.process_name() == PROCESS_NAME)
        .collect();

    info!("Starting the credit registrar.");
    let mut interval = tokio::time::interval(Duration::from_secs(TICK_INTERVAL_SECS));
    let mut ticks = 0;
    loop {
        interval.tick().await;
        ticks += 1;
        if ticks >= STILL_RUNNING_MESSAGE_TICKS {
            ticks = 0;
            info!("Still registering credits.");
        }

        let ctx = PhaseContext {
            pool: &db_pool,
            suotar_client: &suotar_client,
            test_mode: app_configuration.test_mode,
            caller: PROCESS_NAME,
        };
        for phase in &phases {
            // Errors are logged and swallowed: one phase failing must not stop the others, and the
            // phase-state row already carries the failure for the dashboard.
            if let Err(error) = run_due_phase(&ctx, *phase).await {
                error!(
                    "Credit registration phase {} failed: {error}",
                    phase.as_str()
                );
                if let Some(sqlx::Error::Io(..)) = error
                    .source()
                    .and_then(|source| source.downcast_ref::<sqlx::Error>())
                {
                    // Usually the database being reset underneath a local development cluster.
                    info!("The credit registrar may have lost its connection to the database.");
                }
            }
        }
    }
}

/// Runs one phase if it is due, and schedules the next run.
async fn run_due_phase(
    ctx: &PhaseContext<'_>,
    phase: CreditRegistrationPhase,
) -> anyhow::Result<()> {
    let mut conn = ctx.pool.acquire().await?;
    let state = credit_registration_phase_state::get_by_phase(&mut conn, phase.as_str()).await?;
    if !is_due(&state, Utc::now()) {
        return Ok(());
    }
    // Stamped before the work, so a phase whose iteration takes longer than its interval does not
    // run back to back.
    set_next_run_at(
        &mut conn,
        phase.as_str(),
        Utc::now() + chrono::Duration::seconds(state.expected_interval_secs.into()),
    )
    .await?;
    drop(conn);

    // Always unscoped: production has no reason to narrow, and a worker that narrowed would leave
    // rows nobody sweeps.
    match run_phase_once(ctx, phase, &PhaseScope::default()).await? {
        PhaseTick::Ran(outcome) if outcome.items_processed > 0 || outcome.items_failed > 0 => {
            info!(
                "Credit registration phase {} processed {} rows, {} of them unsuccessfully.",
                phase.as_str(),
                outcome.items_processed,
                outcome.items_failed
            );
        }
        // Nothing to do, paused, waiting out a cooldown, or a phase that does not exist yet. All of
        // them are quiet on purpose: the heartbeat is what says the loop is alive.
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
            process_name: PROCESS_NAME.to_string(),
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

    /// The registrar runs its own phases only; the other six belong to the syncer.
    #[test]
    fn the_registrar_owns_seven_of_the_twelve_phases() {
        let owned: Vec<&str> = CreditRegistrationPhase::ALL
            .into_iter()
            .filter(|phase| phase.process_name() == PROCESS_NAME)
            .map(|phase| phase.as_str())
            .collect();
        assert_eq!(
            owned,
            vec![
                "materialize",
                "preconditions",
                "resolve-enrolments",
                "import",
                "verify",
                "legacy-mirror",
                "student-notifications",
            ]
        );
    }
}
