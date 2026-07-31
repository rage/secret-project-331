use rand::RngExt;
use rand::distr::{Alphanumeric, SampleString};
use secrecy::ExposeSecret;

use crate::prelude::*;

/// Length of a generated verification token; matches the other emailed-link tokens.
const TOKEN_LENGTH: usize = 128;

/// Replaces a stored address on account deletion. Not a valid address, so nothing can mail it.
const ERASED_EMAIL: &str = "[deleted]";

#[derive(Debug, Clone)]
pub struct EmailOwnershipVerificationToken {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub token: DbSecret,
    pub user_id: Uuid,
    pub email: String,
    pub email_delivery_id: Option<Uuid>,
    pub expires_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
}

pub fn is_valid(token: &EmailOwnershipVerificationToken) -> bool {
    let now = Utc::now();
    token.expires_at > now && token.used_at.is_none() && token.deleted_at.is_none()
}

/// Probabilistic cleanup instead of a cron. Claimed rows survive: they are the audit trail behind
/// an `email_verified_at`.
///
/// The token is the only thing pointing at the delivery that carried the link, so the statement
/// also erases the address from it and retires it if unsent.
pub async fn maybe_cleanup_expired(conn: &mut PgConnection) -> ModelResult<()> {
    let random_num = rand::rng().random_range(1..=10);
    if random_num == 1 {
        info!("Cleaning up expired email ownership verification tokens");
        sqlx::query!(
            r#"
WITH deleted AS (
  DELETE FROM email_ownership_verification_tokens
  WHERE expires_at < now()
    AND used_at IS NULL
  RETURNING email_delivery_id
)
UPDATE email_deliveries ed
SET recipient_email = $1::text,
    placeholders = CASE
      WHEN ed.placeholders IS NULL THEN NULL
      ELSE jsonb_set(ed.placeholders, '{EMAIL}', to_jsonb($1::text))
    END,
    deleted_at = CASE
      WHEN ed.sent OR ed.deleted_at IS NOT NULL THEN ed.deleted_at
      ELSE now()
    END
FROM deleted
WHERE ed.id = deleted.email_delivery_id
  AND ed.recipient_email IS NOT NULL
            "#,
            ERASED_EMAIL,
        )
        .execute(conn)
        .await?;
    }
    Ok(())
}

/// Mints a token for one account and address, retiring the account's outstanding ones so only the
/// newest link works. Returns the row id and the plaintext token for the mailed link.
pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    user_id: Uuid,
    email: &str,
) -> ModelResult<(Uuid, DbSecret)> {
    let mut tx = conn.begin().await?;
    soft_delete_unused_for_user(&mut tx, user_id).await?;

    let token = DbSecret::new(Alphanumeric.sample_string(&mut rand::rng(), TOKEN_LENGTH));
    let res = sqlx::query!(
        r#"
INSERT INTO email_ownership_verification_tokens (id, token, user_id, email)
VALUES ($1, $2, $3, $4)
RETURNING id
        "#,
        pkey_policy.into_uuid(),
        token.expose_secret(),
        user_id,
        email,
    )
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok((res.id, token))
}

