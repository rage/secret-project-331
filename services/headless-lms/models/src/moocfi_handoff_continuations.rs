//! Sign-ins from mooc.fi waiting for the student to confirm them on courses' landing page.

use crate::prelude::*;

/// A continuation still waiting: unexpired and unused.
#[derive(Debug, Clone, PartialEq)]
pub struct PendingContinuation {
    pub user_id: Uuid,
    pub moocfi_course_id: Uuid,
    pub ui_language: Option<String>,
    pub client_ip_hash: String,
}

/// What a continuation is created from.
#[derive(Debug, Clone)]
pub struct NewContinuation<'a> {
    pub user_id: Uuid,
    pub moocfi_course_id: Uuid,
    pub ui_language: Option<&'a str>,
    pub client_ip_hash: &'a str,
}

/// Stores a continuation usable for `lifetime`, and prunes those expired over a day ago.
pub async fn insert(
    conn: &mut PgConnection,
    token_digest: &[u8],
    continuation: &NewContinuation<'_>,
    lifetime: chrono::Duration,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    sqlx::query!(
        r#"
DELETE FROM moocfi_handoff_continuations
WHERE expires_at < now() - INTERVAL '1 day'
        "#,
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        r#"
INSERT INTO moocfi_handoff_continuations (
    token_digest,
    user_id,
    moocfi_course_id,
    ui_language,
    client_ip_hash,
    expires_at
  )
VALUES ($1, $2, $3, $4, $5, now() + $6 * INTERVAL '1 millisecond')
        "#,
        token_digest,
        continuation.user_id,
        continuation.moocfi_course_id,
        continuation.ui_language,
        continuation.client_ip_hash,
        lifetime.num_milliseconds() as f64,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// The waiting continuation for `moocfi_course_id` with `token_digest`, if any.
pub async fn get_pending(
    conn: &mut PgConnection,
    token_digest: &[u8],
    moocfi_course_id: Uuid,
) -> ModelResult<Option<PendingContinuation>> {
    let res = sqlx::query_as!(
        PendingContinuation,
        r#"
SELECT user_id,
  moocfi_course_id,
  ui_language,
  client_ip_hash
FROM moocfi_handoff_continuations
WHERE token_digest = $1
  AND moocfi_course_id = $2
  AND used_at IS NULL
  AND expires_at > now()
  AND deleted_at IS NULL
        "#,
        token_digest,
        moocfi_course_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// Spends the waiting continuation, returning it. Atomic, so of two concurrent continues only one
/// gets it.
pub async fn take(
    conn: &mut PgConnection,
    token_digest: &[u8],
    moocfi_course_id: Uuid,
) -> ModelResult<Option<PendingContinuation>> {
    let res = sqlx::query_as!(
        PendingContinuation,
        r#"
UPDATE moocfi_handoff_continuations
SET used_at = now()
WHERE token_digest = $1
  AND moocfi_course_id = $2
  AND used_at IS NULL
  AND expires_at > now()
  AND deleted_at IS NULL
RETURNING user_id,
  moocfi_course_id,
  ui_language,
  client_ip_hash
        "#,
        token_digest,
        moocfi_course_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}
