//! Single-use handoffs that sign a student in on mooc.fi when they leave courses for it.

use utoipa::ToSchema;

use crate::prelude::*;

/// Where on mooc.fi a handoff sends the student; mooc.fi maps it to its own path.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(type_name = "moocfi_handoff_destination", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum MoocfiHandoffDestination {
    Certificate,
}

/// What mooc.fi learns from redeeming a handoff.
#[derive(Debug, Clone, PartialEq)]
pub struct RedeemedMoocfiHandoff {
    /// The student's TMC user id.
    pub upstream_id: i32,
    pub moocfi_course_id: Uuid,
    pub destination: MoocfiHandoffDestination,
}

/// Why a handoff could not be redeemed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RedeemRefusal {
    /// Minted from another IP than the one redeeming it. The handoff is left unspent.
    IpMismatch,
    /// Redeemed already, or expired.
    Spent,
    /// No such handoff, pruned long ago, or for a completion or target deleted since.
    Unknown,
}

/// Stores a handoff for `external_completion_id`, redeemable for `lifetime` from the IP
/// `client_ip_hash` is of, and prunes handoffs expired over a day ago.
pub async fn insert(
    conn: &mut PgConnection,
    token_digest: &[u8],
    external_completion_id: Uuid,
    destination: MoocfiHandoffDestination,
    client_ip_hash: &str,
    lifetime: chrono::Duration,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    sqlx::query!(
        r#"
DELETE FROM moocfi_outbound_handoffs
WHERE expires_at < now() - INTERVAL '1 day'
        "#,
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        r#"
INSERT INTO moocfi_outbound_handoffs (
    token_digest,
    external_completion_id,
    destination,
    client_ip_hash,
    expires_at
  )
VALUES ($1, $2, $3, $4, now() + $5 * INTERVAL '1 millisecond')
        "#,
        token_digest,
        external_completion_id,
        destination as MoocfiHandoffDestination,
        client_ip_hash,
        lifetime.num_milliseconds() as f64,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// The courses account of the student a live handoff with `token_digest` is for, spent or not.
pub async fn get_student_id(
    conn: &mut PgConnection,
    token_digest: &[u8],
) -> ModelResult<Option<Uuid>> {
    let res = sqlx::query_scalar!(
        r#"
SELECT ec.user_id
FROM moocfi_outbound_handoffs h
  JOIN external_completions ec ON ec.id = h.external_completion_id
  JOIN external_credit_targets t ON t.id = ec.external_credit_target_id
WHERE h.token_digest = $1
  AND h.deleted_at IS NULL
  AND ec.deleted_at IS NULL
  AND t.deleted_at IS NULL
        "#,
        token_digest,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// Consumes the handoff with `token_digest` if it was minted from the IP `client_ip_hash` is of.
/// Atomic, so of two concurrent redeems only one wins, and a redeem from another IP never spends it.
pub async fn redeem(
    conn: &mut PgConnection,
    token_digest: &[u8],
    client_ip_hash: &str,
) -> ModelResult<Result<RedeemedMoocfiHandoff, RedeemRefusal>> {
    let redeemed = sqlx::query_as!(
        RedeemedMoocfiHandoff,
        r#"
WITH redeemed AS (
  UPDATE moocfi_outbound_handoffs h
  SET redeemed_at = now()
  WHERE h.token_digest = $1
    AND h.client_ip_hash = $2
    AND h.redeemed_at IS NULL
    AND h.expires_at > now()
    AND h.deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM external_completions ec
        JOIN external_credit_targets t ON t.id = ec.external_credit_target_id
      WHERE ec.id = h.external_completion_id
        AND ec.deleted_at IS NULL
        AND t.deleted_at IS NULL
    )
  RETURNING h.external_completion_id,
    h.destination
)
SELECT ec.moocfi_user_upstream_id AS upstream_id,
  t.moocfi_course_id,
  r.destination AS "destination: MoocfiHandoffDestination"
FROM redeemed r
  JOIN external_completions ec ON ec.id = r.external_completion_id
  JOIN external_credit_targets t ON t.id = ec.external_credit_target_id
        "#,
        token_digest,
        client_ip_hash,
    )
    .fetch_optional(&mut *conn)
    .await?;
    if let Some(redeemed) = redeemed {
        return Ok(Ok(redeemed));
    }
    let is_bound = sqlx::query_scalar!(
        r#"
SELECT h.client_ip_hash = $2 AS "is_bound!"
FROM moocfi_outbound_handoffs h
  JOIN external_completions ec ON ec.id = h.external_completion_id
  JOIN external_credit_targets t ON t.id = ec.external_credit_target_id
WHERE h.token_digest = $1
  AND h.deleted_at IS NULL
  AND ec.deleted_at IS NULL
  AND t.deleted_at IS NULL
        "#,
        token_digest,
        client_ip_hash,
    )
    .fetch_optional(conn)
    .await?;
    Ok(Err(match is_bound {
        Some(false) => RedeemRefusal::IpMismatch,
        Some(true) => RedeemRefusal::Spent,
        None => RedeemRefusal::Unknown,
    }))
}
