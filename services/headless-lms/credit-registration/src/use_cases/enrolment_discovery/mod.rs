//! The `enrolment-discovery` phase: who the study registry says is on the course.
//!
//! Each iteration fetches the enrolment lists of the course codes that are due, those with people
//! waiting first, in batches as large as the registry takes; every module on a code shares its
//! list. One list wakes the registrations of people we already have a link for and, while account
//! linking is switched on and `link-emails` is not paused, claims a linking email for everybody
//! else, which the `link-emails` phase is made due at once to send. When to fetch a code is
//! [`headless_lms_models::credit_registration_roster_schedules`].

mod listing;
mod reconcile;

pub(crate) use reconcile::list_unlinked_enrolled_before;

use headless_lms_models::course_module_suotar_configurations::ModuleToList;
use headless_lms_models::credit_registration_phase_state;
use headless_lms_models::credit_registration_roster_schedules::{
    RosterSchedule, ScheduleSelection, ensure_rows, get_modules_by_code, get_schedules,
};
use headless_lms_utils::prelude::{DateTime, Utc};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::error::CreditRegistrationResult;
use crate::phase::CreditRegistrationPhase;
use crate::registry::{CourseCode, RegistryOperation, RosterCode, StudyRegistry};
use crate::workflow::Counts;
use headless_lms_models::credit_registrations::RegistrationScope;

use listing::fetch_course_roster;

/// One code of a listing request, with the modules that share its roster.
struct CodeListing {
    code: RosterCode,
    modules: Vec<ModuleToList>,
}

/// With account linking off (`account_linking_since` `None`), a roster still wakes linked students'
/// registrations, and only the mails are left out.
pub(crate) async fn run<R: StudyRegistry>(
    pool: &PgPool,
    scope: &RegistrationScope,
    account_linking_since: Option<DateTime<Utc>>,
    registry: &mut R,
) -> CreditRegistrationResult<Counts> {
    // The limiter counts roster requests, so the limit is how many may go out.
    let request_limit = registry.allowance(RegistryOperation::ListCourseRoster);
    if request_limit == 0 {
        return Ok(Counts::default());
    }
    let mut conn = pool.acquire().await?;
    // Claims made during a pause would all go out at once on resume. Nobody counts as waiting
    // meanwhile either, so rungs and presses are left for a fetch that can claim mail.
    let mailing_since = if credit_registration_phase_state::is_paused(
        &mut conn,
        CreditRegistrationPhase::LinkEmails.as_str(),
    )
    .await?
    {
        None
    } else {
        account_linking_since
    };
    let due = load_due_roster_codes(&mut conn, scope.course_id, mailing_since).await?;
    let planned = plan_roster_requests(due, request_limit, registry.roster_request_size());
    let requests = load_listing_modules(&mut conn, scope.course_id, planned).await?;
    drop(conn);

    let mut counts = Counts::default();
    let mut claimed_mail = false;
    for request in requests {
        let fetched = fetch_course_roster(pool, registry, &request, mailing_since).await?;
        counts += fetched.counts;
        claimed_mail |= fetched.claimed_mail;
    }
    // A scoped run writes nothing to the phase-state row.
    if claimed_mail && scope.is_unscoped() {
        let mut conn = pool.acquire().await?;
        credit_registration_phase_state::run_now(
            &mut conn,
            CreditRegistrationPhase::LinkEmails.as_str(),
        )
        .await?;
    }
    Ok(counts)
}

/// The codes whose enrolment lists are due, those with people waiting first, then by when each
/// fell due.
async fn load_due_roster_codes(
    conn: &mut PgConnection,
    course_id: Option<Uuid>,
    account_linking_since: Option<DateTime<Utc>>,
) -> CreditRegistrationResult<Vec<RosterCode>> {
    let now = Utc::now();
    ensure_rows(conn, course_id).await?;
    let mut due: Vec<RosterSchedule> = get_schedules(
        conn,
        course_id,
        ScheduleSelection::DueCandidates,
        account_linking_since,
    )
    .await?
    .into_iter()
    .filter(|schedule| schedule.is_due(now))
    .collect();
    due.sort_by_key(|schedule| (schedule.waiting_count == 0, schedule.next_fetch_at(now)));
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
