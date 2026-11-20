//! Proof-of-work challenges already redeemed, so each solved challenge is accepted only once.

use sha2::{Digest, Sha256};

use crate::prelude::*;

/// Marks the challenge with `signature` as redeemed. Returns false when it was redeemed before.
///
/// `expires_at` is the challenge's own expiry: the row is only needed until then.
pub async fn try_spend(
    conn: &mut PgConnection,
    signature: &str,
    expires_at: DateTime<Utc>,
) -> ModelResult<bool> {
    let result = sqlx::query!(
        r#"
INSERT INTO altcha_spent_challenges (signature_digest, expires_at)
VALUES ($1, $2)
ON CONFLICT (signature_digest) DO NOTHING
"#,
        Sha256::digest(signature.as_bytes()).to_vec(),
        expires_at,
    )
    .execute(conn)
    .await?;
    Ok(result.rows_affected() == 1)
}

/// Hard-deletes challenges that expired over an hour ago. Returns how many rows went.
///
/// The margin covers clock skew between the database and the servers that check expiry: a row
/// deleted while a server still considers its challenge unexpired would let the solution in again.
pub async fn delete_expired(conn: &mut PgConnection) -> ModelResult<u64> {
    let result = sqlx::query!(
        r#"
DELETE FROM altcha_spent_challenges
WHERE expires_at <= now() - INTERVAL '1 hour'
"#,
    )
    .execute(conn)
    .await?;
    Ok(result.rows_affected())
}
