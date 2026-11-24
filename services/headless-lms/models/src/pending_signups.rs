//! Signups waiting for the code mailed to the address. No account exists until the code is typed.

use sha2::{Digest, Sha256};

use crate::prelude::*;

/// A stored signup, as the code step reads it.
pub struct PendingSignup {
    pub id: Uuid,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub country: String,
    pub language: String,
    pub password_hash: String,
    pub email_communication_consent: bool,
    pub code_digest: Vec<u8>,
    pub code_sent_at: DateTime<Utc>,
    pub email_delivery_id: Option<Uuid>,
    pub failed_attempts: i32,
    pub expires_at: DateTime<Utc>,
}

/// What [`replace`] stores; the code is passed separately.
pub struct NewPendingSignup<'a> {
    pub email: &'a str,
    pub first_name: &'a str,
    pub last_name: &'a str,
    pub country: &'a str,
    pub language: &'a str,
    /// From [`crate::user_passwords::hash_password`].
    pub password_hash: &'a str,
    pub email_communication_consent: bool,
    pub expires_at: DateTime<Utc>,
}

/// SHA-256 of a code, as stored in `code_digest`.
pub fn code_digest(code: &str) -> Vec<u8> {
    Sha256::digest(code.trim().as_bytes()).to_vec()
}

/// Stores the signup with `code`, replacing any pending signup for the same address and erasing
/// the code its mail carried. Returns the new row's id.
pub async fn replace(
    conn: &mut PgConnection,
    signup: &NewPendingSignup<'_>,
    code: &str,
) -> ModelResult<Uuid> {
    let mut tx = conn.begin().await?;
    // Row locks miss a concurrent first signup for the address, which would hit the unique index.
    sqlx::query!(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        format!("pending_signups:{}", signup.email.trim().to_lowercase())
    )
    .execute(&mut *tx)
    .await?;
    let previous = sqlx::query_scalar!(
        r#"
SELECT id
FROM pending_signups
WHERE lower(email) = lower($1)
FOR UPDATE
"#,
        signup.email,
    )
    .fetch_optional(&mut *tx)
    .await?;
    if let Some(previous) = previous {
        delete(&mut tx, previous).await?;
    }
    let id = sqlx::query_scalar!(
        r#"
INSERT INTO pending_signups (
    email,
    first_name,
    last_name,
    country,
    language,
    password_hash,
    email_communication_consent,
    code_digest,
    code_sent_at,
    expires_at
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9)
RETURNING id
"#,
        signup.email.trim(),
        signup.first_name,
        signup.last_name,
        signup.country,
        signup.language,
        signup.password_hash,
        signup.email_communication_consent,
        code_digest(code),
        signup.expires_at,
    )
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(id)
}

/// The unexpired pending signup `id`, locked for the rest of the transaction.
pub async fn get_unexpired_for_update(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<Option<PendingSignup>> {
    let signup = sqlx::query_as!(
        PendingSignup,
        r#"
SELECT id,
  email,
  first_name,
  last_name,
  country,
  language,
  password_hash,
  email_communication_consent,
  code_digest,
  code_sent_at,
  email_delivery_id,
  failed_attempts,
  expires_at
FROM pending_signups
WHERE id = $1
  AND expires_at > now()
FOR UPDATE
"#,
        id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(signup)
}

/// Records the mail that carries the current code.
pub async fn set_email_delivery(
    conn: &mut PgConnection,
    id: Uuid,
    email_delivery_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "UPDATE pending_signups SET email_delivery_id = $2 WHERE id = $1",
        id,
        email_delivery_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Replaces the code with `code`, erasing the old one's mail and resetting the count of wrong
/// attempts.
pub async fn replace_code(conn: &mut PgConnection, id: Uuid, code: &str) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    erase_mailed_code(&mut tx, id).await?;
    sqlx::query!(
        r#"
UPDATE pending_signups
SET code_digest = $2,
  code_sent_at = now(),
  email_delivery_id = NULL,
  failed_attempts = 0
WHERE id = $1
"#,
        id,
        code_digest(code),
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// Counts a wrong code. Returns the wrong codes counted so far.
pub async fn record_failed_attempt(conn: &mut PgConnection, id: Uuid) -> ModelResult<i32> {
    let attempts = sqlx::query_scalar!(
        r#"
UPDATE pending_signups
SET failed_attempts = failed_attempts + 1
WHERE id = $1
RETURNING failed_attempts
"#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(attempts)
}

/// Hard-deletes the pending signup and erases the code its mail carried.
pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    erase_mailed_code(&mut tx, id).await?;
    sqlx::query!("DELETE FROM pending_signups WHERE id = $1", id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(())
}

/// Hard-deletes expired pending signups. Returns how many went.
pub async fn delete_expired(conn: &mut PgConnection) -> ModelResult<u64> {
    let ids = sqlx::query_scalar!("SELECT id FROM pending_signups WHERE expires_at <= now()")
        .fetch_all(&mut *conn)
        .await?;
    for id in &ids {
        delete(conn, *id).await?;
    }
    Ok(ids.len() as u64)
}

/// The code the mail of the pending signup carries, while it still holds it. For test mode only:
/// the system tests have no mail capture.
pub async fn get_mailed_code(conn: &mut PgConnection, id: Uuid) -> ModelResult<Option<String>> {
    let code = sqlx::query_scalar!(
        r#"
SELECT ed.placeholders->>'CODE' AS code
FROM pending_signups ps
  JOIN email_deliveries ed ON ed.id = ps.email_delivery_id
WHERE ps.id = $1
"#,
        id,
    )
    .fetch_optional(conn)
    .await?
    .flatten();
    Ok(code)
}

/// Erases the code from the mail of the pending signup: an unsent mail is cancelled, and a sent
/// one forgets its copy.
async fn erase_mailed_code(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE email_deliveries ed
SET placeholders = NULL,
  deleted_at = CASE
    WHEN ed.sent THEN ed.deleted_at
    ELSE now()
  END
FROM pending_signups ps
WHERE ps.id = $1
  AND ed.id = ps.email_delivery_id
"#,
        id,
    )
    .execute(conn)
    .await?;
    Ok(())
}
