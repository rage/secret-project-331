//! The `enrolment-discovery` phase: who the study registry says is on the course.
//!
//! One listing unparks the registrations of people we already have a link for, links the few whose
//! registry address is an address one of our accounts has proved it controls, and claims an
//! account-linking mail for everybody else. That middle branch is terminal, never a filter: the
//! population the linking mail exists to reach is the people whose two addresses differ, and every
//! fast-track outcome other than a link falls through to the mail.

use headless_lms_models::course_module_suotar_configurations::{
    ModuleListingOutcome, ModuleToList, claim_stalest_modules_for_listing, mark_listing_failed,
    record_listing_outcome,
};
use headless_lms_models::credit_registration_events::scrub_text;
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::credit_registrations::{
    CreditRegistrationErrorCode, recheck_no_usable_enrolment_now,
};
use headless_lms_models::email_deliveries::insert_email_delivery_with_placeholders;
use headless_lms_models::email_templates::EmailTemplateType;
use headless_lms_models::library::credit_registration::account_linking::{
    DiscoveredPerson, claim_linking_mails_batch,
};
use headless_lms_models::library::credit_registration::classification::map_code;
use headless_lms_models::library::credit_registration::fast_track::{
    FastTrackCandidate, FastTrackDecision, FastTrackLink, FastTrackLookup, RegistryName,
    decide_fast_track, find_fast_track_candidate, find_fast_track_candidates, link_by_email_match,
};
use headless_lms_models::library::credit_registration::outcomes::request_level_code;
use headless_lms_models::secret::DbSecret;
use headless_lms_models::verified_student_numbers;
use headless_lms_utils::error::util_error::UtilError;
use headless_lms_utils::prelude::BackendError;
use headless_lms_utils::prelude::Utc;
use headless_lms_utils::secret_string::expose_option;
use headless_lms_utils::services::suotar::{
    ListByCourseRequestItem, ListedPerson, SuotarCallContext, SuotarEndpoint, SuotarItemStatus,
    new_request_item_id,
};
use secrecy::ExposeSecret;
use serde_json::json;
use sqlx::{Connection, PgConnection};
use std::collections::{BTreeMap, HashMap, HashSet};

