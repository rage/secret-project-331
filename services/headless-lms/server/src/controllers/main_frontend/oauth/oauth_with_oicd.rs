//! Controllers for requests starting with '/api/v0/main-frontend/oauth'.
use super::authorize_query::AuthorizeParams;
use super::consent_deny_query::ConsentDenyQuery;
use super::consent_query::ConsentQuery;
use super::dpop::verify_dpop_from_actix;
use super::helpers::{
    build_authorize_qs, build_consent_redirect, build_login_redirect, generate_access_token,
    generate_id_token, oauth_invalid_client, oauth_invalid_grant, oauth_invalid_request,
    ok_json_no_cache, read_token_pepper, redirect_with_code, rsa_n_e_and_kid_from_pem,
    scope_has_openid, token_digest_hmac_sha256,
};
use super::jwks::{Jwk, Jwks};
use super::token_query::{GrantType, TokenParams};
use super::token_response::TokenResponse;
use super::userinfo_response::UserInfoResponse;
use crate::prelude::*;
use actix_web::{Error, HttpResponse, web};
use chrono::{Duration, Utc};
use domain::error::{OAuthErrorCode, OAuthErrorData};
use dpop_verifier::DpopError;
use headless_lms_utils::ApplicationConfiguration;
use headless_lms_utils::prelude::*;
use models::{
    oauth_access_token::NewAccessTokenParams, oauth_access_token::OAuthAccessToken,
    oauth_auth_code::OAuthAuthCode, oauth_client::OAuthClient,
    oauth_refresh_tokens::NewRefreshTokenParams, oauth_refresh_tokens::OAuthRefreshTokens,
    oauth_user_client_scopes::AuthorizedClientInfo,
    oauth_user_client_scopes::OAuthUserClientScopes, user_details,
};
use serde_json::json;
use sqlx::PgPool;
use std::collections::HashSet;

/// Handles the `/authorize` endpoint for OAuth 2.0 / OpenID Connect.
///
/// This endpoint:
/// - Validates the incoming authorization request.
/// - Checks the client, redirect URI, and requested scopes.
/// - If the user is logged in and has already granted the requested scopes, issues an authorization code.
/// - If the user is logged in but missing consent for some scopes, redirects them to the consent screen.
/// - If the user is not logged in, redirects them to the login page.
///
/// Follows [RFC 6749 Section 3.1](https://datatracker.ietf.org/doc/html/rfc6749#section-3.1) and
/// [OpenID Connect Core 1.0 Section 3](https://openid.net/specs/openid-connect-core-1_0.html#AuthorizationEndpoint).
///
/// # Example
/// ```http
/// GET /api/v0/main-frontend/oauth/authorize?response_type=code&client_id=test-client-id&redirect_uri=http://localhost&scope=openid%20profile%20email&state=random123&nonce=secure_nonce_abc HTTP/1.1
///
/// ```
///
/// Successful redirect:
/// ```http
/// HTTP/1.1 302 Found
/// Location: http://localhost?code=SplxlOBeZQQYbYS6WxSbIA&state=random123
/// ```
async fn authorize(
    pool: web::Data<PgPool>,
    query: AuthorizeParams,
    user: Option<AuthUser>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    let client = OAuthClient::find_by_client_id(&mut conn, &query.client_id)
        .await
        .map_err(|_| oauth_invalid_request("invalid client_id", None, query.state.as_deref()))?;

    if !client.redirect_uris.contains(&query.redirect_uri) {
        return Err(oauth_invalid_request(
            "redirect_uri does not match client",
            Some(&query.redirect_uri),
            query.state.as_deref(),
        ));
    }

    let redirect_url = match user {
        Some(user) => {
            let granted_scopes: Vec<String> =
                OAuthUserClientScopes::find_scopes(&mut conn, user.id, client.id).await?;

            let requested: HashSet<&str> = query.scope.split_whitespace().collect();
            let granted: HashSet<&str> = granted_scopes.iter().map(|s| s.as_str()).collect();
            let missing: Vec<&str> = requested.difference(&granted).copied().collect();

            if !missing.is_empty() {
                let return_to = format!(
                    "/api/v0/main-frontend/oauth/authorize?{}",
                    build_authorize_qs(&query)
                );
                build_consent_redirect(&query, &return_to)
            } else {
                let code = generate_access_token();
                let expires_at = Utc::now() + Duration::minutes(10);
                let (pepper, pepper_id) = read_token_pepper()?;
                let code_digest = token_digest_hmac_sha256(&code, &pepper);

                let new_auth_code_params = models::oauth_auth_code::NewAuthCodeParams {
                    digest: &code_digest,
                    pepper_id,
                    user_id: user.id,
                    client_id: client.id,
                    redirect_uri: &query.redirect_uri,
                    scope: Some(&query.scope),
                    nonce: query.nonce.as_deref(),
                    expires_at,
                    metadata: serde_json::Map::new(),
                };
                OAuthAuthCode::insert(&mut conn, new_auth_code_params).await?;
                redirect_with_code(&query.redirect_uri, &code, query.state.as_deref())
            }
        }

        None => build_login_redirect(&query),
    };

    server_token.authorized_ok(
        HttpResponse::Found()
            .append_header(("Location", redirect_url))
            .finish(),
    )
}

