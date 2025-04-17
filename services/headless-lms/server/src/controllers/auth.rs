/*!
Handlers for HTTP requests to `/api/v0/auth`.
*/

use crate::{
    domain::{
        authorization::{
            self, authorize_with_fetched_list_of_roles, skip_authorize, ActionOnResource,
        },
        rate_limit_middleware_builder::build_rate_limiting_middleware,
    },
    prelude::*,
    OAuthClient,
};
use actix_session::Session;
use reqwest::Client;
use std::{env, time::Duration};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Login {
    email: String,
    password: String,
}

/**
POST `/api/v0/auth/authorize` checks whether user can perform specified action on specified resource.
**/

#[instrument(skip(pool, payload,))]
pub async fn authorize_action_on_resource(
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
    payload: web::Json<ActionOnResource>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let data = payload.0;
    if let Some(user) = user {
        if let Ok(true_token) =
            authorize(&mut conn, data.action, Some(user.id), data.resource).await
        {
            true_token.authorized_ok(web::Json(true))
        } else {
            // We went to return success message even if the authorization fails.
            let false_token = skip_authorize();
            false_token.authorized_ok(web::Json(false))
        }
    } else {
        // Never authorize anonymous user
        let false_token = skip_authorize();
        false_token.authorized_ok(web::Json(false))
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CreateAccountDetails {
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub language: String,
    pub password: String,
    pub password_confirmation: String,
}

/**
POST `/api/v0/auth/signup` Creates new mooc.fi account and signs in.

# Example
```http
POST /api/v0/auth/signup HTTP/1.1
Content-Type: application/json

{
  "email": "student@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "language": "en",
  "password": "hunter42",
  "password_confirmation": "hunter42"
}
```
*/
#[instrument(skip(session, pool, client, payload))]
pub async fn signup(
    session: Session,
    payload: web::Json<CreateAccountDetails>,
    pool: web::Data<PgPool>,
    client: web::Data<OAuthClient>,
    user: Option<AuthUser>,
) -> ControllerResult<HttpResponse> {
    if user.is_none() {
        // First create the actual user to tmc.mooc.fi and then fetch it from mooc.fi
        let user_details = payload.0;
        post_new_user_to_moocfi(&user_details).await?;

        let mut conn = pool.acquire().await?;
        let auth_result = authorization::authenticate_moocfi_user(
            &mut conn,
            &client,
            user_details.email,
            user_details.password,
        )
        .await?;

        if let Some((user, _token)) = auth_result {
            let token = skip_authorize();
            authorization::remember(&session, user)?;
            token.authorized_ok(HttpResponse::Ok().finish())
        } else {
            Err(ControllerError::new(
                ControllerErrorType::Unauthorized,
                "Incorrect email or password.".to_string(),
                None,
            ))
        }
    } else {
        Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Cannot create a new account when signed in.".to_string(),
            None,
        ))
    }
}

/**
POST `/api/v0/auth/authorize-multiple` checks whether user can perform specified action on specified resource.
Returns booleans for the authorizations in the same order as the input.
**/

#[instrument(skip(pool, payload,))]
pub async fn authorize_multiple_actions_on_resources(
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
    payload: web::Json<Vec<ActionOnResource>>,
) -> ControllerResult<web::Json<Vec<bool>>> {
    let mut conn = pool.acquire().await?;
    let input = payload.into_inner();
    let mut results = Vec::with_capacity(input.len());
    if let Some(user) = user {
        // Prefetch roles so that we can do multiple authorizations without repeteadly querying the database.
        let user_roles = models::roles::get_roles(&mut conn, user.id).await?;

        for action_on_resource in input {
            if (authorize_with_fetched_list_of_roles(
                &mut conn,
                action_on_resource.action,
                Some(user.id),
                action_on_resource.resource,
                &user_roles,
            )
            .await)
                .is_ok()
            {
                results.push(true);
            } else {
                results.push(false);
            }
        }
    } else {
        // Never authorize anonymous user
        for _action_on_resource in input {
            results.push(false);
        }
    }
    let token = skip_authorize();
    token.authorized_ok(web::Json(results))
}

