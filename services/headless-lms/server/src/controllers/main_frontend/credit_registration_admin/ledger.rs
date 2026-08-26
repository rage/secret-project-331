//! Viewing and hand-transitioning rows of the credit registration ledger.

use headless_lms_models::course_credit_registration_consents;
use headless_lms_models::credit_registration_account_linking_emails;
use headless_lms_models::credit_registration_admin_actions::{
    CreditRegistrationAdminAction, CreditRegistrationAdminActionFilters,
    CreditRegistrationAdminActionRecord, CreditRegistrationAdminActionTarget, GLOBAL_ADMIN_ROLE,
    NewCreditRegistrationAdminAction,
};
use headless_lms_models::credit_registration_events::{
    CreditRegistrationEventKind, NotImprovedAttainment,
};
use headless_lms_models::credit_registrations::{
    self, AdminCreditRegistration, AdminCreditRegistrationFilters, AdminCreditRegistrationSort,
    CreditRegistrationErrorCode, CreditRegistrationState, ResubmissionRefusal,
    ResubmissionStrictness, Transition,
};
use headless_lms_models::email_deliveries::EmailSendStatusReport;
use headless_lms_models::library::credit_registration::student_notifications::{
    self, CreditRegistrationNotificationKind, RegistrationNotificationEmail,
};
use headless_lms_models::suotar_api_calls;
use headless_lms_models::verified_student_numbers::{self, StudentNumberVerificationMethod};
use std::collections::{HashMap, HashSet};
use utoipa::ToSchema;

use crate::prelude::*;

