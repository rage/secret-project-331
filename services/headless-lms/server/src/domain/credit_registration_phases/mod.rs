//! The twelve credit-registration pipeline phases and the one-iteration dispatcher.
//!
//! Both the worker loops and the test tick endpoint go through [`run_phase_once`], so a phase cannot
//! behave differently depending on who ran it.

pub mod breaker;
mod enrolment_discovery;
mod import;
mod link_emails;
pub mod linking_mail_resend;
mod product_token_refresh;
mod resolve_enrolments;
mod verify;
pub mod worker_loop;

use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::credit_registration_events::{
    CreditRegistrationEventKind, scrub_text, suotar_exchange_details,
};
use headless_lms_models::credit_registrations::{CreditRegistration, Transition};
use headless_lms_models::library::credit_registration::backoff::next_attempt_at;
use headless_lms_models::library::credit_registration::classification::is_retryable_transient_wire_code;
use headless_lms_models::library::credit_registration::legacy_mirror::{
    LEGACY_MIRROR_LIMIT, mirror_successes_to_legacy_ledger,
};
use headless_lms_models::library::credit_registration::materialize::{
    MATERIALIZE_LIMIT, ensure_registration_rows_for_eligible_completions,
};
use headless_lms_models::library::credit_registration::outcomes::{
    Outcome, RowFacts, request_level_outcome,
};
use headless_lms_models::library::credit_registration::preconditions::{
    PRECONDITIONS_LIMIT, recompute_preconditions,
};
use headless_lms_models::suotar_api_calls::SuotarEndpoint as SuotarApiEndpoint;
use headless_lms_models::{credit_registration_phase_state, credit_registrations};
use headless_lms_models::{
    credit_registration_phase_state::PhaseRunOutcome, verified_student_numbers,
};
use headless_lms_utils::error::util_error::{SuotarErrorVariant, UtilError, UtilErrorType};
use headless_lms_utils::prelude::Utc;
use headless_lms_utils::services::suotar::{
    ListedPerson, SuotarBatchResponse, SuotarClient, SuotarItemStatus,
};
use sqlx::{PgConnection, PgPool};
use std::future::Future;
use std::pin::Pin;
use uuid::Uuid;

/// Which rows one iteration may touch.
pub use headless_lms_models::credit_registrations::RegistrationScope as PhaseScope;

/// A pipeline phase. [`CreditRegistrationPhase::as_str`] is canonical: it is
/// `credit_registration_phase_state.phase`, the tick endpoint's `?phase=` and the audit log's
/// `target_phase`.
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

    /// The phases `run-registrar-tick` runs, in pipeline order. Not every `credit-registrar` phase:
    /// `legacy-mirror` and `student-notifications` are driven explicitly by specs that need them.
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

    /// Whether [`run_phase_once`] has an implementation registered for the phase, derived from
    /// [`implementation`](Self::implementation) so it cannot list a different set of phases than
    /// the dispatch actually runs.
    pub fn is_implemented(self) -> bool {
        self.implementation().is_some()
    }

    /// Which [`ImplementedPhase`] runs this phase, or `None` for one with no dispatch arm yet.
    /// [`run_phase_once`]'s dispatch match is over the returned type, so adding a phase there
    /// without adding it here fails to compile instead of silently never running.
    fn implementation(self) -> Option<ImplementedPhase> {
        match self {
            Self::Materialize => Some(ImplementedPhase::Materialize),
            Self::Preconditions => Some(ImplementedPhase::Preconditions),
            Self::ResolveEnrolments => Some(ImplementedPhase::ResolveEnrolments),
            Self::Import => Some(ImplementedPhase::Import),
            Self::Verify => Some(ImplementedPhase::Verify),
            Self::LegacyMirror => Some(ImplementedPhase::LegacyMirror),
            Self::EnrolmentDiscovery => Some(ImplementedPhase::EnrolmentDiscovery),
            Self::LinkEmails => Some(ImplementedPhase::LinkEmails),
            Self::ProductTokenRefresh => Some(ImplementedPhase::ProductTokenRefresh),
            Self::StudentNotifications | Self::ConfigValidation | Self::RetentionSweep => None,
        }
    }

    /// Whether the phase talks to the study registry, and so shares the circuit breaker with the
    /// other such phases of its own worker process (`breaker::BREAKERS` is process-local, not
    /// shared between `credit-registrar` and `suotar-syncer`).
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

    pub fn scope_support(self) -> ScopeSupport {
        match self {
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
            // These reach their rows through the course module, which has no user dimension: a
            // roster and a product token are facts about a course, not about one of our accounts.
            Self::EnrolmentDiscovery | Self::LinkEmails | Self::ProductTokenRefresh => {
                ScopeSupport {
                    course: true,
                    user: false,
                    registration_ids: false,
                }
            }
            // Not implemented yet.
            Self::StudentNotifications | Self::ConfigValidation | Self::RetentionSweep => {
                ScopeSupport::NONE
            }
        }
    }
}

