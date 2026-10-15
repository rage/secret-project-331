//! Browsers that users with roles have confirmed with an emailed code, identified by a random token
//! kept in a cookie. Pairs with [`crate::staff_security_verified_networks`].

use secrecy::{ExposeSecret, SecretString};
use sha2::{Digest, Sha256};

use crate::prelude::*;

/// A fresh token for a browser's cookie. Only its digest is stored.
pub fn generate_token() -> SecretString {
    SecretString::from(hex::encode(rand::random::<[u8; 32]>()))
}

fn token_digest(token: &SecretString) -> Vec<u8> {
    Sha256::digest(token.expose_secret().as_bytes()).to_vec()
}

/// One of the user's remembered browsers that has not expired.
#[derive(Debug, Clone, Copy)]
pub struct UnexpiredBrowser {
    pub id: Uuid,
    /// Whether [`renew`] would push the expiry back.
    pub renewal_due: bool,
}

/// The user's unexpired browser that holds `token`, if any.
pub async fn get_unexpired(
    conn: &mut PgConnection,
    user_id: Uuid,
    token: &SecretString,
) -> ModelResult<Option<UnexpiredBrowser>> {
    let browser = sqlx::query_as!(
        UnexpiredBrowser,
        r#"
SELECT id,
  expires_at < now() + interval '6 months' - interval '1 day' AS "renewal_due!"
FROM staff_security_verified_browsers
WHERE user_id = $1
  AND token_digest = $2
  AND expires_at > now()
        "#,
        user_id,
        token_digest(token),
    )
    .fetch_optional(conn)
    .await?;
    Ok(browser)
}

/// Remembers a new browser for six months.
pub async fn insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    token: &SecretString,
) -> ModelResult<Uuid> {
    let id = sqlx::query_scalar!(
        r#"
INSERT INTO staff_security_verified_browsers (user_id, token_digest, expires_at)
VALUES ($1, $2, now() + interval '6 months')
RETURNING id
        "#,
        user_id,
        token_digest(token),
    )
    .fetch_one(conn)
    .await?;
    Ok(id)
}

/// Remembers each `(user_id, token)` browser for six months, renewing an expired row the same user
/// already holds for that token. Never touches a row of another user.
pub async fn insert_or_renew_expired(
    conn: &mut PgConnection,
    browsers: &[(Uuid, SecretString)],
) -> ModelResult<()> {
    let (user_ids, token_digests): (Vec<Uuid>, Vec<Vec<u8>>) = browsers
        .iter()
        .map(|(user_id, token)| (*user_id, token_digest(token)))
        .unzip();
    sqlx::query!(
        r#"
INSERT INTO staff_security_verified_browsers (user_id, token_digest, expires_at)
SELECT user_id,
  token_digest,
  now() + interval '6 months'
FROM UNNEST($1::uuid [], $2::bytea []) AS browsers(user_id, token_digest)
ON CONFLICT (token_digest) DO UPDATE
SET expires_at = EXCLUDED.expires_at
WHERE staff_security_verified_browsers.user_id = EXCLUDED.user_id
  AND staff_security_verified_browsers.expires_at <= now()
        "#,
        &user_ids,
        &token_digests,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Pushes the browser's expiry back to six months from now, at most once a day.
///
/// Returns whether it did, which is when the cookie needs re-sending with the new lifetime.
pub async fn renew(conn: &mut PgConnection, id: Uuid) -> ModelResult<bool> {
    let result = sqlx::query!(
        r#"
UPDATE staff_security_verified_browsers
SET expires_at = now() + interval '6 months'
WHERE id = $1
  AND expires_at < now() + interval '6 months' - interval '1 day'
        "#,
        id,
    )
    .execute(conn)
    .await?;
    Ok(result.rows_affected() > 0)
}

/// Forgets the browser holding `token`, whichever user it belongs to.
pub async fn delete_by_token(conn: &mut PgConnection, token: &SecretString) -> ModelResult<()> {
    sqlx::query!(
        r#"
DELETE FROM staff_security_verified_browsers
WHERE token_digest = $1
        "#,
        token_digest(token),
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Forgets every browser of the user except `keep`.
pub async fn delete_all_for_user_except(
    conn: &mut PgConnection,
    user_id: Uuid,
    keep: Option<Uuid>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
DELETE FROM staff_security_verified_browsers
WHERE user_id = $1
  AND id IS DISTINCT FROM $2
        "#,
        user_id,
        keep,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Forgets every browser and network the user has verified.
pub async fn delete_all_for_user_with_networks(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<()> {
    crate::staff_security_verified_networks::delete_all_for_user_except(conn, user_id, &[]).await?;
    delete_all_for_user_except(conn, user_id, None).await
}

/// Hard-deletes every expired browser. Returns how many.
pub async fn delete_expired(conn: &mut PgConnection) -> ModelResult<u64> {
    let result = sqlx::query!(
        r#"
DELETE FROM staff_security_verified_browsers
WHERE expires_at <= now()
        "#,
    )
    .execute(conn)
    .await?;
    Ok(result.rows_affected())
}
