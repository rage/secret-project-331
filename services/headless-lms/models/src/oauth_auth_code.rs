use crate::{library::oauth::Digest, prelude::*};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgConnection};
use uuid::Uuid;

use crate::library::oauth::pkce::PkceMethod;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct OAuthAuthCode {
    pub digest: Digest,
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
    pub jti: Uuid,
    pub nonce: Option<String>,

    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<PkceMethod>,

    pub dpop_jkt: Option<String>,

    pub used: bool,
    pub expires_at: DateTime<Utc>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct NewAuthCodeParams<'a> {
    pub digest: &'a Digest,
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub redirect_uri: &'a str,
    pub scopes: &'a [String],
    pub nonce: Option<&'a str>,

    pub code_challenge: Option<&'a str>,
    pub code_challenge_method: Option<PkceMethod>,

    pub dpop_jkt: Option<&'a str>,

    pub expires_at: DateTime<Utc>,
    pub metadata: serde_json::Map<String, serde_json::Value>,
}

impl<'a> NewAuthCodeParams<'a> {
    pub fn validate(&self) -> ModelResult<()> {
        // If one PKCE field is set, the other must also be set (mirrors DB check)
        match (self.code_challenge, self.code_challenge_method) {
            (Some(_), Some(_)) | (None, None) => {}
            _ => {
                return Err(ModelError::new(
                    ModelErrorType::InvalidRequest,
                    "PKCE: code_challenge and code_challenge_method must be provided together",
                    None::<anyhow::Error>,
                ));
            }
        }
        Ok(())
    }
}

impl OAuthAuthCode {
    pub async fn insert(conn: &mut PgConnection, params: NewAuthCodeParams<'_>) -> ModelResult<()> {
        params.validate()?;

        sqlx::query!(
            r#"
            INSERT INTO oauth_auth_codes (
                digest,
                user_id,
                client_id,
                redirect_uri,
                scopes,
                nonce,
                code_challenge,
                code_challenge_method,
                dpop_jkt,
                expires_at,
                metadata
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
            )
            "#,
            params.digest.as_bytes(),
            params.user_id,
            params.client_id,
            params.redirect_uri,
            params.scopes,
            params.nonce,
            params.code_challenge,
            // Cast enum for sqlx macro
            params.code_challenge_method as Option<PkceMethod>,
            params.dpop_jkt,
            params.expires_at,
            serde_json::Value::Object(params.metadata)
        )
        .execute(conn)
        .await?;

        Ok(())
    }

    /// Consume an authorization code within an existing transaction.
    ///
    /// # Transaction Requirements
    /// This method must be called within an existing database transaction.
    /// The caller is responsible for managing the transaction (begin, commit, rollback).
    ///
    /// Returns the consumed code data.
    pub async fn consume_in_transaction(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        digest: Digest,
        client_id: Uuid,
    ) -> ModelResult<OAuthAuthCode> {
        let auth_code = sqlx::query_as!(
            OAuthAuthCode,
            r#"
            UPDATE oauth_auth_codes
               SET used = true
             WHERE digest = $1
               AND client_id = $2
               AND used = false
               AND expires_at > now()
            RETURNING
              digest                   as "digest: _",
              user_id,
              client_id,
              redirect_uri,
              scopes,
              jti,
              nonce,
              code_challenge,
              code_challenge_method    as "code_challenge_method: PkceMethod",
              dpop_jkt,
              used,
              expires_at,
              metadata
            "#,
            digest.as_bytes(),
            client_id
        )
        .fetch_one(&mut **tx)
        .await?;

        Ok(auth_code)
    }

    /// Consume an authorization code with redirect URI check within an existing transaction.
    ///
    /// # Transaction Requirements
    /// This method must be called within an existing database transaction.
    /// The caller is responsible for managing the transaction (begin, commit, rollback).
    ///
    /// Returns the consumed code data.
    pub async fn consume_with_redirect_in_transaction(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        digest: Digest,
        client_id: Uuid,
        redirect_uri: &str,
    ) -> ModelResult<OAuthAuthCode> {
        let auth_code = sqlx::query_as!(
            OAuthAuthCode,
            r#"
            UPDATE oauth_auth_codes
               SET used = true
             WHERE digest = $1
               AND client_id = $2
               AND redirect_uri = $3
               AND used = false
               AND expires_at > now()
            RETURNING
              digest                   as "digest: _",
              user_id,
              client_id,
              redirect_uri,
              scopes,
              jti,
              nonce,
              code_challenge,
              code_challenge_method    as "code_challenge_method: PkceMethod",
              dpop_jkt,
              used,
              expires_at,
              metadata
            "#,
            digest.as_bytes(),
            client_id,
            redirect_uri
        )
        .fetch_one(&mut **tx)
        .await?;

        Ok(auth_code)
    }
}