use super::{
    AdminLinkingEmail, authorize_credit_registration_admin, build_linking_emails, one_or_many,
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

/// One of the two student terminal-state mails, in full: `send_status.failure_code` is what drives
/// the decision to look at the relay.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminNotificationEmail {
    pub kind: CreditRegistrationNotificationKind,
    /// The delivery this registration is pinned to, so support can find the message in the queue and
    /// tell "still the first mail" from "a second one went out".
    pub email_delivery_id: Uuid,
    pub send_status: EmailSendStatusReport,
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
    /// The terminal-state mails queued for this row, with the same send status the student and the
    /// teacher are shown.
    pub notification_emails: Vec<AdminNotificationEmail>,
    /// The grade the registry already held, for a row it declined as no improvement. The row's own
    /// grade is what we sent.
    pub not_improved_attainment: Option<NotImprovedAttainment>,
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

/// A fat-finger bound on one selection; a bigger one is taken in several passes.
const MAX_ROWS_PER_BULK_TRANSITION: i64 = 500;
const MAX_ROWS_PER_REQUEUE: i64 = 5_000;
/// A detail view's related-rows lookups (other attempts, calls, actions) never paginate; this just
/// bounds them against a pathological completion.
const MAX_RELATED_ROWS: i64 = u8::MAX as i64;

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminBulkTransitionPayload {
    pub to_state: AdminCreditRegistrationTransitionTarget,
    pub credit_registration_ids: Vec<Uuid>,
    pub reason: String,
}

/// Why a selected row was left alone.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AdminBulkTransitionSkip {
    /// A later attempt replaced it; act on that one.
    Superseded,
    /// The submission may have landed. Resubmitting one of these is a single-row decision, made
    /// after a human has looked the attainment up.
    SubmissionUncertain,
    WithoutConsent,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct AdminBulkTransitionSkipCount {
    pub reason: AdminBulkTransitionSkip,
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
    #[serde(default, deserialize_with = "one_or_many")]
    state: Option<Vec<CreditRegistrationState>>,
    #[serde(default, deserialize_with = "one_or_many")]
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
        (status = 200, description = "A page of the ledger", body = Page<AdminCreditRegistrationRow>)
    )
)]
pub async fn list_credit_registrations_for_admin(
    user: AuthUser,
    pool: web::Data<PgPool>,
    query: web::Query<ListCreditRegistrationsQuery>,
) -> ControllerResult<web::Json<Page<AdminCreditRegistrationRow>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let pagination = parse_pagination(query.page, query.limit, 50)?;
    let search = non_empty(query.search.as_deref());
    let student_number = non_empty(query.student_number.as_deref());
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
        credit_registration_ids: None,
        include_superseded: query.include_superseded.unwrap_or(false),
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
    let data = rows.into_iter().map(to_admin_row).collect();

    token.authorized_ok(web::Json(Page::new(pagination, data, total_count)))
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
        MAX_RELATED_ROWS,
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

    let notification_emails = student_notifications::get_for_registrations(&mut conn, &[id])
        .await?
        .into_iter()
        .map(
            |mail: RegistrationNotificationEmail| AdminNotificationEmail {
                kind: mail.kind,
                email_delivery_id: mail.email_delivery_id,
                send_status: mail.send_status,
            },
        )
        .collect();

    let not_improved_attainment =
        models::credit_registration_events::get_not_improved_attainment(&mut conn, id).await?;

    token.authorized_ok(web::Json(AdminCreditRegistrationDetails {
        registration: to_admin_row(registration),
        attempts,
        events,
        suotar_api_calls,
        actions,
        linking_emails,
        notification_emails,
        not_improved_attainment,
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
        // `Any`: a human is already looking at this one row, so unlike the bulk transition below it
        // is not refused for being `submission_uncertain`. Superseded was already handled above, so
        // consent is the only refusal `Any` can still produce here.
        if row
            .state
            .resubmission_refusal(false, consented, ResubmissionStrictness::Any)
            .is_some()
        {
            return token.authorized_ok(web::Json(AdminTransitionCreditRegistrationResult {
                outcome: AdminTransitionOutcome::RefusedWithoutConsent,
                state: row.state,
                needs_admin_attention: row.needs_admin_attention,
            }));
        }
    }

    let mut tx = conn.begin().await?;
    let (outcome, after_state, needs_admin_attention, needs_due_now) =
        apply_transition(&mut tx, &row, payload.to_state, user.id, reason).await?;
    if needs_due_now {
        credit_registrations::make_due_now_batch(&mut tx, &[id]).await?;
    }
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

/**
POST `/api/v0/main-frontend/credit-registration-admin/registrations/bulk-transition` - Moves a
selection of rows by hand, one transaction for the lot.

Resubmitting refuses every row in `submission_uncertain`, whatever the selection said. Taking one of
those back to `ready_to_submit` is a decision about one student's transcript, made after somebody has
looked the attainment up; a checkbox in a list is not that, and a mis-click here would put a second
attainment on every one of them. Those rows are reported back untouched, to be dealt with one at a
time.
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
    let consenting: HashSet<(Uuid, Uuid)> =
        if payload.to_state == AdminCreditRegistrationTransitionTarget::ReadyToSubmit {
            course_credit_registration_consents::get_consenting_user_and_course_ids(
                &mut tx,
                &rows.iter().map(|row| row.user_id).collect::<Vec<_>>(),
            )
            .await?
            .into_iter()
            .collect()
        } else {
            HashSet::new()
        };

    let mut applied_count = 0;
    let mut due_now_ids = Vec::new();
    let mut skipped: HashMap<AdminBulkTransitionSkip, i64> = HashMap::new();
    for row in &rows {
        let refusal = if row.superseded_by_id.is_some() {
            Some(AdminBulkTransitionSkip::Superseded)
        } else if payload.to_state != AdminCreditRegistrationTransitionTarget::ReadyToSubmit {
            None
        } else {
            row.state
                .resubmission_refusal(
                    false,
                    consenting.contains(&(row.user_id, row.course_id)),
                    ResubmissionStrictness::AnyExceptSubmissionUncertain,
                )
                .map(|refusal| match refusal {
                    ResubmissionRefusal::Superseded => AdminBulkTransitionSkip::Superseded,
                    ResubmissionRefusal::SubmissionUncertain => {
                        AdminBulkTransitionSkip::SubmissionUncertain
                    }
                    ResubmissionRefusal::WithoutConsent => AdminBulkTransitionSkip::WithoutConsent,
                    ResubmissionRefusal::ConsentWithdrawn
                    | ResubmissionRefusal::NotFailedPermanent => {
                        unreachable!("AnyExceptSubmissionUncertain never returns {refusal:?}")
                    }
                })
        };
        match refusal {
            Some(skip) => *skipped.entry(skip).or_insert(0) += 1,
            None => {
                let (_, _, _, needs_due_now) =
                    apply_transition(&mut tx, row, payload.to_state, user.id, reason).await?;
                if needs_due_now {
                    due_now_ids.push(row.id);
                }
                applied_count += 1;
            }
        }
    }
    // Batched rather than one `UPDATE` per row inside the loop above: the row transition needs its
    // own audit event per row, but making it due now does not.
    credit_registrations::make_due_now_batch(&mut tx, &due_now_ids).await?;
    let mut skipped: Vec<AdminBulkTransitionSkipCount> = skipped
        .into_iter()
        .map(|(reason, count)| AdminBulkTransitionSkipCount { reason, count })
        .collect();
    skipped.sort_by_key(|skip| std::cmp::Reverse(skip.count));

    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            reason: Some(reason.to_string()),
            details: Some(serde_json::json!({
                "to_state": payload.to_state,
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

/// Applies one hand transition in the caller's transaction, returning what it did, where the row
/// ended up, whether it still asks for a human, and whether the caller must still make it due now.
///
/// The caller has already decided the transition is allowed: consent and the
/// `submission_uncertain` guard are checked before this, because the answer to a refusal differs
/// per caller. Making the row due is left to the caller too, rather than done here, so the bulk
/// caller can batch it over every row it applies instead of one `UPDATE` per row.
async fn apply_transition(
    tx: &mut PgConnection,
    row: &credit_registrations::CreditRegistration,
    target: AdminCreditRegistrationTransitionTarget,
    actor_user_id: Uuid,
    reason: &str,
) -> Result<(AdminTransitionOutcome, CreditRegistrationState, bool, bool), ControllerError> {
    let id = row.id;
    Ok(match target {
        AdminCreditRegistrationTransitionTarget::ClearNeedsAdminAttention => {
            if !row.needs_admin_attention {
                (AdminTransitionOutcome::NoChange, row.state, false, false)
            } else {
                credit_registrations::set_needs_admin_attention(tx, id, false).await?;
                insert_admin_action_event(tx, id, actor_user_id, reason).await?;
                (AdminTransitionOutcome::Applied, row.state, false, false)
            }
        }
        AdminCreditRegistrationTransitionTarget::CheckNow => {
            insert_admin_action_event(tx, id, actor_user_id, reason).await?;
            (
                AdminTransitionOutcome::Applied,
                row.state,
                row.needs_admin_attention,
                true,
            )
        }
        target => {
            let to_state = match target {
                AdminCreditRegistrationTransitionTarget::ReadyToSubmit => {
                    CreditRegistrationState::ReadyToSubmit
                }
                AdminCreditRegistrationTransitionTarget::Cancelled => {
                    CreditRegistrationState::Cancelled
                }
                AdminCreditRegistrationTransitionTarget::ClearNeedsAdminAttention
                | AdminCreditRegistrationTransitionTarget::CheckNow => {
                    unreachable!("handled above")
                }
            };
            let after = credit_registrations::transition(
                tx,
                id,
                &Transition {
                    needs_admin_attention: Some(false),
                    event_kind: CreditRegistrationEventKind::AdminAction,
                    event_message: Some(reason.to_string()),
                    actor_user_id: Some(actor_user_id),
                    // Refuses to overwrite a row the pipeline (or another admin) has moved on since
                    // `row` was read. The bulk caller reads its rows locked, so only the single-row
                    // path can actually trip this.
                    expected_from_state: Some(row.state),
                    ..Transition::to(to_state)
                },
            )
            .await?;
            // Nothing else brings the row forward, so without a due-now the resubmit would sit out
            // the backoff whatever failed last set.
            (
                AdminTransitionOutcome::Applied,
                after.state,
                after.needs_admin_attention,
                !after.state.is_terminal(),
            )
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
            search_id: Some(id),
            include_superseded: true,
            ..AdminCreditRegistrationFilters::default()
        },
        AdminCreditRegistrationSort::default(),
        MAX_RELATED_ROWS,
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
