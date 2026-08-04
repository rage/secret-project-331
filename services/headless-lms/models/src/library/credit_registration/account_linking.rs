//! Claiming the right to mail a Sisu person an account-linking link, and minting the token it
//! carries. Both caps and the dedup guard are evaluated here and nowhere else, and no argument
//! switches them off; an override has to soft-delete a ledger row.
//!
//! The token is minted bound to no account: the recipient's Sisu address is routinely not the
//! address on their account here, so the click while logged in is what creates the binding.

use std::collections::HashMap;

use crate::credit_registration_account_linking_emails::{
    ExistingLinkingMailFact, NewAccountLinkingEmail, claim_send_slots,
    get_existing_facts_for_persons,
};
use crate::prelude::*;
use crate::student_number_verification_tokens::{
    NewStudentNumberVerificationToken, insert as insert_token,
};

/// Both the mailed URL and the frontend route that serves it are built from this one value.
pub const LINK_STUDENT_NUMBER_PATH: &str = "/link-student-number";

/// The link the mail carries: a bearer credential, whoever holds it can claim the student number.
pub fn link_student_number_url(base_url: &str, token: &str) -> String {
    format!(
        "{}{LINK_STUDENT_NUMBER_PATH}/{token}",
        base_url.trim_end_matches('/')
    )
}

/// How long after a linking mail the person is left alone, across every course and address.
pub const LINKING_MAIL_QUIET_PERIOD_SECS: i64 = 24 * 60 * 60;

/// How many linking mails one person may ever get for one course, tokens that expired unused
/// included.
pub const MAX_LINKING_MAILS_PER_PERSON_AND_COURSE: i64 = 3;

/// One person Sisu's `list-by-course` returned, and every address we could reach them at.
#[derive(Debug, Clone, PartialEq)]
pub struct DiscoveredPerson {
    pub sisu_person_id: String,
    pub student_number: String,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
    pub course_id: Uuid,
    /// Each address gets its own mail and its own token: we cannot tell which one they read.
    pub addresses: Vec<String>,
}

/// The three buckets are disjoint and sum to the addresses tried.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct ClaimedLinkingMails {
    pub claimed: i32,
    pub suppressed_by_dedup: i32,
    pub suppressed_by_rate_cap: i32,
}

/// One person's [`claim_linking_mails_batch`].
pub async fn claim_linking_mails(
    conn: &mut PgConnection,
    person: &DiscoveredPerson,
) -> ModelResult<ClaimedLinkingMails> {
    Ok(
        claim_linking_mails_batch(conn, std::slice::from_ref(person))
            .await?
            .into_iter()
            .next()
            .unwrap_or_default(),
    )
}

