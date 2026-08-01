//! The twelve credit-registration pipeline phases and the one-iteration dispatcher.
//!
//! Phases, not worker processes, are the unit of observation and control: the dashboard lists them,
//! `credit_registration_phase_state` heartbeats them, and the system tests tick them individually.
//! Both the worker loops and the test tick endpoint go through [`run_phase_once`], so a phase cannot
//! behave differently depending on who ran it.

pub mod breaker;
mod import;
mod legacy_mirror;
mod materialize;
mod preconditions;
mod resolve_enrolments;
mod verify;

use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::credit_registration_events::{
    CreditRegistrationEventKind, scrub_text, suotar_exchange_details,
};
use headless_lms_models::credit_registrations::{CreditRegistration, Transition};
use headless_lms_models::library::credit_registration::classification::{
    is_retryable_transient_wire_code, next_attempt_at,
};
use headless_lms_models::library::credit_registration::outcomes::{
    Outcome, RowFacts, request_level_outcome,
};
use headless_lms_models::suotar_api_calls::SuotarEndpoint as SuotarApiEndpoint;
use headless_lms_models::{credit_registration_phase_state, credit_registrations};
use headless_lms_models::{
    credit_registration_phase_state::PhaseRunOutcome, verified_student_numbers,
};
use headless_lms_utils::error::util_error::{SuotarErrorVariant, UtilError, UtilErrorType};
use headless_lms_utils::prelude::Utc;
use headless_lms_utils::services::suotar::{SuotarBatchResponse, SuotarClient, SuotarItemStatus};
use sqlx::{PgConnection, PgPool};
use std::future::Future;
use std::pin::Pin;
use uuid::Uuid;

/// Which rows one iteration may touch. The state machine owns it, because the narrowing is one
/// predicate on the claim query the workers already use.
pub use headless_lms_models::credit_registrations::RegistrationScope as PhaseScope;

/// A pipeline phase. The string forms are canonical: `credit_registration_phase_state.phase`, the
/// tick endpoint's `?phase=`, the dashboard's Workers tab labels and the audit log's `target_phase`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CreditRegistrationPhase {
    Materialize,
    Preconditions,
    ResolveEnrolments,
    Import,
    Verify,
    LegacyMirror,
    StudentNotifications,
    EnrolmentDiscovery,
    LinkEmails,
    ProductTokenRefresh,
    ConfigValidation,
    RetentionSweep,
}

impl CreditRegistrationPhase {
    /// Every phase, in pipeline order.
    pub const ALL: [Self; 12] = [
        Self::Materialize,
        Self::Preconditions,
        Self::ResolveEnrolments,
        Self::Import,
        Self::Verify,
        Self::LegacyMirror,
        Self::StudentNotifications,
        Self::EnrolmentDiscovery,
        Self::LinkEmails,
        Self::ProductTokenRefresh,
        Self::ConfigValidation,
        Self::RetentionSweep,
    ];

