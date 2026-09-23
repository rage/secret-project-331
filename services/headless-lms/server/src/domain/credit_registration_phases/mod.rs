//! The twelve credit-registration pipeline phases and the one-iteration dispatcher.
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
use headless_lms_models::library::credit_registration::classification::{
    is_service_unavailable_code, is_sisu_timeout_code,
};
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
use headless_lms_models::secret::DbSecret;
use headless_lms_models::{credit_registration_phase_state, credit_registrations};
use headless_lms_models::{
    credit_registration_phase_state::PhaseRunOutcome, verified_student_numbers,
};
use headless_lms_utils::error::util_error::{SuotarErrorVariant, UtilError, UtilErrorType};
use headless_lms_utils::prelude::Utc;
use headless_lms_utils::services::suotar::{
    ListedPerson, SuotarBatchResponse, SuotarClient, SuotarEndpoint, SuotarItemStatus,
    SuotarRequestItem, SuotarResponseItem,
};
use itertools::izip;
use secrecy::ExposeSecret;
use sqlx::{Connection, PgConnection, PgPool};
use std::collections::{BTreeSet, HashMap};
use std::future::Future;
use std::pin::Pin;
use std::time::Duration;
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
    ConfigValidation,
    RetentionSweep,
    LedgerSnapshot,
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
            | Self::ConfigValidation
            | Self::RetentionSweep
            | Self::LedgerSnapshot => "suotar-syncer",
        }
    }

    /// Whether the phase talks to the study registry, and so shares the study registry circuit
    /// breaker with the other such phases of its own worker process (`breaker::BREAKERS` is
    /// process-local, not shared between `credit-registrar` and `suotar-syncer`).
    pub fn calls_study_registry(self) -> bool {
        !self.study_registry_endpoints().is_empty()
    }

    /// Whether the phase is the one that sends attainments on to Sisu, and so the one a Sisu outage
    /// pauses while Suotar itself keeps answering.
    pub fn submits_to_sisu(self) -> bool {
        self == Self::Import
    }

    /// The study registry endpoints one iteration calls, one after the other.
    pub fn study_registry_endpoints(self) -> &'static [SuotarEndpoint] {
        match self {
            Self::ResolveEnrolments => &[SuotarEndpoint::ResolveEnrolments],
            Self::Import => &[SuotarEndpoint::ImportAttainments],
            // The poll, then the recovery lookup for rows with nothing to poll by.
            Self::Verify => &[
                SuotarEndpoint::VerifyAttainments,
                SuotarEndpoint::ResolveEnrolments,
            ],
            Self::EnrolmentDiscovery => &[SuotarEndpoint::ListByCourse],
            Self::ConfigValidation => &[SuotarEndpoint::ValidateCourseCodes],
            Self::Materialize
            | Self::Preconditions
            | Self::LegacyMirror
            | Self::StudentNotifications
            | Self::LinkEmails
            | Self::RetentionSweep
            | Self::LedgerSnapshot => &[],
        }
    }

    /// The longest one iteration may wait on the study registry before its calls time out.
    pub fn max_study_registry_wait(self) -> Duration {
        self.study_registry_endpoints()
            .iter()
            .map(|endpoint| endpoint.request_timeout())
            .sum()
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
                CreditRegistrationState::Pending,
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
            // roster and a module configuration are facts about a course, not about one of our
            // accounts.
            Self::EnrolmentDiscovery | Self::LinkEmails | Self::ConfigValidation => ScopeSupport {
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
        CreditRegistrationPhase::ConfigValidation => Box::pin(config_validation::run(ctx, scope)),
        CreditRegistrationPhase::RetentionSweep => Box::pin(retention_sweep::run(ctx, scope)),
        CreditRegistrationPhase::LedgerSnapshot => Box::pin(ledger_snapshot::run(ctx, scope)),
    };

    let keep_alive = bookkeeping.then(|| KeepAlive::spawn(ctx.pool, phase));
    let outcome = match body.await {
        Ok(outcome) => outcome,
        Err(error) => PhaseRunOutcome {
            items_processed: 0,
            items_failed: 0,
            error: Some(scrub_text(&format!("{error:#}"))),
            is_sisu_outage: false,
        },
    };
    drop(keep_alive);
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
    let reached_study_registry = suotar_client.exchange_count() > 0;
    if phase.calls_study_registry() && reached_study_registry {
        record_breaker_outcome(&breaker_key, phase, &outcome, ctx.test_mode);
    }
    if bookkeeping {
        let mut conn = ctx.pool.acquire().await?;
        credit_registration_phase_state::record_run(&mut conn, phase.as_str(), &outcome).await?;
    }
    Ok(PhaseTick::Ran(outcome))
}

