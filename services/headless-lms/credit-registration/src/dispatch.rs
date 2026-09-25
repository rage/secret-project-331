//! Running one iteration of one phase, and the bookkeeping around it: the pause and scope checks,
//! the heartbeat, the circuit breakers and the limiter.

use headless_lms_models::credit_registration_events::scrub_text;
use headless_lms_models::{
    credit_registration_phase_state::{self, PhaseRunOutcome},
    suotar_circuit_breakers, suotar_endpoint_rate_limits,
};
use headless_lms_utils::services::suotar::{SuotarCallContext, SuotarClient};
use sqlx::{PgConnection, PgPool};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

use crate::error::CreditRegistrationResult;
use crate::phase::{CreditRegistrationPhase, PhaseScope};
use crate::phases::{
    config_validation, database_phases, enrolment_discovery, import, link_emails,
    resolve_enrolments, student_notifications, verify,
};
use crate::study_registry_gate::StudyRegistryGate;
use crate::{breaker, rate_limit};

/// What one dispatch attempt did.
#[derive(Debug, Clone, PartialEq)]
pub enum PhaseTick {
    Ran(PhaseRunOutcome),
    /// The phase legitimately did nothing; not counted as a failure.
    Skipped(PhaseSkipReason),
    /// The scope names something this phase cannot narrow on; refused rather than run wide.
    ScopeNotSupported,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PhaseSkipReason {
    Paused,
    CircuitBreakerOpen,
    AccountLinkingDisabled,
}

/// Everything a phase iteration needs from its caller: the worker loop or the test tick endpoint.
pub struct PhaseContext<'a> {
    pub pool: &'a PgPool,
    pub suotar_client: &'a SuotarClient,
    /// Shortens the circuit breaker's cooldown to something a test can wait out.
    pub test_mode: bool,
    /// Goes into the audit log's `worker_name` alongside the phase.
    pub caller: &'a str,
    /// Absolute base for links in queued mail, which outlive the process that wrote them.
    pub base_url: &'a str,
    /// Holds the account-linking switch that gates the linking mails.
    pub suotar_conf: &'a headless_lms_base::config::SuotarConfiguration,
    /// The worker's SIGTERM; `None` for a run no signal can stop, such as an on-demand one.
    pub shutdown: Option<&'a CancellationToken>,
}

impl<'a> PhaseContext<'a> {
    pub(crate) fn worker_name(&self, phase: CreditRegistrationPhase) -> String {
        worker_name(self.caller, phase)
    }

    /// Builds a context from the application configuration, the shape every construction site
    /// starts from.
    pub fn from_app(
        pool: &'a PgPool,
        suotar_client: &'a SuotarClient,
        app_conf: &'a headless_lms_base::config::ApplicationConfiguration,
        caller: &'a str,
    ) -> Self {
        Self {
            pool,
            suotar_client,
            test_mode: app_conf.test_mode,
            caller,
            base_url: &app_conf.base_url,
            suotar_conf: &app_conf.suotar_configuration,
            shutdown: None,
        }
    }

    pub(crate) fn is_shutting_down(&self) -> bool {
        self.shutdown.is_some_and(CancellationToken::is_cancelled)
    }
}

/// The audit log's `worker_name`, which the database caps at 64 characters.
pub(crate) fn worker_name(caller: &str, phase: CreditRegistrationPhase) -> String {
    format!("{caller}/{}", phase.as_str())
}