/// Claims one slot and one unbound token per person and address, dedup before rate cap and the
/// allowance spent left to right. Returns one outcome per input, in order; a claimed slot means a
/// mail the `link-emails` phase still owes.
pub async fn claim_linking_mails_batch(
    conn: &mut PgConnection,
    people: &[DiscoveredPerson],
) -> ModelResult<Vec<ClaimedLinkingMails>> {
    let mut outcomes = vec![ClaimedLinkingMails::default(); people.len()];
    let per_person_addresses: Vec<Vec<String>> = people
        .iter()
        .map(|person| distinct_addresses(&person.addresses))
        .collect();

    let sisu_person_ids: Vec<String> = people
        .iter()
        .enumerate()
        .filter(|(i, _)| !per_person_addresses[*i].is_empty())
        .map(|(_, person)| person.sisu_person_id.clone())
        .collect();
    if sisu_person_ids.is_empty() {
        return Ok(outcomes);
    }
    let facts = get_existing_facts_for_persons(conn, &sisu_person_ids).await?;
    let mut by_person: HashMap<&str, Vec<&ExistingLinkingMailFact>> = HashMap::new();
    for fact in &facts {
        by_person
            .entry(fact.sisu_person_id.as_str())
            .or_default()
            .push(fact);
    }
    let quiet_since = Utc::now() - chrono::Duration::seconds(LINKING_MAIL_QUIET_PERIOD_SECS);

    let mut to_claim: Vec<(usize, String)> = Vec::new();
    for (i, person) in people.iter().enumerate() {
        if per_person_addresses[i].is_empty() {
            continue;
        }
        let person_facts = by_person
            .get(person.sisu_person_id.as_str())
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        let mut allowance = remaining_allowance(person, person_facts, quiet_since);
        for address in &per_person_addresses[i] {
            if already_mailed(person_facts, person.course_id, address) {
                outcomes[i].suppressed_by_dedup += 1;
                continue;
            }
            if allowance == 0 {
                outcomes[i].suppressed_by_rate_cap += 1;
                continue;
            }
            allowance -= 1;
            to_claim.push((i, address.clone()));
        }
    }
    if to_claim.is_empty() {
        return Ok(outcomes);
    }

    // Tokens are minted before any slot is claimed: the random value cannot come from SQL.
    let mut new_slots = Vec::with_capacity(to_claim.len());
    let mut token_owner: HashMap<Uuid, usize> = HashMap::new();
    for (person_index, address) in &to_claim {
        let person = &people[*person_index];
        let token_id = Uuid::new_v4();
        insert_token(
            conn,
            PKeyPolicy::Fixed(token_id),
            &NewStudentNumberVerificationToken {
                student_number: person.student_number.clone(),
                sisu_person_id: person.sisu_person_id.clone(),
                first_names: person.first_names.clone(),
                last_name: person.last_name.clone(),
                emailed_to: address.clone(),
                course_id: Some(person.course_id),
            },
        )
        .await?;
        token_owner.insert(token_id, *person_index);
        new_slots.push(NewAccountLinkingEmail {
            student_number: person.student_number.clone(),
            sisu_person_id: person.sisu_person_id.clone(),
            course_id: person.course_id,
            emailed_to: address.clone(),
            student_number_verification_token_id: Some(token_id),
            email_delivery_id: None,
        });
    }

    let claimed_token_ids = claim_send_slots(conn, &new_slots).await?;
    let lost_token_ids: Vec<Uuid> = token_owner
        .keys()
        .filter(|id| !claimed_token_ids.contains(id))
        .copied()
        .collect();
    // A refused claim must leave no usable token behind: nobody would ever send that link.
    void_tokens(conn, &lost_token_ids).await?;
    for (token_id, person_index) in &token_owner {
        if claimed_token_ids.contains(token_id) {
            outcomes[*person_index].claimed += 1;
        } else {
            // Lost the race to another writer; same outcome for the recipient as dedup.
            outcomes[*person_index].suppressed_by_dedup += 1;
        }
    }
    Ok(outcomes)
}

/// How many mails the caps still allow this person for this course.
fn remaining_allowance(
    person: &DiscoveredPerson,
    facts: &[&ExistingLinkingMailFact],
    quiet_since: DateTime<Utc>,
) -> i64 {
    // The quiet period is about the person's inbox, so it ignores the course.
    if facts.iter().any(|fact| fact.sent_at >= quiet_since) {
        return 0;
    }
    let already_sent = facts
        .iter()
        .filter(|fact| fact.course_id == person.course_id)
        .count() as i64;
    (MAX_LINKING_MAILS_PER_PERSON_AND_COURSE - already_sent).max(0)
}

/// Whether this (person, course, address) already had its mail. The unique index behind
/// [`claim_send_slots`] is what actually prevents a second one.
fn already_mailed(facts: &[&ExistingLinkingMailFact], course_id: Uuid, address: &str) -> bool {
    facts
        .iter()
        .any(|fact| fact.course_id == course_id && fact.emailed_to.eq_ignore_ascii_case(address))
}

