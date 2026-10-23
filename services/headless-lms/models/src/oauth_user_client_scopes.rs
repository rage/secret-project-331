use crate::library::oauth::Digest;
use crate::prelude::*;
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct OAuthUserClientScopes {
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub scopes: Vec<String>,
    pub granted_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, FromRow, Serialize, Deserialize, ToSchema)]
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
                                ON CONFLICT (user_id, client_id) DO UPDATE
                  SET scopes = EXCLUDED.scopes,
                      granted_at = NOW()
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
              ) AS "scopes!"
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
    ///
    /// Returns the digests of the deleted access tokens so the caller can evict their
    /// cached user mappings; without that they keep authenticating until the cache TTL.
    pub async fn revoke_user_client_everything(
        conn: &mut PgConnection,
        user_id: Uuid,
        client_id: Uuid,
    ) -> ModelResult<Vec<Digest>> {
        let mut tx = conn.begin().await?;

        sqlx::query!(
            r#"DELETE FROM oauth_user_client_scopes WHERE user_id = $1 AND client_id = $2"#,
            user_id,
            client_id
        )
        .execute(&mut *tx)
        .await?;

        let deleted_digests =
            crate::oauth_refresh_tokens::OAuthRefreshTokens::revoke_grant_in_transaction(
                &mut tx, user_id, client_id,
            )
            .await?;

        tx.commit().await?;
        Ok(deleted_digests)
    }
}

/// A user's consent to one client: what the account page lists and revokes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct OAuthGrant {
    pub id: Uuid,
    /// `oauth_clients.id`.
    pub client_id: Uuid,
    /// The client's public `client_id`; the metadata document URL for agent clients.
    pub client_identifier: String,
    pub client_name: String,
    pub client_uri: Option<String>,
    /// Whether the client registered through a Client ID Metadata Document, as AI agents do.
    pub is_metadata_document_client: bool,
    pub scopes: Vec<String>,
    pub granted_at: DateTime<Utc>,
    /// Minute resolution; `None` if no token from the grant was ever used.
    pub last_used_at: Option<DateTime<Utc>>,
}

/// The user's grants, most recently used first.
pub async fn get_grants_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<OAuthGrant>> {
    let res = sqlx::query_as!(
        OAuthGrant,
        r#"
SELECT ucs.id,
  c.id AS client_id,
  c.client_id AS client_identifier,
  c.client_name,
  c.client_uri,
  (c.metadata_document_fetched_at IS NOT NULL) AS "is_metadata_document_client!",
  ucs.scopes,
  ucs.granted_at,
  ucs.last_used_at
FROM oauth_user_client_scopes ucs
  JOIN oauth_clients c ON c.id = ucs.client_id
WHERE ucs.user_id = $1
  AND c.deleted_at IS NULL
ORDER BY ucs.last_used_at DESC NULLS LAST,
  ucs.granted_at DESC
        "#,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The grant behind a (user, client) pair's tokens.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GrantScopes {
    pub id: Uuid,
    pub scopes: Vec<String>,
}

pub async fn get_grant_by_user_and_client(
    conn: &mut PgConnection,
    user_id: Uuid,
    client_id: Uuid,
) -> ModelResult<Option<GrantScopes>> {
    let res = sqlx::query_as!(
        GrantScopes,
        r#"
SELECT id,
  scopes
FROM oauth_user_client_scopes
WHERE user_id = $1
  AND client_id = $2
        "#,
        user_id,
        client_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// Records that a token of the grant was used, at most once a minute per grant.
pub async fn mark_grant_used(conn: &mut PgConnection, grant_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE oauth_user_client_scopes
SET last_used_at = now()
WHERE id = $1
  AND (
    last_used_at IS NULL
    OR last_used_at < now() - INTERVAL '1 minute'
  )
        "#,
        grant_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Revokes one of the user's grants with all its tokens. Errors with `RecordNotFound` if the
/// grant is not the user's. Returns the deleted access-token digests for cache eviction.
pub async fn revoke_grant_by_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    grant_id: Uuid,
) -> ModelResult<Vec<Digest>> {
    let client_id = sqlx::query_scalar!(
        "SELECT client_id FROM oauth_user_client_scopes WHERE id = $1 AND user_id = $2",
        grant_id,
        user_id
    )
    .fetch_one(&mut *conn)
    .await?;
    OAuthUserClientScopes::revoke_user_client_everything(conn, user_id, client_id).await
}