    /// The phases `run-registrar-tick` runs, in pipeline order.
    ///
    /// Not every `credit-registrar` phase: `legacy-mirror` and `student-notifications` are
    /// after-effects a spec drives explicitly when it cares about them.
    pub const REGISTRAR_TICK_SEQUENCE: [Self; 5] = [
        Self::Materialize,
        Self::Preconditions,
        Self::ResolveEnrolments,
        Self::Import,
        Self::Verify,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Materialize => "materialize",
            Self::Preconditions => "preconditions",
            Self::ResolveEnrolments => "resolve-enrolments",
            Self::Import => "import",
            Self::Verify => "verify",
            Self::LegacyMirror => "legacy-mirror",
            Self::StudentNotifications => "student-notifications",
            Self::EnrolmentDiscovery => "enrolment-discovery",
            Self::LinkEmails => "link-emails",
            Self::ProductTokenRefresh => "product-token-refresh",
            Self::ConfigValidation => "config-validation",
            Self::RetentionSweep => "retention-sweep",
        }
    }

    pub fn from_phase_name(name: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|phase| phase.as_str() == name)
    }

    /// Which worker process owns the phase's loop.
    pub fn process_name(self) -> &'static str {
        match self {
            Self::Materialize
            | Self::Preconditions
            | Self::ResolveEnrolments
            | Self::Import
            | Self::Verify
            | Self::LegacyMirror
            | Self::StudentNotifications => "credit-registrar",
            Self::EnrolmentDiscovery
            | Self::LinkEmails
            | Self::ProductTokenRefresh
            | Self::ConfigValidation
            | Self::RetentionSweep => "suotar-syncer",
        }
    }

    /// Whether the phase talks to the study registry, and so shares the circuit breaker.
    pub fn calls_study_registry(self) -> bool {
        matches!(
            self,
            Self::ResolveEnrolments
                | Self::Import
                | Self::Verify
                | Self::EnrolmentDiscovery
                | Self::ProductTokenRefresh
        )
    }

    /// Which scope dimensions this phase's claim query can narrow on.
    pub fn scope_support(self) -> ScopeSupport {
        match self {
            // These five claim ledger rows, which carry the course, the user and their own id.
            Self::Preconditions
            | Self::ResolveEnrolments
            | Self::Import
            | Self::Verify
            | Self::LegacyMirror => ScopeSupport::LEDGER,
            // No ledger row exists yet, so there is no registration id to narrow on.
            Self::Materialize => ScopeSupport {
                course: true,
                user: true,
                registration_ids: false,
            },
            // Not implemented yet; each reaches its rows through the module rather than the ledger,
            // and its author sets this when the phase lands.
            Self::StudentNotifications
            | Self::EnrolmentDiscovery
            | Self::LinkEmails
            | Self::ProductTokenRefresh
            | Self::ConfigValidation
            | Self::RetentionSweep => ScopeSupport::NONE,
        }
    }
}

/// Which of the scope's dimensions a phase's claim query can apply.
///
/// A declaration rather than a convention, so a phase added later cannot quietly ignore a scope and
/// sweep the whole database while a test believes it narrowed the run.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScopeSupport {
    pub course: bool,
    pub user: bool,
    pub registration_ids: bool,
}

impl ScopeSupport {
    /// A phase that cannot narrow on anything. Also how the phases still to be built are declared.
    pub const NONE: Self = Self {
        course: false,
        user: false,
        registration_ids: false,
    };
    /// The five phases that claim ledger rows, which carry all three keys themselves.
    pub const LEDGER: Self = Self {
        course: true,
        user: true,
        registration_ids: true,
    };

    fn covers(self, scope: &PhaseScope) -> bool {
        let requested_unsupported = (scope.course_id.is_some() && !self.course)
            || (scope.user_id.is_some() && !self.user)
            || (!scope.credit_registration_ids.is_empty() && !self.registration_ids);
        !requested_unsupported
    }
}

/// What one dispatch attempt did.
#[derive(Debug, Clone, PartialEq)]
pub enum PhaseTick {
    Ran(PhaseRunOutcome),
    /// The phase legitimately did nothing. Not a failure, and not counted as one.
    Skipped(PhaseSkipReason),
    /// The scope names something this phase cannot narrow on. Refused rather than run wide, because
    /// a caller that asked to be narrowed and was not gets a silently wrong answer.
    ScopeNotSupported,
    NotImplemented,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PhaseSkipReason {
    Paused,
    CircuitBreakerOpen,
}

/// Everything a phase iteration needs from its caller: the worker loop or the test tick endpoint.
pub struct PhaseContext<'a> {
    pub pool: &'a PgPool,
    pub suotar_client: &'a SuotarClient,
    /// Shortens the circuit breaker's cooldown to something a test can wait out. A timing constant,
    /// not a behaviour branch.
    pub test_mode: bool,
    /// Goes into the audit log's `worker_name` alongside the phase, so a call made by a test tick is
    /// distinguishable from one the worker made.
    pub caller: &'a str,
}

impl PhaseContext<'_> {
    pub(crate) fn worker_name(&self, phase: CreditRegistrationPhase) -> String {
        worker_name(self.caller, phase)
    }
}

/// The audit log's `worker_name`, which the database caps at 64 characters.
pub(crate) fn worker_name(caller: &str, phase: CreditRegistrationPhase) -> String {
    format!("{caller}/{}", phase.as_str())
}

