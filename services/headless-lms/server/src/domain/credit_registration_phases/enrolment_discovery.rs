//! The `enrolment-discovery` phase: who the study registry says is on the course.
//!
//! One listing unparks the registrations of people we already have a link for and, while account
//! linking is switched on, claims an account-linking mail for everybody else. With linking off it
//! lists only the modules that have a registration waiting for an enrolment.

use headless_lms_models::course_module_suotar_configurations::{
    ModuleListingOutcome, ModuleToList, claim_stalest_modules_for_listing, mark_listing_failed,
    mark_listing_succeeded_without_linking, record_listing_outcome,
};
use headless_lms_models::credit_registration_events::scrub_text;
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::credit_registrations::{
    CreditRegistrationErrorCode, RosterEnrolee, recheck_no_usable_enrolment_now,
};
use headless_lms_models::library::credit_registration::account_linking::{
    DiscoveredPerson, claim_linking_mails_batch,
};
use headless_lms_models::library::credit_registration::classification::map_code;
use headless_lms_models::library::credit_registration::outcomes::request_level_code;
use headless_lms_models::verified_student_numbers::{self, VerifiedStudentNumber};
use headless_lms_utils::error::util_error::UtilError;
use headless_lms_utils::prelude::BackendError;
use headless_lms_utils::secret_string::expose_option;
use headless_lms_utils::services::suotar::{
    ListByCourseRequestItem, ListedPerson, SuotarCallContext, SuotarEndpoint, SuotarItemStatus,
    new_request_item_id,
};
use secrecy::ExposeSecret;
use sqlx::{Connection, PgConnection};
use std::collections::{BTreeMap, HashMap, HashSet};

use super::{
    CreditRegistrationPhase, PhaseContext, PhaseScope, every_item_service_unavailable,
    listed_person_addresses, suotar_error_variant,
};

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let endpoint = SuotarEndpoint::ListByCourse;
    let is_account_linking_enabled = ctx.suotar_conf.account_linking_enabled;
    let mut conn = ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let claimed = claim_stalest_modules_for_listing(
        &mut tx,
        endpoint.max_batch_size() as i64,
        scope.course_id,
        !is_account_linking_enabled,
    )
    .await?;
    tx.commit().await?;
    let attempted = i32::try_from(claimed.len()).unwrap_or(i32::MAX);
    if claimed.is_empty() {
        return Ok(PhaseRunOutcome::processed(0));
    }
    // Held only for the claim; the Suotar call can pin it for the whole request timeout.
    drop(conn);

    // One item per course code: modules sharing a code share its roster, but mails and links are
    // per course, so each module still reconciles it on its own.
    let mut modules_by_code: BTreeMap<String, Vec<ModuleToList>> = BTreeMap::new();
    for module in claimed {
        modules_by_code
            .entry(module.uh_course_code.clone())
            .or_default()
            .push(module);
    }
    let listings: Vec<CourseCodeListing> = modules_by_code
        .into_iter()
        .map(|(course_code, modules)| CourseCodeListing {
            course_code,
            request_item_id: new_request_item_id(),
            modules,
        })
        .collect();
    let items = listings
        .iter()
        .map(|listing| ListByCourseRequestItem {
            request_item_id: listing.request_item_id.clone(),
            course_code: listing.course_code.clone(),
        })
        .collect();
    let mut items_failed = 0;

    let response = ctx
        .suotar_client
        .list_enrolments_by_course(
            SuotarCallContext::new(ctx.worker_name(CreditRegistrationPhase::EnrolmentDiscovery)),
            items,
        )
        .await;
    let response = match response {
        Err(error) => {
            let code = request_level_code(suotar_error_variant(&error));
            let mut conn = ctx.pool.acquire().await?;
            for module in listings.iter().flat_map(|listing| &listing.modules) {
                mark_listing_failed(&mut conn, module.course_module_id, code).await?;
            }
            return Ok(whole_request_failed(attempted, &error));
        }
        Ok(response) => response,
    };

    let mut conn = ctx.pool.acquire().await?;
    for CourseCodeListing {
        course_code,
        request_item_id,
        modules,
    } in &listings
    {
        let item = response.item(request_item_id);
        let listed = match item {
            Some(item) if item.status == SuotarItemStatus::Ok => Ok(item
                .result
                .as_ref()
                .map(|result| result.people.as_slice())
                .unwrap_or_default()),
            Some(item) => {
                warn!(
                    "Listing course code {course_code} failed with {}.",
                    item.code
                );
                Err(map_code(endpoint, &item.code).unwrap_or(CreditRegistrationErrorCode::Unknown))
            }
            None => {
                warn!("The study registry did not answer for course code {course_code}.");
                Err(CreditRegistrationErrorCode::UnexpectedResponse)
            }
        };
        let people = match listed {
            Ok(people) => distinct_people(people),
            Err(error) => {
                for module in modules {
                    items_failed += 1;
                    mark_listing_failed(&mut conn, module.course_module_id, error).await?;
                }
                continue;
            }
        };
        let linked = linked_accounts(&mut conn, &people).await?;
        let enrolees = roster_enrolees(&people, &linked);
        for module in modules {
            if !enrolees.is_empty() {
                recheck_no_usable_enrolment_now(&mut conn, module.course_module_id, &enrolees)
                    .await?;
            }
            if is_account_linking_enabled {
                let outcome = claim_linking_mails(&mut conn, module, &people, &linked).await?;
                record_listing_outcome(&mut conn, module.course_module_id, &outcome).await?;
            } else {
                mark_listing_succeeded_without_linking(&mut conn, module.course_module_id).await?;
            }
        }
    }

    Ok(PhaseRunOutcome {
        items_processed: attempted,
        items_failed,
        error: every_item_service_unavailable(&response)
            .then(|| "Every course code of the batch came back unavailable.".to_string()),
        is_sisu_outage: false,
    })
}

/// One `list-by-course` item: modules sharing a code share its roster.
struct CourseCodeListing {
    course_code: String,
    request_item_id: String,
    modules: Vec<ModuleToList>,
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

/// The linked accounts on the roster, each with the enrolment the registry lists for them.
fn roster_enrolees(
    people: &[&ListedPerson],
    linked: &[VerifiedStudentNumber],
) -> Vec<RosterEnrolee> {
    let enrolled_at = |person: &ListedPerson| {
        person
            .enrolment
            .as_ref()
            .and_then(|enrolment| enrolment.enrolment_date_time)
    };
    let by_person_id: HashMap<&str, &ListedPerson> = people
        .iter()
        .map(|&person| (person.person_id.expose_secret(), person))
        .collect();
    let by_student_number: HashMap<&str, &ListedPerson> = people
        .iter()
        .map(|&person| (person.student_number.expose_secret(), person))
        .collect();
    linked
        .iter()
        .filter_map(|row| {
            let person = expose_option(&row.sisu_person_id)
                .and_then(|person_id| by_person_id.get(person_id))
                .or_else(|| by_student_number.get(row.student_number.expose_secret()))?;
            Some(RosterEnrolee {
                user_id: row.user_id,
                enrolled_at: enrolled_at(person),
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

fn whole_request_failed(attempted: i32, error: &UtilError) -> PhaseRunOutcome {
    PhaseRunOutcome {
        items_processed: attempted,
        items_failed: attempted,
        error: Some(scrub_text(error.message())),
        is_sisu_outage: false,
    }
}
