//! What one code's roster does to the modules on it: waking linked students' registrations and
//! claiming linking mails for everybody else.

use std::collections::{HashMap, HashSet};

use headless_lms_models::course_module_suotar_configurations::{
    ModuleListingOutcome, ModuleToList, mark_listing_succeeded_without_linking,
    record_listing_outcome,
};
use headless_lms_models::library::credit_registration::account_linking::{
    DiscoveredPerson, claim_linking_mails_batch, listed_person_addresses,
};
use headless_lms_models::library::credit_registration::enrolment_checks::{
    RosterEnrolee, wake_for_roster_listing,
};
use headless_lms_models::library::credit_registration::study_registry::RosterPerson;
use headless_lms_models::verified_student_numbers::{self, VerifiedStudentNumber};
use headless_lms_utils::secret_string::expose_option;
use secrecy::ExposeSecret;
use sqlx::PgConnection;

use super::CodeListing;
use crate::error::CreditRegistrationResult;

/// Wakes and mails for one code's roster, module by module: mails and links are per course. Returns
/// the linking mails claimed across the listing's modules, for the caller's roster-fetch summary.
pub(super) async fn reconcile_roster(
    conn: &mut PgConnection,
    listing: &CodeListing,
    people: &[RosterPerson],
    is_account_linking_enabled: bool,
) -> CreditRegistrationResult<i32> {
    let distinct = distinct_people(people);
    let linked = linked_accounts(conn, &distinct).await?;
    let enrolees = roster_enrolees(people, &linked);
    let mut mailed_count = 0;
    for module in &listing.modules {
        if !enrolees.is_empty() {
            wake_for_roster_listing(conn, module.course_module_id, &enrolees).await?;
        }
        if is_account_linking_enabled {
            let outcome = claim_linking_mails(conn, module, &distinct, &linked).await?;
            mailed_count += outcome.mailed_count;
            record_listing_outcome(conn, module.course_module_id, &outcome).await?;
        } else {
            mark_listing_succeeded_without_linking(conn, module.course_module_id).await?;
        }
    }
    Ok(mailed_count)
}

/// A person enrolled on several realisations of the code is listed once per realisation; keeps the
/// most recent enrolment of each, one with no enrolment time counting as the oldest.
fn distinct_people(people: &[RosterPerson]) -> Vec<&RosterPerson> {
    let enrolled_at = |person: &RosterPerson| {
        person
            .enrolment
            .as_ref()
            .and_then(|enrolment| enrolment.enrolment_date_time)
    };
    let mut kept: Vec<&RosterPerson> = Vec::new();
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
    people: &[&RosterPerson],
) -> CreditRegistrationResult<Vec<VerifiedStudentNumber>> {
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
    people: &[RosterPerson],
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
    people: &[&RosterPerson],
    linked: &[VerifiedStudentNumber],
) -> CreditRegistrationResult<ModuleListingOutcome> {
    let (mut outcome, discovered) = linking_candidates(module, people, linked);
    if !discovered.is_empty() {
        for claimed in claim_linking_mails_batch(conn, &discovered).await? {
            outcome.mailed_count += claimed.claimed;
            outcome.suppressed_by_dedup_count += claimed.suppressed_by_dedup;
            outcome.suppressed_by_rate_cap_count += claimed.suppressed_by_rate_cap;
        }
    }
    Ok(outcome)
}

/// The people on one module's roster a linking mail may go to, and the counters of those it may
/// not: already linked, or with no address to mail.
fn linking_candidates(
    module: &ModuleToList,
    people: &[&RosterPerson],
    linked: &[VerifiedStudentNumber],
) -> (ModuleListingOutcome, Vec<DiscoveredPerson>) {
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
    (outcome, discovered)
}

#[cfg(test)]
mod tests {
    use chrono::{TimeDelta, Utc};
    use headless_lms_models::library::credit_registration::study_registry::RosterEnrolment;
    use headless_lms_models::secret::DbSecret;
    use headless_lms_models::verified_student_numbers::StudentNumberVerificationMethod;
    use secrecy::SecretString;
    use uuid::Uuid;

    use super::*;

    fn person(person_id: &str, student_number: &str, email: Option<&str>) -> RosterPerson {
        RosterPerson {
            student_number: SecretString::from(student_number),
            person_id: SecretString::from(person_id),
            first_names: None,
            last_name: None,
            primary_email: email.map(SecretString::from),
            secondary_email: None,
            enrolment: None,
        }
    }