/// Handles `/consent` approval after the user agrees to grant requested scopes.
///
/// This endpoint:
/// - Validates the redirect URI and requested scopes against the registered client.
/// - Records granted scopes for the user-client pair.
/// - Redirects back to `/authorize` to continue the OAuth flow.
///
/// # Example
/// ```http
/// GET /api/v0/main-frontend/oauth/consent?client_id=test-client-id&redirect_uri=http://localhost&scopes=openid%20profile&state=random123&nonce=secure_nonce_abc HTTP/1.1
/// Cookie: session=abc123
///
/// ```
///
/// Redirect back to `/authorize`:
/// ```http
/// HTTP/1.1 302 Found
/// Location: /api/v0/main-frontend/oauth/authorize?client_id=...
/// ```
#[instrument(skip(pool))]
async fn approve_consent(
    pool: web::Data<PgPool>,
    query: web::Query<ConsentQuery>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let client = OAuthClient::find_by_client_id(&mut conn, &query.client_id).await?;
    if !client.redirect_uris.contains(&query.redirect_uri) {
        return Err(ControllerError::from(actix_web::error::ErrorBadRequest(
            "invalid redirect URI",
        )));
    }

    let requested_scopes: Vec<String> = query
        .scopes
        .split_whitespace()
        .map(|s| s.to_string())
        .collect();
    let allowed_scopes = client
        .scope
        .as_ref()
        .map(|s| s.split_whitespace().collect::<Vec<_>>())
        .unwrap_or_default();

    for scope in &requested_scopes {
        if !allowed_scopes.contains(&scope.as_str()) {
            return Err(ControllerError::from(actix_web::error::ErrorBadRequest(
                "invalid scope",
            )));
        }
    }

    for scope in requested_scopes {
        OAuthUserClientScopes::insert(&mut conn, user.id, client.id, scope).await?;
    }

    let redirect_url = format!(
        "/api/v0/main-frontend/oauth/authorize?client_id={}&redirect_uri={}&scope={}&state={}&nonce={}&response_type={}",
        query.client_id,
        query.redirect_uri,
        query.scopes,
        query.state,
        query.nonce,
        query.response_type
    );

    token.authorized_ok(
        HttpResponse::Found()
            .append_header(("Location", redirect_url))
            .finish(),
    )
}

/// Handles `/consent/deny` when the user refuses to grant scopes.
///
/// This endpoint:
/// - Redirects back to the client with `error=access_denied`.
///
/// # Example
/// ```http
/// GET /api/v0/main-frontend/oauth/consent/deny?redirect_uri=http://localhost&state=random123 HTTP/1.1
///
/// ```
///
/// Response:
/// ```http
/// HTTP/1.1 302 Found
/// Location: http://localhost?error=access_denied&state=random123
/// ```
#[instrument]
async fn deny_consent(query: web::Query<ConsentDenyQuery>) -> Result<HttpResponse, Error> {
    let redirect_url = format!(
        "{}?error=access_denied&state={}",
        query.redirect_uri, query.state
    );

    Ok(HttpResponse::Found()
        .append_header(("Location", redirect_url))
        .finish())
}

