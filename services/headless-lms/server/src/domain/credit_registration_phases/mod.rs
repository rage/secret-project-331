//! The thirteen credit-registration pipeline phases and the one-iteration dispatcher.
//!
//! Both the worker loops and the test tick endpoint go through [`run_phase_once`], so a phase cannot
//! behave differently depending on who ran it.

pub mod breaker;
mod config_validation;
mod enrolment_discovery;
mod import;
mod ledger_snapshot;
mod link_emails;
pub mod linking_mail_resend;
mod product_token_refresh;
mod resolve_enrolments;
mod retention_sweep;
mod student_notifications;
mod verify;
pub mod worker_loop;

use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::credit_registration_events::{
    CreditRegistrationEventKind, scrub_text, suotar_exchange_details,
};
use headless_lms_models::credit_registrations::{
    CreditRegistration, CreditRegistrationState, Transition,
};
use headless_lms_models::email_templates::{
    EmailTemplateType, get_generic_email_template_by_type_and_language,
};
use headless_lms_models::library::credit_registration::backoff::next_attempt_at;
use headless_lms_models::library::credit_registration::classification::is_retryable_transient_wire_code;
use headless_lms_models::library::credit_registration::legacy_mirror::{
    LEGACY_MIRROR_LIMIT, mirror_successes_to_legacy_ledger,
};
use headless_lms_models::library::credit_registration::materialize::{
    GRADE_IMPROVEMENT_LIMIT, MATERIALIZE_LIMIT, ensure_registration_rows_for_eligible_completions,
    start_re_attempts_for_improved_grades,
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
use sqlx::{Connection, PgConnection, PgPool};
use std::collections::{BTreeSet, HashMap};
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
    LedgerSnapshot,
}

impl CreditRegistrationPhase {
    /// Every phase, in pipeline order.
    pub const ALL: [Self; 13] = [
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
        Self::LedgerSnapshot,
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
            Self::LedgerSnapshot => "ledger-snapshot",
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
            | Self::RetentionSweep
            | Self::LedgerSnapshot => "suotar-syncer",
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

    /// The ledger states this phase is the one to move a row out of.
    ///
    /// The Workers tab's "queue depth it is responsible for", and the depth the failing-phase alert
    /// asks about before calling a quiet phase wedged. Empty for the phases whose work is not a
    /// ledger state at all: `materialize`'s queue is completions with no row yet, and the syncer's
    /// phases work on course modules. Narrower than what `preconditions` may claim, which is every
    /// non-terminal row: these are the states nothing else advances.
    pub fn owned_states(self) -> &'static [CreditRegistrationState] {
        match self {
            Self::Preconditions => &[
                CreditRegistrationState::PendingPrerequisites,
                CreditRegistrationState::PendingConsent,
                CreditRegistrationState::PendingStudentNumber,
                CreditRegistrationState::NoUsableEnrolment,
                CreditRegistrationState::FailedRetryable,
                CreditRegistrationState::Blocked,
            ],
            Self::ResolveEnrolments => &[
                CreditRegistrationState::ReadyToSubmit,
                CreditRegistrationState::ResolvingEnrolment,
            ],
            Self::Import => &[
                CreditRegistrationState::CheckingEnrolment,
                CreditRegistrationState::Submitting,
            ],
            Self::Verify => &[
                CreditRegistrationState::AwaitingVerification,
                CreditRegistrationState::SubmissionUncertain,
            ],
            _ => &[],
        }
    }

