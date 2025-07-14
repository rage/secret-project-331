/*!
Handlers for HTTP requests to `/api/v0/tmc-server/users/authenticate`.

These endpoints are used by the TMC server to verify whether a user's email and password match
what is stored in this system.

This endpoint is intended to be used exclusively by the TMC server, and access requires
a valid authorization header.
*/

use crate::domain::authorization::authorize_access_to_tmc_server;
use crate::prelude::models::user_details::search_for_user_details_by_email;
use crate::prelude::*;
use secrecy::SecretString;

#[derive(Debug, Deserialize)]
pub struct PasswordAuthRequest {
    email: String,
    password: String,
}

/**
POST `/api/v0/tmc-server/users/authenticate`

Endpoint used by the TMC server to authenticate a user using email and password.

Returns `true` if the credentials match a known user in this system, otherwise returns `false`.

Only works if the authorization header is set to a valid shared secret between systems.
*/
#[instrument(skip(pool))]
pub async fn courses_moocfi_password_login(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    payload: web::Json<PasswordAuthRequest>,
) -> ControllerResult<web::Json<bool>> {
    let token = authorize_access_to_tmc_server(&request).await?;

    let mut conn = pool.acquire().await?;

    let PasswordAuthRequest { email, password } = payload.into_inner();

    let users = match search_for_user_details_by_email(&mut conn, &email).await {
        Ok(u) => u,
        Err(_) => return token.authorized_ok(web::Json(false)),
    };

    let user = match users.into_iter().next() {
        Some(user) => user,
        None => return token.authorized_ok(web::Json(false)),
    };

    let password_secret = SecretString::new(password.into());
    let is_valid =
        models::user_passwords::verify_user_password(&mut conn, user.user_id, &password_secret)
            .await
            .unwrap_or(false);

    token.authorized_ok(web::Json(is_valid))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/authenticate",
        web::post().to(courses_moocfi_password_login),
    );
}