    fn enrolled(person: RosterPerson, enrolment_id: &str, days_ago: i64) -> RosterPerson {
        RosterPerson {
            enrolment: Some(RosterEnrolment {
                id: Some(enrolment_id.to_string()),
                course_unit_realisation_id: None,
                state: None,
                enrolment_date_time: Some(Utc::now() - TimeDelta::days(days_ago)),
            }),
            ..person
        }
    }

    fn link(student_number: &str, person_id: Option<&str>) -> VerifiedStudentNumber {
        let now = Utc::now();
        VerifiedStudentNumber {
            id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
            deleted_at: None,
            user_id: Uuid::new_v4(),
            student_number: DbSecret::new(student_number),
            sisu_person_id: person_id.map(DbSecret::new),
            first_names: None,
            last_name: None,
            verified_at: now,
            verified_via: StudentNumberVerificationMethod::EmailedLink,
            verified_via_email: None,
            linked_by_user_id: None,
            link_reason: None,
            verified_from_course_id: None,
        }
    }

    fn module() -> ModuleToList {
        ModuleToList {
            course_module_id: Uuid::new_v4(),
            course_id: Uuid::new_v4(),
            uh_course_code: "TKT1".to_string(),
            course_language_code: "fi".to_string(),
        }
    }

    #[test]
    fn a_person_on_several_realisations_is_kept_once_with_the_latest_enrolment() {
        let people = [
            enrolled(person("p1", "1", None), "old", 10),
            person("p2", "2", None),
            enrolled(person("p1", "1", None), "new", 1),
            enrolled(person("p1", "1", None), "older", 20),
        ];
        let kept: Vec<_> = distinct_people(&people)
            .iter()
            .map(|person| {
                (
                    person.person_id.expose_secret().to_string(),
                    person
                        .enrolment
                        .as_ref()
                        .and_then(|enrolment| enrolment.id.clone()),
                )
            })
            .collect();
        assert_eq!(
            kept,
            [
                ("p1".to_string(), Some("new".to_string())),
                ("p2".to_string(), None)
            ]
        );
    }

    #[test]
    fn a_linked_account_wakes_with_every_enrolment_it_is_listed_under() {
        let people = [
            enrolled(person("p1", "1", None), "e1", 2),
            enrolled(person("p1", "1", None), "e2", 1),
            enrolled(person("p2", "2", None), "e3", 1),
        ];
        let by_person_id = link("1", Some("p1"));
        let by_number_only = link("2", None);
        let unlisted = link("9", Some("p9"));
        let enrolees = roster_enrolees(
            &people,
            &[by_person_id.clone(), by_number_only.clone(), unlisted],
        );
        let woken: Vec<_> = enrolees
            .iter()
            .map(|enrolee| (enrolee.user_id, enrolee.enrolment_ids.clone()))
            .collect();
        assert_eq!(
            woken,
            [
                (
                    by_person_id.user_id,
                    vec!["e1".to_string(), "e2".to_string()]
                ),
                (by_number_only.user_id, vec!["e3".to_string()]),
            ]
        );
    }

    #[test]
    fn only_unlinked_people_with_an_address_are_mailed() {
        let people = [
            person("p1", "1", Some("linked-by-id@example.com")),
            person("p2", "2", Some("linked-by-number@example.com")),
            person("p3", "3", None),
            person("p4", "4", Some("  ")),
            person("p5", "5", Some("new@example.com")),
        ];
        let listed: Vec<&RosterPerson> = people.iter().collect();
        let module = module();
        let (outcome, discovered) = linking_candidates(
            &module,
            &listed,
            &[link("other", Some("p1")), link("2", None)],
        );
        assert_eq!(
            outcome,
            ModuleListingOutcome {
                listed_person_count: 5,
                already_linked_count: 2,
                no_address_count: 2,
                ..ModuleListingOutcome::default()
            }
        );
        assert_eq!(discovered.len(), 1);
        assert_eq!(discovered[0].sisu_person_id.expose_secret(), "p5");
        assert_eq!(discovered[0].course_id, module.course_id);
        assert_eq!(discovered[0].addresses.len(), 1);
    }
}
