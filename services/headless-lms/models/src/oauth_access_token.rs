use crate::prelude::*;
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct OAuthAccessToken {
    pub token: String,
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub scope: Option<String>,
    pub expires_at: DateTime<Utc>,
}

impl OAuthAccessToken {
    pub async fn insert(
        conn: &mut PgConnection,
        token: String,
        user_id: Uuid,
        client_id: Uuid,
        scope: &str,
        expires_at: DateTime<Utc>,
    ) -> sqlx::Result<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            r#"INSERT INTO oauth_access_tokens
               (token, user_id, client_id, scope, expires_at)
               VALUES ($1, $2, $3, $4, $5)"#,
            token,
            user_id,
            client_id,
            scope,
            expires_at
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn find_valid(conn: &mut PgConnection, token: &str) -> ModelResult<OAuthAccessToken> {
        let mut tx = conn.begin().await?;
        let token = sqlx::query_as!(
            OAuthAccessToken,
            r#"SELECT token, user_id, client_id, scope, expires_at
               FROM oauth_access_tokens
               WHERE token = $1 AND expires_at > now()"#,
            token
        )
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(token)
    }
}