/// Records which delivery carries the link, so the account page can report our send status.
pub async fn set_email_delivery_id(
    conn: &mut PgConnection,
    id: Uuid,
    email_delivery_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE email_ownership_verification_tokens
SET email_delivery_id = $2
WHERE id = $1
        "#,
        id,
        email_delivery_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Returns used, expired and retired rows too, so the caller can say which of those happened.
pub async fn get_by_token(
    conn: &mut PgConnection,
    token: &DbSecret,
) -> ModelResult<Option<EmailOwnershipVerificationToken>> {
    let res = sqlx::query_as!(
        EmailOwnershipVerificationToken,
        r#"
SELECT *
FROM email_ownership_verification_tokens
WHERE token = $1
ORDER BY created_at DESC
LIMIT 1
        "#,
        token.expose_secret()
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// The account's newest live token, for reporting when we last mailed a link and to where.
pub async fn get_latest_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Option<EmailOwnershipVerificationToken>> {
    let res = sqlx::query_as!(
        EmailOwnershipVerificationToken,
        r#"
SELECT *
FROM email_ownership_verification_tokens
WHERE user_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 1
        "#,
        user_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// Single-use claim (`used_at IS NULL`), and only while `user_details.email` still equals the
/// address the link was mailed to, so a link cannot prove an address switched to afterwards.
pub async fn claim(
    conn: &mut PgConnection,
    token: &DbSecret,
) -> ModelResult<Option<EmailOwnershipVerificationToken>> {
    let claimed = sqlx::query_as!(
        EmailOwnershipVerificationToken,
        r#"
UPDATE email_ownership_verification_tokens t
SET used_at = now()
WHERE t.token = $1
  AND t.used_at IS NULL
  AND t.deleted_at IS NULL
  AND t.expires_at > now()
  AND EXISTS (
    SELECT 1
    FROM user_details ud
    WHERE ud.user_id = t.user_id
      AND lower(ud.email) = lower(t.email)
  )
RETURNING t.*
        "#,
        token.expose_secret(),
    )
    .fetch_optional(conn)
    .await?;
    Ok(claimed)
}

/// Retires the account's unused links, so an older mail cannot be used after a newer one was sent.
pub async fn soft_delete_unused_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<u64> {
    let res = sqlx::query!(
        r#"
UPDATE email_ownership_verification_tokens
SET deleted_at = now()
WHERE user_id = $1
  AND used_at IS NULL
  AND deleted_at IS NULL
        "#,
        user_id
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected())
}

/// Retires the account's pending links and the mail carrying them, for account deletion.
///
/// The ordinary unsent-mail sweep keys on `email_deliveries.user_id`, which is NULL for these rows.
pub async fn soft_delete_unused_with_pending_mail_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    sqlx::query!(
        r#"
UPDATE email_deliveries ed
SET deleted_at = now()
FROM email_ownership_verification_tokens t
WHERE t.user_id = $1
  AND t.email_delivery_id = ed.id
  AND t.used_at IS NULL
  AND ed.sent = FALSE
  AND ed.deleted_at IS NULL
        "#,
        user_id
    )
    .execute(&mut *tx)
    .await?;
    soft_delete_unused_for_user(&mut tx, user_id).await?;
    tx.commit().await?;
    Ok(())
}

/// Overwrites every copy of the account's address the verification flow stored, keeping the rows.
///
/// For account deletion: the token's frozen `email` and its delivery's `recipient_email` and
/// `EMAIL` placeholder outlive `user_details`, and the retention sweep reaches only expired unused
/// rows. Idempotent.
pub async fn erase_stored_addresses_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<()> {
    // These deliveries carry no user_id, so the token's `email_delivery_id` is the only way to
    // reach them. The `recipient_email` guard keeps the update off user_id-addressed rows, where
    // writing a recipient would break the "exactly one of user_id and recipient_email" constraint.
    sqlx::query!(
        r#"
UPDATE email_deliveries ed
SET recipient_email = $2::text,
    placeholders = CASE
      WHEN ed.placeholders IS NULL THEN NULL
      ELSE jsonb_set(ed.placeholders, '{EMAIL}', to_jsonb($2::text))
    END
FROM email_ownership_verification_tokens t
WHERE t.user_id = $1
  AND t.email_delivery_id = ed.id
  AND ed.recipient_email IS NOT NULL
  AND ed.recipient_email <> $2::text
        "#,
        user_id,
        ERASED_EMAIL,
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        r#"
UPDATE email_ownership_verification_tokens
SET email = $2
WHERE user_id = $1
  AND email <> $2
        "#,
        user_id,
        ERASED_EMAIL,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// When we last mailed a link to this exact address, for the resend rate cap.
///
/// Retired and claimed rows count. Keyed on the address, not the account, so a genuine address
/// change can be mailed immediately. Runs the cleanup, which only removes rows older than any
/// resend window.
pub async fn get_last_send_time_for_address(
    conn: &mut PgConnection,
    user_id: Uuid,
    email: &str,
) -> ModelResult<Option<DateTime<Utc>>> {
    maybe_cleanup_expired(conn).await?;

    let res = sqlx::query_scalar!(
        r#"
SELECT MAX(created_at)
FROM email_ownership_verification_tokens
WHERE user_id = $1
  AND lower(email) = lower($2)
        "#,
        user_id,
        email,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
