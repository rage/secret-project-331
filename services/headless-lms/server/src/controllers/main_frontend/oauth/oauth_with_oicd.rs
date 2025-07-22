//! Controllers for requests starting with '/api/v0/main-frontend/oauth'.
use crate::prelude::*;
use actix_web::{Error, HttpResponse, web};
use chrono::{DateTime, Duration, Utc};
use jsonwebtoken::{EncodingKey, Header, encode};
use models::{
    oauth_access_token::OAuthAccessToken, oauth_auth_code::OAuthAuthCode,
    oauth_client::OAuthClient, users,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use std::env;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
struct AuthorizeQuery {
    client_id: String,
    redirect_uri: String,
    scope: String,
    state: String,
    nonce: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
struct TokenQuery {
    grant_type: String,
    code: String,
    client_id: String,
    client_secret: String,
    redirect_uri: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
struct TokenResponse {
    access_token: String,
    id_token: Option<String>,
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

    let scopes: Vec<&str> = query.scope.split_whitespace().collect();
    if scopes.is_empty() {
        return Err(ControllerError::from(actix_web::error::ErrorBadRequest(
            "scope missing",
        )));
    }

    let is_oidc = scopes.contains(&"openid");
    if is_oidc && query.nonce.is_empty() {
        return Err(ControllerError::from(actix_web::error::ErrorBadRequest(
            "nonce missing",
        )));
    }
    let mut redirect_url: String;
    match user {
        Some(user) => {
            let code = Uuid::new_v4().to_string();
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
            redirect_url = "/login".to_string();
        }
    }

    server_token.authorized_ok(
        HttpResponse::Found()
            .append_header(("Location", redirect_url))
            .finish(),
    )
}

#[instrument(skip(pool))]
async fn token(
    pool: web::Data<PgPool>,
    form: web::Form<TokenQuery>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let server_token = skip_authorize();
    let client = OAuthClient::find_by_client_id(&mut conn, &form.client_id).await?;
    if client.client_secret != form.client_secret {
        return Err(ControllerError::from(actix_web::error::ErrorBadRequest(
            "invalid client secret",
        )));
    }

    let auth_code = OAuthAuthCode::consume(&mut conn, &form.code).await?;
    if auth_code.client_id != client.id || auth_code.redirect_uri != form.redirect_uri {
        return Err(ControllerError::from(actix_web::error::ErrorBadRequest(
            "invalid grant",
        )));
    }

    let access_token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + Duration::hours(1);
    OAuthAccessToken::insert(
        &mut conn,
        &access_token,
        auth_code.user_id,
        client.id,
        &auth_code.clone().scope.unwrap_or(String::new()),
        expires_at,
    )
    .await?;

    let id_token = if auth_code
        .scope
        .unwrap_or(String::new())
        .split_whitespace()
        .any(|s| s == "openid")
    {
        Some(generate_id_token(
            auth_code.user_id,
            &client.client_id,
            &auth_code.nonce.unwrap_or(String::new()),
            expires_at,
        )?)
    } else {
        None
    };

    let response = TokenResponse {
        access_token,
        id_token,
        token_type: "Bearer".to_string(),
        expires_in: 3600,
    };

    server_token.authorized_ok(HttpResponse::Ok().json(response))
}

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
        );
}