/// The phases [`run_phase_once`]'s dispatch match actually runs. A one-to-one mirror of the
/// [`CreditRegistrationPhase`] variants [`CreditRegistrationPhase::implementation`] maps to `Some`;
/// adding a variant here without a matching dispatch arm fails to compile.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ImplementedPhase {
    Materialize,
    Preconditions,
    ResolveEnrolments,
    Import,
    Verify,
    LegacyMirror,
    EnrolmentDiscovery,
    LinkEmails,
    ProductTokenRefresh,
}

/// Which of the scope's dimensions a phase's claim query can apply. Declared rather than assumed,
/// so a phase added later cannot quietly ignore a scope and sweep the whole database.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScopeSupport {
    pub course: bool,
    pub user: bool,
    pub registration_ids: bool,
}

impl ScopeSupport {
    pub const NONE: Self = Self {
        course: false,
        user: false,
        registration_ids: false,
    };
    /// The phases that claim ledger rows, which carry all three keys themselves.
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
    /// The phase legitimately did nothing; not counted as a failure.
    Skipped(PhaseSkipReason),
    /// The scope names something this phase cannot narrow on; refused rather than run wide.
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
    /// Shortens the circuit breaker's cooldown to something a test can wait out.
    pub test_mode: bool,
    /// Goes into the audit log's `worker_name` alongside the phase.
    pub caller: &'a str,
    /// Absolute base for links in queued mail, which outlive the process that wrote them.
    pub base_url: &'a str,
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

async fn run_materialize(
    ctx: &PhaseContext<'_>,
    scope: &PhaseScope,
) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let created =
        ensure_registration_rows_for_eligible_completions(&mut conn, scope, MATERIALIZE_LIMIT)
            .await?;
    Ok(PhaseRunOutcome::processed(created))
}

/// Database-only, so it keeps running while the study registry is unreachable.
async fn run_preconditions(
    ctx: &PhaseContext<'_>,
    scope: &PhaseScope,
) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let moved = recompute_preconditions(&mut conn, scope, PRECONDITIONS_LIMIT).await?;
    Ok(PhaseRunOutcome::processed(moved))
}

async fn run_legacy_mirror(
    ctx: &PhaseContext<'_>,
    scope: &PhaseScope,
) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let mirrored = mirror_successes_to_legacy_ledger(&mut conn, scope, LEGACY_MIRROR_LIMIT).await?;
    Ok(PhaseRunOutcome::processed(mirrored))
}

