//! The Pipeline tab's history: queue depth per state per day, and the flow through each.
//!
//! Reads the daily snapshots the `ledger-snapshot` phase writes. The ledger holds current state
//! only, so a row that passed through a state in an hour leaves no depth trace there — history
//! cannot be reconstructed from it, which is why the snapshots exist.

use chrono::{Duration, NaiveDate};
use headless_lms_models::credit_registration_daily_snapshots;
use headless_lms_models::credit_registrations::CreditRegistrationState;
use utoipa::ToSchema;

use crate::prelude::*;

use super::authorize_credit_registration_admin;

const DEFAULT_DAYS: i64 = 30;
const MAX_DAYS: i64 = 365;

/// One state's depth and flow on one day.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationHistoryPoint {
    pub state: CreditRegistrationState,
    /// Rows in the state when the snapshot was taken, once that day.
    pub count: i32,
    /// Transitions into and out of the state during that UTC day. A self-transition is neither.
    pub entered_count: i32,
    pub left_count: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationHistoryDay {
    /// The UTC day the snapshot describes.
    pub snapshot_date: NaiveDate,
    /// Every state, whether or not anything is in it: a missing state would read as a gap in the
    /// chart rather than as an empty queue.
    pub states: Vec<CreditRegistrationHistoryPoint>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationHistory {
    /// Oldest first. Days with no snapshot are absent rather than zeroed: before the phase first
    /// ran, and on a day it did not, there is no depth to report.
    pub days: Vec<CreditRegistrationHistoryDay>,
    pub from: NaiveDate,
    pub to: NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    days: Option<i64>,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/pipeline-history` - Daily queue depth per
ledger state, with what entered and left each state that day.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/pipeline-history",
    operation_id = "getCreditRegistrationPipelineHistory",
    tag = "credit-registration-admin",
    params(("days" = Option<i64>, Query, description = "How many days back to read, today included")),
    responses(
        (status = 200, description = "One entry per day that has a snapshot", body = CreditRegistrationHistory)
    )
)]
pub async fn get_credit_registration_pipeline_history(
    user: AuthUser,
    pool: web::Data<PgPool>,
    query: web::Query<HistoryQuery>,
) -> ControllerResult<web::Json<CreditRegistrationHistory>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let days = query.days.unwrap_or(DEFAULT_DAYS).clamp(1, MAX_DAYS);
    let to = Utc::now().date_naive();
    let from = to - Duration::days(days - 1);

    let mut history: Vec<CreditRegistrationHistoryDay> = Vec::new();
    for row in credit_registration_daily_snapshots::get_between(&mut conn, from, to).await? {
        // The model orders by date then state, so a day's rows arrive together.
        if history
            .last()
            .is_none_or(|day| day.snapshot_date != row.snapshot_date)
        {
            history.push(CreditRegistrationHistoryDay {
                snapshot_date: row.snapshot_date,
                states: Vec::new(),
            });
        }
        if let Some(day) = history.last_mut() {
            day.states.push(CreditRegistrationHistoryPoint {
                state: row.state,
                count: row.count,
                entered_count: row.entered_count,
                left_count: row.left_count,
            });
        }
    }

    token.authorized_ok(web::Json(CreditRegistrationHistory {
        days: history,
        from,
        to,
    }))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/pipeline-history",
        web::get().to(get_credit_registration_pipeline_history),
    );
}
