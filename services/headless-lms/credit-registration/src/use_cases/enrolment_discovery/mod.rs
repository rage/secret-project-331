//! The `enrolment-discovery` phase: who the study registry says is on the course.
//!
//! Each iteration lists the course codes that are due, triggered listings first, in batches of up
//! to fifty codes; every module on a code shares its listing. One listing wakes the registrations of
//! people we already have a link for and, while account linking is switched on, claims an
//! account-linking mail for everybody else. When to list a code is
//! [`headless_lms_models::credit_registration_roster_schedules`].

mod listing;
mod reconcile;

use std::sync::atomic::{AtomicBool, Ordering};

use headless_lms_models::course_module_suotar_configurations::ModuleToList;
use headless_lms_models::credit_registration_roster_schedules::{
    RosterSchedule, ScheduleSelection, ensure_rows, get_modules_by_code, get_schedules,
};
use headless_lms_models::suotar_api_calls::SuotarEndpoint;
use headless_lms_utils::prelude::Utc;
use sqlx::PgConnection;
use uuid::Uuid;

use crate::domain::Counts;
use crate::error::CreditRegistrationResult;
use crate::registry::{CourseCode, RosterCode, StudyRegistry};
use crate::use_cases::contexts::DiscoveryContext;

use listing::fetch_course_roster;

const ENDPOINT: SuotarEndpoint = SuotarEndpoint::ListByCourse;

/// At most one listing request of the live worker out at a time. A spec's scoped tick is not held
/// to it, or two specs ticking at once would silently skip one listing.
static IS_LISTING: AtomicBool = AtomicBool::new(false);

struct ListingGuard;

impl ListingGuard {
    fn acquire() -> Option<Self> {
        (!IS_LISTING.swap(true, Ordering::AcqRel)).then_some(Self)
    }
}

impl Drop for ListingGuard {
    fn drop(&mut self) {
        IS_LISTING.store(false, Ordering::Release);
    }
}

/// One code of a listing request, with the modules that share its roster.
struct CodeListing {
    code: RosterCode,
    modules: Vec<ModuleToList>,
}

pub(crate) async fn run<R: StudyRegistry>(
    ctx: &DiscoveryContext<'_>,
    registry: &mut R,
) -> CreditRegistrationResult<Counts> {
    let _guard = if ctx.scope.is_unscoped() {
        let Some(guard) = ListingGuard::acquire() else {
            return Ok(Counts::default());
        };
        Some(guard)
    } else {
        None
    };
    // The limiter counts requests on this endpoint, so the limit is how many may go out.
    let request_limit = registry.allowance(ENDPOINT);
    if request_limit == 0 {
        return Ok(Counts::default());
    }
    let mut conn = ctx.pool.acquire().await?;
    let due = load_due_roster_codes(&mut conn, ctx).await?;
    let planned = registry.plan_roster_requests(due, request_limit);
    let requests = code_listings(&mut conn, ctx.scope.course_id, planned).await?;
    drop(conn);

    let mut counts = Counts::default();
    for request in requests {
        counts += fetch_course_roster(ctx, registry, &request).await?;
    }
    Ok(counts)
}

/// The codes whose rosters are due, triggered listings first, then by when each fell due.
async fn load_due_roster_codes(
    conn: &mut PgConnection,
    ctx: &DiscoveryContext<'_>,
) -> CreditRegistrationResult<Vec<RosterCode>> {
    let is_account_linking_enabled = ctx.is_account_linking_enabled;
    let now = Utc::now();
    ensure_rows(conn, ctx.scope.course_id).await?;
    let mut due: Vec<RosterSchedule> =
        get_schedules(conn, ctx.scope.course_id, ScheduleSelection::DueCandidates)
            .await?
            .into_iter()
            .filter(|schedule| schedule.is_due(is_account_linking_enabled, now))
            .collect();
    due.sort_by_key(|schedule| {
        (
            !schedule.is_triggered_due(now),
            schedule.next_fetch_at(is_account_linking_enabled, now),
        )
    });
    Ok(due
        .into_iter()
        .map(|schedule| RosterCode {
            course_code: CourseCode::new(schedule.course_code),
            is_fetched_alone: schedule.is_fetched_alone,
        })
        .collect())
}

/// Each planned request's codes, with the modules that share each code's roster.
async fn code_listings(
    conn: &mut PgConnection,
    course_id: Option<Uuid>,
    planned: Vec<Vec<RosterCode>>,
) -> CreditRegistrationResult<Vec<Vec<CodeListing>>> {
    let codes: Vec<String> = planned
        .iter()
        .flatten()
        .map(|code| code.course_code.as_str().to_string())
        .collect();
    let mut modules_by_code = get_modules_by_code(conn, course_id, &codes).await?;
    Ok(planned
        .into_iter()
        .map(|request| {
            request
                .into_iter()
                .map(|code| CodeListing {
                    modules: modules_by_code
                        .remove(code.course_code.as_str())
                        .unwrap_or_default(),
                    code,
                })
                .collect()
        })
        .collect())
}
