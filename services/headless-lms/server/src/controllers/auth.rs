/*!
Handlers for HTTP requests to `/api/v0/auth`.
*/

use crate::{
    OAuthClient,
    domain::{
        authorization::{
            self, ActionOnResource, authorize_with_fetched_list_of_roles, skip_authorize,
        },
        rate_limit_middleware_builder::{RateLimit, RateLimitConfig},
    },
    prelude::*,
};
use actix_session::Session;
use anyhow::Error;
use anyhow::anyhow;
use headless_lms_models::ModelResult;
use headless_lms_models::{
    email_templates::EmailTemplateType, email_verification_tokens, user_email_codes,
    user_passwords, users,
};
use headless_lms_utils::{
    prelude::UtilErrorType,
    tmc::{NewUserInfo, TmcClient},
};
use rand::Rng;
use secrecy::SecretString;
use tracing_log::log;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Login {
    email: String,
    password: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum LoginResponse {
    Success,
    RequiresEmailVerification { email_verification_token: String },
    Failed,
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

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CreateAccountDetails {
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub language: String,
    pub password: String,
    pub password_confirmation: String,
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
        let upstream_id = tmc_client
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
            .map_err(|e| {
                let error_message = e.message().to_string();
                let error_type = match e.error_type() {
                    UtilErrorType::TmcHttpError => ControllerErrorType::InternalServerError,
                    UtilErrorType::TmcErrorResponse => ControllerErrorType::BadRequest,
                    _ => ControllerErrorType::InternalServerError,
                };
                ControllerError::new(error_type, error_message, Some(anyhow!(e)))
            })?;
        let password_secret = SecretString::new(user_details.password.into());

        let user = models::users::insert_with_upstream_id_and_moocfi_id(
            &mut conn,
            &user_details.email,
            Some(&user_details.first_name),
            Some(&user_details.last_name),
            upstream_id,
            PKeyPolicy::Generate.into_uuid(),
        )
        .await
        .map_err(|e| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Failed to insert user.".to_string(),
                Some(anyhow!(e)),
            )
        })?;

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

        // Notify tmc that the password is managed by courses.mooc.fi
        tmc_client
            .set_user_password_managed_by_courses_mooc_fi(upstream_id.to_string(), user.id)
            .await
            .map_err(|e| {
                ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    "Failed to notify TMC that user's password is saved in courses.mooc.fi"
                        .to_string(),
                    anyhow!(e),
                )
            })?;

        let token = skip_authorize();
        authorization::remember(&session, user)?;
        token.authorized_ok(HttpResponse::Ok().finish())
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

    let user_id = models::users::insert(
        conn,
        PKeyPolicy::Generate,
        &user_details.email,
        Some(&user_details.first_name),
        Some(&user_details.last_name),
    )
    .await
    .map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            "Failed to insert test user.".to_string(),
            Some(anyhow!(e)),
        )
    })?;

    models::user_details::update_user_country(conn, user_id, &user_details.country).await?;
    models::user_details::update_user_email_communication_consent(
        conn,
        user_id,
        user_details.email_communication_consent,
    )
    .await?;

    let user = models::users::get_by_email(conn, &user_details.email).await?;

    let password_hash = models::user_passwords::hash_password(&SecretString::new(
        user_details.password.clone().into(),
    ))
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
    authorization::remember(session, user)?;

    let token = skip_authorize();
    token.authorized_ok(HttpResponse::Ok().finish())
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
        let user_roles = models::roles::get_effective_roles(&mut conn, user.id).await?;

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
Returns LoginResponse indicating success, email verification required, or failure.
**/
#[instrument(skip(session, pool, client, payload, app_conf, tmc_client))]
pub async fn login(
    session: Session,
    pool: web::Data<PgPool>,
    client: web::Data<OAuthClient>,
    app_conf: web::Data<ApplicationConfiguration>,
    payload: web::Json<Login>,
    tmc_client: web::Data<TmcClient>,
) -> ControllerResult<web::Json<LoginResponse>> {
    let mut conn = pool.acquire().await?;
    let Login { email, password } = payload.into_inner();

    // Development mode UUID login (allows logging in with a user ID string)
    if app_conf.development_uuid_login {
        return handle_uuid_login(&session, &mut conn, &email, &app_conf).await;
    }

    // Test mode: authenticate using seeded test credentials or stored password
    if app_conf.test_mode {
        return handle_test_mode_login(&session, &mut conn, &email, &password, &app_conf).await;
    };

    return handle_production_login(
        &session,
        &mut conn,
        &client,
        &tmc_client,
        &email,
        &password,
        &app_conf,
    )
    .await;
}

