//! The Enrolment checks tab: how the per-student enrolment checks and the roster listings are
//! paced, what they cost Suotar and what they find.
//!
//! Lateness, findings and detection times come from the enrolment check log, the cost from the call
//! log, and the limiter and breaker from the state the worker last reported.

use chrono::Duration;
use headless_lms_models::credit_registration_enrolment_check_outcomes::{
    self, EnrolmentCheckFindings, EnrolmentCheckLateness, EnrolmentCheckPopulation, VERY_LATE_SECS,
};
use headless_lms_models::credit_registration_roster_schedules::{
    self, RosterTier, ScheduleSelection, roster_tier,
};
use headless_lms_models::credit_registrations::CreditRegistrationErrorCode;
use headless_lms_models::suotar_api_calls::{self, SuotarEndpointDailyCost};
use headless_lms_models::suotar_endpoint_rate_limits::{self, SuotarEndpointRateLimit};
use utoipa::ToSchema;

use crate::prelude::*;

use super::authorize_credit_registration_admin;

const DEFAULT_WINDOW_SECS: i64 = 7 * 24 * 60 * 60;
const MIN_WINDOW_SECS: i64 = 60 * 60;
const MAX_WINDOW_SECS: i64 = 90 * 24 * 60 * 60;

/// One course code's roster schedule as it stands.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct EnrolmentCheckRosterCode {
    pub course_code: String,
    pub tier: RosterTier,
    /// When a trigger or the tier next makes it due; `None` when neither will.
    pub next_fetch_at: Option<DateTime<Utc>>,
    pub last_fetched_at: Option<DateTime<Utc>>,
    pub last_listed_person_count: Option<i32>,
    pub last_fetch_duration_ms: Option<i32>,
    pub triggered_fetch_count_today: i32,
    pub is_fetched_alone: bool,
    pub consecutive_failures: i32,
    pub retry_not_before: Option<DateTime<Utc>>,
    pub last_error: Option<CreditRegistrationErrorCode>,
    pub module_count: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct EnrolmentCheckDashboard {
    /// Lateness past this counts as very late.
    pub very_late_after_secs: i64,
    pub lateness: Vec<EnrolmentCheckLateness>,
    pub findings: Vec<EnrolmentCheckFindings>,
    pub population: Vec<EnrolmentCheckPopulation>,
    pub daily_costs: Vec<SuotarEndpointDailyCost>,
    pub roster_codes: Vec<EnrolmentCheckRosterCode>,
    /// What the worker last reported; empty until it has run.
    pub rate_limits: Vec<SuotarEndpointRateLimit>,
}

#[derive(Debug, Deserialize)]
pub struct EnrolmentCheckDashboardQuery {
    window_secs: Option<i64>,
}

/**
GET `/api/v0/main-frontend/credit-registration-admin/enrolment-checks` - Lateness, cost, population
and findings of the enrolment checks, and the roster schedule per course code.
*/
#[instrument(skip(pool, app_conf))]
#[utoipa::path(
    get,
    path = "/enrolment-checks",
    operation_id = "getCreditRegistrationEnrolmentChecks",
    tag = "credit-registration-admin",
    params(("window_secs" = Option<i64>, Query, description = "How far back to read checks and calls, in seconds")),
    responses(
        (status = 200, description = "The enrolment check dashboard", body = EnrolmentCheckDashboard)
    )
)]
pub async fn get_credit_registration_enrolment_checks(
    user: AuthUser,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    query: web::Query<EnrolmentCheckDashboardQuery>,
) -> ControllerResult<web::Json<EnrolmentCheckDashboard>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_credit_registration_admin(&mut conn, user.id).await?;

    let now = Utc::now();
    let window_secs = query
        .window_secs
        .unwrap_or(DEFAULT_WINDOW_SECS)
        .clamp(MIN_WINDOW_SECS, MAX_WINDOW_SECS);
    let since = now - Duration::seconds(window_secs);
    let lateness =
        credit_registration_enrolment_check_outcomes::get_lateness_since(&mut conn, since).await?;
    let findings =
        credit_registration_enrolment_check_outcomes::get_findings_since(&mut conn, since).await?;
    let population =
        credit_registration_enrolment_check_outcomes::get_population(&mut conn).await?;
    let daily_costs = suotar_api_calls::get_daily_costs_since(&mut conn, since).await?;
    let is_account_linking_enabled = app_conf.suotar_configuration.account_linking_enabled;
    let today = now.date_naive();
    let roster_codes = credit_registration_roster_schedules::get_schedules(
        &mut conn,
        None,
        ScheduleSelection::Every,
    )
    .await?
    .into_iter()
    .map(|schedule| EnrolmentCheckRosterCode {
        tier: roster_tier(&schedule.tier_facts, is_account_linking_enabled, now),
        next_fetch_at: schedule.next_fetch_at(is_account_linking_enabled, now),
        triggered_fetch_count_today: if schedule.triggered_fetch_day == Some(today) {
            schedule.triggered_fetch_count
        } else {
            0
        },
        module_count: i32::try_from(schedule.module_count).unwrap_or(i32::MAX),
        course_code: schedule.course_code,
        last_fetched_at: schedule.last_fetched_at,
        last_listed_person_count: schedule.last_listed_person_count,
        last_fetch_duration_ms: schedule.last_fetch_duration_ms,
        is_fetched_alone: schedule.is_fetched_alone,
        consecutive_failures: schedule.consecutive_failures,
        retry_not_before: schedule.retry_not_before,
        last_error: schedule.last_error,
    })
    .collect();
    let rate_limits = suotar_endpoint_rate_limits::get_all(&mut conn).await?;

    token.authorized_ok(web::Json(EnrolmentCheckDashboard {
        very_late_after_secs: VERY_LATE_SECS,
        lateness,
        findings,
        population,
        daily_costs,
        roster_codes,
        rate_limits,
    }))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/enrolment-checks",
        web::get().to(get_credit_registration_enrolment_checks),
    );
}
