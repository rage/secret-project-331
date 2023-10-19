/*!
Handlers for HTTP requests to `/api/v0/tmc-server/users-by-upstream-id`.

These endpoints are used by the TMC server so that it can integrate with this system.
*/

use std::env;

use crate::{
    domain::authorization::{
        authorize_access_to_tmc_server, get_user_from_moocfi_by_tmc_access_token_and_upstream_id,
    },
    prelude::*,
};
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
) -> ControllerResult<web::Json<User>> {
    let mut conn = pool.acquire().await?;
    let token = authorize_access_to_tmc_server(&request).await?;
    let tmc_access_token = env::var("TMC_ACCESS_TOKEN").expect("TMC_ACCESS_TOKEN must be defined");
    let user = get_user_from_moocfi_by_tmc_access_token_and_upstream_id(
        &mut conn,
        &tmc_access_token,
        &upstream_id,
    )
    .await?;

    token.authorized_ok(web::Json(user))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{user_id}", web::get().to(get_user_by_upstream_id));
}
