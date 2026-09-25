//! The `enrolment-discovery` phase: who the study registry says is on the course.
//!
//! Each iteration lists the course codes that are due, triggered listings first, in batches of up
//! to fifty codes; every module on a code shares its listing. One listing wakes the registrations of
//! people we already have a link for and, while account linking is switched on, claims an
//! account-linking mail for everybody else. When to list a code is
//! [`headless_lms_models::credit_registration_roster_schedules`].

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};

use headless_lms_models::course_module_suotar_configurations::{
    ModuleListingOutcome, ModuleToList, mark_listing_failed,
    mark_listing_succeeded_without_linking, record_listing_outcome,
};
use headless_lms_models::credit_registration_events::scrub_text;
use headless_lms_models::credit_registration_phase_state::{PhaseErrorKind, PhaseRunOutcome};
use headless_lms_models::credit_registration_roster_schedules::{
    RosterSchedule, ScheduleSelection, ensure_rows, get_modules_by_code, get_schedules,
    mark_alone_failed, mark_attempted, mark_batch_failed, mark_fetched, mark_window_closed,
};
use headless_lms_models::credit_registrations::CreditRegistrationErrorCode;
use headless_lms_models::library::credit_registration::account_linking::{
    DiscoveredPerson, claim_linking_mails_batch,
};
use headless_lms_models::library::credit_registration::classification::map_code;
use headless_lms_models::library::credit_registration::enrolment_checks::{
    RosterEnrolee, wake_for_roster_listing,
};
use headless_lms_models::library::credit_registration::outcomes::request_level_code;
use headless_lms_models::verified_student_numbers::{self, VerifiedStudentNumber};
use headless_lms_utils::error::util_error::{SuotarErrorVariant, UtilError};
use headless_lms_utils::prelude::{BackendError, Utc};
use headless_lms_utils::secret_string::expose_option;
use headless_lms_utils::services::suotar::{
    EnrolmentsListedResult, ListByCourseRequestItem, ListedPerson, SuotarBatchResponse,
    SuotarCallContext, SuotarEndpoint, SuotarItemStatus, new_request_item_id,
};
use secrecy::ExposeSecret;
use sqlx::PgConnection;

use super::{
    CreditRegistrationPhase, PhaseContext, PhaseScope, breaker, claim_limit,
    every_item_service_unavailable, listed_person_addresses, rate_limit, suotar_error_variant,
};

const ENDPOINT: SuotarEndpoint = SuotarEndpoint::ListByCourse;

/// The code Suotar answers for a code it holds no realisation of, which it stops holding two months
/// after the last one ends.
const NO_REALISATION_CODE: CreditRegistrationErrorCode =
    CreditRegistrationErrorCode::CourseCodeNotFound;

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
    course_code: String,
    request_item_id: String,
    modules: Vec<ModuleToList>,
    is_fetched_alone: bool,
}

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let _guard = if scope.is_unscoped() {
        let Some(guard) = ListingGuard::acquire() else {
            return Ok(PhaseRunOutcome::processed(0));
        };
        Some(guard)
    } else {
        None
    };
    let is_account_linking_enabled = ctx.suotar_conf.account_linking_enabled;
    let now = Utc::now();
    let limiter_key = breaker::ScopeKey::of(scope);
    // The limiter counts requests on this endpoint, so the limit is how many may go out.
    let request_limit = claim_limit(&limiter_key, ENDPOINT);
    if request_limit == 0 {
        return Ok(PhaseRunOutcome::processed(0));
    }
    let mut conn = ctx.pool.acquire().await?;
    ensure_rows(&mut conn, scope.course_id).await?;
    let mut due: Vec<RosterSchedule> =
        get_schedules(&mut conn, scope.course_id, ScheduleSelection::DueCandidates)
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
    let mut requests = requests_for(due);
    requests.truncate(request_limit);
    let codes: Vec<String> = requests
        .iter()
        .flatten()
        .map(|listing| listing.course_code.clone())
        .collect();
    let mut modules_by_code = get_modules_by_code(&mut conn, scope.course_id, &codes).await?;
    drop(conn);
    for listing in requests.iter_mut().flatten() {
        listing.modules = modules_by_code
            .remove(&listing.course_code)
            .unwrap_or_default();
    }

    let mut outcome = PhaseRunOutcome::processed(0);
    let mut isolated_error = None;
    let mut has_answer = false;
    for request in requests {
        rate_limit::take(&limiter_key, ENDPOINT, 1);
        let part = list(ctx, &request, is_account_linking_enabled).await?;
        outcome.items_processed += part.items_processed;
        outcome.items_failed += part.items_failed;
        match part.error {
            Some(error) if part.error_kind == PhaseErrorKind::Isolated => {
                isolated_error = isolated_error.or(Some(error));
            }
            Some(error) => {
                rate_limit::drop_to_floor(&limiter_key, &[ENDPOINT]);
                outcome.error = outcome.error.take().or(Some(error));
            }
            None => has_answer = true,
        }
    }
    if outcome.error.is_none() && !has_answer && isolated_error.is_some() {
        outcome.error = isolated_error;
        outcome.error_kind = PhaseErrorKind::Isolated;
    }
    Ok(outcome)
}