/// Counts one iteration that reached the study registry against the breakers. Sisu timing out on
/// every submission is Suotar answering, so it counts against the submitting phase's own breaker
/// and as a success for the one every study registry phase shares.
fn record_breaker_outcome(
    key: &breaker::ScopeKey,
    phase: CreditRegistrationPhase,
    outcome: &PhaseRunOutcome,
    test_mode: bool,
) {
    use breaker::BreakerTarget;
    let cooldown = breaker::cooldown(test_mode);
    match (&outcome.error, outcome.is_sisu_outage) {
        (Some(_), true) => {
            breaker::record_success(key, BreakerTarget::StudyRegistry);
            if breaker::record_failure(key, BreakerTarget::SisuSubmissions, cooldown) {
                warn!(
                    "Pausing {} for {cooldown:?} after {} consecutive iterations Sisu timed out on.",
                    phase.as_str(),
                    breaker::MAX_CONSECUTIVE_SUOTAR_FAILURES
                );
            }
        }
        (Some(_), false) => {
            if breaker::record_failure(key, BreakerTarget::StudyRegistry, cooldown) {
                warn!(
                    "Pausing the study registry phases for {cooldown:?} after {} consecutive failures.",
                    breaker::MAX_CONSECUTIVE_SUOTAR_FAILURES
                );
            }
        }
        (None, _) => {
            breaker::record_success(key, BreakerTarget::StudyRegistry);
            if phase.submits_to_sisu() {
                breaker::record_success(key, BreakerTarget::SisuSubmissions);
            }
        }
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
                    anyhow::Ok(())
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
        P::queue(ctx, &mut tx, item, template_id).await?;
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
        is_sisu_outage: false,
    })
}

/// What one iteration of a [`SuotarBatchPhase`] settled before it sent anything.
pub(crate) struct Prepared<Row, Item> {
    /// The rows the batch is built from, each with the request item it became.
    pub sendable: Vec<(Row, Item)>,
    /// Rows the preflight already wrote a decision for, so no answer is owed for them.
    pub decided: i32,
    /// How many of `decided` ended up carrying an error code.
    pub failed: i32,
}

impl<Row, Item> Default for Prepared<Row, Item> {
    fn default() -> Self {
        Self {
            sendable: Vec::new(),
            decided: 0,
            failed: 0,
        }
    }
}

/// A phase whose iteration is "claim rows, decide in one transaction what may be asked, send one
/// batch, write one answer per row". `import`, `resolve-enrolments`, and each of `verify`'s two
/// flows; [`run_suotar_batch_phase`] is the loop they share, and the only place the transaction
/// shape, the moved-on skipping and the counters are written down.
pub(crate) trait SuotarBatchPhase {
    /// A row to send for, with whatever its preflight read alongside it.
    type Row;
    /// The request item, which is also what the audit log records as sent.
    type Item: SuotarRequestItem + Clone;
    /// The endpoint's per-item result body.
    type Result;

    /// The iteration's error when every item came back unavailable.
    const ALL_UNAVAILABLE_ERROR: &'static str;

    /// Claims rows and decides what may be asked about them. Whatever has to be true before the
    /// request leaves is written here, in the caller's transaction.
    async fn prepare(
        &mut self,
        ctx: &PhaseContext<'_>,
        conn: &mut PgConnection,
        scope: &PhaseScope,
    ) -> anyhow::Result<Prepared<Self::Row, Self::Item>>;