/// Handles the `/token` endpoint for exchanging an authorization code or refresh token.
///
/// This endpoint:
/// - Validates the client credentials.
/// - For `authorization_code` grants:
///     - Verifies the code and redirect URI.
///     - Issues an access token, refresh token, and optionally an ID token.
/// - For `refresh_token` grants:
///     - Issues a new access token and refresh token.
///
/// Follows [RFC 6749 Section 3.2](https://datatracker.ietf.org/doc/html/rfc6749#section-3.2)
/// and [OIDC Core Section 3.1.3](https://openid.net/specs/openid-connect-core-1_0.html#TokenEndpoint).
///
/// # Example
/// ```http
/// POST /api/v0/main-frontend/oauth/token HTTP/1.1
/// Content-Type: application/x-www-form-urlencoded
///
/// grant_type=authorization_code&code=SplxlOBeZQQYbYS6WxSbIA&redirect_uri=http://localhost&client_id=test-client-id&client_secret=test-secret
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
///   "token_type": "Bearer",
///   "expires_in": 3600
/// }
/// ```
///
/// Error:
/// ```http
/// HTTP/1.1 401 Unauthorized
/// Content-Type: application/json
///
/// {
///   "error": "invalid_client",
///   "error_description": "invalid client secret"
/// }
/// ```
#[instrument(skip(pool))]
async fn token(
    pool: web::Data<PgPool>,
    form: TokenParams,
    req: actix_web::HttpRequest,
) -> ControllerResult<HttpResponse> {
    let (pepper, pepper_id) = read_token_pepper()?;
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    let access_ttl = Duration::hours(1);
    let refresh_ttl = Duration::days(30);

    let client = OAuthClient::find_by_client_id(&mut conn, &form.client_id)
        .await
        .map_err(|_| oauth_invalid_client("invalid client_id"))?;

    if client.client_secret != token_digest_hmac_sha256(&form.client_secret, &pepper) {
        return Err(oauth_invalid_client("invalid client secret"));
    }
    if req.headers().get("dpop").is_none() && !client.bearer_allowed {
        return Err(oauth_invalid_client(
            "client not allowed to use other than dpop-bound tokens",
        ));
    }

    let access_token_plain = generate_access_token();
    let new_refresh_token_plain = generate_access_token();
    let refresh_token_expires_at = Utc::now() + refresh_ttl;

    let (user_id, scope, nonce, expires_at, issue_id_token, token_type) = match &form.grant {
        GrantType::AuthorizationCode { code, redirect_uri } => {
            // DPoP at /token? -> bind issued tokens and set type
            let mut token_type = "Bearer".to_string();
            let mut jkt_at_issue = String::new();
            if req.headers().get("DPoP").is_some() {
                jkt_at_issue = verify_dpop_from_actix(&mut conn, &req, "POST", None).await?;
                token_type = "DPoP".to_string();
            }

            // consume code (by digest), verify binding
            let code_digest = token_digest_hmac_sha256(code, &pepper);
            let auth_code = OAuthAuthCode::consume(&mut conn, code_digest).await?;
            if auth_code.client_id != client.id || &auth_code.redirect_uri != redirect_uri {
                return Err(oauth_invalid_grant(
                    "invalid authorization code or redirect_uri",
                ));
            }

            let scope = auth_code.scope.clone().unwrap_or_default();
            let expires_at = Utc::now() + access_ttl;

            let at_digest = token_digest_hmac_sha256(&access_token_plain, &pepper);
            let new_access_token_params = NewAccessTokenParams {
                digest: &at_digest,
                pepper_id,
                user_id: Some(auth_code.user_id),
                client_id: auth_code.client_id,
                scope: Some(&scope),
                audience: None,
                dpop_jkt: &jkt_at_issue,
                metadata: serde_json::Map::new(),
                expires_at,
            };
            OAuthAccessToken::insert(&mut conn, new_access_token_params).await?;

            // revoke previous RTs for this user+client, then insert fresh RT
            OAuthRefreshTokens::revoke_all_by_user_client(
                &mut conn,
                auth_code.user_id,
                auth_code.client_id,
            )
            .await?;

            let rt_digest = token_digest_hmac_sha256(&new_refresh_token_plain, &pepper);
            let new_refresh_token_params = NewRefreshTokenParams {
                digest: &rt_digest,
                user_id: auth_code.user_id,
                client_id: auth_code.client_id,
                scope: &scope,
                audience: None,
                pepper_id,
                metadata: serde_json::Map::new(),
                dpop_jkt: &jkt_at_issue,
                expires_at: refresh_token_expires_at,
                rotated_from: None,
            };
            OAuthRefreshTokens::insert(&mut conn, new_refresh_token_params).await?;

            (
                auth_code.user_id,
                scope,
                auth_code.nonce.clone(),
                expires_at,
                true,
                token_type,
            )
        }

        GrantType::RefreshToken { refresh_token } => {
            // consume presented RT (by digest)
            let presented = token_digest_hmac_sha256(refresh_token, &pepper);
            let token = OAuthRefreshTokens::consume(&mut conn, presented).await?;
            if token.client_id != client.id {
                return Err(oauth_invalid_grant("invalid refresh_token"));
            }

            // If original RT was DPoP-bound -> require matching proof now
            let (token_type, jkt_at_issue) = if !token.dpop_jkt.is_empty() {
                let presented_jkt = verify_dpop_from_actix(&mut conn, &req, "POST", None).await?;
                if presented_jkt != token.dpop_jkt {
                    return Err(dpop_verifier::DpopError::AthMismatch.into());
                }
                ("DPoP".to_string(), token.dpop_jkt.clone())
            } else {
                ("Bearer".to_string(), String::new())
            };

            // rotate RT (revoke old; insert new linked to previous)
            OAuthRefreshTokens::revoke_all_by_user_client(
                &mut conn,
                token.user_id,
                token.client_id,
            )
            .await?;

            let rt_digest = token_digest_hmac_sha256(&new_refresh_token_plain, &pepper);
            let new_refresh_token_params = NewRefreshTokenParams {
                digest: &rt_digest,
                user_id: token.user_id,
                client_id: token.client_id,
                scope: &token.scope,
                audience: token.audience.as_deref(),
                pepper_id,
                metadata: serde_json::Map::new(),
                dpop_jkt: &jkt_at_issue,
                expires_at: refresh_token_expires_at,
                rotated_from: Some(&token.digest),
            };
            OAuthRefreshTokens::insert(&mut conn, new_refresh_token_params).await?;

            // new AT for same scope/audience
            let expires_at = Utc::now() + access_ttl;
            let at_digest = token_digest_hmac_sha256(&access_token_plain, &pepper);
            let new_access_token_params = NewAccessTokenParams {
                digest: &at_digest,
                pepper_id,
                user_id: Some(token.user_id),
                client_id: token.client_id,
                scope: Some(&token.scope),
                audience: token.audience.as_deref(),
                dpop_jkt: &jkt_at_issue,
                metadata: serde_json::Map::new(),
                expires_at,
            };
            OAuthAccessToken::insert(&mut conn, new_access_token_params).await?;

            (
                token.user_id,
                token.scope.clone(),
                None,
                expires_at,
                false,
                token_type,
            )
        }
    };

    // Optional ID Token (if OIDC requested and we’re in code flow)
    let id_token = if issue_id_token && scope_has_openid(&scope) {
        Some(generate_id_token(
            user_id,
            &client.client_id,
            &nonce.unwrap_or_default(),
            expires_at,
        )?)
    } else {
        None
    };

    // Response (plaintext tokens)
    let response = TokenResponse {
        access_token: access_token_plain,
        refresh_token: Some(new_refresh_token_plain),
        id_token,
        token_type,
        expires_in: access_ttl.num_seconds() as u32,
    };

    server_token.authorized_ok(ok_json_no_cache(response))
}

