/*!
Handlers for HTTP requests to `/api/v0/tmc-server/users-by-upstream-id`.

These endpoints are used by the TMC server so that it can integrate with this system.
*/

use std::env;

use crate::{
    domain::authorization::{
        authorize_access_from_tmc_server_to_course_mooc_fi,
        get_or_create_user_from_tmc_mooc_fi_response,
    },
    prelude::*,
};
use headless_lms_utils::tmc::TmcClient;
use models::users::User;

/**
GET `/api/v0/tmc-server/users-by-upstream-id/:id` Endpoint that TMC server uses to get user information by using its own ids.

Only works if the authorization header is set to a secret value.
*/
#[instrument(skip(pool))]
pub async fn get_user_by_upstream_id(
    upstream_id: web::Path<i32>,
    pool: web::Data<PgPool>,
    request: HttpRequest,
    tmc_client: web::Data<TmcClient>,
) -> ControllerResult<web::Json<User>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_access_from_tmc_server_to_course_mooc_fi(&request).await?;
    let tmc_access_token = env::var("TMC_ACCESS_TOKEN").expect("TMC_ACCESS_TOKEN must be defined");
    let tmc_user = tmc_client
        .get_user_from_tmc_mooc_fi_by_tmc_access_token_and_upstream_id(
            &tmc_access_token,
            &upstream_id,
        )
        .await?;

    debug!(
        "Creating or fetching user with TMC id {} and mooc.fi UUID {}",
        tmc_user.id,
        tmc_user
            .courses_mooc_fi_user_id
            .map(|uuid| uuid.to_string())
            .unwrap_or_else(|| "None (will generate new UUID)".to_string())
    );
    let user = get_or_create_user_from_tmc_mooc_fi_response(&mut conn, tmc_user).await?;
    info!(
        "Successfully got user details from mooc.fi for user {}",
        user.id
    );

    token.authorized_ok(web::Json(user))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{user_id}", web::get().to(get_user_by_upstream_id));
}
