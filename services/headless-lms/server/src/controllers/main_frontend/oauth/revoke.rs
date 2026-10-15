use crate::domain::exercise_services::token::{invalidate_cached_user, invalidate_cached_users};
use crate::domain::oauth::oauth_validated::OAuthValidated;
use crate::domain::oauth::revoke_query::RevokeQuery;
use crate::prelude::*;
use actix_web::{HttpResponse, web};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_utils::cache::Cache;
use models::{
    error::ModelErrorType, library::oauth::token_digest_sha256,
    oauth_access_token::OAuthAccessToken, oauth_client::OAuthClient,
    oauth_refresh_tokens::OAuthRefreshTokens,
};
use secrecy::ExposeSecret;
use sqlx::PgPool;
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(paths(revoke))]
#[allow(dead_code)]
pub(crate) struct MainFrontendOauthRevokeApiDoc;

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
#[instrument(skip(pool, form, app_conf, cache))]
#[utoipa::path(
    post,
    path = "/revoke",
    operation_id = "revokeOauthToken",
    tag = "oauth",
    request_body(
        content = serde_json::Value,
        content_type = "application/x-www-form-urlencoded"
    ),
    responses(
        (status = 200, description = "OAuth token revocation acknowledged")
    )
)]
pub async fn revoke(
    pool: web::Data<PgPool>,
    OAuthValidated(form): OAuthValidated<RevokeQuery>,
    app_conf: web::Data<ApplicationConfiguration>,
    cache: web::Data<Cache>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    // Authenticate client
    // RFC 7009 §2.1: "The authorization server responds with HTTP status code 200 if the token
    // has been revoked successfully or if the client submitted an invalid token."
    // This means we should return 200 OK even for invalid client_id/client_secret to prevent
    // enumeration attacks. However, we still need to validate for legitimate revocations.
    // RFC 7009 also permits 5xx responses on genuine backend/storage failures.
    let client_result = OAuthClient::find_by_client_id(&mut conn, &form.client_id).await;

    // Add non-secret fields to the span for observability
    tracing::Span::current().record("client_id", &form.client_id);

    // Differentiate between "not found" (return 200 OK) and storage failures (return 5xx)
    let client = match client_result {
        Ok(c) => c,
        Err(err) => {
            match err.error_type() {
                // Client not found - return 200 OK per RFC 7009 to prevent enumeration
                ModelErrorType::RecordNotFound | ModelErrorType::NotFound => {
                    return server_token.authorized_ok(HttpResponse::Ok().finish());
                }
                // Database/storage failures - return 5xx per RFC 7009
                _ => {
                    tracing::error!(err = %err, "OAuth revoke: client lookup failed");
                    return Err(ControllerError::new(
                        ControllerErrorType::InternalServerError,
                        "Failed to authenticate client due to storage error".to_string(),
                        Some(err.into()),
                    ));
                }
            }
        }
    };

    // Validate client secret for confidential clients
    let token_hmac_key = &app_conf.oauth_server_configuration.oauth_token_hmac_key;
    let client_valid = if client.is_confidential() {
        match &client.client_secret {
            Some(secret) => {
                let provided_secret_digest = token_digest_sha256(
                    form.client_secret
                        .as_ref()
                        .map(|s| s.expose_secret())
                        .unwrap_or_default(),
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

    // RFC 7009: try the hinted token type first, then the other one if the first lookup found
    // nothing.
    if hint == Some("refresh_token") {
        if !revoke_refresh_grant_of_client(&mut conn, &form, &client, token_hmac_key, &cache)
            .await?
        {
            revoke_access_token_of_client(&mut conn, &form, &client, token_hmac_key, &cache)
                .await?;
        }
    } else if !revoke_access_token_of_client(&mut conn, &form, &client, token_hmac_key, &cache)
        .await?
    {
        revoke_refresh_grant_of_client(&mut conn, &form, &client, token_hmac_key, &cache).await?;
    }

    // Always return 200 OK per RFC 7009, even if token was not found or already revoked
    server_token.authorized_ok(HttpResponse::Ok().finish())
}

/// Classifies a token lookup failure: `Ok(())` for "no such live token", so the caller can try the
/// other token type, and 5xx for a storage failure (RFC 7009 permits 5xx on genuine backend
/// failures, but not on an unknown token).
fn not_found_or_storage_error(err: models::ModelError, what: &str) -> Result<(), ControllerError> {
    match err.error_type() {
        ModelErrorType::RecordNotFound | ModelErrorType::NotFound => Ok(()),
        _ => Err(controller_err!(
            InternalServerError,
            format!("Failed to look up {what} due to storage error"),
            err
        )),
    }
}

/// Deletes the presented access token if it belongs to the authenticated client, and evicts its
/// cached user mapping so it cannot keep authenticating from a stale cache hit.
///
/// `Ok(false)` means no live access token has that digest.
async fn revoke_access_token_of_client(
    conn: &mut sqlx::PgConnection,
    form: &crate::domain::oauth::revoke_query::RevokeParams,
    client: &OAuthClient,
    token_hmac_key: &secrecy::SecretString,
    cache: &Cache,
) -> Result<bool, ControllerError> {
    let digest = token_digest_sha256(form.token.expose_secret(), token_hmac_key);
    match OAuthAccessToken::find_valid(conn, digest).await {
        Ok(access_token) => {
            if access_token.client_id == client.id {
                let digest = token_digest_sha256(form.token.expose_secret(), token_hmac_key);
                OAuthAccessToken::revoke_by_digest(conn, digest).await?;
                let digest = token_digest_sha256(form.token.expose_secret(), token_hmac_key);
                invalidate_cached_user(cache, &digest, token_hmac_key).await;
            }
            Ok(true)
        }
        Err(err) => not_found_or_storage_error(err, "access token").map(|_| false),
    }
}

/// Revokes the presented refresh token if it belongs to the authenticated client, together with
/// everything else issued from the same (user, client) grant.
///
/// RFC 7009 §2.1: the authorization server SHOULD revoke all tokens issued from the same grant.
/// Revoking only the refresh-token row would leave the paired access token authenticating the
/// exercise-services client API — from the Redis cache even after the row is gone — for its full
/// remaining lifetime, so "log out" would not log the user out.
///
/// `Ok(false)` means no live refresh token has that digest.
async fn revoke_refresh_grant_of_client(
    conn: &mut sqlx::PgConnection,
    form: &crate::domain::oauth::revoke_query::RevokeParams,
    client: &OAuthClient,
    token_hmac_key: &secrecy::SecretString,
    cache: &Cache,
) -> Result<bool, ControllerError> {
    let digest = token_digest_sha256(form.token.expose_secret(), token_hmac_key);
    match OAuthRefreshTokens::find_valid(conn, digest).await {
        Ok(refresh_token) => {
            if refresh_token.client_id == client.id {
                let revoked_access_digests =
                    OAuthRefreshTokens::revoke_grant(conn, refresh_token.user_id, client.id)
                        .await?;
                invalidate_cached_users(cache, &revoked_access_digests, token_hmac_key).await;
            }
            Ok(true)
        }
        Err(err) => not_found_or_storage_error(err, "refresh token").map(|_| false),
    }
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/revoke", web::post().to(revoke));
}
