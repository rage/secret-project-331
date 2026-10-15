/*!
Handlers for HTTP requests to `/api/v0/auth`.
*/

use crate::domain::exercise_services::token::delete_user_and_invalidate_cached_tokens;
use crate::{
    OAuthClient,
    domain::{
        authentication,
        authorization::{ActionOnResource, is_permitted, skip_authorize},
        email_ownership_verification::{MAX_CODE_ATTEMPTS, MIN_RESEND_INTERVAL_MINUTES},
        rate_limit_middleware_builder::{RateLimit, RateLimitConfig, RateLimitKey},
        session_verification::{self, EmailCodeOutcome},
    },
    prelude::*,
};
use actix_session::Session;
use actix_web::{
    cookie::Cookie,
    http::header::{CacheControl, CacheDirective},
};
use anyhow::Error;
use anyhow::anyhow;
use chrono::Duration;
use headless_lms_models::ModelErrorType;
use headless_lms_models::{
    email_templates::EmailTemplateType,
    email_verification_tokens, user_email_codes,
    user_email_codes::{CodeCheck, UserEmailCodePurpose},
    users,
};
use headless_lms_utils::{
    cache::Cache,
    ip_to_country::IpToCountryMapper,
    prelude::{UtilError, UtilErrorType},
    services::tmc::{NewUserInfo, TmcAccountDeletion, TmcClient},
};
use secrecy::{ExposeSecret, SecretString};
use tracing_log::log;
use utoipa::{OpenApi, ToSchema};

