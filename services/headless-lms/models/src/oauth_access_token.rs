use crate::oauth_shared_types::Digest;
use crate::prelude::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{self, FromRow, PgConnection, Type};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "token_type")]
pub enum TokenType {
    Bearer,
    DPoP,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow)]
pub struct OAuthAccessToken {
    pub digest: Digest,
    pub user_id: Option<Uuid>,
    pub client_id: Uuid,
    pub scopes: Vec<String>,
    pub audience: Option<Vec<String>>,
    pub jti: Uuid,

    /// Sender constraint: present only when `token_type = DPoP`
    pub dpop_jkt: Option<String>,

    pub token_type: TokenType,

    pub metadata: serde_json::Value,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct NewAccessTokenParams<'a> {
    pub digest: &'a Digest,
    pub user_id: Option<Uuid>,
    pub client_id: Uuid,
    pub scopes: &'a [String],
    pub audience: Option<&'a [String]>,

    /// Set to `TokenType::Bearer` **and** leave `dpop_jkt` = None for Bearer tokens.
    /// Set to `TokenType::DPoP` **and** provide `dpop_jkt = Some(...)` for DPoP tokens.
    pub token_type: TokenType,
    pub dpop_jkt: Option<&'a str>,

    pub metadata: serde_json::Map<String, serde_json::Value>,
    pub expires_at: DateTime<Utc>,
}

impl OAuthAccessToken {
    /// Insert a new access token (with jti).
    ///
    /// DB constraint requires:
    ///  - Bearer  => dpop_jkt = NULL
    ///  - DPoP    => dpop_jkt IS NOT NULL
    pub async fn insert(
        conn: &mut PgConnection,
        params: NewAccessTokenParams<'_>,
    ) -> ModelResult<()> {
        match (params.token_type, params.dpop_jkt) {
            (TokenType::Bearer, None) => {}
            (TokenType::Bearer, Some(_)) => {
                return Err(ModelError::new(
                    ModelErrorType::InvalidRequest,
                    "Bearer tokens must not include dpop_jkt",
                    None::<anyhow::Error>,
                ));
            }
            (TokenType::DPoP, Some(_)) => {}
            (TokenType::DPoP, None) => {
                return Err(ModelError::new(
                    ModelErrorType::InvalidRequest,
                    "DPoP tokens must include dpop_jkt",
                    None::<anyhow::Error>,
                ));
            }
        }

        sqlx::query!(
            r#"
            INSERT INTO oauth_access_tokens
              (digest, user_id, client_id, scopes, audience, token_type, dpop_jkt, metadata, expires_at)
            VALUES
              ($1,    $2,     $3,       $4,     $5,       $6,         $7,       $8,       $9)
            "#,
            params.digest.as_bytes(),
            params.user_id,
            params.client_id,
            params.scopes,
            params.audience,
            params.token_type as TokenType,
            params.dpop_jkt,
            serde_json::Value::Object(params.metadata),
            params.expires_at
        )
        .execute(conn)
        .await?;
        Ok(())
    }

    /// Find a still-valid token by digest (no sender enforcement).
    pub async fn find_valid(
        conn: &mut PgConnection,
        digest: Digest,
    ) -> ModelResult<OAuthAccessToken> {
        let token = sqlx::query_as!(
            OAuthAccessToken,
            r#"
            SELECT
              digest        as "digest: _",
              user_id,
              client_id,
              scopes,
              audience,
              jti,
              dpop_jkt,
              token_type    as "token_type: TokenType",
              metadata,
              expires_at
            FROM oauth_access_tokens
            WHERE digest = $1 AND expires_at > now()
            "#,
            digest.as_bytes()
        )
        .fetch_one(conn)
        .await?;
        Ok(token)
    }

    /// Find a still-valid token by digest and enforce sender:
    ///  - DPoP => `dpop_jkt` must match `sender_jkt`
    ///  - Bearer => sender is ignored
    pub async fn find_valid_for_sender(
        conn: &mut PgConnection,
        digest: Digest,
        sender_jkt: Option<&str>,
    ) -> ModelResult<OAuthAccessToken> {
        let t = Self::find_valid(conn, digest).await?;

        match t.token_type {
            TokenType::Bearer => Ok(t),
            TokenType::DPoP => {
                let Some(expected) = t.dpop_jkt.as_deref() else {
                    return Err(ModelError::new(
                        ModelErrorType::PreconditionFailed,
                        "token missing dpop_jkt",
                        None::<anyhow::Error>,
                    ));
                };
                let Some(presented) = sender_jkt else {
                    return Err(ModelError::new(
                        ModelErrorType::PreconditionFailed,
                        "DPoP proof missing JKT",
                        None::<anyhow::Error>,
                    ));
                };
                if expected != presented {
                    return Err(ModelError::new(
                        ModelErrorType::PreconditionFailed,
                        "DPoP JKT mismatch",
                        None::<anyhow::Error>,
                    ));
                }
                Ok(t)
            }
        }
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
