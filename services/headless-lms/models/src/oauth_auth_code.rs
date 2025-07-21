use crate::prelude::*;
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct OAuthAuthCode {
    pub code: String,
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub redirect_uri: String,
    pub scope: Option<String>,
    pub nonce: Option<String>,
    pub used: bool,
    pub expires_at: DateTime<Utc>,
}

impl OAuthAuthCode {
    pub async fn insert(
        conn: &mut PgConnection,
        code: &str,
        user_id: Uuid,
        client_id: Uuid,
        redirect_uri: &str,
        scope: &str,
        nonce: &str,
        expires_at: DateTime<Utc>,
    ) -> sqlx::Result<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            r#"INSERT INTO oauth_auth_codes
               (code, user_id, client_id, redirect_uri, scope, nonce, used, expires_at)
               VALUES ($1, $2, $3, $4, $5, $6, false, $7)"#,
            code,
            user_id,
            client_id,
            redirect_uri,
            scope,
            nonce,
            expires_at
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(())
    }

    pub async fn consume(conn: &mut PgConnection, code: &str) -> ModelResult<OAuthAuthCode> {
        let mut tx = conn.begin().await?;
        let auth_code = sqlx::query_as!(
            OAuthAuthCode,
            r#"SELECT code, user_id, client_id, redirect_uri, scope, nonce, used, expires_at
               FROM oauth_auth_codes WHERE code = $1 AND used = false AND expires_at > now()"#,
            code
        )
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query!(
            "UPDATE oauth_auth_codes SET used = true WHERE code = $1",
            code
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(auth_code)
    }
}
