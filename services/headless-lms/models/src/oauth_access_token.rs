use crate::oauth_shared_types::Digest;
use crate::prelude::*;
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use sqlx::types::JsonValue;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct OAuthAccessToken {
    pub digest: Digest,
    pub pepper_id: i16,
    pub user_id: Option<Uuid>,
    pub client_id: Uuid,
    pub scope: Option<String>,
    pub audience: Option<String>,
    pub jti: Uuid,
    pub dpop_jkt: String,
    pub metadata: Option<JsonValue>,
    pub expires_at: DateTime<Utc>,
}

impl OAuthAccessToken {
    pub async fn insert(
        conn: &mut PgConnection,
        digest: Digest,
        pepper_id: i16,
        user_id: Option<Uuid>,
        client_id: Uuid,
        scope: &str,
        audience: &str,
        dpop_jkt: &str,
        metadata: JsonValue,
        expires_at: DateTime<Utc>,
    ) -> sqlx::Result<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            r#"INSERT INTO oauth_access_tokens
               (digest, pepper_id, user_id, client_id, scope, audience, dpop_jkt, metadata, expires_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"#,
            digest.as_bytes(),
            pepper_id,
            user_id,
            client_id,
            scope,
            audience,
            dpop_jkt,
            metadata,
            expires_at
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn find_valid(
        conn: &mut PgConnection,
        digest: Digest,
    ) -> ModelResult<OAuthAccessToken> {
        let mut tx = conn.begin().await?;
        let token = sqlx::query_as!(
            OAuthAccessToken,
            r#"SELECT digest as "digest: _", pepper_id, user_id, client_id, scope, audience, jti, dpop_jkt, metadata, expires_at
               FROM oauth_access_tokens
               WHERE digest = $1 AND expires_at > now()"#,
            digest.as_bytes()
        )
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(token)
    }
}
