//! Viewing and hand-transitioning rows of the credit registration ledger.

use headless_lms_models::course_credit_registration_consents;
use headless_lms_models::credit_registration_account_linking_emails;
use headless_lms_models::credit_registration_admin_actions::{
    CreditRegistrationAdminAction, CreditRegistrationAdminActionRecord,
    CreditRegistrationAdminActionTarget, GLOBAL_ADMIN_ROLE, NewCreditRegistrationAdminAction,
};
use headless_lms_models::credit_registration_events::CreditRegistrationEventKind;
use headless_lms_models::credit_registrations::{
    self, AdminCreditRegistration, AdminCreditRegistrationFilters, AdminCreditRegistrationSort,
    CreditRegistrationErrorCode, CreditRegistrationState, Transition,
};
use headless_lms_models::suotar_api_calls;
use headless_lms_models::verified_student_numbers::{self, StudentNumberVerificationMethod};
use utoipa::ToSchema;

use crate::prelude::*;

use super::{
    AdminLinkingEmail, authorize_credit_registration_admin, build_linking_emails, required_reason,
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
    pub endpoint: suotar_api_calls::SuotarEndpoint,
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
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

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
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

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
                    // `row` was read before this transaction started; refuse to overwrite if the
                    // pipeline (or another admin) has since moved the row on.
                    expected_from_state: Some(row.state),
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
            target_id: Some(id),
            reason: Some(reason.to_string()),
            before_state: Some(row.state),
            after_state: Some(after_state),
            details: Some(serde_json::json!({ "outcome": outcome })),
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
        outcome,
        state: after_state,
        needs_admin_attention,
    }))
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
        "/registrations/{credit_registration_id}/transition",
        web::post().to(admin_transition_credit_registration),
    );
}
