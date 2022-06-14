/*!
Handlers for HTTP requests to `/api/v0/login`.
*/

use actix_governor::{Governor, GovernorConfigBuilder};
use std::{env, time::Duration};

use actix_session::Session;
use models::users::User;
use oauth2::{
    basic::BasicTokenType, reqwest::AsyncHttpClientError, EmptyExtraTokenFields,
    ResourceOwnerPassword, ResourceOwnerUsername, StandardTokenResponse, TokenResponse,
};
use reqwest::Client;
use url::form_urlencoded::Target;

use crate::{
    controllers::prelude::*,
    domain::authorization::{self, skip_authorize, ActionOnResource},
    OAuthClient,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Login {
    email: String,
    password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphQLRquest<'a> {
    query: &'a str,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MoocfiCurrentUserResponse {
    pub data: MoocfiCurrentUserResponseData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MoocfiCurrentUserResponseData {
    #[serde(rename = "currentUser")]
    pub current_user: MoocfiCurrentUser,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MoocfiCurrentUser {
    pub id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: String,
    pub upstream_id: i32,
}

/**
POST `/api/v0/auth/authorize` checks whether user can perform specified action on specified resource.
**/
#[generated_doc]
#[instrument(skip(pool, payload,))]
pub async fn authorize_action_on_resource(
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<ActionOnResource>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let data = payload.0;

    let token = authorize(&mut conn, data.action, Some(user.id), data.resource).await?;
    token.authorized_ok(web::Json(true))
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
        warn!("Trying development mode UUID login");
        if let Ok(id) = Uuid::parse_str(&email) {
            let user = { models::users::get_by_id(&mut conn, id).await? };
            let token = skip_authorize()?;
            authorization::remember(&session, user)?;
            return token.authorized_ok(HttpResponse::Ok().finish());
        };
    }

    if app_conf.test_mode {
        warn!("Using test credentials. Normal accounts won't work.");
        let user =
            models::users::authenticate_test_user(&mut conn, &email, &password, &app_conf).await?;
        let token = skip_authorize()?;
        authorization::remember(&session, user)?;
        return token.authorized_ok(HttpResponse::Ok().finish());
    }

    let token = client
        .exchange_password(
            &ResourceOwnerUsername::new(email),
            &ResourceOwnerPassword::new(password),
        )
        .request_async(async_http_client_with_headers)
        .await;
    let token = match token {
        Ok(token) => token,
        Err(error) => {
            info!(token_error = ?error, "Token error when fetching");
            return Err(ControllerError::Unauthorized(
                "Incorrect email or password.".to_string(),
            ));
        }
    };

    let user = get_user_from_moocfi(&token, &mut conn).await;
    if let Ok(user) = user {
        let token = authorize(&mut conn, Act::View, Some(user.id), Res::User).await?;
        authorization::remember(&session, user)?;
        token.authorized_ok(HttpResponse::Ok().finish())
    } else {
        Err(ControllerError::Unauthorized(
            "Incorrect email or password.".to_string().finish(),
        ))
    }
}

/**
 * HTTP Client used only for authing with TMC server, this is to ensure that TMC server
 * does not rate limit auth requests from backend
 */
async fn async_http_client_with_headers(
    mut request: oauth2::HttpRequest,
) -> Result<oauth2::HttpResponse, AsyncHttpClientError> {
    let ratelimit_api_key = env::var("RATELIMIT_PROTECTION_SAFE_API_KEY")
        .expect("RATELIMIT_PROTECTION_SAFE_API_KEY must be defined");
    request.headers.append(
        "RATELIMIT-PROTECTION-SAFE-API-KEY",
        ratelimit_api_key.parse().map_err(|_err| {
            AsyncHttpClientError::Other("Invalid RATELIMIT API key.".to_string())
        })?,
    );
    let result = oauth2::reqwest::async_http_client(request).await?;
    Ok(result)
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
pub async fn logged_in(session: Session) -> web::Json<bool> {
    let logged_in = authorization::has_auth_user_session(&session);
    web::Json(logged_in)
}

pub type LoginToken = StandardTokenResponse<EmptyExtraTokenFields, BasicTokenType>;

pub async fn get_user_from_moocfi(
    token: &LoginToken,
    conn: &mut PgConnection,
) -> anyhow::Result<User> {
    info!("Getting user details from mooc.fi");
    let moocfi_graphql_url = "https://www.mooc.fi/api";
    let client = Client::default();
    let res = client
        .post(moocfi_graphql_url)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::ACCEPT, "application/json")
        .json(&GraphQLRquest {
            query: r#"
{
    currentUser {
    id
    email
    first_name
    last_name
    upstream_id
    }
}
            "#,
        })
        .bearer_auth(token.access_token().secret())
        .send()
        .await
        .context("Failed to send request to Mooc.fi")?;
    if !res.status().is_success() {
        return Err(anyhow::anyhow!("Failed to get current user from Mooc.fi"));
    }
    let current_user_response: MoocfiCurrentUserResponse = res
        .json()
        .await
        .context("Unexpected response from Mooc.fi")?;
    let MoocfiCurrentUser {
        id: moocfi_id,
        first_name,
        last_name,
        email,
        upstream_id,
    } = current_user_response.data.current_user;

    // fetch existing user or create new one
    let user =
        match models::users::find_by_upstream_id(conn, upstream_id)
            .await
            .context("Error while trying to find user")?
        {
            Some(existing_user) => existing_user,
            None => {
                models::users::insert_with_upstream_id_and_moocfi_id(
                    conn,
                    &email,
                    // convert empty names to None
                    first_name.as_deref().and_then(|n| {
                        if n.trim().is_empty() {
                            None
                        } else {
                            Some(n)
                        }
                    }),
                    last_name
                        .as_deref()
                        .and_then(|n| if n.trim().is_empty() { None } else { Some(n) }),
                    upstream_id,
                    moocfi_id,
                )
                .await?
            }
        };
    Ok(user)
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    let governor_conf = GovernorConfigBuilder::default()
        .period(Duration::from_secs(10))
        .burst_size(10)
        .finish()
        .unwrap();
    cfg.service(
        web::resource("/login")
            .wrap(Governor::new(&governor_conf))
            .to(login),
    )
    .route("/logout", web::post().to(logout))
    .route("/logged-in", web::get().to(logged_in))
    .route("/authorize", web::post().to(authorize_action_on_resource));
}
