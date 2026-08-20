//! Common functionality related to authenticating users.

use crate::OAuthClient;
use crate::config::server_runtime_config;
use crate::domain::authorization::{AuthorizationToken, skip_authorize};
use crate::prelude::*;
use actix_http::Payload;
use actix_session::Session;
use actix_session::SessionExt;
use actix_web::{FromRequest, HttpRequest};
use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use futures::Future;
use headless_lms_models::{self as models, users::User};
use headless_lms_utils::http::REQWEST_CLIENT;
use headless_lms_utils::services::tmc::TMCUser;
use headless_lms_utils::services::tmc::TmcClient;
use oauth2::EmptyExtraTokenFields;
use oauth2::HttpClientError;
use oauth2::RequestTokenError;
use oauth2::ResourceOwnerPassword;
use oauth2::ResourceOwnerUsername;
use oauth2::StandardTokenResponse;
use oauth2::TokenResponse;
use oauth2::basic::BasicTokenType;
use secrecy::ExposeSecret;
use secrecy::SecretString;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgConnection;
use std::pin::Pin;
use subtle::ConstantTimeEq;
use tracing_log::log;
use uuid::Uuid;

const SESSION_KEY: &str = "user";

const MOOCFI_GRAPHQL_URL: &str = "https://www.mooc.fi/api";

fn constant_time_eq_str(left: &str, right: &str) -> bool {
    left.as_bytes().ct_eq(right.as_bytes()).into()
}
#[derive(Debug, Serialize, Deserialize)]
struct GraphQLRequest<'a> {
    query: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    variables: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct MoocfiUserResponse {
    pub data: MoocfiUserResponseData,
}

#[derive(Debug, Serialize, Deserialize)]
struct MoocfiUserResponseData {
    pub user: MoocfiUserData,
}

#[derive(Debug, Serialize, Deserialize)]
struct MoocfiUserData {
    pub id: Uuid,
}

// upstream_id is private so FromRequest is the only way to construct an AuthUser.
/// Extractor for an authenticated user.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub fetched_from_db_at: Option<DateTime<Utc>>,
    upstream_id: Option<i32>,
}

impl AuthUser {
    /// The user's ID in TMC.
    pub fn upstream_id(&self) -> Option<i32> {
        self.upstream_id
    }
}

impl FromRequest for AuthUser {
    type Error = ControllerError;
    type Future = Pin<Box<dyn Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let req = req.clone();
        Box::pin(async move {
            let req = req.clone();
            let session = req.get_session();
            let pool: Option<&web::Data<PgPool>> = req.app_data();
            match session.get::<AuthUser>(SESSION_KEY) {
                Ok(Some(user)) => Ok(verify_auth_user_exists(user, pool, &session).await?),
                Ok(None) => Err(controller_err!(
                    Unauthorized,
                    "You are not currently logged in. Please sign in to continue.".to_string()
                )),
                Err(_) => {
                    // session had an invalid value
                    session.remove(SESSION_KEY);
                    Err(controller_err!(
                        Unauthorized,
                        "Your session is invalid or has expired. Please sign in again.".to_string()
                    ))
                }
            }
        })
    }
}

/**
 * Re-fetches the user from the database and refreshes the session once it is more than 3 hours
 * old; otherwise returns the session's cached AuthUser unchanged.
 */
async fn verify_auth_user_exists(
    auth_user: AuthUser,
    pool: Option<&web::Data<PgPool>>,
    session: &Session,
) -> Result<AuthUser, ControllerError> {
    if let Some(fetched_from_db_at) = auth_user.fetched_from_db_at {
        let time_now = Utc::now();
        let time_hour_ago = time_now - Duration::hours(3);
        if fetched_from_db_at > time_hour_ago {
            return Ok(auth_user);
        }
    }
    if let Some(pool) = pool {
        info!("Checking whether the user saved in the session still exists in the database.");
        let mut conn = pool.acquire().await?;
        let user = models::users::get_by_id(&mut conn, auth_user.id).await?;
        remember(session, user)?;
        match session.get::<AuthUser>(SESSION_KEY) {
            Ok(Some(session_user)) => Ok(session_user),
            Ok(None) => Err(controller_err!(
                InternalServerError,
                "User did not persist in the session".to_string()
            )),
            Err(e) => Err(controller_err!(
                InternalServerError,
                "User did not persist in the session".to_string(),
                e
            )),
        }
    } else {
        warn!("No database pool provided to verify_auth_user_exists");
        Err(controller_err!(
            InternalServerError,
            "Unable to verify your user account. The database connection is unavailable."
                .to_string()
        ))
    }
}