/// Runs exactly one iteration of one phase.
///
/// The match below is the single place a phase implementation is registered: the tick endpoint, the
/// worker loops and the dashboard all run phases through here.
pub async fn run_phase_once(
    ctx: &PhaseContext<'_>,
    phase: CreditRegistrationPhase,
    scope: &PhaseScope,
) -> anyhow::Result<PhaseTick> {
    // Before anything else, including the pause check: a caller whose narrowing cannot be honoured
    // must not be told the phase ran.
    if !phase.scope_support().covers(scope) {
        return Ok(PhaseTick::ScopeNotSupported);
    }
    // Registered here and nowhere else. Built before the guards below and awaited after them, so a
    // phase that does not exist yet costs no database connection and a paused one runs nothing: a
    // future that is never polled does nothing.
    let body: Pin<Box<dyn Future<Output = anyhow::Result<PhaseRunOutcome>> + '_>> = match phase {
        CreditRegistrationPhase::Materialize => Box::pin(materialize::run(ctx, scope)),
        CreditRegistrationPhase::Preconditions => Box::pin(preconditions::run(ctx, scope)),
        CreditRegistrationPhase::ResolveEnrolments => Box::pin(resolve_enrolments::run(ctx, scope)),
        CreditRegistrationPhase::Import => Box::pin(import::run(ctx, scope)),
        CreditRegistrationPhase::Verify => Box::pin(verify::run(ctx, scope)),
        CreditRegistrationPhase::LegacyMirror => Box::pin(legacy_mirror::run(ctx, scope)),
        CreditRegistrationPhase::StudentNotifications
        | CreditRegistrationPhase::EnrolmentDiscovery
        | CreditRegistrationPhase::LinkEmails
        | CreditRegistrationPhase::ProductTokenRefresh
        | CreditRegistrationPhase::ConfigValidation
        | CreditRegistrationPhase::RetentionSweep => return Ok(PhaseTick::NotImplemented),
    };
    let mut conn = ctx.pool.acquire().await?;
    if credit_registration_phase_state::is_paused(&mut conn, phase.as_str()).await? {
        return Ok(PhaseTick::Skipped(PhaseSkipReason::Paused));
    }
    let breaker_key = breaker::ScopeKey::of(scope);
    if phase.calls_study_registry() && breaker::is_open(&breaker_key) {
        // Only these phases stop: a study registry outage must not stop consent, eligibility and
        // the legacy mirror from being processed.
        return Ok(PhaseTick::Skipped(PhaseSkipReason::CircuitBreakerOpen));
    }

    // A scoped run writes nothing to the phase-state row. That row describes the workers, and a
    // test's traffic in it would make a dead worker look alive to the heartbeat alert and pollute
    // every counter the dashboard renders. A scoped caller learns what its own iteration did from
    // the value returned here.
    let bookkeeping = scope.is_unscoped();
    if bookkeeping {
        credit_registration_phase_state::heartbeat(&mut conn, phase.as_str()).await?;
    }
    drop(conn);

    let outcome = match body.await {
        Ok(outcome) => outcome,
        Err(error) => PhaseRunOutcome {
            items_processed: 0,
            items_failed: 0,
            error: Some(scrub_text(&format!("{error:#}"))),
        },
    };
    if let Some(error) = &outcome.error {
        error!(
            "Credit registration phase {} failed: {error}",
            phase.as_str()
        );
    }
    if phase.calls_study_registry() {
        if outcome.error.is_some() {
            if breaker::record_failure(&breaker_key, breaker::cooldown(ctx.test_mode)) {
                warn!(
                    "Pausing the study registry phases for {:?} after {} consecutive failures.",
                    breaker::cooldown(ctx.test_mode),
                    breaker::MAX_CONSECUTIVE_SUOTAR_FAILURES
                );
            }
        } else {
            breaker::record_success(&breaker_key);
        }
    }
    if bookkeeping {
        let mut conn = ctx.pool.acquire().await?;
        credit_registration_phase_state::record_run(&mut conn, phase.as_str(), &outcome).await?;
    }
    Ok(PhaseTick::Ran(outcome))
}

/// The response item Suotar sent for one request item, taken from the raw body rather than rebuilt
/// from the typed value, so the audit trail holds what actually arrived.
pub(crate) fn response_item_json(
    raw_response: &serde_json::Value,
    request_item_id: &str,
) -> Option<serde_json::Value> {
    raw_response
        .as_array()?
        .iter()
        .find(|item| item.get("requestItemId").and_then(|id| id.as_str()) == Some(request_item_id))
        .cloned()
}

