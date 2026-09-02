//! The Overview tab, the Suotar health panel and phase pause/resume/run-now controls.

use std::collections::HashMap;

use headless_lms_models::credit_registration_admin_actions::{
    CreditRegistrationAdminAction, CreditRegistrationAdminActionTarget, GLOBAL_ADMIN_ROLE,
    NewCreditRegistrationAdminAction,
};
use headless_lms_models::credit_registration_phase_state;
use headless_lms_models::credit_registrations::{
    self, CreditRegistrationErrorCode, CreditRegistrationErrorCodeCount, CreditRegistrationState,
    OldestNonTerminalRegistration, StuckRegistrationCount,
};
use headless_lms_models::library::credit_registration::PendingReasonCounts;
use headless_lms_models::suotar_api_calls::{
    self, SuotarEndpoint, SuotarEndpointStanding as SuotarEndpointStandingRow,
    SuotarEndpointStatsForWindow,
};
use utoipa::ToSchema;

use crate::domain::credit_registration::health::{
    CreditRegistrationHealth, evaluate, is_heartbeat_late, stuck_thresholds,
};
use crate::domain::credit_registration_phases::CreditRegistrationPhase;
use crate::domain::credit_registration_phases::breaker::{
    MAX_CONSECUTIVE_SUOTAR_FAILURES, ScopeKey, snapshot,
};
use crate::prelude::*;

use super::{authorize_credit_registration_admin, required_reason};

const THROUGHPUT_DAYS: i64 = 30;

const ENDPOINT_STATS_WINDOWS_SECS: [i64; 3] = [60 * 60, 24 * 60 * 60, 7 * 24 * 60 * 60];

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
    /// Computed server-side: a page comparing its own clock against a server timestamp misjudges
    /// this on a skewed client, the same reason `seconds_since_heartbeat` is computed here too.
    pub seconds_in_state: i64,
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
/// narrowed one. Returned by the pause/resume/run-now actions; the Workers tab lists
/// `CreditRegistrationPhaseRow` instead, which is wider.
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
    /// The `pending` depth split by what each row is waiting on, which the ledger does not store.
    pub pending_by_reason: PendingReasonCounts,
    pub error_codes: Vec<CreditRegistrationErrorCodeTotal>,
    pub needs_admin_attention_count: i64,
    pub oldest_non_terminal: Option<CreditRegistrationOldestNonTerminal>,
    pub throughput: Vec<CreditRegistrationThroughputBucket>,
    pub throughput_days: i64,
    pub stuck: Vec<CreditRegistrationStuckTotal>,
    pub endpoints: Vec<SuotarEndpointStanding>,
    pub circuit_breaker: CreditRegistrationCircuitBreakerState,
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

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminPausePhasePayload {
    pub reason: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminPhaseActionPayload {
    pub reason: Option<String>,
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
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let stuck_rows = credit_registrations::count_stuck(&mut conn, &stuck_thresholds()).await?;
    let depths = credit_registrations::count_by_state(&mut conn).await?;
    let health = evaluate(&mut conn, &stuck_rows, &depths).await?;
    let counts_by_state = depths
        .iter()
        .map(|&(state, count)| CreditRegistrationStateTotal { state, count })
        .collect();
    let pending_by_reason = credit_registrations::count_pending_by_reason(&mut conn).await?;
    let error_codes = credit_registrations::count_by_error_code(&mut conn)
        .await?
        .into_iter()
        .map(to_error_code_total)
        .collect();
    let needs_admin_attention_count =
        credit_registrations::count_needing_admin_attention(&mut conn).await?;
    let oldest_non_terminal = credit_registrations::get_oldest_non_terminal(&mut conn)
        .await?
        .map(|row| to_oldest_non_terminal(row, Utc::now()));
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

    token.authorized_ok(web::Json(CreditRegistrationOverview {
        health,
        counts_by_state,
        pending_by_reason,
        error_codes,
        needs_admin_attention_count,
        oldest_non_terminal,
        throughput,
        throughput_days: THROUGHPUT_DAYS,
        stuck,
        endpoints,
        circuit_breaker: circuit_breaker_state(),
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
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

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
        (status = 422, description = "No reason given, or not one of the canonical phase names")
    )
)]
pub async fn admin_pause_phase(
    user: AuthUser,
    pool: web::Data<PgPool>,
    phase: web::Path<String>,
    payload: web::Json<AdminPausePhasePayload>,
) -> ControllerResult<web::Json<CreditRegistrationPhaseStatus>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let phase = require_known_phase(&phase)?;
    let reason = required_reason(&payload.reason)?;

    let mut tx = conn.begin().await?;
    credit_registration_phase_state::pause(&mut tx, phase, user.id, Some(reason)).await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_phase: Some(phase.to_string()),
            reason: Some(reason.to_string()),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::PausePhase,
                CreditRegistrationAdminActionTarget::Phase,
                user.id,
                GLOBAL_ADMIN_ROLE,
            )
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
        (status = 422, description = "Not one of the canonical phase names")
    )
)]
pub async fn admin_resume_phase(
    user: AuthUser,
    pool: web::Data<PgPool>,
    phase: web::Path<String>,
    payload: web::Json<AdminPhaseActionPayload>,
) -> ControllerResult<web::Json<CreditRegistrationPhaseStatus>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let phase = require_known_phase(&phase)?;

    let mut tx = conn.begin().await?;
    credit_registration_phase_state::resume(&mut tx, phase).await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_phase: Some(phase.to_string()),
            reason: payload.reason.clone(),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::ResumePhase,
                CreditRegistrationAdminActionTarget::Phase,
                user.id,
                GLOBAL_ADMIN_ROLE,
            )
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
        (status = 422, description = "Not one of the canonical phase names")
    )
)]
pub async fn admin_run_phase_now(
    user: AuthUser,
    pool: web::Data<PgPool>,
    phase: web::Path<String>,
    payload: web::Json<AdminPhaseActionPayload>,
) -> ControllerResult<web::Json<CreditRegistrationPhaseStatus>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let phase = require_known_phase(&phase)?;

    let mut tx = conn.begin().await?;
    credit_registration_phase_state::run_now(&mut tx, phase).await?;
    models::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_phase: Some(phase.to_string()),
            reason: payload.reason.clone(),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::RunPhaseNow,
                CreditRegistrationAdminActionTarget::Phase,
                user.id,
                GLOBAL_ADMIN_ROLE,
            )
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
    let heartbeat_late = is_heartbeat_late(
        row.last_heartbeat_at,
        row.expected_interval_secs,
        row.paused_at,
        now,
    );
    CreditRegistrationPhaseStatus {
        implemented: CreditRegistrationPhase::from_phase_name(&row.phase).is_some(),
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
    now: DateTime<Utc>,
) -> CreditRegistrationOldestNonTerminal {
    CreditRegistrationOldestNonTerminal {
        credit_registration_id: row.id,
        state: row.state,
        seconds_in_state: (now - row.state_entered_at).num_seconds(),
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

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/overview", web::get().to(get_credit_registration_overview))
        .route("/suotar-health", web::get().to(get_suotar_health))
        .route("/phases/{phase}/pause", web::post().to(admin_pause_phase))
        .route("/phases/{phase}/resume", web::post().to(admin_resume_phase))
        .route(
            "/phases/{phase}/run-now",
            web::post().to(admin_run_phase_now),
        );
}
