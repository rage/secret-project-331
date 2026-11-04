//! Claiming the right to mail a Sisu person an account-linking link, and minting the token it
//! carries. Both caps and the dedup guard are evaluated here and nowhere else, and no argument
//! switches them off; an override has to soft-delete a ledger row.
//!
//! The token is minted bound to no account: the recipient's Sisu address is routinely not the
//! address on their account here, so the click while logged in is what creates the binding.

use std::collections::{BTreeSet, HashMap};

use chrono::TimeDelta;
use secrecy::ExposeSecret;

use crate::credit_registration_account_linking_emails::{
    self, ExistingLinkingMailFact, NewAccountLinkingEmail, claim_send_slots,
    get_existing_facts_for_persons, replace_lapsed_slots,
};
use crate::credit_registration_admin_actions::{
    CreditRegistrationAdminAction, CreditRegistrationAdminActionTarget,
    NewCreditRegistrationAdminAction,
};
use crate::error::missing_model_error;
use crate::prelude::*;
use crate::student_number_verification_tokens::{
    NewStudentNumberVerificationToken, insert_batch as insert_tokens_batch,
};

use super::study_registry::RosterPerson;

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
pub const LINKING_MAIL_QUIET_PERIOD: TimeDelta = TimeDelta::days(1);

/// How long after a linking mail for a course the same person may get another for it.
pub const LINKING_MAIL_RESEND_INTERVAL: TimeDelta = TimeDelta::days(7);

/// How many linking mails one person may ever get for one course, tokens that expired unused
/// included.
pub const MAX_LINKING_MAILS_PER_PERSON_AND_COURSE: i64 = 3;

/// No override retires a mail claimed this recently, so a second click, tab or colleague cannot
/// replace one that has only just gone out.
pub const JUST_CLAIMED_PERIOD: TimeDelta = TimeDelta::minutes(1);

/// What [`retire_capped_mails`] did.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RetiredMails {
    pub retired_count: i64,
    /// A mail within [`JUST_CLAIMED_PERIOD`] was left in place, where the caps still count it.
    pub kept_just_claimed: bool,
}

/// One person Sisu's `list-by-course` returned, and the address we mail them at.
#[derive(Debug, Clone)]
pub struct DiscoveredPerson {
    pub sisu_person_id: DbSecret,
    pub student_number: DbSecret,
    pub first_names: Option<DbSecret>,
    pub last_name: Option<DbSecret>,
    pub course_id: Uuid,
    /// The one address in Sisu we mail, trimmed: each address mailed would spend one of the
    /// person's mails for the course. See [`mail_address`].
    pub address: Option<DbSecret>,
}

impl DiscoveredPerson {
    /// `person` as listed on a roster of `course_id`'s; the caller decides what a missing address
    /// means.
    pub fn listed(person: &RosterPerson, course_id: Uuid) -> Self {
        Self {
            sisu_person_id: person.person_id.clone().into(),
            student_number: person.student_number.clone().into(),
            first_names: person.first_names.clone().map(Into::into),
            last_name: person.last_name.clone().map(Into::into),
            course_id,
            address: mail_address(person),
        }
    }
}

/// The address a linking mail to `person` goes to, if Sisu holds one: the primary, else the
/// secondary.
///
/// Sisu verifies neither, so the confirmation page shows the Sisu name to make a planted address
/// harder to exploit. Open University students without a University account often have only a
/// secondary address, and Sisu clears old primaries.
pub fn mail_address(person: &RosterPerson) -> Option<DbSecret> {
    listed_addresses(person).next().map(DbSecret::new)
}

/// The person's non-empty Sisu addresses, trimmed, primary first.
pub fn listed_addresses(person: &RosterPerson) -> impl Iterator<Item = &str> {
    [&person.primary_email, &person.secondary_email]
        .into_iter()
        .flatten()
        .map(|address| address.expose_secret().trim())
        .filter(|address| !address.is_empty())
}