/// Handles `/userinfo` for returning user claims according to granted scopes.
///
/// This endpoint:
/// - Validates the access token.
/// - Returns `sub` always.
/// - Returns `first_name` and `last_name` if `profile` scope is granted.
/// - Returns `email` if `email` scope is granted.
///
/// Follows [OIDC Core Section 5.3](https://openid.net/specs/openid-connect-core-1_0.html#UserInfo).
///
/// # Example
/// ```http
/// GET /api/v0/main-frontend/oauth/userinfo HTTP/1.1
/// Authorization: Bearer 2YotnFZFEjr1zCsicMWpAA
///
/// ```
///
/// Response with `profile` and `email` scopes:
/// ```http
/// HTTP/1.1 200 OK
/// Content-Type: application/json
///
/// {
///   "sub": "248289761001",
///   "first_name": "Jane",
///   "last_name": "Doe",
///   "email": "janedoe@example.com"
/// }
/// ```
#[instrument(skip(pool))]
async fn user_info(
    pool: web::Data<sqlx::PgPool>,
    req: actix_web::HttpRequest,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    let auth = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| {
            ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::InvalidToken.as_str().into(),
                    error_description: "missing Authorization header".into(),
                    redirect_uri: None,
                    state: None,
                    nonce: None,
                })),
                "missing Authorization header",
                None::<anyhow::Error>,
            )
        })?;

    let (scheme, token) = if let Some(t) = auth.strip_prefix("DPoP ") {
        ("DPoP", t)
    } else if let Some(t) = auth.strip_prefix("Bearer ") {
        ("Bearer", t)
    } else {
        return Err(ControllerError::new(
            ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                error: OAuthErrorCode::InvalidToken.as_str().into(),
                error_description: "unsupported auth scheme".into(),
                redirect_uri: None,
                state: None,
                nonce: None,
            })),
            "unsupported auth scheme",
            None::<anyhow::Error>,
        ));
    };

    // Hash the presented bearer token and look up by digest
    let (pepper, _pepper_id) = read_token_pepper()?;
    let digest = token_digest_hmac_sha256(token, &pepper);

    let access = OAuthAccessToken::find_valid(&mut conn, digest).await?;

    if !access.dpop_jkt.is_empty() {
        if scheme != "DPoP" {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::InvalidToken.as_str().into(),
                    error_description: "DPoP-bound token must use DPoP scheme".into(),
                    redirect_uri: None,
                    state: None,
                    nonce: None,
                })),
                "wrong auth scheme",
                None::<anyhow::Error>,
            ));
        }

        let presented_jkt = verify_dpop_from_actix(&mut conn, &req, "GET", Some(token)).await?;
        if presented_jkt != access.dpop_jkt {
            return Err(DpopError::AthMismatch.into()); // or your own OAuth error mapping
        }
    }

    // UserInfo is end-user focused; ensure the token is bound to a user
    let user_id = match access.user_id {
        Some(u) => u,
        None => {
            return Err(ControllerError::new(
                ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                    error: OAuthErrorCode::InvalidToken.as_str().into(),
                    error_description: "token has no associated user".into(),
                    redirect_uri: None,
                    state: None,
                    nonce: None,
                })),
                "token has no associated user",
                None::<anyhow::Error>,
            ));
        }
    };

    let user = user_details::get_user_details_by_user_id(&mut conn, user_id).await?;

    // Scope-gated claims
    let scopes: std::collections::HashSet<&str> = access
        .scope
        .as_deref()
        .unwrap_or("")
        .split_whitespace()
        .collect();

    let mut res = UserInfoResponse {
        sub: user_id.to_string(),
        first_name: None,
        last_name: None,
        email: None,
    };

    if scopes.contains("profile") {
        res.first_name = user.first_name.clone();
        res.last_name = user.last_name.clone();
    }
    if scopes.contains("email") {
        res.email = Some(user.email.clone());
    }

    server_token.authorized_ok(HttpResponse::Ok().json(res))
}

