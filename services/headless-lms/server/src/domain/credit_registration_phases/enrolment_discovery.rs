//! The `enrolment-discovery` phase: who the study registry says is on the course.
//!
//! One listing unparks the registrations of people we already have a link for, links the few whose
//! registry address is an address one of our accounts has proved it controls, and claims an
//! account-linking mail for everybody else. That middle branch is terminal, never a filter: the
//! population the linking mail exists to reach is the people whose two addresses differ, and every
//! fast-track outcome other than a link falls through to the mail.

use headless_lms_models::course_module_suotar_realisations::{
    RealisationListingOutcome, RealisationToList, claim_stalest_for_listing,
    listing_request_item_id, mark_listing_failed, record_listing_outcome,
};
use headless_lms_models::credit_registration_events::scrub_text;
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::credit_registrations::{
    CreditRegistrationErrorCode, map_wire_code, recheck_no_usable_enrolment_now,
};
use headless_lms_models::email_deliveries::insert_email_delivery_with_placeholders;
use headless_lms_models::email_templates::EmailTemplateType;
use headless_lms_models::library::credit_registration::account_linking::{
    DiscoveredPerson, claim_linking_mails_batch,
};
use headless_lms_models::library::credit_registration::fast_track::{
    FastTrackCandidate, FastTrackDecision, FastTrackLink, RegistryName, decide_fast_track,
    find_fast_track_candidate, link_by_email_match,
};
use headless_lms_models::verified_student_numbers;
use headless_lms_utils::error::util_error::UtilError;
use headless_lms_utils::prelude::BackendError;
use headless_lms_utils::prelude::Utc;
use headless_lms_utils::services::suotar::{
    ListByCourseRequestItem, ListedPerson, SuotarCallContext, SuotarEndpoint, SuotarItemStatus,
};
use serde_json::json;
use sqlx::{Connection, PgConnection};
use std::collections::HashSet;