    pub fn scope_support(self) -> ScopeSupport {
        match self {
            Self::Preconditions
            | Self::ResolveEnrolments
            | Self::Import
            | Self::Verify
            | Self::LegacyMirror
            | Self::StudentNotifications => ScopeSupport::LEDGER,
            // No ledger row exists yet, so there is no registration id to narrow on.
            Self::Materialize => ScopeSupport {
                course: true,
                user: true,
                registration_ids: false,
            },
            // These reach their rows through the course module, which has no user dimension: a
            // roster, a product token and a module configuration are facts about a course, not
            // about one of our accounts.
            Self::EnrolmentDiscovery
            | Self::LinkEmails
            | Self::ProductTokenRefresh
            | Self::ConfigValidation => ScopeSupport {
                course: true,
                user: false,
                registration_ids: false,
            },
            // Sweeps whole tables by age; there is nothing in them to narrow on.
            Self::RetentionSweep => ScopeSupport::NONE,
            // Counts every row in the ledger for the day; a scoped run would write that as if it
            // were everyone's snapshot.
            Self::LedgerSnapshot => ScopeSupport::NONE,
        }
    }
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
    /// Read by `enrolment-discovery` for the email-match fast track, whose enabled flag doubles as
    /// its kill switch.
    pub suotar_conf: &'a headless_lms_base::config::SuotarConfiguration,
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
        }
    }
}

/// The audit log's `worker_name`, which the database caps at 64 characters.
pub(crate) fn worker_name(caller: &str, phase: CreditRegistrationPhase) -> String {
    format!("{caller}/{}", phase.as_str())
}

