use crate::prelude::*;
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct OAuthUserClientScopes {
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub scope: String,
    pub granted_at: DateTime<Utc>,
}

impl OAuthUserClientScopes {
    pub async fn insert(
        conn: &mut PgConnection,
        user_id: Uuid,
        client_id: Uuid,
        scope: String,
    ) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            r#"
                INSERT INTO oauth_user_client_scopes
                (user_id, client_id, scope)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
            "#,
            user_id,
            client_id,
            scope
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn find_scopes(
        conn: &mut PgConnection,
        user_id: Uuid,
        client_id: Uuid,
    ) -> ModelResult<Vec<String>> {
        let mut tx = conn.begin().await?;
        let scopes = sqlx::query_scalar!(
            r#"
            SELECT scope
            FROM oauth_user_client_scopes
            WHERE user_id = $1 AND client_id = $2
        "#,
            user_id,
            client_id
        )
        .fetch_all(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(scopes)
    }
}
