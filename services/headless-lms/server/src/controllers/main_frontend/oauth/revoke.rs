use crate::domain::oauth::oauth_validated::OAuthValidated;
use crate::domain::oauth::revoke_query::RevokeQuery;
use crate::prelude::*;
use actix_web::{HttpResponse, web};
use headless_lms_utils::ApplicationConfiguration;
use models::{
    library::oauth::token_digest_sha256, oauth_access_token::OAuthAccessToken,
    oauth_client::OAuthClient, oauth_refresh_tokens::OAuthRefreshTokens,
};
use sqlx::PgPool;

/// Handles the `/revoke` endpoint for OAuth 2.0 token revocation (RFC 7009).
///
/// This endpoint allows clients to revoke access tokens or refresh tokens.
///
/// ### Security Features
/// - Client authentication is required (client_id and client_secret)
/// - Always returns `200 OK` even for invalid/expired/already-revoked tokens
///   to prevent token enumeration attacks
/// - Validates that the token belongs to the authenticated client before revoking
///
/// ### Request Parameters
/// - `token` (required): The token to be revoked
/// - `token_type_hint` (optional): Hint about token type ("access_token" or "refresh_token")
///
/// Follows [RFC 7009 — OAuth 2.0 Token Revocation](https://datatracker.ietf.org/doc/html/rfc7009).
///
/// # Example
/// ```http
/// POST /api/v0/main-frontend/oauth/revoke HTTP/1.1
/// Content-Type: application/x-www-form-urlencoded
///
/// token=ACCESS_TOKEN_TO_REVOKE&token_type_hint=access_token&client_id=test-client-id&client_secret=test-secret
/// ```
///
/// Response (always 200 OK):
/// ```http
/// HTTP/1.1 200 OK
/// ```
#[instrument(skip(pool, form, app_conf))]
pub async fn revoke(
    pool: web::Data<PgPool>,
    OAuthValidated(form): OAuthValidated<RevokeQuery>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    // Authenticate client
    // RFC 7009 §2.1: "The authorization server responds with HTTP status code 200 if the token
    // has been revoked successfully or if the client submitted an invalid token."
    // This means we should return 200 OK even for invalid client_id/client_secret to prevent
    // enumeration attacks. However, we still need to validate for legitimate revocations.
    let client_result = OAuthClient::find_by_client_id(&mut conn, &form.client_id).await;

    // Add non-secret fields to the span for observability
    tracing::Span::current().record("client_id", &form.client_id);

    // If client not found or secret invalid, return 200 OK per RFC 7009 (but don't actually revoke)
    let client = match client_result {
        Ok(c) => c,
        Err(_) => {
            // Invalid client_id - return 200 OK per RFC 7009 to prevent enumeration
            return server_token.authorized_ok(HttpResponse::Ok().finish());
        }
    };

    // Validate client secret for confidential clients
    let token_hmac_key = &app_conf.oauth_server_configuration.oauth_token_hmac_key;
    let client_valid = if client.is_confidential() {
        match &client.client_secret {
            Some(secret) => {
                let provided_secret_digest = token_digest_sha256(
                    &form.client_secret.clone().unwrap_or_default(),
                    token_hmac_key,
                );
                secret.constant_eq(&provided_secret_digest)
            }
            None => false,
        }
    } else {
        true // Public clients don't need secret validation
    };

    // If client secret is invalid, return 200 OK per RFC 7009 (but don't actually revoke)
    if !client_valid {
        return server_token.authorized_ok(HttpResponse::Ok().finish());
    }

    // Hash the provided token to get digest
    // We'll recalculate it as needed since Digest doesn't implement Copy

    // Normalize token_type_hint: only recognize "access_token" and "refresh_token",
    // treat any other value as None (no hint)
    let hint = form.token_type_hint.as_deref().and_then(|h| {
        match h {
            "access_token" | "refresh_token" => Some(h),
            _ => None, // Unknown hints are ignored
        }
    });
    if let Some(h) = hint {
        tracing::Span::current().record("token_type_hint", h);
    }

    // Determine which token type to try first based on hint
    // Default to trying access token first if no hint or hint is "access_token"
    let try_access_first = hint.is_none() || hint == Some("access_token");

    // Try to revoke as access token first (if hint is "access_token" or no hint)
    if try_access_first {
        let token_digest = token_digest_sha256(&form.token, token_hmac_key);
        // Try to find the access token
        if let Ok(access_token) = OAuthAccessToken::find_valid(&mut conn, token_digest).await {
            // Verify the token belongs to the authenticated client
            // RFC 7009 says we should return 200 OK even if it doesn't match (to prevent enumeration)
            // but we should still check to ensure proper revocation
            if access_token.client_id == client.id {
                // Revoke the access token (delete it) - recalculate digest since it was moved
                let token_digest = token_digest_sha256(&form.token, token_hmac_key);
                let _ = OAuthAccessToken::revoke_by_digest(&mut conn, token_digest).await;
            }

            // Always return 200 OK per RFC 7009
            return server_token.authorized_ok(HttpResponse::Ok().finish());
        }
    }

    // Try to revoke as refresh token (if hint is explicitly "refresh_token")
    if hint == Some("refresh_token") {
        let token_digest = token_digest_sha256(&form.token, token_hmac_key);
        // Try to find the refresh token
        if let Ok(refresh_token) = OAuthRefreshTokens::find_valid(&mut conn, token_digest).await {
            // Verify the token belongs to the authenticated client
            // Similar to access tokens, we check but don't fail if it doesn't match
            if refresh_token.client_id == client.id {
                // Revoke the refresh token (mark as revoked) - recalculate digest since it was moved
                let token_digest = token_digest_sha256(&form.token, token_hmac_key);
                let _ = OAuthRefreshTokens::revoke_by_digest(&mut conn, token_digest).await;
            }

            // Always return 200 OK per RFC 7009
            return server_token.authorized_ok(HttpResponse::Ok().finish());
        }
    }

    // If we tried access token first and it wasn't found, try refresh token
    if try_access_first {
        let token_digest = token_digest_sha256(&form.token, token_hmac_key);
        if let Ok(refresh_token) = OAuthRefreshTokens::find_valid(&mut conn, token_digest).await {
            if refresh_token.client_id == client.id {
                // Recalculate digest since it was moved
                let token_digest = token_digest_sha256(&form.token, token_hmac_key);
                let _ = OAuthRefreshTokens::revoke_by_digest(&mut conn, token_digest).await;
            }
        }
    }

    // Always return 200 OK per RFC 7009, even if token was not found or already revoked
    server_token.authorized_ok(HttpResponse::Ok().finish())
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/revoke", web::post().to(revoke));
}
