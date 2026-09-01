//! The Errors & stuck tab: what is going wrong by error code, and which rows want a human.

use headless_lms_models::credit_registration_events::{self, ErrorCodeWindowCounts};
use headless_lms_models::credit_registrations::{
    self, AttentionRegistration, CreditRegistrationErrorCode, CreditRegistrationState,
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

use super::authorize_credit_registration_admin;

/// The `chatbot_syncer` precedent, and the point past which retrying is not the answer.
const TOO_MANY_ATTEMPTS: i32 = 5;
/// Bounds the attention table. A dashboard that renders ten thousand rows helps nobody, and the
/// per-reason counts beside it say how much is left.
const ATTENTION_LIMIT: i64 = 500;
const DEFAULT_ERROR_WINDOW_SECS: i64 = 24 * 60 * 60;
const MAX_ERROR_WINDOW_SECS: i64 = 90 * 24 * 60 * 60;

/// Why a row is on the attention table. One row can carry several.
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
    /// The pipeline itself asked for a human, e.g. because the completion drifted under the row.
    FlaggedByPipeline,
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
    /// Every detector that picked this row, so the table can group by any of them.
    pub reasons: Vec<CreditRegistrationAttentionReason>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAttentionReasonCount {
    pub reason: CreditRegistrationAttentionReason,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAttentionItems {
    pub items: Vec<CreditRegistrationAttentionItem>,
    /// Rows returned, which is the tab badge. Capped at `max_items`; the counts per reason are over
    /// the same capped set.
    pub total_count: i64,
    pub counts_by_reason: Vec<CreditRegistrationAttentionReasonCount>,
    pub max_items: i64,
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

/**
GET `/api/v0/main-frontend/credit-registration-admin/attention` - The rows at least one detector
wants a human to look at, with the detectors that picked each.

Superseded attempts are outside every detector: acting on a replaced attempt is never right.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/attention",
    operation_id = "getCreditRegistrationAttentionItems",
    tag = "credit-registration-admin",
    responses(
        (status = 200, description = "Rows needing a human, and how many for each reason", body = CreditRegistrationAttentionItems)
    )
)]
pub async fn get_credit_registration_attention_items(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<CreditRegistrationAttentionItems>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let items: Vec<CreditRegistrationAttentionItem> = credit_registrations::get_attention_items(
        &mut conn,
        &stuck_thresholds(),
        TOO_MANY_ATTEMPTS,
        ATTENTION_LIMIT,
    )
    .await?
    .into_iter()
    .map(to_attention_item)
    .collect();

    let counts_by_reason = ALL_ATTENTION_REASONS
        .into_iter()
        .map(|reason| CreditRegistrationAttentionReasonCount {
            reason,
            count: items
                .iter()
                .filter(|item| item.reasons.contains(&reason))
                .count() as i64,
        })
        .filter(|row| row.count > 0)
        .collect();

    token.authorized_ok(web::Json(CreditRegistrationAttentionItems {
        total_count: items.len() as i64,
        items,
        counts_by_reason,
        max_items: ATTENTION_LIMIT,
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

const ALL_ATTENTION_REASONS: [CreditRegistrationAttentionReason; 7] = [
    CreditRegistrationAttentionReason::StuckInState,
    CreditRegistrationAttentionReason::PermanentError,
    CreditRegistrationAttentionReason::RetryWindowExpired,
    CreditRegistrationAttentionReason::Misregistered,
    CreditRegistrationAttentionReason::TooManyAttempts,
    CreditRegistrationAttentionReason::OutcomeUncertain,
    CreditRegistrationAttentionReason::FlaggedByPipeline,
];

fn to_attention_item(row: AttentionRegistration) -> CreditRegistrationAttentionItem {
    let flags = [
        (
            row.stuck_in_state,
            CreditRegistrationAttentionReason::StuckInState,
        ),
        (
            row.permanent_error,
            CreditRegistrationAttentionReason::PermanentError,
        ),
        (
            row.retry_window_expired,
            CreditRegistrationAttentionReason::RetryWindowExpired,
        ),
        (
            row.misregistered,
            CreditRegistrationAttentionReason::Misregistered,
        ),
        (
            row.too_many_attempts,
            CreditRegistrationAttentionReason::TooManyAttempts,
        ),
        (
            row.outcome_uncertain,
            CreditRegistrationAttentionReason::OutcomeUncertain,
        ),
        (
            row.flagged_by_pipeline,
            CreditRegistrationAttentionReason::FlaggedByPipeline,
        ),
    ];
    CreditRegistrationAttentionItem {
        reasons: flags
            .into_iter()
            .filter_map(|(fired, reason)| fired.then_some(reason))
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