    fn registration(row: &Self::Row) -> &CreditRegistration;

    /// The student number this row's request carried, where it carried one: a number the registry
    /// rejects may only cost the link it was sent under.
    fn sent_student_number(_row: &Self::Row) -> Option<&DbSecret> {
        None
    }

    async fn send(
        &self,
        ctx: &PhaseContext<'_>,
        rows: &[Self::Row],
        items: Vec<Self::Item>,
    ) -> Result<SuotarBatchResponse<Self::Result>, UtilError>;

    /// Applies one answer, or the absence of one, to its row. Returns whether the row ended up in a
    /// failure state; errors with `PreconditionFailed` if another writer moved the row meanwhile.
    async fn apply(
        &self,
        conn: &mut PgConnection,
        row: &Self::Row,
        item: Option<&SuotarResponseItem<Self::Result>>,
        event: OutcomeEvent<'_>,
    ) -> anyhow::Result<bool>;

    /// What one row gets when the study registry rejected the whole request.
    async fn apply_request_rejection(
        &self,
        conn: &mut PgConnection,
        row: &Self::Row,
        request: &serde_json::Value,
        request_item_id: &str,
        error: &UtilError,
    ) -> anyhow::Result<bool>;

    /// Whether a whole-request refusal is one that some rows of the batch alone may have caused, and
    /// that proves nothing was acted on: the batch is then split in halves, each sent again, until
    /// the rows it keeps refusing are alone in their batch.
    fn isolates_request_rejection(_error: &UtilError) -> bool {
        false
    }

    /// Called before each send after a split, with every row the split still holds, so the ones
    /// waiting their turn are not taken for a worker that died mid-call.
    async fn keep_in_flight(
        &self,
        _conn: &mut PgConnection,
        _rows: &[&Self::Row],
    ) -> anyhow::Result<()> {
        Ok(())
    }

    /// What a row gets when [`Self::isolates_request_rejection`] still refuses it in a batch of its
    /// own.
    async fn apply_isolated_rejection(
        &self,
        conn: &mut PgConnection,
        row: &Self::Row,
        request: &serde_json::Value,
        request_item_id: &str,
        error: &UtilError,
    ) -> anyhow::Result<bool> {
        self.apply_request_rejection(conn, row, request, request_item_id, error)
            .await
    }
}

