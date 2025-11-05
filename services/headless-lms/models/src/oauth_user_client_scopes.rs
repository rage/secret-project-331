use crate::prelude::*;
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct OAuthUserClientScopes {
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub scopes: Vec<String>,
    pub granted_at: DateTime<Utc>,
}

#[cfg_attr(feature = "ts_rs", derive(TS))]
#[derive(Debug, Clone, PartialEq, FromRow, Serialize, Deserialize)]
pub struct AuthorizedClientInfo {
    pub client_id: Uuid,     // oauth_clients.id
    pub client_name: String, // oauth_clients.client_id (display/name)
    pub scopes: Vec<String>,
}

impl OAuthUserClientScopes {
    pub async fn insert(
        conn: &mut PgConnection,
        user_id: Uuid,
        client_id: Uuid,
        scopes: &[String],
    ) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            r#"
                INSERT INTO oauth_user_client_scopes
                (user_id, client_id, scopes)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
            "#,
            user_id,
            client_id,
            scopes
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
        let rows = sqlx::query!(
            r#"
            SELECT scopes
            FROM oauth_user_client_scopes
            WHERE user_id = $1 AND client_id = $2
        "#,
            user_id,
            client_id
        )
        .fetch_all(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(rows.into_iter().flat_map(|r| r.scopes).collect())
    }

    pub async fn find_distinct_clients(
        conn: &mut PgConnection,
        user_id: Uuid,
    ) -> ModelResult<Vec<Uuid>> {
        let mut tx = conn.begin().await?;
        let rows = sqlx::query!(
            r#"
            SELECT DISTINCT client_id
            FROM oauth_user_client_scopes
            WHERE user_id = $1
            "#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(rows.into_iter().map(|r| r.client_id).collect())
    }

    pub async fn delete_all_for_user_client(
        conn: &mut PgConnection,
        user_id: Uuid,
        client_id: Uuid,
    ) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            r#"DELETE FROM oauth_user_client_scopes WHERE user_id = $1 AND client_id = $2"#,
            user_id,
            client_id
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn list_authorized_clients_for_user(
        conn: &mut PgConnection,
        user_id: Uuid,
    ) -> ModelResult<Vec<AuthorizedClientInfo>> {
        let mut tx = conn.begin().await?;
        // Aggregate scopes and join to clients to fetch the human-readable name (client.client_id)

        let rows = sqlx::query_as!(
            AuthorizedClientInfo,
            r#"
            SELECT
              c.id        AS client_id,
              c.client_id AS client_name,
              COALESCE(
                array_agg(DISTINCT s.scope ORDER BY s.scope) FILTER (WHERE s.scope IS NOT NULL),
                '{}'::text[]
              ) AS "scopes!: Vec<String>"
            FROM oauth_user_client_scopes ucs
            JOIN oauth_clients c ON c.id = ucs.client_id
            LEFT JOIN LATERAL unnest(ucs.scopes) AS s(scope) ON TRUE
            WHERE ucs.user_id = $1
            GROUP BY c.id, c.client_id
            ORDER BY c.client_id
            "#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(rows)
    }

    /// One-shot revoke: remove all scopes and tokens for a (user, client) pair atomically.
    pub async fn revoke_user_client_everything(
        conn: &mut PgConnection,
        user_id: Uuid,
        client_id: Uuid,
    ) -> ModelResult<()> {
        let mut tx = conn.begin().await?;

        sqlx::query!(
            r#"DELETE FROM oauth_user_client_scopes WHERE user_id = $1 AND client_id = $2"#,
            user_id,
            client_id
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"DELETE FROM oauth_access_tokens WHERE user_id = $1 AND client_id = $2"#,
            user_id,
            client_id
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"UPDATE oauth_refresh_tokens SET revoked = true WHERE user_id = $1 AND client_id = $2"#,
            user_id,
            client_id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }
}
