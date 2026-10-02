//! The `enrolment-discovery` phase: who the study registry says is on the course.
//!
//! Each iteration lists the course codes that are due, triggered listings first, in batches as
//! large as the registry takes; every module on a code shares its listing. One listing wakes the
//! registrations of people we already have a link for and, while account linking is switched on,
//! claims an account-linking mail for everybody else. When to list a code is
//! [`headless_lms_models::credit_registration_roster_schedules`].

mod listing;
mod reconcile;

use headless_lms_models::course_module_suotar_configurations::ModuleToList;
use headless_lms_models::credit_registration_roster_schedules::{
    RosterSchedule, ScheduleSelection, book_triggered_fetch, ensure_rows, get_modules_by_code,
    get_schedules,
};
use headless_lms_models::{course_modules, verified_student_numbers};
use headless_lms_utils::prelude::Utc;
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::error::CreditRegistrationResult;
use crate::registry::{CourseCode, RegistryOperation, RosterCode, StudyRegistry};
use crate::workflow::Counts;
use headless_lms_models::credit_registrations::RegistrationScope;

use listing::fetch_course_roster;

/// One code of a listing request, with the modules that share its roster.
struct CodeListing {
    code: RosterCode,
    modules: Vec<ModuleToList>,
}

/// Books a listing of the module's course code for a student we hold no number for, since the
/// listing is what mails them the link. `is_visit` also books the follow-up listing a visit gets.
/// Does nothing for a linked student, or a module with no course code. The caller checks that
/// account linking is switched on.
pub async fn book_listing_for_unlinked_student(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_module_id: Uuid,
    is_visit: bool,
) -> CreditRegistrationResult<()> {
    if verified_student_numbers::get_by_user_id(conn, user_id)
        .await?
        .is_some()
    {
        return Ok(());
    }
    let course_module = course_modules::get_by_id(conn, course_module_id).await?;
    let Some(course_code) = course_module
        .uh_course_code
        .as_deref()
        .and_then(CourseCode::parse)
    else {
        return Ok(());
    };
    book_triggered_fetch(conn, course_code.as_str(), is_visit).await?;
    Ok(())
}

/// With account linking off, a roster still wakes linked students' registrations, and only the
/// mails are left out.
pub(crate) async fn run<R: StudyRegistry>(
    pool: &PgPool,
    scope: &RegistrationScope,
    is_account_linking_enabled: bool,
    registry: &mut R,
) -> CreditRegistrationResult<Counts> {
    // The limiter counts roster requests, so the limit is how many may go out.
    let request_limit = registry.allowance(RegistryOperation::ListCourseRoster);
    if request_limit == 0 {
        return Ok(Counts::default());
    }
    let mut conn = pool.acquire().await?;
    let due = load_due_roster_codes(&mut conn, scope.course_id, is_account_linking_enabled).await?;
    let planned = plan_roster_requests(due, request_limit, registry.roster_request_size());
    let requests = load_listing_modules(&mut conn, scope.course_id, planned).await?;
    drop(conn);

    let mut counts = Counts::default();
    for request in requests {
        counts += fetch_course_roster(pool, registry, &request, is_account_linking_enabled).await?;
    }
    Ok(counts)
}

/// The codes whose rosters are due, triggered listings first, then by when each fell due.
async fn load_due_roster_codes(
    conn: &mut PgConnection,
    course_id: Option<Uuid>,
    is_account_linking_enabled: bool,
) -> CreditRegistrationResult<Vec<RosterCode>> {
    let now = Utc::now();
    ensure_rows(conn, course_id).await?;
    let mut due: Vec<RosterSchedule> =
        get_schedules(conn, course_id, ScheduleSelection::DueCandidates)
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
        .filter_map(|schedule| {
            Some(RosterCode {
                course_code: CourseCode::parse(&schedule.course_code)?,
                is_fetched_alone: schedule.is_fetched_alone,
            })
        })
        .collect())
}

/// Groups due codes into requests in the order given: a code fetched alone in one of its own, the
/// rest in batches of `request_size`. Keeps the first `request_limit`.
fn plan_roster_requests(
    due: Vec<RosterCode>,
    request_limit: usize,
    request_size: usize,
) -> Vec<Vec<RosterCode>> {
    let mut requests: Vec<Vec<RosterCode>> = Vec::new();
    let mut open_batch: Option<usize> = None;
    for code in due {
        if code.is_fetched_alone {
            requests.push(vec![code]);
            continue;
        }
        match open_batch {
            Some(index) if requests[index].len() < request_size => requests[index].push(code),
            _ => {
                open_batch = Some(requests.len());
                requests.push(vec![code]);
            }
        }
    }
    requests.truncate(request_limit);
    requests
}

/// Each planned request's codes, with the modules that share each code's roster.
async fn load_listing_modules(
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

#[cfg(test)]
mod tests {
    use super::*;

    fn roster_codes(alone: &[&str], batched: usize) -> Vec<RosterCode> {
        let alone = alone.iter().map(|alone_code| RosterCode {
            course_code: CourseCode::parse(alone_code).expect("a code"),
            is_fetched_alone: true,
        });
        let batched = (0..batched).map(|index| RosterCode {
            course_code: CourseCode::parse(&format!("B{index}")).expect("a code"),
            is_fetched_alone: false,
        });
        alone.chain(batched).collect()
    }

    fn planned_sizes(requests: &[Vec<RosterCode>]) -> Vec<usize> {
        requests.iter().map(Vec::len).collect()
    }

    #[test]
    fn roster_codes_fetched_alone_go_in_requests_of_their_own_and_the_rest_in_full_batches() {
        let due = roster_codes(&["A1", "A2"], 51);
        let requests = plan_roster_requests(due, usize::MAX, 50);
        assert_eq!(planned_sizes(&requests), [1, 1, 50, 1]);
        assert_eq!(requests[1][0].course_code.as_str(), "A2");
        assert_eq!(requests[3][0].course_code.as_str(), "B50");
    }

    #[test]
    fn roster_planning_keeps_the_first_requests_up_to_the_limit() {
        let requests = plan_roster_requests(roster_codes(&["A1"], 51), 2, 50);
        assert_eq!(planned_sizes(&requests), [1, 50]);
    }

    #[test]
    fn a_roster_probe_sends_one_code() {
        let requests = plan_roster_requests(roster_codes(&[], 60), 1, 1);
        assert_eq!(planned_sizes(&requests), [1]);
    }
}