/// Runs one iteration of a [`SuotarBatchPhase`].
///
/// `items_processed` counts the rows this iteration wrote a decision for: the preflight's included,
/// the ones another writer had moved on before the answer could be applied excluded.
/// `items_failed` counts how many of those ended up carrying an error code.
pub(crate) async fn run_suotar_batch_phase<P: SuotarBatchPhase>(
    phase: &mut P,
    ctx: &PhaseContext<'_>,
    scope: &PhaseScope,
) -> anyhow::Result<PhaseRunOutcome> {
    let mut conn = ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let prepared = phase.prepare(ctx, &mut tx, scope).await?;
    tx.commit().await?;
    // Held only for the claim; the Suotar call below can pin it for the whole request timeout.
    drop(conn);

    let mut processed = prepared.decided;
    let mut items_failed = prepared.failed;
    let mut error = None;
    let mut has_suotar_failure = false;
    // The halves a split holds back wait in whatever state the preflight left them, which for
    // import is `submitting`: no phase claims that, so none of them can be sent twice meanwhile.
    // Each answered half is written before the next one is sent.
    let mut batches = vec![prepared.sendable];
    let mut has_split = false;
    while let Some(batch) = batches.pop() {
        if batch.is_empty() {
            continue;
        }
        if has_split {
            let held: Vec<&P::Row> = batch
                .iter()
                .chain(batches.iter().flatten())
                .map(|(row, _)| row)
                .collect();
            let mut conn = ctx.pool.acquire().await?;
            phase.keep_in_flight(&mut conn, &held).await?;
        }
        let (rows, items): (Vec<_>, Vec<_>) = batch.into_iter().unzip();
        let requests = requests_json(&items);
        let request_item_ids: Vec<String> = items
            .iter()
            .map(|item| item.request_item_id().to_string())
            .collect();

        let response = match phase.send(ctx, &rows, items.clone()).await {
            Ok(response) => response,
            Err(send_error) if P::isolates_request_rejection(&send_error) && rows.len() > 1 => {
                warn!(
                    "The study registry refused a batch of {} as a whole; splitting it to find the rows it refuses. {}",
                    rows.len(),
                    send_error.message()
                );
                let mut halves: Vec<(P::Row, P::Item)> = rows
                    .into_iter()
                    .zip(items.into_iter().map(|mut item| {
                        item.renew_request_item_id();
                        item
                    }))
                    .collect();
                let second = halves.split_off(halves.len() / 2);
                batches.push(second);
                batches.push(halves);
                has_split = true;
                continue;
            }
            Err(send_error) => {
                let isolated = P::isolates_request_rejection(&send_error);
                let mut conn = ctx.pool.acquire().await?;
                for (row, request, request_item_id) in izip!(&rows, &requests, &request_item_ids) {
                    let applied = if isolated {
                        phase
                            .apply_isolated_rejection(
                                &mut conn,
                                row,
                                request,
                                request_item_id,
                                &send_error,
                            )
                            .await
                    } else {
                        phase
                            .apply_request_rejection(
                                &mut conn,
                                row,
                                request,
                                request_item_id,
                                &send_error,
                            )
                            .await
                    };
                    count_applied(
                        applied,
                        P::registration(row),
                        &mut processed,
                        &mut items_failed,
                    )?;
                }
                error = Some(scrub_text(send_error.message()));
                has_suotar_failure = true;
                continue;
            }
        };

        let mut conn = ctx.pool.acquire().await?;
        for (row, request, request_item_id) in izip!(&rows, &requests, &request_item_ids) {
            let response_json = response_item_json(&response.raw_response, request_item_id);
            let event = OutcomeEvent {
                suotar_api_call_id: response.call_id,
                request_item_id: Some(request_item_id),
                request: Some(request),
                response: response_json.as_ref(),
                sent_student_number: P::sent_student_number(row),
                ..OutcomeEvent::default()
            };
            let applied = phase
                .apply(&mut conn, row, response.item(request_item_id), event)
                .await;
            count_applied(
                applied,
                P::registration(row),
                &mut processed,
                &mut items_failed,
            )?;
        }
        if every_item_service_unavailable(&response) {
            error = Some(P::ALL_UNAVAILABLE_ERROR.to_string());
            has_suotar_failure |= !response
                .items
                .iter()
                .all(|item| is_sisu_timeout_code(response.endpoint, &item.code));
        }
    }

    Ok(PhaseRunOutcome {
        items_processed: processed,
        items_failed,
        is_sisu_outage: error.is_some() && !has_suotar_failure,
        error,
    })
}

/// Counts one written row, or skips one that had already moved on. Skipped rather than propagated:
/// the row belongs to whoever moved it, and aborting would leave the rest of the batch in the state
/// the preflight wrote, which no phase claims again.
fn count_applied(
    applied: anyhow::Result<bool>,
    row: &CreditRegistration,
    processed: &mut i32,
    items_failed: &mut i32,
) -> anyhow::Result<()> {
    match applied {
        Ok(failed) => {
            *processed += 1;
            *items_failed += i32::from(failed);
            Ok(())
        }
        Err(error) if row_moved_on(&error) => {
            warn!(
                "Credit registration {} moved on while the study registry answered; leaving it. {error:#}",
                row.id
            );
            Ok(())
        }
        Err(error) => Err(error),
    }
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
pub(crate) fn listed_person_addresses(person: &ListedPerson) -> Vec<DbSecret> {
    [&person.primary_email, &person.secondary_email]
        .into_iter()
        .flatten()
        .filter(|address| !address.expose_secret().trim().is_empty())
        .map(|address| DbSecret::from(address.clone()))
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
        && event.sent_student_number.map(ExposeSecret::expose_secret)
            == Some(linked.student_number.expose_secret())
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
            error_message: event.error_message.map(scrub_text),
            event_kind: CreditRegistrationEventKind::SuotarResponse,
            event_message: event.message.map(str::to_string),
            suotar_api_call_id: event.suotar_api_call_id,
            event_details: Some(suotar_exchange_details(event.request, event.response)),
            request_item_id: event.request_item_id.map(str::to_string),
            ..outcome_transition(outcome, expected_from_state)
        },
    )
    .await?;
    Ok(())
}

