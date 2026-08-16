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
use utoipa::ToSchema;

use crate::domain::credit_registration::health::{
    PHASE_CONSECUTIVE_FAILURE_LIMIT, PHASE_HEARTBEAT_INTERVAL_MULTIPLIER,
};
use crate::domain::credit_registration_phases::CreditRegistrationPhase;
use crate::prelude::*;

use super::authorize_credit_registration_admin;

/// One phase as the Workers tab renders it.
///
/// Wider than the Overview strip's `CreditRegistrationPhaseStatus`: this one carries the last error,
/// the run window and the queue, which the Overview deliberately leaves out.
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
    /// Live rows in `owned_states`, or `None` where there are none to own — which is not the same
    /// as an empty queue.
    pub queue_depth: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationPhaseList {
    /// In process then pipeline order, so the grouping is a fold over the list.
    pub phases: Vec<CreditRegistrationPhaseRow>,
    pub heartbeat_interval_multiplier: i32,
    pub consecutive_failure_limit: i32,
    /// Every phase is stopped, which is what the kill switch does.
    pub paused_globally: bool,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/phases` - Every pipeline phase, its heartbeat
and the queue it is responsible for.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/phases",
    operation_id = "listCreditRegistrationPhases",
    tag = "credit-registration-admin",
    responses(
        (status = 200, description = "One row per pipeline phase", body = CreditRegistrationPhaseList)
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
    let now = Utc::now();
    let mut phases: Vec<CreditRegistrationPhaseRow> =
        credit_registration_phase_state::get_all(&mut conn)
            .await?
            .into_iter()
            .map(|row| to_phase_row(row, now, &depths))
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

    token.authorized_ok(web::Json(CreditRegistrationPhaseList {
        paused_globally: !phases.is_empty() && phases.iter().all(|row| row.paused_at.is_some()),
        phases,
        heartbeat_interval_multiplier: PHASE_HEARTBEAT_INTERVAL_MULTIPLIER,
        consecutive_failure_limit: PHASE_CONSECUTIVE_FAILURE_LIMIT,
    }))
}

fn to_phase_row(
    row: PhaseStateRow,
    now: DateTime<Utc>,
    depths: &HashMap<CreditRegistrationState, i64>,
) -> CreditRegistrationPhaseRow {
    let known = CreditRegistrationPhase::from_phase_name(&row.phase);
    let owned_states: Vec<CreditRegistrationState> = known
        .map(|phase| phase.owned_states().to_vec())
        .unwrap_or_default();
    let seconds_since_heartbeat = row.last_heartbeat_at.map(|at| (now - at).num_seconds());
    let heartbeat_late = row.paused_at.is_none()
        && seconds_since_heartbeat.is_some_and(|secs| {
            secs > i64::from(row.expected_interval_secs)
                * i64::from(PHASE_HEARTBEAT_INTERVAL_MULTIPLIER)
        });
    CreditRegistrationPhaseRow {
        implemented: known.is_some_and(CreditRegistrationPhase::is_implemented),
        queue_depth: (!owned_states.is_empty()).then(|| {
            owned_states
                .iter()
                .map(|state| depths.get(state).copied().unwrap_or(0))
                .sum()
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