/// Runs exactly one iteration of one phase. The match below is the only place a phase
/// implementation is registered; it is exhaustive over [`ImplementedPhase`], so a variant added
/// there without a dispatch arm here fails to compile rather than running as `NotImplemented`.
pub async fn run_phase_once(
    ctx: &PhaseContext<'_>,
    phase: CreditRegistrationPhase,
    scope: &PhaseScope,
) -> anyhow::Result<PhaseTick> {
    // Before the pause check: a caller whose narrowing cannot be honoured must not be told it ran.
    if !phase.scope_support().covers(scope) {
        return Ok(PhaseTick::ScopeNotSupported);
    }
    let Some(implementation) = phase.implementation() else {
        return Ok(PhaseTick::NotImplemented);
    };
    // Built before the guards below and awaited after them: an unpolled future does nothing, so a
    // paused phase costs no database connection.
    let body: Pin<Box<dyn Future<Output = anyhow::Result<PhaseRunOutcome>> + '_>> =
        match implementation {
            ImplementedPhase::Materialize => Box::pin(run_materialize(ctx, scope)),
            ImplementedPhase::Preconditions => Box::pin(run_preconditions(ctx, scope)),
            ImplementedPhase::ResolveEnrolments => Box::pin(resolve_enrolments::run(ctx, scope)),
            ImplementedPhase::Import => Box::pin(import::run(ctx, scope)),
            ImplementedPhase::Verify => Box::pin(verify::run(ctx, scope)),
            ImplementedPhase::LegacyMirror => Box::pin(run_legacy_mirror(ctx, scope)),
            ImplementedPhase::EnrolmentDiscovery => Box::pin(enrolment_discovery::run(ctx, scope)),
            ImplementedPhase::LinkEmails => Box::pin(link_emails::run(ctx, scope)),
            ImplementedPhase::ProductTokenRefresh => {
                Box::pin(product_token_refresh::run(ctx, scope))
            }
        };
    let mut conn = ctx.pool.acquire().await?;
    if credit_registration_phase_state::is_paused(&mut conn, phase.as_str()).await? {
        return Ok(PhaseTick::Skipped(PhaseSkipReason::Paused));
    }
    let breaker_key = breaker::ScopeKey::of(scope);
    if phase.calls_study_registry() && breaker::is_open(&breaker_key) {
        // Only these stop: an outage must not stall the database-only phases.
        return Ok(PhaseTick::Skipped(PhaseSkipReason::CircuitBreakerOpen));
    }

    // A scoped run writes nothing to the phase-state row: that row describes the workers, and a
    // test's traffic in it would make a dead worker look alive to the heartbeat alert.
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

/// Every address the study registry holds for a listed person, in the order it lists them; which
/// one they read is not something we can know.
pub(crate) fn listed_person_addresses(person: &ListedPerson) -> Vec<String> {
    [
        Some(person.primary_email.clone()),
        person.secondary_email.clone(),
    ]
    .into_iter()
    .flatten()
    .filter(|address| !address.trim().is_empty())
    .collect()
}

/// The request bodies as sent, kept alongside the typed items so a rejected batch can pair each row
/// with what was actually asked of it for the audit log.
pub(crate) fn requests_json<T: serde::Serialize>(items: &[T]) -> Vec<serde_json::Value> {
    items
        .iter()
        .map(|item| serde_json::to_value(item).unwrap_or_default())
        .collect()
}

/// The response item for one request item, read from the raw body rather than rebuilt from the
/// typed value, so the audit trail holds what actually arrived.
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
    // Only if the request carried this number: a student who linked a working one while the request
    // was out must not lose the link they just made.
    if outcome.drop_verified_student_number
        && let Some(linked) =
            verified_student_numbers::get_by_user_id(conn, registration.user_id).await?
        && event.sent_student_number == Some(linked.student_number.as_str())
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

/// Whether an outcome counts against the iteration's `items_failed`: an error code is a failed
/// item, so a verify poll answered `notRegistered` is not one.
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

/// Whether the whole batch came back saying "not now", so the worker stops burning calls. A batch
/// with one good item is a success: something moved.
pub(crate) fn every_item_failed_transiently<R>(response: &SuotarBatchResponse<R>) -> bool {
    !response.items.is_empty()
        && response.items.iter().all(|item| {
            item.status == SuotarItemStatus::Error && is_retryable_transient_wire_code(&item.code)
        })
}

/// Applies one request-level outcome to every row of a rejected batch, and reports the iteration as
/// failed so the circuit breaker sees it.
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
    /// The student number this row's request actually carried, which may no longer be the linked
    /// one by the time the answer is applied.
    pub sent_student_number: Option<&'a str>,
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

    /// A mismatch with the seeded `credit_registration_phase_state` rows makes a tick or a
    /// heartbeat silently target a row that does not exist.
    #[test]
    fn phase_names_match_the_seeded_rows() {
        let from_enum: Vec<&str> = CreditRegistrationPhase::ALL
            .iter()
            .map(|phase| phase.as_str())
            .collect();
        assert_eq!(from_enum, PHASES);
        assert_eq!(from_enum.len(), 12);
    }

    /// A phase that cannot honour the narrowing it was handed has to say so, or a caller that
    /// believes it narrowed the run gets a silently wrong answer.
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
