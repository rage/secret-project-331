use crate::oauth_access_token::{NewAccessTokenParams, OAuthAccessToken, TokenType};
use crate::{library::oauth::Digest, prelude::*};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgConnection};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct OAuthRefreshTokens {
    pub digest: Digest,
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub expires_at: DateTime<Utc>,
    pub scopes: Vec<String>,
    pub audience: Option<Vec<String>>,
    pub jti: Uuid,
    /// Optional DPoP sender constraint
    pub dpop_jkt: Option<String>,
    pub metadata: serde_json::Value,
    pub revoked: bool,
    pub rotated_from: Option<Digest>,
}

#[derive(Debug, Clone)]
pub struct NewRefreshTokenParams<'a> {
    pub digest: &'a Digest,
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub scopes: &'a [String],
    pub audience: Option<&'a [String]>,
    pub expires_at: DateTime<Utc>,
    pub rotated_from: Option<&'a Digest>,
    pub metadata: serde_json::Map<String, serde_json::Value>,
    /// Provide Some(jkt) to sender-constrain this RT; None for unconstrained
    pub dpop_jkt: Option<&'a str>,
}

/// Parameters for rotating a refresh token (refresh token grant flow).
#[derive(Debug)]
pub struct RotateRefreshTokenParams<'a> {
    pub new_refresh_token_digest: &'a Digest,
    pub new_access_token_digest: &'a Digest,
    pub access_token_expires_at: DateTime<Utc>,
    pub refresh_token_expires_at: DateTime<Utc>,
    pub access_token_type: TokenType,
    pub access_token_dpop_jkt: Option<&'a str>,
    pub refresh_token_dpop_jkt: Option<&'a str>,
}

/// Parameters for issuing tokens from an authorization code.
#[derive(Debug, Clone)]
pub struct IssueTokensFromAuthCodeParams<'a> {
    pub user_id: Uuid,
    pub client_id: Uuid,
    pub scopes: &'a [String],
    pub access_token_digest: &'a Digest,
    pub refresh_token_digest: &'a Digest,
    pub access_token_expires_at: DateTime<Utc>,
    pub refresh_token_expires_at: DateTime<Utc>,
    pub access_token_type: TokenType,
    pub access_token_dpop_jkt: Option<&'a str>,
    pub refresh_token_dpop_jkt: Option<&'a str>,
}

impl OAuthRefreshTokens {
    pub async fn insert(
        conn: &mut PgConnection,
        params: NewRefreshTokenParams<'_>,
    ) -> ModelResult<()> {
        sqlx::query!(
            r#"
            INSERT INTO oauth_refresh_tokens
              (digest, user_id, client_id, scopes, audience, jti, expires_at, revoked, rotated_from, metadata, dpop_jkt)
            VALUES
              ($1,    $2,     $3,        $4,     $5,       gen_random_uuid(), $6,       false,   $7,          $8,      $9)
            "#,
            params.digest.as_bytes(),
            params.user_id,
            params.client_id,
            params.scopes,
            params.audience,
            params.expires_at,
            params.rotated_from.map(|d| d.as_bytes() as &[u8]),
            serde_json::Value::Object(params.metadata),
            params.dpop_jkt
        )
        .execute(conn)
        .await?;
        Ok(())
    }

    pub async fn find_valid(
        conn: &mut PgConnection,
        digest: Digest,
    ) -> ModelResult<OAuthRefreshTokens> {
        let mut tx = conn.begin().await?;
        let token = sqlx::query_as!(
            OAuthRefreshTokens,
            r#"
            SELECT
              digest             as "digest: _",
              user_id,
              client_id,
              expires_at,
              scopes,
              audience,
              jti,
              dpop_jkt,
              metadata,
              revoked,
              rotated_from       as "rotated_from: _"
            FROM oauth_refresh_tokens
            WHERE digest = $1
              AND expires_at > now()
              AND revoked = false
            "#,
            digest.as_bytes()
        )
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(token)
    }