/// For each of the lowercased `addresses` that is the account email of someone with a completion
/// the push path will register (`credit_registration_eligible_completions`, prerequisites met and
/// not held for review) on one of `course_ids` created at or after `since`, the courses it is on.
pub async fn registerable_completion_courses_by_account_email(
    conn: &mut PgConnection,
    course_ids: &[Uuid],
    since: DateTime<Utc>,
    addresses: &[String],
) -> ModelResult<HashMap<String, BTreeSet<Uuid>>> {
    let rows = sqlx::query!(
        r#"
SELECT DISTINCT lower(user_details.email) AS "email!",
  ec.course_id AS "course_id!"
FROM credit_registration_eligible_completions ec
  JOIN user_details ON user_details.user_id = ec.user_id
WHERE ec.course_id = ANY($1::uuid [])
  AND ec.created_at >= $2
  AND ec.fully_eligible
  AND lower(user_details.email) = ANY($3::text [])
        "#,
        course_ids,
        since,
        addresses,
    )
    .fetch_all(conn)
    .await?;
    let mut courses_by_email: HashMap<String, BTreeSet<Uuid>> = HashMap::new();
    for row in rows {
        courses_by_email
            .entry(row.email)
            .or_default()
            .insert(row.course_id);
    }
    Ok(courses_by_email)
}

/// What claiming a linking mail did for one person. Ordered from weakest to strongest, so the
/// strongest of several claims for one person is their maximum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum LinkingMailClaim {
    NoAddress,
    SuppressedByRateCap,
    /// An earlier mail to the address still has a usable link, or another writer claimed it first.
    SuppressedByDedup,
    /// A mail the `link-emails` phase still owes.
    Claimed,
}

/// One person's [`claim_linking_mails_batch`].
pub async fn claim_linking_mail(
    conn: &mut PgConnection,
    person: &DiscoveredPerson,
) -> ModelResult<LinkingMailClaim> {
    claim_linking_mails_batch(conn, std::slice::from_ref(person))
        .await?
        .into_iter()
        .next()
        .ok_or_else(missing_model_error(
            ModelErrorType::Generic,
            "Claiming linking mails answered nothing for the one person asked about.",
        ))
}

/// Claims one slot and one unbound token per person whose address has no usable link from us yet,
/// dedup before the rate caps. Returns one claim per input, in order.
pub async fn claim_linking_mails_batch(
    conn: &mut PgConnection,
    people: &[DiscoveredPerson],
) -> ModelResult<Vec<LinkingMailClaim>> {
    let mut claims = vec![LinkingMailClaim::NoAddress; people.len()];
    let sisu_person_ids: Vec<String> = people
        .iter()
        .filter(|person| person.address.is_some())
        .map(|person| person.sisu_person_id.expose_secret().to_owned())
        .collect();
    if sisu_person_ids.is_empty() {
        return Ok(claims);
    }
    let facts = get_existing_facts_for_persons(conn, &sisu_person_ids).await?;
    let mut by_person: HashMap<&str, Vec<&ExistingLinkingMailFact>> = HashMap::new();
    for fact in &facts {
        by_person
            .entry(fact.sisu_person_id.expose_secret())
            .or_default()
            .push(fact);
    }
    let now = Utc::now();

    // Tokens are minted before any slot is claimed: the random value cannot come from SQL.
    let mut new_tokens = Vec::new();
    let mut new_slots = Vec::new();
    let mut token_ids = Vec::new();
    let mut token_owner: HashMap<Uuid, usize> = HashMap::new();
    for (i, person) in people.iter().enumerate() {
        let Some(address) = &person.address else {
            continue;
        };
        let person_facts = by_person
            .get(person.sisu_person_id.expose_secret())
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        if holds_address(person_facts, person.course_id, address.expose_secret()) {
            claims[i] = LinkingMailClaim::SuppressedByDedup;
            continue;
        }
        if !is_within_caps(person, person_facts, now) {
            claims[i] = LinkingMailClaim::SuppressedByRateCap;
            continue;
        }
        let token_id = Uuid::new_v4();
        new_tokens.push(NewStudentNumberVerificationToken {
            student_number: person.student_number.clone(),
            sisu_person_id: person.sisu_person_id.clone(),
            first_names: person.first_names.clone(),
            last_name: person.last_name.clone(),
            emailed_to: address.clone(),
            course_id: Some(person.course_id),
        });
        token_owner.insert(token_id, i);
        token_ids.push(token_id);
        new_slots.push(NewAccountLinkingEmail {
            student_number: person.student_number.clone(),
            sisu_person_id: person.sisu_person_id.clone(),
            course_id: person.course_id,
            emailed_to: address.clone(),
            student_number_verification_token_id: Some(token_id),
            email_delivery_id: None,
        });
    }
    if new_slots.is_empty() {
        return Ok(claims);
    }
    insert_tokens_batch(conn, &token_ids, &new_tokens).await?;

    replace_lapsed_slots(conn, &new_slots).await?;
    let claimed_token_ids = claim_send_slots(conn, &new_slots, &token_ids).await?;
    let lost_token_ids: Vec<Uuid> = token_owner
        .keys()
        .filter(|id| !claimed_token_ids.contains(id))
        .copied()
        .collect();
    // A refused claim must leave no usable token behind: nobody would ever send that link.
    void_tokens(conn, &lost_token_ids).await?;
    for (token_id, person_index) in &token_owner {
        claims[*person_index] = if claimed_token_ids.contains(token_id) {
            LinkingMailClaim::Claimed
        } else {
            // Lost the race to another writer; same outcome for the recipient as dedup.
            LinkingMailClaim::SuppressedByDedup
        };
    }
    Ok(claims)
}

