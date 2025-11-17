//! Controllers for requests starting with '/api/v0/main-frontend/oauth'.
use super::authorize_query::AuthorizeQuery;
use super::consent_deny_query::ConsentDenyQuery;
use super::consent_query::ConsentQuery;
use super::consent_response::ConsentResponse;
use super::dpop::verify_dpop_from_actix;
use super::helpers::{
    build_authorize_qs, build_consent_redirect, build_login_redirect, generate_access_token,
    generate_id_token, oauth_invalid_client, oauth_invalid_grant, oauth_invalid_request,
    ok_json_no_cache, redirect_with_code, rsa_n_e_and_kid_from_pem, scope_has_openid,
    token_digest_sha256,
};
use super::jwks::{Jwk, Jwks};
use super::oauth_validated::OAuthValidated;
use super::token_query::{TokenGrant, TokenQuery};
use super::token_response::TokenResponse;
use super::userinfo_response::UserInfoResponse;
use crate::domain::error::PkceFlowError;
use crate::prelude::*;
use actix_web::{Error, HttpResponse, web};
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::{Duration, Utc};
use domain::error::{OAuthErrorCode, OAuthErrorData};
use dpop_verifier::DpopError;
use headless_lms_utils::ApplicationConfiguration;
use headless_lms_utils::prelude::*;
use itertools::Itertools;
use models::{
    library::oauth::pkce::{CodeChallenge, CodeVerifier, PkceMethod},
    oauth_access_token::{NewAccessTokenParams, OAuthAccessToken, TokenType},
    oauth_auth_code::{NewAuthCodeParams, OAuthAuthCode},
    oauth_client::OAuthClient,
    oauth_refresh_tokens::{NewRefreshTokenParams, OAuthRefreshTokens},
    oauth_user_client_scopes::{AuthorizedClientInfo, OAuthUserClientScopes},
    user_details,
};
use sqlx::PgPool;
use std::collections::HashSet;
use url::{Url, form_urlencoded};

