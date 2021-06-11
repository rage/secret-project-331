/*!
Handlers for HTTP requests to `/api/v0/login`.
*/

use crate::{controllers::ApplicationResult, OAuthClient};
use actix_session::Session;
use actix_web::{
    web::{self, Json, ServiceConfig},
    HttpResponse,
};
use anyhow::Context;
use oauth2::{ResourceOwnerPassword, ResourceOwnerUsername, TokenResponse};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Login {
    login: String,
    password: String,
}

#[derive(Deserialize)]
struct CurrentUser {
    id: i32,
}

/**
POST `/api/v0/auth/login` Logs in to TMC.
**/
pub async fn login(
    session: Session,
    client: web::Data<OAuthClient>,
    payload: web::Form<Login>,
) -> ApplicationResult<HttpResponse> {
    let Login { login, password } = payload.into_inner();

    let token = client
        .exchange_password(
            &ResourceOwnerUsername::new(login.clone()),
            &ResourceOwnerPassword::new(password.clone()),
        )
        .request_async(oauth2::reqwest::async_http_client)
        .await
        .context("Failed to authenticate")?;

    let current_user_url = "https://tmc.mooc.fi/api/v8/users/current";
    let client = Client::default();
    let res = client
        .get(current_user_url)
        .bearer_auth(token.access_token().secret())
        .send()
        .await
        .context("Failed to send request to TMC")?;
    if !res.status().is_success() {
        return Err(anyhow::anyhow!("Failed to get current user from TMC").into());
    }

    let current_user: CurrentUser = res.json().await.context("Unexpected response from TMC")?;
    let upstream_id = current_user.id;

    session
        .insert("session", upstream_id)
        .map_err(|_| anyhow::anyhow!("Failed to insert to session"))?;
    Ok(HttpResponse::Ok().finish())
}

/**
POST `/api/v0/auth/logout` Logs out.
**/
pub async fn logout(session: Session) -> HttpResponse {
    session.remove("session");
    HttpResponse::Ok().finish()
}

/**
GET `/api/v0/auth/logged-in` Logs in to TMC.
**/
pub async fn logged_in(session: Session) -> Json<bool> {
    let logged_in = session.entries().get("session").is_some();
    Json(logged_in)
}

pub fn add_auth_routes(cfg: &mut ServiceConfig) {
    cfg.route("/login", web::post().to(login))
        .route("/logout", web::post().to(logout))
        .route("/logged-in", web::get().to(logged_in));
}
