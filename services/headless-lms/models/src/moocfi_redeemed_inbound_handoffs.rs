//! The spent ids of handoffs from mooc.fi, which make the signed handoff tokens single use.

use crate::prelude::*;

/// Spends the handoff `jti`, which expires at `expires_at`, and prunes those expired over a day
/// ago. False when it was spent already. Atomic across replicas: of two concurrent spends only one
/// inserts.
pub async fn spend(
    conn: &mut PgConnection,
    jti: Uuid,
    expires_at: DateTime<Utc>,
) -> ModelResult<bool> {
    sqlx::query!(
        r#"
DELETE FROM moocfi_redeemed_inbound_handoffs
WHERE expires_at < now() - INTERVAL '1 day'
        "#,
    )
    .execute(&mut *conn)
    .await?;
    let spent = sqlx::query!(
        r#"
INSERT INTO moocfi_redeemed_inbound_handoffs (jti, expires_at)
VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING
        "#,
        jti,
        expires_at,
    )
    .execute(conn)
    .await?
    .rows_affected()
        == 1;
    Ok(spent)
}
