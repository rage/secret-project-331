//! Controllers for requests starting with `/api/v0/main-frontend/external_courses`.

use models::external_courses::{ExternalCourseOutput, NewExternalCourse, create_external_course};
use utoipa::OpenApi;

use crate::{domain::authorization::skip_authorize, prelude::*};

#[derive(OpenApi)]
#[openapi(paths(insert_external_course))]
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
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{new}", web::post().to(insert_external_course));
}
