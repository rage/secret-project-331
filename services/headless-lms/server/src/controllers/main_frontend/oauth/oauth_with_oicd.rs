//! Controllers for requests starting with '/api/v0/main-frontend/oauth'.
use crate::prelude::*;
use actix_web::{web, Error, HttpResponse};
use chrono::{DateTime, Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use models::{
    oauth_access_token::OAuthAccessToken, oauth_auth_code::OAuthAuthCode,
    oauth_client::OAuthClient, oauth_refresh_tokens::OAuthRefreshTokens,
    oauth_user_client_scopes::OAuthUserClientScopes, users,
};
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use std::collections::HashMap;
use std::env;
use url::form_urlencoded;
use uuid::Uuid;

// TODO: Refactor this file to be a little cleaner, extract functions and make the flow easier to
// read
// TODO: Perhaps make a custom error for OAuthError for clarity, this can of course under the hood
// return the same actix http errors than it does now.

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
struct AuthorizeQuery {
    client_id: String,
    redirect_uri: String,
    scope: String,
    state: String,
    nonce: String,

    // OAuth2.0 spec requires that auth does not fail when there are unknown parameters present,
    // see RFC 6749 3.1
    #[serde(flatten)]
    pub _extra: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct TokenQuery {
    pub client_id: String,
    pub client_secret: String,
    #[serde(flatten)]
    pub grant: GrantType,

    // OAuth2.0 spec requires that token does not fail when there are unknown parameters present,
    // see RFC 6749 3.2
    #[serde(flatten)]
    pub _extra: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(tag = "grant_type")]
pub enum GrantType {
    #[serde(rename = "authorization_code")]
    AuthorizationCode { code: String, redirect_uri: String },
    #[serde(rename = "refresh_token")]
    RefreshToken { refresh_token: String },
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
struct TokenResponse {
    access_token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    id_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    refresh_token: Option<String>,
    token_type: String,
    expires_in: u32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
struct UserInfoResponse {
    sub: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
struct Claims {
    sub: String,
    aud: String,
    iss: String,
    iat: usize,
    exp: usize,
    nonce: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ConsentQuery {
    pub client_id: String,
    pub redirect_uri: String,
    pub scopes: String,
    pub state: String,
    pub nonce: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ConsentDenyQuery {
    pub redirect_uri: String,
    pub state: String,
}

// TODO: Check client origin in every relevant endpoint. Extract  as a function.

#[instrument(skip(pool))]
async fn authorize(
    pool: web::Data<PgPool>,
    query: web::Query<AuthorizeQuery>,
    user: Option<AuthUser>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    let client = OAuthClient::find_by_client_id(&mut conn, &query.client_id).await?;
    if !client.redirect_uris.contains(&query.redirect_uri) {
        return Err(ControllerError::from(actix_web::error::ErrorBadRequest(
            "redirect_uri missing",
        )));
    }

    let requested_scopes: Vec<&str> = query.scope.split_whitespace().collect();
    if requested_scopes.is_empty() {
        return Err(ControllerError::from(actix_web::error::ErrorBadRequest(
            "scope missing",
        )));
    }

    let is_oidc = requested_scopes.contains(&"openid");
    if is_oidc && query.nonce.is_empty() {
        return Err(ControllerError::from(actix_web::error::ErrorBadRequest(
            "nonce missing",
        )));
    }

    let mut redirect_url: String;

    match user {
        Some(user) => {
            let granted_scopes =
                OAuthUserClientScopes::find_scopes(&mut conn, user.id, client.id).await?;

            let missing_scopes: Vec<&str> = requested_scopes
                .iter()
                .filter(|scope| !granted_scopes.contains(&scope.to_string()))
                .copied()
                .collect();

            if !missing_scopes.is_empty() {
                let return_to = format!(
                    "/api/v0/main-frontend/oauth/authorize?client_id={}&scope={}&redirect_uri={}&state={}&nonce={}",
                    &query.client_id, &query.scope, &query.redirect_uri, &query.state, &query.nonce
                );
                let encoded_return_to: String =
                    form_urlencoded::byte_serialize(return_to.as_bytes()).collect();
                redirect_url = format!(
                    "/oauth_authorize_scopes?client_id={}&redirect_uri={}&scope={}&state={}&nonce={}&return_to={}",
                    &query.client_id,
                    &query.redirect_uri,
                    &query.scope,
                    &query.state,
                    &query.nonce,
                    encoded_return_to
                );

                return server_token.authorized_ok(
                    HttpResponse::Found()
                        .append_header(("Location", redirect_url))
                        .finish(),
                );
            }

            let code = generate_access_token()?;
            let expires_at = Utc::now() + Duration::minutes(10);

            OAuthAuthCode::insert(
                &mut conn,
                &code,
                user.id,
                client.id,
                &query.redirect_uri,
                &query.scope,
                &query.nonce,
                expires_at,
            )
            .await?;

            redirect_url = format!("{}?code={}", query.redirect_uri, code);
            if !query.state.is_empty() {
                redirect_url.push_str(&format!("&state={}", query.state));
            }
        }
        None => {
            let return_to = format!(
                "/api/v0/main-frontend/oauth/authorize?client_id={}&scope={}&redirect_uri={}&state={}&nonce={}",
                &query.client_id, &query.scope, &query.redirect_uri, &query.state, &query.nonce
            );
            let encoded_return_to: String =
                form_urlencoded::byte_serialize(return_to.as_bytes()).collect();
            redirect_url = format!("/login?return_to={}", encoded_return_to);
        }
    }

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

#[instrument(skip(pool))]
async fn token(
    pool: web::Data<PgPool>,
    form: web::Form<TokenQuery>,
) -> ControllerResult<HttpResponse> {
    let access_token_expire_time = Duration::hours(1);
    let refresh_token_expire_time = Duration::days(30);
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();

    let client = OAuthClient::find_by_client_id(&mut conn, &form.client_id).await?;
    if client.client_secret != form.client_secret {
        return Err(ControllerError::from(actix_web::error::ErrorBadRequest(
            "invalid client secret",
        )));
    }

    let access_token = generate_access_token().map_err(map_internal_error)?;
    let new_refresh_token = generate_access_token().map_err(map_internal_error)?;
    let refresh_token_expires_at = Utc::now() + refresh_token_expire_time;

    let (user_id, scope, nonce, expires_at, issue_id_token) = match &form.grant {
        GrantType::AuthorizationCode { code, redirect_uri } => {
            let auth_code = OAuthAuthCode::consume(&mut conn, code).await?;
            if auth_code.client_id != client.id || &auth_code.redirect_uri != redirect_uri {
                return Err(ControllerError::from(actix_web::error::ErrorBadRequest(
                    "invalid grant",
                )));
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
            // TODO: Perhaps remove this? This will logout all other sessions and might not be what
            // we want.
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
        GrantType::RefreshToken { refresh_token } => {
            let token = OAuthRefreshTokens::consume(&mut conn, refresh_token).await?;
            if token.client_id != client.id {
                return Err(ControllerError::from(actix_web::error::ErrorBadRequest(
                    "invalid grant",
                )));
            }
            // TODO: Same as upper, perhaps remove so that we do not logout other sessions by the
            // same user.
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

    server_token.authorized_ok(HttpResponse::Ok().json(response))
}

// TODO: Change this. Make custom OAuth errors and implement them to ControllerError so it can map them
// automatically.
fn map_internal_error<E: std::fmt::Debug>(e: E) -> ControllerError {
    error!(?e);
    ControllerError::from(actix_web::error::ErrorInternalServerError(
        "Something went wrong.",
    ))
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
        exp: exp,
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
fn generate_access_token() -> Result<String, &'static str> {
    let length = 64;
    let charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".to_string();

    let mut rng = rand::rng();
    let token: String = (0..length)
        .map(|_| {
            let idx = rng.random_range(0..charset.len());
            charset.chars().nth(idx).unwrap()
        })
        .collect();
    Ok(token)
}
