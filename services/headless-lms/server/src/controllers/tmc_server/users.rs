/*!
Handlers for HTTP requests to `/api/v0/tmc-server/users/`.

Exposes three endpoints used exclusively by the TMC server, all of which require a valid
shared-secret authorization header:

- `POST /create` – fetches user details from tmc.mooc.fi, creates the user in this system if
  they don't exist, sets the provided password, and notifies TMC that password management has
  moved to courses.mooc.fi.
- `POST /authenticate` – verifies a user_id/password pair against the locally stored hash.
- `POST /change-password` – updates the stored password hash, optionally verifying the old one
  first.
*/

use crate::domain::authorization::{
    authorize_access_from_tmc_server_to_course_mooc_fi,
    get_or_create_user_from_tmc_mooc_fi_response,
};
use crate::prelude::*;
use headless_lms_utils::services::tmc::TmcClient;
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

    let CreateUserRequest {
        upstream_id,
        password,
    } = payload.into_inner();

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

    // A transaction ensures user creation and password hash are written atomically.
    let mut tx = pool.begin().await?;

    let user = get_or_create_user_from_tmc_mooc_fi_response(
        &mut tx,
        tmc_user,
        tmc_client.get_admin_access_token(),
    )
    .await?;

    info!("User {} created or fetched successfully", user.id);

    let password_hash = models::user_passwords::hash_password(&password).map_err(|e| {
        ControllerError::new(
            ControllerErrorType::InternalServerError,
            "Failed to hash password",
            Some(anyhow::Error::msg(e.to_string())),
        )
    })?;
    let password_set =
        models::user_passwords::upsert_user_password(&mut tx, user.id, &password_hash).await?;

    tx.commit().await?;

    // Notify TMC that the password is now managed by courses.mooc.fi (best-effort, retried in the
    // background; the user has already been created and the password stored).
    super::notify_password_managed_with_retry(&tmc_client, upstream_id.to_string(), user.id).await;

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
        .unwrap_or_else(|e| {
            // A DB/crypto error must not look identical to a wrong password without a trace.
            warn!("Password verification errored for user {user_id}: {e}");
            false
        });

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
            .unwrap_or_else(|e| {
                warn!("Old-password verification errored for user {user_id}: {e}");
                false
            });
        if !is_user_valid {
            return token.authorized_ok(web::Json(false));
        }
    }

    let new_password_hash = match models::user_passwords::hash_password(&new_password) {
        Ok(hash) => hash,
        Err(e) => {
            warn!("Failed to hash new password for user {user_id}: {e}");
            return token.authorized_ok(web::Json(false));
        }
    };

    let update_ok =
        models::user_passwords::upsert_user_password(&mut conn, user_id, &new_password_hash)
            .await
            .unwrap_or_else(|e| {
                warn!("Failed to store new password for user {user_id}: {e}");
                false
            });

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
