use crate::{oauth_shared_types::Digest, prelude::*};
use chrono::{DateTime, Utc};
use sqlx::PgConnection;
use sqlx::{FromRow, Postgres, postgres::PgArguments, query::Query};
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
    pub metadata: serde_json::Value,
}

/* ------------ internal helper types ------------ */

#[derive(Debug, Clone)]
pub struct NewAuthCodeParams<'a> {
    pub digest: &'a Digest,
    pub pepper_id: i16,
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub redirect_uri: &'a str,
    pub scope: Option<&'a str>,
    pub nonce: Option<&'a str>,
    pub expires_at: DateTime<Utc>,
    pub metadata: serde_json::Map<String, serde_json::Value>,
}

impl OAuthAuthCode {
    #[allow(clippy::too_many_arguments)]
    pub async fn insert(conn: &mut PgConnection, params: NewAuthCodeParams<'_>) -> ModelResult<()> {
        sqlx::query!(
            r#"
            INSERT INTO oauth_auth_codes
                (digest, pepper_id, user_id, client_id, redirect_uri, scope, nonce, expires_at, metadata)
            VALUES ($1,     $2,       $3,      $4,        $5,           $6,   $7,    $8,         $9)
        "#,
            params.digest.as_bytes(),
            params.pepper_id,
            params.user_id,
            params.client_id,
            params.redirect_uri,
            params.scope,
            params.nonce,
            params.expires_at,
            serde_json::Value::Object(params.metadata)
        ).execute(conn)
            .await?;
        Ok(())
    }

    pub async fn consume(conn: &mut PgConnection, digest: Digest) -> ModelResult<OAuthAuthCode> {
        let auth_code = sqlx::query_as!(
            OAuthAuthCode,
            r#"
        UPDATE oauth_auth_codes
        SET used = true
        WHERE digest = $1
          AND used = false
          AND expires_at > now()
        RETURNING
          digest      as "digest: _",
          pepper_id,
          user_id,
          client_id,
          redirect_uri,
          scope,
          jti,
          nonce,
          used,
          expires_at,
          metadata
        "#,
            digest.as_bytes()
        )
        .fetch_one(conn) // RowNotFound if no match (already used/expired/unknown)
        .await?;

        Ok(auth_code)
    }
}
