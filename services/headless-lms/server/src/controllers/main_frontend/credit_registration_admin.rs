/*!
Handlers for HTTP requests to `/api/v0/main-frontend/credit-registration-admin`.

Every mutating handler writes its `credit_registration_admin_actions` row in the transaction that has
the effect. Admins see recipient addresses in full and the scrubbed study registry bodies; the
registry's own error text is returned to nobody.
*/

use headless_lms_models::course_credit_registration_consents;
use headless_lms_models::credit_registration_account_linking_emails::{
    self, StaleUnclaimedLinkingMails,
};
use headless_lms_models::credit_registration_admin_actions::{
    CreditRegistrationAdminAction, CreditRegistrationAdminActionRecord,
    CreditRegistrationAdminActionTarget, NewCreditRegistrationAdminAction,
};
use headless_lms_models::credit_registration_events::CreditRegistrationEventKind;
use headless_lms_models::credit_registrations::{
    AdminCreditRegistration, AdminCreditRegistrationFilters, AdminCreditRegistrationSort,
    CreditRegistrationErrorCode, CreditRegistrationErrorCodeCount, CreditRegistrationState,
    OldestNonTerminalRegistration, StuckRegistrationCount, Transition,
};
use headless_lms_models::email_deliveries::{EmailSendStatus, EmailSendStatusReport};
use headless_lms_models::library::credit_registration::account_linking::{
    LINKING_MAIL_QUIET_PERIOD_SECS, MAX_LINKING_MAILS_PER_PERSON_AND_COURSE,
};
use headless_lms_models::library::credit_registration::materialize::{
    MATERIALIZE_LIMIT, ensure_registration_rows_for_eligible_completions,
};
use headless_lms_models::library::credit_registration::preconditions::{
    PRECONDITIONS_LIMIT, recompute_preconditions,
};
use headless_lms_models::library::students_view::escape_like_pattern;
use headless_lms_models::suotar_api_calls::{
    SuotarEndpoint, SuotarEndpointStanding as SuotarEndpointStandingRow,
    SuotarEndpointStatsForWindow,
};
use headless_lms_models::verified_student_numbers::{
    AdminVerifiedStudentNumber, NewVerifiedStudentNumber, StudentNumberVerificationMethod,
};
use headless_lms_models::{
    course_module_suotar_realisations, credit_registration_phase_state, credit_registrations,
    student_number_verification_tokens, suotar_api_calls, verified_student_numbers,
};
use std::collections::HashMap;
use utoipa::{OpenApi, ToSchema};

use crate::domain::credit_registration::health::{
    CreditRegistrationHealth, PHASE_HEARTBEAT_INTERVAL_MULTIPLIER, evaluate, stuck_thresholds,
};
use crate::domain::credit_registration_phases::breaker::{
    MAX_CONSECUTIVE_SUOTAR_FAILURES, ScopeKey, snapshot,
};
use crate::domain::credit_registration_phases::linking_mail_resend::{
    LinkingMailResendOutcome, resend_linking_mail,
};
use crate::domain::credit_registration_phases::{CreditRegistrationPhase, PhaseContext};
use crate::prelude::*;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_utils::services::suotar::{ResolvePersonRequestItem, SuotarCallContext};

const THROUGHPUT_DAYS: i64 = 30;

const ENDPOINT_STATS_WINDOWS_SECS: [i64; 3] = [60 * 60, 24 * 60 * 60, 7 * 24 * 60 * 60];

/// A fat-finger guard on top of the per-person caps, which this endpoint can only override by retiring
/// ledger rows.
const RESEND_QUIET_PERIOD_SECS: i64 = 60;

const STALE_UNCLAIMED_LIMIT: i64 = 200;

/// Marks a manual action's study registry call in the call log as something a person set off.
const RESEND_CALLER: &str = "admin-resend";
const RESOLVE_CALLER: &str = "admin-resolve-person";

const GLOBAL_ADMIN_ROLE: &str = "global_admin";

