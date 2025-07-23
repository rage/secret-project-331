/*!
Handlers for HTTP requests to `/api/v0/tmc-server/users/`.

These endpoints are used by the TMC server to verify whether a user's email and password match
what is stored in this system.

This endpoint is intended to be used exclusively by the TMC server, and access requires
a valid authorization header.
*/

use crate::domain::authorization::authorize_access_from_tmc_server_to_course_mooc_fi;
use crate::prelude::*;
use secrecy::SecretString;

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    user_id: Uuid,
    password: SecretString,
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
    old_password: SecretString,
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

    let is_user_valid =
        models::user_passwords::verify_user_password(&mut conn, user_id, &old_password)
            .await
            .unwrap_or(false);
    if !is_user_valid {
        return token.authorized_ok(web::Json(false));
    }

    let new_password_hash = match models::user_passwords::hash_password(&new_password) {
        Ok(hash) => hash,
        Err(_) => return token.authorized_ok(web::Json(false)),
    };

    let update_ok =
        models::user_passwords::upsert_user_password(&mut conn, user_id, new_password_hash)
            .await
            .unwrap_or(false);

    token.authorized_ok(web::Json(update_ok))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/authenticate",
        web::post().to(courses_moocfi_password_login),
    )
    .route(
        "/change-password",
        web::post().to(courses_moocfi_password_change),
    );
}
