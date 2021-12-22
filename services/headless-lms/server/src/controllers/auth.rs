/*!
Handlers for HTTP requests to `/api/v0/login`.
*/

use crate::{
    controllers::{ControllerError, ControllerResult},
    domain::authorization,
    models::{self, users::User},
    utils::ApplicationConfiguration,
    OAuthClient,
};
use actix_session::Session;
use actix_web::{
    web::{self, Json, ServiceConfig},
    HttpResponse,
};
use anyhow::Context;
use oauth2::{
    basic::{BasicErrorResponseType, BasicTokenType},
    EmptyExtraTokenFields, RequestTokenError, ResourceOwnerPassword, ResourceOwnerUsername,
    StandardErrorResponse, StandardTokenResponse, TokenResponse,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use sqlx::PgPool;
use ts_rs::TS;
use url::form_urlencoded::Target;
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
            .await
        };

        if let Ok(user) = user {
            authorization::remember(&session, user)?;
            return Ok(HttpResponse::Ok().finish());
        } else {
            return Err(ControllerError::Unauthorized(
                "Incorrect email ora password.".to_string(),
            ));
        };
    }

    // only used when testing
    let token = client
        .exchange_password(
            &ResourceOwnerUsername::new(email.clone()),
            &ResourceOwnerPassword::new(password.clone()),
        )
        .request_async(oauth2::reqwest::async_http_client)
        .await;

    if token.is_err() {
        return Err(ControllerError::Unauthorized(
            "Incorrect email ora password.".to_string(),
        ));
    }

    let user = get_user_from_tmc(&token, &mut conn).await;
    if let Ok(user) = user {
        authorization::remember(&session, user)?;
        Ok(HttpResponse::Ok().finish())
    } else {
        Err(ControllerError::Unauthorized(
            "Incorrect email or password.".to_string().finish(),
        ))
    }
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

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/login", web::post().to(login))
        .route("/logout", web::post().to(logout))
        .route("/logged-in", web::get().to(logged_in));
}

pub type LoginToken = Result<
    StandardTokenResponse<EmptyExtraTokenFields, BasicTokenType>,
    RequestTokenError<
        oauth2::reqwest::Error<reqwest::Error>,
        StandardErrorResponse<BasicErrorResponseType>,
    >,
>;

pub async fn get_user_from_tmc(
    token: &LoginToken,
    conn: &mut PgConnection,
) -> ControllerResult<User> {
    if let Ok(token) = token {
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
        let user = match crate::models::users::find_by_upstream_id(conn, upstream_id)
            .await
            .context("Error while trying to find user")?
        {
            Some(existing_user) => existing_user,
            None => {
                crate::models::users::insert_with_upstream_id(conn, &email, upstream_id).await?
            }
        };
        Ok(user)
    } else {
        Err(ControllerError::NotFound(
            "User not found.".to_string().finish(),
        ))
    }
}
