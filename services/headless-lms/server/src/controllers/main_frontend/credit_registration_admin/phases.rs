//! The Workers tab: one row per pipeline phase, with the queue each is responsible for.
//!
//! Phases, not pods. Pausing `import` while `verify` keeps running is a real incident move that no
//! pod-level control can express, and the pause here is our own flag — the k8s status page still
//! answers whether the process hosting a phase is up.

use std::collections::HashMap;

use headless_lms_models::credit_registration_phase_state::{
    self, CreditRegistrationPhaseState as PhaseStateRow,
};
use headless_lms_models::credit_registrations::{self, CreditRegistrationState};
use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use headless_lms_models::suotar_circuit_breakers::{self, BreakerTarget, SuotarCircuitBreaker};
use itertools::Itertools;
use utoipa::ToSchema;

use crate::domain::credit_registration::health::{
    PHASE_CONSECUTIVE_FAILURE_LIMIT, PHASE_HEARTBEAT_INTERVAL_MULTIPLIER, is_heartbeat_late,
};
use crate::prelude::*;
use headless_lms_credit_registration::CreditRegistrationPhase;
use headless_lms_credit_registration::breaker::is_waiting_to_probe;

use super::authorize_credit_registration_admin;

/// One phase as the Workers tab renders it.
///
/// Wider than `CreditRegistrationPhaseStatus`, which the pause/resume/run-now responses return: this
/// one also carries the last error, the run window and the queue.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationPhaseRow {
    pub phase: String,
    /// The worker process whose loop runs the phase. Rows are grouped by it, because a dead pod
    /// makes every phase inside it go stale at once and that reads as one fault, not seven.
    pub process_name: String,
    pub expected_interval_secs: i32,
    pub last_heartbeat_at: Option<DateTime<Utc>>,
    pub last_run_started_at: Option<DateTime<Utc>>,
    pub last_run_finished_at: Option<DateTime<Utc>>,
    pub last_success_at: Option<DateTime<Utc>>,
    pub next_run_at: Option<DateTime<Utc>>,
    pub items_processed_last_run: Option<i32>,
    pub items_failed_last_run: Option<i32>,
    pub consecutive_failures: i32,
    /// Our own wording or the study registry's code, never its prose.
    pub last_error: Option<String>,
    pub paused_at: Option<DateTime<Utc>>,
    pub paused_by_user_id: Option<Uuid>,
    pub pause_reason: Option<String>,
    /// No implementation is registered for the phase yet, so it has never reported and will not.
    pub implemented: bool,
    /// Computed server-side: a page comparing its own clock against a server timestamp misjudges
    /// this on a skewed client.
    pub seconds_since_heartbeat: Option<i64>,
    pub last_run_duration_secs: Option<i64>,
    /// Always `false` while paused or never heartbeated.
    pub heartbeat_late: bool,
    pub failing: bool,
    /// The ledger states nothing but this phase moves a row out of. Empty for the phases whose work
    /// is not a ledger state: `materialize` waits on completions, the syncer's phases on modules.
    pub owned_states: Vec<CreditRegistrationState>,
    /// Live rows in `owned_states` waiting on this phase, of `no_usable_enrolment` only those due a
    /// check, or `None` where there are none to own — which is not the same as an empty queue.
    pub queue_depth: Option<i64>,
}

/// Where one circuit breaker stands, as its worker last reported it.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CircuitBreakerStatus {
    Closed,
    /// In its cooldown: the phases it pauses skip their iterations.
    Open,
    /// Past its cooldown, and the next iteration sends a single-item probe that closes it only if
    /// it succeeds.
    WaitingToProbe,
}

