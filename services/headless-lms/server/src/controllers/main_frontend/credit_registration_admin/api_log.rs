//! The Suotar API log tab: one row per HTTP call to the study registry, and what each covered.
//!
//! The stored bodies are scrubbed at write time — names, student numbers and email addresses read
//! `[redacted]` while their keys survive — and are returned exactly as stored. What makes the log
//! navigable is not the body but `credit_registration_ids`: every call resolves to the ledger rows
//! it carried, and those hold the real values.

use headless_lms_models::credit_registration_events::CreditRegistrationEventKind;
use headless_lms_models::credit_registrations::{
    self, AdminCreditRegistrationFilters, AdminCreditRegistrationSort, CreditRegistrationErrorCode,
    CreditRegistrationState,
};
use headless_lms_models::suotar_api_calls::{
    self, SuotarApiCall, SuotarApiCallFilters, SuotarApiCallPageRow, SuotarEndpoint,
};
use utoipa::ToSchema;

use crate::prelude::*;

use super::authorize_credit_registration_admin;

/// How many ledger rows one call may resolve. A batch is capped well below this by the endpoint's
/// own batch size.
const MAX_REFERENCED_ROWS: i64 = 500;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct SuotarApiCallRow {
    pub id: Uuid,
    pub endpoint: SuotarEndpoint,
    pub started_at: DateTime<Utc>,
    pub duration_ms: Option<i32>,
    /// `None` with `succeeded = false` means the request never got an answer: connect, TLS or
    /// timeout.
    pub http_status: Option<i32>,
    pub succeeded: bool,
    pub request_item_count: i32,
    pub ok_item_count: i32,
    pub error_item_count: i32,
    /// The registry's own request-level code, an identifier rather than prose.
    pub request_level_error_code: Option<String>,
    pub worker_name: String,
    pub credit_registration_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct SuotarApiCallsPage {
    #[serde(flatten)]
    pub page: Page<SuotarApiCallRow>,
    /// The `worker_name` values in the log, for the filter.
    pub worker_names: Vec<String>,
}

/// One ledger row a call carried, resolved from `credit_registration_ids`. This is what stands in
/// for the redacted body: the identifiers are here, beside the item they belong to.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct SuotarApiCallLedgerReference {
    pub credit_registration_id: Uuid,
    /// The id the registry saw for this row, so a line of the stored body maps to a student.
    pub request_item_id: String,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub student_number: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub state: CreditRegistrationState,
    pub error_code: Option<CreditRegistrationErrorCode>,
}

/// A timeline entry written against this call, one per item the answer moved.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct SuotarApiCallEvent {
    pub id: Uuid,
    pub credit_registration_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub kind: CreditRegistrationEventKind,
    pub from_state: Option<CreditRegistrationState>,
    pub to_state: Option<CreditRegistrationState>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    /// The `{request, response}` pair for this one item, scrubbed at write time.
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct SuotarApiCallDetails {
    pub call: SuotarApiCallRow,
    /// Scrubbed and truncated when it was written; never un-scrubbed for display.
    pub request_body_sample: Option<serde_json::Value>,
    pub response_body_sample: Option<serde_json::Value>,
    /// Our own wording; the registry's error prose is stored for nobody.
    pub error_message: Option<String>,
    pub ledger_references: Vec<SuotarApiCallLedgerReference>,
    pub events: Vec<SuotarApiCallEvent>,
}

