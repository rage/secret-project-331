use crate::oauth_shared_types::Digest;
use crate::prelude::*;
use chrono::{DateTime, Utc};
use sqlx::{self, FromRow};
use sqlx::{PgConnection, Postgres, postgres::PgArguments, query::Query};
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
    pub metadata: serde_json::Value,
    pub expires_at: DateTime<Utc>,
}

/// Internal helper: groups bind params for the INSERT.
#[derive(Debug, Clone)]
struct NewAccessTokenParams<'a> {
    digest_bytes: &'a [u8],
    pepper_id: i16,
    user_id: Option<Uuid>,
    client_id: Uuid,
    scope: Option<&'a str>,
    audience: Option<&'a str>,
    jti: Uuid,
    dpop_jkt: &'a str,
    metadata: &'a serde_json::Value,
    expires_at: DateTime<Utc>,
}

/// Internal helper: perform the binds in one place (idiomatic SQLx pattern).
fn bind_access_token<'q>(
    mut q: Query<'q, Postgres, PgArguments>,
    p: &NewAccessTokenParams<'q>,
) -> Query<'q, Postgres, PgArguments> {
    q = q
        .bind(p.digest_bytes)
        .bind(p.pepper_id)
        .bind(p.user_id)
        .bind(p.client_id)
        .bind(p.scope)
        .bind(p.audience)
        .bind(p.jti)
        .bind(p.dpop_jkt)
        .bind(p.metadata)
        .bind(p.expires_at);
    q
}

impl OAuthAccessToken {
    /// Insert a new access token (with jti).
    ///
    /// NOTE: `scope`/`audience` accept `Option<String>` to map to NULL cleanly.
    /// If you prefer `&str`, pass `None` for empty ones at call sites.
    pub async fn insert(
        conn: &mut PgConnection,
        digest: Digest,
        pepper_id: i16,
        user_id: Option<Uuid>,
        client_id: Uuid,
        jti: Uuid,
        scope: Option<String>,
        audience: Option<String>,
        dpop_jkt: String,
        metadata: serde_json::Map<String, serde_json::Value>,
        expires_at: DateTime<Utc>,
    ) -> sqlx::Result<()> {
        let params = NewAccessTokenParams {
            digest_bytes: digest.as_bytes(),
            pepper_id,
            user_id,
            client_id,
            scope: scope.as_deref(),
            audience: audience.as_deref(),
            jti,
            dpop_jkt: &dpop_jkt,
            metadata: &serde_json::Value::Object(metadata),
            expires_at,
        };

        let sql = r#"
            INSERT INTO oauth_access_tokens
                (digest, pepper_id, user_id, client_id, scope, audience, jti, dpop_jkt, metadata, expires_at)
            VALUES ($1,     $2,       $3,      $4,        $5,    $6,       $7,  $8,       $9,       $10)
        "#;

        let mut tx = conn.begin().await?;
        bind_access_token(sqlx::query(sql), &params)
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
            r#"
            SELECT
              digest as "digest: _",
              pepper_id,
              user_id,
              client_id,
              scope,
              audience,
              jti,
              dpop_jkt,
              metadata,
              expires_at
            FROM oauth_access_tokens
            WHERE digest = $1 AND expires_at > now()
            "#,
            digest.as_bytes()
        )
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(token)
    }

    pub async fn delete_all_by_user_client(
        conn: &mut PgConnection,
        user_id: Uuid,
        client_id: Uuid,
    ) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            r#"
            DELETE FROM oauth_access_tokens
            WHERE user_id = $1 AND client_id = $2
            "#,
            user_id,
            client_id
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }
}
