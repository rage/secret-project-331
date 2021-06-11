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
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Login {
    email: String,
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
    pool: web::Data<PgPool>,
    client: web::Data<OAuthClient>,
    payload: web::Json<Login>,
) -> ApplicationResult<HttpResponse> {
    let Login { email, password } = payload.into_inner();

    // login to TMC
    let token = client
        .exchange_password(
            &ResourceOwnerUsername::new(email.clone()),
            &ResourceOwnerPassword::new(password.clone()),
        )
        .request_async(oauth2::reqwest::async_http_client)
        .await
        .context("Failed to authenticate")?;

    // get upstream id for user from TMC
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

    // create new user if one doesn't exist yet
    let existing_user = crate::models::users::find_by_upstream_id(&pool, upstream_id)
        .await
        .context("Error while trying to find user")?;
    if existing_user.is_none() {
        let new_id = Uuid::new_v4();
        crate::models::users::upsert_user_id(&pool, new_id, Some(upstream_id)).await?;
    }

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
