use models::errors::{self, NewErrorReport};
use utoipa::OpenApi;

use crate::{domain::authorization::skip_authorize, prelude::*};

#[derive(OpenApi)]
#[openapi(paths(post_error))]
pub(crate) struct ErrorsRoutesApiDoc;

/**
POST `/api/v0/errors` - Reports an error occurrence.

Accessible to both authenticated and anonymous users. If the user is logged in, their id is stored with the error occurrence.
*/
#[utoipa::path(
    post,
    path = "",
    operation_id = "postError",
    tag = "errors",
    request_body = NewErrorReport,
    responses(
        (status = 204, description = "Error recorded successfully")
    )
)]
#[instrument(skip(pool))]
pub async fn post_error(
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
    payload: web::Json<NewErrorReport>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let user_id = user.map(|u| u.id);
    errors::insert(&mut conn, user_id, &payload).await?;
    errors::maybe_delete_expired(&mut conn).await?;
    let token = skip_authorize();
    token.authorized_ok(HttpResponse::NoContent().finish())
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(post_error));
}
