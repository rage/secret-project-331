use models::courses::CourseAudit;
use utoipa::{OpenApi, ToSchema};

use crate::{domain::models_requests, prelude::*};

#[derive(OpenApi)]
#[openapi(paths(get_course_audits))]
pub(crate) struct MainFrontendCourseAuditsApiDoc;

/**
GET `/api/v0/main-frontend/course-audits`
*/
#[utoipa::path(
    get,
    path = "/",
    operation_id = "getCourseAudits",
    tag = "course_audits",
    responses(
        (status = 200, description = "Course audits", body = Vec<CourseAudit>)
    )
)]
#[instrument(skip(pool))]
async fn get_course_audits(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CourseAudit>>> {
    let mut conn = pool.acquire().await?;
    let course_audits = models::courses::all_course_audits(&mut conn).await?;

    let token = authorize(&mut conn, Act::Administrate, Some(user.id), Res::AnyCourse).await?;
    token.authorized_ok(web::Json(course_audits))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/", web::get().to(get_course_audits));
}
