/*!
Handlers for HTTP requests to `/api/v0/tmc-server/users/`.

These endpoints are used by the TMC server to verify whether a user's email and password match
what is stored in this system.

This endpoint is intended to be used exclusively by the TMC server, and access requires
a valid authorization header.
*/

use crate::domain::authorization::{
    authorize_access_from_tmc_server_to_course_mooc_fi,
    get_or_create_user_from_tmc_mooc_fi_response,
};
use crate::prelude::*;
use headless_lms_utils::tmc::TmcClient;
use models::users::User;
use secrecy::SecretString;

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    upstream_id: i32,
    password: SecretString,
}

#[derive(Debug, Serialize)]
pub struct CreateUserResponse {
    pub user: User,
    pub password_set: bool,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    user_id: Uuid,
    password: SecretString,
}

/**
POST `/api/v0/tmc-server/users/create`

Endpoint used by the TMC server to create a new user in this system.

Fetches the user details from tmc.mooc.fi and creates the user if they don't already exist.
Sets the provided password for the user.

Returns the created user and a boolean indicating whether the password was successfully set.

Only works if the authorization header is set to a valid shared secret between systems.
*/
#[instrument(skip(pool, tmc_client))]
pub async fn create_user(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    payload: web::Json<CreateUserRequest>,
    tmc_client: web::Data<TmcClient>,
) -> ControllerResult<web::Json<CreateUserResponse>> {
    let token = authorize_access_from_tmc_server_to_course_mooc_fi(&request).await?;

    let mut conn = pool.acquire().await?;

    let CreateUserRequest {
        upstream_id,
        password,
    } = payload.into_inner();

    // Fetch user details from tmc.mooc.fi
    let tmc_user = tmc_client
        .get_user_from_tmc_mooc_fi_by_tmc_access_token_and_upstream_id(&upstream_id)
        .await?;

    info!(
        "Creating or fetching user with TMC id {} and mooc.fi UUID {}",
        tmc_user.id,
        tmc_user
            .courses_mooc_fi_user_id
            .map(|uuid| uuid.to_string())
            .unwrap_or_else(|| "None (will generate new UUID)".to_string())
    );

    // Start a transaction to ensure atomic user creation and password setting
    let mut tx = conn.begin().await?;

    // Create user in headless-lms (or fetch if already exists)
    let user = get_or_create_user_from_tmc_mooc_fi_response(&mut tx, tmc_user).await?;

    info!("User {} created or fetched successfully", user.id);

    // Set password
    let password_hash = models::user_passwords::hash_password(&password).map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            "Failed to hash password",
            Some(anyhow::Error::msg(e.to_string())),
        )
    })?;
    let password_set =
        models::user_passwords::upsert_user_password(&mut tx, user.id, &password_hash).await?;

    if !password_set {
        return Err(ControllerError::new(
            ControllerErrorType::InternalServerError,
            "Failed to set password",
            Some(anyhow::Error::msg(format!(
                "upsert_user_password returned false for user {}",
                user.id
            ))),
        ));
    }

    // Commit the transaction only if everything succeeded
    tx.commit().await?;

    // Notify TMC that password is now managed by courses.mooc.fi.
    // Retry with exponential backoff and a cap before giving up.
    const MAX_ATTEMPTS: u32 = 10;
    const MAX_DELAY_MS: u64 = 30_000;
    for attempt in 1..=MAX_ATTEMPTS {
        match tmc_client
            .set_user_password_managed_by_courses_mooc_fi(upstream_id.to_string(), user.id)
            .await
        {
            Ok(_) => break,
            Err(e) if attempt < MAX_ATTEMPTS => {
                let delay = std::time::Duration::from_millis(
                    200u64
                        .saturating_mul(2u64.pow(attempt - 1))
                        .min(MAX_DELAY_MS),
                );
                warn!(
                    "Failed to notify TMC that user's password is saved in courses.mooc.fi (attempt {}/{}), retrying in {:?}: upstream_id={}, user_id={}, error={}",
                    attempt, MAX_ATTEMPTS, delay, upstream_id, user.id, e
                );
                tokio::time::sleep(delay).await;
            }
            Err(e) => {
                return Err(ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    "Failed to notify TMC that user's password is saved in courses.mooc.fi after all retries",
                    Some(anyhow::Error::msg(e.to_string())),
                ));
            }
        }
    }

    info!("Password set: {}", password_set);

    token.authorized_ok(web::Json(CreateUserResponse { user, password_set }))
}

/**
POST `/api/v0/tmc-server/users/authenticate`

Endpoint used by the TMC server to authenticate a user using user_id and password.

Returns `true` if the credentials match a known user in this system, otherwise returns `false`.

Only works if the authorization header is set to a valid shared secret between systems.
*/
#[instrument(skip(pool))]
pub async fn courses_moocfi_password_login(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    payload: web::Json<LoginRequest>,
) -> ControllerResult<web::Json<bool>> {
    let token = authorize_access_from_tmc_server_to_course_mooc_fi(&request).await?;

    let mut conn = pool.acquire().await?;

    let LoginRequest { user_id, password } = payload.into_inner();

    let is_valid = models::user_passwords::verify_user_password(&mut conn, user_id, &password)
        .await
        .unwrap_or(false);

    token.authorized_ok(web::Json(is_valid))
}

#[derive(Debug, Deserialize)]
pub struct PasswordChangeRequest {
    user_id: Uuid,
    old_password: Option<SecretString>,
    new_password: SecretString,
}

/**
POST `/api/v0/tmc-server/users/change-password`

Endpoint called by the TMC server when a user's password is changed.

Only works if the authorization header is set to a valid shared secret between systems.
*/
#[instrument(skip(pool))]
pub async fn courses_moocfi_password_change(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    payload: web::Json<PasswordChangeRequest>,
) -> ControllerResult<web::Json<bool>> {
    let token = authorize_access_from_tmc_server_to_course_mooc_fi(&request).await?;

    let mut conn = pool.acquire().await?;

    let PasswordChangeRequest {
        user_id,
        old_password,
        new_password,
    } = payload.into_inner();

    // Verify old password if it is not None
    if let Some(old) = old_password {
        let is_user_valid = models::user_passwords::verify_user_password(&mut conn, user_id, &old)
            .await
            .unwrap_or(false);
        if !is_user_valid {
            return token.authorized_ok(web::Json(false));
        }
    }

    let new_password_hash = match models::user_passwords::hash_password(&new_password) {
        Ok(hash) => hash,
        Err(_) => return token.authorized_ok(web::Json(false)),
    };

    let update_ok =
        models::user_passwords::upsert_user_password(&mut conn, user_id, &new_password_hash)
            .await
            .unwrap_or(false);

    token.authorized_ok(web::Json(update_ok))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/create", web::post().to(create_user))
        .route(
            "/authenticate",
            web::post().to(courses_moocfi_password_login),
        )
        .route(
            "/change-password",
            web::post().to(courses_moocfi_password_change),
        );
}