/// Both statements that create ledger rows, bounded apart from each other. Together in one phase so
/// the Workers tab's row-creation counter accounts for every row the pipeline invented.
async fn run_materialize(
    ctx: &PhaseContext<'_>,
    scope: &PhaseScope,
) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let created =
        ensure_registration_rows_for_eligible_completions(&mut conn, scope, MATERIALIZE_LIMIT)
            .await?;
    let re_attempted =
        start_re_attempts_for_improved_grades(&mut conn, scope, GRADE_IMPROVEMENT_LIMIT).await?;
    Ok(PhaseRunOutcome::processed(created + re_attempted))
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
/// implementation is registered; it is exhaustive over [`CreditRegistrationPhase`], so a variant
/// added there without a dispatch arm here fails to compile.
pub async fn run_phase_once(
    ctx: &PhaseContext<'_>,
    phase: CreditRegistrationPhase,
    scope: &PhaseScope,
) -> anyhow::Result<PhaseTick> {
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
    let breaker_key = breaker::ScopeKey::of(scope);
    if phase.calls_study_registry() && breaker::is_open(&breaker_key) {
        // Only these stop: an outage must not stall the database-only phases.
        return Ok(PhaseTick::Skipped(PhaseSkipReason::CircuitBreakerOpen));
    }
    drop(conn);

    let body: Pin<Box<dyn Future<Output = anyhow::Result<PhaseRunOutcome>> + '_>> = match phase {
        CreditRegistrationPhase::Materialize => Box::pin(run_materialize(ctx, scope)),
        CreditRegistrationPhase::Preconditions => Box::pin(run_preconditions(ctx, scope)),
        CreditRegistrationPhase::ResolveEnrolments => Box::pin(resolve_enrolments::run(ctx, scope)),
        CreditRegistrationPhase::Import => Box::pin(import::run(ctx, scope)),
        CreditRegistrationPhase::Verify => Box::pin(verify::run(ctx, scope)),
        CreditRegistrationPhase::LegacyMirror => Box::pin(run_legacy_mirror(ctx, scope)),
        CreditRegistrationPhase::StudentNotifications => {
            Box::pin(student_notifications::run(ctx, scope))
        }
        CreditRegistrationPhase::EnrolmentDiscovery => {
            Box::pin(enrolment_discovery::run(ctx, scope))
        }
        CreditRegistrationPhase::LinkEmails => Box::pin(link_emails::run(ctx, scope)),
        CreditRegistrationPhase::ProductTokenRefresh => {
            Box::pin(product_token_refresh::run(ctx, scope))
        }
        CreditRegistrationPhase::ConfigValidation => Box::pin(config_validation::run(ctx, scope)),
        CreditRegistrationPhase::RetentionSweep => Box::pin(retention_sweep::run(ctx, scope)),
        CreditRegistrationPhase::LedgerSnapshot => Box::pin(ledger_snapshot::run(ctx, scope)),
    };

    let exchanges_before = ctx.suotar_client.exchange_count();
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
    // An iteration that never sent a request says nothing about whether the study registry is up,
    // so it must neither count against the breaker nor clear a run of failures. Phases share one
    // breaker, and an empty queue is the common case: without this, a phase with nothing to do
    // resets the counter every tick and the breaker never opens during an outage.
    let reached_study_registry = ctx.suotar_client.exchange_count() > exchanges_before;
    if phase.calls_study_registry() && reached_study_registry {
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

/// One template lookup per type and language per iteration rather than per mail. `None` means no
/// template exists, which a mail phase reports rather than failing the batch it was found in.
#[derive(Default)]
pub(crate) struct TemplateCache(HashMap<(EmailTemplateType, String), Option<Uuid>>);

impl TemplateCache {
    pub(crate) async fn id_for(
        &mut self,
        conn: &mut PgConnection,
        template_type: EmailTemplateType,
        language: &str,
    ) -> anyhow::Result<Option<Uuid>> {
        let key = (template_type, language.to_string());
        if let Some(id) = self.0.get(&key) {
            return Ok(*id);
        }
        let found =
            match get_generic_email_template_by_type_and_language(conn, template_type, language)
                .await
            {
                Ok(template) => Some(template.id),
                Err(error)
                    if matches!(
                        error.error_type(),
                        headless_lms_models::ModelErrorType::RecordNotFound
                    ) =>
                {
                    None
                }
                Err(error) => return Err(error.into()),
            };
        self.0.insert(key, found);
        Ok(found)
    }
}

/// A phase whose whole body is "claim rows, look up each one's template, skip it if the template is
/// missing, otherwise queue a mail". `link-emails` and `student-notifications` are its only two
/// shapes; [`run_mail_queue_phase`] is the loop they share.
pub(crate) trait MailQueuePhase {
    type Item;
    /// Per-run state [`queue`](Self::queue) may want across items, the way [`TemplateCache`] is
    /// kept across items already. `()` for a phase that needs none.
    type Cache: Default;

    async fn claim(conn: &mut PgConnection, scope: &PhaseScope) -> anyhow::Result<Vec<Self::Item>>;

    fn template_type(item: &Self::Item) -> EmailTemplateType;
    fn language(item: &Self::Item) -> String;

    /// Inserts the delivery and records it on the claimed item, given the template the caller
    /// already resolved.
    async fn queue(
        ctx: &PhaseContext<'_>,
        conn: &mut PgConnection,
        item: &Self::Item,
        template_id: Uuid,
        cache: &mut Self::Cache,
    ) -> anyhow::Result<()>;

    /// One entry of the missing-templates report, e.g. the language alone or a type-and-language
    /// pair, depending on whether the phase has more than one template type.
    fn missing_template_label(template_type: EmailTemplateType, language: &str) -> String;

    /// The fixed lead-in of the missing-templates error message.
    fn missing_templates_error_prefix() -> &'static str;
}

/// Claims, resolves templates for, and queues mail for one iteration of a [`MailQueuePhase`]. A mail
/// with no template is skipped rather than failing the iteration: the batch is one transaction, so an
/// error would roll back every mail that could be queued, and the claimed rows stay claimable.
pub(crate) async fn run_mail_queue_phase<P: MailQueuePhase>(
    ctx: &PhaseContext<'_>,
    scope: &PhaseScope,
) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let claimed = P::claim(&mut tx, scope).await?;
    let mut templates = TemplateCache::default();
    let mut cache = P::Cache::default();
    let mut missing_templates: BTreeSet<String> = BTreeSet::new();
    let mut skipped = 0;
    for item in &claimed {
        let template_type = P::template_type(item);
        let language = P::language(item);
        let Some(template_id) = templates.id_for(&mut tx, template_type, &language).await? else {
            missing_templates.insert(P::missing_template_label(template_type, &language));
            skipped += 1;
            continue;
        };
        P::queue(ctx, &mut tx, item, template_id, &mut cache).await?;
    }
    tx.commit().await?;

    Ok(PhaseRunOutcome {
        items_processed: i32::try_from(claimed.len()).unwrap_or(i32::MAX),
        items_failed: skipped,
        error: (!missing_templates.is_empty()).then(|| {
            format!(
                "{} {}.",
                P::missing_templates_error_prefix(),
                missing_templates.into_iter().collect::<Vec<_>>().join(", ")
            )
        }),
    })
}

