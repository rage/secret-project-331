//! Controllers for requests starting with '/api/v0/main-frontend/oauth'.
use super::types::*;
use crate::prelude::*;
use actix_web::{Error, HttpResponse, web};
use chrono::{DateTime, Duration, Utc};
use domain::error::{OAuthErrorCode, OAuthErrorData};
use headless_lms_utils::prelude::*;
use jsonwebtoken::{EncodingKey, Header, encode};
use models::{
    oauth_access_token::OAuthAccessToken, oauth_auth_code::OAuthAuthCode,
    oauth_client::OAuthClient, oauth_refresh_tokens::OAuthRefreshTokens,
    oauth_user_client_scopes::OAuthUserClientScopes, users,
};
use rand::Rng;
use serde_json::json;
use sqlx::PgPool;
use std::env;
use uuid::Uuid;

#[instrument(skip(pool, query))] // TODO dont skip query
async fn authorize(
    pool: web::Data<PgPool>,
    query: SafeExtractor<AuthorizeQuery>,
    user: Option<AuthUser>,
) -> ControllerResult<HttpResponse> {
    query.0.validate()?;

    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    let client_id = query.0.client_id.as_deref().unwrap_or_default();
    let redirect_uri = query.0.redirect_uri.as_deref().unwrap_or_default();
    let scope = query.0.scope.as_deref().unwrap_or_default();
    let state = query.0.state.as_deref().unwrap_or_default();
    let nonce = query.0.nonce.as_deref().unwrap_or_default();

    let client = OAuthClient::find_by_client_id(&mut conn, client_id)
        .await
        .map_err(|_| {
            ControllerError::new(
                ControllerErrorType::OAuthError(OAuthErrorData {
                    error: OAuthErrorCode::InvalidRequest.as_str().into(),
                    error_description: "invalid client_id".into(),
                    redirect_uri: None,
                    state: Some(state.to_string()),
                }),
                "Invalid client_id",
                None::<anyhow::Error>,
            )
        })?;

    if !client.redirect_uris.contains(&redirect_uri.to_string()) {
        return Err(ControllerError::new(
            ControllerErrorType::OAuthError(OAuthErrorData {
                error: OAuthErrorCode::InvalidRequest.as_str().into(),
                error_description: "redirect_uri does not match client".into(),
                redirect_uri: Some(redirect_uri.to_string()),
                state: Some(state.to_string()),
            }),
            "Redirect URI mismatch",
            None::<anyhow::Error>,
        ));
    }

    let requested_scopes: Vec<&str> = scope.split_whitespace().collect();
    let redirect_url = match user {
        Some(user) => {
            let granted_scopes =
                OAuthUserClientScopes::find_scopes(&mut conn, user.id, client.id).await?;
            let missing_scopes: Vec<&str> = requested_scopes
                .iter()
                .filter(|s| !granted_scopes.contains(&s.to_string()))
                .copied()
                .collect();

            if !missing_scopes.is_empty() {
                let return_to = format!(
                    "/api/v0/main-frontend/oauth/authorize?client_id={}&scope={}&redirect_uri={}&state={}&nonce={}",
                    client_id, scope, redirect_uri, state, nonce
                );
                let encoded_return_to =
                    url::form_urlencoded::byte_serialize(return_to.as_bytes()).collect::<String>();
                format!(
                    "/oauth_authorize_scopes?client_id={}&redirect_uri={}&scope={}&state={}&nonce={}&return_to={}",
                    client_id, redirect_uri, scope, state, nonce, encoded_return_to
                )
            } else {
                let code = generate_access_token()?;
                let expires_at = Utc::now() + Duration::minutes(10);
                OAuthAuthCode::insert(
                    &mut conn,
                    &code,
                    user.id,
                    client.id,
                    redirect_uri,
                    scope,
                    nonce,
                    expires_at,
                )
                .await?;

                let mut redirect = format!("{}?code={}", redirect_uri, code);
                if !state.is_empty() {
                    redirect.push_str(&format!("&state={}", state));
                }
                redirect
            }
        }
        None => {
            let return_to = format!(
                "/api/v0/main-frontend/oauth/authorize?client_id={}&scope={}&redirect_uri={}&state={}&nonce={}",
                client_id, scope, redirect_uri, state, nonce
            );
            let encoded_return_to =
                url::form_urlencoded::byte_serialize(return_to.as_bytes()).collect::<String>();
            format!("/login?return_to={}", encoded_return_to)
        }
    };

    server_token.authorized_ok(
        HttpResponse::Found()
            .append_header(("Location", redirect_url))
            .finish(),
    )
}

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
        "/api/v0/main-frontend/oauth/authorize?client_id={}&redirect_uri={}&scope={}&state={}&nonce={}",
        query.client_id, query.redirect_uri, query.scopes, query.state, query.nonce
    );

    token.authorized_ok(
        HttpResponse::Found()
            .append_header(("Location", redirect_url))
            .finish(),
    )
}

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

