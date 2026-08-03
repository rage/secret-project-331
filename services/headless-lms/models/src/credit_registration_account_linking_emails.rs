//! Dedup ledger for account-linking mails.
//!
//! Keyed on the Sisu person id plus the recipient address: at send time there is no account of ours
//! to key on, and the student number changes when a student moves between programmes.
use utoipa::ToSchema;

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
/// Call in the transaction that mints the token and the delivery row.
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