/// Splits the due codes into requests: one per code that is listed on its own, and batches of up
/// to the endpoint's size for the rest, in the order the codes are due.
fn requests_for(due: Vec<RosterSchedule>) -> Vec<Vec<CodeListing>> {
    let batch_size = ENDPOINT.max_batch_size();
    let mut requests: Vec<Vec<CodeListing>> = Vec::new();
    let mut open_batch: Option<usize> = None;
    for schedule in due {
        let listing = CodeListing {
            course_code: schedule.course_code,
            request_item_id: new_request_item_id(),
            modules: Vec::new(),
            is_fetched_alone: schedule.is_fetched_alone,
        };
        if schedule.is_fetched_alone {
            requests.push(vec![listing]);
            continue;
        }
        match open_batch {
            Some(index) if requests[index].len() < batch_size => requests[index].push(listing),
            _ => {
                open_batch = Some(requests.len());
                requests.push(vec![listing]);
            }
        }
    }
    requests
}

/// Sends one listing request and reconciles what came back.
async fn list(
    ctx: &PhaseContext<'_>,
    request: &[CodeListing],
    is_account_linking_enabled: bool,
) -> anyhow::Result<PhaseRunOutcome> {
    let codes: Vec<String> = request
        .iter()
        .map(|listing| listing.course_code.clone())
        .collect();
    let module_count: usize = request.iter().map(|listing| listing.modules.len()).sum();
    let attempted = i32::try_from(module_count).unwrap_or(i32::MAX);
    {
        let mut conn = ctx.pool.acquire().await?;
        mark_attempted(&mut conn, &codes).await?;
    }
    let items = request
        .iter()
        .map(|listing| ListByCourseRequestItem {
            request_item_id: listing.request_item_id.clone(),
            course_code: listing.course_code.clone(),
        })
        .collect();
    let response = ctx
        .suotar_client
        .list_enrolments_by_course(
            SuotarCallContext::new(ctx.worker_name(CreditRegistrationPhase::EnrolmentDiscovery)),
            items,
        )
        .await;
    let mut conn = ctx.pool.acquire().await?;
    let response = match response {
        Ok(response) => response,
        Err(error) => {
            record_request_failure(&mut conn, request, &error).await?;
            let is_known_bad_code = matches!(request, [only] if only.is_fetched_alone)
                && blames_the_codes(suotar_error_variant(&error));
            return Ok(PhaseRunOutcome {
                items_processed: attempted,
                items_failed: attempted,
                error: Some(scrub_text(error.message())),
                error_kind: if is_known_bad_code {
                    PhaseErrorKind::Isolated
                } else {
                    PhaseErrorKind::StudyRegistry
                },
            });
        }
    };

    let duration_ms = i32::try_from(response.duration.as_millis()).unwrap_or(i32::MAX);
    let mut items_failed = 0;
    for listing in request {
        match listed_people(&response, listing) {
            Ok(people) => {
                reconcile(&mut conn, listing, people, is_account_linking_enabled).await?;
                let person_count = i32::try_from(people.len()).unwrap_or(i32::MAX);
                mark_fetched(&mut conn, &listing.course_code, person_count, duration_ms).await?;
            }
            Err(error) => {
                items_failed += i32::try_from(listing.modules.len()).unwrap_or(i32::MAX);
                for module in &listing.modules {
                    mark_listing_failed(&mut conn, module.course_module_id, error).await?;
                }
                if error == NO_REALISATION_CODE {
                    mark_window_closed(&mut conn, &listing.course_code).await?;
                } else {
                    mark_alone_failed(&mut conn, &listing.course_code, error).await?;
                }
            }
        }
    }
    Ok(PhaseRunOutcome {
        items_processed: attempted,
        items_failed,
        error: every_item_service_unavailable(&response)
            .then(|| "Every course code of the batch came back unavailable.".to_string()),
        ..PhaseRunOutcome::default()
    })
}

