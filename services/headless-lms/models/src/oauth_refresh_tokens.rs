use crate::{oauth_shared_types::Digest, prelude::*};
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use sqlx::types::JsonValue;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct OAuthRefreshTokens {
    pub digest: Digest,
    pub pepper_id: i16,
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub expires_at: DateTime<Utc>,
    pub scope: String,
    pub audience: Option<String>,
    pub jti: Uuid,
    pub dpop_jkt: String,
    pub metadata: JsonValue,
    pub revoked: bool,
    pub rotated_from: Option<Digest>,
}

impl OAuthRefreshTokens {
    pub async fn insert(
        conn: &mut PgConnection,
        digest: Digest,
        pepper_id: i16,
        user_id: Uuid,
        client_id: Uuid,
        scope: &str,
        audience: &str,
        expires_at: DateTime<Utc>,
        rotated_from: Option<Digest>,
        metadata: Option<JsonValue>,
        dpop_jkt: &str,
    ) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            r#"INSERT INTO oauth_refresh_tokens
            (digest, user_id, client_id, scope, audience, pepper_id, metadata, dpop_jkt, expires_at, rotated_from)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"#,
            digest.as_bytes(),
            user_id,
            client_id,
            scope,
            audience,
            pepper_id,
            metadata,
            dpop_jkt,
            expires_at,
            rotated_from.as_ref().map(|d| d.as_slice())
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn find_valid(
        conn: &mut PgConnection,
        digest: Digest,
    ) -> ModelResult<OAuthRefreshTokens> {
        let mut tx = conn.begin().await?;
        let token = sqlx::query_as!(
            OAuthRefreshTokens,
            r#"SELECT digest as "digest: _", user_id, client_id, scope, expires_at, jti, dpop_jkt, metadata, pepper_id, audience, revoked, rotated_from as "rotated_from: _"
                FROM oauth_refresh_tokens
                WHERE digest = $1 AND expires_at > now() AND revoked = false"#,
            digest.as_slice()
        )
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(token)
    }

    pub async fn revoke_by_digest(conn: &mut PgConnection, digest: Digest) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            "UPDATE oauth_refresh_tokens
                SET revoked = true
                WHERE digest = $1",
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
            "UPDATE oauth_refresh_tokens
                SET revoked = true
                WHERE user_id = $1 AND client_id = $2",
            user_id,
            client_id
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn consume(
        conn: &mut PgConnection,
        digest: Digest,
    ) -> ModelResult<OAuthRefreshTokens> {
        let mut tx = conn.begin().await?;
        let refresh_token = sqlx::query_as!(
            OAuthRefreshTokens,
            r#"SELECT digest as "digest: _", user_id, client_id, scope, expires_at, jti, dpop_jkt, metadata, pepper_id, audience, revoked, rotated_from as "rotated_from: _"
           FROM oauth_refresh_tokens WHERE digest = $1 AND revoked = false AND expires_at > now()"#,
            digest.as_slice()
        )
        .fetch_one(&mut *tx)
        .await?;
        sqlx::query!(
            "UPDATE oauth_refresh_tokens SET revoked = true WHERE digest = $1",
            digest.as_slice()
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(refresh_token)
    }
}
