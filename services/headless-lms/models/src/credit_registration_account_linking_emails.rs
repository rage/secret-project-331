//! Dedup ledger for account-linking mails.
//!
//! Keyed on the Sisu person id plus the recipient address: at send time there is no account of ours
//! to key on, and the student number changes when a student moves between programmes.
//!
//! A row is written the moment the right to mail is claimed, before a delivery exists, so the claim
//! and the queueing are two phases that cannot mail twice between them.
use std::collections::HashMap;

use utoipa::ToSchema;

use crate::email_deliveries::{EmailSendStatus, EmailSendStatusReport, get_send_statuses};
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

/// Claims the right to mail this (person, course, address) exactly once. `None` means a mail was
/// already recorded and the caller must not send.
///
/// Call in the transaction that mints the token, so a refused claim leaves no usable link behind.
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

/// Whether this (person, course, address) has already had its mail.
///
/// The unique index behind [`claim_send_slot`] is what actually prevents a second one; this answers
/// the same question without writing, so a suppressed send can be counted as dedup rather than as a
/// lost race.
pub async fn already_mailed(
    conn: &mut PgConnection,
    sisu_person_id: &str,
    course_id: Uuid,
    emailed_to: &str,
) -> ModelResult<bool> {
    let exists = sqlx::query_scalar!(
        r#"
SELECT EXISTS(
    SELECT 1
    FROM credit_registration_account_linking_emails
    WHERE sisu_person_id = $1
      AND course_id = $2
      AND LOWER(emailed_to) = LOWER($3)
      AND deleted_at IS NULL
  ) AS "exists!"
        "#,
        sisu_person_id,
        course_id,
        emailed_to,
    )
    .fetch_one(conn)
    .await?;
    Ok(exists)
}

pub async fn get_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CreditRegistrationAccountLinkingEmail>> {
    let res = sqlx::query_as!(
        CreditRegistrationAccountLinkingEmail,
        r#"
SELECT *
FROM credit_registration_account_linking_emails
WHERE course_id = $1
  AND deleted_at IS NULL
ORDER BY sent_at DESC
        "#,
        course_id
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

/// Backs the rate cap of at most one mail per Sisu person per window, across all courses.
pub async fn count_sent_since(
    conn: &mut PgConnection,
    sisu_person_id: &str,
    since: DateTime<Utc>,
) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM credit_registration_account_linking_emails
WHERE sisu_person_id = $1
  AND sent_at >= $2
  AND deleted_at IS NULL
        "#,
        sisu_person_id,
        since,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// Backs the rate cap of at most a few mails ever per (person, course), even when tokens expire
/// unused.
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
/// Tokens that were retired or already claimed are skipped rather than mailed. Their slot stays as
/// it is: it is still proof we may not mail that address again.
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

/// What we can honestly say about each linking mail, for the student, teacher and admin surfaces.
///
/// A slot with no delivery yet is `queued`: the right to mail is taken and the sender has not been
/// handed a message. Reporting anything else would claim an attempt that never happened.
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

fn not_handed_over_yet() -> EmailSendStatusReport {
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

/// Lets a rate-cap override or an admin resend mail the same address again.
pub async fn soft_delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registration_account_linking_emails
SET deleted_at = now()
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id
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

    /// The property the two-phase split rests on: claiming the slot and queueing the mail are
    /// separate writes, and the second one is what takes the slot out of the queue. Without this a
    /// restart between them would mail the same address again.
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

    /// A slot whose mail has not been handed over is honestly `queued`, not an absence of status.
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