/// Templates are stored per language and courses carry a locale. The course's language, not the
/// recipient's: the linking mail's recipient may have no account here, and an account records no UI
/// language to prefer.
pub(crate) fn template_language(course_language_code: &str) -> String {
    course_language_code
        .split(['-', '_'])
        .next()
        .unwrap_or(course_language_code)
        .to_lowercase()
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
///
/// `expected_from_state` guards against writing back a decision made from a row snapshot that an
/// `await` (an external call, or just the gap since claiming) has let go stale: pass the state the
/// phase itself put the row in before that `await`, or `Some(registration.state)` when the phase
/// never moved the row before its own `await`.
pub(crate) async fn apply_outcome(
    conn: &mut PgConnection,
    registration: &CreditRegistration,
    outcome: &Outcome,
    event: OutcomeEvent<'_>,
    expected_from_state: Option<CreditRegistrationState>,
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
            expected_from_state,
            next_attempt_at: outcome
                .delay_secs
                .map(|delay_secs| next_attempt_at(Utc::now(), delay_secs)),
            ..Transition::to(outcome.to_state)
        },
    )
    .await?;
    Ok(())
}

/// Whether the error is `transition` refusing to write because another writer moved the row since
/// the snapshot the decision was made from.
///
/// A phase that hits this on one row of a batch must skip that row and carry on: the row belongs to
/// whoever moved it, and aborting the loop would leave every row after it in the state the phase's
/// own preflight wrote, with no phase claiming that state again.
pub(crate) fn row_moved_on(error: &anyhow::Error) -> bool {
    error
        .downcast_ref::<headless_lms_models::ModelError>()
        .is_some_and(|error| {
            matches!(
                error.error_type(),
                headless_lms_models::ModelErrorType::PreconditionFailed
            )
        })
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
///
/// `expected_from_state` is the state the caller's own preflight transition put every row in, since
/// `rows` was collected before that transition's effect and is stale by the time this runs.
pub(crate) async fn request_level_failure(
    ctx: &PhaseContext<'_>,
    endpoint: SuotarApiEndpoint,
    error: &UtilError,
    rows: &[CreditRegistration],
    requests: &[serde_json::Value],
    expected_from_state: CreditRegistrationState,
) -> anyhow::Result<PhaseRunOutcome> {
    let variant = suotar_error_variant(error);
    let mut conn = ctx.pool.acquire().await?;
    for (row, request) in rows.iter().zip(requests.iter()) {
        let outcome = request_level_outcome(endpoint, variant, &row_facts(row));
        let applied = apply_outcome(
            &mut conn,
            row,
            &outcome,
            OutcomeEvent {
                message: Some("The study registry rejected the whole request."),
                error_message: Some(error.message()),
                request: Some(request),
                ..OutcomeEvent::default()
            },
            Some(expected_from_state),
        )
        .await;
        if let Err(error) = applied {
            if !row_moved_on(&error) {
                return Err(error);
            }
            warn!(
                "Credit registration {} moved on before the rejection could be recorded; leaving it. {error:#}",
                row.id
            );
        }
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
        assert_eq!(from_enum.len(), 13);
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
    fn a_locale_narrows_to_the_language_the_templates_are_stored_under() {
        assert_eq!(template_language("fi-FI"), "fi");
        assert_eq!(template_language("en_US"), "en");
        assert_eq!(template_language("en"), "en");
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