#[derive(Debug, Deserialize)]
pub struct ListSuotarApiCallsQuery {
    page: Option<u32>,
    limit: Option<u32>,
    endpoint: Option<SuotarEndpoint>,
    succeeded: Option<bool>,
    worker_name: Option<String>,
    started_after: Option<DateTime<Utc>>,
    started_before: Option<DateTime<Utc>>,
    credit_registration_id: Option<Uuid>,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/suotar-api-calls` - A page of the study
registry call log, newest first.

Filtering by `credit_registration_id` is how "find the call that carried this student" is answered:
the bodies are scrubbed, so there is no student number in them to search.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/suotar-api-calls",
    operation_id = "listSuotarApiCalls",
    tag = "credit-registration-admin",
    params(
        ("page" = Option<u32>, Query, description = "Page number, from 1"),
        ("limit" = Option<u32>, Query, description = "Rows per page"),
        ("endpoint" = Option<SuotarEndpoint>, Query, description = "One study registry endpoint"),
        ("succeeded" = Option<bool>, Query, description = "Only calls that did, or did not, succeed"),
        ("worker_name" = Option<String>, Query, description = "The phase or manual action that made the call"),
        ("started_after" = Option<DateTime<Utc>>, Query, description = "Started at or after"),
        ("started_before" = Option<DateTime<Utc>>, Query, description = "Started at or before"),
        ("credit_registration_id" = Option<Uuid>, Query, description = "Only calls that carried this ledger row")
    ),
    responses(
        (status = 200, description = "A page of the call log", body = SuotarApiCallsPage)
    )
)]
pub async fn list_suotar_api_calls(
    user: AuthUser,
    pool: web::Data<PgPool>,
    query: web::Query<ListSuotarApiCallsQuery>,
) -> ControllerResult<web::Json<SuotarApiCallsPage>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let pagination = parse_pagination(query.page, query.limit, 50)?;
    let filters = SuotarApiCallFilters {
        endpoint: query.endpoint,
        succeeded: query.succeeded,
        worker_name: non_empty(query.worker_name.as_deref()).map(str::to_string),
        started_after: query.started_after,
        started_before: query.started_before,
        credit_registration_id: query.credit_registration_id,
    };
    let rows =
        suotar_api_calls::get_page(&mut conn, &filters, pagination.limit(), pagination.offset())
            .await?;
    let total_count = rows.first().map_or(0, |row| row.total_count);
    let worker_names = suotar_api_calls::get_worker_names(&mut conn).await?;

    token.authorized_ok(web::Json(SuotarApiCallsPage {
        page: Page::new(
            pagination,
            rows.into_iter().map(to_call_row).collect(),
            total_count,
        ),
        worker_names,
    }))
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/suotar-api-calls/{suotar_api_call_id}` - One
call with its stored bodies, the ledger rows it covered and the timeline entries it produced.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/suotar-api-calls/{suotar_api_call_id}",
    operation_id = "getSuotarApiCall",
    tag = "credit-registration-admin",
    params(("suotar_api_call_id" = Uuid, Path, description = "Study registry call id")),
    responses(
        (status = 200, description = "The call and everything it touched", body = SuotarApiCallDetails),
        (status = 404, description = "No such call")
    )
)]
pub async fn get_suotar_api_call(
    user: AuthUser,
    pool: web::Data<PgPool>,
    suotar_api_call_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<SuotarApiCallDetails>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let call = suotar_api_calls::get_by_id(&mut conn, *suotar_api_call_id).await?;
    let ledger_references =
        resolve_ledger_references(&mut conn, &call.credit_registration_ids).await?;
    let events = models::credit_registration_events::get_by_suotar_api_call_id(
        &mut conn,
        *suotar_api_call_id,
    )
    .await?
    .into_iter()
    .map(|event| SuotarApiCallEvent {
        id: event.id,
        credit_registration_id: event.credit_registration_id,
        created_at: event.created_at,
        kind: event.kind,
        from_state: event.from_state,
        to_state: event.to_state,
        error_code: event.error_code,
        details: event.details,
    })
    .collect();

    token.authorized_ok(web::Json(SuotarApiCallDetails {
        request_body_sample: call.request_body_sample.clone(),
        response_body_sample: call.response_body_sample.clone(),
        error_message: call.error_message.clone(),
        call: to_call_row_from_full(&call),
        ledger_references,
        events,
    }))
}

/// The ledger rows a call named, in the order the call listed them, so the reference table lines up
/// with the stored body's items.
async fn resolve_ledger_references(
    conn: &mut PgConnection,
    credit_registration_ids: &[Uuid],
) -> Result<Vec<SuotarApiCallLedgerReference>, ControllerError> {
    if credit_registration_ids.is_empty() {
        return Ok(Vec::new());
    }
    let rows = credit_registrations::get_admin_facing(
        conn,
        &AdminCreditRegistrationFilters {
            credit_registration_ids: Some(credit_registration_ids),
            include_superseded: true,
            ..AdminCreditRegistrationFilters::default()
        },
        AdminCreditRegistrationSort::default(),
        MAX_REFERENCED_ROWS,
        0,
    )
    .await?;
    let mut by_id: std::collections::HashMap<Uuid, _> =
        rows.into_iter().map(|row| (row.id, row)).collect();
    Ok(credit_registration_ids
        .iter()
        .filter_map(|id| by_id.remove(id))
        .map(|row| SuotarApiCallLedgerReference {
            credit_registration_id: row.id,
            request_item_id: row.request_item_id,
            user_id: row.user_id,
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email,
            student_number: row.student_number,
            course_id: row.course_id,
            course_name: row.course_name,
            state: row.state,
            error_code: row.error_code,
        })
        .collect())
}

fn to_call_row(call: SuotarApiCallPageRow) -> SuotarApiCallRow {
    SuotarApiCallRow {
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
        credit_registration_ids: call.credit_registration_ids,
    }
}

/// The same summary, from the detail endpoint's full row rather than the bodyless listing one.
fn to_call_row_from_full(call: &SuotarApiCall) -> SuotarApiCallRow {
    SuotarApiCallRow {
        id: call.id,
        endpoint: call.endpoint,
        started_at: call.started_at,
        duration_ms: call.duration_ms,
        http_status: call.http_status,
        succeeded: call.succeeded,
        request_item_count: call.request_item_count,
        ok_item_count: call.ok_item_count,
        error_item_count: call.error_item_count,
        request_level_error_code: call.request_level_error_code.clone(),
        worker_name: call.worker_name.clone(),
        credit_registration_ids: call.credit_registration_ids.clone(),
    }
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/suotar-api-calls", web::get().to(list_suotar_api_calls))
        .route(
            "/suotar-api-calls/{suotar_api_call_id}",
            web::get().to(get_suotar_api_call),
        );
}