/// Stores the user as authenticated in the given session.
pub fn remember(session: &Session, user: models::users::User) -> Result<()> {
    let auth_user = AuthUser {
        id: user.id,
        created_at: user.created_at,
        updated_at: user.updated_at,
        deleted_at: user.deleted_at,
        upstream_id: user.upstream_id,
        fetched_from_db_at: Some(Utc::now()),
    };
    session
        .insert(SESSION_KEY, auth_user)
        .map_err(|_| anyhow::anyhow!("Failed to insert to session"))
}

/// Checks if the user is authenticated in the given session.
pub async fn has_auth_user_session(session: &Session, pool: web::Data<PgPool>) -> bool {
    match session.get::<AuthUser>(SESSION_KEY) {
        Ok(Some(sesssion_auth_user)) => {
            verify_auth_user_exists(sesssion_auth_user, Some(&pool), session)
                .await
                .is_ok()
        }
        _ => false,
    }
}

/// Forgets authentication from the current session, if any.
pub fn forget(session: &Session) {
    session.purge();
}

/// Returns the bearer token only when there is no authenticated user, for the anonymous
/// chatbot-embed path; a logged-in request's token is never surfaced here.
pub fn handle_anonymous_token(req: &HttpRequest, user: Option<AuthUser>) -> Option<String> {
    let anonymous_token_value = req
        .headers()
        .get("authorization")
        .and_then(|anonymous_token| anonymous_token.to_str().ok()?.strip_prefix("Bearer "));

    if let (Some(anonymous_token), None) = (anonymous_token_value, user) {
        Some(anonymous_token.to_owned())
    } else {
        None
    }
}

/** Checks the Authorization header against a secret from environment variables to verify if the request originates from the TMC server. Returns an authorization token if the secret matches, otherwise an unauthorized error.
 */
pub async fn authenticate_tmc_server(
    request: &HttpRequest,
) -> Result<AuthorizationToken, ControllerError> {
    let tmc_server_secret_for_communicating_to_secret_project =
        &server_runtime_config().tmc_server_secret_for_communicating_to_secret_project;
    let auth_header = request
        .headers()
        .get("Authorization")
        .ok_or_else(|| {
            controller_err!(
                Unauthorized,
                "TMC server authorization failed: Missing Authorization header.".to_string()
            )
        })?
        .to_str()
        .map_err(|_| {
            controller_err!(
                Unauthorized,
                "TMC server authorization failed: Invalid Authorization header format.".to_string()
            )
        })?;
    if constant_time_eq_str(
        auth_header,
        tmc_server_secret_for_communicating_to_secret_project.expose_secret(),
    ) {
        return Ok(skip_authorize());
    }
    Err(controller_err!(
        Unauthorized,
        "TMC server authorization failed: Invalid authorization token.".to_string()
    ))
}

pub fn parse_secret_key_from_header(header: &HttpRequest) -> Result<&str, ControllerError> {
    let raw_token = header
        .headers()
        .get("Authorization")
        .map_or(Ok(""), |x| x.to_str())
        .map_err(|_| anyhow::anyhow!("Authorization header contains invalid characters."))?;
    if !raw_token.starts_with("Basic") {
        return Err(controller_err!(
            Forbidden,
            "Access denied: Authorization header must use Basic authentication format.".to_string()
        ));
    }
    let secret_key = raw_token.split(' ').nth(1).ok_or_else(|| {
        controller_err!(
            Forbidden,
            "Access denied: Malformed authorization token, expected 'Basic <token>' format."
                .to_string()
        )
    })?;
    Ok(secret_key)
}

/// Authenticates the user with mooc.fi, returning the authenticated user and their oauth token.
pub async fn authenticate_tmc_mooc_fi_user(
    conn: &mut PgConnection,
    client: &OAuthClient,
    email: String,
    password: SecretString,
    tmc_client: &TmcClient,
) -> anyhow::Result<Option<(User, SecretString)>> {
    info!("Attempting to authenticate user with TMC");
    let token = match exchange_password_with_tmc(client, email.clone(), password).await? {
        Some(token) => token,
        None => return Ok(None),
    };
    debug!("Successfully obtained OAuth token from TMC");

    let tmc_user = tmc_client
        .get_user_from_tmc_mooc_fi_by_tmc_access_token(&token.clone())
        .await?;
    debug!(
        "Creating or fetching user with TMC id {} and mooc.fi UUID {}",
        tmc_user.id,
        tmc_user
            .courses_mooc_fi_user_id
            .map(|uuid| uuid.to_string())
            .unwrap_or_else(|| "None (will fetch from mooc.fi or generate new UUID)".to_string())
    );
    let user = get_or_create_user_from_tmc_mooc_fi_response(&mut *conn, tmc_user, &token).await?;
    info!(
        "Successfully got user details from mooc.fi for user {}",
        user.id
    );
    info!("Successfully authenticated user {} with mooc.fi", user.id);
    Ok(Some((user, token)))
}