/// The people one code's answer lists, or why there is no roster for it.
fn listed_people<'a>(
    response: &'a SuotarBatchResponse<EnrolmentsListedResult>,
    listing: &CodeListing,
) -> Result<&'a [ListedPerson], CreditRegistrationErrorCode> {
    match response.item(&listing.request_item_id) {
        Some(item) if item.status == SuotarItemStatus::Ok => Ok(item
            .result
            .as_ref()
            .map(|result| result.people.as_slice())
            .unwrap_or_default()),
        Some(item) => {
            warn!(
                "Listing course code {} failed with {}.",
                listing.course_code, item.code
            );
            Err(map_code(ENDPOINT, &item.code).unwrap_or(CreditRegistrationErrorCode::Unknown))
        }
        None => {
            warn!(
                "The study registry did not answer for course code {}.",
                listing.course_code
            );
            Err(CreditRegistrationErrorCode::UnexpectedResponse)
        }
    }
}

/// Whether a failed listing request may be down to one of its codes. A connection that never opened
/// or our own credentials say nothing about any code.
fn blames_the_codes(variant: SuotarErrorVariant) -> bool {
    !matches!(
        variant,
        SuotarErrorVariant::TransportNotDelivered | SuotarErrorVariant::Unauthorized
    )
}

/// A request Suotar failed as a whole. Suotar fails every code of a request when one fails, so the
/// codes of a failed batch are listed on their own from now on, and a code that fails alone backs
/// off.
async fn record_request_failure(
    conn: &mut PgConnection,
    request: &[CodeListing],
    error: &UtilError,
) -> anyhow::Result<()> {
    let variant = suotar_error_variant(error);
    let code = request_level_code(variant);
    for module in request.iter().flat_map(|listing| &listing.modules) {
        mark_listing_failed(conn, module.course_module_id, code).await?;
    }
    if !blames_the_codes(variant) {
        return Ok(());
    }
    match request {
        [only] => mark_alone_failed(conn, &only.course_code, code).await?,
        _ => {
            let codes: Vec<String> = request
                .iter()
                .map(|listing| listing.course_code.clone())
                .collect();
            mark_batch_failed(conn, &codes, code).await?;
        }
    }
    Ok(())
}

/// Wakes and mails for one code's roster, module by module: mails and links are per course.
async fn reconcile(
    conn: &mut PgConnection,
    listing: &CodeListing,
    people: &[ListedPerson],
    is_account_linking_enabled: bool,
) -> anyhow::Result<()> {
    let distinct = distinct_people(people);
    let linked = linked_accounts(conn, &distinct).await?;
    let enrolees = roster_enrolees(people, &linked);
    for module in &listing.modules {
        if !enrolees.is_empty() {
            wake_for_roster_listing(conn, module.course_module_id, &enrolees).await?;
        }
        if is_account_linking_enabled {
            let outcome = claim_linking_mails(conn, module, &distinct, &linked).await?;
            record_listing_outcome(conn, module.course_module_id, &outcome).await?;
        } else {
            mark_listing_succeeded_without_linking(conn, module.course_module_id).await?;
        }
    }
    Ok(())
}

/// A person enrolled on several realisations of the code is listed once per realisation; keeps the
/// most recent enrolment of each, one with no enrolment time counting as the oldest.
fn distinct_people(people: &[ListedPerson]) -> Vec<&ListedPerson> {
    let enrolled_at = |person: &ListedPerson| {
        person
            .enrolment
            .as_ref()
            .and_then(|enrolment| enrolment.enrolment_date_time)
    };
    let mut kept: Vec<&ListedPerson> = Vec::new();
    let mut index_by_person: HashMap<&str, usize> = HashMap::new();
    for person in people {
        match index_by_person.get(person.person_id.expose_secret()) {
            Some(&index) => {
                if enrolled_at(person) > enrolled_at(kept[index]) {
                    kept[index] = person;
                }
            }
            None => {
                index_by_person.insert(person.person_id.expose_secret(), kept.len());
                kept.push(person);
            }
        }
    }
    kept
}

