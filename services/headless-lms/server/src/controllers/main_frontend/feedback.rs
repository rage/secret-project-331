use models::feedback;

use crate::controllers::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct MarkAsRead {
    read: bool,
}

/**
POST `/api/v0/main-frontend/feedback/:id` - Creates new feedback.
*/
#[instrument(skip(pool))]
pub async fn mark_as_read(
    feedback_id: web::Path<Uuid>,
    mark_as_read: web::Json<MarkAsRead>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    feedback::mark_as_read(&mut conn, *feedback_id, mark_as_read.into_inner().read).await?;

    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{feedback_id}", web::post().to(mark_as_read));
}
