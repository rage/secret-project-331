use rand::RngExt;
use rand::distr::{Alphanumeric, SampleString};
use secrecy::ExposeSecret;

use crate::prelude::*;

/// Length of a generated verification token. Matches the other emailed-link tokens: the link is the
/// only proof carried by the mail.
const TOKEN_LENGTH: usize = 128;

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

/// Probabilistic cleanup, reused from the other token models rather than adding a cron.
///
/// Unlike `email_verification_tokens::maybe_cleanup_expired`, claimed rows survive: they are the
/// send history the account page reports and the audit trail behind an `email_verified_at`.
pub async fn maybe_cleanup_expired(conn: &mut PgConnection) -> ModelResult<()> {
    let random_num = rand::rng().random_range(1..=10);
    if random_num == 1 {
        info!("Cleaning up expired email ownership verification tokens");
        sqlx::query!(
            r#"
DELETE FROM email_ownership_verification_tokens
WHERE expires_at < now()
  AND used_at IS NULL
            "#,
        )
        .execute(conn)
        .await?;
    }
    Ok(())
}

/// Mints a token for one account and one address.
///
/// Retires the account's outstanding tokens first, so only the newest link works. Returns the row id
/// and the plaintext token to put in the mailed link.
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

/// Looks a token up without filtering out used, expired or retired rows, so the caller can tell the
/// user which of those happened instead of one blanket "invalid link".
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

/// Consumes the token, but only while `user_details.email` still equals the address the link was
/// mailed to.
///
/// Both halves matter. The `used_at IS NULL` predicate makes the claim single-use under concurrency,
/// and the address comparison stops a link minted for one address from proving a different one the
/// user switched to after asking for it.
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

/// Retires the account's pending links together with the mail carrying them.
///
/// For account deletion. The ordinary "cancel this user's unsent mail" sweep keys on
/// `email_deliveries.user_id`, which is NULL for these rows, so without this a deleted account would
/// still be mailed a link to confirm an address that no longer exists here.
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

/// When we last mailed a link to this exact address, for the resend rate cap.
///
/// Retired and claimed rows count: they were still mail we sent. Keying on the address rather than on
/// the account is what lets a genuine address change be mailed immediately.
pub async fn get_last_send_time_for_address(
    conn: &mut PgConnection,
    user_id: Uuid,
    email: &str,
) -> ModelResult<Option<DateTime<Utc>>> {
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