#[instrument(skip(pool, form))] // TODO: dont skip form
async fn token(
    pool: web::Data<PgPool>,
    form: SafeExtractor<TokenQuery>,
) -> ControllerResult<HttpResponse> {
    form.0.validate()?;

    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    let access_token_expire_time = Duration::hours(1);
    let refresh_token_expire_time = Duration::days(30);

    let client_id = form.0.client_id.as_deref().unwrap_or_default();
    let client_secret = form.0.client_secret.as_deref().unwrap_or_default();

    let client = OAuthClient::find_by_client_id(&mut conn, client_id)
        .await
        .map_err(|_| {
            ControllerError::new(
                ControllerErrorType::OAuthError(OAuthErrorData {
                    error: OAuthErrorCode::InvalidClient.as_str().into(),
                    error_description: "invalid client_id".into(),
                    redirect_uri: None,
                    state: None,
                }),
                "Invalid client_id",
                None::<anyhow::Error>,
            )
        })?;

    if client.client_secret != client_secret {
        return Err(ControllerError::new(
            ControllerErrorType::OAuthError(OAuthErrorData {
                error: OAuthErrorCode::InvalidClient.as_str().into(),
                error_description: "invalid client secret".into(),
                redirect_uri: None,
                state: None,
            }),
            "Invalid client secret",
            None::<anyhow::Error>,
        ));
    }

    let access_token = generate_access_token()?;
    let new_refresh_token = generate_access_token()?;
    let refresh_token_expires_at = Utc::now() + refresh_token_expire_time;

    let (user_id, scope, nonce, expires_at, issue_id_token) = match &form.0.grant {
        Some(GrantType::AuthorizationCode { code, redirect_uri }) => {
            let auth_code = OAuthAuthCode::consume(&mut conn, code).await?;
            if auth_code.client_id != client.id || &auth_code.redirect_uri != redirect_uri {
                return Err(ControllerError::new(
                    ControllerErrorType::OAuthError(OAuthErrorData {
                        error: OAuthErrorCode::InvalidGrant.as_str().into(),
                        error_description: "invalid authorization code or redirect_uri".into(),
                        redirect_uri: None,
                        state: None,
                    }),
                    "Invalid authorization code",
                    None::<anyhow::Error>,
                ));
            }

            let expires_at = Utc::now() + access_token_expire_time;
            let scope = auth_code.scope.clone().unwrap_or_default();

            OAuthAccessToken::insert(
                &mut conn,
                access_token.clone(),
                auth_code.user_id,
                client.id,
                &scope,
                expires_at,
            )
            .await?;
            OAuthRefreshTokens::revoke_all_by_user_client(
                &mut conn,
                auth_code.user_id,
                auth_code.client_id,
            )
            .await?;
            OAuthRefreshTokens::insert(
                &mut conn,
                &new_refresh_token,
                auth_code.user_id,
                client.id,
                &scope,
                refresh_token_expires_at,
            )
            .await?;

            (
                auth_code.user_id,
                scope,
                auth_code.nonce.clone(),
                expires_at,
                true,
            )
        }
        Some(GrantType::RefreshToken { refresh_token }) => {
            let token = OAuthRefreshTokens::consume(&mut conn, refresh_token).await?;
            if token.client_id != client.id {
                return Err(ControllerError::new(
                    ControllerErrorType::OAuthError(OAuthErrorData {
                        error: OAuthErrorCode::InvalidGrant.as_str().into(),
                        error_description: "invalid refresh_token".into(),
                        redirect_uri: None,
                        state: None,
                    }),
                    "Invalid refresh token",
                    None::<anyhow::Error>,
                ));
            }

            OAuthRefreshTokens::revoke_all_by_user_client(
                &mut conn,
                token.user_id,
                token.client_id,
            )
            .await?;
            OAuthRefreshTokens::insert(
                &mut conn,
                &new_refresh_token,
                token.user_id,
                token.client_id,
                &token.scope.clone().unwrap_or_default(),
                refresh_token_expires_at,
            )
            .await?;

            let expires_at = Utc::now() + access_token_expire_time;
            (
                token.user_id,
                token.scope.clone().unwrap_or_default(),
                None,
                expires_at,
                false,
            )
        }
        None => unreachable!("validate() ensures grant is Some"),
    };

    let id_token = if issue_id_token && scope.split_whitespace().any(|s| s == "openid") {
        Some(generate_id_token(
            user_id,
            &client.client_id,
            &nonce.unwrap_or_default(),
            expires_at,
        )?)
    } else {
        None
    };

    let response = TokenResponse {
        access_token,
        refresh_token: Some(new_refresh_token),
        id_token,
        token_type: "Bearer".to_string(),
        expires_in: access_token_expire_time.num_seconds() as u32,
    };
    let mut resp = HttpResponse::Ok();
    resp.insert_header(("Cache-Control", "no-store"));
    resp.insert_header(("Pragma", "no-cache"));
    server_token.authorized_ok(resp.json(response))
}
// TODO: This is not a ready version, remember to actually make it. Returning user id makes no
// sense, the client has that (and nothing else) already.
#[instrument(skip(pool))]
async fn user_info(
    pool: web::Data<PgPool>,
    req: actix_web::HttpRequest,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();
    let token = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("missing or malformed token"))?;

    let access = OAuthAccessToken::find_valid(&mut conn, token).await?;
    let user = users::get_by_id(&mut conn, access.user_id).await?;

    server_token.authorized_ok(HttpResponse::Ok().json(UserInfoResponse {
        sub: user.id.to_string(),
    }))
}

