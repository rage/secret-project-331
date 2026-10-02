//! Running one iteration of one phase, and the bookkeeping around it: the pause and scope checks,
//! the heartbeat, the circuit breakers and the limiter.

use chrono::TimeDelta;
use headless_lms_models::credit_registration_phase_state::{self, PhaseRunOutcome};
use headless_lms_models::library::credit_registration::scrub::scrub_text;
use headless_lms_utils::services::suotar::SuotarClient;
use sqlx::PgPool;
use tokio_util::sync::CancellationToken;

use super::heartbeat::keep_alive;
use super::suotar::{
    SuotarStudyRegistry, max_study_registry_wait, report_breakers, report_rate_limits,
};
use crate::error::CreditRegistrationResult;
use crate::error_reports::ErrorReporter;
use crate::phase::{CreditRegistrationPhase, WorkerProcess};
use crate::use_cases::batch_flow::BatchFlowContext;
use crate::use_cases::{
    config_validation, enrolment_discovery, import, ledger_snapshot, legacy_mirror, link_emails,
    materialize, preconditions, resolve_enrolments, retention_sweep, student_notifications, verify,
};
use crate::workflow::Counts;
use headless_lms_models::credit_registrations::RegistrationScope;

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

/// Who runs a phase iteration.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Runner<'a> {
    /// A worker process's loop, the only holder of the breaker and limiter state the dashboard
    /// shows for the phases it owns.
    Worker(WorkerProcess),
    /// Anyone else, such as the test tick endpoint, named for the audit log. Its in-memory state
    /// would overwrite the worker's on the dashboard, so it reports none.
    Other(&'a str),
}

impl Runner<'_> {
    /// What goes into the audit log's `worker_name` alongside the phase.
    pub fn caller(&self) -> &str {
        match self {
            Self::Worker(process) => process.as_str(),
            Self::Other(caller) => caller,
        }
    }

    pub fn owning_process(&self) -> Option<WorkerProcess> {
        match self {
            Self::Worker(process) => Some(*process),
            Self::Other(_) => None,
        }
    }
}

/// Everything a phase iteration needs from its caller: the worker loop or the test tick endpoint.
pub struct PhaseContext<'a> {
    pub pool: &'a PgPool,
    pub suotar_client: &'a SuotarClient,
    /// Shortens the circuit breaker's cooldown to something a test can wait out.
    pub test_mode: bool,
    pub runner: Runner<'a>,
    /// Absolute base for links in queued mail, which outlive the process that wrote them.
    pub base_url: &'a str,
    /// Off, the linking mails are not sent, and discovery only wakes linked students' registrations.
    pub is_account_linking_enabled: bool,
    /// The worker's SIGTERM; `None` for a run no signal can stop, such as an on-demand one.
    pub shutdown: Option<&'a CancellationToken>,
}

impl<'a> PhaseContext<'a> {
    /// Builds a context from the application configuration, the shape every construction site
    /// starts from.
    pub fn from_app(
        pool: &'a PgPool,
        suotar_client: &'a SuotarClient,
        app_conf: &'a headless_lms_base::config::ApplicationConfiguration,
        runner: Runner<'a>,
    ) -> Self {
        Self {
            pool,
            suotar_client,
            test_mode: app_conf.test_mode,
            runner,
            base_url: &app_conf.base_url,
            is_account_linking_enabled: app_conf.suotar_configuration.account_linking_enabled,
            shutdown: None,
        }
    }
}

/// The audit log's `worker_name`, which the database caps at 64 characters.
pub(super) fn worker_name(caller: &str, phase: CreditRegistrationPhase) -> String {
    format!("{caller}/{}", phase.as_str())
}

