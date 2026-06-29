use models::courses::CourseAudit;
use utoipa::{OpenApi, ToSchema};

use crate::{domain::models_requests, prelude::*};

#[derive(OpenApi)]
#[openapi(paths(get_courses_for_auditing))]
pub(crate) struct MainFrontendCourseAuditingApiDoc;

/**
GET `/api/v0/main-frontend/course-auditing`
*/
#[utoipa::path(
    get,
    path = "/",
    operation_id = "getCoursesForAuditing",
    tag = "courses_for_auditing",
    responses(
        (status = 200, description = "Courses for auditing", body = Vec<CourseAudit>)
    )
)]
#[instrument(skip(pool))]
async fn get_courses_for_auditing(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CourseAudit>>> {
    let mut conn = pool.acquire().await?;
    let courses_for_auditing = models::courses::get_all_courses_for_auditing(&mut conn).await?;

    let token = authorize(&mut conn, Act::Administrate, Some(user.id), Res::AnyCourse).await?;
    token.authorized_ok(web::Json(courses_for_auditing))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/", web::get().to(get_courses_for_auditing));
}
