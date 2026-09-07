//! Dedup ledger for account-linking mails.
//!
//! Keyed on the Sisu person id plus the recipient address: at send time there is no account of ours
//! to key on, and the student number changes when a student moves between programmes. A row is
//! written when the right to mail is claimed, before a delivery exists, so a crash between the two
//! phases cannot mail twice.
use std::collections::{HashMap, HashSet};

use utoipa::ToSchema;

use crate::email_deliveries::{
    EmailSendStatus, EmailSendStatusFacts, EmailSendStatusReport, derive_email_send_status,
    get_send_statuses, is_hard_send_failure,
};
use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationAccountLinkingEmail {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub student_number: String,
    pub sisu_person_id: String,
    pub course_id: Uuid,
    pub emailed_to: String,
    pub student_number_verification_token_id: Option<Uuid>,
    pub email_delivery_id: Option<Uuid>,
    pub sent_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewAccountLinkingEmail {
    pub student_number: String,
    pub sisu_person_id: String,
    pub course_id: Uuid,
    pub emailed_to: String,
    pub student_number_verification_token_id: Option<Uuid>,
    pub email_delivery_id: Option<Uuid>,
}

/// Claims the right to mail this (person, course, address) once; `None` means the caller must not
/// send. Call in the transaction that mints the token, so a refused claim leaves no usable link.
pub async fn claim_send_slot(
    conn: &mut PgConnection,
    new: &NewAccountLinkingEmail,
) -> ModelResult<Option<Uuid>> {
    let res = sqlx::query!(
        r#"
INSERT INTO credit_registration_account_linking_emails (
    student_number,
    sisu_person_id,
    course_id,
    emailed_to,
    student_number_verification_token_id,
    email_delivery_id
  )
VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING
RETURNING id
        "#,
        new.student_number,
        new.sisu_person_id,
        new.course_id,
        new.emailed_to,
        new.student_number_verification_token_id,
        new.email_delivery_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res.map(|r| r.id))
}

/// As much of one existing mail as the dedup guard and the rate caps need to decide on a person.
#[derive(Debug, Clone, PartialEq)]
pub struct ExistingLinkingMailFact {
    pub sisu_person_id: String,
    pub course_id: Uuid,
    pub emailed_to: String,
    pub sent_at: DateTime<Utc>,
}

/// Every live mail these people have ever been sent, any course: one query stands in for the
/// quiet-period count, the per-course count and the dedup check of a whole batch of candidates.
pub async fn get_existing_facts_for_persons(
    conn: &mut PgConnection,
    sisu_person_ids: &[String],
) -> ModelResult<Vec<ExistingLinkingMailFact>> {
    let res = sqlx::query_as!(
        ExistingLinkingMailFact,
        r#"
SELECT sisu_person_id,
  course_id,
  emailed_to,
  sent_at
FROM credit_registration_account_linking_emails
WHERE sisu_person_id = ANY($1::text [])
  AND deleted_at IS NULL
        "#,
        sisu_person_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Batched form of [`claim_send_slot`], keyed by token: returns the
/// `student_number_verification_token_id` of every row actually inserted, so the caller can tell
/// which candidates lost the race to the unique index.
///
/// `token_ids[i]` is the token already minted for `new[i]`, taken separately rather than read from
/// `new[i].student_number_verification_token_id`: that field stays `Option` because it really can be
/// absent on the single-row [`claim_send_slot`], but a batched claim always has one.
pub async fn claim_send_slots(
    conn: &mut PgConnection,
    new: &[NewAccountLinkingEmail],
    token_ids: &[Uuid],
) -> ModelResult<HashSet<Uuid>> {
    if new.is_empty() {
        return Ok(HashSet::new());
    }
    let student_numbers: Vec<String> = new.iter().map(|n| n.student_number.clone()).collect();
    let sisu_person_ids: Vec<String> = new.iter().map(|n| n.sisu_person_id.clone()).collect();
    let course_ids: Vec<Uuid> = new.iter().map(|n| n.course_id).collect();
    let emailed_tos: Vec<String> = new.iter().map(|n| n.emailed_to.clone()).collect();

    let claimed = sqlx::query_scalar!(
        r#"
INSERT INTO credit_registration_account_linking_emails (
    student_number,
    sisu_person_id,
    course_id,
    emailed_to,
    student_number_verification_token_id
  )
SELECT * FROM UNNEST($1::text [], $2::text [], $3::uuid [], $4::text [], $5::uuid []) ON CONFLICT DO NOTHING
RETURNING student_number_verification_token_id AS "token_id!"
        "#,
        &student_numbers,
        &sisu_person_ids,
        &course_ids,
        &emailed_tos,
        token_ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(claimed.into_iter().collect())
}

/// This course's newest linking mail for each of these Sisu people, keyed by person id.
pub async fn get_latest_by_course_and_persons(
    conn: &mut PgConnection,
    course_id: Uuid,
    sisu_person_ids: &[String],
) -> ModelResult<HashMap<String, CreditRegistrationAccountLinkingEmail>> {
    let res = sqlx::query_as!(
        CreditRegistrationAccountLinkingEmail,
        r#"
SELECT DISTINCT ON (sisu_person_id) *
FROM credit_registration_account_linking_emails
WHERE course_id = $1
  AND sisu_person_id = ANY($2::text [])
  AND deleted_at IS NULL
ORDER BY sisu_person_id,
  sent_at DESC
        "#,
        course_id,
        sisu_person_ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(res
        .into_iter()
        .map(|row| (row.sisu_person_id.clone(), row))
        .collect())
}

/// This course's linking mails for one student number, newest first.
///
/// Keyed on the number the study registry gave us, not on a verified link: the recipients of a
/// linking mail are exactly the population that has none.
pub async fn get_by_course_id_and_student_number(
    conn: &mut PgConnection,
    course_id: Uuid,
    student_number: &str,
) -> ModelResult<Vec<CreditRegistrationAccountLinkingEmail>> {
    let res = sqlx::query_as!(
        CreditRegistrationAccountLinkingEmail,
        r#"
SELECT *
FROM credit_registration_account_linking_emails
WHERE course_id = $1
  AND student_number = $2
  AND deleted_at IS NULL
ORDER BY sent_at DESC
        "#,
        course_id,
        student_number,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_sisu_person_id(
    conn: &mut PgConnection,
    sisu_person_id: &str,
) -> ModelResult<Vec<CreditRegistrationAccountLinkingEmail>> {
    let res = sqlx::query_as!(
        CreditRegistrationAccountLinkingEmail,
        r#"
SELECT *
FROM credit_registration_account_linking_emails
WHERE sisu_person_id = $1
  AND deleted_at IS NULL
ORDER BY sent_at DESC
        "#,
        sisu_person_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// How many mails this person has had for this course, tokens that expired unused included. Read
/// against the lifetime cap when an admin asks for a resend.
pub async fn count_sent_for_person_and_course(
    conn: &mut PgConnection,
    sisu_person_id: &str,
    course_id: Uuid,
) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM credit_registration_account_linking_emails
WHERE sisu_person_id = $1
  AND course_id = $2
  AND deleted_at IS NULL
        "#,
        sisu_person_id,
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// A claimed slot with no delivery yet, and everything the mail needs to be written.
#[derive(Debug, Clone)]
pub struct LinkingMailToQueue {
    pub id: Uuid,
    pub emailed_to: String,
    pub student_number: String,
    pub first_names: Option<String>,
    /// Mailed as part of the link, so the recipient can prove the address is theirs.
    pub token: DbSecret,
    pub course_name: String,
    pub course_language_code: String,
}

/// Claims slots whose mail has not been queued yet, oldest first.
///
/// Locks them, so the caller must hold a transaction: the delivery insert is not idempotent, and two
/// iterations claiming one slot would queue the same mail twice.
///
/// A retired, used or expired token is skipped rather than mailed — a dead link spends the
/// recipient's one mail for this course on nothing — but its slot stays, since it is still proof we
/// may not mail that address again.
pub async fn claim_unqueued(
    conn: &mut PgConnection,
    limit: i64,
    course_id: Option<Uuid>,
) -> ModelResult<Vec<LinkingMailToQueue>> {
    let res = sqlx::query_as!(
        LinkingMailToQueue,
        r#"
SELECT e.id AS "id!",
  e.emailed_to AS "emailed_to!",
  e.student_number AS "student_number!",
  t.first_names AS "first_names?",
  t.token AS "token!: DbSecret",
  c.name AS "course_name!",
  c.language_code AS "course_language_code!"
FROM credit_registration_account_linking_emails e
  JOIN student_number_verification_tokens t ON t.id = e.student_number_verification_token_id
  JOIN courses c ON c.id = e.course_id
WHERE e.email_delivery_id IS NULL
  AND e.deleted_at IS NULL
  AND t.deleted_at IS NULL
  AND t.used_at IS NULL
  AND t.expires_at > now()
  AND ($2::uuid IS NULL OR e.course_id = $2)
ORDER BY e.sent_at
FOR UPDATE OF e SKIP LOCKED
LIMIT $1
        "#,
        limit,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Records which delivery carries this mail, which is also what takes the slot out of the queue.
pub async fn set_email_delivery_id(
    conn: &mut PgConnection,
    id: Uuid,
    email_delivery_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registration_account_linking_emails
SET email_delivery_id = $2
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        email_delivery_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// What we can honestly say about each linking mail. A slot with no delivery yet is `queued`:
/// anything else would claim a send attempt that never happened.
pub async fn get_send_status_reports(
    conn: &mut PgConnection,
    ids: &[Uuid],
) -> ModelResult<HashMap<Uuid, EmailSendStatusReport>> {
    let rows = sqlx::query!(
        r#"
SELECT id,
  email_delivery_id
FROM credit_registration_account_linking_emails
WHERE id = ANY($1::uuid [])
  AND deleted_at IS NULL
        "#,
        ids
    )
    .fetch_all(&mut *conn)
    .await?;
    let delivery_ids: Vec<Uuid> = rows
        .iter()
        .filter_map(|row| row.email_delivery_id)
        .collect();
    let mut deliveries = get_send_statuses(conn, &delivery_ids).await?;
    let res = rows
        .into_iter()
        .map(|row| {
            let report = row
                .email_delivery_id
                .and_then(|id| deliveries.remove(&id))
                .unwrap_or_else(not_handed_over_yet);
            (row.id, report)
        })
        .collect();
    Ok(res)
}

/// What a claimed slot with no delivery reports. Public so a caller falling back to a default says
/// the same thing [`get_send_status_reports`] would have.
pub fn not_handed_over_yet() -> EmailSendStatusReport {
    EmailSendStatusReport {
        email_send_status: EmailSendStatus::Queued,
        sent_at: None,
        last_attempt_at: None,
        retry_count: 0,
        next_retry_at: None,
        failure_code: None,
        failure_is_transient: None,
    }
}

/// Mails claimed in the window, whatever course they belong to. One row is one address, which is
/// what the send-rate caps govern.
pub async fn count_sent_since(conn: &mut PgConnection, since: DateTime<Utc>) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM credit_registration_account_linking_emails
WHERE sent_at >= $1
  AND deleted_at IS NULL
        "#,
        since,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// Mails claimed in the window, newest first, whatever course they belong to.
pub async fn get_sent_since(
    conn: &mut PgConnection,
    since: DateTime<Utc>,
) -> ModelResult<Vec<CreditRegistrationAccountLinkingEmail>> {
    let res = sqlx::query_as!(
        CreditRegistrationAccountLinkingEmail,
        r#"
SELECT *
FROM credit_registration_account_linking_emails
WHERE sent_at >= $1
  AND deleted_at IS NULL
ORDER BY sent_at DESC
        "#,
        since,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Every mail in a window, bucketed the way [`crate::email_deliveries::derive_email_send_status`]
/// does. Computed in SQL from the same facts rather than from its output, so the two cannot drift
/// on what counts as failed.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct LinkingMailSendStatusTotals {
    pub mails_in_window: i64,
    pub queued: i64,
    pub retrying: i64,
    pub sent: i64,
    pub send_failed: i64,
    /// `None` when nothing failed within the window.
    pub last_send_failed_at: Option<DateTime<Utc>>,
}

pub async fn get_send_status_totals_since(
    conn: &mut PgConnection,
    since: DateTime<Utc>,
    now: DateTime<Utc>,
) -> ModelResult<LinkingMailSendStatusTotals> {
    struct Row {
        sent_at: DateTime<Utc>,
        email_delivery_id: Option<Uuid>,
        delivery_sent: Option<bool>,
        retryable: Option<bool>,
        first_failed_at: Option<DateTime<Utc>>,
        retry_count: Option<i32>,
    }
    let rows = sqlx::query_as!(
        Row,
        r#"
SELECT
  e.sent_at AS "sent_at!",
  e.email_delivery_id,
  ed.sent AS delivery_sent,
  ed.retryable,
  ed.first_failed_at,
  ed.retry_count
FROM credit_registration_account_linking_emails e
  LEFT JOIN email_deliveries ed ON ed.id = e.email_delivery_id
WHERE e.sent_at >= $1
  AND e.deleted_at IS NULL
        "#,
        since,
    )
    .fetch_all(conn)
    .await?;

    let mut totals = LinkingMailSendStatusTotals {
        mails_in_window: rows.len() as i64,
        ..Default::default()
    };
    for row in rows {
        let status = match row.email_delivery_id {
            None => EmailSendStatus::Queued,
            Some(_) => {
                let facts = EmailSendStatusFacts {
                    sent: row.delivery_sent.unwrap_or(false),
                    retryable: row.retryable.unwrap_or(false),
                    retry_count: row.retry_count.unwrap_or(0),
                    next_retry_at: None,
                    first_failed_at: row.first_failed_at,
                    last_attempt_at: None,
                    failure_code: None,
                    failure_is_transient: None,
                };
                derive_email_send_status(&facts, now).email_send_status
            }
        };
        match status {
            EmailSendStatus::Queued => totals.queued += 1,
            EmailSendStatus::Retrying => totals.retrying += 1,
            EmailSendStatus::Sent => totals.sent += 1,
            EmailSendStatus::SendFailed => {
                totals.send_failed += 1;
                totals.last_send_failed_at = Some(
                    totals
                        .last_send_failed_at
                        .map_or(row.sent_at, |prev| prev.max(row.sent_at)),
                );
            }
        }
    }
    Ok(totals)
}

#[derive(Debug, Clone, PartialEq)]
pub struct LinkingMailFailureDomain {
    pub domain: String,
    pub count: i64,
}

/// Domains behind a hard send failure in the window, worst first. Same predicate as
/// [`get_send_status_totals_since`], enforced by both calling
/// [`crate::email_deliveries::is_hard_send_failure`] rather than each repeating the condition.
pub async fn get_send_failure_domains_since(
    conn: &mut PgConnection,
    since: DateTime<Utc>,
    now: DateTime<Utc>,
) -> ModelResult<Vec<LinkingMailFailureDomain>> {
    struct Row {
        emailed_to: String,
        retryable: bool,
        first_failed_at: Option<DateTime<Utc>>,
    }
    let rows = sqlx::query_as!(
        Row,
        r#"
SELECT e.emailed_to, ed.retryable, ed.first_failed_at
FROM credit_registration_account_linking_emails e
  JOIN email_deliveries ed ON ed.id = e.email_delivery_id
WHERE e.sent_at >= $1
  AND e.deleted_at IS NULL
  AND position('@' IN e.emailed_to) > 0
  AND NOT ed.sent
        "#,
        since,
    )
    .fetch_all(conn)
    .await?;

    let mut counts: HashMap<String, i64> = HashMap::new();
    for row in rows {
        if !is_hard_send_failure(row.retryable, row.first_failed_at, now) {
            continue;
        }
        let Some(at) = row.emailed_to.find('@') else {
            continue;
        };
        *counts
            .entry(row.emailed_to[at + 1..].to_string())
            .or_insert(0) += 1;
    }

    let mut domains: Vec<LinkingMailFailureDomain> = counts
        .into_iter()
        .map(|(domain, count)| LinkingMailFailureDomain { domain, count })
        .collect();
    domains.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.domain.cmp(&b.domain)));
    Ok(domains)
}

/// Hard send failures for one course, all time. Same predicate as [`get_send_status_totals_since`],
/// narrowed to a course instead of a time window.
pub async fn count_send_failed_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    now: DateTime<Utc>,
) -> ModelResult<i64> {
    struct Row {
        retryable: bool,
        first_failed_at: Option<DateTime<Utc>>,
    }
    let rows = sqlx::query_as!(
        Row,
        r#"
SELECT ed.retryable, ed.first_failed_at
FROM credit_registration_account_linking_emails e
  JOIN email_deliveries ed ON ed.id = e.email_delivery_id
WHERE e.course_id = $1
  AND e.deleted_at IS NULL
  AND NOT ed.sent
        "#,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .filter(|row| is_hard_send_failure(row.retryable, row.first_failed_at, now))
        .count() as i64)
}

/// One person and course mailed to the cap without a single claim: the stale-address population,
/// which is how "the student is ignoring us" is told from "the address Sisu holds is dead".
#[derive(Debug, Clone, PartialEq)]
pub struct StaleUnclaimedLinkingMails {
    pub student_number: String,
    pub sisu_person_id: String,
    pub course_id: Uuid,
    pub course_name: String,
    pub mail_count: i64,
    pub first_sent_at: DateTime<Utc>,
    pub last_sent_at: DateTime<Utc>,
    pub mail_ids: Vec<Uuid>,
    /// In full: an admin deciding whether resending can work has to read the address.
    pub addresses: Vec<String>,
}

pub async fn get_stale_unclaimed(
    conn: &mut PgConnection,
    min_mail_count: i64,
    limit: i64,
) -> ModelResult<Vec<StaleUnclaimedLinkingMails>> {
    let res = sqlx::query_as!(
        StaleUnclaimedLinkingMails,
        r#"
SELECT e.student_number AS "student_number!",
  e.sisu_person_id AS "sisu_person_id!",
  e.course_id AS "course_id!",
  c.name AS "course_name!",
  COUNT(*) AS "mail_count!",
  MIN(e.sent_at) AS "first_sent_at!",
  MAX(e.sent_at) AS "last_sent_at!",
  ARRAY_AGG(
    e.id
    ORDER BY e.sent_at
  ) AS "mail_ids!",
  ARRAY_AGG(
    e.emailed_to
    ORDER BY e.sent_at
  ) AS "addresses!"
FROM credit_registration_account_linking_emails e
  JOIN courses c ON c.id = e.course_id
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM verified_student_numbers vsn
    WHERE vsn.sisu_person_id = e.sisu_person_id
      AND vsn.deleted_at IS NULL
  )
GROUP BY e.student_number,
  e.sisu_person_id,
  e.course_id,
  c.name
HAVING COUNT(*) >= $1
ORDER BY MAX(e.sent_at) DESC
LIMIT $2
        "#,
        min_mail_count,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Lets a rate-cap override or an admin resend mail the same address again.
pub async fn soft_delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    soft_delete_batch(conn, std::slice::from_ref(&id)).await
}

/// Batch form of [`soft_delete`]: one `UPDATE` for every row instead of one per id.
pub async fn soft_delete_batch(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
    if ids.is_empty() {
        return Ok(());
    }
    sqlx::query!(
        r#"
UPDATE credit_registration_account_linking_emails
SET deleted_at = now()
WHERE id = ANY($1)
  AND deleted_at IS NULL
        "#,
        ids
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::email_deliveries::insert_email_delivery_to_address;
    use crate::email_templates::{EmailTemplateNew, EmailTemplateType, insert_email_template};
    use crate::library::credit_registration::account_linking::{
        DiscoveredPerson, claim_linking_mails,
    };
    use crate::test_helper::*;

    async fn claim_a_mail(conn: &mut PgConnection, course_id: Uuid) -> Uuid {
        claim_linking_mails(
            conn,
            &DiscoveredPerson {
                sisu_person_id: "hy-hlo-1".to_string(),
                student_number: "012345678".to_string(),
                first_names: Some("Aada".to_string()),
                last_name: Some("Virtanen".to_string()),
                course_id,
                addresses: vec!["aada@helsinki.fi".to_string()],
            },
        )
        .await
        .unwrap();
        get_by_sisu_person_id(conn, "hy-hlo-1")
            .await
            .unwrap()
            .pop()
            .expect("the claim wrote a slot")
            .id
    }

    async fn seed_template(conn: &mut PgConnection) -> Uuid {
        insert_email_template(
            conn,
            None,
            EmailTemplateNew {
                template_type: EmailTemplateType::CreditRegistrationAccountLinking,
                language: Some("en".to_string()),
                content: Some(serde_json::json!([])),
                subject: Some("Link your student number".to_string()),
            },
            None,
        )
        .await
        .unwrap()
        .id
    }

    /// The property the two-phase split rests on: without it a restart between the claim and the
    /// queueing would mail the same address again.
    #[tokio::test]
    async fn a_claimed_slot_leaves_the_queue_once_its_delivery_exists() {
        insert_data!(:tx, :user, :org, :course);
        let slot = claim_a_mail(tx.as_mut(), course).await;
        let template = seed_template(tx.as_mut()).await;

        let claimed = claim_unqueued(tx.as_mut(), 10, None).await.unwrap();
        assert_eq!(claimed.len(), 1);
        assert_eq!(claimed[0].id, slot);
        assert_eq!(claimed[0].emailed_to, "aada@helsinki.fi");

        let delivery = insert_email_delivery_to_address(
            tx.as_mut(),
            &claimed[0].emailed_to,
            template,
            &serde_json::json!({ "NAME": "Aada" }),
        )
        .await
        .unwrap();
        set_email_delivery_id(tx.as_mut(), slot, delivery)
            .await
            .unwrap();

        assert!(
            claim_unqueued(tx.as_mut(), 10, None)
                .await
                .unwrap()
                .is_empty()
        );
    }

    #[tokio::test]
    async fn a_slot_with_no_delivery_yet_reports_as_queued() {
        insert_data!(:tx, :user, :org, :course);
        let slot = claim_a_mail(tx.as_mut(), course).await;
        let reports = get_send_status_reports(tx.as_mut(), &[slot]).await.unwrap();
        assert_eq!(
            reports.get(&slot).map(|report| report.email_send_status),
            Some(EmailSendStatus::Queued)
        );
    }
}