    /// Optional stricter variant: if the RT is sender-constrained (has `dpop_jkt`), require a matching `presented_jkt`.
    pub async fn find_valid_for_sender(
        conn: &mut PgConnection,
        digest: Digest,
        presented_jkt: Option<&str>,
    ) -> ModelResult<OAuthRefreshTokens> {
        let t = Self::find_valid(conn, digest).await?;
        if let Some(expected) = t.dpop_jkt.as_deref() {
            let Some(presented) = presented_jkt else {
                return Err(ModelError::new(
                    ModelErrorType::PreconditionFailed,
                    "refresh token requires DPoP but no JKT presented",
                    None::<anyhow::Error>,
                ));
            };
            if expected != presented {
                return Err(ModelError::new(
                    ModelErrorType::PreconditionFailed,
                    "DPoP JKT mismatch for refresh token",
                    None::<anyhow::Error>,
                ));
            }
        }
        Ok(t)
    }

    pub async fn revoke_by_digest(conn: &mut PgConnection, digest: Digest) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        sqlx::query!(
            r#"
            UPDATE oauth_refresh_tokens
               SET revoked = true
             WHERE digest = $1
            "#,
            digest.as_bytes()
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
            r#"
            UPDATE oauth_refresh_tokens
               SET revoked = true
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

    /// Atomically consume (revoke) a valid, unrevoked RT and return it.
    pub async fn consume(
        conn: &mut PgConnection,
        digest: Digest,
    ) -> ModelResult<OAuthRefreshTokens> {
        let row = sqlx::query_as!(
            OAuthRefreshTokens,
            r#"
            UPDATE oauth_refresh_tokens
               SET revoked = true
             WHERE digest = $1
               AND revoked = false
               AND expires_at > now()
            RETURNING
              digest             as "digest: _",
              user_id,
              client_id,
              expires_at,
              scopes,
              audience,
              jti,
              dpop_jkt,
              metadata,
              revoked,
              rotated_from       as "rotated_from: _"
            "#,
            digest.as_bytes()
        )
        .fetch_one(conn)
        .await?;
        Ok(row)
    }

    /// Consume a refresh token within a transaction.
    /// Returns the consumed token data.
    pub async fn consume_in_transaction(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        digest: Digest,
    ) -> ModelResult<OAuthRefreshTokens> {
        let row = sqlx::query_as!(
            OAuthRefreshTokens,
            r#"
            UPDATE oauth_refresh_tokens
               SET revoked = true
             WHERE digest = $1
               AND revoked = false
               AND expires_at > now()
            RETURNING
              digest             as "digest: _",
              user_id,
              client_id,
              expires_at,
              scopes,
              audience,
              jti,
              dpop_jkt,
              metadata,
              revoked,
              rotated_from       as "rotated_from: _"
            "#,
            digest.as_bytes()
        )
        .fetch_one(&mut **tx)
        .await?;
        Ok(row)
    }

    /// Complete refresh token rotation within an existing transaction after token has been consumed.
    /// Revokes all tokens for user/client, inserts new refresh token, and inserts new access token.
    pub async fn complete_refresh_token_rotation_in_transaction(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        old_token: &OAuthRefreshTokens,
        params: RotateRefreshTokenParams<'_>,
    ) -> ModelResult<()> {
        // Revoke all tokens for user/client
        sqlx::query!(
            r#"
            UPDATE oauth_refresh_tokens
               SET revoked = true
             WHERE user_id = $1 AND client_id = $2
            "#,
            old_token.user_id,
            old_token.client_id
        )
        .execute(&mut **tx)
        .await?;

        // Insert new refresh token
        sqlx::query!(
            r#"
            INSERT INTO oauth_refresh_tokens
              (digest, user_id, client_id, scopes, audience, jti, expires_at, revoked, rotated_from, metadata, dpop_jkt)
            VALUES
              ($1,    $2,     $3,        $4,     $5,       gen_random_uuid(), $6,       false,   $7,          $8,      $9)
            "#,
            params.new_refresh_token_digest.as_bytes(),
            old_token.user_id,
            old_token.client_id,
            &old_token.scopes,
            old_token.audience.as_deref(),
            params.refresh_token_expires_at,
            old_token.digest.as_bytes(),
            serde_json::Value::Object(serde_json::Map::new()),
            params.refresh_token_dpop_jkt
        )
        .execute(&mut **tx)
        .await?;

        // Insert new access token
        OAuthAccessToken::insert(
            &mut **tx,
            NewAccessTokenParams {
                digest: params.new_access_token_digest,
                user_id: Some(old_token.user_id),
                client_id: old_token.client_id,
                scopes: &old_token.scopes,
                audience: old_token.audience.as_deref(),
                token_type: params.access_token_type,
                dpop_jkt: params.access_token_dpop_jkt,
                metadata: serde_json::Map::new(),
                expires_at: params.access_token_expires_at,
            },
        )
        .await?;

        Ok(())
    }

    /// Complete refresh token rotation after token has been consumed.
    /// Revokes all tokens for user/client, inserts new refresh token, and inserts new access token.
    pub async fn complete_refresh_token_rotation(
        conn: &mut PgConnection,
        old_token: &OAuthRefreshTokens,
        params: RotateRefreshTokenParams<'_>,
    ) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        Self::complete_refresh_token_rotation_in_transaction(&mut tx, old_token, params).await?;
        tx.commit().await?;
        Ok(())
    }

