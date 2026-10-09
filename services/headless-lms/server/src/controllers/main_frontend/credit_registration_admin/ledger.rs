//! Viewing and hand-transitioning rows of the credit registration ledger.

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::credit_registration_account_linking_emails;
use headless_lms_models::credit_registration_admin_actions::{
    CreditRegistrationAdminAction, CreditRegistrationAdminActionFilters,
    CreditRegistrationAdminActionRecord, CreditRegistrationAdminActionTarget, GLOBAL_ADMIN_ROLE,
    NewCreditRegistrationAdminAction,
};
use headless_lms_models::credit_registration_enrolment_routes::CreditRegistrationEnrolmentRoute;
use headless_lms_models::credit_registration_events::{
    CreditRegistrationEventKind, NotImprovedAttainment, SuotarAnswer,
};
use headless_lms_models::credit_registration_roster_schedules::{self, ScheduleSelection};
use headless_lms_models::credit_registrations::{
    self, AdminCreditRegistration, AdminCreditRegistrationFilters, AdminCreditRegistrationSort,
    AttentionReason, AttentionStanding, BlockingProblem, CreditRegistrationErrorCode,
    CreditRegistrationState, HandActionAvailability, ResubmissionFacts, ResubmissionRefusal,
    ResubmissionStrictness, Transition,
};
use headless_lms_models::email_deliveries::EmailSendStatusReport;
use headless_lms_models::library::credit_registration::CreditRegistrationPendingReason;
use headless_lms_models::library::credit_registration::backoff::{
    NOT_REGISTERED_REIMPORT_ADMIN_THRESHOLD, PARTIAL_REGISTRATION_ADMIN_AFTER,
    UNCERTAIN_ADMIN_AFTER, VERIFY_MAX_AGE,
};
use headless_lms_models::library::credit_registration::enrolment_check_schedule::EnrolmentCheckSource;
use headless_lms_models::library::credit_registration::student_notifications::{
    self, CreditRegistrationNotificationKind, RegistrationNotificationEmail,
};
use headless_lms_models::library::credit_registration::timeline::{
    Engagement, TimelinePhase, TimelineStep, WaitsOn,
};
use headless_lms_models::suotar_api_calls;
use headless_lms_models::verified_student_numbers::{self, StudentNumberVerificationMethod};
use std::collections::{HashMap, HashSet};
use utoipa::ToSchema;

use crate::prelude::*;
use headless_lms_utils::secret_string::expose_option;
use secrecy::{ExposeSecret, SecretString};

use super::{
    AdminLinkingEmail, attention_rules, authorize_credit_registration_admin, build_linking_emails,
    required_reason,
};

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
    /// What a `pending` row is waiting on, which the ledger does not store; `null` for every other
    /// state.
    pub pending_reason: Option<CreditRegistrationPendingReason>,
    pub timeline_step: TimelineStep,
    pub phase: TimelinePhase,
    pub waits_on: WaitsOn,
    /// Only on the steps that wait on the student.
    pub engagement: Option<Engagement>,
    /// When the row entered its timeline phase: what "In this phase since" shows.
    pub phase_started_at: DateTime<Utc>,
    /// When the row entered its state. Same-state checks move `state_entered_at` but not this.
    pub state_changed_at: DateTime<Utc>,
    /// Moved by every write that keeps the state too, so it is when the row was last touched, not
    /// how long it has been where it is.
    pub state_entered_at: DateTime<Utc>,
    /// Every reason the Needs attention queue picks the row for; empty when it is not picked.
    pub attention_reasons: Vec<AttentionReason>,
    /// Which Needs attention section the row is in; `None` when it is not picked.
    pub attention_standing: Option<AttentionStanding>,
    /// The student's latest "I have enrolled" press for the completion.
    pub pressed_at: Option<DateTime<Utc>>,
    pub enrolment_route: Option<CreditRegistrationEnrolmentRoute>,
    pub last_visited_at: Option<DateTime<Utc>>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub needs_admin_attention: bool,
    pub next_attempt_at: DateTime<Utc>,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub registered_at: Option<DateTime<Utc>>,
    pub terminal_at: Option<DateTime<Utc>>,
    /// When verify first saw only the assessment item attainment.
    pub partially_registered_at: Option<DateTime<Utc>>,
    /// Suotar's `retryAfter` for a pending submission: resending earlier may duplicate it.
    pub resubmit_not_before: Option<DateTime<Utc>>,
    /// How many times Suotar has lost the submission and it was sent again.
    pub not_registered_reimport_count: i32,
    pub is_waiting_for_enrolment: bool,
    pub no_usable_enrolment_since: Option<DateTime<Utc>>,
    pub enrolment_checked_at: Option<DateTime<Utc>>,
    /// The next scheduled enrolment check.
    pub enrolment_check_due_at: Option<DateTime<Utc>>,
    pub enrolment_checks_stopped_at: Option<DateTime<Utc>>,
    /// Frozen on the row before it was sent, so it is what we actually submitted.
    pub student_number: Option<String>,
    pub sisu_person_id: Option<String>,
    pub uh_course_code: Option<String>,
    pub selected_enrolment_id: Option<String>,
    pub grade_scale_id: Option<String>,
    pub grade_id: Option<String>,
    pub credits: Option<f32>,
    pub submitted_attainment_id: Option<String>,
    pub sisu_attainment_id: Option<String>,
    pub submit_retry_count: i32,
    pub verify_attempt_count: i32,
    pub attempt_number: i32,
    pub superseded: bool,
    pub superseded_by_id: Option<Uuid>,
    /// What the single-row hand transition would allow: what the row's action controls render from.
    pub hand_actions: HandActionAvailability,
    /// The account's link now, which is not always the number frozen on the row.
    pub verified_student_number: Option<String>,
    pub verified_student_number_at: Option<DateTime<Utc>>,
    /// `admin_manual` means support established the link rather than the student proving it.
    pub verified_student_number_via: Option<StudentNumberVerificationMethod>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminCreditRegistrationEvent {
    pub id: Uuid,
    /// The attempt the event belongs to.
    pub credit_registration_id: Uuid,
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
    /// The requestItemId the row went out under in the call behind this event.
    pub request_item_id: Option<String>,
    pub suotar_endpoint: Option<suotar_api_calls::SuotarEndpoint>,
    pub suotar_requested_at: Option<DateTime<Utc>>,
    pub suotar_answered_at: Option<DateTime<Utc>>,
    pub suotar_answer: Option<SuotarAnswer>,
    /// Suotar's own per-item code, e.g. `enrolmentNotFound`, which `error_code` classifies and
    /// sometimes drops. `None` when no item answer came back.
    pub suotar_code: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminSuotarApiCall {
    pub id: Uuid,
    pub endpoint: suotar_api_calls::SuotarEndpoint,
    pub started_at: DateTime<Utc>,
    pub duration_ms: Option<i32>,
    pub http_status: Option<i32>,
    pub succeeded: bool,
    pub request_level_error_code: Option<String>,
    pub worker_name: String,
}

/// One of the two student terminal-state mails, in full: `send_status.failure_code` is what drives
/// the decision to look at the relay.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminNotificationEmail {
    /// The attempt the mail was sent for.
    pub credit_registration_id: Uuid,
    pub kind: CreditRegistrationNotificationKind,
    /// The delivery this registration is pinned to, so support can find the message in the queue and
    /// tell "still the first mail" from "a second one went out".
    pub email_delivery_id: Uuid,
    pub send_status: EmailSendStatusReport,
}

