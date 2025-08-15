use crate::prelude::*;
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct OAuthRefreshTokens {
    pub token: String,
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub expires_at: DateTime<Utc>,
    pub scope: Option<String>,
}

impl OAuthRefreshTokens {
    pub async fn insert(
        conn: &mut PgConnection,
        token: &str,
        user_id: Uuid,
        client_id: Uuid,
        scope: &str,
        expires_at: DateTime<Utc>,
    ) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            r#"INSERT INTO oauth_refresh_tokens
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

    pub async fn find_valid(
        conn: &mut PgConnection,
        token: &str,
    ) -> ModelResult<OAuthRefreshTokens> {
        let mut tx = conn.begin().await?;
        let token = sqlx::query_as!(
            OAuthRefreshTokens,
            r#"SELECT token, user_id, client_id, scope, expires_at
                FROM oauth_refresh_tokens
                WHERE token = $1 AND expires_at > now() AND revoked = false"#,
            token
        )
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(token)
    }

    pub async fn revoke_by_token(conn: &mut PgConnection, token: &str) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            "UPDATE oauth_refresh_tokens
                SET revoked = true
                WHERE token = $1",
            token
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

    pub async fn consume(conn: &mut PgConnection, token: &str) -> ModelResult<OAuthRefreshTokens> {
        let mut tx = conn.begin().await?;
        let refresh_token = sqlx::query_as!(
            OAuthRefreshTokens,
            r#"SELECT token, user_id, client_id, scope, expires_at
           FROM oauth_refresh_tokens WHERE token = $1 AND revoked = false AND expires_at > now()"#,
            token
        )
        .fetch_one(&mut *tx)
        .await?;
        sqlx::query!(
            "UPDATE oauth_refresh_tokens SET revoked = true WHERE token = $1",
            token
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(refresh_token)
    }
}