/// The ledger write one decided outcome asks for, without the audit half [`apply_outcome`] adds.
/// For the paths that decide an outcome without an exchange to record.
pub(crate) fn outcome_transition(
    outcome: &Outcome,
    expected_from_state: Option<CreditRegistrationState>,
) -> Transition {
    Transition {
        error_code: outcome.error_code,
        needs_admin_attention: outcome.needs_admin_attention,
        expected_from_state,
        next_attempt_at: outcome
            .delay_secs
            .map(|delay_secs| next_attempt_at(Utc::now(), delay_secs)),
        ..Transition::to(outcome.to_state)
    }
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
/// item, so a verify poll that is still waiting is not one.
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

/// Whether the whole batch came back saying "not now". Failing the iteration on it is what opens the
/// circuit breaker; a batch with one good item is a success, because something moved.
pub(crate) fn every_item_service_unavailable<R>(response: &SuotarBatchResponse<R>) -> bool {
    !response.items.is_empty()
        && response.items.iter().all(|item| {
            item.status == SuotarItemStatus::Error
                && is_service_unavailable_code(response.endpoint, &item.code)
        })
}

/// Applies one request-level outcome to one row of a batch the study registry rejected whole.
/// Returns whether the row ended up carrying an error code.
///
/// `expected_from_state` is the state the phase's own preflight put every row in, since the rows
/// were read before that transition and are stale by the time this runs.
pub(crate) async fn apply_request_level_outcome(
    conn: &mut PgConnection,
    endpoint: SuotarEndpoint,
    row: &CreditRegistration,
    request: &serde_json::Value,
    request_item_id: &str,
    error: &UtilError,
    expected_from_state: CreditRegistrationState,
) -> anyhow::Result<bool> {
    let outcome = request_level_outcome(endpoint, suotar_error_variant(error), &row_facts(row));
    apply_outcome(
        conn,
        row,
        &outcome,
        OutcomeEvent {
            message: Some("The study registry rejected the whole request."),
            error_message: Some(error.message()),
            request_item_id: Some(request_item_id),
            request: Some(request),
            ..OutcomeEvent::default()
        },
        Some(expected_from_state),
    )
    .await?;
    Ok(counts_as_failed(&outcome))
}

/// A failure that never reached the study registry is safe to send again; everything else may have
/// been acted on. Anything that is not a client error was raised before the request was built.
pub(crate) fn suotar_error_variant(error: &UtilError) -> SuotarErrorVariant {
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
    pub sent_student_number: Option<&'a DbSecret>,
    pub message: Option<&'a str>,
    /// Persisted on the ledger row, so it is scrubbed before it is written.
    pub error_message: Option<&'a str>,
    pub suotar_api_call_id: Option<Uuid>,
    /// The requestItemId the row went out under in that call.
    pub request_item_id: Option<&'a str>,
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
    fn a_locale_narrows_to_the_language_the_templates_are_stored_under() {
        assert_eq!(template_language("fi-FI"), "fi");
        assert_eq!(template_language("en_US"), "en");
        assert_eq!(template_language("en"), "en");
    }

    #[test]
    fn a_response_item_is_found_by_its_request_item_id() {
        let raw = serde_json::json!([
            { "requestItemId": "item-1", "status": "ok", "code": "sent" },
            { "requestItemId": "item-2", "status": "error", "code": "sisuTimeout" },
        ]);
        assert_eq!(
            response_item_json(&raw, "item-2").and_then(|item| item
                .get("code")
                .and_then(|code| code.as_str().map(str::to_string))),
            Some("sisuTimeout".to_string())
        );
        assert_eq!(response_item_json(&raw, "item-9"), None);
    }
}
