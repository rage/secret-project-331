//! The `enrolment-discovery` phase: who the study registry says is on the course, and what that
//! tells us about them.
//!
//! Two things come out of one listing. A person we already have a link for may have re-enrolled,
//! which is what unparks their registration; a person we have no link for is claimed for an
//! account-linking mail, which the `link-emails` phase queues.
//!
//! Deliberately no matching of Sisu addresses against accounts here: the population the linking mail
//! exists to reach is exactly the people whose two addresses differ.
//!
//! One item is one realisation, not one person. The per-person detail goes onto the realisation row's
//! own counters, which is where a teacher or an admin reads it.

use headless_lms_models::course_module_suotar_realisations::{
    RealisationListingOutcome, RealisationToList, get_stalest_for_listing, listing_request_item_id,
    record_listing_outcome,
};
use headless_lms_models::credit_registration_events::scrub_text;
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::credit_registrations::recheck_no_usable_enrolment_now;
use headless_lms_models::library::credit_registration::account_linking::{
    DiscoveredPerson, claim_linking_mails_batch,
};
use headless_lms_models::verified_student_numbers;
use headless_lms_utils::error::util_error::UtilError;
use headless_lms_utils::prelude::BackendError;
use headless_lms_utils::services::suotar::{
    ListByCourseRequestItem, ListedPerson, SuotarCallContext, SuotarEndpoint, SuotarItemStatus,
};
use sqlx::PgConnection;
use std::collections::HashSet;

use super::{
    CreditRegistrationPhase, PhaseContext, PhaseScope, every_item_failed_transiently,
    listed_person_addresses,
};

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let endpoint = SuotarEndpoint::ListByCourse;
    let mut conn = ctx.pool.acquire().await?;
    let claimed =
        get_stalest_for_listing(&mut conn, endpoint.max_batch_size() as i64, scope.course_id)
            .await?;
    let attempted = i32::try_from(claimed.len()).unwrap_or(i32::MAX);

    let mut items = Vec::new();
    let mut realisations = Vec::new();
    let mut items_failed = 0;
    for realisation in claimed {
        let Some(course_code) = listable_course_code(&realisation) else {
            // A configuration problem the config check reports on; a call would only earn
            // `courseCodeNotFound`.
            warn!(
                "Course module {} has a Suotar realisation but no course code, so it cannot be listed.",
                realisation.course_module_id
            );
            items_failed += 1;
            // Advances `last_listed_at` even though nothing was asked, so a permanently
            // unconfigured realisation cycles to the back of the stalest-first queue instead of
            // blocking every other realisation on the platform forever.
            record_listing_outcome(
                &mut conn,
                realisation.id,
                &RealisationListingOutcome::default(),
            )
            .await?;
            continue;
        };
        items.push(ListByCourseRequestItem {
            request_item_id: listing_request_item_id(realisation.id),
            course_code,
            course_unit_realisation_id: Some(realisation.course_unit_realisation_id.clone()),
        });
        realisations.push(realisation);
    }
    if items.is_empty() {
        return Ok(PhaseRunOutcome {
            items_processed: attempted,
            items_failed,
            error: None,
        });
    }
    // Held only for the reads and missing-course-code writes; the Suotar call below can pin it for
    // the whole request timeout.
    drop(conn);

    let response = ctx
        .suotar_client
        .list_enrolments_by_course(
            SuotarCallContext::new(ctx.worker_name(CreditRegistrationPhase::EnrolmentDiscovery)),
            items,
        )
        .await;
    let response = match response {
        // No ledger row is involved, so there is nothing to move; the realisations keep their old
        // `last_listed_at` and stay first in line for the next iteration.
        Err(error) => return Ok(whole_request_failed(attempted, &error)),
        Ok(response) => response,
    };

    let mut conn = ctx.pool.acquire().await?;
    for realisation in &realisations {
        let item = response.item(&listing_request_item_id(realisation.id));
        let people = match item {
            Some(item) if item.status == SuotarItemStatus::Ok => item
                .result
                .as_ref()
                .map(|result| result.people.as_slice())
                .unwrap_or_default(),
            Some(item) => {
                warn!(
                    "Listing realisation {} failed with {}.",
                    realisation.course_unit_realisation_id, item.code
                );
                items_failed += 1;
                // Same reason as the missing-course-code case above: a realisation that keeps
                // failing must still cycle to the back of the queue.
                record_listing_outcome(
                    &mut conn,
                    realisation.id,
                    &RealisationListingOutcome::default(),
                )
                .await?;
                continue;
            }
            None => {
                warn!(
                    "The study registry did not answer for realisation {}.",
                    realisation.course_unit_realisation_id
                );
                items_failed += 1;
                record_listing_outcome(
                    &mut conn,
                    realisation.id,
                    &RealisationListingOutcome::default(),
                )
                .await?;
                continue;
            }
        };
        let outcome = reconcile(&mut conn, realisation, people).await?;
        record_listing_outcome(&mut conn, realisation.id, &outcome).await?;
    }

    Ok(PhaseRunOutcome {
        items_processed: attempted,
        items_failed,
        error: every_item_failed_transiently(&response).then(|| {
            "Every realisation of the batch came back transiently unavailable.".to_string()
        }),
    })
}

/// Applies one realisation's roster and returns the counters the realisation row carries.
async fn reconcile(
    conn: &mut PgConnection,
    realisation: &RealisationToList,
    people: &[ListedPerson],
) -> anyhow::Result<RealisationListingOutcome> {
    let mut outcome = RealisationListingOutcome {
        listed_person_count: i32::try_from(people.len()).unwrap_or(i32::MAX),
        ..RealisationListingOutcome::default()
    };
    let person_ids: Vec<String> = people
        .iter()
        .map(|person| person.person_id.clone())
        .collect();
    let linked = verified_student_numbers::get_by_sisu_person_ids(conn, &person_ids).await?;
    let linked_person_ids: HashSet<&str> = linked
        .iter()
        .map(|row| row.sisu_person_id.as_str())
        .collect();

    let mut discovered = Vec::new();
    for person in people {
        if linked_person_ids.contains(person.person_id.as_str()) {
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
            sisu_person_id: person.person_id.clone(),
            student_number: person.student_number.clone(),
            first_names: Some(person.first_names.clone()),
            last_name: Some(person.last_name.clone()),
            course_id: realisation.course_id,
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

    // The fast way back for a row parked without an enrolment. Without it the row waits out its own
    // daily recheck.
    let linked_user_ids: Vec<_> = linked.iter().map(|row| row.user_id).collect();
    if !linked_user_ids.is_empty() {
        recheck_no_usable_enrolment_now(conn, realisation.course_id, &linked_user_ids).await?;
    }
    Ok(outcome)
}

fn listable_course_code(realisation: &RealisationToList) -> Option<String> {
    realisation
        .uh_course_code
        .clone()
        .filter(|code| !code.trim().is_empty())
}

fn whole_request_failed(attempted: i32, error: &UtilError) -> PhaseRunOutcome {
    PhaseRunOutcome {
        items_processed: attempted,
        items_failed: attempted,
        error: Some(scrub_text(error.message())),
    }
}