/// Runs exactly one iteration of one phase.
pub async fn run_phase_once(
    ctx: &PhaseContext<'_>,
    phase: CreditRegistrationPhase,
    scope: &PhaseScope,
) -> CreditRegistrationResult<PhaseTick> {
    // Before the pause check: a caller whose narrowing cannot be honoured must not be told it ran.
    if !phase.spec().scope.covers(scope) {
        return Ok(PhaseTick::ScopeNotSupported);
    }
    let mut conn = ctx.pool.acquire().await?;
    if credit_registration_phase_state::is_paused(&mut conn, phase.as_str()).await? {
        return Ok(PhaseTick::Skipped(PhaseSkipReason::Paused));
    }
    // A scoped run writes nothing to the phase-state row: that row describes the workers, and a
    // test's traffic in it would make a dead worker look alive to the heartbeat alert.
    let bookkeeping = scope.is_unscoped();
    // The breakers and the limiter live in the running process's memory, so only the phase's own
    // worker holds the state the dashboard shows; a run-tick in the web server holds its own.
    let is_own_worker = ctx.caller == phase.spec().process.as_str();
    // Before the breaker check, unlike the pause above, which health.rs excludes from the staleness
    // alert by itself. A cooldown is a worker deliberately waiting, not a worker that died, and
    // skipping the heartbeat through it would raise a critical alert within a tick or two.
    if bookkeeping {
        credit_registration_phase_state::heartbeat(&mut conn, phase.as_str()).await?;
    }
    // After the heartbeat, like the breaker check below: a switched-off phase is idle, not dead.
    if phase.spec().is_account_linking_only && !ctx.suotar_conf.account_linking_enabled {
        return Ok(PhaseTick::Skipped(PhaseSkipReason::AccountLinkingDisabled));
    }
    let registry = match StudyRegistryGate::admit(phase, scope, ctx.test_mode) {
        Ok(registry) => registry,
        Err(skip) => {
            if bookkeeping && is_own_worker {
                record_breakers(&mut conn, phase).await?;
            }
            return Ok(PhaseTick::Skipped(skip));
        }
    };
    drop(conn);

    let mut it = Iteration {
        ctx,
        phase,
        scope,
        registry,
    };
    let keep_alive = bookkeeping.then(|| KeepAlive::spawn(ctx.pool, phase));
    let body = run_body(&mut it).await;
    drop(keep_alive);
    let failure = it.registry.settle();
    let outcome = match body {
        Ok(counts) => PhaseRunOutcome {
            items_processed: counts.processed,
            items_failed: counts.failed,
            error: failure.or(counts.finding),
        },
        Err(error) => PhaseRunOutcome {
            error: Some(scrub_text(&error.cause_chain())),
            ..PhaseRunOutcome::default()
        },
    };
    if let Some(error) = &outcome.error {
        error!(phase = phase.as_str(), error = %error, "Credit registration phase failed");
    }
    if bookkeeping {
        let mut conn = ctx.pool.acquire().await?;
        credit_registration_phase_state::record_run(&mut conn, phase.as_str(), &outcome).await?;
        if is_own_worker {
            record_rate_limits(&mut conn, phase).await?;
            record_breakers(&mut conn, phase).await?;
        }
    }
    Ok(PhaseTick::Ran(outcome))
}

/// The one place a phase implementation is registered: exhaustive over [`CreditRegistrationPhase`],
/// so a variant added there without an arm here fails to compile.
async fn run_body(it: &mut Iteration<'_>) -> CreditRegistrationResult<Counts> {
    match it.phase {
        CreditRegistrationPhase::Materialize => database_phases::run_materialize(it).await,
        CreditRegistrationPhase::Preconditions => database_phases::run_preconditions(it).await,
        CreditRegistrationPhase::ResolveEnrolments => resolve_enrolments::run(it).await,
        CreditRegistrationPhase::Import => import::run(it).await,
        CreditRegistrationPhase::Verify => verify::run(it).await,
        CreditRegistrationPhase::LegacyMirror => database_phases::run_legacy_mirror(it).await,
        CreditRegistrationPhase::StudentNotifications => student_notifications::run(it).await,
        CreditRegistrationPhase::EnrolmentDiscovery => enrolment_discovery::run(it).await,
        CreditRegistrationPhase::LinkEmails => link_emails::run(it).await,
        CreditRegistrationPhase::ConfigValidation => config_validation::run(it).await,
        CreditRegistrationPhase::RetentionSweep => database_phases::run_retention_sweep(it).await,
        CreditRegistrationPhase::LedgerSnapshot => database_phases::run_ledger_snapshot(it).await,
    }
}

/// What a phase body gets: the caller's context, the phase and scope it runs for, and the gate
/// every Suotar request of the iteration goes through.
pub(crate) struct Iteration<'a> {
    pub ctx: &'a PhaseContext<'a>,
    pub phase: CreditRegistrationPhase,
    pub scope: &'a PhaseScope,
    pub registry: StudyRegistryGate,
}

impl Iteration<'_> {
    /// The call context of a request this iteration sends, naming it in the audit log.
    pub fn call_context(&self) -> SuotarCallContext {
        SuotarCallContext::new(self.ctx.worker_name(self.phase))
    }
}

