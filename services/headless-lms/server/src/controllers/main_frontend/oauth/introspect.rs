use crate::domain::oauth::introspect_query::IntrospectQuery;
use crate::domain::oauth::introspect_response::IntrospectResponse;
use crate::domain::oauth::oauth_validated::OAuthValidated;
use crate::prelude::*;
use actix_web::{HttpResponse, web};
use chrono::Utc;
use domain::error::{OAuthErrorCode, OAuthErrorData};
use headless_lms_utils::ApplicationConfiguration;
use models::{
    library::oauth::token_digest_sha256,
    oauth_access_token::{OAuthAccessToken, TokenType},
    oauth_client::OAuthClient,
};
use sqlx::PgPool;

/// Handles the `/introspect` endpoint for OAuth 2.0 token introspection (RFC 7662).
///
/// This endpoint allows resource servers to query the authorization server about
/// the active state and metadata of an access token.
///
/// ### Security Features
/// - Client authentication is required (client_id and client_secret for confidential clients)
/// - Returns `active: false` for invalid/expired tokens or authentication failures
///   to prevent token enumeration attacks
/// - Always returns 200 OK, even for invalid tokens (per RFC 7662)
///
/// ### Request Parameters
/// - `token` (required): The token to be introspected
/// - `token_type_hint` (optional): Hint about token type ("access_token" or "refresh_token")
/// - `client_id` (required): Client identifier
/// - `client_secret` (required for confidential clients): Client secret
///
/// ### Response
/// Returns a JSON object with:
/// - `active` (bool, required): Whether the token is active
/// - Additional fields only present if `active: true`:
///   - `scope`: Space-separated list of scopes
///   - `client_id`: Client identifier
///   - `username`/`sub`: User identifier (if token has user)
///   - `exp`: Expiration timestamp (Unix time)
///   - `iat`: Issued at timestamp (Unix time)
///   - `aud`: Audience
///   - `iss`: Issuer
///   - `jti`: JWT ID
///   - `token_type`: "Bearer" or "DPoP"
///
/// Follows [RFC 7662 — OAuth 2.0 Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662).
///
/// # Example
/// ```http
/// POST /api/v0/main-frontend/oauth/introspect HTTP/1.1
/// Content-Type: application/x-www-form-urlencoded
///
/// token=ACCESS_TOKEN&client_id=test-client-id&client_secret=test-secret
/// ```
///
/// Successful response:
/// ```http
/// HTTP/1.1 200 OK
/// Content-Type: application/json
/// Cache-Control: no-store
///
/// {
///   "active": true,
///   "scope": "openid profile email",
///   "client_id": "test-client-id",
///   "sub": "550e8400-e29b-41d4-a716-446655440000",
///   "username": "550e8400-e29b-41d4-a716-446655440000",
///   "exp": 1735689600,
///   "iat": 1735686000,
///   "iss": "https://example.com/api/v0/main-frontend/oauth",
///   "jti": "123e4567-e89b-12d3-a456-426614174000",
///   "token_type": "Bearer"
/// }
/// ```
///
/// Inactive token response:
/// ```http
/// HTTP/1.1 200 OK
/// Content-Type: application/json
/// Cache-Control: no-store
///
/// {
///   "active": false
/// }
/// ```
#[instrument(skip(pool, app_conf))]
pub async fn introspect(
    pool: web::Data<PgPool>,
    OAuthValidated(form): OAuthValidated<IntrospectQuery>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    // Authenticate client
    // RFC 7662 §2.1: "The authorization server responds with HTTP status code 200
    // and the introspection result, even if the client authentication failed or
    // the token is invalid."
    let client_result = OAuthClient::find_by_client_id(&mut conn, &form.client_id).await;

    // If client not found or secret invalid, return active: false per RFC 7662
    let client = match client_result {
        Ok(c) => c,
        Err(_) => {
            // Invalid client_id - return active: false per RFC 7662
            return server_token.authorized_ok(
                HttpResponse::Ok()
                    .insert_header(("Cache-Control", "no-store"))
                    .json(IntrospectResponse {
                        active: false,
                        scope: None,
                        client_id: None,
                        username: None,
                        exp: None,
                        iat: None,
                        sub: None,
                        aud: None,
                        iss: None,
                        jti: None,
                        token_type: None,
                    }),
            );
        }
    };

    // Validate client secret for confidential clients
    let client_valid = if client.is_confidential() {
        match &client.client_secret {
            Some(secret) => {
                let provided_secret_digest =
                    token_digest_sha256(&form.client_secret.clone().unwrap_or_default());
                secret.constant_eq(&provided_secret_digest)
            }
            None => false,
        }
    } else {
        true // Public clients don't need secret validation
    };

    // If client secret is invalid, return active: false per RFC 7662
    if !client_valid {
        return server_token.authorized_ok(
            HttpResponse::Ok()
                .insert_header(("Cache-Control", "no-store"))
                .json(IntrospectResponse {
                    active: false,
                    scope: None,
                    client_id: None,
                    username: None,
                    exp: None,
                    iat: None,
                    sub: None,
                    aud: None,
                    iss: None,
                    jti: None,
                    token_type: None,
                }),
        );
    }

    // Hash the provided token to get digest
    let token_digest = token_digest_sha256(&form.token);

    // Look up the access token (only access tokens are supported)
    let access_token_result = OAuthAccessToken::find_valid(&mut conn, token_digest).await;

    // If token not found or expired, return active: false
    let access_token = match access_token_result {
        Ok(token) => token,
        Err(_) => {
            return server_token.authorized_ok(
                HttpResponse::Ok()
                    .insert_header(("Cache-Control", "no-store"))
                    .json(IntrospectResponse {
                        active: false,
                        scope: None,
                        client_id: None,
                        username: None,
                        exp: None,
                        iat: None,
                        sub: None,
                        aud: None,
                        iss: None,
                        jti: None,
                        token_type: None,
                    }),
            );
        }
    };

    // Build response with token metadata
    let base_url = app_conf.base_url.trim_end_matches('/');
    let issuer = format!("{}/api/v0/main-frontend/oauth", base_url);

    let mut response = IntrospectResponse {
        active: true,
        scope: Some(access_token.scopes.join(" ")),
        client_id: Some(client.client_id.clone()),
        username: access_token.user_id.map(|id| id.to_string()),
        exp: Some(access_token.expires_at.timestamp()),
        iat: Some(access_token.created_at.timestamp()),
        sub: access_token.user_id.map(|id| id.to_string()),
        aud: access_token.audience.clone(),
        iss: Some(issuer),
        jti: Some(access_token.jti.to_string()),
        token_type: Some(match access_token.token_type {
            TokenType::Bearer => "Bearer".to_string(),
            TokenType::DPoP => "DPoP".to_string(),
        }),
    };

    // RFC 7662: If username is not set, don't include it
    if response.username.is_none() {
        response.username = None;
    }

    server_token.authorized_ok(
        HttpResponse::Ok()
            .insert_header(("Cache-Control", "no-store"))
            .json(response),
    )
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/introspect", web::post().to(introspect));
}