use super::{
    CreditRegistrationPhase, PhaseContext, PhaseScope, TemplateCache,
    every_item_service_unavailable, listed_person_addresses, suotar_error_variant,
    template_language,
};

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let endpoint = SuotarEndpoint::ListByCourse;
    let mut conn = ctx.pool.acquire().await?;
    let mut tx = conn.begin().await?;
    let claimed = claim_stalest_modules_for_listing(
        &mut tx,
        endpoint.max_batch_size() as i64,
        scope.course_id,
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
        for module in modules {
            let outcome = reconcile(ctx, &mut conn, module, &people).await?;
            record_listing_outcome(&mut conn, module.course_module_id, &outcome).await?;
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

/// Applies one module's roster and returns the counters its configuration row carries.
async fn reconcile(
    ctx: &PhaseContext<'_>,
    conn: &mut PgConnection,
    module: &ModuleToList,
    people: &[&ListedPerson],
) -> anyhow::Result<ModuleListingOutcome> {
    let mut outcome = ModuleListingOutcome {
        listed_person_count: i32::try_from(people.len()).unwrap_or(i32::MAX),
        ..ModuleListingOutcome::default()
    };
    let person_ids: Vec<String> = people
        .iter()
        .map(|person| person.person_id.expose_secret().to_owned())
        .collect();
    let linked = verified_student_numbers::get_by_sisu_person_ids(conn, &person_ids).await?;
    let linked_person_ids: HashSet<&str> = linked
        .iter()
        .map(|row| row.sisu_person_id.expose_secret())
        .collect();

    let mut fast_track = FastTrackRun::new(ctx, module);
    fast_track
        .resolve_accounts(
            conn,
            people
                .iter()
                .copied()
                .filter(|person| !linked_person_ids.contains(person.person_id.expose_secret())),
        )
        .await?;
    let mut discovered = Vec::new();
    for &person in people {
        if linked_person_ids.contains(person.person_id.expose_secret()) {
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

    // The fast way back for a row parked without an enrolment, which would otherwise wait out its
    // own daily recheck.
    let linked_user_ids: Vec<_> = linked.iter().map(|row| row.user_id).collect();
    if !linked_user_ids.is_empty() {
        recheck_no_usable_enrolment_now(conn, module.course_id, &linked_user_ids).await?;
    }
    Ok(outcome)
}

/// The fast track over one module's roster: the config it reads and the template lookup it caches,
/// so neither is repeated per person.
struct FastTrackRun<'a> {
    ctx: &'a PhaseContext<'a>,
    module: &'a ModuleToList,
    enabled: bool,
    max_verification_age: chrono::Duration,
    templates: TemplateCache,
    /// The account behind each person's registry address, resolved for the whole roster at once so
    /// only the few people a link is actually possible for cost a transaction.
    accounts: HashMap<String, FastTrackCandidate>,
}

impl<'a> FastTrackRun<'a> {
    fn new(ctx: &'a PhaseContext<'a>, module: &'a ModuleToList) -> Self {
        let conf = ctx.suotar_conf;
        Self {
            ctx,
            module,
            enabled: conf.fast_track_email_match_enabled,
            max_verification_age: chrono::Duration::days(
                conf.fast_track_max_email_verification_age_days.max(0),
            ),
            templates: TemplateCache::default(),
            accounts: HashMap::new(),
        }
    }

    async fn resolve_accounts<'p>(
        &mut self,
        conn: &mut PgConnection,
        people: impl Iterator<Item = &'p ListedPerson>,
    ) -> anyhow::Result<()> {
        if !self.enabled {
            return Ok(());
        }
        let wanted: Vec<FastTrackLookup> = people
            .filter_map(|person| {
                let primary_email = person.primary_email.as_ref()?.expose_secret().trim();
                (!primary_email.is_empty()).then(|| FastTrackLookup {
                    primary_email: DbSecret::new(primary_email),
                    sisu_person_id: person.person_id.clone().into(),
                })
            })
            .collect();
        self.accounts = find_fast_track_candidates(conn, &wanted).await?;
        Ok(())
    }

    fn decide(
        &self,
        candidate: Option<&FastTrackCandidate>,
        person: &ListedPerson,
    ) -> FastTrackDecision {
        decide_fast_track(
            candidate,
            RegistryName {
                first_names: expose_option(&person.first_names),
                last_name: expose_option(&person.last_name),
            },
            Utc::now(),
            self.max_verification_age,
        )
    }

    /// Whether the person was linked here, in which case no linking mail is owed. `false` for every
    /// other outcome, including the flag being off, and the caller carries on to the mail.
    async fn try_link(
        &mut self,
        conn: &mut PgConnection,
        person: &ListedPerson,
        outcome: &mut ModuleListingOutcome,
    ) -> anyhow::Result<bool> {
        if !self.enabled {
            return Ok(false);
        }
        // The registry's secondary address is self-entered, so anyone could name someone else's
        // account address there and be handed their student number.
        let Some(primary_email) = person
            .primary_email
            .as_ref()
            .map(|address| address.expose_secret().trim())
            .filter(|address| !address.is_empty())
        else {
            return Ok(false);
        };
        let decision = self.decide(self.accounts.get(person.person_id.expose_secret()), person);
        if decision != FastTrackDecision::Link {
            count_decision(outcome, decision);
            return Ok(false);
        }
        // One transaction, and the candidate query locks the account row: a profile edit landing
        // between reading the proof and writing the link would leave a link resting on an address
        // the account no longer holds. The decision is taken again under that lock, so the batch
        // above is only ever a way to skip the people no link is possible for.
        let mut tx = conn.begin().await?;
        let candidate =
            find_fast_track_candidate(&mut tx, primary_email, person.person_id.expose_secret())
                .await?;
        let decision = self.decide(candidate.as_ref(), person);
        count_decision(outcome, decision);
        let (FastTrackDecision::Link, Some(candidate)) = (decision, candidate) else {
            return Ok(false);
        };

        link_by_email_match(
            &mut tx,
            &FastTrackLink {
                student_number: person.student_number.clone().into(),
                sisu_person_id: person.person_id.clone().into(),
                first_names: person.first_names.clone().map(Into::into),
                last_name: person.last_name.clone().map(Into::into),
                course_id: self.module.course_id,
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
        let language = template_language(&self.module.course_language_code);
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
                "STUDENT_NUMBER": person.student_number.expose_secret(),
                "LINK": student_number_settings_url(self.ctx.base_url),
            }),
        )
        .await?;
        Ok(())
    }
}

/// Every fast-track outcome has a counter on the configuration row: the skips are what says whether
/// the flag is worth having on.
fn count_decision(outcome: &mut ModuleListingOutcome, decision: FastTrackDecision) {
    match decision {
        FastTrackDecision::NoAccountMatch => outcome.fast_track_skipped_no_account_count += 1,
        FastTrackDecision::UnverifiedAccount => outcome.fast_track_skipped_unverified_count += 1,
        FastTrackDecision::StaleVerification => {
            outcome.fast_track_skipped_stale_verification_count += 1
        }
        FastTrackDecision::NameMismatch => outcome.fast_track_skipped_name_mismatch_count += 1,
        FastTrackDecision::AccountHasStudentNumber => {
            outcome.fast_track_skipped_account_has_number_count += 1
        }
        FastTrackDecision::UnlinkedBefore => outcome.fast_track_skipped_unlinked_before_count += 1,
        FastTrackDecision::Link => outcome.fast_tracked_count += 1,
    }
}

/// Where the notice's "not you? unlink" link goes.
fn student_number_settings_url(base_url: &str) -> String {
    format!(
        "{}/user-settings/student-number",
        base_url.trim_end_matches('/')
    )
}

fn whole_request_failed(attempted: i32, error: &UtilError) -> PhaseRunOutcome {
    PhaseRunOutcome {
        items_processed: attempted,
        items_failed: attempted,
        error: Some(scrub_text(error.message())),
        is_sisu_outage: false,
    }
}