/// One worker process's circuit breaker, as the worker last reported it.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationCircuitBreakerState {
    pub process_name: String,
    pub target: BreakerTarget,
    /// The endpoints whose phases the breaker pauses.
    pub endpoints: Vec<SuotarEndpoint>,
    pub status: CircuitBreakerStatus,
    pub consecutive_failures: i64,
    /// How much of the cooldown is left. Computed server-side, like `seconds_since_heartbeat`.
    pub open_for_secs: Option<i64>,
    pub trip_count: i64,
    /// When the worker last reported the state.
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationPhaseList {
    /// In process then pipeline order, so the grouping is a fold over the list.
    pub phases: Vec<CreditRegistrationPhaseRow>,
    pub heartbeat_interval_multiplier: i32,
    pub consecutive_failure_limit: i32,
    /// Every phase is stopped, which is what the kill switch does.
    pub paused_globally: bool,
    pub circuit_breakers: Vec<CreditRegistrationCircuitBreakerState>,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/phases` - Every pipeline phase, its heartbeat
and the queue it is responsible for, and the workers' circuit breakers.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/phases",
    operation_id = "listCreditRegistrationPhases",
    tag = "credit-registration-admin",
    responses(
        (status = 200, description = "One row per pipeline phase, and the workers' circuit breakers", body = CreditRegistrationPhaseList)
    )
)]
pub async fn list_credit_registration_phases(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<CreditRegistrationPhaseList>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let depths: HashMap<CreditRegistrationState, i64> =
        credit_registrations::count_by_state(&mut conn)
            .await?
            .into_iter()
            .collect();
    let due_enrolment_checks = credit_registrations::count_due_enrolment_checks(&mut conn).await?;
    let now = Utc::now();
    let mut phases: Vec<CreditRegistrationPhaseRow> =
        credit_registration_phase_state::get_all(&mut conn)
            .await?
            .into_iter()
            .map(|row| to_phase_row(row, now, &depths, due_enrolment_checks))
            .collect();
    phases.sort_by_key(|row| {
        (
            row.process_name.clone(),
            CreditRegistrationPhase::from_phase_name(&row.phase)
                .and_then(|phase| {
                    CreditRegistrationPhase::ALL
                        .iter()
                        .position(|p| *p == phase)
                })
                .unwrap_or(usize::MAX),
        )
    });
    let circuit_breakers = suotar_circuit_breakers::get_all(&mut conn)
        .await?
        .into_iter()
        .map(|breaker| to_circuit_breaker_state(breaker, now))
        .collect();

    token.authorized_ok(web::Json(CreditRegistrationPhaseList {
        paused_globally: !phases.is_empty() && phases.iter().all(|row| row.paused_at.is_some()),
        phases,
        heartbeat_interval_multiplier: PHASE_HEARTBEAT_INTERVAL_MULTIPLIER,
        consecutive_failure_limit: PHASE_CONSECUTIVE_FAILURE_LIMIT,
        circuit_breakers,
    }))
}

fn to_phase_row(
    row: PhaseStateRow,
    now: DateTime<Utc>,
    depths: &HashMap<CreditRegistrationState, i64>,
    due_enrolment_checks: i64,
) -> CreditRegistrationPhaseRow {
    let known = CreditRegistrationPhase::from_phase_name(&row.phase);
    let owned_states: Vec<CreditRegistrationState> = known
        .map(|phase| phase.owned_states().to_vec())
        .unwrap_or_default();
    let seconds_since_heartbeat = row.last_heartbeat_at.map(|at| (now - at).num_seconds());
    let heartbeat_late = is_heartbeat_late(
        row.last_heartbeat_at,
        row.expected_interval_secs,
        row.paused_at,
        now,
    );
    CreditRegistrationPhaseRow {
        implemented: known.is_some(),
        queue_depth: known.filter(|_| !owned_states.is_empty()).map(|phase| {
            phase.queue_depth(
                |state| depths.get(&state).copied().unwrap_or(0),
                due_enrolment_checks,
            )
        }),
        owned_states,
        seconds_since_heartbeat,
        heartbeat_late,
        failing: row.paused_at.is_none()
            && row.consecutive_failures >= PHASE_CONSECUTIVE_FAILURE_LIMIT,
        last_run_duration_secs: row
            .last_run_started_at
            .zip(row.last_run_finished_at)
            .map(|(started, finished)| (finished - started).num_seconds()),
        phase: row.phase,
        process_name: row.process_name,
        expected_interval_secs: row.expected_interval_secs,
        last_heartbeat_at: row.last_heartbeat_at,
        last_run_started_at: row.last_run_started_at,
        last_run_finished_at: row.last_run_finished_at,
        last_success_at: row.last_success_at,
        next_run_at: row.next_run_at,
        items_processed_last_run: row.items_processed_last_run,
        items_failed_last_run: row.items_failed_last_run,
        consecutive_failures: row.consecutive_failures,
        last_error: row.last_error,
        paused_at: row.paused_at,
        paused_by_user_id: row.paused_by_user_id,
        pause_reason: row.pause_reason,
    }
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/phases", web::get().to(list_credit_registration_phases));
}

fn to_circuit_breaker_state(
    breaker: SuotarCircuitBreaker,
    now: DateTime<Utc>,
) -> CreditRegistrationCircuitBreakerState {
    let open_for_secs = breaker
        .open_until
        .map(|until| (until - now).num_seconds())
        .filter(|&secs| secs > 0);
    let consecutive_failures = u32::try_from(breaker.consecutive_failures).unwrap_or_default();
    let status = if breaker.open_until.is_some_and(|until| now < until) {
        CircuitBreakerStatus::Open
    } else if is_waiting_to_probe(consecutive_failures, breaker.open_until, now) {
        CircuitBreakerStatus::WaitingToProbe
    } else {
        CircuitBreakerStatus::Closed
    };
    let endpoints = CreditRegistrationPhase::ALL
        .into_iter()
        .map(CreditRegistrationPhase::spec)
        .filter(|spec| {
            spec.process.as_str() == breaker.process_name && spec.breakers.contains(&breaker.target)
        })
        .flat_map(|spec| spec.endpoints.iter().copied())
        .unique()
        .collect();
    CreditRegistrationCircuitBreakerState {
        process_name: breaker.process_name,
        target: breaker.target,
        endpoints,
        status,
        consecutive_failures: i64::from(breaker.consecutive_failures),
        open_for_secs,
        trip_count: i64::from(breaker.trip_count),
        updated_at: breaker.updated_at,
    }
}