pub type LoginToken = StandardTokenResponse<EmptyExtraTokenFields, BasicTokenType>;

/**
Exchanges user credentials with TMC server to obtain an OAuth token.

This function attempts to authenticate a user with the TMC server using their email and password.
It returns different results based on the authentication outcome:

- `Ok(Some(token))` - Authentication successful, returns the OAuth token
- `Ok(None)` - Authentication failed due to invalid credentials (email/password)
- `Err(...)` - Authentication failed due to other errors (server issues, network problems, etc.)
*/
pub async fn exchange_password_with_tmc(
    client: &OAuthClient,
    email: String,
    password: SecretString,
) -> anyhow::Result<Option<SecretString>> {
    let token_result = client
        .exchange_password(
            &ResourceOwnerUsername::new(email),
            // Exposed only here, at the OAuth2 client boundary.
            &ResourceOwnerPassword::new(password.expose_secret().to_string()),
        )
        .request_async(&async_http_client_with_headers)
        .await;
    match token_result {
        Ok(token) => Ok(Some(SecretString::new(
            token.access_token().secret().to_owned().into(),
        ))),
        Err(RequestTokenError::ServerResponse(server_response)) => {
            let error = server_response.error();
            let error_description = server_response.error_description();
            let error_uri = server_response.error_uri();

            // InvalidGrant means the email or password was wrong.
            if let oauth2::basic::BasicErrorResponseType::InvalidGrant = error {
                warn!(
                    ?error_description,
                    ?error_uri,
                    "TMC did not accept the credentials: {}",
                    error
                );
                Ok(None)
            } else {
                error!(
                    ?error_description,
                    ?error_uri,
                    "TMC authentication error: {}",
                    error
                );
                Err(anyhow::anyhow!("Authentication error: {}", error))
            }
        }
        Err(e) => {
            error!("Failed to exchange password with TMC: {}", e);
            Err(e.into())
        }
    }
}

/// Fetches the mooc.fi UUID for a user by their upstream ID using the TMC access token.
async fn fetch_moocfi_id_by_upstream_id(
    tmc_access_token: &SecretString,
    upstream_id: i32,
) -> anyhow::Result<Option<Uuid>> {
    info!("Fetching mooc.fi UUID for upstream user id {}", upstream_id);

    let res = REQWEST_CLIENT
        .post(MOOCFI_GRAPHQL_URL)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::ACCEPT, "application/json")
        // Exposed only here, where the bearer token header is built.
        .bearer_auth(tmc_access_token.expose_secret())
        .json(&GraphQLRequest {
            query: r#"
query ($upstreamId: Int) {
  user(upstream_id: $upstreamId) {
    id
  }
}"#,
            variables: Some(json!({ "upstreamId": upstream_id })),
        })
        .send()
        .await;

    match res {
        Ok(response) => {
            if !response.status().is_success() {
                debug!(
                    "Failed to fetch mooc.fi user with status {}. Will generate new UUID instead.",
                    response.status()
                );
                return Ok(None);
            }

            match response.json::<MoocfiUserResponse>().await {
                Ok(current_user_response) => {
                    info!(
                        "Successfully fetched mooc.fi UUID {} for upstream id {}",
                        current_user_response.data.user.id, upstream_id
                    );
                    Ok(Some(current_user_response.data.user.id))
                }
                Err(e) => {
                    debug!(
                        "Failed to parse mooc.fi response: {}. Will generate new UUID instead.",
                        e
                    );
                    Ok(None)
                }
            }
        }
        Err(e) => {
            debug!(
                "Failed to fetch from mooc.fi: {}. Will generate new UUID instead.",
                e
            );
            Ok(None)
        }
    }
}

