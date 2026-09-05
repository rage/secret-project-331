//! The Errors & stuck tab: what is going wrong by error code, and which rows want a human.

use headless_lms_models::credit_registration_events::{self, ErrorCodeWindowCounts};
use headless_lms_models::credit_registrations::{
    self, AttentionReason, AttentionRegistration, AttentionSort, CreditRegistrationErrorCode,
    CreditRegistrationState,
};
use headless_lms_models::library::credit_registration::classification::{
    Retryability, retryability,
};
use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use utoipa::ToSchema;

use crate::domain::credit_registration::health::{
    CreditRegistrationAlertThresholds, stuck_thresholds, thresholds,
};
use crate::prelude::*;

use super::{ATTENTION_TOO_MANY_ATTEMPTS, authorize_credit_registration_admin};

/// Rows per page of the attention queue when the caller names no limit.
const ATTENTION_PAGE_SIZE: u32 = 50;
const DEFAULT_ERROR_WINDOW_SECS: i64 = 24 * 60 * 60;
const MAX_ERROR_WINDOW_SECS: i64 = 90 * 24 * 60 * 60;

/// Why a row is on the attention table. One row can carry several.
///
/// `needs_admin_attention` is deliberately not one of them: the flag is what the pipeline caches
/// when it wants a human, not an answer to "why". It travels on the item instead.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CreditRegistrationAttentionReason {
    /// Past its state's threshold with the pipeline still owning it.
    StuckInState,
    PermanentError,
    RetryWindowExpired,
    Misregistered,
    TooManyAttempts,
    /// `submission_uncertain`: never retried automatically, and never in bulk.
    OutcomeUncertain,
}

impl CreditRegistrationAttentionReason {
    fn of(reason: AttentionReason) -> Self {
        match reason {
            AttentionReason::StuckInState => Self::StuckInState,
            AttentionReason::PermanentError => Self::PermanentError,
            AttentionReason::RetryWindowExpired => Self::RetryWindowExpired,
            AttentionReason::Misregistered => Self::Misregistered,
            AttentionReason::TooManyAttempts => Self::TooManyAttempts,
            AttentionReason::OutcomeUncertain => Self::OutcomeUncertain,
        }
    }