#[derive(OpenApi)]
#[openapi(paths(
    get_credit_registration_overview,
    get_suotar_health,
    list_credit_registrations_for_admin,
    get_credit_registration_for_admin,
    admin_transition_credit_registration,
    get_account_linking_stats,
    list_verified_student_numbers_for_admin,
    admin_unlink_student_number,
    admin_resend_account_linking_email,
    admin_resolve_student_number_for_linking,
    admin_manually_link_student_number,
    admin_materialize_credit_registrations,
    admin_pause_phase,
    admin_resume_phase,
    admin_run_phase_now
))]
pub(crate) struct MainFrontendCreditRegistrationAdminApiDoc;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationStateTotal {
    pub state: CreditRegistrationState,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationErrorCodeTotal {
    pub error_code: CreditRegistrationErrorCode,
    /// Rows the pipeline is still working on.
    pub in_flight_count: i64,
    /// Rows that ended on this code.
    pub terminal_failure_count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationOldestNonTerminal {
    pub credit_registration_id: Uuid,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationThroughputBucket {
    pub day: DateTime<Utc>,
    pub registered_count: i64,
    /// `duplicate` and `not_improved`: the credit exists, and we did not put it there.
    pub other_success_count: i64,
    pub failed_count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationStuckTotal {
    pub state: CreditRegistrationState,
    pub count: i64,
    pub severely_stuck_count: i64,
    pub oldest_state_entered_at: Option<DateTime<Utc>>,
}

/// Where one study registry endpoint stands, over all time.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct SuotarEndpointStanding {
    pub endpoint: SuotarEndpoint,
    pub last_success_at: Option<DateTime<Utc>>,
    pub last_failure_at: Option<DateTime<Utc>>,
    pub consecutive_failures: i64,
}

/// The circuit breaker as this web process holds it. The global key only — a narrowed run gets its own
/// — and the counters live in process memory, so this says whether this server would currently skip a
/// study registry call, not whether the workers would.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationCircuitBreakerState {
    pub open: bool,
    pub consecutive_failures: i64,
    pub open_for_secs: Option<i64>,
    pub trips_after_consecutive_failures: i64,
}

/// One pipeline phase's heartbeat, written by the worker loops and by unscoped runs only, never by a
/// narrowed one.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationPhaseStatus {
    pub phase: String,
    pub process_name: String,
    pub expected_interval_secs: i32,
    pub last_heartbeat_at: Option<DateTime<Utc>>,
    pub last_success_at: Option<DateTime<Utc>>,
    pub last_run_finished_at: Option<DateTime<Utc>>,
    pub items_processed_last_run: Option<i32>,
    pub items_failed_last_run: Option<i32>,
    pub consecutive_failures: i32,
    pub paused_at: Option<DateTime<Utc>>,
    pub pause_reason: Option<String>,
    /// No implementation is registered for the phase yet, so it has never reported and will not.
    pub implemented: bool,
    /// Computed server-side: a page comparing its own clock against a server timestamp misjudges this
    /// on a skewed client.
    pub seconds_since_heartbeat: Option<i64>,
    /// `seconds_since_heartbeat > expected_interval_secs * health.thresholds.phase_heartbeat_interval_multiplier`.
    /// Always `false` while paused or never heartbeated.
    pub heartbeat_late: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationOverview {
    pub health: CreditRegistrationHealth,
    pub counts_by_state: Vec<CreditRegistrationStateTotal>,
    pub error_codes: Vec<CreditRegistrationErrorCodeTotal>,
    pub needs_admin_attention_count: i64,
    pub oldest_non_terminal: Option<CreditRegistrationOldestNonTerminal>,
    pub throughput: Vec<CreditRegistrationThroughputBucket>,
    pub throughput_days: i64,
    pub stuck: Vec<CreditRegistrationStuckTotal>,
    pub endpoints: Vec<SuotarEndpointStanding>,
    pub circuit_breaker: CreditRegistrationCircuitBreakerState,
    pub phases: Vec<CreditRegistrationPhaseStatus>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct SuotarEndpointWindowStats {
    pub endpoint: SuotarEndpoint,
    pub call_count: i64,
    pub failed_call_count: i64,
    pub in_flight_count: i64,
    pub ok_item_count: i64,
    pub error_item_count: i64,
    pub p50_duration_ms: Option<i32>,
    pub p95_duration_ms: Option<i32>,
    pub last_success_at: Option<DateTime<Utc>>,
    pub last_failure_at: Option<DateTime<Utc>>,
    /// The registry's own request-level code, an identifier rather than prose.
    pub last_request_level_error_code: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct SuotarHealthWindow {
    pub window_secs: i64,
    pub endpoints: Vec<SuotarEndpointWindowStats>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct SuotarHealth {
    pub windows: Vec<SuotarHealthWindow>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminCreditRegistrationRow {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    /// In full: masking it would leave support unable to answer the question they were asked.
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub course_instance_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub needs_admin_attention: bool,
    pub next_attempt_at: DateTime<Utc>,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub registered_at: Option<DateTime<Utc>>,
    pub terminal_at: Option<DateTime<Utc>>,
    /// Frozen on the row before it was sent, so it is what we actually submitted.
    pub student_number: Option<String>,
    pub sisu_person_id: Option<String>,
    pub uh_course_code: Option<String>,
    pub selected_enrolment_id: Option<String>,
    pub grade_scale_id: Option<String>,
    pub grade_id: Option<String>,
    pub credits: Option<f32>,
    pub request_item_id: String,
    pub submitted_attainment_id: Option<String>,
    pub sisu_attainment_id: Option<String>,
    pub submit_retry_count: i32,
    pub verify_attempt_count: i32,
    pub attempt_number: i32,
    pub superseded: bool,
    pub superseded_by_id: Option<Uuid>,
    /// The account's link now, which is not always the number frozen on the row.
    pub verified_student_number: Option<String>,
    pub verified_student_number_at: Option<DateTime<Utc>>,
    /// `admin_manual` means support established the link rather than the student proving it.
    pub verified_student_number_via: Option<StudentNumberVerificationMethod>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminCreditRegistrationsPage {
    pub data: Vec<AdminCreditRegistrationRow>,
    pub total_count: i64,
    pub total_pages: u32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminCreditRegistrationEvent {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub kind: CreditRegistrationEventKind,
    pub from_state: Option<CreditRegistrationState>,
    pub to_state: Option<CreditRegistrationState>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    /// Our own wording, written by the pipeline or by whoever acted.
    pub message: Option<String>,
    pub actor_user_id: Option<Uuid>,
    pub suotar_api_call_id: Option<Uuid>,
    /// The `{request, response}` pair, scrubbed at write time: names, student numbers and email
    /// addresses read `[redacted]` while their keys survive. The values we sent are on the row.
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminSuotarApiCall {
    pub id: Uuid,
    pub endpoint: SuotarEndpoint,
    pub started_at: DateTime<Utc>,
    pub duration_ms: Option<i32>,
    pub http_status: Option<i32>,
    pub succeeded: bool,
    pub request_item_count: i32,
    pub ok_item_count: i32,
    pub error_item_count: i32,
    pub request_level_error_code: Option<String>,
    pub worker_name: String,
    /// Scrubbed and sampled at write time.
    pub request_body_sample: Option<serde_json::Value>,
    pub response_body_sample: Option<serde_json::Value>,
    pub credit_registration_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminLinkingEmail {
    pub id: Uuid,
    pub course_id: Uuid,
    pub student_number: String,
    pub sisu_person_id: String,
    /// In full.
    pub emailed_to: String,
    pub claimed_at: DateTime<Utc>,
    pub send_status: EmailSendStatusReport,
    pub token_claimed_by_user_id: Option<Uuid>,
    pub token_used_at: Option<DateTime<Utc>>,
    pub token_expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminCreditRegistrationDetails {
    pub registration: AdminCreditRegistrationRow,
    /// Every attempt for the same completion, newest first, this one included.
    pub attempts: Vec<AdminCreditRegistrationRow>,
    pub events: Vec<AdminCreditRegistrationEvent>,
    /// The calls the timeline refers to, newest first.
    pub suotar_api_calls: Vec<AdminSuotarApiCall>,
    /// Admin and teacher actions targeting this row.
    pub actions: Vec<CreditRegistrationAdminActionRecord>,
    /// Every mail addressed to this person, on any course.
    pub linking_emails: Vec<AdminLinkingEmail>,
    pub consent_given: Option<bool>,
    pub consent_withdrawn_at: Option<DateTime<Utc>>,
}

/// What an admin may move a row to; everything else is the pipeline's to decide.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AdminCreditRegistrationTransitionTarget {
    /// Resubmit: the escape hatch out of `submission_uncertain`, and how a `misregistered` row is
    /// tried again.
    ReadyToSubmit,
    Cancelled,
    /// Leaves the state alone and stops the row asking for a human.
    ClearNeedsAdminAttention,
    /// Leaves the state alone and makes the row due, so the phase owning its state claims it on the
    /// next pass instead of waiting out a backoff of up to a day.
    CheckNow,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminTransitionCreditRegistrationPayload {
    pub to_state: AdminCreditRegistrationTransitionTarget,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AdminTransitionOutcome {
    Applied,
    /// The student has not consented, or has withdrawn.
    RefusedWithoutConsent,
    NoChange,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminTransitionCreditRegistrationResult {
    pub outcome: AdminTransitionOutcome,
    pub state: CreditRegistrationState,
    pub needs_admin_attention: bool,
}

/// The account-linking funnel. The `_last_run` steps come from counters the discovery phase overwrites
/// whole, the `_in_window` ones from the window: there is no single denominator.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingFunnel {
    pub persons_discovered_last_run: i64,
    pub already_linked_last_run: i64,
    pub mails_claimed_in_window: i64,
    pub mails_sent_in_window: i64,
    pub numbers_claimed_in_window: i64,
    /// Never folded into the claimed count: an admin's judgement is not a claim.
    pub manual_links_in_window: i64,
    pub suppressed_by_dedup_last_run: i64,
    pub suppressed_by_rate_cap_last_run: i64,
    pub no_address_in_study_registry_last_run: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingSendStatusTotals {
    pub queued: i64,
    pub retrying: i64,
    pub sent: i64,
    pub send_failed: i64,
}

/// Hard send failures grouped by recipient domain.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingFailureDomain {
    pub domain: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingRealisationCounters {
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub course_unit_realisation_id: String,
    pub label: Option<String>,
    pub uh_course_code: Option<String>,
    /// When the counters below were collected. Not the last attempt: a failing realisation keeps the
    /// last roster that arrived.
    pub last_listed_at: Option<DateTime<Utc>>,
    pub last_listing_attempted_at: Option<DateTime<Utc>>,
    /// Set while the listing attempts since `last_listed_at` are failing, so an empty course and an
    /// unreachable one do not read alike.
    pub last_listing_error: Option<CreditRegistrationErrorCode>,
    pub consecutive_listing_failures: i32,
    pub listed_person_count: Option<i32>,
    pub already_linked_count: Option<i32>,
    pub mailed_count: Option<i32>,
    pub suppressed_by_dedup_count: Option<i32>,
    pub suppressed_by_rate_cap_count: Option<i32>,
    /// Persons the registry holds no address for: the one population no remedy here can reach.
    pub no_address_count: Option<i32>,
}

/// A person mailed to the cap for one course whose number was never claimed.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingStaleAddress {
    pub student_number: String,
    pub sisu_person_id: String,
    pub course_id: Uuid,
    pub course_name: String,
    pub mail_count: i64,
    pub first_sent_at: DateTime<Utc>,
    pub last_sent_at: DateTime<Utc>,
    /// In full, newest last, one per mail.
    pub addresses: Vec<String>,
    pub send_statuses: Vec<EmailSendStatus>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct VerifiedStudentNumberMethodTotal {
    pub verified_via: StudentNumberVerificationMethod,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AccountLinkingStats {
    pub window_secs: i64,
    pub funnel: AccountLinkingFunnel,
    pub send_status_totals: AccountLinkingSendStatusTotals,
    pub hard_failure_domains: Vec<AccountLinkingFailureDomain>,
    pub realisations: Vec<AccountLinkingRealisationCounters>,
    pub stale_addresses: Vec<AccountLinkingStaleAddress>,
    pub links_total_by_method: Vec<VerifiedStudentNumberMethodTotal>,
    pub links_in_window_by_method: Vec<VerifiedStudentNumberMethodTotal>,
    /// Accounts with a consented completion still waiting for a number.
    pub waiting_for_student_number_count: i64,
    pub max_mails_per_person_and_course: i64,
    pub quiet_period_secs: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminVerifiedStudentNumberRow {
    pub id: Uuid,
    pub user_id: Uuid,
    /// In full.
    pub user_email: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub student_number: String,
    pub sisu_person_id: String,
    pub verified_at: DateTime<Utc>,
    pub verified_via: StudentNumberVerificationMethod,
    /// The registry-held address the proof rests on, in full. `None` for an admin-established link.
    pub verified_via_email: Option<String>,
    pub linked_by_user_id: Option<Uuid>,
    pub link_reason: Option<String>,
    pub verified_from_course_id: Option<Uuid>,
    pub live_registration_count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminVerifiedStudentNumbersPage {
    pub data: Vec<AdminVerifiedStudentNumberRow>,
    pub total_count: i64,
    pub total_pages: u32,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminUnlinkStudentNumberPayload {
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminUnlinkStudentNumberResult {
    /// Registrations that went back to waiting for a number.
    pub affected_registration_count: i64,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminResendAccountLinkingEmailPayload {
    pub student_number: String,
    pub course_id: Uuid,
    /// Retires the mails a cap is counting, then runs the ordinary send path. Requires a reason.
    pub override_rate_caps: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AdminResendOutcome {
    /// A mail is owed and the sender is handed it on the next run.
    Queued,
    AlreadyMailedToEveryKnownAddress,
    /// A cap refused it. Overridable here, and nowhere else.
    RefusedByRateCap,
    NoAddressInStudyRegistry,
    NotOnTheCourseRoster,
    /// A link already exists, so no mail is owed.
    AlreadyLinked,
    StudyRegistryUnavailable,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminResendAccountLinkingEmailResult {
    pub outcome: AdminResendOutcome,
    /// Mails retired to get past a cap. Always zero without an override.
    pub retired_mail_count: i64,
    pub linking_emails: Vec<AdminLinkingEmail>,
    pub mails_sent_for_this_course: i64,
    pub max_mails_per_person_and_course: i64,
    pub quiet_period_secs: i64,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminResolveStudentNumberPayload {
    pub student_number: String,
}

/// The preview a manual link is gated on. No addresses from the registry — `resolve-persons` answers
/// with a name and an id only — so the addresses here are the ones we mailed.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminResolveStudentNumberResult {
    pub found: bool,
    pub student_number: String,
    /// Echoed back to the manual-link endpoint, which refuses without it.
    pub sisu_person_id: Option<String>,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
    /// The registry's own per-item code, an identifier rather than prose.
    pub code: Option<String>,
    pub study_registry_unavailable: bool,
    pub already_linked_to_user_id: Option<Uuid>,
    pub already_linked_to_user_email: Option<String>,
    pub already_linked_via: Option<StudentNumberVerificationMethod>,
    pub linking_emails: Vec<AdminLinkingEmail>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminManuallyLinkStudentNumberPayload {
    pub user_id: Uuid,
    pub student_number: String,
    /// From the preview. Re-resolved on arrival, and a mismatch is refused, so a typo cannot mint a
    /// link to somebody else.
    pub sisu_person_id: String,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AdminManualLinkOutcome {
    Linked,
    /// The registry does not know the number.
    StudentNumberNotFound,
    /// The registry named a different person than the preview did.
    PreviewMismatch,
    /// The number is live on another account. Unlink that one first.
    AlreadyLinkedToAnotherAccount,
    AlreadyLinkedToThisAccount,
    StudyRegistryUnavailable,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminManuallyLinkStudentNumberResult {
    pub outcome: AdminManualLinkOutcome,
    pub verified_student_number_id: Option<Uuid>,
    /// Registrations the link unblocked.
    pub affected_registration_count: i64,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminMaterializePayload {
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminMaterializeResult {
    pub created_registration_count: i64,
    pub moved_registration_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct ListCreditRegistrationsQuery {
    page: Option<u32>,
    limit: Option<u32>,
    state: Option<Vec<CreditRegistrationState>>,
    error_code: Option<Vec<CreditRegistrationErrorCode>>,
    course_id: Option<Uuid>,
    course_module_id: Option<Uuid>,
    user_id: Option<Uuid>,
    student_number: Option<String>,
    needs_admin_attention: Option<bool>,
    submitted_after: Option<DateTime<Utc>>,
    submitted_before: Option<DateTime<Utc>>,
    search: Option<String>,
    include_superseded: Option<bool>,
    sort: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AccountLinkingStatsQuery {
    window_days: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct ListVerifiedStudentNumbersQuery {
    page: Option<u32>,
    limit: Option<u32>,
    verified_via: Option<StudentNumberVerificationMethod>,
    search: Option<String>,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/overview` - Everything the Overview tab and the
alert banner render, in one request so the tiles cannot contradict each other.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/overview",
    operation_id = "getCreditRegistrationOverview",
    tag = "credit-registration-admin",
    responses(
        (status = 200, description = "Counts, throughput, phase heartbeats and the active alerts", body = CreditRegistrationOverview)
    )
)]
pub async fn get_credit_registration_overview(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<CreditRegistrationOverview>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let stuck_rows = credit_registrations::count_stuck(&mut conn, &stuck_thresholds()).await?;
    let health = evaluate(&mut conn, &stuck_rows).await?;
    let counts_by_state = credit_registrations::count_by_state(&mut conn)
        .await?
        .into_iter()
        .map(|(state, count)| CreditRegistrationStateTotal { state, count })
        .collect();
    let error_codes = credit_registrations::count_by_error_code(&mut conn)
        .await?
        .into_iter()
        .map(to_error_code_total)
        .collect();
    let needs_admin_attention_count =
        credit_registrations::count_needing_admin_attention(&mut conn).await?;
    let oldest_non_terminal = credit_registrations::get_oldest_non_terminal(&mut conn)
        .await?
        .map(to_oldest_non_terminal);
    let throughput = credit_registrations::get_throughput_by_day(
        &mut conn,
        Utc::now() - chrono::Duration::days(THROUGHPUT_DAYS),
    )
    .await?
    .into_iter()
    .map(|row| CreditRegistrationThroughputBucket {
        day: row.day,
        registered_count: row.registered_count,
        other_success_count: row.other_success_count,
        failed_count: row.failed_count,
    })
    .collect();
    let stuck = stuck_rows.into_iter().map(to_stuck_total).collect();
    let endpoints = suotar_api_calls::get_endpoint_standings(&mut conn)
        .await?
        .into_iter()
        .map(to_endpoint_standing)
        .collect();
    let phases = phase_statuses(&mut conn).await?;

    token.authorized_ok(web::Json(CreditRegistrationOverview {
        health,
        counts_by_state,
        error_codes,
        needs_admin_attention_count,
        oldest_non_terminal,
        throughput,
        throughput_days: THROUGHPUT_DAYS,
        stuck,
        endpoints,
        circuit_breaker: circuit_breaker_state(),
        phases,
    }))
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/suotar-health` - Per-endpoint call counts,
success rates and latency percentiles over an hour, a day and a week.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/suotar-health",
    operation_id = "getSuotarHealth",
    tag = "credit-registration-admin",
    responses(
        (status = 200, description = "Study registry traffic per endpoint and window", body = SuotarHealth)
    )
)]
pub async fn get_suotar_health(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<SuotarHealth>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let mut by_window: HashMap<i64, Vec<SuotarEndpointWindowStats>> = HashMap::new();
    for row in
        suotar_api_calls::get_endpoint_stats_for_windows(&mut conn, &ENDPOINT_STATS_WINDOWS_SECS)
            .await?
    {
        by_window
            .entry(row.window_secs)
            .or_default()
            .push(to_endpoint_window_stats_for_window(row));
    }
    let windows = ENDPOINT_STATS_WINDOWS_SECS
        .into_iter()
        .map(|window_secs| SuotarHealthWindow {
            window_secs,
            endpoints: by_window.remove(&window_secs).unwrap_or_default(),
        })
        .collect();

    token.authorized_ok(web::Json(SuotarHealth { windows }))
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/registrations` - A page of the ledger, filtered
and sorted.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/registrations",
    operation_id = "listCreditRegistrationsForAdmin",
    tag = "credit-registration-admin",
    params(
        ("page" = Option<u32>, Query, description = "Page number, from 1"),
        ("limit" = Option<u32>, Query, description = "Rows per page"),
        ("state" = Option<Vec<CreditRegistrationState>>, Query, description = "Ledger states; repeat the parameter for several"),
        ("error_code" = Option<Vec<CreditRegistrationErrorCode>>, Query, description = "Error codes; repeat the parameter for several"),
        ("course_id" = Option<Uuid>, Query, description = "Course filter"),
        ("course_module_id" = Option<Uuid>, Query, description = "Course module filter"),
        ("user_id" = Option<Uuid>, Query, description = "Student filter"),
        ("student_number" = Option<String>, Query, description = "Exact student number, frozen on the row or linked to the account"),
        ("needs_admin_attention" = Option<bool>, Query, description = "Only rows asking for a human"),
        ("submitted_after" = Option<DateTime<Utc>>, Query, description = "Submitted at or after"),
        ("submitted_before" = Option<DateTime<Utc>>, Query, description = "Submitted at or before"),
        ("search" = Option<String>, Query, description = "Name, email, student number, attainment id, stored error text, or a uuid"),
        ("include_superseded" = Option<bool>, Query, description = "Include replaced attempts"),
        ("sort" = Option<String>, Query, description = "last_activity, created, time_in_state or attempts")
    ),
    responses(
        (status = 200, description = "A page of the ledger", body = AdminCreditRegistrationsPage)
    )
)]
pub async fn list_credit_registrations_for_admin(
    user: AuthUser,
    pool: web::Data<PgPool>,
    query: web::Query<ListCreditRegistrationsQuery>,
) -> ControllerResult<web::Json<AdminCreditRegistrationsPage>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let pagination = Pagination::new(query.page.unwrap_or(1), query.limit.unwrap_or(50))
        .map_err(|e| controller_err!(BadRequest, e.to_string()))?;
    let search = query
        .search
        .as_deref()
        .map(str::trim)
        .filter(|search| !search.is_empty());
    let student_number = query
        .student_number
        .as_deref()
        .map(str::trim)
        .filter(|number| !number.is_empty());
    let filters = AdminCreditRegistrationFilters {
        states: query.state.as_deref(),
        error_codes: query.error_code.as_deref(),
        course_id: query.course_id,
        course_module_id: query.course_module_id,
        user_id: query.user_id,
        student_number,
        needs_admin_attention: query.needs_admin_attention.unwrap_or(false),
        submitted_after: query.submitted_after,
        submitted_before: query.submitted_before,
        search,
        search_id: search.and_then(|search| Uuid::parse_str(search).ok()),
        include_superseded: query.include_superseded.unwrap_or(false),
    };
    let sort = match query.sort.as_deref() {
        Some("created") => AdminCreditRegistrationSort::Created,
        Some("time_in_state") => AdminCreditRegistrationSort::TimeInState,
        Some("attempts") => AdminCreditRegistrationSort::Attempts,
        _ => AdminCreditRegistrationSort::LastActivity,
    };

    let total_count = credit_registrations::count_admin_facing(&mut conn, &filters).await?;
    let data = credit_registrations::get_admin_facing(
        &mut conn,
        &filters,
        sort,
        pagination.limit(),
        pagination.offset(),
    )
    .await?
    .into_iter()
    .map(to_admin_row)
    .collect();

    token.authorized_ok(web::Json(AdminCreditRegistrationsPage {
        data,
        total_count,
        total_pages: pagination.total_pages(u32::try_from(total_count).unwrap_or(u32::MAX)),
    }))
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/registrations/{credit_registration_id}` - One
row with its timeline, the calls that timeline refers to, the other attempts for the same completion,
the actions taken on it and its linking mails.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/registrations/{credit_registration_id}",
    operation_id = "getCreditRegistrationForAdmin",
    tag = "credit-registration-admin",
    params(("credit_registration_id" = Uuid, Path, description = "Credit registration id")),
    responses(
        (status = 200, description = "The row and everything that happened to it", body = AdminCreditRegistrationDetails),
        (status = 404, description = "No such registration")
    )
)]
pub async fn get_credit_registration_for_admin(
    user: AuthUser,
    pool: web::Data<PgPool>,
    credit_registration_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<AdminCreditRegistrationDetails>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let id = *credit_registration_id;
    let registration = one_admin_row(&mut conn, id)
        .await?
        .ok_or_else(|| controller_err!(NotFound, "Not found.".to_string()))?;
    let attempts = credit_registrations::get_admin_facing(
        &mut conn,
        &AdminCreditRegistrationFilters {
            user_id: Some(registration.user_id),
            course_id: Some(registration.course_id),
            // No field for this predicate; search_id already matches it (it is also matched against
            // cr.id and cr.user_id, which cannot collide with a completion id).
            search_id: Some(registration.course_module_completion_id),
            include_superseded: true,
            ..AdminCreditRegistrationFilters::default()
        },
        AdminCreditRegistrationSort::Created,
        i64::from(u8::MAX),
        0,
    )
    .await?
    .into_iter()
    .filter(|row| row.course_module_completion_id == registration.course_module_completion_id)
    .map(to_admin_row)
    .collect();

    let events: Vec<AdminCreditRegistrationEvent> =
        models::credit_registration_events::get_by_registration_id(&mut conn, id)
            .await?
            .into_iter()
            .map(|event| AdminCreditRegistrationEvent {
                id: event.id,
                created_at: event.created_at,
                kind: event.kind,
                from_state: event.from_state,
                to_state: event.to_state,
                error_code: event.error_code,
                message: event.message,
                actor_user_id: event.actor_user_id,
                suotar_api_call_id: event.suotar_api_call_id,
                details: event.details,
            })
            .collect();
    let suotar_api_calls =
        suotar_api_calls::get_by_credit_registration_id(&mut conn, id, i64::from(u8::MAX))
            .await?
            .into_iter()
            .map(to_admin_api_call)
            .collect();
    let actions = models::credit_registration_admin_actions::get_by_target(
        &mut conn,
        CreditRegistrationAdminActionTarget::CreditRegistration,
        id,
    )
    .await?;

    let sisu_person_id = match &registration.sisu_person_id {
        Some(person_id) => Some(person_id.clone()),
        None => verified_student_numbers::get_latest_including_deleted_by_user_id(
            &mut conn,
            registration.user_id,
        )
        .await?
        .map(|link| link.sisu_person_id),
    };
    let linking_emails = match sisu_person_id {
        Some(person_id) => {
            let mails = credit_registration_account_linking_emails::get_by_sisu_person_id(
                &mut conn, &person_id,
            )
            .await?;
            build_linking_emails(&mut conn, mails).await?
        }
        None => Vec::new(),
    };
    let consent = course_credit_registration_consents::get_by_user_and_course(
        &mut conn,
        registration.user_id,
        registration.course_id,
    )
    .await?;

    token.authorized_ok(web::Json(AdminCreditRegistrationDetails {
        registration: to_admin_row(registration),
        attempts,
        events,
        suotar_api_calls,
        actions,
        linking_emails,
        consent_given: consent.as_ref().map(|row| row.consent_given),
        consent_withdrawn_at: consent.and_then(|row| row.consent_withdrawn_at),
    }))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/registrations/{credit_registration_id}/transition`
- Moves one row by hand.

The escape hatch out of `submission_uncertain`, which the pipeline never leaves on its own because
re-importing could put a second attainment on a real transcript. Resubmitting re-checks consent, because
a `misregistered` row sits outside the automatic machinery that would otherwise have checked it.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/registrations/{credit_registration_id}/transition",
    operation_id = "adminTransitionCreditRegistration",
    tag = "credit-registration-admin",
    params(("credit_registration_id" = Uuid, Path, description = "Credit registration id")),
    request_body = AdminTransitionCreditRegistrationPayload,
    responses(
        (status = 200, description = "What the transition did", body = AdminTransitionCreditRegistrationResult),
        (status = 400, description = "No reason given"),
        (status = 404, description = "No such registration")
    )
)]
pub async fn admin_transition_credit_registration(
    user: AuthUser,
    pool: web::Data<PgPool>,
    credit_registration_id: web::Path<Uuid>,
    payload: web::Json<AdminTransitionCreditRegistrationPayload>,
) -> ControllerResult<web::Json<AdminTransitionCreditRegistrationResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let reason = required_reason(&payload.reason)?;
    let id = *credit_registration_id;
    let row = credit_registrations::get_by_id(&mut conn, id).await?;
    if row.superseded_by_id.is_some() {
        return Err(controller_err!(
            BadRequest,
            "This attempt has been replaced by a later one. Act on the later one.".to_string()
        ));
    }

    if payload.to_state == AdminCreditRegistrationTransitionTarget::ReadyToSubmit {
        let consent = course_credit_registration_consents::get_by_user_and_course(
            &mut conn,
            row.user_id,
            row.course_id,
        )
        .await?;
        // consent_withdrawn_at survives a later consent as an audit trail, so consent_given alone is
        // what counts as consented, here and in the precondition engine.
        let consented = consent.is_some_and(|c| c.consent_given);
        if !consented {
            return token.authorized_ok(web::Json(AdminTransitionCreditRegistrationResult {
                outcome: AdminTransitionOutcome::RefusedWithoutConsent,
                state: row.state,
                needs_admin_attention: row.needs_admin_attention,
            }));
        }
    }

    let mut tx = conn.begin().await?;
    let (outcome, after_state, needs_admin_attention) = match payload.to_state {
        AdminCreditRegistrationTransitionTarget::ClearNeedsAdminAttention => {
            if !row.needs_admin_attention {
                (AdminTransitionOutcome::NoChange, row.state, false)
            } else {
                credit_registrations::set_needs_admin_attention(&mut tx, id, false).await?;
                models::credit_registration_events::insert(
                    &mut tx,
                    &models::credit_registration_events::NewCreditRegistrationEvent {
                        actor_user_id: Some(user.id),
                        message: Some(reason.to_string()),
                        ..models::credit_registration_events::NewCreditRegistrationEvent::new(
                            id,
                            CreditRegistrationEventKind::AdminAction,
                        )
                    },
                )
                .await?;
                (AdminTransitionOutcome::Applied, row.state, false)
            }
        }
        AdminCreditRegistrationTransitionTarget::CheckNow => {
            credit_registrations::make_due_now(&mut tx, id).await?;
            models::credit_registration_events::insert(
                &mut tx,
                &models::credit_registration_events::NewCreditRegistrationEvent {
                    actor_user_id: Some(user.id),
                    message: Some(reason.to_string()),
                    ..models::credit_registration_events::NewCreditRegistrationEvent::new(
                        id,
                        CreditRegistrationEventKind::AdminAction,
                    )
                },
            )
            .await?;
            (
                AdminTransitionOutcome::Applied,
                row.state,
                row.needs_admin_attention,
            )
        }
        target => {
            let to_state = match target {
                AdminCreditRegistrationTransitionTarget::ReadyToSubmit => {
                    CreditRegistrationState::ReadyToSubmit
                }
                _ => CreditRegistrationState::Cancelled,
            };
            let after = credit_registrations::transition(
                &mut tx,
                id,
                &Transition {
                    needs_admin_attention: Some(false),
                    event_kind: CreditRegistrationEventKind::AdminAction,
                    event_message: Some(reason.to_string()),
                    actor_user_id: Some(user.id),
                    ..Transition::to(to_state)
                },
            )
            .await?;
            // Nothing else brings the row forward, so without this the resubmit sits out the backoff
            // whatever failed last set.
            if !after.state.is_terminal() {
                credit_registrations::make_due_now(&mut tx, id).await?;
            }
            (
                AdminTransitionOutcome::Applied,
                after.state,
                after.needs_admin_attention,
            )
        }
    };
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            action: CreditRegistrationAdminAction::TransitionItem,
            target_kind: CreditRegistrationAdminActionTarget::CreditRegistration,
            target_id: Some(id),
            target_phase: None,
            actor_user_id: user.id,
            actor_role: GLOBAL_ADMIN_ROLE.to_string(),
            actor_course_id: None,
            reason: Some(reason.to_string()),
            before_state: Some(row.state),
            after_state: Some(after_state),
            details: Some(serde_json::json!({ "outcome": outcome })),
            affected_row_count: Some(1),
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(AdminTransitionCreditRegistrationResult {
        outcome,
        state: after_state,
        needs_admin_attention,
    }))
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/account-linking` - The linking funnel, the
per-realisation counters, the send-status totals and the stale-address list.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/account-linking",
    operation_id = "getAccountLinkingStats",
    tag = "credit-registration-admin",
    params(("window_days" = Option<u32>, Query, description = "Window for the windowed funnel steps, in days")),
    responses(
        (status = 200, description = "Where account linking stands", body = AccountLinkingStats)
    )
)]
pub async fn get_account_linking_stats(
    user: AuthUser,
    pool: web::Data<PgPool>,
    query: web::Query<AccountLinkingStatsQuery>,
) -> ControllerResult<web::Json<AccountLinkingStats>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let window_days = i64::from(query.window_days.unwrap_or(30).clamp(1, 365));
    let window_secs = window_days * 24 * 60 * 60;
    let since = Utc::now() - chrono::Duration::days(window_days);

    let realisations = course_module_suotar_realisations::get_active_discovery_reports(&mut conn)
        .await?
        .into_iter()
        .map(|row| AccountLinkingRealisationCounters {
            course_id: row.course_id,
            course_name: row.course_name,
            course_module_id: row.course_module_id,
            course_module_name: row.course_module_name,
            course_unit_realisation_id: row.course_unit_realisation_id,
            label: row.label,
            uh_course_code: row.uh_course_code,
            last_listed_at: row.last_listed_at,
            last_listing_attempted_at: row.last_listing_attempted_at,
            last_listing_error: row.last_listing_error,
            consecutive_listing_failures: row.consecutive_listing_failures,
            listed_person_count: row.last_listed_person_count,
            already_linked_count: row.last_already_linked_count,
            mailed_count: row.last_mailed_count,
            suppressed_by_dedup_count: row.last_suppressed_by_dedup_count,
            suppressed_by_rate_cap_count: row.last_suppressed_by_rate_cap_count,
            no_address_count: row.last_no_address_count,
        })
        .collect::<Vec<_>>();
    let sum = |pick: fn(&AccountLinkingRealisationCounters) -> Option<i32>| -> i64 {
        realisations
            .iter()
            .filter_map(pick)
            .map(i64::from)
            .sum::<i64>()
    };

    let now = Utc::now();
    let totals = credit_registration_account_linking_emails::get_send_status_totals_since(
        &mut conn, since, now,
    )
    .await?;
    let send_status_totals = AccountLinkingSendStatusTotals {
        queued: totals.queued,
        retrying: totals.retrying,
        sent: totals.sent,
        send_failed: totals.send_failed,
    };
    let hard_failure_domains: Vec<AccountLinkingFailureDomain> =
        credit_registration_account_linking_emails::get_send_failure_domains_since(
            &mut conn, since, now,
        )
        .await?
        .into_iter()
        .map(|row| AccountLinkingFailureDomain {
            domain: row.domain,
            count: row.count,
        })
        .collect();

    let links_total_by_method = verified_student_numbers::count_by_method_since(&mut conn, None)
        .await?
        .into_iter()
        .map(|(verified_via, count)| VerifiedStudentNumberMethodTotal {
            verified_via,
            count,
        })
        .collect::<Vec<_>>();
    let links_in_window_by_method =
        verified_student_numbers::count_by_method_since(&mut conn, Some(since))
            .await?
            .into_iter()
            .map(|(verified_via, count)| VerifiedStudentNumberMethodTotal {
                verified_via,
                count,
            })
            .collect::<Vec<_>>();
    let in_window = |method: StudentNumberVerificationMethod| -> i64 {
        links_in_window_by_method
            .iter()
            .filter(|row| row.verified_via == method)
            .map(|row| row.count)
            .sum()
    };

    let stale = credit_registration_account_linking_emails::get_stale_unclaimed(
        &mut conn,
        MAX_LINKING_MAILS_PER_PERSON_AND_COURSE,
        STALE_UNCLAIMED_LIMIT,
    )
    .await?;
    let stale_addresses = build_stale_addresses(&mut conn, stale).await?;

    let waiting_for_student_number_count = credit_registrations::count_by_state(&mut conn)
        .await?
        .into_iter()
        .find(|(state, _)| *state == CreditRegistrationState::PendingStudentNumber)
        .map_or(0, |(_, count)| count);

    let funnel = AccountLinkingFunnel {
        persons_discovered_last_run: sum(|row| row.listed_person_count),
        already_linked_last_run: sum(|row| row.already_linked_count),
        mails_claimed_in_window: totals.mails_in_window,
        mails_sent_in_window: send_status_totals.sent,
        numbers_claimed_in_window: in_window(StudentNumberVerificationMethod::EmailedLink),
        manual_links_in_window: in_window(StudentNumberVerificationMethod::AdminManual),
        suppressed_by_dedup_last_run: sum(|row| row.suppressed_by_dedup_count),
        suppressed_by_rate_cap_last_run: sum(|row| row.suppressed_by_rate_cap_count),
        no_address_in_study_registry_last_run: sum(|row| row.no_address_count),
    };

    token.authorized_ok(web::Json(AccountLinkingStats {
        window_secs,
        funnel,
        send_status_totals,
        hard_failure_domains,
        realisations,
        stale_addresses,
        links_total_by_method,
        links_in_window_by_method,
        waiting_for_student_number_count,
        max_mails_per_person_and_course: MAX_LINKING_MAILS_PER_PERSON_AND_COURSE,
        quiet_period_secs: LINKING_MAIL_QUIET_PERIOD_SECS,
    }))
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/student-numbers` - A page of the live links, for
spot-checking and support.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/student-numbers",
    operation_id = "listVerifiedStudentNumbersForAdmin",
    tag = "credit-registration-admin",
    params(
        ("page" = Option<u32>, Query, description = "Page number, from 1"),
        ("limit" = Option<u32>, Query, description = "Rows per page"),
        ("verified_via" = Option<StudentNumberVerificationMethod>, Query, description = "How the link was established"),
        ("search" = Option<String>, Query, description = "Student number, name or email")
    ),
    responses(
        (status = 200, description = "A page of the live links", body = AdminVerifiedStudentNumbersPage)
    )
)]
pub async fn list_verified_student_numbers_for_admin(
    user: AuthUser,
    pool: web::Data<PgPool>,
    query: web::Query<ListVerifiedStudentNumbersQuery>,
) -> ControllerResult<web::Json<AdminVerifiedStudentNumbersPage>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let pagination = Pagination::new(query.page.unwrap_or(1), query.limit.unwrap_or(50))
        .map_err(|e| controller_err!(BadRequest, e.to_string()))?;
    let search = query
        .search
        .as_deref()
        .map(str::trim)
        .filter(|search| !search.is_empty())
        .map(|search| escape_like_pattern(&search.to_lowercase()));
    let total_count = verified_student_numbers::count_admin_page(
        &mut conn,
        query.verified_via,
        search.as_deref(),
    )
    .await?;
    let data = verified_student_numbers::get_admin_page(
        &mut conn,
        query.verified_via,
        search.as_deref(),
        pagination.limit(),
        pagination.offset(),
    )
    .await?
    .into_iter()
    .map(to_admin_student_number)
    .collect();

    token.authorized_ok(web::Json(AdminVerifiedStudentNumbersPage {
        data,
        total_count,
        total_pages: pagination.total_pages(u32::try_from(total_count).unwrap_or(u32::MAX)),
    }))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/student-numbers/{id}/unlink` - Retires one link.

A reason is required, so the request carries a body rather than being a `DELETE`. The row is
soft-deleted: the number a student once held is part of the audit trail.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/student-numbers/{verified_student_number_id}/unlink",
    operation_id = "adminUnlinkStudentNumber",
    tag = "credit-registration-admin",
    params(("verified_student_number_id" = Uuid, Path, description = "Verified student number id")),
    request_body = AdminUnlinkStudentNumberPayload,
    responses(
        (status = 200, description = "How many registrations went back to waiting", body = AdminUnlinkStudentNumberResult),
        (status = 400, description = "No reason given"),
        (status = 404, description = "No such link")
    )
)]
pub async fn admin_unlink_student_number(
    user: AuthUser,
    pool: web::Data<PgPool>,
    verified_student_number_id: web::Path<Uuid>,
    payload: web::Json<AdminUnlinkStudentNumberPayload>,
) -> ControllerResult<web::Json<AdminUnlinkStudentNumberResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let reason = required_reason(&payload.reason)?;
    let id = *verified_student_number_id;
    let link = verified_student_numbers::get_by_id(&mut conn, id).await?;

    let mut tx = conn.begin().await?;
    verified_student_numbers::soft_delete(&mut tx, id).await?;
    let affected_registration_count = apply_student_number_change(
        &mut tx,
        link.user_id,
        user.id,
        "An administrator unlinked this student number.",
    )
    .await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            action: CreditRegistrationAdminAction::UnlinkStudentNumber,
            target_kind: CreditRegistrationAdminActionTarget::VerifiedStudentNumber,
            target_id: Some(id),
            target_phase: None,
            actor_user_id: user.id,
            actor_role: GLOBAL_ADMIN_ROLE.to_string(),
            actor_course_id: None,
            reason: Some(reason.to_string()),
            before_state: None,
            after_state: None,
            details: Some(serde_json::json!({
                "user_id": link.user_id,
                "student_number": link.student_number,
                "verified_via": link.verified_via,
            })),
            affected_row_count: Some(
                i32::try_from(affected_registration_count).unwrap_or(i32::MAX),
            ),
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(AdminUnlinkStudentNumberResult {
        affected_registration_count,
    }))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/account-linking/resend` - Sets off another
account-linking mail for one person on one course.

The mail goes to the addresses the study registry holds, and the recipient still has to open the link
while signed in, so the ownership proof is intact. An override does not ask a cap for an exemption: it
retires the ledger rows the cap is counting, as its own audited action, then runs the ordinary path.
*/
#[instrument(skip(pool, payload, app_conf, suotar_client))]
#[utoipa::path(
    post,
    path = "/account-linking/resend",
    operation_id = "adminResendAccountLinkingEmail",
    tag = "credit-registration-admin",
    request_body = AdminResendAccountLinkingEmailPayload,
    responses(
        (status = 200, description = "What the attempt did", body = AdminResendAccountLinkingEmailResult),
        (status = 400, description = "An override without a reason, or too soon after the last resend")
    )
)]
pub async fn admin_resend_account_linking_email(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<AdminResendAccountLinkingEmailPayload>,
    app_conf: web::Data<ApplicationConfiguration>,
    suotar_client: web::Data<headless_lms_utils::services::suotar::SuotarClient>,
) -> ControllerResult<web::Json<AdminResendAccountLinkingEmailResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let student_number = payload.student_number.trim();
    if student_number.is_empty() {
        return Err(controller_err!(
            BadRequest,
            "Name a student number.".to_string()
        ));
    }
    let override_reason = if payload.override_rate_caps {
        Some(required_reason(payload.reason.as_deref().unwrap_or(""))?.to_string())
    } else {
        None
    };

    let recent = models::credit_registration_admin_actions::count_by_actor_since(
        &mut conn,
        user.id,
        CreditRegistrationAdminAction::ResendLinkEmail,
        Utc::now() - chrono::Duration::seconds(RESEND_QUIET_PERIOD_SECS),
    )
    .await?;
    if recent > 0 {
        return Err(controller_err!(
            BadRequest,
            "Wait a minute between resends.".to_string()
        ));
    }

    if verified_student_numbers::get_by_student_number(&mut conn, student_number)
        .await?
        .is_some()
    {
        return finish_resend(
            &mut conn,
            &user,
            &payload,
            student_number,
            AdminResendOutcome::AlreadyLinked,
            0,
            token,
        )
        .await;
    }

    let retired_mail_count = match &override_reason {
        Some(reason) => {
            retire_capped_mails(
                &mut conn,
                user.id,
                payload.course_id,
                student_number,
                reason,
            )
            .await?
        }
        None => 0,
    };

    let ctx = PhaseContext {
        pool: &pool,
        suotar_client: &suotar_client,
        test_mode: app_conf.test_mode,
        caller: RESEND_CALLER,
        base_url: &app_conf.base_url,
    };
    let outcome = match resend_linking_mail(&ctx, payload.course_id, student_number).await? {
        LinkingMailResendOutcome::Claimed => AdminResendOutcome::Queued,
        LinkingMailResendOutcome::AlreadyMailedToEveryKnownAddress => {
            AdminResendOutcome::AlreadyMailedToEveryKnownAddress
        }
        LinkingMailResendOutcome::RefusedByRateCap => AdminResendOutcome::RefusedByRateCap,
        LinkingMailResendOutcome::NoAddressInStudyRegistry => {
            AdminResendOutcome::NoAddressInStudyRegistry
        }
        LinkingMailResendOutcome::NotOnTheCourseRoster => AdminResendOutcome::NotOnTheCourseRoster,
        LinkingMailResendOutcome::StudyRegistryUnavailable => {
            AdminResendOutcome::StudyRegistryUnavailable
        }
    };

    finish_resend(
        &mut conn,
        &user,
        &payload,
        student_number,
        outcome,
        retired_mail_count,
        token,
    )
    .await
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/account-linking/resolve-person` - Looks one
student number up in the study registry without changing anything.

The preview a manual link is gated on. Writes nothing but the call log row every study registry call
writes.
*/
#[instrument(skip(pool, payload, suotar_client))]
#[utoipa::path(
    post,
    path = "/account-linking/resolve-person",
    operation_id = "adminResolveStudentNumberForLinking",
    tag = "credit-registration-admin",
    request_body = AdminResolveStudentNumberPayload,
    responses(
        (status = 200, description = "Who the study registry says the number belongs to", body = AdminResolveStudentNumberResult),
        (status = 400, description = "No student number given")
    )
)]
pub async fn admin_resolve_student_number_for_linking(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<AdminResolveStudentNumberPayload>,
    suotar_client: web::Data<headless_lms_utils::services::suotar::SuotarClient>,
) -> ControllerResult<web::Json<AdminResolveStudentNumberResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let student_number = payload.student_number.trim();
    if student_number.is_empty() {
        return Err(controller_err!(
            BadRequest,
            "Name a student number.".to_string()
        ));
    }

    let resolved = resolve_person(&suotar_client, student_number).await;
    let existing = verified_student_numbers::get_by_student_number(&mut conn, student_number)
        .await?
        .or(match &resolved {
            Ok(Some(person)) => verified_student_numbers::get_by_sisu_person_ids(
                &mut conn,
                std::slice::from_ref(&person.sisu_person_id),
            )
            .await?
            .into_iter()
            .next(),
            _ => None,
        });
    let already_linked_to_user_email = match &existing {
        Some(link) => models::user_details::get_user_details_by_user_id(&mut conn, link.user_id)
            .await
            .ok()
            .map(|details| details.email),
        None => None,
    };

    let mails = match &resolved {
        Ok(Some(person)) => {
            credit_registration_account_linking_emails::get_by_sisu_person_id(
                &mut conn,
                &person.sisu_person_id,
            )
            .await?
        }
        _ => Vec::new(),
    };
    let linking_emails = build_linking_emails(&mut conn, mails).await?;

    let result = match resolved {
        Ok(Some(person)) => AdminResolveStudentNumberResult {
            found: true,
            student_number: student_number.to_string(),
            sisu_person_id: Some(person.sisu_person_id),
            first_names: Some(person.first_names),
            last_name: Some(person.last_name),
            code: Some(person.code),
            study_registry_unavailable: false,
            already_linked_to_user_id: existing.as_ref().map(|link| link.user_id),
            already_linked_to_user_email,
            already_linked_via: existing.as_ref().map(|link| link.verified_via),
            linking_emails,
        },
        Ok(None) => AdminResolveStudentNumberResult {
            found: false,
            student_number: student_number.to_string(),
            sisu_person_id: None,
            first_names: None,
            last_name: None,
            code: None,
            study_registry_unavailable: false,
            already_linked_to_user_id: existing.as_ref().map(|link| link.user_id),
            already_linked_to_user_email,
            already_linked_via: existing.as_ref().map(|link| link.verified_via),
            linking_emails,
        },
        Err(()) => AdminResolveStudentNumberResult {
            found: false,
            student_number: student_number.to_string(),
            sisu_person_id: None,
            first_names: None,
            last_name: None,
            code: None,
            study_registry_unavailable: true,
            already_linked_to_user_id: existing.as_ref().map(|link| link.user_id),
            already_linked_to_user_email,
            already_linked_via: existing.as_ref().map(|link| link.verified_via),
            linking_emails,
        },
    };

    token.authorized_ok(web::Json(result))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/account-linking/manual-link` - Links a student
number to an account on an admin's judgement.

The last resort, for a student whose mailbox host will not accept our mail at all. An admin's judgement
stands in for proof of mailbox control, so the link is marked `admin_manual` forever, carries the
reason and names the admin.
*/
#[instrument(skip(pool, payload, suotar_client))]
#[utoipa::path(
    post,
    path = "/account-linking/manual-link",
    operation_id = "adminManuallyLinkStudentNumber",
    tag = "credit-registration-admin",
    request_body = AdminManuallyLinkStudentNumberPayload,
    responses(
        (status = 200, description = "What the attempt did", body = AdminManuallyLinkStudentNumberResult),
        (status = 400, description = "No reason, no student number, or no person id from the preview")
    )
)]
pub async fn admin_manually_link_student_number(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<AdminManuallyLinkStudentNumberPayload>,
    suotar_client: web::Data<headless_lms_utils::services::suotar::SuotarClient>,
) -> ControllerResult<web::Json<AdminManuallyLinkStudentNumberResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let ManualLinkRequest {
        reason,
        student_number,
        previewed_person_id,
    } = manual_link_request(&payload)?;
    let reason = reason.to_string();

    let refused = |outcome| AdminManuallyLinkStudentNumberResult {
        outcome,
        verified_student_number_id: None,
        affected_registration_count: 0,
    };
    let person = match resolve_person(&suotar_client, student_number).await {
        Ok(Some(person)) => person,
        Ok(None) => {
            return token.authorized_ok(web::Json(refused(
                AdminManualLinkOutcome::StudentNumberNotFound,
            )));
        }
        Err(()) => {
            return token.authorized_ok(web::Json(refused(
                AdminManualLinkOutcome::StudyRegistryUnavailable,
            )));
        }
    };
    if person.sisu_person_id != previewed_person_id {
        return token.authorized_ok(web::Json(refused(AdminManualLinkOutcome::PreviewMismatch)));
    }

    let holder = verified_student_numbers::get_by_student_number(&mut conn, student_number).await?;
    if let Some(holder) = &holder {
        let outcome = if holder.user_id == payload.user_id {
            AdminManualLinkOutcome::AlreadyLinkedToThisAccount
        } else {
            AdminManualLinkOutcome::AlreadyLinkedToAnotherAccount
        };
        return token.authorized_ok(web::Json(refused(outcome)));
    }

    let mut tx = conn.begin().await?;
    // A student who changed programmes has a new number; the old link is retired, not deleted, so the
    // audit trail survives.
    if let Some(current) =
        verified_student_numbers::get_by_user_id(&mut tx, payload.user_id).await?
    {
        verified_student_numbers::soft_delete(&mut tx, current.id).await?;
    }
    let verified_student_number_id = verified_student_numbers::insert(
        &mut tx,
        PKeyPolicy::Generate,
        &NewVerifiedStudentNumber {
            user_id: payload.user_id,
            student_number: student_number.to_string(),
            sisu_person_id: person.sisu_person_id.clone(),
            first_names: Some(person.first_names.clone()),
            last_name: Some(person.last_name.clone()),
            verified_via: StudentNumberVerificationMethod::AdminManual,
            // No mailbox was proved, so there is no address the proof could rest on.
            verified_via_email: None,
            verified_via_email_match_field: None,
            account_email_verified_at: None,
            linked_by_user_id: Some(user.id),
            link_reason: Some(reason.clone()),
            verified_from_course_id: None,
        },
    )
    .await?;
    // The number is established, so the outstanding mailed links to it are no longer owed.
    student_number_verification_tokens::soft_delete_unused_for_student_number(
        &mut tx,
        student_number,
    )
    .await?;
    let affected_registration_count = apply_student_number_change(
        &mut tx,
        payload.user_id,
        user.id,
        "An administrator linked this student number by hand.",
    )
    .await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            action: CreditRegistrationAdminAction::ManualLinkStudentNumber,
            target_kind: CreditRegistrationAdminActionTarget::VerifiedStudentNumber,
            target_id: Some(verified_student_number_id),
            target_phase: None,
            actor_user_id: user.id,
            actor_role: GLOBAL_ADMIN_ROLE.to_string(),
            actor_course_id: None,
            reason: Some(reason),
            before_state: None,
            after_state: None,
            details: Some(serde_json::json!({
                "user_id": payload.user_id,
                "student_number": student_number,
            })),
            affected_row_count: Some(
                i32::try_from(affected_registration_count).unwrap_or(i32::MAX),
            ),
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(AdminManuallyLinkStudentNumberResult {
        outcome: AdminManualLinkOutcome::Linked,
        verified_student_number_id: Some(verified_student_number_id),
        affected_registration_count,
    }))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/materialize` - Creates ledger rows for eligible
completions and recomputes preconditions, now.

Runs the two database-only steps directly rather than through the phase dispatcher, because the
phase-state row describes the worker loops: an admin pressing a button must not make a dead worker look
alive.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/materialize",
    operation_id = "adminMaterializeCreditRegistrations",
    tag = "credit-registration-admin",
    request_body = AdminMaterializePayload,
    responses(
        (status = 200, description = "How many rows were created and moved", body = AdminMaterializeResult)
    )
)]
pub async fn admin_materialize_credit_registrations(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<AdminMaterializePayload>,
) -> ControllerResult<web::Json<AdminMaterializeResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let mut tx = conn.begin().await?;
    let scope = credit_registrations::RegistrationScope::default();
    let created_registration_count =
        ensure_registration_rows_for_eligible_completions(&mut tx, &scope, MATERIALIZE_LIMIT)
            .await?;
    let moved_registration_count =
        recompute_preconditions(&mut tx, &scope, PRECONDITIONS_LIMIT).await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            action: CreditRegistrationAdminAction::RequeueBatch,
            target_kind: CreditRegistrationAdminActionTarget::Phase,
            target_id: None,
            target_phase: Some(CreditRegistrationPhase::Materialize.as_str().to_string()),
            actor_user_id: user.id,
            actor_role: GLOBAL_ADMIN_ROLE.to_string(),
            actor_course_id: None,
            reason: payload.reason.clone(),
            before_state: None,
            after_state: None,
            details: Some(serde_json::json!({
                "created_registration_count": created_registration_count,
                "moved_registration_count": moved_registration_count,
            })),
            affected_row_count: Some(
                i32::try_from(created_registration_count + moved_registration_count)
                    .unwrap_or(i32::MAX),
            ),
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(AdminMaterializeResult {
        created_registration_count,
        moved_registration_count,
    }))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminPausePhasePayload {
    pub reason: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminPhaseActionPayload {
    pub reason: Option<String>,
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/phases/{phase}/pause` - Pauses one phase: the
worker loop skips it on every tick until it is resumed.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/phases/{phase}/pause",
    operation_id = "adminPausePhase",
    tag = "credit-registration-admin",
    params(("phase" = String, Path, description = "One of the twelve canonical phase names")),
    request_body = AdminPausePhasePayload,
    responses(
        (status = 200, description = "The phase's status after pausing", body = CreditRegistrationPhaseStatus),
        (status = 400, description = "No reason given, or not one of the canonical phase names")
    )
)]
pub async fn admin_pause_phase(
    user: AuthUser,
    pool: web::Data<PgPool>,
    phase: web::Path<String>,
    payload: web::Json<AdminPausePhasePayload>,
) -> ControllerResult<web::Json<CreditRegistrationPhaseStatus>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let phase = require_known_phase(&phase)?;
    let reason = required_reason(&payload.reason)?;

    let mut tx = conn.begin().await?;
    credit_registration_phase_state::pause(&mut tx, phase, user.id, Some(reason)).await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            action: CreditRegistrationAdminAction::PausePhase,
            target_kind: CreditRegistrationAdminActionTarget::Phase,
            target_id: None,
            target_phase: Some(phase.to_string()),
            actor_user_id: user.id,
            actor_role: GLOBAL_ADMIN_ROLE.to_string(),
            actor_course_id: None,
            reason: Some(reason.to_string()),
            before_state: None,
            after_state: None,
            details: None,
            affected_row_count: None,
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(one_phase_status(&mut conn, phase).await?))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/phases/{phase}/resume` - Resumes one paused
phase.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/phases/{phase}/resume",
    operation_id = "adminResumePhase",
    tag = "credit-registration-admin",
    params(("phase" = String, Path, description = "One of the twelve canonical phase names")),
    request_body = AdminPhaseActionPayload,
    responses(
        (status = 200, description = "The phase's status after resuming", body = CreditRegistrationPhaseStatus),
        (status = 400, description = "Not one of the canonical phase names")
    )
)]
pub async fn admin_resume_phase(
    user: AuthUser,
    pool: web::Data<PgPool>,
    phase: web::Path<String>,
    payload: web::Json<AdminPhaseActionPayload>,
) -> ControllerResult<web::Json<CreditRegistrationPhaseStatus>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let phase = require_known_phase(&phase)?;

    let mut tx = conn.begin().await?;
    credit_registration_phase_state::resume(&mut tx, phase).await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            action: CreditRegistrationAdminAction::ResumePhase,
            target_kind: CreditRegistrationAdminActionTarget::Phase,
            target_id: None,
            target_phase: Some(phase.to_string()),
            actor_user_id: user.id,
            actor_role: GLOBAL_ADMIN_ROLE.to_string(),
            actor_course_id: None,
            reason: payload.reason.clone(),
            before_state: None,
            after_state: None,
            details: None,
            affected_row_count: None,
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(one_phase_status(&mut conn, phase).await?))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/phases/{phase}/run-now` - Makes one phase due
immediately: the worker loop picks it up on its next tick instead of waiting out `next_run_at`.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/phases/{phase}/run-now",
    operation_id = "adminRunPhaseNow",
    tag = "credit-registration-admin",
    params(("phase" = String, Path, description = "One of the twelve canonical phase names")),
    request_body = AdminPhaseActionPayload,
    responses(
        (status = 200, description = "The phase's status after being made due", body = CreditRegistrationPhaseStatus),
        (status = 400, description = "Not one of the canonical phase names")
    )
)]
pub async fn admin_run_phase_now(
    user: AuthUser,
    pool: web::Data<PgPool>,
    phase: web::Path<String>,
    payload: web::Json<AdminPhaseActionPayload>,
) -> ControllerResult<web::Json<CreditRegistrationPhaseStatus>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;

    let phase = require_known_phase(&phase)?;

    let mut tx = conn.begin().await?;
    credit_registration_phase_state::run_now(&mut tx, phase).await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            action: CreditRegistrationAdminAction::RunPhaseNow,
            target_kind: CreditRegistrationAdminActionTarget::Phase,
            target_id: None,
            target_phase: Some(phase.to_string()),
            actor_user_id: user.id,
            actor_role: GLOBAL_ADMIN_ROLE.to_string(),
            actor_course_id: None,
            reason: payload.reason.clone(),
            before_state: None,
            after_state: None,
            details: None,
            affected_row_count: None,
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(one_phase_status(&mut conn, phase).await?))
}

/// Resolves a path segment to the spelling `credit_registration_phase_state` stores, refusing anything
/// that is not a canonical phase name.
fn require_known_phase(phase: &str) -> Result<&'static str, ControllerError> {
    CreditRegistrationPhase::from_phase_name(phase)
        .map(CreditRegistrationPhase::as_str)
        .ok_or_else(|| {
            controller_err!(
                BadRequest,
                "Not one of the canonical phase names.".to_string()
            )
        })
}

/// The three values a manual link may not be attempted without.
struct ManualLinkRequest<'a> {
    reason: &'a str,
    student_number: &'a str,
    previewed_person_id: &'a str,
}

/// Refuses a manual link that skipped the preview or gave no reason, before anything is asked of the
/// study registry. The person id can only have come from the preview: it is the registry's own
/// identifier, not something a caller could produce from the student number in front of them.
fn manual_link_request(
    payload: &AdminManuallyLinkStudentNumberPayload,
) -> Result<ManualLinkRequest<'_>, ControllerError> {
    let reason = required_reason(&payload.reason)?;
    let student_number = payload.student_number.trim();
    if student_number.is_empty() {
        return Err(controller_err!(
            BadRequest,
            "Name a student number.".to_string()
        ));
    }
    let previewed_person_id = payload.sisu_person_id.trim();
    if previewed_person_id.is_empty() {
        return Err(controller_err!(
            BadRequest,
            "Check the number in the study registry first.".to_string()
        ));
    }
    Ok(ManualLinkRequest {
        reason,
        student_number,
        previewed_person_id,
    })
}

/// Refuses an empty or whitespace reason. Every audited action names one.
fn required_reason(reason: &str) -> Result<&str, ControllerError> {
    let trimmed = reason.trim();
    if trimmed.is_empty() {
        return Err(controller_err!(
            BadRequest,
            "A reason is required.".to_string()
        ));
    }
    Ok(trimmed)
}

/// What the study registry says one student number belongs to. `Ok(None)` means it answered and does
/// not know the number; `Err` means we could not ask.
struct ResolvedPerson {
    sisu_person_id: String,
    first_names: String,
    last_name: String,
    /// The registry's own per-item code, an identifier rather than prose.
    code: String,
}

async fn resolve_person(
    suotar_client: &headless_lms_utils::services::suotar::SuotarClient,
    student_number: &str,
) -> Result<Option<ResolvedPerson>, ()> {
    let request_item_id = format!("admin-{student_number}");
    let response = suotar_client
        .resolve_persons(
            SuotarCallContext::new(RESOLVE_CALLER),
            vec![ResolvePersonRequestItem {
                request_item_id: request_item_id.clone(),
                student_number: student_number.to_string(),
            }],
        )
        .await
        .map_err(|_| ())?;
    let Some(item) = response.item(&request_item_id) else {
        return Err(());
    };
    let Some(result) = item.result.as_ref() else {
        return Ok(None);
    };
    Ok(Some(ResolvedPerson {
        sisu_person_id: result.person_id.clone(),
        first_names: result.first_names.clone(),
        last_name: result.last_name.clone(),
        code: item.code.clone(),
    }))
}

/// Retires the linking-mail rows the caps are counting for this person, so the ordinary claim path can
/// take a slot again. No parameter relaxes a cap: the single writer of the ledger evaluates them from
/// the rows that exist, so getting past one means soft-deleting rows, audited as its own action.
async fn retire_capped_mails(
    conn: &mut PgConnection,
    actor_user_id: Uuid,
    course_id: Uuid,
    student_number: &str,
    reason: &str,
) -> Result<i64, ControllerError> {
    let Some(person_id) = person_id_of_mails(conn, course_id, student_number).await? else {
        return Ok(0);
    };
    let quiet_since = Utc::now() - chrono::Duration::seconds(LINKING_MAIL_QUIET_PERIOD_SECS);
    let mails =
        credit_registration_account_linking_emails::get_by_sisu_person_id(conn, &person_id).await?;
    // This course's rows carry the dedup guard and the lifetime cap; a recent row on any course
    // carries the quiet period, which is about the person's inbox rather than one course.
    let retired: Vec<Uuid> = mails
        .iter()
        .filter(|mail| mail.course_id == course_id || mail.sent_at >= quiet_since)
        .map(|mail| mail.id)
        .collect();
    if retired.is_empty() {
        return Ok(0);
    }

    let mut tx = conn.begin().await?;
    for id in &retired {
        credit_registration_account_linking_emails::soft_delete(&mut tx, *id).await?;
    }
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            action: CreditRegistrationAdminAction::OverrideRateCap,
            target_kind: CreditRegistrationAdminActionTarget::Course,
            target_id: Some(course_id),
            target_phase: None,
            actor_user_id,
            actor_role: GLOBAL_ADMIN_ROLE.to_string(),
            actor_course_id: None,
            reason: Some(reason.to_string()),
            before_state: None,
            after_state: None,
            details: Some(serde_json::json!({
                "student_number": student_number,
                "retired_linking_email_ids": retired,
            })),
            affected_row_count: Some(i32::try_from(retired.len()).unwrap_or(i32::MAX)),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(retired.len() as i64)
}

async fn person_id_of_mails(
    conn: &mut PgConnection,
    course_id: Uuid,
    student_number: &str,
) -> Result<Option<String>, ControllerError> {
    let mails = credit_registration_account_linking_emails::get_by_course_id_and_student_number(
        conn,
        course_id,
        student_number,
    )
    .await?;
    Ok(mails.into_iter().next().map(|mail| mail.sisu_person_id))
}

/// Audits the resend whatever it did, and reports where this person's mails now stand.
async fn finish_resend(
    conn: &mut PgConnection,
    user: &AuthUser,
    payload: &AdminResendAccountLinkingEmailPayload,
    student_number: &str,
    outcome: AdminResendOutcome,
    retired_mail_count: i64,
    token: crate::domain::authorization::AuthorizationToken,
) -> ControllerResult<web::Json<AdminResendAccountLinkingEmailResult>> {
    models::credit_registration_admin_actions::record(
        conn,
        &NewCreditRegistrationAdminAction {
            action: CreditRegistrationAdminAction::ResendLinkEmail,
            target_kind: CreditRegistrationAdminActionTarget::Course,
            target_id: Some(payload.course_id),
            target_phase: None,
            actor_user_id: user.id,
            actor_role: GLOBAL_ADMIN_ROLE.to_string(),
            actor_course_id: None,
            reason: payload.reason.clone(),
            before_state: None,
            after_state: None,
            details: Some(serde_json::json!({
                "outcome": outcome,
                "student_number": student_number,
                "override_rate_caps": payload.override_rate_caps,
                "retired_mail_count": retired_mail_count,
            })),
            affected_row_count: None,
        },
    )
    .await?;

    let mails = credit_registration_account_linking_emails::get_by_course_id_and_student_number(
        conn,
        payload.course_id,
        student_number,
    )
    .await?;
    let mails_sent_for_this_course = mails.len() as i64;
    let linking_emails = build_linking_emails(conn, mails).await?;

    token.authorized_ok(web::Json(AdminResendAccountLinkingEmailResult {
        outcome,
        retired_mail_count,
        linking_emails,
        mails_sent_for_this_course,
        max_mails_per_person_and_course: MAX_LINKING_MAILS_PER_PERSON_AND_COURSE,
        quiet_period_secs: LINKING_MAIL_QUIET_PERIOD_SECS,
    }))
}

/// Records a change to an account's link on every registration it can affect, then applies it. Returns
/// how many registrations changed whether they wait for a number, which is narrower than how many rows
/// the recompute moved.
async fn apply_student_number_change(
    conn: &mut PgConnection,
    subject_user_id: Uuid,
    actor_user_id: Uuid,
    message: &str,
) -> Result<i64, ControllerError> {
    let affected: Vec<Uuid> = credit_registrations::get_by_user_id(conn, subject_user_id)
        .await?
        .into_iter()
        .filter(|row| row.superseded_by_id.is_none() && row.terminal_at.is_none())
        .map(|row| row.id)
        .collect();
    models::credit_registration_events::insert_many(
        conn,
        &affected,
        CreditRegistrationEventKind::AdminAction,
        Some(actor_user_id),
        Some(message),
    )
    .await?;
    let scope = credit_registrations::RegistrationScope {
        user_id: Some(subject_user_id),
        ..credit_registrations::RegistrationScope::default()
    };
    let waiting_before = count_waiting_for_student_number(conn, subject_user_id).await?;
    recompute_preconditions(conn, &scope, PRECONDITIONS_LIMIT).await?;
    let waiting_after = count_waiting_for_student_number(conn, subject_user_id).await?;
    Ok((waiting_before - waiting_after).abs())
}

async fn count_waiting_for_student_number(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> Result<i64, ControllerError> {
    let count = credit_registrations::count_admin_facing(
        conn,
        &AdminCreditRegistrationFilters {
            user_id: Some(user_id),
            states: Some(&[CreditRegistrationState::PendingStudentNumber]),
            ..AdminCreditRegistrationFilters::default()
        },
    )
    .await?;
    Ok(count)
}

async fn one_admin_row(
    conn: &mut PgConnection,
    id: Uuid,
) -> Result<Option<AdminCreditRegistration>, ControllerError> {
    let rows = credit_registrations::get_admin_facing(
        conn,
        &AdminCreditRegistrationFilters {
            search_id: Some(id),
            include_superseded: true,
            ..AdminCreditRegistrationFilters::default()
        },
        AdminCreditRegistrationSort::default(),
        i64::from(u8::MAX),
        0,
    )
    .await?;
    Ok(rows.into_iter().find(|row| row.id == id))
}

async fn build_linking_emails(
    conn: &mut PgConnection,
    mails: Vec<
        models::credit_registration_account_linking_emails::CreditRegistrationAccountLinkingEmail,
    >,
) -> Result<Vec<AdminLinkingEmail>, ControllerError> {
    let ids: Vec<Uuid> = mails.iter().map(|mail| mail.id).collect();
    let reports =
        credit_registration_account_linking_emails::get_send_status_reports(conn, &ids).await?;
    let token_ids: Vec<Uuid> = mails
        .iter()
        .filter_map(|mail| mail.student_number_verification_token_id)
        .collect();
    let tokens = student_number_verification_tokens::get_by_ids(conn, &token_ids).await?;
    Ok(mails
        .into_iter()
        .map(|mail| {
            let token = mail
                .student_number_verification_token_id
                .and_then(|token_id| tokens.get(&token_id));
            AdminLinkingEmail {
                send_status: reports.get(&mail.id).cloned().unwrap_or_else(
                    credit_registration_account_linking_emails::not_handed_over_yet,
                ),
                id: mail.id,
                course_id: mail.course_id,
                student_number: mail.student_number,
                sisu_person_id: mail.sisu_person_id,
                emailed_to: mail.emailed_to,
                claimed_at: mail.sent_at,
                token_claimed_by_user_id: token.and_then(|row| row.claimed_by_user_id),
                token_used_at: token.and_then(|row| row.used_at),
                token_expires_at: token.map(|row| row.expires_at),
            }
        })
        .collect())
}

async fn build_stale_addresses(
    conn: &mut PgConnection,
    rows: Vec<StaleUnclaimedLinkingMails>,
) -> Result<Vec<AccountLinkingStaleAddress>, ControllerError> {
    let ids: Vec<Uuid> = rows.iter().flat_map(|row| row.mail_ids.clone()).collect();
    let reports =
        credit_registration_account_linking_emails::get_send_status_reports(conn, &ids).await?;
    Ok(rows
        .into_iter()
        .map(|row| AccountLinkingStaleAddress {
            send_statuses: row
                .mail_ids
                .iter()
                .map(|id| {
                    reports
                        .get(id)
                        .map(|report| report.email_send_status)
                        .unwrap_or(EmailSendStatus::Queued)
                })
                .collect(),
            student_number: row.student_number,
            sisu_person_id: row.sisu_person_id,
            course_id: row.course_id,
            course_name: row.course_name,
            mail_count: row.mail_count,
            first_sent_at: row.first_sent_at,
            last_sent_at: row.last_sent_at,
            addresses: row.addresses,
        })
        .collect())
}

async fn phase_statuses(
    conn: &mut PgConnection,
) -> Result<Vec<CreditRegistrationPhaseStatus>, ControllerError> {
    let now = Utc::now();
    Ok(credit_registration_phase_state::get_all(conn)
        .await?
        .into_iter()
        .map(|row| to_phase_status(row, now))
        .collect())
}

/// One phase's status, so a pause/resume/run-now response shows the effect without a second request.
async fn one_phase_status(
    conn: &mut PgConnection,
    phase: &str,
) -> Result<CreditRegistrationPhaseStatus, ControllerError> {
    let row = credit_registration_phase_state::get_by_phase(conn, phase).await?;
    Ok(to_phase_status(row, Utc::now()))
}

fn to_phase_status(
    row: credit_registration_phase_state::CreditRegistrationPhaseState,
    now: DateTime<Utc>,
) -> CreditRegistrationPhaseStatus {
    let seconds_since_heartbeat = row.last_heartbeat_at.map(|at| (now - at).num_seconds());
    let heartbeat_late = row.paused_at.is_none()
        && seconds_since_heartbeat.is_some_and(|secs| {
            secs > i64::from(row.expected_interval_secs)
                * i64::from(PHASE_HEARTBEAT_INTERVAL_MULTIPLIER)
        });
    CreditRegistrationPhaseStatus {
        implemented: CreditRegistrationPhase::from_phase_name(&row.phase)
            .is_some_and(CreditRegistrationPhase::is_implemented),
        phase: row.phase,
        process_name: row.process_name,
        expected_interval_secs: row.expected_interval_secs,
        last_heartbeat_at: row.last_heartbeat_at,
        last_success_at: row.last_success_at,
        last_run_finished_at: row.last_run_finished_at,
        items_processed_last_run: row.items_processed_last_run,
        items_failed_last_run: row.items_failed_last_run,
        consecutive_failures: row.consecutive_failures,
        paused_at: row.paused_at,
        pause_reason: row.pause_reason,
        seconds_since_heartbeat,
        heartbeat_late,
    }
}

fn circuit_breaker_state() -> CreditRegistrationCircuitBreakerState {
    let state = snapshot(&ScopeKey::Global);
    CreditRegistrationCircuitBreakerState {
        open: state.open,
        consecutive_failures: i64::from(state.consecutive_failures),
        open_for_secs: state.open_for_secs.map(|secs| secs as i64),
        trips_after_consecutive_failures: i64::from(MAX_CONSECUTIVE_SUOTAR_FAILURES),
    }
}

fn to_error_code_total(row: CreditRegistrationErrorCodeCount) -> CreditRegistrationErrorCodeTotal {
    CreditRegistrationErrorCodeTotal {
        error_code: row.error_code,
        in_flight_count: row.in_flight_count,
        terminal_failure_count: row.terminal_failure_count,
    }
}

fn to_oldest_non_terminal(
    row: OldestNonTerminalRegistration,
) -> CreditRegistrationOldestNonTerminal {
    CreditRegistrationOldestNonTerminal {
        credit_registration_id: row.id,
        state: row.state,
        state_entered_at: row.state_entered_at,
    }
}

fn to_stuck_total(row: StuckRegistrationCount) -> CreditRegistrationStuckTotal {
    CreditRegistrationStuckTotal {
        state: row.state,
        count: row.count,
        severely_stuck_count: row.severely_stuck_count,
        oldest_state_entered_at: row.oldest_state_entered_at,
    }
}

fn to_endpoint_standing(row: SuotarEndpointStandingRow) -> SuotarEndpointStanding {
    SuotarEndpointStanding {
        endpoint: row.endpoint,
        last_success_at: row.last_success_at,
        last_failure_at: row.last_failure_at,
        consecutive_failures: row.consecutive_failures,
    }
}

fn to_endpoint_window_stats_for_window(
    row: SuotarEndpointStatsForWindow,
) -> SuotarEndpointWindowStats {
    SuotarEndpointWindowStats {
        endpoint: row.endpoint,
        call_count: row.call_count,
        failed_call_count: row.failed_call_count,
        in_flight_count: row.in_flight_count,
        ok_item_count: row.ok_item_count,
        error_item_count: row.error_item_count,
        p50_duration_ms: row.p50_duration_ms,
        p95_duration_ms: row.p95_duration_ms,
        last_success_at: row.last_success_at,
        last_failure_at: row.last_failure_at,
        last_request_level_error_code: row.last_request_level_error_code,
    }
}

fn to_admin_row(row: AdminCreditRegistration) -> AdminCreditRegistrationRow {
    AdminCreditRegistrationRow {
        superseded: row.superseded_by_id.is_some(),
        id: row.id,
        created_at: row.created_at,
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        course_id: row.course_id,
        course_name: row.course_name,
        course_module_id: row.course_module_id,
        course_module_name: row.course_module_name,
        course_instance_id: row.course_instance_id,
        course_module_completion_id: row.course_module_completion_id,
        completion_date: row.completion_date,
        state: row.state,
        state_entered_at: row.state_entered_at,
        error_code: row.error_code,
        needs_admin_attention: row.needs_admin_attention,
        next_attempt_at: row.next_attempt_at,
        last_attempt_at: row.last_attempt_at,
        submitted_at: row.submitted_at,
        registered_at: row.registered_at,
        terminal_at: row.terminal_at,
        student_number: row.student_number,
        sisu_person_id: row.sisu_person_id,
        uh_course_code: row.uh_course_code,
        selected_enrolment_id: row.selected_enrolment_id,
        grade_scale_id: row.grade_scale_id,
        grade_id: row.grade_id,
        credits: row.credits,
        request_item_id: row.request_item_id,
        submitted_attainment_id: row.submitted_attainment_id,
        sisu_attainment_id: row.sisu_attainment_id,
        submit_retry_count: row.submit_retry_count,
        verify_attempt_count: row.verify_attempt_count,
        attempt_number: row.attempt_number,
        superseded_by_id: row.superseded_by_id,
        verified_student_number: row.verified_student_number,
        verified_student_number_at: row.verified_student_number_at,
        verified_student_number_via: row.verified_student_number_via,
    }
}

fn to_admin_api_call(call: models::suotar_api_calls::SuotarApiCall) -> AdminSuotarApiCall {
    AdminSuotarApiCall {
        id: call.id,
        endpoint: call.endpoint,
        started_at: call.started_at,
        duration_ms: call.duration_ms,
        http_status: call.http_status,
        succeeded: call.succeeded,
        request_item_count: call.request_item_count,
        ok_item_count: call.ok_item_count,
        error_item_count: call.error_item_count,
        request_level_error_code: call.request_level_error_code,
        worker_name: call.worker_name,
        request_body_sample: call.request_body_sample,
        response_body_sample: call.response_body_sample,
        credit_registration_ids: call.credit_registration_ids,
    }
}

fn to_admin_student_number(row: AdminVerifiedStudentNumber) -> AdminVerifiedStudentNumberRow {
    AdminVerifiedStudentNumberRow {
        id: row.id,
        user_id: row.user_id,
        user_email: row.user_email,
        first_name: row.first_name,
        last_name: row.last_name,
        student_number: row.student_number,
        sisu_person_id: row.sisu_person_id,
        verified_at: row.verified_at,
        verified_via: row.verified_via,
        verified_via_email: row.verified_via_email,
        linked_by_user_id: row.linked_by_user_id,
        link_reason: row.link_reason,
        verified_from_course_id: row.verified_from_course_id,
        live_registration_count: row.live_registration_count,
    }
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/overview", web::get().to(get_credit_registration_overview))
        .route("/suotar-health", web::get().to(get_suotar_health))
        .route(
            "/registrations",
            web::get().to(list_credit_registrations_for_admin),
        )
        .route(
            "/registrations/{credit_registration_id}",
            web::get().to(get_credit_registration_for_admin),
        )
        .route(
            "/registrations/{credit_registration_id}/transition",
            web::post().to(admin_transition_credit_registration),
        )
        .route("/account-linking", web::get().to(get_account_linking_stats))
        .route(
            "/student-numbers",
            web::get().to(list_verified_student_numbers_for_admin),
        )
        .route(
            "/student-numbers/{verified_student_number_id}/unlink",
            web::post().to(admin_unlink_student_number),
        )
        .route(
            "/account-linking/resend",
            web::post().to(admin_resend_account_linking_email),
        )
        .route(
            "/account-linking/resolve-person",
            web::post().to(admin_resolve_student_number_for_linking),
        )
        .route(
            "/account-linking/manual-link",
            web::post().to(admin_manually_link_student_number),
        )
        .route(
            "/materialize",
            web::post().to(admin_materialize_credit_registrations),
        )
        .route("/phases/{phase}/pause", web::post().to(admin_pause_phase))
        .route("/phases/{phase}/resume", web::post().to(admin_resume_phase))
        .route(
            "/phases/{phase}/run-now",
            web::post().to(admin_run_phase_now),
        );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;
    use headless_lms_models::library::credit_registration::account_linking::{
        DiscoveredPerson, claim_linking_mails,
    };

    fn manual_link_payload(
        reason: &str,
        student_number: &str,
        sisu_person_id: &str,
    ) -> AdminManuallyLinkStudentNumberPayload {
        AdminManuallyLinkStudentNumberPayload {
            user_id: Uuid::new_v4(),
            student_number: student_number.to_string(),
            sisu_person_id: sisu_person_id.to_string(),
            reason: reason.to_string(),
        }
    }

    #[test]
    fn a_manual_link_is_refused_without_a_preview_and_without_a_reason() {
        assert!(
            manual_link_request(&manual_link_payload(
                "Host bounces our mail.",
                "012345678",
                ""
            ))
            .is_err()
        );
        assert!(manual_link_request(&manual_link_payload("   ", "012345678", "hy-hlo-1")).is_err());
        assert!(manual_link_request(&manual_link_payload("", "012345678", "hy-hlo-1")).is_err());
        assert!(
            manual_link_request(&manual_link_payload(
                "Host bounces our mail.",
                "",
                "hy-hlo-1"
            ))
            .is_err()
        );
        let payload =
            manual_link_payload("  Host bounces our mail.  ", " 012345678 ", " hy-hlo-1 ");
        let allowed = manual_link_request(&payload)
            .expect("a reason, a number and a previewed person id are all there");
        assert_eq!(allowed.reason, "Host bounces our mail.");
        assert_eq!(allowed.student_number, "012345678");
        assert_eq!(allowed.previewed_person_id, "hy-hlo-1");
    }

    #[actix_web::test]
    async fn the_rate_cap_override_retires_the_ledger_rows_and_audits_itself() {
        insert_data!(:tx, :user, :org, :course);

        let claimed = claim_linking_mails(
            tx.as_mut(),
            &DiscoveredPerson {
                sisu_person_id: "hy-hlo-1".to_string(),
                student_number: "012345678".to_string(),
                first_names: Some("Aada Maria".to_string()),
                last_name: Some("Virtanen".to_string()),
                course_id: course,
                addresses: vec!["aada@helsinki.fi".to_string()],
            },
        )
        .await
        .unwrap();
        assert_eq!(claimed.claimed, 1);
        assert_eq!(
            credit_registration_account_linking_emails::count_sent_for_person_and_course(
                tx.as_mut(),
                "hy-hlo-1",
                course,
            )
            .await
            .unwrap(),
            1
        );

        let retired = retire_capped_mails(
            tx.as_mut(),
            user,
            course,
            "012345678",
            "The recipient's mail host rejects everything we send.",
        )
        .await
        .unwrap();
        assert_eq!(retired, 1);
        assert_eq!(
            credit_registration_account_linking_emails::count_sent_for_person_and_course(
                tx.as_mut(),
                "hy-hlo-1",
                course,
            )
            .await
            .unwrap(),
            0
        );

        let actions =
            models::credit_registration_admin_actions::get_by_actor(tx.as_mut(), user, 10)
                .await
                .unwrap();
        assert_eq!(actions.len(), 1);
        let action = &actions[0];
        assert_eq!(
            action.action,
            CreditRegistrationAdminAction::OverrideRateCap
        );
        assert_eq!(action.actor_role, GLOBAL_ADMIN_ROLE);
        assert_eq!(
            action.reason.as_deref(),
            Some("The recipient's mail host rejects everything we send.")
        );
        assert_eq!(action.affected_row_count, Some(1));
    }

    #[actix_web::test]
    async fn an_override_with_nothing_to_retire_writes_nothing() {
        insert_data!(:tx, :user, :org, :course);

        let retired = retire_capped_mails(tx.as_mut(), user, course, "012345678", "No mails yet.")
            .await
            .unwrap();
        assert_eq!(retired, 0);
        assert!(
            models::credit_registration_admin_actions::get_by_actor(tx.as_mut(), user, 10)
                .await
                .unwrap()
                .is_empty()
        );
    }
}
