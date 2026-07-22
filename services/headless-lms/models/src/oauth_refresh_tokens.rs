use crate::oauth_access_token::{NewAccessTokenParams, OAuthAccessToken, TokenType};
use crate::{library::oauth::Digest, prelude::*};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgConnection};
use uuid::Uuid;

/// **INTERNAL/DATABASE-ONLY MODEL - DO NOT EXPOSE TO CLIENTS**
///
/// This struct is a database model that contains a `Digest` field, which contains raw bytes
/// and uses custom (de)serialization. This model must **never** be serialized into external
/// API payloads or returned directly to clients.
///
/// For external-facing responses, use DTOs such as `TokenResponse`, `UserInfoResponse`, or
/// an explicit redacting wrapper that strips or converts `Digest` fields to safe types (e.g., strings).
///
/// **Rationale**: The `Digest` type contains sensitive raw bytes and uses custom serialization
/// that is not suitable for external APIs. Exposing this model directly could leak internal
/// implementation details or cause serialization issues.
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
    /// When this token was superseded by rotation. `None` for active tokens and
    /// for hard-revoked tokens (cleared on hard revoke). Non-`None` marks a
    /// token eligible for the reuse grace window.
    pub rotated_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
            SELECT *
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
               SET revoked = true,
                   rotated_at = NULL
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
               SET revoked = true,
                   rotated_at = NULL
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

    /// Consume a refresh token within an existing transaction.
    ///
    /// # Transaction Requirements
    /// This method must be called within an existing database transaction.
    /// The caller is responsible for managing the transaction (begin, commit, rollback).
    ///
    /// Returns the consumed token data.
    pub async fn consume_in_transaction(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        digest: Digest,
        client_id: Uuid,
    ) -> ModelResult<OAuthRefreshTokens> {
        let row = sqlx::query_as!(
            OAuthRefreshTokens,
            r#"
            UPDATE oauth_refresh_tokens
               SET revoked = true
             WHERE digest = $1
               AND client_id = $2
               AND revoked = false
               AND expires_at > now()
            RETURNING *
            "#,
            digest.as_bytes(),
            client_id
        )
        .fetch_one(&mut **tx)
        .await?;
        Ok(row)
    }

    /// Complete refresh token rotation within an existing transaction after token has been consumed.
    ///
    /// # Transaction Requirements
    /// This method must be called within an existing database transaction.
    /// The caller is responsible for managing the transaction (begin, commit, rollback).
    ///
    /// Revokes all tokens for user/client, inserts new refresh token, and inserts new access token.
    pub async fn complete_refresh_token_rotation_in_transaction(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        old_token: &OAuthRefreshTokens,
        params: RotateRefreshTokenParams<'_>,
    ) -> ModelResult<()> {
        // Revoke the whole family and clear any prior rotation marker so only the
        // token rotated *now* is eligible for the reuse grace window.
        sqlx::query!(
            r#"
            UPDATE oauth_refresh_tokens
               SET revoked = true,
                   rotated_at = NULL
             WHERE user_id = $1 AND client_id = $2
            "#,
            old_token.user_id,
            old_token.client_id
        )
        .execute(&mut **tx)
        .await?;

        // Mark the token that was just rotated as reusable within the grace window.
        sqlx::query!(
            r#"
            UPDATE oauth_refresh_tokens
               SET rotated_at = now()
             WHERE digest = $1
            "#,
            old_token.digest.as_bytes()
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
            tx,
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

    /// Issue tokens from authorization code within an existing transaction.
    ///
    /// # Transaction Requirements
    /// This method must be called within an existing database transaction.
    /// The caller is responsible for managing the transaction (begin, commit, rollback).
    ///
    /// Inserts access token, revokes all refresh tokens for user/client, and inserts new refresh token.
    pub async fn issue_tokens_from_auth_code_in_transaction(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        params: IssueTokensFromAuthCodeParams<'_>,
    ) -> ModelResult<()> {
        // Insert access token
        OAuthAccessToken::insert(
            tx,
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

        // Revoke all refresh tokens for user/client (fresh login is a hard revoke:
        // clear rotated_at so none of them can be reused via the grace window).
        sqlx::query!(
            r#"
            UPDATE oauth_refresh_tokens
               SET revoked = true,
                   rotated_at = NULL
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

    /// Find a refresh token that was superseded by rotation and is still within
    /// the reuse grace window.
    ///
    /// Matches only tokens that were rotated (`rotated_at IS NOT NULL`) at or
    /// after `rotated_after`, are not expired, and belong to `client_id`.
    /// Hard-revoked tokens clear `rotated_at`, so they are never matched here.
    pub async fn find_reusable_after_rotation(
        conn: &mut PgConnection,
        digest: Digest,
        client_id: Uuid,
        rotated_after: DateTime<Utc>,
    ) -> ModelResult<OAuthRefreshTokens> {
        let token = sqlx::query_as!(
            OAuthRefreshTokens,
            r#"
            SELECT *
            FROM oauth_refresh_tokens
            WHERE digest = $1
              AND client_id = $2
              AND revoked = true
              AND rotated_at IS NOT NULL
              AND rotated_at > $3
              AND expires_at > now()
            "#,
            digest.as_bytes(),
            client_id,
            rotated_after
        )
        .fetch_one(conn)
        .await?;
        Ok(token)
    }

    /// Issue a fresh token pair for a reuse-within-grace redemption, WITHOUT the
    /// family-wide revocation.
    ///
    /// # Transaction Requirements
    /// This method must be called within an existing database transaction.
    ///
    /// Unlike [`Self::complete_refresh_token_rotation_in_transaction`], this does
    /// not revoke the (user, client) family: the already-rotated token is being
    /// reused by a racing client, so the sibling chain must stay valid (bounded
    /// temporary branching). The reused token is left as-is (already revoked).
    pub async fn issue_tokens_reused_within_grace_in_transaction(
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        reused_token: &OAuthRefreshTokens,
        params: RotateRefreshTokenParams<'_>,
    ) -> ModelResult<()> {
        // Insert new refresh token linked to the reused one (no family revoke).
        sqlx::query!(
            r#"
            INSERT INTO oauth_refresh_tokens
              (digest, user_id, client_id, scopes, audience, jti, expires_at, revoked, rotated_from, metadata, dpop_jkt)
            VALUES
              ($1,    $2,     $3,        $4,     $5,       gen_random_uuid(), $6,       false,   $7,          $8,      $9)
            "#,
            params.new_refresh_token_digest.as_bytes(),
            reused_token.user_id,
            reused_token.client_id,
            &reused_token.scopes,
            reused_token.audience.as_deref(),
            params.refresh_token_expires_at,
            reused_token.digest.as_bytes(),
            serde_json::Value::Object(serde_json::Map::new()),
            params.refresh_token_dpop_jkt
        )
        .execute(&mut **tx)
        .await?;

        // Insert new access token
        OAuthAccessToken::insert(
            tx,
            NewAccessTokenParams {
                digest: params.new_access_token_digest,
                user_id: Some(reused_token.user_id),
                client_id: reused_token.client_id,
                scopes: &reused_token.scopes,
                audience: reused_token.audience.as_deref(),
                token_type: params.access_token_type,
                dpop_jkt: params.access_token_dpop_jkt,
                metadata: serde_json::Map::new(),
                expires_at: params.access_token_expires_at,
            },
        )
        .await?;

        Ok(())
    }
}