pub async fn get_or_create_user_from_tmc_mooc_fi_response(
    conn: &mut PgConnection,
    tmc_mooc_fi_user: TMCUser,
    tmc_access_token: &SecretString,
) -> anyhow::Result<User> {
    let TMCUser {
        id: upstream_id,
        email,
        courses_mooc_fi_user_id: moocfi_id,
        user_field,
        ..
    } = tmc_mooc_fi_user;

    let id = match moocfi_id {
        Some(id) => id,
        None => match fetch_moocfi_id_by_upstream_id(tmc_access_token, upstream_id).await? {
            Some(fetched_id) => {
                info!("Successfully fetched mooc.fi UUID {} for user", fetched_id);
                fetched_id
            }
            None => {
                info!("No mooc.fi UUID found, generating new UUID for user");
                Uuid::new_v4()
            }
        },
    };

    let user = match models::users::find_by_upstream_id(conn, upstream_id).await? {
        Some(existing_user) => existing_user,
        None => {
            let inserted = models::users::insert_with_upstream_id_and_moocfi_id(
                conn,
                &email,
                user_field
                    .first_name
                    .as_deref()
                    .filter(|s| !s.trim().is_empty()),
                user_field
                    .last_name
                    .as_deref()
                    .filter(|s| !s.trim().is_empty()),
                upstream_id,
                id,
            )
            .await;
            match inserted {
                Ok(user) => user,
                // A concurrent request can create the user between the find and the insert
                // (the insert runs in a savepoint, so the connection stays usable). The unique
                // index on upstream_id rejects the loser; return the winner's row instead.
                Err(insert_error)
                    if matches!(
                        insert_error.error_type(),
                        models::ModelErrorType::DatabaseConstraint { constraint, .. }
                            if constraint == "users_upstream_id_active_uniq_idx"
                    ) =>
                {
                    models::users::find_by_upstream_id(conn, upstream_id)
                        .await?
                        .ok_or(insert_error)?
                }
                Err(insert_error) => return Err(insert_error.into()),
            }
        }
    };
    Ok(user)
}

/// Authenticates a test user with predefined credentials.
/// Returns Ok(true) if authentication succeeds, Ok(false) if credentials are incorrect,
/// and Err for other errors.
pub async fn authenticate_test_user(
    conn: &mut PgConnection,
    email: &str,
    password: &SecretString,
    application_configuration: &ApplicationConfiguration,
) -> anyhow::Result<bool> {
    // Sanity check to ensure this is not called outside of test mode. The whole application configuration is passed to this function instead of just the boolean to make mistakes harder.
    assert!(application_configuration.test_mode);

    // Test-only seeded credentials; exposed once here for the literal comparisons below.
    let password = password.expose_secret();

    let _user = if email == "admin@example.com" && password == "admin" {
        models::users::get_by_email(conn, "admin@example.com").await?
    } else if email == "teacher@example.com" && password == "teacher" {
        models::users::get_by_email(conn, "teacher@example.com").await?
    } else if email == "language.teacher@example.com" && password == "language.teacher" {
        models::users::get_by_email(conn, "language.teacher@example.com").await?
    } else if email == "material.viewer@example.com" && password == "material.viewer" {
        models::users::get_by_email(conn, "material.viewer@example.com").await?
    } else if email == "user@example.com" && password == "user" {
        models::users::get_by_email(conn, "user@example.com").await?
    } else if email == "assistant@example.com" && password == "assistant" {
        models::users::get_by_email(conn, "assistant@example.com").await?
    } else if email == "creator@example.com" && password == "creator" {
        models::users::get_by_email(conn, "creator@example.com").await?
    } else if email == "student1@example.com" && password == "student1" {
        models::users::get_by_email(conn, "student1@example.com").await?
    } else if email == "student2@example.com" && password == "student2" {
        models::users::get_by_email(conn, "student2@example.com").await?
    } else if email == "student3@example.com" && password == "student3" {
        models::users::get_by_email(conn, "student3@example.com").await?
    } else if email == "student4@example.com" && password == "student4" {
        models::users::get_by_email(conn, "student4@example.com").await?
    } else if email == "student5@example.com" && password == "student5" {
        models::users::get_by_email(conn, "student5@example.com").await?
    } else if email == "student6@example.com" && password == "student6" {
        models::users::get_by_email(conn, "student6@example.com").await?
    } else if email == "student7@example.com" && password == "student7" {
        models::users::get_by_email(conn, "student7@example.com").await?
    } else if email == "student8@example.com" && password == "student8" {
        models::users::get_by_email(conn, "student8@example.com").await?
    } else if email == "teaching-and-learning-services@example.com"
        && password == "teaching-and-learning-services"
    {
        models::users::get_by_email(conn, "teaching-and-learning-services@example.com").await?
    } else if email == "student-without-research-consent@example.com"
        && password == "student-without-research-consent"
    {
        models::users::get_by_email(conn, "student-without-research-consent@example.com").await?
    } else if email == "student-without-country@example.com"
        && password == "student-without-country"
    {
        models::users::get_by_email(conn, "student-without-country@example.com").await?
    } else if email == "langs@example.com" && password == "langs" {
        models::users::get_by_email(conn, "langs@example.com").await?
    } else if email == "sign-up-user@example.com" && password == "sign-up-user" {
        models::users::get_by_email(conn, "sign-up-user@example.com").await?
    } else {
        info!("Authentication failed: incorrect test credentials");
        return Ok(false);
    };
    info!("Successfully authenticated test user {}", email);
    Ok(true)
}

