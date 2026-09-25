//! Running one iteration of one phase, and the bookkeeping around it: the pause and scope checks,
//! the heartbeat, the circuit breakers and the limiter.

use headless_lms_models::credit_registration_events::scrub_text;
use headless_lms_models::{
    credit_registration_phase_state::{self, PhaseErrorKind, PhaseRunOutcome},
    suotar_endpoint_rate_limits,
};
use headless_lms_utils::services::suotar::{SuotarClient, SuotarEndpoint};
use sqlx::{PgConnection, PgPool};
use std::future::Future;
use std::pin::Pin;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

use crate::error::CreditRegistrationResult;
use crate::phase::{CreditRegistrationPhase, PhaseScope};
use crate::phases::{
    config_validation, database_phases, enrolment_discovery, import, link_emails,
    resolve_enrolments, student_notifications, verify,
};
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

/// Runs exactly one iteration of one phase. The match below is the only place a phase
/// implementation is registered; it is exhaustive over [`CreditRegistrationPhase`], so a variant
/// added there without a dispatch arm here fails to compile.
pub async fn run_phase_once(
    ctx: &PhaseContext<'_>,
    phase: CreditRegistrationPhase,
    scope: &PhaseScope,
) -> CreditRegistrationResult<PhaseTick> {
    // Before the pause check: a caller whose narrowing cannot be honoured must not be told it ran.
    if !phase.scope_support().covers(scope) {
        return Ok(PhaseTick::ScopeNotSupported);
    }
    let mut conn = ctx.pool.acquire().await?;
    if credit_registration_phase_state::is_paused(&mut conn, phase.as_str()).await? {
        return Ok(PhaseTick::Skipped(PhaseSkipReason::Paused));
    }
    // A scoped run writes nothing to the phase-state row: that row describes the workers, and a
    // test's traffic in it would make a dead worker look alive to the heartbeat alert.
    let bookkeeping = scope.is_unscoped();
    // Before the breaker check, unlike the pause above, which health.rs excludes from the staleness
    // alert by itself. A cooldown is a worker deliberately waiting, not a worker that died, and
    // skipping the heartbeat through it would raise a critical alert within a tick or two.
    if bookkeeping {
        credit_registration_phase_state::heartbeat(&mut conn, phase.as_str()).await?;
    }
    // After the heartbeat, like the breaker below: a switched-off phase is idle, not dead.
    if phase.is_account_linking_only() && !ctx.suotar_conf.account_linking_enabled {
        return Ok(PhaseTick::Skipped(PhaseSkipReason::AccountLinkingDisabled));
    }
    let breaker_key = breaker::ScopeKey::of(scope);
    let is_paused_by_breaker =
        breaker::is_open(&breaker_key, breaker::BreakerTarget::StudyRegistry)
            || (phase.submits_to_sisu()
                && breaker::is_open(&breaker_key, breaker::BreakerTarget::SisuSubmissions));
    if phase.calls_study_registry() && is_paused_by_breaker {
        // Only these stop: an outage must not stall the database-only phases.
        return Ok(PhaseTick::Skipped(PhaseSkipReason::CircuitBreakerOpen));
    }
    drop(conn);

    // The phase loops run side by side, so a shared count would credit this iteration with another
    // phase's requests.
    let suotar_client = ctx.suotar_client.with_own_exchange_count();
    let ctx = &PhaseContext {
        suotar_client: &suotar_client,
        ..*ctx
    };
    let body: Pin<Box<dyn Future<Output = CreditRegistrationResult<PhaseRunOutcome>> + '_>> =
        match phase {
            CreditRegistrationPhase::Materialize => {
                Box::pin(database_phases::run_materialize(ctx, scope))
            }
            CreditRegistrationPhase::Preconditions => {
                Box::pin(database_phases::run_preconditions(ctx, scope))
            }
            CreditRegistrationPhase::ResolveEnrolments => {
                Box::pin(resolve_enrolments::run(ctx, scope))
            }
            CreditRegistrationPhase::Import => Box::pin(import::run(ctx, scope)),
            CreditRegistrationPhase::Verify => Box::pin(verify::run(ctx, scope)),
            CreditRegistrationPhase::LegacyMirror => {
                Box::pin(database_phases::run_legacy_mirror(ctx, scope))
            }
            CreditRegistrationPhase::StudentNotifications => {
                Box::pin(student_notifications::run(ctx, scope))
            }
            CreditRegistrationPhase::EnrolmentDiscovery => {
                Box::pin(enrolment_discovery::run(ctx, scope))
            }
            CreditRegistrationPhase::LinkEmails => Box::pin(link_emails::run(ctx, scope)),
            CreditRegistrationPhase::ConfigValidation => {
                Box::pin(config_validation::run(ctx, scope))
            }
            CreditRegistrationPhase::RetentionSweep => {
                Box::pin(database_phases::run_retention_sweep(ctx, scope))
            }
            CreditRegistrationPhase::LedgerSnapshot => {
                Box::pin(database_phases::run_ledger_snapshot(ctx, scope))
            }
        };

    let keep_alive = bookkeeping.then(|| KeepAlive::spawn(ctx.pool, phase));
    let outcome = match body.await {
        Ok(outcome) => outcome,
        Err(error) => PhaseRunOutcome {
            error: Some(scrub_text(&format!("{error:#}"))),
            ..PhaseRunOutcome::default()
        },
    };
    drop(keep_alive);
    if let Some(error) = &outcome.error {
        error!(phase = phase.as_str(), error = %error, "Credit registration phase failed");
    }
    // An iteration that never sent a request says nothing about whether the study registry is up,
    // so it must neither count against the breaker nor clear a run of failures. Phases share one
    // breaker, and an empty queue is the common case: without this, a phase with nothing to do
    // resets the counter every tick and the breaker never opens during an outage.
    let reached_study_registry = suotar_client.exchange_count() > 0;
    if phase.calls_study_registry() && reached_study_registry {
        record_breaker_outcome(&breaker_key, phase, &outcome, ctx.test_mode);
    }
    if bookkeeping {
        let mut conn = ctx.pool.acquire().await?;
        credit_registration_phase_state::record_run(&mut conn, phase.as_str(), &outcome).await?;
        record_rate_limits(&mut conn, phase).await?;
    }
    Ok(PhaseTick::Ran(outcome))
}

