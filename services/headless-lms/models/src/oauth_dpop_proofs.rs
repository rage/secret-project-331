use crate::library::oauth::Digest;
use crate::prelude::*;
use chrono::{DateTime, TimeZone, Utc};
use sqlx::{FromRow, PgConnection};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct OAuthDpopProof {
    pub jti_hash: Digest,           // SHA-256(jti)
    pub seen_at: DateTime<Utc>,     // when first observed (DB default now())
    pub client_id: Option<String>,  // optional audit fields
    pub jkt: Option<String>,        // RFC 7638 thumbprint
    pub htm: Option<String>,        // HTTP method
    pub htu: Option<String>,        // HTTP URL (no query)
    pub iat: Option<DateTime<Utc>>, // issued-at
}

impl OAuthDpopProof {
    /// Atomically record this DPoP proof exactly once.
    /// Returns:
    ///   - Ok(true)  => first time seen (ACCEPT)
    ///   - Ok(false) => already seen (REPLAY -> REJECT)
    pub async fn insert_once(
        conn: &mut PgConnection,
        jti_hash: Digest,
        client_id: Option<&str>,
        jkt: Option<&str>,
        htm: Option<&str>,
        htu: Option<&str>,
        iat_epoch: Option<i64>,
    ) -> ModelResult<bool> {
        let mut tx = conn.begin().await?;

        let iat_ts: Option<DateTime<Utc>> =
            iat_epoch.and_then(|s| Utc.timestamp_opt(s, 0).single());

        let rows = sqlx::query!(
            r#"
            INSERT INTO oauth_dpop_proofs (jti_hash, client_id, jkt, htm, htu, iat)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT DO NOTHING
            "#,
            jti_hash.as_bytes(),
            client_id,
            jkt,
            htm,
            htu,
            iat_ts,
        )
        .execute(&mut *tx)
        .await?
        .rows_affected();

        tx.commit().await?;
        Ok(rows == 1)
    }

    /// Fetch a stored proof row (for audits/debug).
    pub async fn find_by_jti_hash(
        conn: &mut PgConnection,
        jti_hash: Digest,
    ) -> ModelResult<Option<OAuthDpopProof>> {
        let mut tx = conn.begin().await?;
        let row = sqlx::query_as!(
            OAuthDpopProof,
            r#"
            SELECT
              jti_hash  AS "jti_hash: _",
              seen_at   AS "seen_at: _",
              client_id AS "client_id?",
              jkt       AS "jkt?",
              htm       AS "htm?",
              htu       AS "htu?",
              iat       AS "iat?"
            FROM oauth_dpop_proofs
            WHERE jti_hash = $1
            "#,
            jti_hash.as_bytes(),
        )
        .fetch_optional(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(row)
    }

    /// Delete old entries (call from a periodic task).
    /// Returns number of rows removed.
    pub async fn prune_older_than(conn: &mut PgConnection, keep_seconds: i64) -> ModelResult<u64> {
        if keep_seconds < 0 {
            return Err(ModelError::new(
                ModelErrorType::Generic,
                "keep_seconds must be >= 0",
                None,
            ));
        }
        let mut tx = conn.begin().await?;
        let res = sqlx::query!(
            r#"
            DELETE FROM oauth_dpop_proofs
            WHERE seen_at < now() - ($1::bigint * interval '1 second')
            "#,
            keep_seconds,
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(res.rows_affected())
    }
}