/// Soft-deletes tokens whose slot lost the race, so no unusable link is left behind.
async fn void_tokens(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
    if ids.is_empty() {
        return Ok(());
    }
    sqlx::query!(
        r#"
UPDATE student_number_verification_tokens
SET deleted_at = now()
WHERE id = ANY($1::uuid [])
  AND deleted_at IS NULL
        "#,
        ids,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Sisu can list one address twice and the dedup key is case-insensitive, so the pair is collapsed
/// before either is charged against a cap.
fn distinct_addresses(addresses: &[String]) -> Vec<String> {
    let mut kept: Vec<String> = Vec::new();
    for address in addresses {
        let trimmed = address.trim();
        if trimmed.is_empty() {
            continue;
        }
        if kept.iter().any(|seen| seen.eq_ignore_ascii_case(trimmed)) {
            continue;
        }
        kept.push(trimmed.to_string());
    }
    kept
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::credit_registration_account_linking_emails::get_by_sisu_person_id;
    use crate::student_number_verification_tokens::{claim, get_by_ids};
    use crate::test_helper::*;

    fn person(course_id: Uuid, addresses: &[&str]) -> DiscoveredPerson {
        DiscoveredPerson {
            sisu_person_id: "hy-hlo-1".to_string(),
            student_number: "012345678".to_string(),
            first_names: Some("Aada Maria".to_string()),
            last_name: Some("Virtanen".to_string()),
            course_id,
            addresses: addresses.iter().map(|a| a.to_string()).collect(),
        }
    }

    #[tokio::test]
    async fn each_address_of_a_person_gets_its_own_mail_and_token() {
        insert_data!(:tx, :user, :org, :course);
        let claimed = claim_linking_mails(
            tx.as_mut(),
            &person(course, &["aada@helsinki.fi", "aada@example.com"]),
        )
        .await
        .unwrap();
        assert_eq!(claimed.claimed, 2);
        assert_eq!(claimed.suppressed_by_dedup, 0);
        let rows = get_by_sisu_person_id(tx.as_mut(), "hy-hlo-1")
            .await
            .unwrap();
        assert_eq!(rows.len(), 2);
        for row in rows {
            assert!(row.student_number_verification_token_id.is_some());
            assert!(row.email_delivery_id.is_none());
        }
    }

    #[tokio::test]
    async fn one_address_repeated_is_claimed_once() {
        insert_data!(:tx, :user, :org, :course);
        let claimed = claim_linking_mails(
            tx.as_mut(),
            &person(course, &["Aada@Helsinki.fi", "aada@helsinki.fi", "  "]),
        )
        .await
        .unwrap();
        assert_eq!(claimed.claimed, 1);
        assert_eq!(claimed.suppressed_by_rate_cap, 0);
    }

    #[tokio::test]
    async fn mailing_the_same_address_twice_is_refused_as_a_duplicate() {
        insert_data!(:tx, :user, :org, :course);
        let discovered = person(course, &["aada@helsinki.fi"]);
        assert_eq!(
            claim_linking_mails(tx.as_mut(), &discovered).await.unwrap(),
            ClaimedLinkingMails {
                claimed: 1,
                ..ClaimedLinkingMails::default()
            }
        );
        assert_eq!(
            claim_linking_mails(tx.as_mut(), &discovered).await.unwrap(),
            ClaimedLinkingMails {
                suppressed_by_dedup: 1,
                ..ClaimedLinkingMails::default()
            }
        );
        assert_eq!(
            get_by_sisu_person_id(tx.as_mut(), "hy-hlo-1")
                .await
                .unwrap()
                .len(),
            1
        );
    }

    #[tokio::test]
    async fn a_person_mailed_today_is_left_alone_even_at_another_address() {
        insert_data!(:tx, :user, :org, :course);
        claim_linking_mails(tx.as_mut(), &person(course, &["aada@helsinki.fi"]))
            .await
            .unwrap();
        let claimed = claim_linking_mails(tx.as_mut(), &person(course, &["aada@example.com"]))
            .await
            .unwrap();
        assert_eq!(
            claimed,
            ClaimedLinkingMails {
                suppressed_by_rate_cap: 1,
                ..ClaimedLinkingMails::default()
            }
        );
    }

    #[tokio::test]
    async fn a_person_and_course_are_never_mailed_more_than_the_cap() {
        insert_data!(:tx, :user, :org, :course);
        let cap = usize::try_from(MAX_LINKING_MAILS_PER_PERSON_AND_COURSE).unwrap();
        let addresses: Vec<String> = (0..cap + 2)
            .map(|i| format!("aada{i}@example.com"))
            .collect();
        let claimed = claim_linking_mails(
            tx.as_mut(),
            &DiscoveredPerson {
                addresses,
                ..person(course, &[])
            },
        )
        .await
        .unwrap();
        assert_eq!(
            i64::from(claimed.claimed),
            MAX_LINKING_MAILS_PER_PERSON_AND_COURSE
        );
        assert_eq!(claimed.suppressed_by_rate_cap, 2);
    }

    #[tokio::test]
    async fn the_token_is_created_unbound_and_can_be_claimed_only_once() {
        insert_data!(:tx, :user, :org, :course);
        claim_linking_mails(tx.as_mut(), &person(course, &["aada@helsinki.fi"]))
            .await
            .unwrap();
        let slot = get_by_sisu_person_id(tx.as_mut(), "hy-hlo-1")
            .await
            .unwrap()
            .pop()
            .expect("the claim wrote a slot");
        let token_id = slot.student_number_verification_token_id.unwrap();
        let token = get_by_ids(tx.as_mut(), &[token_id])
            .await
            .unwrap()
            .remove(&token_id)
            .expect("the claim minted a token");
        assert_eq!(token.claimed_by_user_id, None);
        assert_eq!(token.used_at, None);
        assert!(token.expires_at > Utc::now());

        assert!(claim(tx.as_mut(), &token.token, user).await.unwrap());
        assert!(!claim(tx.as_mut(), &token.token, user).await.unwrap());
    }
}
