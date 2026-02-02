use crate::domain::oauth::authorize_query::AuthorizeQuery;
use crate::domain::oauth::helpers::{oauth_error, oauth_invalid_request};
use crate::domain::oauth::oauth_validated::OAuthValidated;
use crate::domain::oauth::pkce::parse_authorize_pkce;
use crate::domain::oauth::redirects::{
    build_authorize_qs, build_consent_redirect, build_login_redirect, redirect_with_code,
};
use crate::domain::rate_limit_middleware_builder::{RateLimit, RateLimitConfig};
use crate::prelude::*;
use actix_web::web;
use chrono::{Duration, Utc};
use itertools::Itertools;
use models::{
    library::oauth::{generate_access_token, token_digest_sha256},
    oauth_auth_code::{NewAuthCodeParams, OAuthAuthCode},
    oauth_client::OAuthClient,
    oauth_user_client_scopes::OAuthUserClientScopes,
};
use sqlx::PgPool;
use std::collections::HashSet;

#[derive(Debug, Clone, Copy, Default)]
struct PromptFlags {
    none: bool,
    consent: bool,
    login: bool,
    select_account: bool,
}

fn parse_prompt(prompt: Option<&str>) -> Result<PromptFlags, &'static str> {
    let mut f = PromptFlags::default();
    let Some(p) = prompt else { return Ok(f) };

    for v in p.split_whitespace() {
        match v {
            "none" => f.none = true,
            "consent" => f.consent = true,
            "login" => f.login = true,
            "select_account" => f.select_account = true,
            _ => return Err("unsupported prompt value"),
        }
    }

    if f.none && (f.consent || f.login || f.select_account) {
        return Err("prompt=none cannot be combined with other values");
    }

    Ok(f)
}