/// Handles `/jwks.json` for returning the JSON Web Key Set (JWKS).
///
/// This endpoint:
/// - Reads the configured RSA public key.
/// - Exposes it in JWKS format for clients to validate ID tokens.
///
/// Follows [RFC 7517](https://datatracker.ietf.org/doc/html/rfc7517).
///
/// # Example
/// ```http
/// GET /api/v0/main-frontend/oauth/jwks.json HTTP/1.1
///
/// ```
///
/// Response:
/// ```http
/// HTTP/1.1 200 OK
/// Content-Type: application/json
///
/// {
///   "keys": [
///     {
///       "kty": "RSA",
///       "use": "sig",
///       "alg": "RS256",
///       "kid": "abc123",
///       "n": "0vx7agoebGcQSuuPiLJXZptN...",
///       "e": "AQAB"
///     }
///   ]
/// }
/// ```
#[instrument(skip(app_conf))]
async fn jwks(app_conf: web::Data<ApplicationConfiguration>) -> ControllerResult<HttpResponse> {
    let server_token = skip_authorize();
    let public_pem = &app_conf.oauth_server_configuration.rsa_public_key;

    let (n, e, kid) = rsa_n_e_and_kid_from_pem(public_pem)?;

    let jwk = Jwk {
        kty: "RSA".into(),
        use_: "sig".into(),
        alg: "RS256".into(),
        kid,
        n,
        e,
    };
    server_token.authorized_ok(HttpResponse::Ok().json(Jwks { keys: vec![jwk] }))
}
/// Handles `/.well-known/openid-configuration` to expose OIDC discovery metadata.
///
/// This endpoint:
/// - Lists available endpoints, supported response types, and signing algorithms.
/// - Used by OpenID Connect clients for automatic configuration.
///
/// Follows [OIDC Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html).
///
/// # Example
/// ```http
/// GET /api/v0/main-frontend/oauth/.well-known/openid-configuration HTTP/1.1
///
/// ```
///
/// Example response:
/// ```http
/// HTTP/1.1 200 OK
/// Content-Type: application/json
///
/// {
///   "issuer": "https://courses.mooc.fi/api/v0/main-frontend/oauth",
///   "authorization_endpoint": "https://courses.mooc.fi/api/v0/main-frontend/oauth/authorize",
///   "token_endpoint": "https://courses.mooc.fi/api/v0/main-frontend/oauth/token",
///   "userinfo_endpoint": "https://courses.mooc.fi/api/v0/main-frontend/oauth/userinfo",
///   "jwks_uri": "https://courses.mooc.fi/api/v0/main-frontend/oauth/jwks.json",
///   "response_types_supported": ["code"],
///   "subject_types_supported": ["public"],
///   "id_token_signing_alg_values_supported": ["RS256"],
///   "dpop_signing_alg_values_supported": ["ES256", "RS256"],
///   "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"]
/// }
/// ```
async fn well_known_openid(
    app_conf: web::Data<ApplicationConfiguration>,
) -> Result<HttpResponse, Error> {
    let base_url = &app_conf.base_url;
    let config = json!({
        "issuer": format!("{}/api/v0/main-frontend/oauth", base_url),
        "authorization_endpoint": format!("{}/api/v0/main-frontend/oauth/authorize", base_url),
        "token_endpoint": format!("{}/api/v0/main-frontend/oauth/token", base_url),
        "userinfo_endpoint": format!("{}/api/v0/main-frontend/oauth/userinfo", base_url),
        "jwks_uri": format!("{}/api/v0/main-frontend/oauth/jwks.json", base_url),
        "response_types_supported": ["code"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],
        "dpop_signing_alg_values_supported": ["ES256", "RS256"],
        "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"]
    });

    Ok(HttpResponse::Ok().json(config))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct AuthorizedClient {
    pub client_id: Uuid,     // DB uuid (oauth_clients.id)
    pub client_name: String, // human-readable name from oauth_clients.client_id
    pub scopes: Vec<String>,
}

