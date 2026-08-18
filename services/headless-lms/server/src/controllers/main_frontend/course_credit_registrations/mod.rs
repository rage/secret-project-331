/*!
Handlers for HTTP requests to `/api/v0/main-frontend/course-credit-registrations`.

Teachers see the unmasked student number, but recipient addresses are masked to their domain, the
study registry's own error text is never returned, and nothing here can override a rate cap.

Every handler with a student in it authorizes on `ViewAndManageCreditRegistrations`, which an
assistant does not hold: `ViewUserProgressOrDetails` and `Edit` would both let a course's assistants —
often students on the same programme — list and export every classmate's national study registry
identity. The one exception is the module configuration, which names no student.

Every mutating handler writes exactly one `credit_registration_admin_actions` row with
`actor_role = 'course_teacher'`, in the transaction that has the effect.
*/

mod actions;
mod export;
mod retry;

use headless_lms_models::course_module_suotar_realisations::CourseModuleSuotarRealisation;
use headless_lms_models::course_modules::CourseModuleCreditRegistrationConfig;
use headless_lms_models::credit_registration_admin_actions::{
    COURSE_TEACHER_ROLE, CreditRegistrationAdminAction, CreditRegistrationAdminActionTarget,
    NewCreditRegistrationAdminAction,
};
use headless_lms_models::credit_registration_events::{
    CreditRegistrationEventKind, NotImprovedAttainment,
};
use headless_lms_models::credit_registrations::{
    CreditRegistrationErrorCode, CreditRegistrationState, TeacherCreditRegistration,
    TeacherCreditRegistrationFilters,
};
use headless_lms_models::email_deliveries::{EmailSendStatus, EmailSendStatusReport};
use headless_lms_models::library::credit_registration::StudentFacingCreditRegistrationStatus;
use headless_lms_models::library::credit_registration::account_linking::MAX_LINKING_MAILS_PER_PERSON_AND_COURSE;
use headless_lms_models::library::credit_registration::student_notifications;
use headless_lms_models::verified_student_numbers::StudentNumberVerificationMethod;
use headless_lms_models::{
    course_credit_registration_consents::CourseCreditRegistrationBlockedStudentCounts,
    credit_registration_account_linking_emails::{self, CreditRegistrationAccountLinkingEmail},
    verified_student_numbers,
};
use std::collections::HashMap;
use utoipa::{OpenApi, ToSchema};

use crate::domain::credit_registration_phases::PhaseContext;
use crate::domain::credit_registration_phases::linking_mail_resend::{
    LinkingMailResendOutcome, ResendDecision, resend_linking_mail_for_target,
};
use crate::prelude::*;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_utils::services::suotar::SuotarClient;

use super::credit_registrations::{NotificationEmailStatus, mask_email};

/// A fat-finger guard on top of the per-person caps, which this endpoint cannot relax.
const MAX_TEACHER_RESENDS_PER_HOUR: i64 = 20;

/// Marks the resend's study registry call in the call log as a manual action, not worker traffic.
const RESEND_CALLER: &str = "teacher-resend";

/// The by-user-ids lookup is bounded by what the caller names rather than by a page, so the payload
/// itself has to be bounded. Comfortably above the students tab's page size.
const MAX_USER_IDS_PER_REQUEST: usize = 500;

/// A regrade adds an attempt per student. Only a bound for the query above, not a rule.
const MAX_REGISTRATION_ROWS_PER_USER: i64 = 50;

#[derive(OpenApi)]
#[openapi(paths(
    get_course_credit_registration_module_configs,
    get_course_credit_registration_summary,
    get_course_credit_registrations_for_users,
    get_course_credit_registrations,
    get_credit_registration_details,
    resend_course_credit_registration_linking_email,
    retry::retry_credit_registration,
    retry::retry_failed_credit_registrations_for_course,
    actions::get_course_credit_registration_actions,
    export::export_course_credit_registrations
))]
pub(crate) struct MainFrontendCourseCreditRegistrationsApiDoc;

/// Every module of the course with its Suotar configuration, for the module editor.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseCreditRegistrationModuleConfigs {
    pub modules: Vec<CourseModuleCreditRegistrationConfig>,
    /// Every live realisation of every module of the course, to be grouped by `course_module_id`.
    pub realisations: Vec<CourseModuleSuotarRealisation>,
}