/**
POST `/api/v0/auth/login` Logs in to TMC.
Returns true if login was successful, false if credentials were incorrect.
**/
#[instrument(skip(session, pool, client, payload, app_conf))]
pub async fn login(
    session: Session,
    pool: web::Data<PgPool>,
    client: web::Data<OAuthClient>,
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<Login>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let Login { email, password } = payload.into_inner();

    if app_conf.development_uuid_login {
        warn!("Trying development mode UUID login");
        if let Ok(id) = Uuid::parse_str(&email) {
            let user = { models::users::get_by_id(&mut conn, id).await? };
            let token = skip_authorize();
            authorization::remember(&session, user)?;
            return token.authorized_ok(web::Json(true));
        };
    }

    let success = if app_conf.test_mode {
        warn!("Using test credentials. Normal accounts won't work.");
        let success =
            authorization::authenticate_test_user(&mut conn, &email, &password, &app_conf).await?;
        if success {
            let user = models::users::get_by_email(&mut conn, &email).await?;
            authorization::remember(&session, user)?;
        }
        success
    } else {
        let auth_result =
            authorization::authenticate_moocfi_user(&mut conn, &client, email, password).await?;

        if let Some((user, _token)) = auth_result {
            authorization::remember(&session, user)?;
            true
        } else {
            false
        }
    };

    if success {
        info!("Authentication successful");
    } else {
        warn!("Authentication failed");
    }

    let token = skip_authorize();
    token.authorized_ok(web::Json(success))
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
pub async fn logged_in(session: Session, pool: web::Data<PgPool>) -> web::Json<bool> {
    let logged_in = authorization::has_auth_user_session(&session, pool).await;
    web::Json(logged_in)
}

/// Generic information about the logged in user.
///
///  Could include the user name etc in the future.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserInfo {
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

/**
GET `/api/v0/auth/user-info` Returns the current user's info.
**/

#[instrument(skip(auth_user, pool))]
pub async fn user_info(
    auth_user: Option<AuthUser>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Option<UserInfo>>> {
    let token = skip_authorize();
    if let Some(auth_user) = auth_user {
        let mut conn = pool.acquire().await?;
        let user_details =
            models::user_details::get_user_details_by_user_id(&mut conn, auth_user.id).await?;

        token.authorized_ok(web::Json(Some(UserInfo {
            user_id: user_details.user_id,
            first_name: user_details.first_name,
            last_name: user_details.last_name,
        })))
    } else {
        token.authorized_ok(web::Json(None))
    }
}

/// Posts new user account to tmc.mooc.fi.
///
/// Based on implementation from <https://github.com/rage/mooc.fi/blob/fb9a204f4dbf296b35ec82b2442e1e6ae0641fe9/frontend/lib/account.ts>
pub async fn post_new_user_to_moocfi(user_details: &CreateAccountDetails) -> anyhow::Result<()> {
    let tmc_api_url = "https://tmc.mooc.fi/api/v8";
    let origin = env::var("TMC_ACCOUNT_CREATION_ORIGIN")
        .expect("TMC_ACCOUNT_CREATION_ORIGIN must be defined");
    let ratelimit_api_key = env::var("RATELIMIT_PROTECTION_SAFE_API_KEY")
        .expect("RATELIMIT_PROTECTION_SAFE_API_KEY must be defined");
    let tmc_client = Client::default();
    let json = serde_json::json!({
        "user": {
            "email": user_details.email,
            "first_name": user_details.first_name,
            "last_name": user_details.last_name,
            "password": user_details.password,
            "password_confirmation": user_details.password_confirmation
        },
        "user_field": {
            "first_name": user_details.first_name,
            "last_name": user_details.last_name
        },
        "origin": origin,
        "language": user_details.language
    });
    let res = tmc_client
        .post(format!("{}/users", tmc_api_url))
        .header("RATELIMIT-PROTECTION-SAFE-API-KEY", ratelimit_api_key)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::ACCEPT, "application/json")
        .json(&json)
        .send()
        .await
        .context("Failed to send request to https://tmc.mooc.fi")?;
    if res.status().is_success() {
        Ok(())
    } else {
        Err(anyhow::anyhow!("Failed to get current user from Mooc.fi"))
    }
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(
        web::resource("/signup")
            .wrap(build_rate_limiting_middleware(Duration::from_secs(60), 15))
            .wrap(build_rate_limiting_middleware(
                Duration::from_secs(60 * 60 * 24),
                1000,
            ))
            .to(signup),
    )
    .service(
        web::resource("/login")
            .wrap(build_rate_limiting_middleware(Duration::from_secs(60), 20))
            .wrap(build_rate_limiting_middleware(
                Duration::from_secs(60 * 60),
                100,
            ))
            .wrap(build_rate_limiting_middleware(
                Duration::from_secs(60 * 60 * 24),
                500,
            ))
            .to(login),
    )
    .route("/logout", web::post().to(logout))
    .route("/logged-in", web::get().to(logged_in))
    .route("/authorize", web::post().to(authorize_action_on_resource))
    .route(
        "/authorize-multiple",
        web::post().to(authorize_multiple_actions_on_resources),
    )
    .route("/user-info", web::get().to(user_info));
}
