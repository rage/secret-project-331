use crate::{oauth_shared_types::Digest, prelude::*};
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use sqlx::types::JsonValue;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct OAuthAuthCode {
    pub digest: Digest,
    pub pepper_id: i16,
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub redirect_uri: String,
    pub scope: Option<String>,
    pub jti: Uuid,
    pub nonce: Option<String>,
    pub used: bool,
    pub expires_at: DateTime<Utc>,
    pub metadata: JsonValue,
}

impl OAuthAuthCode {
    #[allow(clippy::too_many_arguments)]
    pub async fn insert(
        conn: &mut PgConnection,
        digest: Digest,
        pepper_id: i16,
        user_id: Uuid,
        client_id: Uuid,
        redirect_uri: &str,
        scope: &str,
        nonce: &str,
        expires_at: DateTime<Utc>,
        metadata: Option<JsonValue>,
    ) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            r#"INSERT INTO oauth_auth_codes
               (digest, pepper_id, user_id, client_id, redirect_uri, scope, nonce, expires_at, metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"#,
            digest.as_bytes(),
            pepper_id,
            user_id,
            client_id,
            redirect_uri,
            scope,
            nonce,
            expires_at,
            metadata
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(())
    }

    pub async fn consume(conn: &mut PgConnection, digest: Digest) -> ModelResult<OAuthAuthCode> {
        let mut tx = conn.begin().await?;
        let auth_code = sqlx::query_as!(
            OAuthAuthCode,
            r#"SELECT digest as "digest: _",pepper_id, user_id, client_id, redirect_uri, scope, jti, nonce, used, expires_at, metadata
               FROM oauth_auth_codes WHERE digest = $1 AND used = false AND expires_at > now()"#,
            digest.as_bytes()
        )
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query!(
            "UPDATE oauth_auth_codes SET used = true WHERE digest = $1",
            digest.as_bytes()
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(auth_code)
    }
}