use super::{
    CreditRegistrationPhase, PhaseContext, PhaseScope, TemplateCache,
    every_item_failed_transiently, listed_person_addresses, template_language,
};

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let endpoint = SuotarEndpoint::ListByCourse;
    let mut conn = ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let claimed =
        claim_stalest_for_listing(&mut tx, endpoint.max_batch_size() as i64, scope.course_id)
            .await?;
    tx.commit().await?;
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
            mark_listing_failed(
                &mut conn,
                realisation.id,
                CreditRegistrationErrorCode::MissingUhCourseCode,
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
    // Held only for the reads above; the Suotar call can pin it for the whole request timeout.
    drop(conn);

    let response = ctx
        .suotar_client
        .list_enrolments_by_course(
            SuotarCallContext::new(ctx.worker_name(CreditRegistrationPhase::EnrolmentDiscovery)),
            items,
        )
        .await;
    let response = match response {
        // No ledger row to move: the realisations keep their old `last_listed_at` and stay first in
        // line for the next iteration.
        Err(error) => return Ok(whole_request_failed(attempted, &error)),
        Ok(response) => response,
    };

    let mut conn = ctx.pool.acquire().await?;
    for realisation in &realisations {
        let item = response.item(&listing_request_item_id(realisation.id));
        let listed = match item {
            Some(item) if item.status == SuotarItemStatus::Ok => Ok(item
                .result
                .as_ref()
                .map(|result| result.people.as_slice())
                .unwrap_or_default()),
            Some(item) => {
                warn!(
                    "Listing realisation {} failed with {}.",
                    realisation.course_unit_realisation_id, item.code
                );
                Err(map_wire_code(&item.code).unwrap_or(CreditRegistrationErrorCode::Unknown))
            }
            None => {
                warn!(
                    "The study registry did not answer for realisation {}.",
                    realisation.course_unit_realisation_id
                );
                Err(CreditRegistrationErrorCode::UnexpectedResponse)
            }
        };
        let people = match listed {
            Ok(people) => people,
            Err(error) => {
                items_failed += 1;
                mark_listing_failed(&mut conn, realisation.id, error).await?;
                continue;
            }
        };
        let outcome = reconcile(ctx, &mut conn, realisation, people).await?;
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
    ctx: &PhaseContext<'_>,
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

    let mut fast_track = FastTrackRun::new(ctx, realisation);
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
        if fast_track.try_link(conn, person, &mut outcome).await? {
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

    // The fast way back for a row parked without an enrolment, which would otherwise wait out its
    // own daily recheck.
    let linked_user_ids: Vec<_> = linked.iter().map(|row| row.user_id).collect();
    if !linked_user_ids.is_empty() {
        recheck_no_usable_enrolment_now(conn, realisation.course_id, &linked_user_ids).await?;
    }
    Ok(outcome)
}

/// The fast track over one realisation's roster: the config it reads and the template lookup it
/// caches, so neither is repeated per person.
struct FastTrackRun<'a> {
    ctx: &'a PhaseContext<'a>,
    realisation: &'a RealisationToList,
    enabled: bool,
    max_verification_age: chrono::Duration,
    templates: TemplateCache,
}

impl<'a> FastTrackRun<'a> {
    fn new(ctx: &'a PhaseContext<'a>, realisation: &'a RealisationToList) -> Self {
        let conf = ctx.suotar_conf;
        Self {
            ctx,
            realisation,
            enabled: conf.fast_track_email_match_enabled,
            max_verification_age: chrono::Duration::days(
                conf.fast_track_max_email_verification_age_days.max(0),
            ),
            templates: TemplateCache::default(),
        }
    }

    /// Whether the person was linked here, in which case no linking mail is owed. `false` for every
    /// other outcome, including the flag being off, and the caller carries on to the mail.
    async fn try_link(
        &mut self,
        conn: &mut PgConnection,
        person: &ListedPerson,
        outcome: &mut RealisationListingOutcome,
    ) -> anyhow::Result<bool> {
        if !self.enabled {
            return Ok(false);
        }
        // One transaction, and the candidate query locks the account row: a profile edit landing
        // between reading the proof and writing the link would leave a link resting on an address
        // the account no longer holds.
        let mut tx = conn.begin().await?;
        // The registry's secondary address is self-entered, so anyone could name someone else's
        // account address there and be handed their student number.
        let candidate =
            find_fast_track_candidate(&mut tx, &person.primary_email, &person.person_id).await?;
        let decision = decide_fast_track(
            candidate.as_ref(),
            RegistryName {
                first_names: Some(&person.first_names),
                last_name: Some(&person.last_name),
            },
            Utc::now(),
            self.max_verification_age,
        );
        match decision {
            FastTrackDecision::NoAccountMatch => outcome.fast_track_skipped_no_account_count += 1,
            FastTrackDecision::UnverifiedAccount => {
                outcome.fast_track_skipped_unverified_count += 1
            }
            FastTrackDecision::StaleVerification => {
                outcome.fast_track_skipped_stale_verification_count += 1
            }
            FastTrackDecision::NameMismatch => outcome.fast_track_skipped_name_mismatch_count += 1,
            FastTrackDecision::AccountHasStudentNumber => {
                outcome.fast_track_skipped_account_has_number_count += 1
            }
            FastTrackDecision::UnlinkedBefore => {
                outcome.fast_track_skipped_unlinked_before_count += 1
            }
            FastTrackDecision::Link => outcome.fast_tracked_count += 1,
        }
        let (FastTrackDecision::Link, Some(candidate)) = (decision, candidate) else {
            return Ok(false);
        };

        link_by_email_match(
            &mut tx,
            &FastTrackLink {
                student_number: &person.student_number,
                sisu_person_id: &person.person_id,
                first_names: Some(&person.first_names),
                last_name: Some(&person.last_name),
                course_id: self.realisation.course_id,
            },
            &candidate,
        )
        .await?;
        self.notify(&mut tx, person, &candidate).await?;
        tx.commit().await?;
        Ok(true)
    }

    /// The security notice that makes a wrong link detectable by the one party the link was proved
    /// against. Off the critical path on purpose: the link is already made and registration proceeds,
    /// so a missing template is logged and skipped rather than failing the listing.
    async fn notify(
        &mut self,
        conn: &mut PgConnection,
        person: &ListedPerson,
        candidate: &FastTrackCandidate,
    ) -> anyhow::Result<()> {
        let language = template_language(&self.realisation.course_language_code);
        let Some(template_id) = self
            .templates
            .id_for(
                conn,
                EmailTemplateType::CreditRegistrationStudentNumberLinked,
                &language,
            )
            .await?
        else {
            warn!(
                "No credit_registration_student_number_linked email template in {language}, so an automatic link went unannounced."
            );
            return Ok(());
        };
        insert_email_delivery_with_placeholders(
            conn,
            candidate.user_id,
            template_id,
            &json!({
                "NAME": candidate.first_name.clone().unwrap_or_default(),
                "STUDENT_NUMBER": person.student_number,
                "LINK": student_number_settings_url(self.ctx.base_url),
            }),
        )
        .await?;
        Ok(())
    }
}

/// Where the notice's "not you? unlink" link goes.
fn student_number_settings_url(base_url: &str) -> String {
    format!(
        "{}/user-settings/student-number",
        base_url.trim_end_matches('/')
    )
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