    /// Atomically rotate refresh token: consume old token, revoke all tokens for user/client,
    /// insert new refresh token, and insert new access token.
    /// Returns the consumed refresh token data for validation.
    pub async fn rotate_refresh_token(
        conn: &mut PgConnection,
        old_refresh_token_digest: Digest,
        params: RotateRefreshTokenParams<'_>,
    ) -> ModelResult<OAuthRefreshTokens> {
        let old = Self::consume(conn, old_refresh_token_digest).await?;
        Self::complete_refresh_token_rotation(conn, &old, params).await?;
        Ok(old)
    }

    /// Issue tokens from authorization code within an existing transaction.
    /// Inserts access token, revokes all refresh tokens for user/client, and inserts new refresh token.
    pub async fn issue_tokens_from_auth_code_in_transaction(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        params: IssueTokensFromAuthCodeParams<'_>,
    ) -> ModelResult<()> {
        // Insert access token
        OAuthAccessToken::insert(
            &mut **tx,
            NewAccessTokenParams {
                digest: params.access_token_digest,
                user_id: Some(params.user_id),
                client_id: params.client_id,
                scopes: params.scopes,
                audience: None,
                token_type: params.access_token_type,
                dpop_jkt: params.access_token_dpop_jkt,
                metadata: serde_json::Map::new(),
                expires_at: params.access_token_expires_at,
            },
        )
        .await?;

        // Revoke all refresh tokens for user/client
        sqlx::query!(
            r#"
            UPDATE oauth_refresh_tokens
               SET revoked = true
             WHERE user_id = $1 AND client_id = $2
            "#,
            params.user_id,
            params.client_id
        )
        .execute(&mut **tx)
        .await?;

        // Insert new refresh token
        sqlx::query!(
            r#"
            INSERT INTO oauth_refresh_tokens
              (digest, user_id, client_id, scopes, audience, jti, expires_at, revoked, rotated_from, metadata, dpop_jkt)
            VALUES
              ($1,    $2,     $3,        $4,     $5,       gen_random_uuid(), $6,       false,   NULL,          $7,      $8)
            "#,
            params.refresh_token_digest.as_bytes(),
            params.user_id,
            params.client_id,
            params.scopes,
            Option::<Vec<String>>::None as Option<Vec<String>>,
            params.refresh_token_expires_at,
            serde_json::Value::Object(serde_json::Map::new()),
            params.refresh_token_dpop_jkt
        )
        .execute(&mut **tx)
        .await?;

        Ok(())
    }

    /// Atomically issue tokens from authorization code: insert access token,
    /// revoke all refresh tokens for user/client, and insert new refresh token.
    pub async fn issue_tokens_from_auth_code(
        conn: &mut PgConnection,
        params: IssueTokensFromAuthCodeParams<'_>,
    ) -> ModelResult<()> {
        let mut tx = conn.begin().await?;
        Self::issue_tokens_from_auth_code_in_transaction(&mut tx, params).await?;
        tx.commit().await?;
        Ok(())
    }
}
