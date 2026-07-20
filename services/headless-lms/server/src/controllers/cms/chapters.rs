//! Controllers for requests starting with `/api/v0/cms/chapters`.

use models::chapters::DatabaseChapter;
use utoipa::OpenApi;

use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(get_all_chapters_by_course_id))]
pub(crate) struct CmsChaptersApiDoc;

/**
GET `/api/v0/cms/chapters/{course_id}/all-chapters-for-course` - Gets all chapters with a course_id
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{course_id}/all-chapters-for-course",
    operation_id = "getAllChaptersByCourseId",
    tag = "cms_chapters",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Course chapters", body = Vec<DatabaseChapter>)
    )
)]
async fn get_all_chapters_by_course_id(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<DatabaseChapter>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::View, Some(user.id), Res::Course(*course_id)).await?;

    let mut chapters = models::chapters::course_chapters(&mut conn, *course_id).await?;

    chapters.sort_by_key(|a| a.chapter_number);

    token.authorized_ok(web::Json(chapters))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{course_id}/all-chapters-for-course",
        web::get().to(get_all_chapters_by_course_id),
    );
}