/// Retires the linking-mail rows the caps are counting for this person, so the ordinary claim path can
/// take a slot again. No parameter relaxes a cap: the single writer of the ledger evaluates them from
/// the rows that exist, so getting past one means soft-deleting rows, audited as its own action.
pub async fn retire_capped_mails(
    conn: &mut PgConnection,
    actor_user_id: Uuid,
    actor_role: &str,
    course_id: Uuid,
    student_number: &str,
    reason: &str,
) -> ModelResult<RetiredMails> {
    let mut outcome = RetiredMails {
        retired_count: 0,
        kept_just_claimed: false,
    };
    let Some(person_id) = person_id_of_mails(conn, course_id, student_number).await? else {
        return Ok(outcome);
    };
    let now = Utc::now();
    let quiet_since = now - LINKING_MAIL_QUIET_PERIOD;
    let mails = credit_registration_account_linking_emails::get_by_sisu_person_id(
        conn,
        person_id.expose_secret(),
    )
    .await?;
    // This course's rows carry the dedup guard and the lifetime cap; a recent row on any course
    // carries the quiet period, which is about the person's inbox rather than one course.
    let (just_claimed, retirable): (Vec<_>, Vec<_>) = mails
        .iter()
        .filter(|mail| mail.course_id == course_id || mail.sent_at >= quiet_since)
        .partition(|mail| mail.sent_at >= now - JUST_CLAIMED_PERIOD);
    outcome.kept_just_claimed = !just_claimed.is_empty();
    let retired: Vec<Uuid> = retirable.iter().map(|mail| mail.id).collect();
    if retired.is_empty() {
        return Ok(outcome);
    }

    let mut tx = conn.begin().await?;
    credit_registration_account_linking_emails::soft_delete_batch(&mut tx, &retired).await?;
    crate::credit_registration_admin_actions::record(
        &mut tx,
        &NewCreditRegistrationAdminAction {
            target_id: Some(course_id),
            reason: Some(reason.to_string()),
            details: Some(serde_json::json!({
                "student_number": student_number,
                "retired_linking_email_ids": retired,
            })),
            affected_row_count: Some(i32::try_from(retired.len()).unwrap_or(i32::MAX)),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::OverrideRateCap,
                CreditRegistrationAdminActionTarget::Course,
                actor_user_id,
                actor_role,
            )
        },
    )
    .await?;
    tx.commit().await?;
    outcome.retired_count = retired.len() as i64;
    Ok(outcome)
}

async fn person_id_of_mails(
    conn: &mut PgConnection,
    course_id: Uuid,
    student_number: &str,
) -> ModelResult<Option<DbSecret>> {
    let mails = credit_registration_account_linking_emails::get_by_course_id_and_student_number(
        conn,
        course_id,
        student_number,
    )
    .await?;
    Ok(mails.into_iter().next().map(|mail| mail.sisu_person_id))
}

/// Whether the caps still allow this person another mail for this course.
fn is_within_caps(
    person: &DiscoveredPerson,
    facts: &[&ExistingLinkingMailFact],
    now: DateTime<Utc>,
) -> bool {
    // The quiet period is about the person's inbox, so it ignores the course.
    if facts
        .iter()
        .any(|fact| fact.sent_at >= now - LINKING_MAIL_QUIET_PERIOD)
    {
        return false;
    }
    let course_facts: Vec<_> = facts
        .iter()
        .filter(|fact| fact.course_id == person.course_id)
        .collect();
    !course_facts
        .iter()
        .any(|fact| fact.sent_at >= now - LINKING_MAIL_RESEND_INTERVAL)
        && (course_facts.len() as i64) < MAX_LINKING_MAILS_PER_PERSON_AND_COURSE
}