// TODO: Remember to make these actually correct
async fn well_known_openid() -> Result<HttpResponse, Error> {
    let config = json!({
        "issuer": "https://your-domain.com/api/v0/main-frontend/oauth",
        "authorization_endpoint": "https://your-domain.com/api/v0/main-frontend/oauth/authorize",
        "token_endpoint": "https://your-domain.com/api/v0/main-frontend/oauth/token",
        "userinfo_endpoint": "https://your-domain.com/api/v0/main-frontend/oauth/userinfo",
        "jwks_uri": "https://your-domain.com/api/v0/main-frontend/oauth/jwks.json",
        "response_types_supported": ["code"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"]
    });

    Ok(HttpResponse::Ok().json(config))
}

fn generate_id_token(
    user_id: Uuid,
    client_id: &str,
    nonce: &str,
    expires_at: DateTime<Utc>,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now().timestamp() as usize;
    let exp = expires_at.timestamp() as usize;
    let private_pem = env::var("OAUTH_RSA_PRIVATE_PEM").expect("OAUTH_RSA_PRIVATE_PEM must be set");
    let claims = Claims {
        sub: user_id.to_string(),
        aud: client_id.to_string(),
        iss: "mooc.fi".to_string(),
        iat: now,
        exp,
        nonce: nonce.to_string(),
    };
    encode(
        &Header::new(jsonwebtoken::Algorithm::RS256),
        &claims,
        &EncodingKey::from_rsa_pem(&private_pem.as_bytes())?,
    )
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/authorize", web::get().to(authorize))
        .route("/token", web::post().to(token))
        .route("/userinfo", web::get().to(user_info))
        .route(
            "/.well-known/openid-configuration",
            web::get().to(well_known_openid),
        )
        .route("/consent", web::get().to(approve_consent))
        .route("/consent/deny", web::get().to(deny_consent));
}

// TODO: Think if this is secure enough, or if whe should use OsRang for cryptographically safer
// rng tokens. Or we should import custom crate for this (rather not). Also, performance might be
// issue when using charset.chars and not just working with bytes

pub fn generate_access_token() -> UtilResult<String> {
    const LENGTH: usize = 64;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let mut rng = rand::rng(); // your crate-specific `rng()` function

    let token: String = (0..LENGTH)
        .map(|_| {
            let idx = rng.random_range(0..CHARSET.len()); // assuming this exists in your rng
            CHARSET
                .get(idx)
                .copied()
                .ok_or_else(|| {
                    UtilError::new(
                        UtilErrorType::Other,
                        "Failed to select a character during token generation",
                        None,
                    )
                })
                .map(|b| b as char)
        })
        .collect::<Result<String, UtilError>>()?;

    Ok(token)
}
