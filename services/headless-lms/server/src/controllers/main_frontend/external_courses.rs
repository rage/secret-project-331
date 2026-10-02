//! Controllers for requests starting with `/api/v0/main-frontend/external_courses`.

use models::external_courses::{
    ExternalCourseOutput, NewExternalCourse, create_external_course, get_all_external_courses,
};
use utoipa::OpenApi;

use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(insert_external_course, get_external_courses))]
pub(crate) struct MainFrontendExternalCoursesApiDoc;

/**
POST `/api/v0/main-frontend/external-course/new` - Creates new external course.
*/
#[utoipa::path(
    post,
    path = "/new",
    operation_id = "createExternalCourse",
    tag = "externalCourses",
    request_body = NewExternalCourse,
    responses(
        (status = 200, description = "Created external course", body = ExternalCourseOutput)
    )
)]
#[instrument(skip(pool, app_conf))]
async fn insert_external_course(
    request_id: RequestId,
    pool: web::Data<PgPool>,
    payload: web::Json<NewExternalCourse>,
    user: AuthUser,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<ExternalCourseOutput>> {
    let mut conn = pool.acquire().await?;
    let new_course = payload.0;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?;

    let external_course = create_external_course(&mut conn, &app_conf, new_course).await?;

    token.authorized_ok(web::Json(external_course))
}

/**
GET `/api/v0/main-frontend/external-course/all` - Gets all external courses.
 */
#[utoipa::path(
    get,
    path = "/all",
    operation_id = "getExternalCourses",
    tag = "externalCourses",
    responses(
        (
            status = 200,
            description = "All external courses",
            body = Vec<ExternalCourseOutput>
        )
    )
)]
#[instrument(skip(pool))]
async fn get_external_courses(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExternalCourseOutput>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?;

    let external_courses = get_all_external_courses(&mut conn).await?;
    token.authorized_ok(web::Json(external_courses))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/new", web::post().to(insert_external_course))
        .route("/all", web::get().to(get_external_courses));
}