/// Whether a mail to this (person, course, address) still holds the address. The unique index
/// behind [`claim_send_slots`] is what actually prevents a second one.
fn holds_address(facts: &[&ExistingLinkingMailFact], course_id: Uuid, address: &str) -> bool {
    facts.iter().any(|fact| {
        fact.holds_address
            && fact.course_id == course_id
            && fact
                .emailed_to
                .expose_secret()
                .eq_ignore_ascii_case(address)
    })
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::credit_registration_account_linking_emails::{
        count_sent_for_person_and_course, get_by_sisu_person_id,
    };
    use crate::credit_registration_admin_actions::{self, GLOBAL_ADMIN_ROLE};
    use crate::student_number_verification_tokens::{claim, get_by_ids};
    use crate::test_helper::*;

    fn person(course_id: Uuid, address: &str) -> DiscoveredPerson {
        DiscoveredPerson {
            sisu_person_id: "hy-hlo-1".to_string().into(),
            student_number: "012345678".to_string().into(),
            first_names: Some("Aada Maria".to_string().into()),
            last_name: Some("Virtanen".to_string().into()),
            course_id,
            address: Some(DbSecret::new(address)),
        }
    }

    #[tokio::test]
    async fn mailing_the_same_address_twice_is_refused_as_a_duplicate() {
        insert_data!(:tx, :user, :org, :course);
        let discovered = person(course, "aada.uni@example.com");
        assert_eq!(
            claim_linking_mail(tx.as_mut(), &discovered).await.unwrap(),
            LinkingMailClaim::Claimed
        );
        assert_eq!(
            claim_linking_mail(tx.as_mut(), &discovered).await.unwrap(),
            LinkingMailClaim::SuppressedByDedup
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
        claim_linking_mail(tx.as_mut(), &person(course, "aada.uni@example.com"))
            .await
            .unwrap();
        let claimed = claim_linking_mail(tx.as_mut(), &person(course, "aada@example.com"))
            .await
            .unwrap();
        assert_eq!(claimed, LinkingMailClaim::SuppressedByRateCap);
    }

    #[tokio::test]
    async fn the_token_is_created_unbound_and_can_be_claimed_only_once() {
        insert_data!(:tx, :user, :org, :course);
        claim_linking_mail(tx.as_mut(), &person(course, "aada.uni@example.com"))
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

    #[tokio::test]
    async fn the_rate_cap_override_retires_the_ledger_rows_and_audits_itself() {
        insert_data!(:tx, :user, :org, :course);

        let claimed = claim_linking_mail(tx.as_mut(), &person(course, "aada.uni@example.com"))
            .await
            .unwrap();
        assert_eq!(claimed, LinkingMailClaim::Claimed);
        assert_eq!(
            count_sent_for_person_and_course(tx.as_mut(), "hy-hlo-1", course)
                .await
                .unwrap(),
            1
        );
        let mails = credit_registration_account_linking_emails::get_by_sisu_person_id(
            tx.as_mut(),
            "hy-hlo-1",
        )
        .await
        .unwrap();
        for mail in mails {
            credit_registration_account_linking_emails::backdate(
                tx.as_mut(),
                mail.id,
                chrono::Duration::hours(1),
            )
            .await
            .unwrap();
        }

        let retired = retire_capped_mails(
            tx.as_mut(),
            user,
            GLOBAL_ADMIN_ROLE,
            course,
            "012345678",
            "The recipient's mail host rejects everything we send.",
        )
        .await
        .unwrap();
        assert_eq!(retired.retired_count, 1);
        assert_eq!(
            count_sent_for_person_and_course(tx.as_mut(), "hy-hlo-1", course)
                .await
                .unwrap(),
            0
        );

        let actions = credit_registration_admin_actions::get_by_actor(tx.as_mut(), user, 10)
            .await
            .unwrap();
        assert_eq!(actions.len(), 1);
        let action = &actions[0];
        assert_eq!(
            action.action,
            CreditRegistrationAdminAction::OverrideRateCap
        );
        assert_eq!(action.actor_role, GLOBAL_ADMIN_ROLE);
        assert_eq!(
            action.reason.as_deref(),
            Some("The recipient's mail host rejects everything we send.")
        );
        assert_eq!(action.affected_row_count, Some(1));
    }

    #[tokio::test]
    async fn an_override_with_nothing_to_retire_writes_nothing() {
        insert_data!(:tx, :user, :org, :course);

        let retired = retire_capped_mails(
            tx.as_mut(),
            user,
            GLOBAL_ADMIN_ROLE,
            course,
            "012345678",
            "No mails yet.",
        )
        .await
        .unwrap();
        assert_eq!(retired.retired_count, 0);
        assert!(
            credit_registration_admin_actions::get_by_actor(tx.as_mut(), user, 10)
                .await
                .unwrap()
                .is_empty()
        );
    }
}
