use models::proposed_page_edits::NewProposedPageEdits;

use crate::prelude::*;

/**
POST `/api/v0/course-material/proposed-edits/:course-id`
*/
#[instrument(skip(pool))]
async fn post_proposed_edits(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    payload: web::Json<NewProposedPageEdits>,
    user: Option<AuthUser>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let user_id = user.map(|u| u.id);
    models::proposed_page_edits::insert(
        &mut conn,
        PKeyPolicy::Generate,
        *course_id,
        user_id,
        &payload,
    )
    .await?;
    let token = authorize(&mut conn, Act::View, user_id, Res::Course(*course_id)).await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_id}", web::post().to(post_proposed_edits));
}