/// The pipeline's own limits for asking an admin to look, from `library::credit_registration::backoff`.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Copy, ToSchema)]
pub struct AdminAttentionThresholds {
    pub partial_registration_secs: i64,
    pub uncertain_secs: i64,
    pub verify_window_secs: i64,
    pub not_registered_reimports: i32,
}

impl AdminAttentionThresholds {
    pub const CURRENT: Self = Self {
        partial_registration_secs: PARTIAL_REGISTRATION_ADMIN_AFTER.num_seconds(),
        uncertain_secs: UNCERTAIN_ADMIN_AFTER.num_seconds(),
        verify_window_secs: VERIFY_MAX_AGE.num_seconds(),
        not_registered_reimports: NOT_REGISTERED_REIMPORT_ADMIN_THRESHOLD,
    };
}

/// What the student did around the completion, with full timestamps, for the timeline.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminCreditRegistrationJourney {
    /// When they first picked any language version of the course.
    pub course_started_at: Option<DateTime<Utc>>,
    /// The first visit to the registration page; a check request recorded before any visit makes
    /// this the time of that request instead.
    pub first_visited_at: Option<DateTime<Utc>>,
    /// Only the latest visit is kept after the first.
    pub last_visited_at: Option<DateTime<Utc>>,
    pub last_check_requested_at: Option<DateTime<Utc>>,
    pub check_request_source: Option<EnrolmentCheckSource>,
    /// How they enrolled.
    pub enrolment_route: Option<CreditRegistrationEnrolmentRoute>,
    /// The latest "I have enrolled" press; overwritten by a later one, cleared if taken back.
    pub pressed_at: Option<DateTime<Utc>>,
    /// Sisu's own time for the enrolment we found, where Sisu gave one.
    pub sisu_enrolled_at: Option<DateTime<Utc>>,
}

/// For a student who pressed "I have enrolled" and has no linked student number: their course
/// code's enrolment list schedule, and what went out on the code since the press.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminLinkingSchedule {
    pub course_code: String,
    pub last_fetched_at: Option<DateTime<Utc>>,
    /// The latest fetch that could send linking emails; the stuck rule counts from here.
    pub last_mailing_fetch_started_at: Option<DateTime<Utc>>,
    pub next_fetch_at: DateTime<Utc>,
    pub is_fetch_failing: bool,
    pub is_enrolment_list_empty: bool,
    /// On any course sharing the code. Not attributable to this student until a link is used.
    pub linking_emails_since_press: i64,
    pub last_linking_email_at: Option<DateTime<Utc>>,
}

/// The row's standing on the Needs attention queue.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminRegistrationAttention {
    pub reasons: Vec<AttentionReason>,
    pub standing: AttentionStanding,
    pub blocking_problem: Option<BlockingProblem>,
    /// The dismissal in force, if any; a row whose reasons all fall under it is `dismissed`.
    pub dismissed_reasons: Option<Vec<AttentionReason>>,
    pub dismissed_at: Option<DateTime<Utc>>,
    pub dismissed_by_user_id: Option<Uuid>,
    pub dismissal_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminCreditRegistrationDetails {
    pub attention_thresholds: AdminAttentionThresholds,
    pub registration: AdminCreditRegistrationRow,
    /// `None` when nothing picks the row.
    pub attention: Option<AdminRegistrationAttention>,
    pub journey: AdminCreditRegistrationJourney,
    /// Only for a student waiting for a student number who pressed "I have enrolled".
    pub linking_schedule: Option<AdminLinkingSchedule>,
    /// Every attempt for the same completion, newest first, this one included.
    pub attempts: Vec<AdminCreditRegistrationRow>,
    /// Every attempt's events, oldest first, so one timeline covers the whole completion.
    pub events: Vec<AdminCreditRegistrationEvent>,
    /// The calls the timeline refers to, newest first.
    pub suotar_api_calls: Vec<AdminSuotarApiCall>,
    /// Admin and teacher actions targeting this row.
    pub actions: Vec<CreditRegistrationAdminActionRecord>,
    /// Every mail addressed to this person, on any course.
    pub linking_emails: Vec<AdminLinkingEmail>,
    /// The student mails queued for every attempt ("Please register" is `action_needed`), with the
    /// same send status the student and the teacher are shown.
    pub notification_emails: Vec<AdminNotificationEmail>,
    /// The grade the registry already held, for a row it declined as no improvement. The row's own
    /// grade is what we sent.
    pub not_improved_attainment: Option<NotImprovedAttainment>,
}