// Only used for testing, not to use in production.
pub async fn authenticate_test_token(
    conn: &mut PgConnection,
    token: &SecretString,
    application_configuration: &ApplicationConfiguration,
) -> anyhow::Result<Option<User>> {
    // Sanity check to ensure this is not called outside of test mode. The whole application configuration is passed to this function instead of just the boolean to make mistakes harder.
    assert!(application_configuration.test_mode);

    // These token strings are well-known constants, not secrets; they only work under
    // `test_mode`.
    let email = match token.expose_secret() {
        "test-token-langs" => "langs@example.com",
        "test-token-student1" => "student1@example.com",
        "test-token-student2" => "student2@example.com",
        _ => return Ok(None),
    };
    let user = models::users::get_by_email(conn, email).await?;
    info!("Test mode: mapped fixed test token to seeded user {email}");
    Ok(Some(user))
}

/**
 Gets the rate limit protection API key from environment variables and converts it to a header value.
 This key is used to bypass rate limiting when making requests to TMC server.
*/
fn get_ratelimit_api_key() -> Result<reqwest::header::HeaderValue, HttpClientError<reqwest::Error>>
{
    let key = server_runtime_config()
        .ratelimit_protection_safe_api_key
        .clone();
    debug!("Using ratelimit API key from runtime config");

    key.expose_secret()
        .parse::<reqwest::header::HeaderValue>()
        .map_err(|err| {
            error!("Invalid RATELIMIT API key format: {}", err);
            HttpClientError::Other("Invalid RATELIMIT API key.".to_string())
        })
}

/**
 HTTP Client used only for authenticating with TMC server. This function:
 1. Ensures TMC server does not rate limit auth requests from backend by adding a special header
 2. Converts between oauth2 crate's internal http types and our reqwest types:
    - Converts oauth2::HttpRequest to a reqwest::Request
    - Makes the request using our REQWEST_CLIENT
    - Converts the reqwest::Response back to oauth2::HttpResponse
*/
async fn async_http_client_with_headers(
    oauth_request: oauth2::HttpRequest,
) -> Result<oauth2::HttpResponse, HttpClientError<reqwest::Error>> {
    debug!("Making OAuth request to TMC server");

    if log::log_enabled!(log::Level::Trace) {
        // Only log the URL path, not query parameters which may contain credentials
        if let Ok(url) = oauth_request.uri().to_string().parse::<reqwest::Url>() {
            trace!("OAuth request path: {}", url.path());
        }
    }

    let parsed_key = get_ratelimit_api_key()?;

    debug!("Building request to TMC server");
    let request = REQWEST_CLIENT
        .request(
            oauth_request.method().clone(),
            oauth_request
                .uri()
                .to_string()
                .parse::<reqwest::Url>()
                .map_err(|e| HttpClientError::Other(format!("Invalid URL: {}", e)))?,
        )
        .headers(oauth_request.headers().clone())
        .version(oauth_request.version())
        .header("RATELIMIT-PROTECTION-SAFE-API-KEY", parsed_key)
        .body(oauth_request.body().to_vec());

    debug!("Sending request to TMC server");
    let response = request
        .send()
        .await
        .map_err(|e| HttpClientError::Other(format!("Failed to execute request: {}", e)))?;

    // Log response status and version, but not headers or body which may contain tokens
    debug!(
        "Received response from TMC server - Status: {}, Version: {:?}",
        response.status(),
        response.version()
    );

    let status = response.status();
    let version = response.version();
    let headers = response.headers().clone();

    debug!("Reading response body");
    let body_bytes = response
        .bytes()
        .await
        .map_err(|e| HttpClientError::Other(format!("Failed to read response body: {}", e)))?
        .to_vec();

    debug!("Building OAuth response");
    let mut builder = oauth2::http::Response::builder()
        .status(status)
        .version(version);

    if let Some(builder_headers) = builder.headers_mut() {
        builder_headers.extend(headers.iter().map(|(k, v)| (k.clone(), v.clone())));
    }

    let oauth_response = builder
        .body(body_bytes)
        .map_err(|e| HttpClientError::Other(format!("Failed to construct response: {}", e)))?;

    debug!("Successfully completed OAuth request");
    Ok(oauth_response)
}