/// What we can honestly say about a linking mail: our send status and the address's domain.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct TeacherLinkingEmailStatus {
    pub email_send_status: EmailSendStatus,
    pub sent_at: Option<DateTime<Utc>>,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub retry_count: i32,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub emailed_to_masked: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseCreditRegistration {
    pub id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub course_instance_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    /// The same collapsed stage the student is shown, so both audiences read one classification.
    pub student_facing_status: StudentFacingCreditRegistrationStatus,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub needs_admin_attention: bool,
    pub next_attempt_at: DateTime<Utc>,
    pub registered_at: Option<DateTime<Utc>>,
    pub sisu_attainment_id: Option<String>,
    pub grade_id: Option<String>,
    pub credits: Option<f32>,
    pub attempt_number: i32,
    pub superseded: bool,
    /// In full: a masked number cannot be checked against a student card.
    pub student_number: Option<String>,
    pub student_number_verified_at: Option<DateTime<Utc>>,
    /// `admin_manual` means support established the link rather than the student proving it.
    pub student_number_verified_via: Option<StudentNumberVerificationMethod>,
    pub enrolment_realisation_name: Option<String>,
    /// Only where we can join the account to a Sisu person, which needs a link past or present.
    pub linking_email: Option<TeacherLinkingEmailStatus>,
    /// The terminal-state mail this row's status has, if one has been queued. Same derivation the
    /// student sees, so a teacher answering "did they hear from you" cannot be told something else.
    pub notification_email: Option<NotificationEmailStatus>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseCreditRegistrationModuleSummary {
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub enabled: bool,
    pub paused: bool,
    pub counts_by_state: Vec<CreditRegistrationStateCount>,
    /// `registered`, `duplicate` and `not_improved`: the credit exists in Sisu.
    pub success_count: i64,
    /// `failed_permanent` only: a retrying row is still working and `misregistered` is not terminal.
    pub failed_permanent_count: i64,
    pub needs_admin_attention_count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationStateCount {
    pub state: CreditRegistrationState,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseCreditRegistrationSummary {
    pub modules: Vec<CourseCreditRegistrationModuleSummary>,
    pub blocked_students: CourseCreditRegistrationBlockedStudentCounts,
    /// Of the unlinked consented students, the ones whose linking mail we never managed to hand over.
    pub linking_emails_failed_to_send_count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseCreditRegistrationsPage {
    pub data: Vec<CourseCreditRegistration>,
    pub total_pages: u32,
}

/// Body for the students-tab batch: the users of the current identity-list page.
#[derive(Debug, Deserialize, ToSchema)]
pub struct CourseCreditRegistrationUserIdsPayload {
    pub user_ids: Vec<Uuid>,
    pub course_instance_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct GetCourseCreditRegistrationsQuery {
    page: Option<u32>,
    limit: Option<u32>,
    search: Option<String>,
    state: Option<CreditRegistrationState>,
    course_instance_id: Option<Uuid>,
}

/// One event of the item timeline, without the stored request and response bodies: those are the
/// admin dashboard's, and the study registry's own wording is never rendered.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseCreditRegistrationEvent {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub kind: CreditRegistrationEventKind,
    pub from_state: Option<CreditRegistrationState>,
    pub to_state: Option<CreditRegistrationState>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    /// Our own wording, written by the pipeline or by whoever acted.
    pub message: Option<String>,
    pub actor_user_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationDetails {
    pub course_id: Uuid,
    pub course_name: String,
    pub registration: CourseCreditRegistration,
    /// Every attempt for the same completion, newest first, this one included.
    pub attempts: Vec<CourseCreditRegistration>,
    pub events: Vec<CourseCreditRegistrationEvent>,
    /// The grade the registry already held, for a row it declined as no improvement. The
    /// registration's own grade is what we sent.
    pub not_improved_attainment: Option<NotImprovedAttainment>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ResendLinkingEmailPayload {
    /// One of the two names the person; `user_id` only resolves for an account that has held a number.
    pub user_id: Option<Uuid>,
    pub student_number: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ResendLinkingEmailOutcome {
    /// A mail is owed and will be handed to the sender on the next run.
    Queued,
    AlreadyMailedToEveryKnownAddress,
    /// A cap refused it. Not overridable here; an admin can.
    RefusedByRateCap,
    NoAddressInStudyRegistry,
    NotOnTheCourseRoster,
    /// This account has never had a student number, so there is nothing to look up.
    NoStudentNumberKnown,
    /// The number is already linked to an account, so no linking mail is owed.
    AlreadyLinked,
    StudyRegistryUnavailable,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ResendLinkingEmailResult {
    pub outcome: ResendLinkingEmailOutcome,
    /// The latest mail for this person and course after the attempt, whatever the outcome.
    pub linking_email: Option<TeacherLinkingEmailStatus>,
    pub mails_sent_for_this_course: i64,
    pub max_mails_per_person_and_course: i64,
}

/**
GET `/api/v0/main-frontend/course-credit-registrations/courses/{course_id}/module-configs` - The
course's per-module credit registration configuration.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/courses/{course_id}/module-configs",
    operation_id = "getCourseCreditRegistrationModuleConfigs",
    tag = "course-credit-registrations",
    params(("course_id" = Uuid, Path, description = "Course id")),
    responses(
        (status = 200, description = "The course's per-module configuration", body = CourseCreditRegistrationModuleConfigs)
    )
)]
pub async fn get_course_credit_registration_module_configs(
    user: AuthUser,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<CourseCreditRegistrationModuleConfigs>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewInternalCourseStructure,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let modules =
        models::course_modules::get_credit_registration_configs_by_course_id(&mut conn, *course_id)
            .await?;
    let realisations =
        models::course_module_suotar_realisations::get_by_course_id(&mut conn, *course_id).await?;

    token.authorized_ok(web::Json(CourseCreditRegistrationModuleConfigs {
        modules,
        realisations,
    }))
}

/**
GET `/api/v0/main-frontend/course-credit-registrations/courses/{course_id}/summary` - Per-module
counts plus the two reasons a student of this course will not get credits.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/courses/{course_id}/summary",
    operation_id = "getCourseCreditRegistrationSummary",
    tag = "course-credit-registrations",
    params(("course_id" = Uuid, Path, description = "Course id")),
    responses(
        (status = 200, description = "The course's credit registration summary", body = CourseCreditRegistrationSummary)
    )
)]
pub async fn get_course_credit_registration_summary(
    user: AuthUser,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<CourseCreditRegistrationSummary>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewAndManageCreditRegistrations,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let configs =
        models::course_modules::get_credit_registration_configs_by_course_id(&mut conn, *course_id)
            .await?;
    let module_names: HashMap<Uuid, Option<String>> =
        models::course_modules::get_by_course_id(&mut conn, *course_id)
            .await?
            .into_iter()
            .map(|module| (module.id, module.name))
            .collect();
    let counts =
        models::credit_registrations::count_by_module_and_state_for_course(&mut conn, *course_id)
            .await?;
    let mut attention: HashMap<Uuid, i64> = HashMap::new();
    for (module_id, _, _, needs_admin_attention_count) in &counts {
        *attention.entry(*module_id).or_insert(0) += needs_admin_attention_count;
    }

    let modules = configs
        .into_iter()
        .map(|config| {
            let counts_by_state: Vec<CreditRegistrationStateCount> = counts
                .iter()
                .filter(|(module_id, _, _, _)| *module_id == config.course_module_id)
                .map(|(_, state, count, _)| CreditRegistrationStateCount {
                    state: *state,
                    count: *count,
                })
                .collect();
            CourseCreditRegistrationModuleSummary {
                course_module_id: config.course_module_id,
                course_module_name: module_names
                    .get(&config.course_module_id)
                    .cloned()
                    .unwrap_or_default(),
                enabled: config.enable_credit_registration_via_suotar,
                paused: config.credit_registration_paused_at.is_some(),
                success_count: counts_by_state
                    .iter()
                    .filter(|row| row.state.is_success())
                    .map(|row| row.count)
                    .sum(),
                failed_permanent_count: counts_by_state
                    .iter()
                    .filter(|row| row.state == CreditRegistrationState::FailedPermanent)
                    .map(|row| row.count)
                    .sum(),
                needs_admin_attention_count: attention
                    .get(&config.course_module_id)
                    .copied()
                    .unwrap_or(0),
                counts_by_state,
            }
        })
        .collect();

    let blocked = models::course_credit_registration_consents::count_blocked_students_for_course(
        &mut conn, *course_id,
    )
    .await?;
    let linking_emails_failed_to_send_count =
        count_failed_linking_emails(&mut conn, *course_id).await?;

    token.authorized_ok(web::Json(CourseCreditRegistrationSummary {
        modules,
        blocked_students: blocked,
        linking_emails_failed_to_send_count,
    }))
}

/**
POST `/api/v0/main-frontend/course-credit-registrations/courses/{course_id}/by-user-ids` - The
registrations of the named students, for the students tab's current page.
*/
#[instrument(skip(pool, payload))]
#[utoipa::path(
    post,
    path = "/courses/{course_id}/by-user-ids",
    operation_id = "getCourseCreditRegistrationsForUsers",
    tag = "course-credit-registrations",
    params(("course_id" = Uuid, Path, description = "Course id")),
    request_body = CourseCreditRegistrationUserIdsPayload,
    responses(
        (status = 200, description = "The named students' registrations", body = Vec<CourseCreditRegistration>)
    )
)]
pub async fn get_course_credit_registrations_for_users(
    user: AuthUser,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    payload: web::Json<CourseCreditRegistrationUserIdsPayload>,
) -> ControllerResult<web::Json<Vec<CourseCreditRegistration>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewAndManageCreditRegistrations,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    if payload.user_ids.len() > MAX_USER_IDS_PER_REQUEST {
        return Err(controller_err!(
            BadRequest,
            format!("Name at most {MAX_USER_IDS_PER_REQUEST} students per request.")
        ));
    }
    let rows = models::credit_registrations::get_teacher_facing_by_course_id(
        &mut conn,
        *course_id,
        &TeacherCreditRegistrationFilters {
            user_ids: Some(&payload.user_ids),
            course_instance_id: payload.course_instance_id,
            ..TeacherCreditRegistrationFilters::default()
        },
        // Every attempt of every named student, not a page: the tab renders one cell per student and
        // a student's superseded attempts belong in it. Bounded by the cap above rather than by a
        // page size, which is why the sibling endpoints' `Pagination` does not apply.
        MAX_REGISTRATION_ROWS_PER_USER * MAX_USER_IDS_PER_REQUEST as i64,
        0,
    )
    .await?;
    let res = build_teacher_registrations(&mut conn, *course_id, rows).await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/course-credit-registrations/courses/{course_id}/list` - A page of the
course's registrations, filtered by state and searched by student name, email or student number.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/courses/{course_id}/list",
    operation_id = "getCourseCreditRegistrations",
    tag = "course-credit-registrations",
    params(
        ("course_id" = Uuid, Path, description = "Course id"),
        ("page" = Option<u32>, Query, description = "Page number, from 1"),
        ("limit" = Option<u32>, Query, description = "Rows per page"),
        ("search" = Option<String>, Query, description = "Student name, email or student number"),
        ("state" = Option<CreditRegistrationState>, Query, description = "Ledger state filter"),
        ("course_instance_id" = Option<Uuid>, Query, description = "Course instance filter")
    ),
    responses(
        (status = 200, description = "A page of the course's registrations", body = CourseCreditRegistrationsPage)
    )
)]
pub async fn get_course_credit_registrations(
    user: AuthUser,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    query: web::Query<GetCourseCreditRegistrationsQuery>,
) -> ControllerResult<web::Json<CourseCreditRegistrationsPage>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewAndManageCreditRegistrations,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let pagination = Pagination::new(query.page.unwrap_or(1), query.limit.unwrap_or(100))
        .map_err(|e| controller_err!(BadRequest, e.to_string()))?;
    let search = query
        .search
        .as_deref()
        .map(str::trim)
        .filter(|search| !search.is_empty());
    let filters = TeacherCreditRegistrationFilters {
        state: query.state,
        search,
        course_instance_id: query.course_instance_id,
        ..TeacherCreditRegistrationFilters::default()
    };
    let total = models::credit_registrations::count_teacher_facing_by_course_id(
        &mut conn, *course_id, &filters,
    )
    .await?;
    let rows = models::credit_registrations::get_teacher_facing_by_course_id(
        &mut conn,
        *course_id,
        &filters,
        pagination.limit(),
        pagination.offset(),
    )
    .await?;
    let data = build_teacher_registrations(&mut conn, *course_id, rows).await?;

    token.authorized_ok(web::Json(CourseCreditRegistrationsPage {
        data,
        total_pages: pagination.total_pages(u32::try_from(total).unwrap_or(u32::MAX)),
    }))
}

/**
GET `/api/v0/main-frontend/course-credit-registrations/registrations/{credit_registration_id}` - One
registration with its timeline and the other attempts for the same completion.

Authorized on the row's own course: a course id from the caller would let a teacher of one course pair
it with a foreign registration id.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/registrations/{credit_registration_id}",
    operation_id = "getCreditRegistrationDetails",
    tag = "course-credit-registrations",
    params(("credit_registration_id" = Uuid, Path, description = "Credit registration id")),
    responses(
        (status = 200, description = "The registration with its timeline", body = CreditRegistrationDetails),
        (status = 404, description = "No such registration")
    )
)]
pub async fn get_credit_registration_details(
    user: AuthUser,
    pool: web::Data<PgPool>,
    credit_registration_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<CreditRegistrationDetails>> {
    let mut conn = pool.acquire().await?;
    let row =
        models::credit_registrations::get_teacher_facing_by_id(&mut conn, *credit_registration_id)
            .await?
            .ok_or_else(|| controller_err!(NotFound, "Not found.".to_string()))?;
    let token = authorize(
        &mut conn,
        Act::ViewAndManageCreditRegistrations,
        Some(user.id),
        Res::Course(row.course_id),
    )
    .await?;

    let course = models::courses::get_course(&mut conn, row.course_id).await?;
    let registration_id = row.id;
    let attempt_rows =
        models::credit_registrations::get_teacher_facing_attempts_for_completion(&mut conn, &row)
            .await?;
    // `attempt_rows` already contains `row`, so it is picked out of `attempts` rather than fetched
    // a second time.
    let attempts = build_teacher_registrations(&mut conn, row.course_id, attempt_rows).await?;
    let registration = attempts
        .iter()
        .find(|attempt| attempt.id == registration_id)
        .cloned()
        .ok_or_else(|| controller_err!(NotFound, "Not found.".to_string()))?;
    let events = models::credit_registration_events::get_by_registration_id(
        &mut conn,
        *credit_registration_id,
    )
    .await?
    .into_iter()
    .map(|event| CourseCreditRegistrationEvent {
        id: event.id,
        created_at: event.created_at,
        kind: event.kind,
        from_state: event.from_state,
        to_state: event.to_state,
        error_code: event.error_code,
        message: event.message,
        actor_user_id: event.actor_user_id,
    })
    .collect();

    let not_improved_attainment = models::credit_registration_events::get_not_improved_attainment(
        &mut conn,
        *credit_registration_id,
    )
    .await?;

    token.authorized_ok(web::Json(CreditRegistrationDetails {
        course_id: course.id,
        course_name: course.name,
        registration,
        attempts,
        events,
        not_improved_attainment,
    }))
}

/**
POST
`/api/v0/main-frontend/course-credit-registrations/courses/{course_id}/resend-linking-email` - Sets off
another account-linking mail for one person on this course.

The target has to be on this course's roster in the study registry and hold no link with us. The caps
of the ordinary claim path apply and nothing here relaxes them.
*/
#[instrument(skip(pool, payload, app_conf, suotar_client))]
#[utoipa::path(
    post,
    path = "/courses/{course_id}/resend-linking-email",
    operation_id = "resendCourseCreditRegistrationLinkingEmail",
    tag = "course-credit-registrations",
    params(("course_id" = Uuid, Path, description = "Course id")),
    request_body = ResendLinkingEmailPayload,
    responses(
        (status = 200, description = "What the attempt did", body = ResendLinkingEmailResult),
        (status = 400, description = "Nothing named, or this teacher has set off too many mails this hour")
    )
)]
pub async fn resend_course_credit_registration_linking_email(
    user: AuthUser,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    payload: web::Json<ResendLinkingEmailPayload>,
    app_conf: web::Data<ApplicationConfiguration>,
    suotar_client: web::Data<SuotarClient>,
) -> ControllerResult<web::Json<ResendLinkingEmailResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewAndManageCreditRegistrations,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let enabled_module_ids =
        models::course_modules::get_credit_registration_enabled_ids_for_course(
            &mut conn, *course_id,
        )
        .await?;
    if enabled_module_ids.is_empty() {
        return Err(controller_err!(
            BadRequest,
            "This course has no credit registration module configured.".to_string()
        ));
    }

    let recent = models::credit_registration_admin_actions::count_by_actor_since(
        &mut conn,
        user.id,
        CreditRegistrationAdminAction::ResendLinkEmail,
        Utc::now() - chrono::Duration::hours(1),
    )
    .await?;
    if recent >= MAX_TEACHER_RESENDS_PER_HOUR {
        return Err(controller_err!(
            BadRequest,
            "You have set off too many linking emails in the last hour.".to_string()
        ));
    }

    let student_number = resolve_resend_target(&mut conn, *course_id, &payload).await?;
    let Some(student_number) = student_number else {
        return finish_resend(
            &mut conn,
            &user,
            *course_id,
            &payload,
            None,
            ResendLinkingEmailOutcome::NoStudentNumberKnown,
            token,
        )
        .await;
    };

    let ctx = PhaseContext {
        pool: &pool,
        suotar_client: &suotar_client,
        test_mode: app_conf.test_mode,
        caller: RESEND_CALLER,
        base_url: &app_conf.base_url,
        suotar_conf: &app_conf.suotar_configuration,
    };
    // Released first: the call below takes connections of its own and can hold the request for the
    // whole Suotar timeout, so keeping this one would tie up three of the pool per resend.
    drop(conn);
    let attempt = resend_linking_mail_for_target(
        &ctx,
        *course_id,
        &student_number,
        Box::pin(async { Ok(0) }),
    )
    .await?;
    let mut conn = pool.acquire().await?;
    let outcome = match attempt.decision {
        ResendDecision::AlreadyLinked => ResendLinkingEmailOutcome::AlreadyLinked,
        ResendDecision::Attempted(LinkingMailResendOutcome::Claimed) => {
            ResendLinkingEmailOutcome::Queued
        }
        ResendDecision::Attempted(LinkingMailResendOutcome::AlreadyMailedToEveryKnownAddress) => {
            ResendLinkingEmailOutcome::AlreadyMailedToEveryKnownAddress
        }
        ResendDecision::Attempted(LinkingMailResendOutcome::RefusedByRateCap) => {
            ResendLinkingEmailOutcome::RefusedByRateCap
        }
        ResendDecision::Attempted(LinkingMailResendOutcome::NoAddressInStudyRegistry) => {
            ResendLinkingEmailOutcome::NoAddressInStudyRegistry
        }
        ResendDecision::Attempted(LinkingMailResendOutcome::NotOnTheCourseRoster) => {
            ResendLinkingEmailOutcome::NotOnTheCourseRoster
        }
        ResendDecision::Attempted(LinkingMailResendOutcome::StudyRegistryUnavailable) => {
            ResendLinkingEmailOutcome::StudyRegistryUnavailable
        }
    };

    finish_resend(
        &mut conn,
        &user,
        *course_id,
        &payload,
        Some(&student_number),
        outcome,
        token,
    )
    .await
}

/// The person the body names, as a student number. `None` when the account has never held one.
///
/// A `user_id` is only answered for an account with a registration on `course_id`. The caller is
/// authorized on the course and the study registry roster is only consulted later, so without this one
/// course's teacher could hand in any account's uuid and read off, from which outcome came back,
/// whether that account holds a verified student number.
async fn resolve_resend_target(
    conn: &mut PgConnection,
    course_id: Uuid,
    payload: &ResendLinkingEmailPayload,
) -> Result<Option<String>, ControllerError> {
    if let Some(student_number) = payload
        .student_number
        .as_deref()
        .map(str::trim)
        .filter(|number| !number.is_empty())
    {
        return Ok(Some(student_number.to_string()));
    }
    let Some(user_id) = payload.user_id else {
        return Err(controller_err!(
            BadRequest,
            "Name either a user or a student number.".to_string()
        ));
    };
    if !models::credit_registrations::exists_for_user_and_course(conn, user_id, course_id).await? {
        // Deliberately the same answer for an account that does not exist: the two must not be
        // distinguishable.
        return Err(controller_err!(
            BadRequest,
            "That account has no credit registration on this course.".to_string()
        ));
    }
    Ok(
        verified_student_numbers::get_latest_including_deleted_by_user_id(conn, user_id)
            .await?
            .map(|link| link.student_number),
    )
}

/// Audits the attempt whatever it did, and reports where the person's linking mail now stands.
async fn finish_resend(
    conn: &mut PgConnection,
    user: &AuthUser,
    course_id: Uuid,
    payload: &ResendLinkingEmailPayload,
    student_number: Option<&str>,
    outcome: ResendLinkingEmailOutcome,
    token: crate::domain::authorization::AuthorizationToken,
) -> ControllerResult<web::Json<ResendLinkingEmailResult>> {
    let (mails, mails_sent_for_this_course) = record_resend_and_fetch_mails(
        conn,
        course_id,
        student_number,
        user.id,
        COURSE_TEACHER_ROLE,
        Some(course_id),
        payload.reason.clone(),
        serde_json::json!({
            "outcome": outcome,
            "student_number": student_number,
        }),
    )
    .await?;
    let linking_email = match mails.first() {
        Some(mail) => latest_linking_email_status(conn, mail).await?,
        None => None,
    };

    token.authorized_ok(web::Json(ResendLinkingEmailResult {
        outcome,
        linking_email,
        mails_sent_for_this_course,
        max_mails_per_person_and_course: MAX_LINKING_MAILS_PER_PERSON_AND_COURSE,
    }))
}

/// Records a `ResendLinkEmail` action against the course and fetches this student's linking mails
/// for it. Shared by the teacher and admin resend endpoints, which differ only in who they blame it
/// on, whether they widen the action to the whole course (`actor_course_id`), and what extra detail
/// goes into `details`.
#[allow(clippy::too_many_arguments)]
pub(crate) async fn record_resend_and_fetch_mails(
    conn: &mut PgConnection,
    course_id: Uuid,
    student_number: Option<&str>,
    actor_user_id: Uuid,
    actor_role: &str,
    actor_course_id: Option<Uuid>,
    reason: Option<String>,
    details: serde_json::Value,
) -> Result<(Vec<CreditRegistrationAccountLinkingEmail>, i64), ControllerError> {
    models::credit_registration_admin_actions::record(
        conn,
        &NewCreditRegistrationAdminAction {
            target_id: Some(course_id),
            actor_course_id,
            reason,
            details: Some(details),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::ResendLinkEmail,
                CreditRegistrationAdminActionTarget::Course,
                actor_user_id,
                actor_role,
            )
        },
    )
    .await?;

    let mails = match student_number {
        Some(number) => {
            credit_registration_account_linking_emails::get_by_course_id_and_student_number(
                conn, course_id, number,
            )
            .await?
        }
        None => Vec::new(),
    };
    let mails_sent_for_this_course = mails.len() as i64;
    Ok((mails, mails_sent_for_this_course))
}

async fn latest_linking_email_status(
    conn: &mut PgConnection,
    mail: &CreditRegistrationAccountLinkingEmail,
) -> Result<Option<TeacherLinkingEmailStatus>, ControllerError> {
    let reports =
        credit_registration_account_linking_emails::get_send_status_reports(conn, &[mail.id])
            .await?;
    Ok(reports
        .get(&mail.id)
        .map(|report| linking_email_status_of(report, mail)))
}

fn linking_email_status_of(
    report: &EmailSendStatusReport,
    mail: &CreditRegistrationAccountLinkingEmail,
) -> TeacherLinkingEmailStatus {
    TeacherLinkingEmailStatus {
        email_send_status: report.email_send_status,
        sent_at: report.sent_at,
        last_attempt_at: report.last_attempt_at,
        retry_count: report.retry_count,
        next_retry_at: report.next_retry_at,
        emailed_to_masked: mask_email(&mail.emailed_to),
    }
}

/// The newest linking mail's send status for each row waiting for a number, by row id. A fixed number
/// of queries whatever the page holds, because only the listed people are looked up.
async fn linking_email_statuses(
    conn: &mut PgConnection,
    course_id: Uuid,
    waiting: &[&TeacherCreditRegistration],
) -> Result<HashMap<Uuid, TeacherLinkingEmailStatus>, ControllerError> {
    if waiting.is_empty() {
        return Ok(HashMap::new());
    }
    let need_lookup: Vec<Uuid> = waiting
        .iter()
        .filter(|row| row.sisu_person_id.is_none())
        .map(|row| row.user_id)
        .collect();
    let latest_links: HashMap<Uuid, String> = if need_lookup.is_empty() {
        HashMap::new()
    } else {
        verified_student_numbers::get_latest_including_deleted_by_user_ids(conn, &need_lookup)
            .await?
            .into_iter()
            .map(|link| (link.user_id, link.sisu_person_id))
            .collect()
    };
    let per_row: Vec<(Uuid, String)> = waiting
        .iter()
        .filter_map(|row| {
            let person_id = row
                .sisu_person_id
                .clone()
                .or_else(|| latest_links.get(&row.user_id).cloned())?;
            Some((row.id, person_id))
        })
        .collect();
    if per_row.is_empty() {
        return Ok(HashMap::new());
    }
    let person_ids: Vec<String> = per_row
        .iter()
        .map(|(_, person_id)| person_id.clone())
        .collect();
    let mails = credit_registration_account_linking_emails::get_latest_by_course_and_persons(
        conn,
        course_id,
        &person_ids,
    )
    .await?;
    let matched: Vec<(Uuid, &CreditRegistrationAccountLinkingEmail)> = per_row
        .iter()
        .filter_map(|(row_id, person_id)| Some((*row_id, mails.get(person_id)?)))
        .collect();
    if matched.is_empty() {
        return Ok(HashMap::new());
    }
    let mail_ids: Vec<Uuid> = matched.iter().map(|(_, mail)| mail.id).collect();
    let reports =
        credit_registration_account_linking_emails::get_send_status_reports(conn, &mail_ids)
            .await?;
    Ok(matched
        .into_iter()
        .filter_map(|(row_id, mail)| {
            let report = reports.get(&mail.id)?;
            Some((row_id, linking_email_status_of(report, mail)))
        })
        .collect())
}

/// Enriches the ledger rows with the linking-mail status. A row only gets one when the account holds —
/// or once held — a link, because the mail is addressed to a Sisu person.
///
/// Shared with the csv export so the file and the table cannot disagree about a row's status or
/// about how much of an address is shown.
pub(crate) async fn build_teacher_registrations(
    conn: &mut PgConnection,
    course_id: Uuid,
    rows: Vec<TeacherCreditRegistration>,
) -> Result<Vec<CourseCreditRegistration>, ControllerError> {
    let waiting: Vec<&TeacherCreditRegistration> = rows
        .iter()
        .filter(|row| row.state == CreditRegistrationState::PendingStudentNumber)
        .collect();
    let mut statuses = linking_email_statuses(conn, course_id, &waiting).await?;
    let ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
    let notification_mails = student_notifications::get_for_registrations(conn, &ids).await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let linking_email = statuses.remove(&row.id);
            let base = CourseCreditRegistration::from(row);
            let notification_email = NotificationEmailStatus::for_status(
                base.student_facing_status,
                base.id,
                &notification_mails,
            );
            CourseCreditRegistration {
                linking_email,
                notification_email,
                ..base
            }
        })
        .collect())
}

impl From<TeacherCreditRegistration> for CourseCreditRegistration {
    fn from(row: TeacherCreditRegistration) -> Self {
        Self {
            student_facing_status: StudentFacingCreditRegistrationStatus::of(row.state),
            superseded: row.superseded_by_id.is_some(),
            linking_email: None,
            notification_email: None,
            id: row.id,
            user_id: row.user_id,
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email,
            course_id: row.course_id,
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
            registered_at: row.registered_at,
            sisu_attainment_id: row.sisu_attainment_id,
            grade_id: row.grade_id,
            credits: row.credits,
            attempt_number: row.attempt_number,
            student_number: row.student_number,
            student_number_verified_at: row.student_number_verified_at,
            student_number_verified_via: row.student_number_verified_via,
            enrolment_realisation_name: row.enrolment_realisation_name,
        }
    }
}

/// Linking mails of this course we could not hand over at all.
async fn count_failed_linking_emails(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> Result<i64, ControllerError> {
    Ok(
        credit_registration_account_linking_emails::count_send_failed_for_course(
            conn,
            course_id,
            Utc::now(),
        )
        .await?,
    )
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/courses/{course_id}/module-configs",
        web::get().to(get_course_credit_registration_module_configs),
    )
    .route(
        "/courses/{course_id}/summary",
        web::get().to(get_course_credit_registration_summary),
    )
    .route(
        "/courses/{course_id}/by-user-ids",
        web::post().to(get_course_credit_registrations_for_users),
    )
    .route(
        "/courses/{course_id}/list",
        web::get().to(get_course_credit_registrations),
    )
    .route(
        "/courses/{course_id}/resend-linking-email",
        web::post().to(resend_course_credit_registration_linking_email),
    )
    .route(
        "/registrations/{credit_registration_id}",
        web::get().to(get_credit_registration_details),
    );
    retry::_add_routes(cfg);
    actions::_add_routes(cfg);
    export::_add_routes(cfg);
}