/// Handles the `/authorize` endpoint for OAuth 2.0 and OpenID Connect with PKCE support.
///
/// This endpoint:
/// - Validates the incoming authorization request parameters.
/// - Verifies the client, redirect URI, and requested scopes.
/// - Enforces PKCE requirements (`code_challenge` and `code_challenge_method`) for public clients or clients configured with `require_pkce = true`.
/// - If the user is logged in and has already granted the requested scopes, issues an authorization code and redirects back to the client.
/// - If the user is logged in but missing consent for some scopes, redirects them to the consent screen.
/// - If the user is not logged in, redirects them to the login page.
///
/// Note: DPoP (Demonstrating Proof-of-Possession) is not used at this endpoint. DPoP binding
/// occurs at the `/token` endpoint when exchanging authorization codes for access tokens.
///
/// Follows:
/// - [RFC 6749 Section 3.1](https://datatracker.ietf.org/doc/html/rfc6749#section-3.1) — Authorization Endpoint
///   - Supports both GET (query parameters) and POST (form-encoded body) methods
/// - [RFC 7636 (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) — Proof Key for Code Exchange
/// - [OpenID Connect Core 1.0 Section 3](https://openid.net/specs/openid-connect-core-1_0.html#AuthorizationEndpoint)
///
/// # Examples
/// ```http
/// GET /api/v0/main-frontend/oauth/authorize?response_type=code&client_id=test-client-id&redirect_uri=http://localhost&scope=openid%20profile%20email&state=random123&nonce=secure_nonce_abc&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256 HTTP/1.1
/// ```
///
/// ```http
/// POST /api/v0/main-frontend/oauth/authorize HTTP/1.1
/// Content-Type: application/x-www-form-urlencoded
///
/// response_type=code&client_id=test-client-id&redirect_uri=http://localhost&scope=openid%20profile%20email&state=random123&nonce=secure_nonce_abc&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256
/// ```
///
/// Successful redirect:
/// ```http
/// HTTP/1.1 302 Found
/// Location: http://localhost?code=SplxlOBeZQQYbYS6WxSbIA&state=random123
/// ```
pub async fn authorize(
    pool: web::Data<PgPool>,
    OAuthValidated(query): OAuthValidated<AuthorizeQuery>,
    user: Option<AuthUser>,
    app_conf: web::Data<headless_lms_utils::ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    let client = OAuthClient::find_by_client_id(&mut conn, &query.client_id)
        .await
        .map_err(|_| {
            oauth_invalid_request(
                "invalid client_id",
                None, // Cannot verify redirect_uri without valid client_id (security: prevent open redirect)
                query.state.as_deref(),
            )
        })?;

    // Add non-secret fields to the span for observability
    tracing::Span::current().record("client_id", &query.client_id);
    tracing::Span::current().record("response_type", &query.response_type);

    if !client.redirect_uris.contains(&query.redirect_uri) {
        return Err(oauth_invalid_request(
            "redirect_uri does not match client",
            None, // Never redirect to an invalid redirect_uri (security)
            query.state.as_deref(),
        ));
    }

    if query.request.is_some() {
        return Err(oauth_error(
            "request_not_supported",
            "request object is not supported",
            Some(&query.redirect_uri),
            query.state.as_deref(),
        ));
    }

    let prompt = parse_prompt(query.prompt.as_deref()).map_err(|msg| {
        oauth_invalid_request(msg, Some(&query.redirect_uri), query.state.as_deref())
    })?;

    if prompt.login {
        return Err(oauth_error(
            "inalid_request",
            "prompt=login is not supported",
            Some(&query.redirect_uri),
            query.state.as_deref(),
        ));
    }

    if prompt.select_account {
        return Err(oauth_error(
            "inalid_request",
            "prompt=select_account is not supported",
            Some(&query.redirect_uri),
            query.state.as_deref(),
        ));
    }

    let parsed_pkce_method = parse_authorize_pkce(
        &client,
        query.code_challenge.as_deref(),
        query.code_challenge_method.as_deref(),
        &query.redirect_uri,
        query.state.as_deref(),
    )?;

    let redirect_url = match user {
        Some(user) => {
            let granted_scopes: Vec<String> =
                OAuthUserClientScopes::find_scopes(&mut conn, user.id, client.id).await?;

            let requested: HashSet<&str> = query.scope.split_whitespace().collect();
            let granted: HashSet<&str> = granted_scopes.iter().map(|s| s.as_str()).collect();
            let missing: Vec<&str> = requested.difference(&granted).copied().collect();
            if prompt.none && !missing.is_empty() {
                return Err(oauth_error(
                    "consent_required",
                    "end-user consent is required",
                    Some(&query.redirect_uri),
                    query.state.as_deref(),
                ));
            }

            if prompt.consent || !missing.is_empty() {
                let return_to = format!(
                    "/api/v0/main-frontend/oauth/authorize?{}",
                    build_authorize_qs(&query)
                );
                build_consent_redirect(&query, &return_to)
            } else {
                let code = generate_access_token();
                let expires_at = Utc::now() + Duration::minutes(10);
                let token_hmac_key = &app_conf.oauth_server_configuration.oauth_token_hmac_key;
                let code_digest = token_digest_sha256(&code, token_hmac_key);

                let new_auth_code_params = NewAuthCodeParams {
                    digest: &code_digest,
                    user_id: user.id,
                    client_id: client.id,
                    redirect_uri: &query.redirect_uri,
                    scopes: &query
                        .scope
                        .split_whitespace()
                        .map(|s| s.to_string())
                        .collect_vec(),
                    nonce: query.nonce.as_deref(),
                    code_challenge: query.code_challenge.as_deref(),
                    code_challenge_method: parsed_pkce_method,
                    dpop_jkt: None, // DPoP binding occurs at /token endpoint, not at /authorize
                    expires_at,
                    metadata: serde_json::Map::new(),
                };

                OAuthAuthCode::insert(&mut conn, new_auth_code_params).await?;
                redirect_with_code(&query.redirect_uri, &code, query.state.as_deref())
            }
        }
        None => {
            if prompt.none {
                return Err(oauth_error(
                    "login_required",
                    "end-user is not logged in",
                    Some(&query.redirect_uri),
                    query.state.as_deref(),
                ));
            }
            build_login_redirect(&query)
        }
    };

    server_token.authorized_ok(
        HttpResponse::Found()
            .append_header(("Location", redirect_url))
            .finish(),
    )
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/authorize")
            .wrap(RateLimit::new(RateLimitConfig {
                per_minute: Some(100),
                per_hour: Some(500),
                per_day: Some(2000),
                per_month: None,
            }))
            .route(web::get().to(authorize))
            .route(web::post().to(authorize)),
    );
}