/// Applies one decided outcome to one row, with the exchange that produced it.
pub(crate) async fn apply_outcome(
    conn: &mut PgConnection,
    registration: &CreditRegistration,
    outcome: &Outcome,
    event: OutcomeEvent<'_>,
) -> anyhow::Result<()> {
    if outcome.drop_verified_student_number
        && let Some(linked) =
            verified_student_numbers::get_by_user_id(conn, registration.user_id).await?
    {
        verified_student_numbers::soft_delete(conn, linked.id).await?;
    }
    if outcome.increment_submit_retry_count {
        credit_registrations::increment_submit_retry_count(conn, registration.id).await?;
    }
    credit_registrations::transition(
        conn,
        registration.id,
        &Transition {
            error_code: outcome.error_code,
            error_message: event.error_message.map(scrub_text),
            needs_admin_attention: outcome.needs_admin_attention,
            event_kind: CreditRegistrationEventKind::SuotarResponse,
            event_message: event.message.map(str::to_string),
            suotar_api_call_id: event.suotar_api_call_id,
            event_details: Some(suotar_exchange_details(event.request, event.response)),
            ..Transition::to(outcome.to_state)
        },
    )
    .await?;
    if let Some(delay_secs) = outcome.delay_secs {
        credit_registrations::schedule_next_attempt(
            conn,
            registration.id,
            next_attempt_at(Utc::now(), delay_secs),
        )
        .await?;
    }
    Ok(())
}

/// Whether an outcome counts against the iteration's `items_failed`.
///
/// The rule the phases follow: an outcome carrying an error code is a failed item, and one that does
/// not is not. A verify poll answered `notRegistered` therefore counts as neither, which is right —
/// the item was answered and the row is exactly where it belongs.
pub(crate) fn counts_as_failed(outcome: &Outcome) -> bool {
    outcome.error_code.is_some()
}

/// The scheduling history one outcome decision needs from a row.
pub(crate) fn row_facts(row: &CreditRegistration) -> RowFacts {
    RowFacts {
        now: Utc::now(),
        first_failed_at: row.first_failed_at,
        submit_retry_count: row.submit_retry_count,
        verify_attempt_count: row.verify_attempt_count,
        submitted_at: row.submitted_at,
    }
}

/// Whether the whole batch came back saying "not now".
///
/// One of the two ways an iteration counts as failed, so the worker stops burning calls against a
/// registry that is answering "unavailable" to everything. A batch with one good item is a success:
/// something moved.
pub(crate) fn every_item_failed_transiently<R>(response: &SuotarBatchResponse<R>) -> bool {
    !response.items.is_empty()
        && response.items.iter().all(|item| {
            item.status == SuotarItemStatus::Error && is_retryable_transient_wire_code(&item.code)
        })
}

/// Applies the same request-level outcome to every row of a rejected batch, and reports the
/// iteration as failed so the circuit breaker sees it.
pub(crate) async fn request_level_failure(
    ctx: &PhaseContext<'_>,
    endpoint: SuotarApiEndpoint,
    error: &UtilError,
    rows: &[CreditRegistration],
    requests: &[serde_json::Value],
) -> anyhow::Result<PhaseRunOutcome> {
    let variant = suotar_error_variant(error);
    let mut conn = ctx.pool.acquire().await?;
    for (row, request) in rows.iter().zip(requests.iter()) {
        let outcome = request_level_outcome(endpoint, variant, &row_facts(row));
        apply_outcome(
            &mut conn,
            row,
            &outcome,
            OutcomeEvent {
                message: Some("The study registry rejected the whole request."),
                error_message: Some(error.message()),
                request: Some(request),
                ..OutcomeEvent::default()
            },
        )
        .await?;
    }
    Ok(PhaseRunOutcome {
        items_processed: i32::try_from(rows.len()).unwrap_or(i32::MAX),
        items_failed: i32::try_from(rows.len()).unwrap_or(i32::MAX),
        error: Some(scrub_text(error.message())),
    })
}