/// Handles the `/authorize` endpoint for OAuth 2.0 and OpenID Connect with PKCE and DPoP support.
///
/// This endpoint:
/// - Validates the incoming authorization request parameters.
/// - Verifies the client, redirect URI, and requested scopes.
/// - Enforces PKCE requirements (`code_challenge` and `code_challenge_method`) for public clients or clients configured with `require_pkce = true`.
/// - Optionally stores a DPoP key thumbprint (`dpop_jkt`) for sender-constrained tokens.
/// - If the user is logged in and has already granted the requested scopes, issues an authorization code and redirects back to the client.
/// - If the user is logged in but missing consent for some scopes, redirects them to the consent screen.
/// - If the user is not logged in, redirects them to the login page.
///
/// Follows:
/// - [RFC 6749 Section 3.1](https://datatracker.ietf.org/doc/html/rfc6749#section-3.1) — Authorization Endpoint
/// - [RFC 7636 (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) — Proof Key for Code Exchange
/// - [OpenID Connect Core 1.0 Section 3](https://openid.net/specs/openid-connect-core-1_0.html#AuthorizationEndpoint)
///
/// # Example
/// ```http
/// GET /api/v0/main-frontend/oauth/authorize?response_type=code&client_id=test-client-id&redirect_uri=http://localhost&scope=openid%20profile%20email&state=random123&nonce=secure_nonce_abc&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256 HTTP/1.1
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

    // PKCE checks at authorize-time (store for later verification at /token)
    let pkce_required = client.requires_pkce();
    let (cc_opt, ccm_opt) = (
        query.code_challenge.as_deref(),
        query.code_challenge_method.as_deref(),
    );
    let parsed_pkce_method: Option<PkceMethod> = match (cc_opt, ccm_opt) {
        (Some(ch), Some(m)) => {
            let method = PkceMethod::parse(m).ok_or_else(|| {
                oauth_invalid_request(
                    "unsupported code_challenge_method",
                    Some(&query.redirect_uri),
                    query.state.as_deref(),
                )
            })?;

            if !client.allows_pkce_method(method) {
                return Err(oauth_invalid_request(
                    "code_challenge_method not allowed for this client",
                    Some(&query.redirect_uri),
                    query.state.as_deref(),
                ));
            }

            match method {
                PkceMethod::S256 => {
                    // must be base64url (no pad) and decode to 32 bytes
                    let bytes = URL_SAFE_NO_PAD.decode(ch).map_err(|_| {
                        oauth_invalid_request(
                            "invalid code_challenge for S256 (not base64url/no-pad)",
                            Some(&query.redirect_uri),
                            query.state.as_deref(),
                        )
                    })?;
                    if bytes.len() != 32 {
                        return Err(oauth_invalid_request(
                            "invalid code_challenge for S256 (must decode to 32 bytes)",
                            Some(&query.redirect_uri),
                            query.state.as_deref(),
                        ));
                    }
                }
                PkceMethod::Plain => {
                    CodeVerifier::new(ch).map_err(|_| {
                        oauth_invalid_request(
                            "invalid code_challenge for plain",
                            Some(&query.redirect_uri),
                            query.state.as_deref(),
                        )
                    })?;
                }
            }

            Some(method)
        }
        (None, None) => None,
        _ => {
            return Err(oauth_invalid_request(
                "code_challenge and code_challenge_method must be used together",
                Some(&query.redirect_uri),
                query.state.as_deref(),
            ));
        }
    };

    if pkce_required && parsed_pkce_method.is_none() {
        return Err(oauth_invalid_request(
            "PKCE required for this client",
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
                let code = generate_access_token(); // adjust path
                let expires_at = Utc::now() + Duration::minutes(10);
                let code_digest = token_digest_sha256(&code); // adjust path

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
                    dpop_jkt: None,
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
    form: web::Json<ConsentQuery>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let client = OAuthClient::find_by_client_id(&mut conn, &form.client_id).await?;
    if !client.redirect_uris.contains(&form.redirect_uri) {
        return Err(ControllerError::from(actix_web::error::ErrorBadRequest(
            "invalid redirect URI",
        )));
    }

    // Validate requested scopes against client.allowed scopes
    let requested_scopes: Vec<String> = form
        .scope
        .split_whitespace()
        .map(|s| s.to_string())
        .collect();

    let allowed_scopes = &client.scopes;

    for scope in &requested_scopes {
        if !allowed_scopes.contains(scope) {
            return Err(ControllerError::from(actix_web::error::ErrorBadRequest(
                "invalid scope",
            )));
        }
    }

    OAuthUserClientScopes::insert(&mut conn, user.id, client.id, &requested_scopes).await?;

    // Redirect to /authorize (the OAuth authorize endpoint typically remains a GET)
    let query = form_urlencoded::Serializer::new(String::new())
        .append_pair("client_id", &form.client_id)
        .append_pair("redirect_uri", &form.redirect_uri)
        .append_pair("scope", &form.scope)
        .append_pair("state", &form.state)
        .append_pair("nonce", &form.nonce)
        .append_pair("response_type", &form.response_type)
        .finish();

    // Relative Location: browser resolves against current origin
    let location = format!("/api/v0/main-frontend/oauth/authorize?{}", query);

    token.authorized_ok(HttpResponse::Ok().json(ConsentResponse {
        redirect_uri: location,
    }))
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
async fn deny_consent(
    pool: web::Data<PgPool>,
    form: web::Json<ConsentDenyQuery>,
) -> Result<HttpResponse, Error> {
    let mut conn = pool
        .acquire()
        .await
        .map_err(actix_web::error::ErrorInternalServerError)?;

    let client = OAuthClient::find_by_client_id(&mut conn, &form.client_id)
        .await
        .map_err(actix_web::error::ErrorBadRequest)?;

    if !client.redirect_uris.contains(&form.redirect_uri) {
        return Err(actix_web::error::ErrorBadRequest("invalid redirect URI"));
    }

    let mut url = Url::parse(&form.redirect_uri)
        .map_err(|_| actix_web::error::ErrorBadRequest("invalid redirect URI"))?;

    {
        let mut qp = url.query_pairs_mut();
        qp.append_pair("error", "access_denied");
        if !form.state.is_empty() {
            qp.append_pair("state", &form.state);
        }
    }

    Ok(HttpResponse::Found()
        .append_header(("Location", url.to_string()))
        .finish())
}

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
#[instrument(skip(pool, app_conf))]
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

    if client.is_confidential() {
        match client.client_secret {
            Some(ref secret) => {
                if !secret.constant_eq(&token_digest_sha256(
                    &form.client_secret.clone().unwrap_or_default(),
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
    let dpop_jkt_opt = if let Some(_) = req.headers().get("DPoP") {
        Some(verify_dpop_from_actix(&mut conn, &req, "POST", None).await?)
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

    let access_token_plain = generate_access_token();
    let new_refresh_token_plain = generate_access_token();
    let refresh_token_expires_at = Utc::now() + refresh_ttl;

    let (user_id, scope_vec, nonce_opt, at_expires_at, issue_id_token) = match &form.grant {
        TokenGrant::AuthorizationCode {
            code,
            redirect_uri,
            code_verifier,
        } => {
            let code_digest = token_digest_sha256(code);
            let code_row = if let Some(ref_uri) = redirect_uri {
                OAuthAuthCode::consume_with_redirect(&mut conn, code_digest, ref_uri).await?
            } else {
                OAuthAuthCode::consume(&mut conn, code_digest).await?
            };

            match (
                code_row.code_challenge.as_deref(),
                code_row.code_challenge_method,
            ) {
                (Some(stored_chal), Some(method)) => {
                    if !client.allows_pkce_method(method) {
                        return Err(PkceFlowError::InvalidRequest(
                            "pkce method not allowed for this client",
                        )
                        .into());
                    }

                    let verifier_str = code_verifier
                        .as_deref()
                        .ok_or_else(|| PkceFlowError::InvalidRequest("code_verifier required"))?;

                    let verifier = CodeVerifier::new(verifier_str)
                        .map_err(|_| PkceFlowError::InvalidRequest("invalid code_verifier"))?;

                    let challenge = CodeChallenge::from_stored(stored_chal);

                    if !challenge.verify(&verifier, method) {
                        return Err(PkceFlowError::InvalidGrant("PKCE verification failed").into());
                    }
                }

                (None, None) => {
                    if client.requires_pkce() {
                        return Err(
                            PkceFlowError::InvalidRequest("PKCE required for this client").into(),
                        );
                    }
                    // else: PKCE not used for this auth code (allowed)
                }

                // Anything else is a server-side inconsistency
                _ => {
                    return Err(PkceFlowError::ServerError("inconsistent PKCE state").into());
                }
            }

            if code_row.client_id != client.id {
                return Err(oauth_invalid_grant("invalid authorization code"));
            }

            let at_digest = token_digest_sha256(&access_token_plain);
            OAuthAccessToken::insert(
                &mut conn,
                NewAccessTokenParams {
                    digest: &at_digest,
                    user_id: Some(code_row.user_id),
                    client_id: code_row.client_id,
                    scopes: &code_row.scopes,
                    audience: None,
                    token_type: issued_token_type,
                    dpop_jkt: dpop_jkt_opt.as_deref(),
                    metadata: serde_json::Map::new(),
                    expires_at: Utc::now() + access_ttl,
                },
            )
            .await?;

            OAuthRefreshTokens::revoke_all_by_user_client(
                &mut conn,
                code_row.user_id,
                code_row.client_id,
            )
            .await?;

            let rt_digest = token_digest_sha256(&new_refresh_token_plain);
            OAuthRefreshTokens::insert(
                &mut conn,
                NewRefreshTokenParams {
                    digest: &rt_digest,
                    user_id: code_row.user_id,
                    client_id: code_row.client_id,
                    scopes: &code_row.scopes,
                    audience: None,
                    expires_at: refresh_token_expires_at,
                    rotated_from: None,
                    metadata: serde_json::Map::new(),
                    dpop_jkt: dpop_jkt_opt.as_deref(),
                },
            )
            .await?;

            (
                code_row.user_id,
                code_row.scopes,
                code_row.nonce.clone(),
                Utc::now() + access_ttl,
                true,
            )
        }

        TokenGrant::RefreshToken {
            refresh_token,
            scope: _,
        } => {
            let presented = token_digest_sha256(refresh_token);
            let old = OAuthRefreshTokens::consume(&mut conn, presented).await?;

            if old.client_id != client.id {
                return Err(oauth_invalid_grant("invalid refresh_token"));
            }

            if let Some(expected_jkt) = old.dpop_jkt.as_deref() {
                let presented_jkt = dpop_jkt_opt.as_deref().ok_or_else(|| {
                    oauth_invalid_client("missing DPoP header for sender-constrained refresh")
                })?;
                if presented_jkt != expected_jkt {
                    return Err(dpop_verifier::DpopError::AthMismatch.into());
                }
            }

            OAuthRefreshTokens::revoke_all_by_user_client(&mut conn, old.user_id, old.client_id)
                .await?;

            let rt_digest = token_digest_sha256(&new_refresh_token_plain);
            OAuthRefreshTokens::insert(
                &mut conn,
                NewRefreshTokenParams {
                    digest: &rt_digest,
                    user_id: old.user_id,
                    client_id: old.client_id,
                    scopes: &old.scopes,
                    audience: old.audience.as_deref(),
                    expires_at: refresh_token_expires_at,
                    rotated_from: Some(&old.digest),
                    metadata: serde_json::Map::new(),
                    dpop_jkt: old.dpop_jkt.as_deref().or(dpop_jkt_opt.as_deref()),
                },
            )
            .await?;

            let at_digest = token_digest_sha256(&access_token_plain);
            let refresh_issue_type = if old.dpop_jkt.is_some() {
                TokenType::DPoP
            } else {
                issued_token_type
            };
            let at_jkt = if let Some(j) = old.dpop_jkt.as_deref() {
                Some(j)
            } else {
                dpop_jkt_opt.as_deref()
            };

            OAuthAccessToken::insert(
                &mut conn,
                NewAccessTokenParams {
                    digest: &at_digest,
                    user_id: Some(old.user_id),
                    client_id: old.client_id,
                    scopes: &old.scopes,
                    audience: old.audience.as_deref(),
                    token_type: refresh_issue_type,
                    dpop_jkt: at_jkt,
                    metadata: serde_json::Map::new(),
                    expires_at: Utc::now() + access_ttl,
                },
            )
            .await?;

            (
                old.user_id,
                old.scopes.clone(),
                None,
                Utc::now() + access_ttl,
                false,
            )
        }
    };

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
        access_token: access_token_plain,
        refresh_token: Some(new_refresh_token_plain),
        id_token,
        token_type: match issued_token_type {
            TokenType::Bearer => "Bearer".to_string(),
            TokenType::DPoP => "DPoP".to_string(),
        },
        expires_in: access_ttl.num_seconds() as u32,
    };

    server_token.authorized_ok(ok_json_no_cache(response))
}

/// Handles `/userinfo` for returning user claims according to granted scopes.
///
/// - Validates access token (Bearer or DPoP-bound)
/// - For DPoP tokens: requires valid DPoP proof (JKT + ATH)
/// - For Bearer tokens: requires client.bearer_allowed = true
/// - Returns `sub` always; `first_name`/`last_name` with `profile`; `email` with `email`
///
/// Follows OIDC Core §5.3.
#[instrument(skip(pool))]
async fn user_info(
    pool: web::Data<sqlx::PgPool>,
    req: actix_web::HttpRequest,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    // ---- Parse Authorization header ----
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

    let (presented_scheme, raw_token) = if let Some(t) = auth.strip_prefix("DPoP ") {
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

    // ---- Look up token by digest ----
    let digest = token_digest_sha256(raw_token);
    let access = OAuthAccessToken::find_valid(&mut conn, digest).await?;

    // ---- Enforce scheme/token_type consistency ----
    match access.token_type {
        TokenType::Bearer => {
            // Bearer tokens must use the Bearer scheme
            if presented_scheme != "Bearer" {
                return Err(ControllerError::new(
                    ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                        error: OAuthErrorCode::InvalidToken.as_str().into(),
                        error_description: "bearer token must use Bearer scheme".into(),
                        redirect_uri: None,
                        state: None,
                        nonce: None,
                    })),
                    "wrong auth scheme for bearer token",
                    None::<anyhow::Error>,
                ));
            }

            let client = OAuthClient::find_by_id(&mut conn, access.client_id).await?;
            if !client.bearer_allowed {
                return Err(ControllerError::new(
                    ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                        error: OAuthErrorCode::InvalidToken.as_str().into(),
                        error_description: "client not allowed to use bearer tokens".into(),
                        redirect_uri: None,
                        state: None,
                        nonce: None,
                    })),
                    "client not bearer-allowed",
                    None::<anyhow::Error>,
                ));
            }
        }
        TokenType::DPoP => {
            // DPoP-bound tokens must use DPoP scheme + valid proof
            if presented_scheme != "DPoP" {
                return Err(ControllerError::new(
                    ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                        error: OAuthErrorCode::InvalidToken.as_str().into(),
                        error_description: "DPoP-bound token must use DPoP scheme".into(),
                        redirect_uri: None,
                        state: None,
                        nonce: None,
                    })),
                    "wrong auth scheme for DPoP token",
                    None::<anyhow::Error>,
                ));
            }

            let bound_jkt = access.dpop_jkt.as_deref().ok_or_else(|| {
                ControllerError::new(
                    ControllerErrorType::OAuthError(Box::new(OAuthErrorData {
                        error: OAuthErrorCode::InvalidToken.as_str().into(),
                        error_description: "token marked DPoP but missing cnf.jkt".into(),
                        redirect_uri: None,
                        state: None,
                        nonce: None,
                    })),
                    "dpop token missing jkt",
                    None::<anyhow::Error>,
                )
            })?;

            // Verify proof (includes `ath` = hash of raw_token)
            let presented_jkt =
                verify_dpop_from_actix(&mut conn, &req, "GET", Some(raw_token)).await?;
            if presented_jkt != bound_jkt {
                return Err(DpopError::AthMismatch.into());
            }
        }
    }

    // ---- Ensure token is for a user ----
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

    // ---- Fetch user and scopes ----
    let user = user_details::get_user_details_by_user_id(&mut conn, user_id).await?;
    let scopes: std::collections::HashSet<String> =
        std::collections::HashSet::from_iter(access.scopes.into_iter());

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

    // Best practice: prevent caching
    server_token.authorized_ok(
        HttpResponse::Ok()
            .insert_header(("Cache-Control", "no-store"))
            .json(res),
    )
}
/// Handles `/jwks.json` for returning the JSON Web Key Set (JWKS).
///
/// This endpoint:
/// - Reads the configured ID Token signing public key (RS256).
/// - Exposes it in JWKS format for clients to validate ID tokens.
///
/// Follows [RFC 7517](https://datatracker.ietf.org/doc/html/rfc7517) and
/// [OIDC Core §10](https://openid.net/specs/openid-connect-core-1_0.html#RotateSigKeys).
///
/// # Example
/// ```http
/// GET /api/v0/main-frontend/oauth/jwks.json HTTP/1.1
/// ```
///
/// Response:
/// ```http
/// HTTP/1.1 200 OK
/// Content-Type: application/json
///
/// {
///   "keys": [
///     { "kty":"RSA","use":"sig","alg":"RS256","kid":"abc123","n":"...","e":"AQAB" }
///   ]
/// }
/// ```
#[instrument(skip(app_conf))]
pub async fn jwks(app_conf: web::Data<ApplicationConfiguration>) -> ControllerResult<HttpResponse> {
    let server_token = skip_authorize();

    // The public key used for signing ID tokens (RS256)
    let public_pem = &app_conf.oauth_server_configuration.rsa_public_key;

    // Extract modulus (n), exponent (e), and a stable key id (kid) from the PEM
    let (n, e, kid) = rsa_n_e_and_kid_from_pem(public_pem)?;

    // Your existing JWKS types
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
/// This endpoint advertises the AS/OP capabilities so clients can auto-configure:
/// - Endpoints (authorize, token, userinfo, jwks)
/// - Supported response/grant types
/// - Token endpoint auth methods
/// - ID Token signing algs
/// - PKCE and DPoP metadata
///
/// Follows:
/// - [OIDC Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)
/// - [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414)
/// - [RFC 9449 — DPoP metadata](https://www.rfc-editor.org/rfc/rfc9449#name-authorization-server-metadata)
///
/// # Example
/// ```http
/// GET /api/v0/main-frontend/oauth/.well-known/openid-configuration HTTP/1.1
/// ```
///
/// Example response (truncated):
/// ```json
/// {
///   "issuer": "https://example.org/api/v0/main-frontend/oauth",
///   "authorization_endpoint": "https://example.org/api/v0/main-frontend/oauth/authorize",
///   "token_endpoint": "https://example.org/api/v0/main-frontend/oauth/token",
///   "userinfo_endpoint": "https://example.org/api/v0/main-frontend/oauth/userinfo",
///   "jwks_uri": "https://example.org/api/v0/main-frontend/oauth/jwks.json",
///   "response_types_supported": ["code"],
///   "grant_types_supported": ["authorization_code","refresh_token"],
///   "code_challenge_methods_supported": ["S256"],
///   "token_endpoint_auth_methods_supported": ["none","client_secret_post"],
///   "id_token_signing_alg_values_supported": ["RS256"],
///   "subject_types_supported": ["public"],
///   "dpop_signing_alg_values_supported": ["ES256","RS256"]
/// }
/// ```
#[instrument(skip(app_conf))]
pub async fn well_known_openid(
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    let server_token = skip_authorize();
    let base_url = app_conf.base_url.trim_end_matches('/');

    // We advertise what the server *globally* supports. Per-client specifics (like allowed PKCE methods)
    // can be stricter; by default we allow only S256 for PKCE at the server level.
    let config = serde_json::json!({
        "issuer":                          format!("{}/api/v0/main-frontend/oauth", base_url),
        "authorization_endpoint":          format!("{}/api/v0/main-frontend/oauth/authorize", base_url),
        "token_endpoint":                  format!("{}/api/v0/main-frontend/oauth/token", base_url),
        "userinfo_endpoint":               format!("{}/api/v0/main-frontend/oauth/userinfo", base_url),
        "jwks_uri":                        format!("{}/api/v0/main-frontend/oauth/jwks.json", base_url),

        // Core capabilities
        "response_types_supported":        ["code"],
        "grant_types_supported":           ["authorization_code","refresh_token"],
        "subject_types_supported":         ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],

        // Token endpoint auth: public ("none") and confidential via client_secret_post
        "token_endpoint_auth_methods_supported": ["none","client_secret_post"],

        // PKCE (RFC 7636): server supports S256; "plain" discouraged and typically disabled
        "code_challenge_methods_supported": ["S256"],

        // DPoP (RFC 9449) metadata
        "dpop_signing_alg_values_supported": ["ES256","RS256"],

        // Nice-to-have hints for clients (optional but common)
        "scopes_supported":                ["openid","profile","email","offline_access"],
        "claims_supported":                ["sub","iss","aud","exp","iat","auth_time","nonce","email","email_verified","name","given_name","family_name"],
        "response_modes_supported":        ["query"],
        "userinfo_signing_alg_values_supported": [], // we return plain JSON at /userinfo
    });

    server_token.authorized_ok(HttpResponse::Ok().json(config))
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
        .route("/consent", web::post().to(approve_consent))
        .route("/consent/deny", web::post().to(deny_consent))
        .route("/authorized-clients", web::get().to(get_authorized_clients))
        .route(
            "/authorized-clients/{client_id}",
            web::delete().to(delete_authorized_client),
        );
}