/// Copies the limiter and breaker state of the phase's endpoints to the database for the
/// dashboard, which runs in another process.
async fn record_rate_limits(
    conn: &mut PgConnection,
    phase: CreditRegistrationPhase,
) -> CreditRegistrationResult<()> {
    let breaker = breaker::snapshot(
        &breaker::ScopeKey::Global,
        breaker::BreakerTarget::StudyRegistry,
    );
    for &endpoint in phase.study_registry_endpoints() {
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
                is_breaker_open: breaker.open,
                breaker_trip_count: i32::try_from(breaker.trip_count).unwrap_or(i32::MAX),
            },
        )
        .await?;
    }
    Ok(())
}

/// How many items one request to `endpoint` may carry: its batch size, cut to what the limiter
/// allows, and to a single item for the probe after a breaker cooldown.
pub(crate) fn claim_limit(key: &breaker::ScopeKey, endpoint: SuotarEndpoint) -> usize {
    if breaker::is_half_open(key, breaker::BreakerTarget::StudyRegistry) {
        debug!(
            ?endpoint,
            "Study registry breaker is half-open; probing with one item"
        );
        return 1;
    }
    let limit = endpoint
        .max_batch_size()
        .min(rate_limit::available(key, endpoint));
    debug!(
        ?endpoint,
        limit, "Computed the claim limit for a Suotar endpoint"
    );
    limit
}

/// Counts one iteration that reached the study registry against the breakers. Sisu timing out on
/// every submission is Suotar answering, so it counts against the submitting phase's own breaker
/// and as a success for the one every study registry phase shares.
///
/// The limiter drops to its floor whenever the shared breaker trips or closes again, so the ramp
/// back starts from the probe that got through rather than from a failure a long cooldown ago.
fn record_breaker_outcome(
    key: &breaker::ScopeKey,
    phase: CreditRegistrationPhase,
    outcome: &PhaseRunOutcome,
    test_mode: bool,
) {
    use breaker::BreakerTarget;
    let base_cooldown = breaker::cooldown(test_mode);
    if outcome.error.is_none() {
        record_study_registry_success(key);
        if phase.submits_to_sisu() && breaker::record_success(key, BreakerTarget::SisuSubmissions) {
            info!(
                phase = phase.as_str(),
                "Sisu submissions circuit breaker closed"
            );
        }
        return;
    }
    match outcome.error_kind {
        PhaseErrorKind::Isolated => {}
        PhaseErrorKind::SisuOutage => {
            record_study_registry_success(key);
            if let Some(cooldown) =
                breaker::record_failure(key, BreakerTarget::SisuSubmissions, base_cooldown)
            {
                warn!(
                    phase = phase.as_str(),
                    cooldown_secs = cooldown.as_secs(),
                    consecutive_failures = breaker::MAX_CONSECUTIVE_SUOTAR_FAILURES,
                    "Pausing phase after consecutive Sisu timeouts"
                );
            }
        }
        PhaseErrorKind::StudyRegistry => {
            if let Some(cooldown) =
                breaker::record_failure(key, BreakerTarget::StudyRegistry, base_cooldown)
            {
                rate_limit::drop_to_floor(key, &rate_limit::LIMITED_ENDPOINTS);
                warn!(
                    phase = phase.as_str(),
                    cooldown_secs = cooldown.as_secs(),
                    consecutive_failures = breaker::MAX_CONSECUTIVE_SUOTAR_FAILURES,
                    "Pausing study registry phases after consecutive failures"
                );
            }
        }
    }
}

fn record_study_registry_success(key: &breaker::ScopeKey) {
    if breaker::record_success(key, breaker::BreakerTarget::StudyRegistry) {
        rate_limit::drop_to_floor(key, &rate_limit::LIMITED_ENDPOINTS);
        info!("Study registry circuit breaker closed");
    }
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

    #[test]
    fn the_audit_name_says_who_ran_the_phase() {
        for caller in ["credit-registrar", "run-tick"] {
            for phase in CreditRegistrationPhase::ALL {
                let name = worker_name(caller, phase);
                assert!(name.starts_with(caller));
                assert!(name.ends_with(phase.as_str()));
                assert!(name.len() <= 64, "{name}");
            }
        }
    }
}
