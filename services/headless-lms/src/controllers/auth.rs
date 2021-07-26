/*!
Handlers for HTTP requests to `/api/v0/login`.
*/

use crate::{
    controllers::ControllerResult, domain::authorization, models, ApplicationConfiguration,
    OAuthClient,
};
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
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, TS)]
pub struct Login {
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct CurrentUser {
    id: i32,
    email: String,
}

/**
POST `/api/v0/auth/login` Logs in to TMC.
**/
#[instrument(skip(session, pool, client, payload, app_conf))]
pub async fn login(
    session: Session,
    pool: web::Data<PgPool>,
    client: web::Data<OAuthClient>,
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<Login>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let Login { email, password } = payload.into_inner();

    if app_conf.development_uuid_login {
        if let Ok(id) = Uuid::parse_str(&email) {
            let user = { models::users::get_by_id(&mut conn, id).await? };
            authorization::remember(&session, user)?;
            return Ok(HttpResponse::Ok().finish());
        };
    }

    if app_conf.test_mode {
        let user = {
            models::users::authenticate_test_user(
                &mut conn,
                email.clone(),
                password.clone(),
                &app_conf,
            )
            .await?
        };
        authorization::remember(&session, user)?;
        return Ok(HttpResponse::Ok().finish());
    }

    // only used when testing
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
    let email = current_user.email;

    // fetch existing user or create new one
    let user = match crate::models::users::find_by_upstream_id(&mut conn, upstream_id)
        .await
        .context("Error while trying to find user")?
    {
        Some(existing_user) => existing_user,
        None => {
            crate::models::users::insert_with_upstream_id(&mut conn, &email, upstream_id).await?
        }
    };

    authorization::remember(&session, user)?;
    Ok(HttpResponse::Ok().finish())
}

/**
POST `/api/v0/auth/logout` Logs out.
**/
#[instrument(skip(session))]
#[allow(clippy::async_yields_async)]
pub async fn logout(session: Session) -> HttpResponse {
    authorization::forget(&session);
    HttpResponse::Ok().finish()
}

/**
GET `/api/v0/auth/logged-in` Returns the current user's login status.
**/
#[instrument(skip(session))]
pub async fn logged_in(session: Session) -> Json<bool> {
    let logged_in = authorization::has_auth_user_session(&session);
    Json(logged_in)
}

pub fn add_auth_routes(cfg: &mut ServiceConfig) {
    cfg.route("/login", web::post().to(login))
        .route("/logout", web::post().to(logout))
        .route("/logged-in", web::get().to(logged_in));
}