    fn to_model(self) -> AttentionReason {
        match self {
            Self::StuckInState => AttentionReason::StuckInState,
            Self::PermanentError => AttentionReason::PermanentError,
            Self::RetryWindowExpired => AttentionReason::RetryWindowExpired,
            Self::Misregistered => AttentionReason::Misregistered,
            Self::TooManyAttempts => AttentionReason::TooManyAttempts,
            Self::OutcomeUncertain => AttentionReason::OutcomeUncertain,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAttentionItem {
    pub credit_registration_id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    /// In full: this is the list support works from.
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub attempt_count: i32,
    pub next_attempt_at: DateTime<Utc>,
    pub student_number: Option<String>,
    /// Every detector that picked this row, so the table can group by any of them. Empty on a row
    /// the pipeline flagged that no detector explains.
    pub reasons: Vec<CreditRegistrationAttentionReason>,
    /// The pipeline's cached "a human should look at this". A fact about the row, never a reason:
    /// see [`CreditRegistrationAttentionReason`].
    pub needs_admin_attention: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAttentionReasonCount {
    pub reason: CreditRegistrationAttentionReason,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAttentionItems {
    /// The requested page of the queue.
    pub items: Vec<CreditRegistrationAttentionItem>,
    /// The whole queue, whatever this request filtered to: the canonical "needs a human" count, the
    /// same number `/overview` reports and the tab badge shows.
    pub total_count: i64,
    /// Rows matching this request's narrowing, which is what `total_pages` pages through. Equal to
    /// `total_count` when neither `reason` nor `without_reason` was given.
    pub filtered_count: i64,
    pub total_pages: u32,
    /// Over the whole queue, not over the page or the filter, so the counts stay usable as facets.
    pub counts_by_reason: Vec<CreditRegistrationAttentionReasonCount>,
    /// Queue rows no detector picked, which the pipeline's flag alone put there. No `reason`
    /// reaches them, so a surface that groups by reason has to offer `without_reason` beside the
    /// reasons or leave this many rows unreachable.
    pub flagged_without_reason_count: i64,
}

/// One error code over the chosen window and the one before it.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationErrorCodeWindow {
    pub error_code: CreditRegistrationErrorCode,
    /// What may be done about the code, which is the difference between a wait and a fix.
    pub retryability: Retryability,
    pub current_count: i64,
    pub previous_count: i64,
    pub user_count: i64,
    pub course_count: i64,
    pub first_seen_at: Option<DateTime<Utc>>,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub endpoints: Vec<SuotarEndpoint>,
}

/// The verdicts an operator needs beside the errors to rule them out. `not_improved` is not a
/// failure and is never in the error table above.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationTerminalVerdicts {
    pub registered_count: i64,
    pub duplicate_and_not_improved_count: i64,
    pub failed_permanent_count: i64,
    pub cancelled_count: i64,
    /// The denominator of the success rate.
    pub total_count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationErrorsByCode {
    pub window_secs: i64,
    pub codes: Vec<CreditRegistrationErrorCodeWindow>,
    pub verdicts: CreditRegistrationTerminalVerdicts,
}

#[derive(Debug, Deserialize)]
pub struct ErrorWindowQuery {
    window_secs: Option<i64>,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/thresholds` - Every number the alert rules and
the stuck detectors use.

The same values `/overview` embeds in its health block. Separate so a tab explaining "stuck after
2 hours" can say so without reading the whole overview aggregate.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/thresholds",
    operation_id = "getCreditRegistrationThresholds",
    tag = "credit-registration-admin",
    responses(
        (status = 200, description = "The thresholds every rule and detector shares", body = CreditRegistrationAlertThresholds)
    )
)]
pub async fn get_credit_registration_thresholds(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<CreditRegistrationAlertThresholds>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;
    token.authorized_ok(web::Json(thresholds()))
}

#[derive(Debug, Deserialize)]
pub struct AttentionQuery {
    page: Option<u32>,
    limit: Option<u32>,
    reason: Option<Vec<CreditRegistrationAttentionReason>>,
    /// Narrows to the rows `flagged_without_reason_count` counts. Given together with `reason` it
    /// selects nothing: no row both carries a reason and lacks one.
    without_reason: Option<bool>,
    sort: Option<String>,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/attention` - A page of the rows at least one
detector wants a human to look at, with the detectors that picked each.

Superseded attempts are outside every detector: acting on a replaced attempt is never right.
`total_count` is the queue's length under the one definition of "needs a human"; `/overview`'s
`needs_admin_attention_count` is the same number.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/attention",
    operation_id = "getCreditRegistrationAttentionItems",
    tag = "credit-registration-admin",
    params(
        ("page" = Option<u32>, Query, description = "Page number, from 1"),
        ("limit" = Option<u32>, Query, description = "Rows per page"),
        ("reason" = Option<Vec<CreditRegistrationAttentionReason>>, Query, description = "Only rows one of these detectors picked; repeat the parameter for several"),
        ("without_reason" = Option<bool>, Query, description = "Only rows no detector picked, which the pipeline's flag alone put in the queue; selects nothing alongside reason"),
        ("sort" = Option<String>, Query, description = "time_in_state, next_attempt or course")
    ),
    responses(
        (status = 200, description = "A page of the rows needing a human, and how many for each reason", body = CreditRegistrationAttentionItems)
    )
)]
pub async fn get_credit_registration_attention_items(
    user: AuthUser,
    pool: web::Data<PgPool>,
    query: MultiQuery<AttentionQuery>,
) -> ControllerResult<web::Json<CreditRegistrationAttentionItems>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let pagination = parse_pagination(query.page, query.limit, ATTENTION_PAGE_SIZE)?;
    let reasons: Vec<AttentionReason> = query
        .reason
        .as_deref()
        .unwrap_or_default()
        .iter()
        .map(|reason| reason.to_model())
        .collect();
    let only_without_reason = query.without_reason.unwrap_or(false);
    let sort = match query.sort.as_deref() {
        Some("next_attempt") => AttentionSort::NextAttempt,
        Some("course") => AttentionSort::Course,
        _ => AttentionSort::TimeInState,
    };
    let thresholds = stuck_thresholds();

    let rows = credit_registrations::get_attention_items(
        &mut conn,
        &thresholds,
        ATTENTION_TOO_MANY_ATTEMPTS,
        credit_registrations::AttentionSelection {
            reasons: &reasons,
            only_without_reason,
            sort,
            limit: pagination.limit(),
            offset: pagination.offset(),
        },
    )
    .await?;
    let filtered_count = rows.first().map_or(0, |row| row.total_count);
    // An unfiltered page already carries the whole queue's totals; only a narrowed or empty one
    // needs them asked for separately.
    let queue = match rows.first() {
        Some(row) if reasons.is_empty() && !only_without_reason => Some(row.clone()),
        _ => {
            credit_registrations::count_needing_attention(
                &mut conn,
                &thresholds,
                ATTENTION_TOO_MANY_ATTEMPTS,
            )
            .await?
        }
    };
    let counts_by_reason = queue
        .as_ref()
        .map(AttentionRegistration::counts_by_reason)
        .unwrap_or_default()
        .into_iter()
        .filter(|(_, count)| *count > 0)
        .map(|(reason, count)| CreditRegistrationAttentionReasonCount {
            reason: CreditRegistrationAttentionReason::of(reason),
            count,
        })
        .collect();

    token.authorized_ok(web::Json(CreditRegistrationAttentionItems {
        items: rows.into_iter().map(to_attention_item).collect(),
        total_count: queue.as_ref().map_or(0, |row| row.total_count),
        filtered_count,
        total_pages: pagination.total_pages(u32::try_from(filtered_count).unwrap_or(u32::MAX)),
        counts_by_reason,
        flagged_without_reason_count: queue
            .as_ref()
            .map_or(0, |row| row.flagged_without_reason_count),
    }))
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/errors/by-code` - Error events per code over a
window and the window before it, with the terminal verdicts of the same window beside them.

Counts events, not rows: an error that happened really happened, whether or not a later attempt
succeeded, and hiding it would hide the configuration bug that caused it.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/errors/by-code",
    operation_id = "getCreditRegistrationErrorsByCode",
    tag = "credit-registration-admin",
    params(("window_secs" = Option<i64>, Query, description = "Window length in seconds; the same length before it is the comparison")),
    responses(
        (status = 200, description = "Per-code counts and the window's verdicts", body = CreditRegistrationErrorsByCode)
    )
)]
pub async fn get_credit_registration_errors_by_code(
    user: AuthUser,
    pool: web::Data<PgPool>,
    query: web::Query<ErrorWindowQuery>,
) -> ControllerResult<web::Json<CreditRegistrationErrorsByCode>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let window_secs = query
        .window_secs
        .unwrap_or(DEFAULT_ERROR_WINDOW_SECS)
        .clamp(60, MAX_ERROR_WINDOW_SECS);
    let codes =
        credit_registration_events::get_error_code_counts_for_window(&mut conn, window_secs)
            .await?
            .into_iter()
            .map(to_error_code_window)
            .collect();
    let totals = credit_registrations::count_terminal_outcomes_since(
        &mut conn,
        Utc::now() - chrono::Duration::seconds(window_secs),
    )
    .await?;

    token.authorized_ok(web::Json(CreditRegistrationErrorsByCode {
        window_secs,
        codes,
        verdicts: CreditRegistrationTerminalVerdicts {
            registered_count: totals.registered_count,
            duplicate_and_not_improved_count: totals.success_count - totals.registered_count,
            failed_permanent_count: totals.failed_permanent_count,
            cancelled_count: totals.cancelled_count,
            total_count: totals.total_count,
        },
    }))
}

fn to_attention_item(row: AttentionRegistration) -> CreditRegistrationAttentionItem {
    CreditRegistrationAttentionItem {
        reasons: row
            .reasons()
            .into_iter()
            .map(CreditRegistrationAttentionReason::of)
            .collect(),
        credit_registration_id: row.id,
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        course_id: row.course_id,
        course_name: row.course_name,
        course_module_id: row.course_module_id,
        course_module_name: row.course_module_name,
        state: row.state,
        state_entered_at: row.state_entered_at,
        error_code: row.error_code,
        attempt_count: row.attempt_count,
        next_attempt_at: row.next_attempt_at,
        student_number: row.student_number,
        needs_admin_attention: row.needs_admin_attention,
    }
}

fn to_error_code_window(row: ErrorCodeWindowCounts) -> CreditRegistrationErrorCodeWindow {
    CreditRegistrationErrorCodeWindow {
        retryability: retryability(row.error_code),
        error_code: row.error_code,
        current_count: row.current_count,
        previous_count: row.previous_count,
        user_count: row.user_count,
        course_count: row.course_count,
        first_seen_at: row.first_seen_at,
        last_seen_at: row.last_seen_at,
        endpoints: row.endpoints,
    }
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/thresholds",
        web::get().to(get_credit_registration_thresholds),
    )
    .route(
        "/attention",
        web::get().to(get_credit_registration_attention_items),
    )
    .route(
        "/errors/by-code",
        web::get().to(get_credit_registration_errors_by_code),
    );
}