/// The states an admin may move a row to; everything else is the pipeline's to decide.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AdminCreditRegistrationStateMove {
    /// Resubmit: the escape hatch out of `submission_uncertain`, and how a `misregistered` row is
    /// tried again.
    ReadyToSubmit,
    Cancelled,
}

impl AdminCreditRegistrationStateMove {
    fn to_state(self) -> CreditRegistrationState {
        match self {
            Self::ReadyToSubmit => CreditRegistrationState::ReadyToSubmit,
            Self::Cancelled => CreditRegistrationState::Cancelled,
        }
    }
}

/// What one hand action does to a row: either a state move, or something that leaves the state
/// alone. Kept apart because only the first is a transition, and only the first is refusable.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum AdminCreditRegistrationAction {
    StateMove {
        to_state: AdminCreditRegistrationStateMove,
    },
    /// Stops the row asking for a human.
    ClearNeedsAdminAttention,
    /// Makes the row due, so the phase owning its state claims it on the next pass instead of
    /// waiting out a backoff of up to a day.
    CheckNow,
}

impl AdminCreditRegistrationAction {
    /// Why this action is refused on the row, or `None` if it may go ahead.
    fn refusal(
        self,
        facts: &ResubmissionFacts,
        strictness: ResubmissionStrictness,
    ) -> Option<ResubmissionRefusal> {
        match self {
            Self::StateMove { to_state } => {
                facts.admin_transition_refusal(to_state.to_state(), strictness)
            }
            Self::CheckNow => facts.check_now_refusal(),
            // Even clearing a flag on a replaced attempt is an admin acting on the wrong row.
            Self::ClearNeedsAdminAttention if facts.is_superseded => {
                Some(ResubmissionRefusal::Superseded)
            }
            Self::ClearNeedsAdminAttention => None,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminTransitionCreditRegistrationPayload {
    pub action: AdminCreditRegistrationAction,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AdminTransitionOutcome {
    Applied,
    /// The row was left where it was; `refusal` says why.
    Refused,
    NoChange,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminTransitionCreditRegistrationResult {
    pub outcome: AdminTransitionOutcome,
    /// Set exactly when the outcome is `refused`.
    pub refusal: Option<ResubmissionRefusal>,
    pub state: CreditRegistrationState,
    pub needs_admin_attention: bool,
}

/// A fat-finger bound on one selection; a bigger one is taken in several passes.
const MAX_ROWS_PER_BULK_TRANSITION: i64 = 500;
const MAX_ROWS_PER_REQUEUE: i64 = 5_000;
/// A detail view's related-rows lookups (other attempts, calls, actions) never paginate; this just
/// bounds them against a pathological completion.
const MAX_RELATED_ROWS: i64 = u8::MAX as i64;

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminBulkTransitionPayload {
    pub action: AdminCreditRegistrationAction,
    pub credit_registration_ids: Vec<Uuid>,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminBulkTransitionSkipCount {
    pub refusal: ResubmissionRefusal,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminBulkTransitionResult {
    pub applied_count: i64,
    pub skipped: Vec<AdminBulkTransitionSkipCount>,
    /// Distinct selected ids naming no live row.
    pub not_found_count: i64,
    pub max_rows_per_call: i64,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminRequeueRetryablePayload {
    pub course_id: Option<Uuid>,
    pub course_module_id: Option<Uuid>,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminRequeueRetryableResult {
    pub requeued_count: i64,
    pub max_rows_per_call: i64,
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
    student_number: Option<SecretString>,
    step: Option<Vec<TimelineStep>>,
    engagement: Option<Vec<Engagement>>,
    include_not_started: Option<bool>,
    needs_attention: Option<bool>,
    attention_reason: Option<Vec<AttentionReason>>,
    submitted_after: Option<DateTime<Utc>>,
    submitted_before: Option<DateTime<Utc>>,
    search: Option<SecretString>,
    include_superseded: Option<bool>,
    sort: Option<String>,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/registrations` - A page of the ledger, filtered
and sorted.
*/
#[instrument(skip(pool, app_conf))]
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
        ("step" = Option<Vec<TimelineStep>>, Query, description = "Timeline steps; repeat the parameter for several. A row waiting for a student number matches only if it completed since account linking began, as the overview counts it"),
        ("engagement" = Option<Vec<Engagement>>, Query, description = "Only rows at a step that waits on the student whose student did this; repeat for several"),
        ("include_not_started" = Option<bool>, Query, description = "Include rows at a step that waits on the student whose student has not started; left out by default"),
        ("needs_attention" = Option<bool>, Query, description = "Only rows counted in Needs attention"),
        ("attention_reason" = Option<Vec<AttentionReason>>, Query, description = "Only rows the Needs attention queue picks for one of these reasons, whatever their section; repeat for several"),
        ("submitted_after" = Option<DateTime<Utc>>, Query, description = "Submitted at or after"),
        ("submitted_before" = Option<DateTime<Utc>>, Query, description = "Submitted at or before"),
        ("search" = Option<String>, Query, description = "Name, email, student number, attainment id, stored error text, or a uuid"),
        ("include_superseded" = Option<bool>, Query, description = "Include replaced attempts"),
        ("sort" = Option<String>, Query, description = "last_activity (rows counted in Needs attention first), created, time_in_state or attempts")
    ),
    responses(
        (status = 200, description = "A page of the ledger", body = Page<AdminCreditRegistrationRow>)
    )
)]
pub async fn list_credit_registrations_for_admin(
    user: AuthUser,
    pool: web::Data<PgPool>,
    query: MultiQuery<ListCreditRegistrationsQuery>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Page<AdminCreditRegistrationRow>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let pagination = parse_pagination(query.page, query.limit, 50)?;
    let search = non_empty(expose_option(&query.search));
    let student_number = non_empty(expose_option(&query.student_number));
    let attention = AttentionLookup::load(&mut conn, &app_conf).await?;
    let needs_attention_ids =
        attention.ids(|row| row.standing == AttentionStanding::NeedsAttention);
    let attention_reasons: &[AttentionReason] =
        query.attention_reason.as_deref().unwrap_or_default();
    let selected_ids = (query.needs_attention.unwrap_or(false) || !attention_reasons.is_empty())
        .then(|| {
            attention.ids(|row| {
                (!query.needs_attention.unwrap_or(false)
                    || row.standing == AttentionStanding::NeedsAttention)
                    && (attention_reasons.is_empty()
                        || row
                            .reasons
                            .iter()
                            .any(|reason| attention_reasons.contains(reason)))
            })
        });
    let filters = AdminCreditRegistrationFilters {
        states: query.state.as_deref(),
        error_codes: query.error_code.as_deref(),
        course_id: query.course_id,
        course_module_id: query.course_module_id,
        user_id: query.user_id,
        student_number,
        steps: query.step.as_deref().unwrap_or_default(),
        engagements: query.engagement.as_deref().unwrap_or_default(),
        hide_not_started: !query.include_not_started.unwrap_or(false),
        account_linking_since: app_conf.suotar_configuration.account_linking_since,
        first_ids: Some(&needs_attention_ids),
        credit_registration_ids: selected_ids.as_deref(),
        submitted_after: query.submitted_after,
        submitted_before: query.submitted_before,
        search,
        search_id: search.and_then(|search| Uuid::parse_str(search).ok()),
        include_superseded: query.include_superseded.unwrap_or(false),
        ..AdminCreditRegistrationFilters::default()
    };
    let sort = match query.sort.as_deref() {
        Some("created") => AdminCreditRegistrationSort::Created,
        Some("time_in_state") => AdminCreditRegistrationSort::TimeInState,
        Some("attempts") => AdminCreditRegistrationSort::Attempts,
        _ => AdminCreditRegistrationSort::LastActivity,
    };

    let rows = credit_registrations::get_admin_facing(
        &mut conn,
        &filters,
        sort,
        pagination.limit(),
        pagination.offset(),
    )
    .await?;
    let total_count = rows.first().map_or(0, |row| row.total_count);
    let data = rows
        .into_iter()
        .map(|row| to_admin_row(row, &attention))
        .collect();

    token.authorized_ok(web::Json(Page::new(pagination, data, total_count)))
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/registrations/{credit_registration_id}` - One
row with its timeline, the calls that timeline refers to, the other attempts for the same completion,
the actions taken on it and its linking mails.
*/
#[instrument(skip(pool, app_conf))]
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
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<AdminCreditRegistrationDetails>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let id = *credit_registration_id;
    let attention_lookup = AttentionLookup::load(&mut conn, &app_conf).await?;
    let registration = one_admin_row(&mut conn, id)
        .await?
        .ok_or_else(|| controller_err!(NotFound, "Not found.".to_string()))?;
    let attempts = credit_registrations::get_admin_facing(
        &mut conn,
        &AdminCreditRegistrationFilters {
            user_id: Some(registration.user_id),
            course_id: Some(registration.course_id),
            course_module_completion_id: Some(registration.course_module_completion_id),
            include_superseded: true,
            ..AdminCreditRegistrationFilters::default()
        },
        AdminCreditRegistrationSort::Created,
        MAX_RELATED_ROWS,
        0,
    )
    .await?
    .into_iter()
    .map(|row| to_admin_row(row, &attention_lookup))
    .collect::<Vec<_>>();
    let attempt_ids: Vec<Uuid> = attempts.iter().map(|attempt| attempt.id).collect();

    let mut attempt_events = Vec::new();
    for attempt_id in &attempt_ids {
        attempt_events.extend(
            models::credit_registration_events::get_by_registration_id(&mut conn, *attempt_id)
                .await?,
        );
    }
    attempt_events.sort_by_key(|event| event.created_at);
    let events: Vec<AdminCreditRegistrationEvent> = attempt_events
        .into_iter()
        .map(|event| AdminCreditRegistrationEvent {
            id: event.id,
            credit_registration_id: event.credit_registration_id,
            created_at: event.created_at,
            kind: event.kind,
            from_state: event.from_state,
            to_state: event.to_state,
            error_code: event.error_code,
            message: event.message,
            actor_user_id: event.actor_user_id,
            suotar_api_call_id: event.suotar_api_call_id,
            suotar_code: event
                .details
                .as_ref()
                .and_then(|details| details.pointer("/response/code"))
                .and_then(|code| code.as_str())
                .map(str::to_string),
            details: event.details,
            request_item_id: event.request_item_id,
            suotar_endpoint: event.suotar_endpoint,
            suotar_requested_at: event.suotar_requested_at,
            suotar_answered_at: event.suotar_answered_at,
            suotar_answer: event.suotar_answer,
        })
        .collect();
    let suotar_api_calls =
        suotar_api_calls::get_by_credit_registration_id(&mut conn, id, MAX_RELATED_ROWS)
            .await?
            .into_iter()
            .map(to_admin_api_call)
            .collect();
    let actions = models::credit_registration_admin_actions::get_page(
        &mut conn,
        &CreditRegistrationAdminActionFilters {
            target_kind: Some(CreditRegistrationAdminActionTarget::CreditRegistration),
            target_id: Some(id),
            ..Default::default()
        },
        MAX_RELATED_ROWS,
        0,
    )
    .await?
    .into_iter()
    .map(|row| row.action)
    .collect();

    let sisu_person_id = match &registration.sisu_person_id {
        Some(person_id) => Some(person_id.clone()),
        None => verified_student_numbers::get_latest_including_deleted_by_user_id(
            &mut conn,
            registration.user_id,
        )
        .await?
        .and_then(|link| link.sisu_person_id),
    };
    let linking_emails = match sisu_person_id {
        Some(person_id) => {
            let mails = credit_registration_account_linking_emails::get_by_sisu_person_id(
                &mut conn,
                person_id.expose_secret(),
            )
            .await?;
            build_linking_emails(&mut conn, mails).await?
        }
        None => Vec::new(),
    };

    let notification_emails = student_notifications::get_for_registrations(&mut conn, &attempt_ids)
        .await?
        .into_iter()
        .map(
            |mail: RegistrationNotificationEmail| AdminNotificationEmail {
                credit_registration_id: mail.credit_registration_id,
                kind: mail.kind,
                email_delivery_id: mail.email_delivery_id,
                send_status: mail.send_status,
            },
        )
        .collect();

    let not_improved_attainment =
        models::credit_registration_events::get_not_improved_attainment(&mut conn, id).await?;

    let journey = credit_registrations::get_registration_journey(&mut conn, id)
        .await?
        .map(|journey| AdminCreditRegistrationJourney {
            course_started_at: journey.course_started_at,
            first_visited_at: journey.first_visited_at,
            last_visited_at: journey.last_visited_at,
            last_check_requested_at: journey.last_check_requested_at,
            check_request_source: journey.check_request_source,
            enrolment_route: journey.enrolment_route,
            pressed_at: journey.pressed_at,
            sisu_enrolled_at: journey
                .selected_enrolment_date_time
                .as_deref()
                .and_then(|text| DateTime::parse_from_rfc3339(text).ok())
                .map(|at| at.with_timezone(&Utc))
                .or(journey.checked_enrolled_at),
        })
        .ok_or_else(|| controller_err!(NotFound, "Not found.".to_string()))?;
    let linking_schedule = linking_schedule_for(
        &mut conn,
        id,
        app_conf.suotar_configuration.account_linking_since,
    )
    .await?;
    let attention = attention_lookup
        .rows
        .iter()
        .find(|row| row.id == id)
        .map(|row| AdminRegistrationAttention {
            reasons: row.reasons.clone(),
            standing: row.standing,
            blocking_problem: row.blocking_problem.clone(),
            dismissed_reasons: row.dismissed_reasons.clone(),
            dismissed_at: row.dismissed_at,
            dismissed_by_user_id: row.dismissed_by_user_id,
            dismissal_reason: row.dismissal_reason.clone(),
        });

    token.authorized_ok(web::Json(AdminCreditRegistrationDetails {
        attention_thresholds: AdminAttentionThresholds::CURRENT,
        registration: to_admin_row(registration, &attention_lookup),
        attention,
        journey,
        linking_schedule,
        attempts,
        events,
        suotar_api_calls,
        actions,
        linking_emails,
        notification_emails,
        not_improved_attainment,
    }))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/registrations/{credit_registration_id}/transition`
- Moves one row by hand.

The escape hatch out of `submission_uncertain`, which the pipeline never leaves on its own because
re-importing could put a second attainment on a real transcript. Even here, a row is not resubmitted
while Suotar may still hold its earlier submission as pending (`submission_uncertain_too_recent`,
`submission_pending`). The row's `hand_actions` says in advance what this refuses.
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
        (status = 422, description = "No reason given"),
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
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let reason = required_reason(&payload.reason)?;
    let id = *credit_registration_id;
    let row = credit_registrations::get_by_id(&mut conn, id).await?;
    if row.superseded_by_id.is_some() {
        return Err(controller_err!(
            BadRequest,
            "This attempt has been replaced by a later one. Act on the later one.".to_string()
        ));
    }

    // `Any`: a human is already looking at this one row, so unlike the bulk transition below it is
    // not refused for being `submission_uncertain`.
    if let Some(refusal) = payload
        .action
        .refusal(&row.resubmission_facts(), ResubmissionStrictness::Any)
    {
        return token.authorized_ok(web::Json(AdminTransitionCreditRegistrationResult {
            outcome: AdminTransitionOutcome::Refused,
            refusal: Some(refusal),
            state: row.state,
            needs_admin_attention: row.needs_admin_attention,
        }));
    }

    let mut tx = conn.begin().await?;
    let applied = apply_transition(&mut tx, &row, payload.action, user.id, reason).await?;
    if applied.needs_due_now {
        credit_registrations::make_due_now_batch(
            &mut tx,
            &[id],
            EnrolmentCheckSource::AdminRequest,
        )
        .await?;
    }
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_id: Some(id),
            reason: Some(reason.to_string()),
            before_state: Some(row.state),
            after_state: Some(applied.state),
            details: Some(serde_json::json!({ "outcome": applied.outcome })),
            affected_row_count: Some(1),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::TransitionItem,
                CreditRegistrationAdminActionTarget::CreditRegistration,
                user.id,
                GLOBAL_ADMIN_ROLE,
            )
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(AdminTransitionCreditRegistrationResult {
        outcome: applied.outcome,
        refusal: None,
        state: applied.state,
        needs_admin_attention: applied.needs_admin_attention,
    }))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/registrations/bulk-transition` - Moves a
selection of rows by hand, one transaction for the lot.

Resubmitting or cancelling refuses every row in `submission_uncertain`, whatever the selection
said. Taking one of those back to `ready_to_submit` is a decision about one student's transcript,
made after somebody has looked the attainment up; a checkbox in a list is not that, and a mis-click
here would put a second attainment on every one of them. Those rows are reported back untouched, to
be dealt with one at a time, as is a row whose earlier submission Suotar still holds open
(`submission_pending`). Each attention item's `hand_actions` says in advance what this skips.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/registrations/bulk-transition",
    operation_id = "adminBulkTransitionCreditRegistrations",
    tag = "credit-registration-admin",
    request_body = AdminBulkTransitionPayload,
    responses(
        (status = 200, description = "What each selected row did", body = AdminBulkTransitionResult),
        (status = 422, description = "No reason given, or more ids than one call may take")
    )
)]
pub async fn admin_bulk_transition_credit_registrations(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<AdminBulkTransitionPayload>,
) -> ControllerResult<web::Json<AdminBulkTransitionResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let reason = required_reason(&payload.reason)?;
    if payload.credit_registration_ids.len() as i64 > MAX_ROWS_PER_BULK_TRANSITION {
        return Err(controller_err!(
            BadRequest,
            format!("At most {MAX_ROWS_PER_BULK_TRANSITION} registrations per call.")
        ));
    }

    // A selection built by clicking can name the same row twice, and reporting the duplicate as a
    // registration that does not exist would send an admin looking for a deleted row.
    let ids: Vec<Uuid> = payload
        .credit_registration_ids
        .iter()
        .copied()
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();

    let mut tx = conn.begin().await?;
    // Locked, and read inside the transaction: each row's refusal is judged here and acted on below,
    // so a row the pipeline moves in between would make `apply_transition` refuse it and take every
    // row already applied down with it.
    let rows = credit_registrations::get_by_ids_for_update(&mut tx, &ids).await?;

    let mut applied_count = 0;
    let mut due_now_ids = Vec::new();
    let mut skipped: HashMap<ResubmissionRefusal, i64> = HashMap::new();
    for row in &rows {
        match payload.action.refusal(
            &row.resubmission_facts(),
            ResubmissionStrictness::AnyExceptSubmissionUncertain,
        ) {
            Some(refusal) => *skipped.entry(refusal).or_insert(0) += 1,
            None => {
                let applied =
                    apply_transition(&mut tx, row, payload.action, user.id, reason).await?;
                if applied.needs_due_now {
                    due_now_ids.push(row.id);
                }
                applied_count += 1;
            }
        }
    }
    // Batched rather than one `UPDATE` per row inside the loop above: the row transition needs its
    // own audit event per row, but making it due now does not.
    credit_registrations::make_due_now_batch(
        &mut tx,
        &due_now_ids,
        EnrolmentCheckSource::AdminRequest,
    )
    .await?;
    let mut skipped: Vec<AdminBulkTransitionSkipCount> = skipped
        .into_iter()
        .map(|(refusal, count)| AdminBulkTransitionSkipCount { refusal, count })
        .collect();
    skipped.sort_by_key(|skip| std::cmp::Reverse(skip.count));

    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            reason: Some(reason.to_string()),
            details: Some(serde_json::json!({
                "action": payload.action,
                "credit_registration_ids": payload.credit_registration_ids,
                "skipped": skipped,
            })),
            affected_row_count: Some(applied_count),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::TransitionItem,
                CreditRegistrationAdminActionTarget::CreditRegistration,
                user.id,
                GLOBAL_ADMIN_ROLE,
            )
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(AdminBulkTransitionResult {
        applied_count: i64::from(applied_count),
        skipped,
        not_found_count: ids.len() as i64 - rows.len() as i64,
        max_rows_per_call: MAX_ROWS_PER_BULK_TRANSITION,
    }))
}

/**
POST `/api/v0/main-frontend/credit-registration-admin/registrations/requeue-retryable` - Makes every
`failed_retryable` row waiting out a backoff due now.

The button pressed once the study registry says an outage is over. Touches nothing but
`next_attempt_at`: the rows are already where the pipeline wants them, they are merely waiting.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/registrations/requeue-retryable",
    operation_id = "adminRequeueRetryableCreditRegistrations",
    tag = "credit-registration-admin",
    request_body = AdminRequeueRetryablePayload,
    responses(
        (status = 200, description = "How many were made due", body = AdminRequeueRetryableResult),
        (status = 422, description = "No reason given")
    )
)]
pub async fn admin_requeue_retryable_credit_registrations(
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<AdminRequeueRetryablePayload>,
) -> ControllerResult<web::Json<AdminRequeueRetryableResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let reason = required_reason(&payload.reason)?;

    let mut tx = conn.begin().await?;
    let requeued_count = credit_registrations::requeue_retryable_now(
        &mut tx,
        payload.course_id,
        payload.course_module_id,
        MAX_ROWS_PER_REQUEUE,
    )
    .await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_id: payload.course_id,
            reason: Some(reason.to_string()),
            details: Some(serde_json::json!({
                "course_id": payload.course_id,
                "course_module_id": payload.course_module_id,
            })),
            affected_row_count: Some(i32::try_from(requeued_count).unwrap_or(i32::MAX)),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::RequeueBatch,
                match payload.course_id {
                    Some(_) => CreditRegistrationAdminActionTarget::Course,
                    None => CreditRegistrationAdminActionTarget::CreditRegistration,
                },
                user.id,
                GLOBAL_ADMIN_ROLE,
            )
        },
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(AdminRequeueRetryableResult {
        requeued_count,
        max_rows_per_call: MAX_ROWS_PER_REQUEUE,
    }))
}

/// What one hand action did to its row.
struct AppliedHandAction {
    outcome: AdminTransitionOutcome,
    /// Where the row ended up.
    state: CreditRegistrationState,
    needs_admin_attention: bool,
    /// The caller must still make the row due now.
    needs_due_now: bool,
}

/// Applies one hand action in the caller's transaction.
///
/// The caller has already asked `admin_transition_refusal` whether this row may take the move,
/// because what a refusal is reported as differs per caller. Making the row due is left to the
/// caller too, rather than done here, so the bulk caller can batch it over every row it applies
/// instead of one `UPDATE` per row.
async fn apply_transition(
    tx: &mut PgConnection,
    row: &credit_registrations::CreditRegistration,
    action: AdminCreditRegistrationAction,
    actor_user_id: Uuid,
    reason: &str,
) -> Result<AppliedHandAction, ControllerError> {
    let id = row.id;
    Ok(match action {
        AdminCreditRegistrationAction::ClearNeedsAdminAttention => {
            if !row.needs_admin_attention {
                AppliedHandAction {
                    outcome: AdminTransitionOutcome::NoChange,
                    state: row.state,
                    needs_admin_attention: false,
                    needs_due_now: false,
                }
            } else {
                credit_registrations::set_needs_admin_attention(
                    tx,
                    id,
                    credit_registrations::AdminAttention::Clear,
                )
                .await?;
                insert_admin_action_event(tx, id, actor_user_id, reason).await?;
                AppliedHandAction {
                    outcome: AdminTransitionOutcome::Applied,
                    state: row.state,
                    needs_admin_attention: false,
                    needs_due_now: false,
                }
            }
        }
        AdminCreditRegistrationAction::CheckNow => {
            insert_admin_action_event(tx, id, actor_user_id, reason).await?;
            AppliedHandAction {
                outcome: AdminTransitionOutcome::Applied,
                state: row.state,
                needs_admin_attention: row.needs_admin_attention,
                needs_due_now: true,
            }
        }
        AdminCreditRegistrationAction::StateMove { to_state } => {
            let to_state = to_state.to_state();
            let after = credit_registrations::transition(
                tx,
                id,
                &Transition {
                    needs_admin_attention: Some(credit_registrations::AdminAttention::Clear),
                    event_kind: CreditRegistrationEventKind::AdminAction,
                    event_message: Some(reason.to_string()),
                    actor_user_id: Some(actor_user_id),
                    // Refuses to overwrite a row the pipeline (or another admin) has moved on since
                    // `row` was read. The bulk caller reads its rows locked, so only the single-row
                    // path can actually trip this.
                    expected_from_state: Some(row.state),
                    ..Transition::by_hand(to_state)
                },
            )
            .await?;
            // Nothing else brings the row forward, so without a due-now the resubmit would sit out
            // the backoff whatever failed last set.
            AppliedHandAction {
                outcome: AdminTransitionOutcome::Applied,
                state: after.state,
                needs_admin_attention: after.needs_admin_attention,
                needs_due_now: !after.state.is_terminal(),
            }
        }
    })
}

/// Records an admin action against the row's timeline without moving its state, for the two
/// transitions that only clear a flag or reschedule the row.
async fn insert_admin_action_event(
    tx: &mut PgConnection,
    id: Uuid,
    actor_user_id: Uuid,
    reason: &str,
) -> Result<(), ControllerError> {
    models::credit_registration_events::insert(
        tx,
        &models::credit_registration_events::NewCreditRegistrationEvent {
            actor_user_id: Some(actor_user_id),
            message: Some(reason.to_string()),
            ..models::credit_registration_events::NewCreditRegistrationEvent::new(
                id,
                CreditRegistrationEventKind::AdminAction,
            )
        },
    )
    .await?;
    Ok(())
}

async fn one_admin_row(
    conn: &mut PgConnection,
    id: Uuid,
) -> Result<Option<AdminCreditRegistration>, ControllerError> {
    let rows = credit_registrations::get_admin_facing(
        conn,
        &AdminCreditRegistrationFilters {
            id: Some(id),
            include_superseded: true,
            ..AdminCreditRegistrationFilters::default()
        },
        AdminCreditRegistrationSort::default(),
        MAX_RELATED_ROWS,
        0,
    )
    .await?;
    Ok(rows.into_iter().next())
}

/// The Needs attention queue as one request saw it, for marking rows of the ledger.
struct AttentionLookup {
    rows: Vec<AttentionLookupRow>,
}

struct AttentionLookupRow {
    id: Uuid,
    reasons: Vec<AttentionReason>,
    standing: AttentionStanding,
    blocking_problem: Option<BlockingProblem>,
    dismissed_reasons: Option<Vec<AttentionReason>>,
    dismissed_at: Option<DateTime<Utc>>,
    dismissed_by_user_id: Option<Uuid>,
    dismissal_reason: Option<String>,
}

impl AttentionLookup {
    async fn load(
        conn: &mut PgConnection,
        app_conf: &ApplicationConfiguration,
    ) -> Result<Self, ControllerError> {
        let rules = attention_rules(conn, app_conf).await?;
        let rows = credit_registrations::get_attention_items(conn, &rules)
            .await?
            .into_iter()
            .map(|row| {
                let standing = row.standing(&rules.blocking);
                AttentionLookupRow {
                    id: row.id,
                    standing,
                    blocking_problem: (standing == AttentionStanding::ExplainedByProblem)
                        .then(|| row.blocking_problem(&rules.blocking))
                        .flatten(),
                    reasons: row.reasons,
                    dismissed_reasons: row.dismissed_reasons,
                    dismissed_at: row.dismissed_at,
                    dismissed_by_user_id: row.dismissed_by_user_id,
                    dismissal_reason: row.dismissal_reason,
                }
            })
            .collect();
        Ok(Self { rows })
    }

    fn ids(&self, keep: impl Fn(&AttentionLookupRow) -> bool) -> Vec<Uuid> {
        self.rows
            .iter()
            .filter(|row| keep(row))
            .map(|row| row.id)
            .collect()
    }

    fn get(&self, id: Uuid) -> Option<&AttentionLookupRow> {
        self.rows.iter().find(|row| row.id == id)
    }
}

/// The code's schedule for a presser still waiting for a student number; `None` for anyone else.
async fn linking_schedule_for(
    conn: &mut PgConnection,
    id: Uuid,
    account_linking_since: Option<DateTime<Utc>>,
) -> Result<Option<AdminLinkingSchedule>, ControllerError> {
    let Some(presser) = credit_registrations::get_waiting_pressers(conn, None, Some(id))
        .await?
        .into_iter()
        .next()
    else {
        return Ok(None);
    };
    let Some(course_code) = presser.uh_course_code else {
        return Ok(None);
    };
    let Some(schedule) = credit_registration_roster_schedules::get_schedules(
        conn,
        None,
        ScheduleSelection::Code(&course_code),
        account_linking_since,
    )
    .await?
    .into_iter()
    .next() else {
        return Ok(None);
    };
    Ok(Some(AdminLinkingSchedule {
        next_fetch_at: schedule.next_fetch_at(Utc::now()),
        last_fetched_at: schedule.last_fetched_at,
        last_mailing_fetch_started_at: schedule.last_mailing_fetch_started_at,
        is_fetch_failing: schedule.consecutive_failures > 0,
        is_enrolment_list_empty: schedule.last_listed_person_count == Some(0),
        linking_emails_since_press: presser.linking_emails_on_code_since_press,
        last_linking_email_at: presser.last_linking_email_on_code_at,
        course_code,
    }))
}

fn to_admin_row(
    row: AdminCreditRegistration,
    attention: &AttentionLookup,
) -> AdminCreditRegistrationRow {
    let position = row.position();
    let picked = attention.get(row.id);
    let standing = picked.map(|picked| picked.standing);
    AdminCreditRegistrationRow {
        timeline_step: position.step,
        phase: position.step.phase(),
        waits_on: WaitsOn::of(
            position.step,
            position.engagement,
            standing == Some(AttentionStanding::NeedsAttention),
            credit_registrations::needs_course_setup(row.error_code),
        ),
        engagement: position.engagement,
        phase_started_at: row.phase_started_at(),
        state_changed_at: row.state_changed_at,
        attention_reasons: picked
            .map(|picked| picked.reasons.clone())
            .unwrap_or_default(),
        attention_standing: standing,
        pressed_at: row.pressed_at,
        enrolment_route: row.enrolment_route,
        last_visited_at: row.last_visited_at,
        superseded: row.superseded_by_id.is_some(),
        is_waiting_for_enrolment: row.is_waiting_for_enrolment(),
        pending_reason: row.pending_reason(),
        hand_actions: row
            .resubmission_facts()
            .hand_actions(ResubmissionStrictness::Any),
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
        partially_registered_at: row.partially_registered_at,
        resubmit_not_before: row.resubmit_not_before,
        not_registered_reimport_count: row.not_registered_reimport_count,
        no_usable_enrolment_since: row.no_usable_enrolment_since,
        enrolment_checked_at: row.enrolment_checked_at,
        enrolment_check_due_at: row.enrolment_check_due_at,
        enrolment_checks_stopped_at: row.enrolment_checks_stopped_at,
        student_number: expose_option(&row.student_number).map(str::to_owned),
        sisu_person_id: expose_option(&row.sisu_person_id).map(str::to_owned),
        uh_course_code: row.uh_course_code,
        selected_enrolment_id: row.selected_enrolment_id,
        grade_scale_id: row.grade_scale_id,
        grade_id: row.grade_id,
        credits: row.credits,
        submitted_attainment_id: row.submitted_attainment_id,
        sisu_attainment_id: row.sisu_attainment_id,
        submit_retry_count: row.submit_retry_count,
        verify_attempt_count: row.verify_attempt_count,
        attempt_number: row.attempt_number,
        superseded_by_id: row.superseded_by_id,
        verified_student_number: expose_option(&row.verified_student_number).map(str::to_owned),
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
        request_level_error_code: call.request_level_error_code,
        worker_name: call.worker_name,
    }
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/registrations",
        web::get().to(list_credit_registrations_for_admin),
    )
    .route(
        "/registrations/{credit_registration_id}",
        web::get().to(get_credit_registration_for_admin),
    )
    .route(
        "/registrations/bulk-transition",
        web::post().to(admin_bulk_transition_credit_registrations),
    )
    .route(
        "/registrations/requeue-retryable",
        web::post().to(admin_requeue_retryable_credit_registrations),
    )
    .route(
        "/registrations/{credit_registration_id}/transition",
        web::post().to(admin_transition_credit_registration),
    );
}