#[derive(Debug, Deserialize, ToSchema)]
pub struct Login {
    pub email: String,
    #[schema(value_type = String)]
    pub password: SecretString,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum LoginResponse {
    Success,
    RequiresEmailVerification {
        #[schema(value_type = String)]
        email_verification_token: OutboundSecret,
    },
    Failed,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SignupResponse {
    Success,
    EmailAlreadyExists,
}

/**
POST `/api/v0/auth/authorize` checks whether user can perform specified action on specified resource.
**/

#[utoipa::path(
    post,
    path = "/authorize",
    tag = "auth",
    operation_id = "postAuthAuthorize",
    request_body = ActionOnResource,
    responses(
        (status = 200, description = "Whether the action is allowed for the current user", body = bool)
    )
)]
#[instrument(skip(pool, payload,))]
pub async fn authorize_action_on_resource(
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
    payload: web::Json<ActionOnResource>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let data = payload.0;
    if let Some(user) = user {
        match authorize(&mut conn, data.action, Some(user.id), data.resource).await {
            Ok(true_token) => true_token.authorized_ok(web::Json(true)),
            _ => {
                // We went to return success message even if the authorization fails.
                let false_token = skip_authorize();
                false_token.authorized_ok(web::Json(false))
            }
        }
    } else {
        // Never authorize anonymous user
        let false_token = skip_authorize();
        false_token.authorized_ok(web::Json(false))
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateAccountDetails {
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub language: String,
    #[schema(value_type = String)]
    pub password: SecretString,
    #[schema(value_type = String)]
    pub password_confirmation: SecretString,
    pub country: String,
    pub email_communication_consent: bool,
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
  "password_confirmation": "hunter42",
  "country" : "Finland",
  "email_communication_consent": true
}
```
*/
#[utoipa::path(
    post,
    path = "/signup",
    tag = "auth",
    operation_id = "postAuthSignup",
    request_body = CreateAccountDetails,
    responses(
        (status = 200, description = "Signup outcome", body = SignupResponse),
        (status = 400, description = "Cannot sign up (e.g. already signed in or validation error)")
    )
)]
#[instrument(skip(session, pool, payload, app_conf))]
pub async fn signup(
    session: Session,
    payload: web::Json<CreateAccountDetails>,
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
    app_conf: web::Data<ApplicationConfiguration>,
    tmc_client: web::Data<TmcClient>,
) -> ControllerResult<HttpResponse> {
    let user_details = payload.0;
    let mut conn = pool.acquire().await?;

    if app_conf.test_mode {
        return handle_test_mode_signup(&mut conn, &session, &user_details, &app_conf).await;
    }
    if user.is_none() {
        match models::users::get_by_email(&mut conn, &user_details.email).await {
            Ok(_) => {
                let token = skip_authorize();
                return token
                    .authorized_ok(HttpResponse::Ok().json(SignupResponse::EmailAlreadyExists));
            }
            Err(error)
                if matches!(
                    error.error_type(),
                    ModelErrorType::RecordNotFound | ModelErrorType::NotFound
                ) => {}
            Err(error) => return Err(error.into()),
        }

        let upstream_id = match tmc_client
            .post_new_user_to_tmc(
                NewUserInfo {
                    first_name: user_details.first_name.clone(),
                    last_name: user_details.last_name.clone(),
                    email: user_details.email.clone(),
                    password: user_details.password.clone(),
                    password_confirmation: user_details.password_confirmation.clone(),
                    language: user_details.language.clone(),
                },
                app_conf.as_ref(),
            )
            .await
        {
            Ok(upstream_id) => upstream_id,
            Err(error) => {
                let error_message = error.message().to_string();
                if matches!(error.error_type(), &UtilErrorType::TmcErrorResponse)
                    && is_duplicate_email_error_message(&error_message)
                {
                    let token = skip_authorize();
                    return token.authorized_ok(
                        HttpResponse::Ok().json(SignupResponse::EmailAlreadyExists),
                    );
                }
                return match error.error_type() {
                    UtilErrorType::TmcErrorResponse => {
                        Err(controller_err!(BadRequest, error_message, anyhow!(error)))
                    }
                    UtilErrorType::TmcHttpError => Err(controller_err!(
                        InternalServerError,
                        error_message,
                        anyhow!(error)
                    )),
                    _ => Err(controller_err!(
                        InternalServerError,
                        error_message,
                        anyhow!(error)
                    )),
                };
            }
        };
        let password_secret = user_details.password;

        let user = models::users::insert_with_upstream_id_and_moocfi_id(
            &mut conn,
            &user_details.email,
            Some(&user_details.first_name),
            Some(&user_details.last_name),
            upstream_id,
            PKeyPolicy::Generate.into_uuid(),
        )
        .await;
        let user = match user {
            Ok(user) => user,
            Err(error)
                if matches!(
                    error.error_type(),
                    ModelErrorType::DatabaseConstraint { constraint, .. }
                        if constraint == "users_email"
                ) =>
            {
                let token = skip_authorize();
                return token
                    .authorized_ok(HttpResponse::Ok().json(SignupResponse::EmailAlreadyExists));
            }
            // TMC synchronously posts the new user back to /api/v0/tmc-server/users/create
            // while post_new_user_to_tmc is still in flight, so that callback has usually
            // already created the user; continue with the existing row.
            Err(error)
                if matches!(
                    error.error_type(),
                    ModelErrorType::DatabaseConstraint { constraint, .. }
                        if constraint == "users_upstream_id_active_uniq_idx"
                ) =>
            {
                models::users::find_by_upstream_id(&mut conn, upstream_id)
                    .await?
                    .ok_or(error)?
            }
            Err(error) => {
                return Err(controller_err!(
                    InternalServerError,
                    "Failed to insert user.".to_string(),
                    anyhow!(error)
                ));
            }
        };

        let country = user_details.country.clone();
        models::user_details::update_user_country(&mut conn, user.id, &country).await?;
        models::user_details::update_user_email_communication_consent(
            &mut conn,
            user.id,
            user_details.email_communication_consent,
        )
        .await?;

        // Hash and save password to local database
        let password_hash = models::user_passwords::hash_password(&password_secret)
            .map_err(|e| anyhow!("Failed to hash password: {:?}", e))?;

        models::user_passwords::upsert_user_password(&mut conn, user.id, &password_hash)
            .await
            .map_err(|e| {
                ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    "Failed to add password to database".to_string(),
                    anyhow!(e),
                )
            })?;

        // Notify TMC that the password is now managed by courses.mooc.fi. Best-effort and retried
        // in the background: the password is already stored locally, so a transient TMC outage
        // must not fail an otherwise-successful signup.
        crate::controllers::tmc_server::notify_password_managed_with_retry(
            &tmc_client,
            upstream_id.to_string(),
            user.id,
        )
        .await;

        // tmc.mooc.fi mails its own confirmation link but never tells us the outcome.
        domain::email_ownership_verification::queue_verification_email_best_effort(
            &mut conn,
            app_conf.enable_email_ownership_verification,
            user.id,
        )
        .await;

        let token = skip_authorize();
        authentication::remember(&session, user)?;
        token.authorized_ok(HttpResponse::Ok().json(SignupResponse::Success))
    } else {
        Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Cannot create a new account when signed in.".to_string(),
            None,
        ))
    }
}

async fn handle_test_mode_signup(
    conn: &mut PgConnection,
    session: &Session,
    user_details: &CreateAccountDetails,
    app_conf: &ApplicationConfiguration,
) -> ControllerResult<HttpResponse> {
    assert!(
        app_conf.test_mode,
        "handle_test_mode_signup called outside test mode"
    );

    warn!("Handling signup in test mode. No real account is created.");

    match models::users::get_by_email(conn, &user_details.email).await {
        Ok(_) => {
            let token = skip_authorize();
            return token
                .authorized_ok(HttpResponse::Ok().json(SignupResponse::EmailAlreadyExists));
        }
        Err(error)
            if matches!(
                error.error_type(),
                ModelErrorType::RecordNotFound | ModelErrorType::NotFound
            ) => {}
        Err(error) => return Err(error.into()),
    }

    let user_id = models::users::insert(
        conn,
        PKeyPolicy::Generate,
        &user_details.email,
        Some(&user_details.first_name),
        Some(&user_details.last_name),
    )
    .await;
    let user_id = match user_id {
        Ok(user_id) => user_id,
        Err(error) => match error.error_type() {
            ModelErrorType::DatabaseConstraint { constraint, .. }
                if constraint == "users_email" =>
            {
                let token = skip_authorize();
                return token
                    .authorized_ok(HttpResponse::Ok().json(SignupResponse::EmailAlreadyExists));
            }
            _ => {
                return Err(controller_err!(
                    InternalServerError,
                    "Failed to insert test user.".to_string(),
                    anyhow!(error)
                ));
            }
        },
    };

    models::user_details::update_user_country(conn, user_id, &user_details.country).await?;
    models::user_details::update_user_email_communication_consent(
        conn,
        user_id,
        user_details.email_communication_consent,
    )
    .await?;

    let user = models::users::get_by_email(conn, &user_details.email).await?;

    let password_hash = models::user_passwords::hash_password(&user_details.password)
        .map_err(|e| anyhow!("Failed to hash password: {:?}", e))?;

    models::user_passwords::upsert_user_password(conn, user.id, &password_hash)
        .await
        .map_err(|e| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Failed to add password to database".to_string(),
                anyhow!(e),
            )
        })?;
    domain::email_ownership_verification::queue_verification_email_best_effort(
        conn,
        app_conf.enable_email_ownership_verification,
        user.id,
    )
    .await;

    let browser_token = session_verification::remember_test_mode_browser(conn, user.id).await?;
    authentication::remember(session, user)?;

    let token = skip_authorize();
    token.authorized_ok(
        HttpResponse::Ok()
            .cookie(session_verification::browser_cookie(&browser_token))
            .json(SignupResponse::Success),
    )
}

fn is_duplicate_email_error_message(message: &str) -> bool {
    let normalized = message.to_lowercase();
    normalized.contains("email already exists")
        || normalized.contains("email is already registered")
        || normalized.contains("email already in use")
        || normalized.contains("duplicate email")
        || normalized.contains("unique constraint")
        || normalized.contains("duplicate key")
        || normalized.contains("users_email")
        || normalized.contains("email_key")
}

/**
POST `/api/v0/auth/authorize-multiple` checks whether user can perform specified action on specified resource.
Returns booleans for the authorizations in the same order as the input.
**/

#[utoipa::path(
    post,
    path = "/authorize-multiple",
    tag = "auth",
    operation_id = "postAuthAuthorizeMultiple",
    request_body = Vec<ActionOnResource>,
    responses(
        (status = 200, description = "Authorization result for each input action, in order", body = Vec<bool>)
    )
)]
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
            if is_permitted(
                &mut conn,
                action_on_resource.action,
                action_on_resource.resource,
                &user_roles,
            )
            .await
            .unwrap_or(false)
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
POST `/api/v0/auth/login` Logs in to the system.
Returns LoginResponse indicating success, email verification required, or failure.
**/
#[utoipa::path(
    post,
    path = "/login",
    tag = "auth",
    operation_id = "postAuthLogin",
    request_body = Login,
    responses(
        (status = 200, description = "Login outcome", body = LoginResponse)
    )
)]
#[instrument(skip(session, pool, client, payload, app_conf, tmc_client))]
pub async fn login(
    session: Session,
    pool: web::Data<PgPool>,
    client: web::Data<OAuthClient>,
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<Login>,
    tmc_client: web::Data<TmcClient>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let Login { email, password } = payload.into_inner();

    // Development mode UUID login (allows logging in with a user ID string)
    if app_conf.development_uuid_login {
        return handle_uuid_login(&session, &mut conn, &email).await;
    }

    // Test mode: authenticate using seeded test credentials or stored password
    if app_conf.test_mode {
        return handle_test_mode_login(&session, &mut conn, &email, &password, &app_conf).await;
    }

    let response =
        handle_production_login(&session, &mut conn, &client, &tmc_client, &email, &password)
            .await?;
    skip_authorize().authorized_ok(HttpResponse::Ok().json(response.data.into_inner()))
}

async fn handle_uuid_login(
    session: &Session,
    conn: &mut PgConnection,
    email: &str,
) -> ControllerResult<HttpResponse> {
    warn!("Trying development mode UUID login");
    let token = skip_authorize();

    if let Ok(id) = Uuid::parse_str(email) {
        let user = { models::users::get_by_id(conn, id).await? };
        let browser_token = session_verification::remember_test_mode_browser(conn, user.id).await?;
        authentication::remember(session, user)?;
        token.authorized_ok(
            HttpResponse::Ok()
                .cookie(session_verification::browser_cookie(&browser_token))
                .json(LoginResponse::Success),
        )
    } else {
        warn!("Authentication failed");
        token.authorized_ok(HttpResponse::Ok().json(LoginResponse::Failed))
    }
}

/// Verifies `password` for `user_id`, trying the seeded test-mode credentials before falling
/// back to the stored password hash.
///
/// Seeded test users (e.g. `admin@example.com`) have no `user_passwords` row, so outside test
/// mode this always falls through to `verify_user_password`.
async fn authenticate_by_password(
    conn: &mut PgConnection,
    user_id: Uuid,
    email: &str,
    password: &SecretString,
    app_conf: &ApplicationConfiguration,
) -> Result<bool, ControllerError> {
    if app_conf.test_mode {
        let is_test_user_authenticated =
            authentication::authenticate_test_user(conn, email, password, app_conf)
                .await
                .map_err(|e| {
                    ControllerError::new(
                        ControllerErrorType::Unauthorized,
                        "Could not find the test user. Have you seeded the database?".to_string(),
                        e,
                    )
                })?;
        if is_test_user_authenticated {
            return Ok(true);
        }
    }
    Ok(models::user_passwords::verify_user_password(conn, user_id, password).await?)
}

async fn handle_test_mode_login(
    session: &Session,
    conn: &mut PgConnection,
    email: &str,
    password: &SecretString,
    app_conf: &ApplicationConfiguration,
) -> ControllerResult<HttpResponse> {
    warn!("Using test credentials. Normal accounts won't work.");

    let user = match models::users::get_by_email(conn, email).await {
        Ok(u) => u,
        Err(_) => {
            warn!("Test user not found for {}", email);
            let token = skip_authorize();
            return token.authorized_ok(HttpResponse::Ok().json(LoginResponse::Failed));
        }
    };

    let is_authenticated =
        authenticate_by_password(conn, user.id, email, password, app_conf).await?;

    let token = skip_authorize();
    if is_authenticated {
        info!("Authentication successful");
        let browser_token = session_verification::remember_test_mode_browser(conn, user.id).await?;
        authentication::remember(session, user)?;
        token.authorized_ok(
            HttpResponse::Ok()
                .cookie(session_verification::browser_cookie(&browser_token))
                .json(LoginResponse::Success),
        )
    } else {
        warn!("Authentication failed");
        token.authorized_ok(HttpResponse::Ok().json(LoginResponse::Failed))
    }
}

async fn handle_production_login(
    session: &Session,
    conn: &mut PgConnection,
    client: &OAuthClient,
    tmc_client: &TmcClient,
    email: &str,
    password: &SecretString,
) -> ControllerResult<web::Json<LoginResponse>> {
    // Trim incidental whitespace (e.g. from copy-paste) so the email resolves consistently with
    // the reset-email path, which also trims. Case is handled by lower(...) in get_by_email.
    let email = email.trim();
    let mut is_authenticated = false;
    let mut authenticated_user: Option<headless_lms_models::users::User> = None;

    // Try to authenticate using password stored in courses.mooc.fi database
    if let Ok(user) = models::users::get_by_email(conn, email).await {
        let is_password_stored =
            models::user_passwords::check_if_users_password_is_stored(conn, user.id).await?;
        if is_password_stored {
            is_authenticated =
                models::user_passwords::verify_user_password(conn, user.id, password).await?;

            if is_authenticated {
                info!("Authentication successful");
                authenticated_user = Some(user);
            }
        }
    }

    // Try to authenticate via TMC and store password to courses.mooc.fi if successful
    if !is_authenticated {
        let auth_result = authentication::authenticate_tmc_mooc_fi_user(
            conn,
            client,
            email.to_string(),
            password.clone(),
            tmc_client,
        )
        .await?;

        if let Some((user, _token)) = auth_result {
            // If user is autenticated in TMC successfully, hash password and save it to courses.mooc.fi database
            let password_hash = models::user_passwords::hash_password(password)
                .map_err(|e| anyhow!("Failed to hash password: {:?}", e))?;

            models::user_passwords::upsert_user_password(conn, user.id, &password_hash)
                .await
                .map_err(|e| {
                    ControllerError::new(
                        ControllerErrorType::InternalServerError,
                        "Failed to add password to database".to_string(),
                        anyhow!(e),
                    )
                })?;

            // Notify TMC that the password is now managed by courses.mooc.fi. Best-effort and
            // retried in the background: the password is already stored locally, so a transient
            // TMC outage must not fail an otherwise-successful login.
            if let Some(upstream_id) = user.upstream_id {
                crate::controllers::tmc_server::notify_password_managed_with_retry(
                    tmc_client,
                    upstream_id.to_string(),
                    user.id,
                )
                .await;
            } else {
                warn!("User has no upstream_id; skipping notify to TMC");
            }
            info!("Authentication successful");
            authenticated_user = Some(user);
            is_authenticated = true;
        }
    }

    let token = skip_authorize();
    if is_authenticated {
        if let Some(user) = authenticated_user {
            // Test-mode and UUID logins skip the code and remember the browser instead: neither
            // development nor the system tests have mail capture.
            if session_verification::applies_to(conn, user.id).await? {
                return handle_email_verification(conn, &user).await;
            }

            authentication::remember(session, user)?;
        }
        token.authorized_ok(web::Json(LoginResponse::Success))
    } else {
        warn!("Authentication failed");
        token.authorized_ok(web::Json(LoginResponse::Failed))
    }
}

/**
POST `/api/v0/auth/logout` Logs out.
**/
#[utoipa::path(
    post,
    path = "/logout",
    tag = "auth",
    operation_id = "postAuthLogout",
    responses((status = 200, description = "Session cleared"))
)]
#[instrument(skip(session))]
#[allow(clippy::async_yields_async)]
pub async fn logout(session: Session) -> HttpResponse {
    authentication::forget(&session);
    HttpResponse::Ok().finish()
}

/**
GET `/api/v0/auth/logged-in` Returns the current user's login status.
**/
#[utoipa::path(
    get,
    path = "/logged-in",
    tag = "auth",
    operation_id = "getAuthLoggedIn",
    responses(
        (status = 200, description = "True when an authenticated session exists", body = bool)
    )
)]
#[instrument(skip(session))]
pub async fn logged_in(session: Session, pool: web::Data<PgPool>) -> web::Json<bool> {
    let logged_in = authentication::has_auth_user_session(&session, pool).await;
    web::Json(logged_in)
}

/// Generic information about the logged in user.
///
///  Could include the user name etc in the future.
#[derive(Debug, Serialize, Deserialize, ToSchema)]

pub struct UserInfo {
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

/**
GET `/api/v0/auth/user-info` Returns the current user's info.
**/

#[utoipa::path(
    get,
    path = "/user-info",
    tag = "auth",
    operation_id = "getAuthUserInfo",
    responses(
        (status = 200, description = "Profile when signed in; null when anonymous", body = Option<UserInfo>)
    )
)]
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

#[derive(Debug, Deserialize, ToSchema)]
pub struct SendEmailCodeData {
    #[schema(value_type = String)]
    pub password: SecretString,
    pub language: String,
}

/// Outcome of asking for an account deletion code.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SendDeleteUserEmailCodeResult {
    Queued,
    /// A code was mailed less than [`MIN_RESEND_INTERVAL_MINUTES`] ago and is still usable.
    RecentlySent {
        retry_after_seconds: i64,
    },
    IncorrectPassword,
}

/**
POST `/api/v0/auth/send-email-code` If users password is correct, sends a code to users email for account deletion
**/
#[utoipa::path(
    post,
    path = "/send-email-code",
    tag = "auth",
    operation_id = "postAuthSendEmailCode",
    request_body = SendEmailCodeData,
    responses(
        (status = 200, description = "What the request did", body = SendDeleteUserEmailCodeResult)
    )
)]
#[instrument(skip(pool, payload, auth_user, app_conf))]
pub async fn send_delete_user_email_code(
    auth_user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<SendEmailCodeData>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<SendDeleteUserEmailCodeResult>> {
    let token = skip_authorize();
    let mut conn = pool.acquire().await?;

    // The signed-in user's own address, never `payload.email`: the test-mode branch of
    // `authenticate_by_password` matches on the address, so a client-supplied one would let
    // any seeded account's credentials pass this check.
    let user_details =
        models::user_details::get_user_details_by_user_id(&mut conn, auth_user.id).await?;
    let password_ok = authenticate_by_password(
        &mut conn,
        auth_user.id,
        &user_details.email,
        &payload.password,
        &app_conf,
    )
    .await?;

    if !password_ok {
        info!(
            "User {} attempted account deletion with incorrect password",
            auth_user.id
        );
        return token.authorized_ok(web::Json(SendDeleteUserEmailCodeResult::IncorrectPassword));
    }

    let live_code = user_email_codes::get_unused_user_email_code_with_user_id(
        &mut conn,
        auth_user.id,
        UserEmailCodePurpose::AccountDeletion,
    )
    .await?;
    if let Some(live_code) = live_code {
        let retry_after_seconds =
            (live_code.created_at + Duration::minutes(MIN_RESEND_INTERVAL_MINUTES) - Utc::now())
                .num_seconds();
        if retry_after_seconds > 0 {
            return token.authorized_ok(web::Json(SendDeleteUserEmailCodeResult::RecentlySent {
                retry_after_seconds,
            }));
        }
    }

    let language = &payload.language;
    let delete_template = models::email_templates::get_generic_email_template_by_type_and_language(
        &mut conn,
        EmailTemplateType::DeleteUserEmail,
        language,
    )
    .await
    .map_err(|_e| {
        anyhow::anyhow!(
            "Account deletion email template not configured. Missing template 'delete-user-email' for language '{}'",
            language
        )
    })?;

    // A fresh code every time: mailing the outstanding one again would keep a single code alive for
    // as long as the user kept pressing resend.
    let code = user_email_codes::generate_code();

    let mut tx = conn.begin().await?;
    user_email_codes::insert_user_email_code(
        &mut tx,
        auth_user.id,
        UserEmailCodePurpose::AccountDeletion,
        &code,
    )
    .await?;
    models::email_deliveries::insert_email_delivery(&mut tx, auth_user.id, delete_template.id)
        .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(SendDeleteUserEmailCodeResult::Queued))
}

#[derive(Debug, Deserialize, ToSchema)]

pub struct EmailCode {
    #[schema(value_type = String)]
    pub code: DbSecret,
}

/// Outcome of spending an account deletion code.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DeleteUserAccountResult {
    Deleted,
    /// Wrong, superseded and spent are one value: they are indistinguishable to someone typing
    /// digits, and telling them apart only helps a guesser.
    InvalidCode,
    /// The outstanding code timed out. Read off that code's own expiry, so it reveals nothing about
    /// what was typed.
    ExpiredCode,
    /// The code was retired after too many wrong guesses; only a new code can get past this.
    TooManyAttempts,
    /// tmc.mooc.fi could not be reached. Nothing was deleted and retrying is safe.
    UpstreamUnavailable,
    /// tmc.mooc.fi refused the deletion. `reference` identifies the recorded error, and is the only
    /// thing the user can hand to support.
    UpstreamRejected {
        reference: Uuid,
    },
}

/// How a failed TMC delete should be treated. The upstream status is what separates a retry that
/// may work from one that never will.
enum TmcDeletionFailure {
    /// TMC has no such account, so the local deletion is still the right thing to do.
    AlreadyGone,
    Transient,
    Rejected,
}

fn classify_tmc_deletion_failure(error: &UtilError) -> TmcDeletionFailure {
    match error.error_type() {
        // The request never completed, so TMC provably did not act on it.
        UtilErrorType::TmcHttpError => TmcDeletionFailure::Transient,
        // The deletion contract reports an unknown user in the body, but deployments predating it
        // answer a bare 404.
        UtilErrorType::TmcHttpStatusError(404) => TmcDeletionFailure::AlreadyGone,
        UtilErrorType::TmcHttpStatusError(429) => TmcDeletionFailure::Transient,
        UtilErrorType::TmcHttpStatusError(status) if *status >= 500 => {
            TmcDeletionFailure::Transient
        }
        _ => TmcDeletionFailure::Rejected,
    }
}

/// Records a TMC refusal under `reference` in `error_variants`/`error_occurrences`, so support can
/// find it from the reference alone.
///
/// Best effort: the deletion has already failed, and failing to record that must not turn a
/// reported outcome into a 500.
async fn report_tmc_deletion_rejection(
    conn: &mut PgConnection,
    user_id: Uuid,
    reference: Uuid,
    error: &UtilError,
) {
    let report = models::errors::NewErrorReport {
        service: "headless-lms".to_string(),
        error_source: Some(models::errors::ErrorSource::Backend),
        message: format!(
            "TMC refused to delete the account of user {user_id} (reference {reference}): {error}"
        ),
        stack_trace: Some(format!("{error:?}")),
        path: None,
        app_version: None,
        details: Some(serde_json::json!({
            "kind": "tmc_account_deletion_rejected",
            "reference": reference,
            "user_id": user_id,
        })),
    };
    if let Err(e) = models::errors::insert(conn, Some(user_id), &report).await {
        warn!("Could not record TMC account deletion rejection {reference}: {e}");
    }
}

/**
POST `/api/v0/auth/delete-user-account` If users single-use code is correct then delete users account
**/
#[utoipa::path(
    post,
    path = "/delete-user-account",
    tag = "auth",
    operation_id = "postAuthDeleteUserAccount",
    request_body = EmailCode,
    responses(
        (status = 200, description = "Outcome of submitting the code", body = DeleteUserAccountResult)
    )
)]
#[instrument(skip(pool, payload, auth_user, session, cache, app_conf))]
pub async fn delete_user_account(
    auth_user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<EmailCode>,
    session: Session,
    tmc_client: web::Data<TmcClient>,
    app_conf: web::Data<ApplicationConfiguration>,
    cache: web::Data<Cache>,
) -> ControllerResult<web::Json<DeleteUserAccountResult>> {
    let token = skip_authorize();
    let mut conn = pool.acquire().await?;

    let code_ok = user_email_codes::is_reset_user_email_code_valid(
        &mut conn,
        auth_user.id,
        UserEmailCodePurpose::AccountDeletion,
        &payload.code,
    )
    .await?;

    if !code_ok {
        let outstanding = user_email_codes::get_outstanding_user_email_code(
            &mut conn,
            auth_user.id,
            UserEmailCodePurpose::AccountDeletion,
        )
        .await?;
        // Before counting the guess: attempts against a code that can no longer be spent would
        // only strand the user on "too many attempts" for a code they have to replace anyway.
        if outstanding.is_some_and(|code| code.expires_at <= Utc::now()) {
            info!(
                "User {} attempted account deletion with an expired code",
                auth_user.id
            );
            return token.authorized_ok(web::Json(DeleteUserAccountResult::ExpiredCode));
        }

        info!(
            "User {} attempted account deletion with incorrect code",
            auth_user.id
        );
        let code_retired = user_email_codes::record_failed_attempt(
            &mut conn,
            auth_user.id,
            UserEmailCodePurpose::AccountDeletion,
            MAX_CODE_ATTEMPTS,
        )
        .await?;
        return token.authorized_ok(web::Json(if code_retired {
            DeleteUserAccountResult::TooManyAttempts
        } else {
            DeleteUserAccountResult::InvalidCode
        }));
    }

    let user = users::get_by_id(&mut conn, auth_user.id).await?;

    // Outside the transaction below: this can wait minutes on tmc.mooc.fi, and a transaction held
    // open that long pins a pool connection with it.
    if let Some(upstream_id) = user.upstream_id
        && !app_conf.test_mode
    {
        match tmc_client
            .delete_user_from_tmc(upstream_id.to_string())
            .await
        {
            Ok(TmcAccountDeletion::Deleted) => {}
            Ok(TmcAccountDeletion::AlreadyDeleted) => {
                info!(
                    "TMC reported account {upstream_id} of user {} as already deleted; deleting locally anyway",
                    auth_user.id
                );
            }
            Err(error) => match classify_tmc_deletion_failure(&error) {
                TmcDeletionFailure::AlreadyGone => {
                    info!(
                        "TMC has no account {upstream_id} for user {}; deleting locally anyway: {error}",
                        auth_user.id
                    );
                }
                TmcDeletionFailure::Transient => {
                    warn!(
                        "TMC was unavailable while deleting the account of user {}: {error}",
                        auth_user.id
                    );
                    return token
                        .authorized_ok(web::Json(DeleteUserAccountResult::UpstreamUnavailable));
                }
                TmcDeletionFailure::Rejected => {
                    let reference = Uuid::new_v4();
                    error!(
                        "TMC refused to delete the account of user {} (reference {reference}): {error}",
                        auth_user.id
                    );
                    report_tmc_deletion_rejection(&mut conn, auth_user.id, reference, &error).await;
                    return token.authorized_ok(web::Json(
                        DeleteUserAccountResult::UpstreamRejected { reference },
                    ));
                }
            },
        }
    }

    let mut tx = conn.begin().await?;
    delete_user_and_invalidate_cached_tokens(
        &mut tx,
        &cache,
        &app_conf.oauth_server_configuration.oauth_token_hmac_key,
        auth_user.id,
    )
    .await?;
    user_email_codes::mark_user_email_code_used(
        &mut tx,
        auth_user.id,
        UserEmailCodePurpose::AccountDeletion,
        &payload.code,
    )
    .await?;
    tx.commit().await?;

    authentication::forget(&session);
    token.authorized_ok(web::Json(DeleteUserAccountResult::Deleted))
}

pub async fn update_user_information_to_tmc(
    first_name: String,
    last_name: String,
    email: Option<String>,
    user_upstream_id: String,
    tmc_client: web::Data<TmcClient>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> Result<(), Error> {
    if app_conf.test_mode {
        return Ok(());
    }
    tmc_client
        .update_user_information(first_name, last_name, email, user_upstream_id)
        .await
        .map_err(|e| {
            log::warn!("TMC user update failed: {:?}", e);
            anyhow::anyhow!("TMC user update failed: {}", e)
        })?;
    Ok(())
}

async fn handle_email_verification(
    conn: &mut PgConnection,
    user: &headless_lms_models::users::User,
) -> ControllerResult<web::Json<LoginResponse>> {
    let code = user_email_codes::generate_code();

    let email_verification_token =
        email_verification_tokens::create_email_verification_token(conn, user.id, code.clone())
            .await
            .map_err(|e| {
                ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    "Failed to create email verification token".to_string(),
                    Some(anyhow!(e)),
                )
            })?;

    user_email_codes::insert_user_email_code(
        conn,
        user.id,
        UserEmailCodePurpose::StaffLogin,
        &code,
    )
    .await
    .map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            "Failed to insert user email code".to_string(),
            Some(anyhow!(e)),
        )
    })?;

    let email_template = models::email_templates::get_generic_email_template_by_type_and_language(
        conn,
        EmailTemplateType::ConfirmEmailCode,
        "en",
    )
    .await
    .map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            format!("Failed to get email template: {}", e.message()),
            Some(anyhow!(e)),
        )
    })?;

    models::email_deliveries::insert_email_delivery(conn, user.id, email_template.id)
        .await
        .map_err(|e| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Failed to insert email delivery".to_string(),
                Some(anyhow!(e)),
            )
        })?;

    email_verification_tokens::mark_code_sent(conn, &email_verification_token)
        .await
        .map_err(|e| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Failed to mark code as sent".to_string(),
                Some(anyhow!(e)),
            )
        })?;

    let token = skip_authorize();
    token.authorized_ok(web::Json(LoginResponse::RequiresEmailVerification {
        // Re-wrap for the wire boundary: redacted in Debug/logs, serialized once in the response.
        email_verification_token: OutboundSecret::new(
            email_verification_token.expose_secret().to_string(),
        ),
    }))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct VerifyEmailRequest {
    #[schema(value_type = String)]
    pub email_verification_token: DbSecret,
    #[schema(value_type = String)]
    pub code: DbSecret,
}

/**
POST `/api/v0/auth/verify-email` Verifies email verification code and completes login.
**/
#[utoipa::path(
    post,
    path = "/verify-email",
    tag = "auth",
    operation_id = "postAuthVerifyEmail",
    request_body = VerifyEmailRequest,
    responses(
        (status = 200, description = "Whether verification succeeded", body = bool)
    )
)]
#[instrument(skip(req, session, pool, ip_to_country_mapper, payload))]
pub async fn verify_email(
    req: HttpRequest,
    session: Session,
    pool: web::Data<PgPool>,
    ip_to_country_mapper: web::Data<IpToCountryMapper>,
    payload: web::Json<VerifyEmailRequest>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let payload = payload.into_inner();

    let token = email_verification_tokens::get_by_email_verification_token(
        &mut conn,
        &payload.email_verification_token,
    )
    .await
    .map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            "Failed to get email verification token".to_string(),
            Some(anyhow!(e)),
        )
    })?;

    let Some(token_value) = token else {
        let skip_token = skip_authorize();
        return skip_token.authorized_ok(HttpResponse::Ok().json(false));
    };

    let is_valid = email_verification_tokens::verify_code(
        &mut conn,
        &payload.email_verification_token,
        &payload.code,
    )
    .await
    .map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            "Failed to verify code".to_string(),
            Some(anyhow!(e)),
        )
    })?;

    if !is_valid {
        let skip_token = skip_authorize();
        return skip_token.authorized_ok(HttpResponse::Ok().json(false));
    }

    let user_id = token_value.user_id;

    user_email_codes::mark_user_email_code_used(
        &mut conn,
        user_id,
        UserEmailCodePurpose::StaffLogin,
        &payload.code,
    )
    .await
    .map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            "Failed to mark user email code as used".to_string(),
            Some(anyhow!(e)),
        )
    })?;

    email_verification_tokens::mark_as_used(&mut conn, &payload.email_verification_token)
        .await
        .map_err(|e| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Failed to mark token as used".to_string(),
                Some(anyhow!(e)),
            )
        })?;

    let user = models::users::get_by_id(&mut conn, user_id)
        .await
        .map_err(|e| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Failed to get user".to_string(),
                Some(anyhow!(e)),
            )
        })?;

    let cookie =
        session_verification::record_verification(&mut conn, &ip_to_country_mapper, user.id, &req)
            .await?;
    authentication::remember(&session, user)?;

    let skip_token = skip_authorize();
    skip_token.authorized_ok(HttpResponse::Ok().cookie(cookie).json(true))
}

/// How the user can confirm the session.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SessionChallengeMethod {
    EmailCode,
}

/// Why the session needs confirming.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SessionChallengeReason {
    UnrecognizedNetwork,
}

/// One way for the user to prove the session is theirs, and why it is asked for.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SessionChallenge {
    pub method: SessionChallengeMethod,
    pub reasons: Vec<SessionChallengeReason>,
}

/// Whether the current session must be confirmed before the UI lets the user on.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SessionStatus {
    pub verification_required: bool,
    pub challenges: Vec<SessionChallenge>,
}

/**
GET `/api/v0/auth/session-status` Whether the signed-in user must confirm this session with an
emailed code: a user with a role on a browser or network they have not confirmed. Only the UI
enforces it.
*/
#[utoipa::path(
    get,
    path = "/session-status",
    tag = "auth",
    operation_id = "getAuthSessionStatus",
    responses(
        (status = 200, description = "Whether the session needs confirming", body = SessionStatus)
    )
)]
#[instrument(skip(req, pool, ip_to_country_mapper, app_conf))]
pub async fn session_status(
    req: HttpRequest,
    user: Option<AuthUser>,
    pool: web::Data<PgPool>,
    ip_to_country_mapper: web::Data<IpToCountryMapper>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    let token = skip_authorize();
    let mut conn = pool.acquire().await?;
    session_verification::delete_expired_occasionally(&mut conn).await?;

    let check = match user {
        Some(user) => {
            check_session(&mut conn, &ip_to_country_mapper, &app_conf, user.id, &req).await?
        }
        None => SessionCheck::NotRequired {
            renewed_cookie: None,
        },
    };
    let (mut response, verification_required) = match check {
        SessionCheck::NotRequired { renewed_cookie } => (
            session_verification::ok_with_renewed_cookie(renewed_cookie),
            false,
        ),
        SessionCheck::Required => (HttpResponse::Ok(), true),
    };
    response.insert_header(CacheControl(vec![CacheDirective::NoStore]));
    let challenges = if verification_required {
        vec![SessionChallenge {
            method: SessionChallengeMethod::EmailCode,
            reasons: vec![SessionChallengeReason::UnrecognizedNetwork],
        }]
    } else {
        Vec::new()
    };
    token.authorized_ok(response.json(SessionStatus {
        verification_required,
        challenges,
    }))
}

/// Whether [`session_status`] asks the user to confirm the session.
enum SessionCheck {
    /// The response must set `renewed_cookie` when there is one.
    NotRequired {
        renewed_cookie: Option<Cookie<'static>>,
    },
    Required,
}

async fn check_session(
    conn: &mut PgConnection,
    ip_to_country_mapper: &IpToCountryMapper,
    app_conf: &ApplicationConfiguration,
    user_id: Uuid,
    req: &HttpRequest,
) -> Result<SessionCheck, ControllerError> {
    if !session_verification::applies_to(conn, user_id).await? {
        return Ok(SessionCheck::NotRequired {
            renewed_cookie: None,
        });
    }
    Ok(
        match session_verification::recognize(conn, ip_to_country_mapper, app_conf, user_id, req)
            .await?
        {
            Some(recognition) => SessionCheck::NotRequired {
                renewed_cookie: recognition.renewed_cookie,
            },
            None => SessionCheck::Required,
        },
    )
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SessionEmailCodeRequest {
    /// The user asked for another mail. Without it, a code that is still usable is not replaced.
    pub resend: bool,
}

/// What asking for a session confirmation code did. `masked_email` is where the code goes.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SessionEmailCodeResult {
    Sent {
        masked_email: String,
    },
    /// A usable code was mailed earlier; nothing was sent.
    AlreadySent {
        masked_email: String,
    },
    /// Refused resend: the outstanding code is younger than the resend interval.
    RecentlySent {
        masked_email: String,
        retry_after_seconds: i64,
    },
    DailyLimitReached {
        masked_email: String,
    },
    NotRequired,
}

/**
POST `/api/v0/auth/session-status/email-code` Mails the signed-in user a code for confirming the
session, when [`session_status`] asks for one and no usable code is out already.
*/
#[utoipa::path(
    post,
    path = "/session-status/email-code",
    tag = "auth",
    operation_id = "postAuthSessionStatusEmailCode",
    request_body = SessionEmailCodeRequest,
    responses(
        (status = 200, description = "What the request did", body = SessionEmailCodeResult)
    )
)]
#[instrument(skip(req, pool, ip_to_country_mapper, app_conf, payload))]
pub async fn send_session_email_code(
    req: HttpRequest,
    user: AuthUser,
    pool: web::Data<PgPool>,
    ip_to_country_mapper: web::Data<IpToCountryMapper>,
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<SessionEmailCodeRequest>,
) -> ControllerResult<HttpResponse> {
    let token = skip_authorize();
    let mut conn = pool.acquire().await?;
    if let SessionCheck::NotRequired { renewed_cookie } =
        check_session(&mut conn, &ip_to_country_mapper, &app_conf, user.id, &req).await?
    {
        return token.authorized_ok(
            session_verification::ok_with_renewed_cookie(renewed_cookie)
                .json(SessionEmailCodeResult::NotRequired),
        );
    }

    let email = models::user_details::get_user_details_by_user_id(&mut conn, user.id)
        .await?
        .email;
    let masked_email = session_verification::mask_email(&email);
    let outcome = session_verification::send_email_code(&mut conn, user.id, payload.resend).await?;
    token.authorized_ok(HttpResponse::Ok().json(match outcome {
        EmailCodeOutcome::Sent => SessionEmailCodeResult::Sent { masked_email },
        EmailCodeOutcome::AlreadySent => SessionEmailCodeResult::AlreadySent { masked_email },
        EmailCodeOutcome::RecentlySent {
            retry_after_seconds,
        } => SessionEmailCodeResult::RecentlySent {
            masked_email,
            retry_after_seconds,
        },
        EmailCodeOutcome::DailyLimitReached => {
            SessionEmailCodeResult::DailyLimitReached { masked_email }
        }
    }))
}

/// The emailed code the user typed to confirm the session.
#[derive(Debug, Deserialize, ToSchema)]
pub struct SessionVerifyRequest {
    #[schema(value_type = String)]
    pub code: DbSecret,
}

/// Outcome of submitting a session confirmation code.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SessionVerifyResult {
    Verified,
    /// Wrong, superseded and spent are one value: telling them apart only helps a guesser.
    InvalidCode,
    ExpiredCode,
    /// The code was retired after too many wrong guesses; only a new code can get past this.
    TooManyAttempts,
    NotRequired,
}

/**
POST `/api/v0/auth/session-status/verify` Confirms the session with the emailed code, remembering
this browser and network for the signed-in user.
*/
#[utoipa::path(
    post,
    path = "/session-status/verify",
    tag = "auth",
    operation_id = "postAuthSessionStatusVerify",
    request_body = SessionVerifyRequest,
    responses(
        (status = 200, description = "Outcome of submitting the code", body = SessionVerifyResult)
    )
)]
#[instrument(skip(req, pool, ip_to_country_mapper, app_conf, payload))]
pub async fn verify_session(
    req: HttpRequest,
    user: AuthUser,
    pool: web::Data<PgPool>,
    ip_to_country_mapper: web::Data<IpToCountryMapper>,
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<SessionVerifyRequest>,
) -> ControllerResult<HttpResponse> {
    let token = skip_authorize();
    let mut conn = pool.acquire().await?;
    if let SessionCheck::NotRequired { renewed_cookie } =
        check_session(&mut conn, &ip_to_country_mapper, &app_conf, user.id, &req).await?
    {
        return token.authorized_ok(
            session_verification::ok_with_renewed_cookie(renewed_cookie)
                .json(SessionVerifyResult::NotRequired),
        );
    }

    let mut tx = conn.begin().await?;
    let check = session_verification::check_email_code(&mut tx, user.id, &payload.code).await?;
    let mut response = HttpResponse::Ok();
    let result = match check {
        CodeCheck::Valid => {
            let cookie = session_verification::record_verification(
                &mut tx,
                &ip_to_country_mapper,
                user.id,
                &req,
            )
            .await?;
            response.cookie(cookie);
            SessionVerifyResult::Verified
        }
        CodeCheck::Invalid => SessionVerifyResult::InvalidCode,
        CodeCheck::Expired => SessionVerifyResult::ExpiredCode,
        CodeCheck::TooManyAttempts => SessionVerifyResult::TooManyAttempts,
    };
    tx.commit().await?;
    token.authorized_ok(response.json(result))
}

#[derive(OpenApi)]
#[openapi(
    paths(
        signup,
        login,
        logout,
        logged_in,
        authorize_action_on_resource,
        authorize_multiple_actions_on_resources,
        user_info,
        send_delete_user_email_code,
        delete_user_account,
        verify_email,
        session_status,
        send_session_email_code,
        verify_session,
    ),
    components(schemas(
        Login,
        LoginResponse,
        CreateAccountDetails,
        SignupResponse,
        UserInfo,
        headless_lms_authorization::ActionOnResource,
        headless_lms_authorization::Action,
        headless_lms_authorization::Resource,
        SendEmailCodeData,
        SendDeleteUserEmailCodeResult,
        EmailCode,
        DeleteUserAccountResult,
        VerifyEmailRequest,
        SessionStatus,
        SessionChallenge,
        SessionChallengeMethod,
        SessionChallengeReason,
        SessionEmailCodeRequest,
        SessionEmailCodeResult,
        SessionVerifyRequest,
        SessionVerifyResult,
        headless_lms_models::roles::UserRole,
    ))
)]
pub struct AuthRoutesApiDoc;

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(
        web::resource("/signup")
            .wrap(RateLimit::new(RateLimitConfig {
                per_minute: Some(15),
                per_hour: None,
                per_day: Some(1000),
                per_month: None,
                ..Default::default()
            }))
            .to(signup),
    )
    .service(
        web::resource("/login")
            .wrap(RateLimit::new(RateLimitConfig {
                per_minute: Some(20),
                per_hour: Some(100),
                per_day: Some(500),
                per_month: None,
                ..Default::default()
            }))
            .to(login),
    )
    .route("/logout", web::post().to(logout))
    .route("/logged-in", web::get().to(logged_in))
    .route("/authorize", web::post().to(authorize_action_on_resource))
    .route(
        "/authorize-multiple",
        web::post().to(authorize_multiple_actions_on_resources),
    )
    .route("/user-info", web::get().to(user_info))
    .service(
        web::resource("/delete-user-account")
            .wrap(RateLimit::new(RateLimitConfig {
                per_minute: None,
                per_hour: Some(5),
                per_day: Some(10),
                per_month: None,
                ..Default::default()
            }))
            .to(delete_user_account),
    )
    .service(
        web::resource("/send-email-code")
            .wrap(RateLimit::new(RateLimitConfig {
                per_minute: None,
                per_hour: Some(5),
                per_day: Some(20),
                per_month: None,
                ..Default::default()
            }))
            .to(send_delete_user_email_code),
    )
    .service(
        web::resource("/verify-email")
            .wrap(RateLimit::new(RateLimitConfig {
                per_minute: Some(10),
                per_hour: Some(50),
                per_day: None,
                per_month: None,
                ..Default::default()
            }))
            .to(verify_email),
    )
    .route("/session-status", web::get().to(session_status))
    .service(
        web::resource("/session-status/email-code")
            .wrap(
                RateLimit::new(RateLimitConfig {
                    per_minute: Some(5),
                    per_hour: Some(20),
                    per_day: Some(50),
                    per_month: None,
                    ..Default::default()
                })
                .keyed_by(RateLimitKey::User),
            )
            .to(send_session_email_code),
    )
    .service(
        web::resource("/session-status/verify")
            .wrap(
                RateLimit::new(RateLimitConfig {
                    per_minute: Some(10),
                    per_hour: Some(50),
                    per_day: None,
                    per_month: None,
                    ..Default::default()
                })
                .keyed_by(RateLimitKey::User),
            )
            .to(verify_session),
    );
}
