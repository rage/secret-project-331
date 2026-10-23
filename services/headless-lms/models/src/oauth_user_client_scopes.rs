use crate::library::oauth::Digest;
use crate::prelude::*;
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

/// A user's grant to a client: the scopes they consented to.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct OAuthUserClientScopes {
    pub id: Uuid,
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub scopes: Vec<String>,
    pub granted_at: DateTime<Utc>,
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

    /// The user's grant to the client, if any.
    pub async fn find_grant(
        conn: &mut PgConnection,
        user_id: Uuid,
        client_id: Uuid,
    ) -> ModelResult<Option<OAuthUserClientScopes>> {
        let grant = sqlx::query_as!(
            OAuthUserClientScopes,
            r#"
SELECT id,
  user_id,
  client_id,
  scopes,
  granted_at
FROM oauth_user_client_scopes
WHERE user_id = $1
  AND client_id = $2
            "#,
            user_id,
            client_id
        )
        .fetch_optional(conn)
        .await?;
        Ok(grant)
    }

    /// The scopes the user has granted to the client; none without a grant.
    pub async fn find_scopes(
        conn: &mut PgConnection,
        user_id: Uuid,
        client_id: Uuid,
    ) -> ModelResult<Vec<String>> {
        Ok(Self::find_grant(conn, user_id, client_id)
            .await?
            .map(|grant| grant.scopes)
            .unwrap_or_default())
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

    /// The user's grants, most recently used first.
    pub async fn get_grants_for_user(
        conn: &mut PgConnection,
        user_id: Uuid,
    ) -> ModelResult<Vec<OAuthGrant>> {
        let res = sqlx::query_as!(
            OAuthGrant,
            r#"
SELECT ucs.id,
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

    /// Records that a token of the grant was used. `last_used_at` is the grant's current value:
    /// within a minute of it nothing is written, so a busy grant costs no write per request.
    pub async fn mark_grant_used(
        conn: &mut PgConnection,
        grant_id: Uuid,
        last_used_at: Option<DateTime<Utc>>,
    ) -> ModelResult<()> {
        if last_used_at.is_some_and(|used_at| Utc::now() - used_at < chrono::TimeDelta::minutes(1))
        {
            return Ok(());
        }
        sqlx::query!(
            "UPDATE oauth_user_client_scopes SET last_used_at = now() WHERE id = $1",
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
        Self::revoke_user_client_everything(conn, user_id, client_id).await
    }
}

/// A user's consent to one client: what the account page lists and revokes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct OAuthGrant {
    pub id: Uuid,
    pub client_name: String,
    pub client_uri: Option<String>,
    /// Whether the client registered through a Client ID Metadata Document, as AI agents do.
    pub is_metadata_document_client: bool,
    pub scopes: Vec<String>,
    pub granted_at: DateTime<Utc>,
    /// Minute resolution; `None` if no token from the grant was ever used.
    pub last_used_at: Option<DateTime<Utc>>,
}