#[instrument(skip(pool, auth_user))]
pub async fn get_authorized_clients(
    pool: web::Data<PgPool>,
    auth_user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let rows: Vec<AuthorizedClientInfo> =
        OAuthUserClientScopes::list_authorized_clients_for_user(&mut conn, auth_user.id).await?;

    token.authorized_ok(HttpResponse::Ok().json(rows))
}

#[instrument(skip(pool, auth_user))]
pub async fn delete_authorized_client(
    pool: web::Data<PgPool>,
    auth_user: AuthUser,
    path: web::Path<Uuid>, // client_id (DB uuid)
) -> ControllerResult<HttpResponse> {
    let client_id = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    OAuthUserClientScopes::revoke_user_client_everything(&mut conn, auth_user.id, client_id)
        .await?;

    token.authorized_ok(HttpResponse::NoContent().finish())
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/authorize", web::get().to(authorize))
        .route("/token", web::post().to(token))
        .route("/userinfo", web::get().to(user_info))
        .route(
            "/.well-known/openid-configuration",
            web::get().to(well_known_openid),
        )
        .route("/jwks.json", web::get().to(jwks))
        .route("/consent", web::get().to(approve_consent))
        .route("/consent/deny", web::get().to(deny_consent))
        .route("/authorized-clients", web::get().to(get_authorized_clients))
        .route(
            "/authorized-clients/{client_id}",
            web::delete().to(delete_authorized_client),
        );
}
