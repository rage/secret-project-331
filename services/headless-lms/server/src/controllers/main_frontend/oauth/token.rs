use crate::domain::oauth::dpop::verify_dpop_from_actix;
use crate::domain::oauth::errors::TokenGrantError;
use crate::domain::oauth::helpers::{oauth_invalid_client, ok_json_no_cache, scope_has_openid};
use crate::domain::oauth::oauth_validated::OAuthValidated;
use crate::domain::oauth::oidc::generate_id_token;
use crate::domain::oauth::token_query::TokenQuery;
use crate::domain::oauth::token_response::TokenResponse;
use crate::domain::oauth::token_service::{
    TokenGrantRequest, TokenGrantResult, generate_token_pair, process_token_grant,
};
use crate::domain::rate_limit_middleware_builder::build_rate_limiting_middleware;
use crate::prelude::*;
use actix_web::{HttpResponse, web};
use chrono::{Duration, Utc};
use domain::error::{OAuthErrorCode, OAuthErrorData};
use headless_lms_utils::ApplicationConfiguration;
use models::{
    library::oauth::token_digest_sha256, oauth_access_token::TokenType, oauth_client::OAuthClient,
};
use sqlx::PgPool;
use std::time::Duration as StdDuration;

/// Handles the `/token` endpoint for exchanging authorization codes or refresh tokens.
///
/// This endpoint issues and rotates OAuth 2.0 and OpenID Connect tokens with support for
/// **PKCE**, **DPoP sender-constrained tokens**, and **ID Token issuance**.
///
/// ### Authorization Code Grant
/// - Validates client credentials (`client_id`, `client_secret`) or public client rules.
/// - Verifies the authorization code, its redirect URI, PKCE binding (`code_verifier`), and expiration.
/// - Optionally verifies a DPoP proof and binds the issued tokens to the DPoP JWK thumbprint (`dpop_jkt`).
/// - Issues a new access token, refresh token, and (for OIDC requests) an ID token.
///
/// ### Refresh Token Grant
/// - Validates the refresh token and client binding.
/// - Verifies DPoP proof when applicable (must match the original `dpop_jkt`).
/// - Rotates the refresh token (revokes the old one, inserts a new one linked to it).
/// - Issues a new access token (and ID token if `openid` scope requested).
///
/// ### Security Features
/// - **PKCE (RFC 7636)**: Enforced for public clients and optionally for confidential ones.
/// - **DPoP (RFC 9449)**: Sender-constrains tokens to a JWK thumbprint.
/// - **Refresh Token Rotation**: Prevents replay by revoking old RTs on use.
/// - **OIDC ID Token**: Issued only if `openid` is in the granted scopes.
///
/// Follows:
/// - [RFC 6749 §3.2 — Token Endpoint](https://datatracker.ietf.org/doc/html/rfc6749#section-3.2)
/// - [RFC 7636 — PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
/// - [RFC 9449 — DPoP](https://datatracker.ietf.org/doc/html/rfc9449)
/// - [OIDC Core §3.1.3 — Token Endpoint](https://openid.net/specs/openid-connect-core-1_0.html#TokenEndpoint)
///
/// # Example
/// ```http
/// POST /api/v0/main-frontend/oauth/token HTTP/1.1
/// Content-Type: application/x-www-form-urlencoded
///
/// grant_type=authorization_code&code=SplxlOBeZQQYbYS6WxSbIA&redirect_uri=http://localhost&client_id=test-client-id&client_secret=test-secret&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
/// ```
///
/// Successful response:
/// ```http
/// HTTP/1.1 200 OK
/// Content-Type: application/json
///
/// {
///   "access_token": "2YotnFZFEjr1zCsicMWpAA",
///   "refresh_token": "tGzv3JOkF0XG5Qx2TlKWIA",
///   "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
///   "token_type": "DPoP",
///   "expires_in": 3600
/// }
/// ```
///
/// Example error:
/// ```http
/// HTTP/1.1 401 Unauthorized
/// Content-Type: application/json
///
/// {
///   "error": "invalid_client",
///   "error_description": "invalid client secret"
/// }
/// ```
///
/// Example DPoP error:
/// ```http
/// HTTP/1.1 401 Unauthorized
/// WWW-Authenticate: DPoP error="use_dpop_proof", error_description="Missing DPoP header"
/// ```
#[instrument(skip(pool, app_conf, form))]
pub async fn token(
    pool: web::Data<PgPool>,
    OAuthValidated(form): OAuthValidated<TokenQuery>,
    req: actix_web::HttpRequest,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    let access_ttl = Duration::hours(1);
    let refresh_ttl = Duration::days(30);

    let client = OAuthClient::find_by_client_id(&mut conn, &form.client_id)
        .await
        .map_err(|_| oauth_invalid_client("invalid client_id"))?;

    // Add non-secret fields to the span for observability
    tracing::Span::current().record("client_id", &form.client_id);

    if client.is_confidential() {
        match client.client_secret {
            Some(ref secret) => {
                let token_hmac_key = &app_conf.oauth_server_configuration.oauth_token_hmac_key;
                if !secret.constant_eq(&token_digest_sha256(
                    &form.client_secret.clone().unwrap_or_default(),
                    token_hmac_key,
                )) {
                    return Err(oauth_invalid_client("invalid client secret"));
                }
            }
            None => {
                return Err(oauth_invalid_client(
                    "client_secret required for confidential clients",
                ));
            }
        }
    }

    // Check if client allows this grant type
    let grant_kind = form.grant.kind();
    tracing::Span::current().record("grant_type", format!("{:?}", grant_kind));
    if !client.allows_grant(grant_kind) {
        return Err(ControllerError::new(
            ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                error: OAuthErrorCode::UnsupportedGrantType.as_str().into(),
                error_description: "grant type not allowed for this client".into(),
                redirect_uri: None,
                state: None,
                nonce: None,
            })),
            "Grant type not allowed for this client",
            None::<anyhow::Error>,
        ));
    }

    // DPoP vs Bearer selection
    let dpop_jkt_opt = if req.headers().get("DPoP").is_some() {
        Some(
            verify_dpop_from_actix(
                &mut conn,
                &req,
                "POST",
                &app_conf.oauth_server_configuration.dpop_nonce_key,
                None,
            )
            .await?,
        )
    } else {
        if !client.bearer_allowed {
            return Err(oauth_invalid_client(
                "client not allowed to use other than dpop-bound tokens",
            ));
        }
        None
    };

    let issued_token_type = if dpop_jkt_opt.is_some() {
        TokenType::DPoP
    } else {
        TokenType::Bearer
    };
    tracing::Span::current().record("token_type", format!("{:?}", issued_token_type));

    let token_hmac_key = &app_conf.oauth_server_configuration.oauth_token_hmac_key;
    let token_pair = generate_token_pair(token_hmac_key);
    let access_token = token_pair.access_token.clone();
    let refresh_token = token_pair.refresh_token.clone();
    let refresh_token_expires_at = Utc::now() + refresh_ttl;
    let access_expires_at = Utc::now() + access_ttl;

    let request = TokenGrantRequest {
        grant: &form.grant,
        client: &client,
        token_pair,
        access_expires_at,
        refresh_expires_at: refresh_token_expires_at,
        issued_token_type,
        dpop_jkt: dpop_jkt_opt.as_deref(),
        token_hmac_key,
    };

    let TokenGrantResult {
        user_id,
        scopes: scope_vec,
        nonce: nonce_opt,
        access_expires_at: at_expires_at,
        issue_id_token,
    } = process_token_grant(&mut conn, request)
        .await
        .map_err(|e: TokenGrantError| ControllerError::from(e))?;

    let base_url = app_conf.base_url.trim_end_matches('/');
    let id_token = if issue_id_token && scope_has_openid(&scope_vec) {
        Some(generate_id_token(
            user_id,
            &client.client_id,
            &nonce_opt.unwrap_or_default(),
            at_expires_at,
            &format!("{}/api/v0/main-frontend/oauth", base_url),
            &app_conf,
        )?)
    } else {
        None
    };

    let response = TokenResponse {
        access_token,
        refresh_token: Some(refresh_token),
        id_token,
        token_type: match issued_token_type {
            TokenType::Bearer => "Bearer".to_string(),
            TokenType::DPoP => "DPoP".to_string(),
        },
        expires_in: access_ttl.num_seconds() as u32,
    };

    server_token.authorized_ok(ok_json_no_cache(response))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/token")
            .wrap(build_rate_limiting_middleware(
                StdDuration::from_secs(60),
                100,
            ))
            .wrap(build_rate_limiting_middleware(
                StdDuration::from_secs(60 * 60),
                500,
            ))
            .wrap(build_rate_limiting_middleware(
                StdDuration::from_secs(60 * 60 * 24),
                2000,
            ))
            .route(web::post().to(token)),
    );
}