/// Runs exactly one iteration of one phase.
#[tracing::instrument(
    skip_all,
    fields(phase = phase.as_str(), caller = ctx.runner.caller(), scope = ?scope)
)]
pub async fn run_phase_once(
    ctx: &PhaseContext<'_>,
    phase: CreditRegistrationPhase,
    scope: &RegistrationScope,
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
    let is_own_worker = ctx.runner.owning_process() == Some(phase.spec().process);
    // Before the breaker check, unlike the pause above, which health.rs excludes from the staleness
    // alert by itself. A cooldown is a worker deliberately waiting, not a worker that died, and
    // skipping the heartbeat through it would raise a critical alert within a tick or two.
    if bookkeeping {
        credit_registration_phase_state::heartbeat(&mut conn, phase.as_str()).await?;
        trace!(phase = phase.as_str(), "Wrote phase heartbeat");
    }
    // After the heartbeat, like the breaker check below: a switched-off phase is idle, not dead.
    if phase.spec().is_account_linking_only && !ctx.is_account_linking_enabled {
        return Ok(PhaseTick::Skipped(PhaseSkipReason::AccountLinkingDisabled));
    }
    let mut registry = match SuotarStudyRegistry::admit(
        ctx.suotar_client,
        worker_name(ctx.runner.caller(), phase),
        phase,
        scope,
        ctx.test_mode,
    ) {
        Ok(registry) => registry,
        Err(skip) => {
            if bookkeeping && is_own_worker {
                report_breakers(&mut conn, phase).await?;
            }
            return Ok(PhaseTick::Skipped(skip));
        }
    };
    drop(conn);

    let body = if bookkeeping {
        tokio::select! {
            body = run_body(ctx, phase, scope, &mut registry) => body,
            never = keep_alive(ctx.pool, phase) => match never {},
        }
    } else {
        run_body(ctx, phase, scope, &mut registry).await
    };
    let failure = registry.finish();
    // Only a real `CreditRegistrationError` carries a backtrace and span trace; `failure` and
    // `counts.finding` are already plain messages.
    let stack_trace = match &body {
        Err(error) => Some(format!("{error:?}")),
        Ok(_) => None,
    };
    let outcome = match body {
        Ok(counts) => {
            let outcome = PhaseRunOutcome {
                items_processed: counts.processed_count(),
                items_waiting: counts.waiting_count(),
                items_failed: counts.failed_count(),
                error: failure.or(counts.into_finding()),
            };
            if let Some(error) = &outcome.error {
                warn!(phase = phase.as_str(), error = %error, "Credit registration phase iteration recorded a failure");
            }
            outcome
        }
        Err(error) => {
            error!(phase = phase.as_str(), error = %error, "Credit registration phase iteration aborted");
            PhaseRunOutcome {
                error: Some(scrub_text(&error.cause_chain())),
                ..PhaseRunOutcome::default()
            }
        }
    };
    if let Some(error) = &outcome.error {
        ErrorReporter::new(ctx.pool, ctx.runner.owning_process(), phase)
            .report(error, stack_trace, serde_json::json!({}))
            .await;
    }
    if bookkeeping {
        let mut conn = ctx.pool.acquire().await?;
        credit_registration_phase_state::record_run(&mut conn, phase.as_str(), &outcome).await?;
        if is_own_worker {
            report_rate_limits(&mut conn, phase).await?;
            report_breakers(&mut conn, phase).await?;
        }
    }
    Ok(PhaseTick::Ran(outcome))
}

/// The one place a phase implementation is registered: exhaustive over [`CreditRegistrationPhase`],
/// so a variant added there without an arm here fails to compile. Each phase gets only what it
/// touches, and a phase that asks the study registry gets the iteration's registry beside it.
async fn run_body(
    ctx: &PhaseContext<'_>,
    phase: CreditRegistrationPhase,
    scope: &RegistrationScope,
    registry: &mut SuotarStudyRegistry<'_>,
) -> CreditRegistrationResult<Counts> {
    let pool = ctx.pool;
    let batch_flow = BatchFlowContext {
        pool,
        scope,
        phase,
        errors: ErrorReporter::new(pool, ctx.runner.owning_process(), phase),
        shutdown: ctx.shutdown,
        // Request timeouts are minutes, far inside the range.
        study_registry_wait: TimeDelta::from_std(max_study_registry_wait(phase))
            .unwrap_or(TimeDelta::zero()),
    };
    match phase {
        CreditRegistrationPhase::Materialize => materialize::run(pool, scope).await,
        CreditRegistrationPhase::Preconditions => preconditions::run(pool, scope).await,
        CreditRegistrationPhase::ResolveEnrolments => {
            resolve_enrolments::run(&batch_flow, registry).await
        }
        CreditRegistrationPhase::Import => import::run(&batch_flow, registry).await,
        CreditRegistrationPhase::Verify => verify::run(&batch_flow, registry).await,
        CreditRegistrationPhase::LegacyMirror => legacy_mirror::run(pool, scope).await,
        CreditRegistrationPhase::StudentNotifications => {
            student_notifications::run(pool, scope, ctx.base_url).await
        }
        CreditRegistrationPhase::EnrolmentDiscovery => {
            enrolment_discovery::run(pool, scope, ctx.is_account_linking_enabled, registry).await
        }
        CreditRegistrationPhase::LinkEmails => link_emails::run(pool, scope, ctx.base_url).await,
        CreditRegistrationPhase::ConfigValidation => {
            config_validation::run(pool, scope, registry).await
        }
        CreditRegistrationPhase::RetentionSweep => retention_sweep::run(pool).await,
        CreditRegistrationPhase::LedgerSnapshot => ledger_snapshot::run(pool).await,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