async fn handle_uuid_login(
    session: &Session,
    conn: &mut PgConnection,
    email: &str,
    app_conf: &ApplicationConfiguration,
) -> ControllerResult<web::Json<LoginResponse>> {
    warn!("Trying development mode UUID login");
    let token = skip_authorize();

    if let Ok(id) = Uuid::parse_str(email) {
        let user = { models::users::get_by_id(conn, id).await? };
        let is_admin = is_user_global_admin(conn, user.id).await?;

        if app_conf.enable_admin_email_verification && is_admin {
            return handle_email_verification(conn, &user).await;
        }

        authorization::remember(session, user)?;
        token.authorized_ok(web::Json(LoginResponse::Success))
    } else {
        warn!("Authentication failed");
        token.authorized_ok(web::Json(LoginResponse::Failed))
    }
}

async fn handle_test_mode_login(
    session: &Session,
    conn: &mut PgConnection,
    email: &str,
    password: &str,
    app_conf: &ApplicationConfiguration,
) -> ControllerResult<web::Json<LoginResponse>> {
    warn!("Using test credentials. Normal accounts won't work.");

    let user = match models::users::get_by_email(conn, email).await {
        Ok(u) => u,
        Err(_) => {
            warn!("Test user not found for {}", email);
            let token = skip_authorize();
            return token.authorized_ok(web::Json(LoginResponse::Failed));
        }
    };

    let mut is_authenticated =
        authorization::authenticate_test_user(conn, email, password, app_conf)
            .await
            .map_err(|e| {
                ControllerError::new(
                    ControllerErrorType::Unauthorized,
                    "Could not find the test user. Have you seeded the database?".to_string(),
                    e,
                )
            })?;

    if !is_authenticated {
        is_authenticated = models::user_passwords::verify_user_password(
            conn,
            user.id,
            &SecretString::new(password.into()),
        )
        .await?;
    }

    if is_authenticated {
        info!("Authentication successful");
        let is_admin = is_user_global_admin(conn, user.id).await?;

        if app_conf.enable_admin_email_verification && is_admin {
            return handle_email_verification(conn, &user).await;
        }

        authorization::remember(session, user)?;
    } else {
        warn!("Authentication failed");
    }

    let token = skip_authorize();
    if is_authenticated {
        token.authorized_ok(web::Json(LoginResponse::Success))
    } else {
        token.authorized_ok(web::Json(LoginResponse::Failed))
    }
}