/// The accounts already linked to someone on the roster, by Sisu person id or student number.
async fn linked_accounts(
    conn: &mut PgConnection,
    people: &[&ListedPerson],
) -> anyhow::Result<Vec<VerifiedStudentNumber>> {
    let person_ids: Vec<String> = people
        .iter()
        .map(|person| person.person_id.expose_secret().to_owned())
        .collect();
    let student_numbers: Vec<String> = people
        .iter()
        .map(|person| person.student_number.expose_secret().to_owned())
        .collect();
    let mut linked = verified_student_numbers::get_by_sisu_person_ids(conn, &person_ids).await?;
    // A study_registry link has no person id until resolve-person-ids reaches it.
    let linked_ids: HashSet<_> = linked.iter().map(|row| row.id).collect();
    let linked_by_number = verified_student_numbers::get_by_student_numbers(conn, &student_numbers)
        .await?
        .into_iter()
        .filter(|row| !linked_ids.contains(&row.id))
        .collect::<Vec<_>>();
    linked.extend(linked_by_number);
    Ok(linked)
}

/// The linked accounts on the roster, each with every enrolment id the registry lists them under.
fn roster_enrolees(
    people: &[ListedPerson],
    linked: &[VerifiedStudentNumber],
) -> Vec<RosterEnrolee> {
    let mut ids_by_person_id: HashMap<&str, Vec<String>> = HashMap::new();
    let mut person_id_by_student_number: HashMap<&str, &str> = HashMap::new();
    for person in people {
        let person_id = person.person_id.expose_secret();
        person_id_by_student_number.insert(person.student_number.expose_secret(), person_id);
        let ids = ids_by_person_id.entry(person_id).or_default();
        if let Some(id) = person
            .enrolment
            .as_ref()
            .and_then(|enrolment| enrolment.id.clone())
        {
            ids.push(id);
        }
    }
    linked
        .iter()
        .filter_map(|row| {
            let person_id = expose_option(&row.sisu_person_id)
                .filter(|person_id| ids_by_person_id.contains_key(person_id))
                .or_else(|| {
                    person_id_by_student_number
                        .get(row.student_number.expose_secret())
                        .copied()
                })?;
            Some(RosterEnrolee {
                user_id: row.user_id,
                enrolment_ids: ids_by_person_id.get(person_id).cloned().unwrap_or_default(),
            })
        })
        .collect()
}

/// Claims a linking mail for everyone on one module's roster we hold no link for, and returns the
/// counters its configuration row carries.
async fn claim_linking_mails(
    conn: &mut PgConnection,
    module: &ModuleToList,
    people: &[&ListedPerson],
    linked: &[VerifiedStudentNumber],
) -> anyhow::Result<ModuleListingOutcome> {
    let mut outcome = ModuleListingOutcome {
        listed_person_count: i32::try_from(people.len()).unwrap_or(i32::MAX),
        ..ModuleListingOutcome::default()
    };
    let linked_person_ids: HashSet<&str> = linked
        .iter()
        .filter_map(|row| expose_option(&row.sisu_person_id))
        .collect();
    let linked_student_numbers: HashSet<&str> = linked
        .iter()
        .map(|row| row.student_number.expose_secret())
        .collect();

    let mut discovered = Vec::new();
    for &person in people {
        if linked_person_ids.contains(person.person_id.expose_secret())
            || linked_student_numbers.contains(person.student_number.expose_secret())
        {
            outcome.already_linked_count += 1;
            continue;
        }
        let addresses = listed_person_addresses(person);
        if addresses.is_empty() {
            // The only genuinely unreachable population, and the reason it has a counter of its own.
            outcome.no_address_count += 1;
            continue;
        }
        discovered.push(DiscoveredPerson {
            sisu_person_id: person.person_id.clone().into(),
            student_number: person.student_number.clone().into(),
            first_names: person.first_names.clone().map(Into::into),
            last_name: person.last_name.clone().map(Into::into),
            course_id: module.course_id,
            addresses,
        });
    }
    if !discovered.is_empty() {
        for claimed in claim_linking_mails_batch(conn, &discovered).await? {
            outcome.mailed_count += claimed.claimed;
            outcome.suppressed_by_dedup_count += claimed.suppressed_by_dedup;
            outcome.suppressed_by_rate_cap_count += claimed.suppressed_by_rate_cap;
        }
    }
    Ok(outcome)
}