/// A failure that never reached the study registry is safe to send again; everything else may have
/// been acted on. Anything that is not a client error was raised before the request was built.
fn suotar_error_variant(error: &UtilError) -> SuotarErrorVariant {
    match error.error_type() {
        UtilErrorType::SuotarClientError(variant) => *variant,
        _ => SuotarErrorVariant::TransportNotDelivered,
    }
}

/// The audit half of applying an outcome. Both bodies are scrubbed on the way into the event row.
#[derive(Default)]
pub(crate) struct OutcomeEvent<'a> {
    pub message: Option<&'a str>,
    /// Persisted on the ledger row, so it is scrubbed before it is written.
    pub error_message: Option<&'a str>,
    pub suotar_api_call_id: Option<Uuid>,
    pub request: Option<&'a serde_json::Value>,
    pub response: Option<&'a serde_json::Value>,
}

#[cfg(test)]
mod tests {
    use headless_lms_models::credit_registration_phase_state::PHASES;

    use super::*;

    /// A mismatch with the rows the migration seeded into `credit_registration_phase_state` makes a
    /// tick or a heartbeat silently target a row that does not exist.
    #[test]
    fn phase_names_match_the_seeded_rows() {
        let from_enum: Vec<&str> = CreditRegistrationPhase::ALL
            .iter()
            .map(|phase| phase.as_str())
            .collect();
        assert_eq!(from_enum, PHASES);
        assert_eq!(from_enum.len(), 12);
    }

    #[test]
    fn phase_names_round_trip() {
        for phase in CreditRegistrationPhase::ALL {
            assert_eq!(
                CreditRegistrationPhase::from_phase_name(phase.as_str()),
                Some(phase)
            );
        }
        assert_eq!(
            CreditRegistrationPhase::from_phase_name("materialise"),
            None
        );
        assert_eq!(CreditRegistrationPhase::from_phase_name(""), None);
    }

    /// The scope predicate exists so a narrowed run touches only its own rows. A phase that cannot
    /// honour what it was handed has to say so, or a test that believes it narrowed the run gets a
    /// silently wrong answer.
    #[test]
    fn a_phase_refuses_a_scope_it_cannot_apply() {
        let ids = PhaseScope {
            credit_registration_ids: vec![Uuid::new_v4()],
            ..PhaseScope::default()
        };
        assert!(
            !CreditRegistrationPhase::Materialize
                .scope_support()
                .covers(&ids)
        );
        assert!(CreditRegistrationPhase::Import.scope_support().covers(&ids));
        assert!(
            !CreditRegistrationPhase::RetentionSweep
                .scope_support()
                .covers(&PhaseScope::for_course(Uuid::new_v4()))
        );
    }

    /// An unscoped run is what production does, and every phase has to accept it.
    #[test]
    fn every_phase_accepts_an_unscoped_run() {
        for phase in CreditRegistrationPhase::ALL {
            assert!(
                phase.scope_support().covers(&PhaseScope::default()),
                "{}",
                phase.as_str()
            );
        }
    }

    /// The three phases that share the circuit breaker are the three the registrar tick can stall
    /// on; the database-only ones must keep running through an outage.
    #[test]
    fn only_the_phases_that_call_the_registry_share_the_breaker() {
        for phase in [
            CreditRegistrationPhase::Materialize,
            CreditRegistrationPhase::Preconditions,
            CreditRegistrationPhase::LegacyMirror,
        ] {
            assert!(!phase.calls_study_registry(), "{}", phase.as_str());
        }
        for phase in [
            CreditRegistrationPhase::ResolveEnrolments,
            CreditRegistrationPhase::Import,
            CreditRegistrationPhase::Verify,
        ] {
            assert!(phase.calls_study_registry(), "{}", phase.as_str());
        }
    }

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

    #[test]
    fn a_response_item_is_found_by_its_request_item_id() {
        let raw = serde_json::json!([
            { "requestItemId": "cr-1", "status": "ok", "code": "sent" },
            { "requestItemId": "cr-2", "status": "error", "code": "sisuTimeout" },
        ]);
        assert_eq!(
            response_item_json(&raw, "cr-2").and_then(|item| item
                .get("code")
                .and_then(|code| code.as_str().map(str::to_string))),
            Some("sisuTimeout".to_string())
        );
        assert_eq!(response_item_json(&raw, "cr-9"), None);
    }
}