async fn handle_production_login(
    session: &Session,
    conn: &mut PgConnection,
    client: &OAuthClient,
    tmc_client: &TmcClient,
    email: &str,
    password: &str,
    app_conf: &ApplicationConfiguration,
) -> ControllerResult<web::Json<LoginResponse>> {
    let mut is_authenticated = false;
    let mut authenticated_user: Option<headless_lms_models::users::User> = None;

    // Try to authenticate using password stored in courses.mooc.fi database
    if let Ok(user) = models::users::get_by_email(conn, email).await {
        let is_password_stored =
            models::user_passwords::check_if_users_password_is_stored(conn, user.id).await?;
        if is_password_stored {
            is_authenticated = models::user_passwords::verify_user_password(
                conn,
                user.id,
                &SecretString::new(password.into()),
            )
            .await?;

            if is_authenticated {
                info!("Authentication successful");
                authenticated_user = Some(user);
            }
        }
    }

    // Try to authenticate via TMC and store password to courses.mooc.fi if successful
    if !is_authenticated {
        let auth_result = authorization::authenticate_moocfi_user(
            conn,
            client,
            email.to_string(),
            password.to_string(),
            tmc_client,
        )
        .await?;

        if let Some((user, _token)) = auth_result {
            // If user is autenticated in TMC successfully, hash password and save it to courses.mooc.fi database
            let password_hash =
                models::user_passwords::hash_password(&SecretString::new(password.into()))
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

            // Notify TMC that the password is now managed by courses.mooc.fi
            if let Some(upstream_id) = user.upstream_id {
                tmc_client
                    .set_user_password_managed_by_courses_mooc_fi(upstream_id.to_string(), user.id)
                    .await
                    .map_err(|e| {
                        ControllerError::new(
                            ControllerErrorType::InternalServerError,
                            "Failed to notify TMC that users password is saved in courses.mooc.fi"
                                .to_string(),
                            anyhow!(e),
                        )
                    })?;
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
            let is_admin = is_user_global_admin(conn, user.id).await?;

            if app_conf.enable_admin_email_verification && is_admin {
                return handle_email_verification(conn, &user).await;
            }

            authorization::remember(session, user)?;
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

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct SendEmailCodeData {
    pub email: String,
    pub password: String,
    pub language: String,
}

/**
POST `/api/v0/auth/send-email-code` If users password is correct, sends a code to users email for account deletion
**/
#[instrument(skip(pool, payload, auth_user))]
#[allow(clippy::async_yields_async)]
pub async fn send_delete_user_email_code(
    auth_user: Option<AuthUser>,
    pool: web::Data<PgPool>,
    payload: web::Json<SendEmailCodeData>,
) -> ControllerResult<web::Json<bool>> {
    let token = skip_authorize();

    // Check user credentials
    if let Some(auth_user) = auth_user {
        let mut conn = pool.acquire().await?;

        let password_ok = user_passwords::verify_user_password(
            &mut conn,
            auth_user.id,
            &SecretString::new(payload.password.clone().into()),
        )
        .await?;

        if !password_ok {
            info!(
                "User {} attempted account deletion with incorrect password",
                auth_user.id
            );

            return token.authorized_ok(web::Json(false));
        }

        let language = &payload.language;

        // Get user deletion email template
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

        let user = models::users::get_by_id(&mut conn, auth_user.id).await?;

        let code = if let Some(existing) =
            models::user_email_codes::get_unused_user_email_code_with_user_id(
                &mut conn,
                auth_user.id,
            )
            .await?
        {
            existing.code
        } else {
            let new_code: String = rand::rng().random_range(100_000..1_000_000).to_string();
            models::user_email_codes::insert_user_email_code(
                &mut conn,
                auth_user.id,
                new_code.clone(),
            )
            .await?;
            new_code
        };

        models::user_email_codes::insert_user_email_code(&mut conn, auth_user.id, code.clone())
            .await?;
        let _ =
            models::email_deliveries::insert_email_delivery(&mut conn, user.id, delete_template.id)
                .await?;

        return token.authorized_ok(web::Json(true));
    }
    token.authorized_ok(web::Json(false))
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct EmailCode {
    pub code: String,
}

/**
POST `/api/v0/auth/delete-user-account` If users single-use code is correct then delete users account
**/
#[instrument(skip(pool, payload, auth_user, session))]
#[allow(clippy::async_yields_async)]
pub async fn delete_user_account(
    auth_user: Option<AuthUser>,
    pool: web::Data<PgPool>,
    payload: web::Json<EmailCode>,
    session: Session,
    tmc_client: web::Data<TmcClient>,
) -> ControllerResult<web::Json<bool>> {
    let token = skip_authorize();
    if let Some(auth_user) = auth_user {
        let mut conn = pool.acquire().await?;

        // Check users code is valid
        let code_ok = user_email_codes::is_reset_user_email_code_valid(
            &mut conn,
            auth_user.id,
            &payload.code,
        )
        .await?;

        if !code_ok {
            info!(
                "User {} attempted account deletion with incorrect code",
                auth_user.id
            );
            return token.authorized_ok(web::Json(false));
        }

        let mut tx = conn.begin().await?;
        let user = users::get_by_id(&mut tx, auth_user.id).await?;

        // Delete user from TMC if they have upstream_id
        if let Some(upstream_id) = user.upstream_id {
            let upstream_id_str = upstream_id.to_string();
            let tmc_success = tmc_client
                .delete_user_from_tmc(upstream_id_str)
                .await
                .unwrap_or(false);

            if !tmc_success {
                info!("TMC deletion failed for user {}", auth_user.id);
                return token.authorized_ok(web::Json(false));
            }
        }

        // Delete user locally and mark email code as used
        users::delete_user(&mut tx, auth_user.id).await?;
        user_email_codes::mark_user_email_code_used(&mut tx, auth_user.id, &payload.code).await?;

        tx.commit().await?;

        authorization::forget(&session);
        token.authorized_ok(web::Json(true))
    } else {
        return token.authorized_ok(web::Json(false));
    }
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

pub async fn is_user_global_admin(conn: &mut PgConnection, user_id: Uuid) -> ModelResult<bool> {
    let roles = models::roles::get_roles(conn, user_id).await?;
    Ok(roles
        .iter()
        .any(|r| r.role == models::roles::UserRole::Admin && r.is_global))
}

async fn handle_email_verification(
    conn: &mut PgConnection,
    user: &headless_lms_models::users::User,
) -> ControllerResult<web::Json<LoginResponse>> {
    let code: String = rand::rng().random_range(100_000..1_000_000).to_string();

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

    user_email_codes::insert_user_email_code(conn, user.id, code.clone())
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
        email_verification_token,
    }))
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct VerifyEmailRequest {
    pub email_verification_token: String,
    pub code: String,
}

/**
POST `/api/v0/auth/verify-email` Verifies email verification code and completes login.
**/
#[instrument(skip(session, pool, payload))]
pub async fn verify_email(
    session: Session,
    pool: web::Data<PgPool>,
    payload: web::Json<VerifyEmailRequest>,
) -> ControllerResult<web::Json<bool>> {
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
        return skip_token.authorized_ok(web::Json(false));
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
        return skip_token.authorized_ok(web::Json(false));
    }

    let user_id = token_value.user_id;

    user_email_codes::mark_user_email_code_used(&mut conn, user_id, &payload.code)
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

    authorization::remember(&session, user)?;

    let skip_token = skip_authorize();
    skip_token.authorized_ok(web::Json(true))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(
        web::resource("/signup")
            .wrap(RateLimit::new(RateLimitConfig {
                per_minute: Some(15),
                per_hour: None,
                per_day: Some(1000),
                per_month: None,
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
            }))
            .to(verify_email),
    );
}
