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

    let user = get_or_create_user_from_tmc_mooc_fi_response(&mut tx, tmc_user).await?;

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

    // Notify TMC that password is now managed by courses.mooc.fi.
    // Try a few times inline to handle common transient failures without blocking too long.
    // If all inline attempts fail, hand off to a background task so the HTTP response
    // is returned promptly while longer retries proceed.
    const MAX_ATTEMPTS_INLINE: u32 = 3;
    const MAX_DELAY_MS_INLINE: u64 = 2_000;
    let mut inline_succeeded = false;
    for attempt in 1..=MAX_ATTEMPTS_INLINE {
        match tmc_client
            .set_user_password_managed_by_courses_mooc_fi(upstream_id.to_string(), user.id)
            .await
        {
            Ok(_) => {
                inline_succeeded = true;
                break;
            }
            Err(e) if attempt < MAX_ATTEMPTS_INLINE => {
                let delay = std::time::Duration::from_millis(
                    200u64
                        .saturating_mul(2u64.pow(attempt - 1))
                        .min(MAX_DELAY_MS_INLINE),
                );
                warn!(
                    "Failed to notify TMC that user's password is saved in courses.mooc.fi (inline attempt {}/{}), retrying in {:?}: upstream_id={}, user_id={}, error={}",
                    attempt, MAX_ATTEMPTS_INLINE, delay, upstream_id, user.id, e
                );
                tokio::time::sleep(delay).await;
            }
            Err(e) => {
                warn!(
                    "Inline TMC notification attempts exhausted, handing off to background task: upstream_id={}, user_id={}, error={}",
                    upstream_id, user.id, e
                );
            }
        }
    }
    if !inline_succeeded {
        let tmc_client = tmc_client.clone();
        let user_id = user.id;
        tokio::spawn(async move {
            const MAX_ATTEMPTS_BG: u32 = 10;
            const MAX_DELAY_MS_BG: u64 = 30_000;
            for attempt in 1..=MAX_ATTEMPTS_BG {
                match tmc_client
                    .set_user_password_managed_by_courses_mooc_fi(upstream_id.to_string(), user_id)
                    .await
                {
                    Ok(_) => {
                        info!(
                            "Background TMC notification succeeded on attempt {}: upstream_id={}, user_id={}",
                            attempt, upstream_id, user_id
                        );
                        break;
                    }
                    Err(e) if attempt < MAX_ATTEMPTS_BG => {
                        let delay = std::time::Duration::from_millis(
                            200u64
                                .saturating_mul(2u64.pow(attempt - 1))
                                .min(MAX_DELAY_MS_BG),
                        );
                        warn!(
                            "Background TMC notification failed (attempt {}/{}), retrying in {:?}: upstream_id={}, user_id={}, error={}",
                            attempt, MAX_ATTEMPTS_BG, delay, upstream_id, user_id, e
                        );
                        tokio::time::sleep(delay).await;
                    }
                    Err(e) => {
                        error!(
                            "Background TMC notification exhausted all {} retries: upstream_id={}, user_id={}, error={}",
                            MAX_ATTEMPTS_BG, upstream_id, user_id, e
                        );
                    }
                }
            }
        });
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