/// What a phase body did. Composite phases add up their flows' counts with `+=`.
#[derive(Debug, Default)]
pub(crate) struct Counts {
    /// The rows, or modules, the iteration wrote a decision for.
    pub processed: i32,
    /// How many of `processed` ended up carrying an error code.
    pub failed: i32,
    /// Something the phase found wrong that failed no row, such as a missing mail template: the
    /// iteration's error when no request failed.
    pub finding: Option<String>,
}

impl Counts {
    /// A clean iteration that moved `count` rows; saturating, so an over-large sweep never reaches
    /// the dashboard as negative throughput.
    pub fn processed(count: i64) -> Self {
        Self {
            processed: count.try_into().unwrap_or(i32::MAX),
            ..Self::default()
        }
    }
}

impl std::ops::AddAssign for Counts {
    fn add_assign(&mut self, other: Self) {
        self.processed += other.processed;
        self.failed += other.failed;
        self.finding = self.finding.take().or(other.finding);
    }
}

/// Copies the state of the breakers that pause the phase to the database for the dashboard, which
/// runs in another process.
async fn record_breakers(
    conn: &mut PgConnection,
    phase: CreditRegistrationPhase,
) -> CreditRegistrationResult<()> {
    let spec = phase.spec();
    for &target in spec.breakers {
        let breaker = breaker::snapshot(&breaker::ScopeKey::Global, target);
        suotar_circuit_breakers::upsert(
            conn,
            &suotar_circuit_breakers::SuotarCircuitBreakerReport {
                process_name: spec.process.as_str(),
                target,
                consecutive_failures: i32::try_from(breaker.consecutive_failures)
                    .unwrap_or(i32::MAX),
                open_until: breaker.open_until,
                trip_count: i32::try_from(breaker.trip_count).unwrap_or(i32::MAX),
            },
        )
        .await?;
    }
    Ok(())
}

/// Copies the limiter state of the phase's endpoints to the database for the dashboard, which runs
/// in another process.
async fn record_rate_limits(
    conn: &mut PgConnection,
    phase: CreditRegistrationPhase,
) -> CreditRegistrationResult<()> {
    for &endpoint in phase.spec().endpoints {
        let Some(limiter) = rate_limit::snapshot(&breaker::ScopeKey::Global, endpoint) else {
            continue;
        };
        suotar_endpoint_rate_limits::upsert(
            conn,
            &suotar_endpoint_rate_limits::SuotarEndpointRateLimitReport {
                endpoint,
                rate_share: limiter.share as f32,
                full_rate_per_minute: limiter.rate.per_minute as i32,
                available: i32::try_from(limiter.available).unwrap_or(i32::MAX),
            },
        )
        .await?;
    }
    Ok(())
}

/// How often a running iteration refreshes its heartbeat. Under half the shortest phase interval,
/// so even the 10-second phases never read as stale mid-call.
const KEEP_ALIVE_INTERVAL: Duration = Duration::from_secs(5);

/// Refreshes one phase's heartbeat until dropped, so a long study registry call does not raise the
/// stale-worker alert.
struct KeepAlive(tokio::task::JoinHandle<()>);

impl KeepAlive {
    fn spawn(pool: &PgPool, phase: CreditRegistrationPhase) -> Self {
        let pool = pool.clone();
        Self(tokio::spawn(async move {
            let mut ticks = tokio::time::interval(KEEP_ALIVE_INTERVAL);
            ticks.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
            // The first tick is immediate, and the iteration has just heartbeated.
            ticks.tick().await;
            loop {
                ticks.tick().await;
                let refreshed = async {
                    let mut conn = pool.acquire().await?;
                    credit_registration_phase_state::keep_alive(&mut conn, phase.as_str()).await?;
                    CreditRegistrationResult::Ok(())
                }
                .await;
                if let Err(error) = refreshed {
                    warn!(
                        "Refreshing the heartbeat of credit registration phase {} failed: {error:#}",
                        phase.as_str()
                    );
                }
            }
        }))
    }
}

impl Drop for KeepAlive {
    fn drop(&mut self) {
        self.0.abort();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::phase::WorkerProcess;

    #[test]
    fn the_audit_name_says_who_ran_the_phase() {
        for caller in [WorkerProcess::CreditRegistrar.as_str(), "run-tick"] {
            for phase in CreditRegistrationPhase::ALL {
                let name = worker_name(caller, phase);
                assert!(name.starts_with(caller));
                assert!(name.ends_with(phase.as_str()));
                assert!(name.len() <= 64, "{name}");
            }
        }
    }
}
