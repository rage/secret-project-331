use chrono::{DateTime, Utc};
use sqlx::{Connection, PgConnection};
use uuid::Uuid;

use crate::domain::oauth::errors::TokenGrantError;
use crate::domain::oauth::pkce::verify_token_pkce;
use headless_lms_models::library::oauth::Digest;
use headless_lms_models::library::oauth::tokens::token_digest_sha256;
use headless_lms_models::oauth_access_token::TokenType;
use headless_lms_models::oauth_auth_code::OAuthAuthCode;
use headless_lms_models::oauth_client::OAuthClient;
use headless_lms_models::oauth_refresh_tokens::{
    IssueTokensFromAuthCodeParams, OAuthRefreshTokens, RotateRefreshTokenParams,
};

use super::token_query::TokenGrant;

/// A pair of access and refresh tokens with their digests.
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    pub access_digest: Digest,
    pub refresh_digest: Digest,
}

/// Generate a new token pair (access token and refresh token) with their digests.
pub fn generate_token_pair(key: &str) -> TokenPair {
    let access_token = headless_lms_models::library::oauth::tokens::generate_access_token();
    let refresh_token = headless_lms_models::library::oauth::tokens::generate_access_token();
    TokenPair {
        access_token: access_token.clone(),
        refresh_token: refresh_token.clone(),
        access_digest: token_digest_sha256(&access_token, key),
        refresh_digest: token_digest_sha256(&refresh_token, key),
    }
}

pub struct TokenGrantRequest<'a> {
    pub grant: &'a TokenGrant,
    pub client: &'a OAuthClient,
    pub token_pair: TokenPair,
    pub access_expires_at: DateTime<Utc>,
    pub refresh_expires_at: DateTime<Utc>,
    pub issued_token_type: TokenType,
    pub dpop_jkt: Option<&'a str>,
    pub token_hmac_key: &'a str,
}

pub struct TokenGrantResult {
    pub user_id: Uuid,
    pub scopes: Vec<String>,
    pub nonce: Option<String>,
    pub access_expires_at: DateTime<Utc>,
    pub issue_id_token: bool,
}

pub async fn process_token_grant(
    conn: &mut PgConnection,
    request: TokenGrantRequest<'_>,
) -> Result<TokenGrantResult, TokenGrantError> {
    let mut tx = conn
        .begin()
        .await
        .map_err(|e| TokenGrantError::ServerError(format!("Failed to start transaction: {}", e)))?;

    let result = match request.grant {
        TokenGrant::AuthorizationCode {
            code,
            redirect_uri,
            code_verifier,
        } => {
            let code_digest = token_digest_sha256(code, request.token_hmac_key);
            // Consume with client_id check in WHERE clause to prevent DoS attacks
            let code_row = if let Some(ref_uri) = redirect_uri {
                OAuthAuthCode::consume_with_redirect_in_transaction(
                    &mut tx,
                    code_digest,
                    request.client.id,
                    ref_uri,
                )
                .await
                .map_err(|_| TokenGrantError::InvalidGrant(format!("Given grant is invalid")))?
            } else {
                OAuthAuthCode::consume_in_transaction(&mut tx, code_digest, request.client.id)
                    .await
                    .map_err(|_| TokenGrantError::InvalidGrant(format!("Given grant is invalid")))?
            };

            // PKCE verification happens after client_id check (enforced in SQL)
            verify_token_pkce(
                request.client,
                code_row.code_challenge.as_deref(),
                code_row.code_challenge_method,
                code_verifier.as_deref(),
            )
            .map_err(|_| TokenGrantError::PkceVerificationFailed)?;

            OAuthRefreshTokens::issue_tokens_from_auth_code_in_transaction(
                &mut tx,
                IssueTokensFromAuthCodeParams {
                    user_id: code_row.user_id,
                    client_id: code_row.client_id,
                    scopes: &code_row.scopes,
                    access_token_digest: &request.token_pair.access_digest,
                    refresh_token_digest: &request.token_pair.refresh_digest,
                    access_token_expires_at: request.access_expires_at,
                    refresh_token_expires_at: request.refresh_expires_at,
                    access_token_type: request.issued_token_type,
                    access_token_dpop_jkt: request.dpop_jkt,
                    refresh_token_dpop_jkt: request.dpop_jkt,
                },
            )
            .await
            .map_err(|e| TokenGrantError::ServerError(format!("{}", e)))?;

            // Determine if ID token should be issued based on presence of "openid" scope
            let has_openid = code_row.scopes.iter().any(|s| s == "openid");

            Ok(TokenGrantResult {
                user_id: code_row.user_id,
                scopes: code_row.scopes,
                nonce: code_row.nonce.clone(),
                access_expires_at: request.access_expires_at,
                issue_id_token: has_openid,
            })
        }
        TokenGrant::RefreshToken { refresh_token, .. } => {
            let presented = token_digest_sha256(refresh_token, request.token_hmac_key);
            // Consume with client_id check in WHERE clause to prevent DoS attacks
            let old =
                OAuthRefreshTokens::consume_in_transaction(&mut tx, presented, request.client.id)
                    .await
                    .map_err(|e| TokenGrantError::InvalidGrant(format!("{}", e)))?;

            if let Some(expected_jkt) = old.dpop_jkt.as_deref() {
                let presented_jkt = request.dpop_jkt.ok_or_else(|| {
                    TokenGrantError::InvalidClient(
                        "missing DPoP header for sender-constrained refresh".into(),
                    )
                })?;
                if presented_jkt != expected_jkt {
                    return Err(TokenGrantError::DpopMismatch);
                }
            }

            let refresh_issue_type = if old.dpop_jkt.is_some() {
                TokenType::DPoP
            } else {
                request.issued_token_type
            };
            let at_jkt = old.dpop_jkt.as_deref().or(request.dpop_jkt);
            let refresh_jkt = old.dpop_jkt.as_deref().or(request.dpop_jkt);

            OAuthRefreshTokens::complete_refresh_token_rotation_in_transaction(
                &mut tx,
                &old,
                RotateRefreshTokenParams {
                    new_refresh_token_digest: &request.token_pair.refresh_digest,
                    new_access_token_digest: &request.token_pair.access_digest,
                    access_token_expires_at: request.access_expires_at,
                    refresh_token_expires_at: request.refresh_expires_at,
                    access_token_type: refresh_issue_type,
                    access_token_dpop_jkt: at_jkt,
                    refresh_token_dpop_jkt: refresh_jkt,
                },
            )
            .await
            .map_err(|e| TokenGrantError::ServerError(format!("{}", e)))?;

            Ok(TokenGrantResult {
                user_id: old.user_id,
                scopes: old.scopes.clone(),
                nonce: None,
                access_expires_at: request.access_expires_at,
                issue_id_token: false,
            })
        }
        TokenGrant::Unknown => Err(TokenGrantError::UnsupportedGrantType),
    };

    match result {
        Ok(res) => {
            tx.commit().await.map_err(|e| {
                TokenGrantError::ServerError(format!("Failed to commit transaction: {}", e))
            })?;
            Ok(res)
        }
        Err(e) => {
            // Transaction will be rolled back on drop
            Err(e)
        }
    }
}
