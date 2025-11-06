use crate::{oauth_shared_types::Digest, prelude::*};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgConnection};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct OAuthRefreshTokens {
    pub digest: Digest,
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub expires_at: DateTime<Utc>,
    pub scopes: Vec<String>,
    pub audience: Option<Vec<String>>,
    pub jti: Uuid,
    /// Optional DPoP sender constraint
    pub dpop_jkt: Option<String>,
    pub metadata: serde_json::Value,
    pub revoked: bool,
    pub rotated_from: Option<Digest>,
}

#[derive(Debug, Clone)]
pub struct NewRefreshTokenParams<'a> {
    pub digest: &'a Digest,
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub scopes: &'a [String],
    pub audience: Option<&'a [String]>,
    pub expires_at: DateTime<Utc>,
    pub rotated_from: Option<&'a Digest>,
    pub metadata: serde_json::Map<String, serde_json::Value>,
    /// Provide Some(jkt) to sender-constrain this RT; None for unconstrained
    pub dpop_jkt: Option<&'a str>,
}

impl OAuthRefreshTokens {
    pub async fn insert(
        conn: &mut PgConnection,
        params: NewRefreshTokenParams<'_>,
    ) -> ModelResult<()> {
        sqlx::query!(
            r#"
            INSERT INTO oauth_refresh_tokens
              (digest, user_id, client_id, scopes, audience, jti, expires_at, revoked, rotated_from, metadata, dpop_jkt)
            VALUES
              ($1,    $2,     $3,        $4,     $5,       gen_random_uuid(), $6,       false,   $7,          $8,      $9)
            "#,
            params.digest.as_bytes(),
            params.user_id,
            params.client_id,
            params.scopes,
            params.audience,
            params.expires_at,
            params.rotated_from.map(|d| d.as_bytes() as &[u8]),
            serde_json::Value::Object(params.metadata),
            params.dpop_jkt
        )
        .execute(conn)
        .await?;
        Ok(())
    }

    pub async fn find_valid(
        conn: &mut PgConnection,
        digest: Digest,
    ) -> ModelResult<OAuthRefreshTokens> {
        let mut tx = conn.begin().await?;
        let token = sqlx::query_as!(
            OAuthRefreshTokens,
            r#"
            SELECT
              digest             as "digest: _",
              user_id,
              client_id,
              expires_at,
              scopes,
              audience,
              jti,
              dpop_jkt,
              metadata,
              revoked,
              rotated_from       as "rotated_from: _"
            FROM oauth_refresh_tokens
            WHERE digest = $1
              AND expires_at > now()
              AND revoked = false
            "#,
            digest.as_bytes()
        )
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(token)
    }

    /// Optional stricter variant: if the RT is sender-constrained (has `dpop_jkt`), require a matching `presented_jkt`.
    pub async fn find_valid_for_sender(
        conn: &mut PgConnection,
        digest: Digest,
        presented_jkt: Option<&str>,
    ) -> ModelResult<OAuthRefreshTokens> {
        let t = Self::find_valid(conn, digest).await?;
        if let Some(expected) = t.dpop_jkt.as_deref() {
            let Some(presented) = presented_jkt else {
                return Err(ModelError::new(
                    ModelErrorType::PreconditionFailed,
                    "refresh token requires DPoP but no JKT presented",
                    None::<anyhow::Error>,
                ));
            };
            if expected != presented {
                return Err(ModelError::new(
                    ModelErrorType::PreconditionFailed,
                    "DPoP JKT mismatch for refresh token",
                    None::<anyhow::Error>,
                ));
            }
        }
        Ok(t)
    }

    pub async fn revoke_by_digest(conn: &mut PgConnection, digest: Digest) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            r#"
            UPDATE oauth_refresh_tokens
               SET revoked = true
             WHERE digest = $1
            "#,
            digest.as_bytes()
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn revoke_all_by_user_client(
        conn: &mut PgConnection,
        user_id: Uuid,
        client_id: Uuid,
    ) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            r#"
            UPDATE oauth_refresh_tokens
               SET revoked = true
             WHERE user_id = $1 AND client_id = $2
            "#,
            user_id,
            client_id
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    /// Atomically consume (revoke) a valid, unrevoked RT and return it.
    pub async fn consume(
        conn: &mut PgConnection,
        digest: Digest,
    ) -> ModelResult<OAuthRefreshTokens> {
        let row = sqlx::query_as!(
            OAuthRefreshTokens,
            r#"
            UPDATE oauth_refresh_tokens
               SET revoked = true
             WHERE digest = $1
               AND revoked = false
               AND expires_at > now()
            RETURNING
              digest             as "digest: _",
              user_id,
              client_id,
              expires_at,
              scopes,
              audience,
              jti,
              dpop_jkt,
              metadata,
              revoked,
              rotated_from       as "rotated_from: _"
            "#,
            digest.as_bytes()
        )
        .fetch_one(conn)
        .await?;
        Ok(row)
    }
}
