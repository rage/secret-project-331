use models::courses::{CourseToAudit, CourseToAuditUpdate};
use utoipa::{OpenApi, ToSchema};

use crate::{domain::models_requests, prelude::*};

#[derive(OpenApi)]
#[openapi(paths(get_courses_for_auditing))]
pub(crate) struct MainFrontendCourseAuditingApiDoc;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct CourseWithError {
    course: CourseToAudit,
    course_error: Option<String>,
}

/**
GET `/api/v0/main-frontend/course-auditing`
*/
#[utoipa::path(
    get,
    path = "/",
    operation_id = "getCoursesForAuditing",
    tag = "course_auditing",
    responses(
        (status = 200, description = "Courses for auditing", body = Vec<CourseToAudit>)
    )
)]
#[instrument(skip(pool))]
async fn get_courses_for_auditing(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CourseToAudit>>> {
    let mut conn = pool.acquire().await?;
    let courses_for_auditing = models::courses::get_all_courses_for_auditing(&mut conn).await?;

    let token = authorize(&mut conn, Act::Administrate, Some(user.id), Res::AnyCourse).await?;
    token.authorized_ok(web::Json(courses_for_auditing))
}

/**
PUT `/api/v0/main-frontend/course-auditing/:id`
*/
#[utoipa::path(
    put,
    path = "/{course_to_audit_id}",
    operation_id = "updateCourseAfterAuditing",
    tag = "course_auditing",
    params(
        ("course_to_audit_id" = Uuid, Path, description = "Course to audit id")
    ),
    request_body = CourseToAuditUpdate,
    responses(
        (status = 200, description = "Updated course", body = CourseWithError)
    )
)]
#[instrument(skip(pool))]
async fn update_course_after_auditing(
    payload: web::Json<CourseToAuditUpdate>,
    course_to_audit_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseWithError>> {
    let mut conn = pool.acquire().await?;

    //TODO: update res?
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::AnyCourse).await?;

    models::courses::update_course_after_auditing(&mut conn, *course_to_audit_id, payload.0)
        .await?;

    let updated_course =
        models::courses::get_course_for_auditing(&mut conn, *course_to_audit_id).await?;
    //TODO: update error handling
    let course_with_error = CourseWithError {
        course: updated_course,
        course_error: None,
    };

    // let exercise_service_with_error =
    //     try_to_get_exercise_service_info(&mut conn, updated_service).await?;
    token.authorized_ok(web::Json(course_with_error))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/", web::get().to(get_courses_for_auditing))
        .route(
            "/{course_to_audit_id_id}",
            web::put().to(update_course_after_auditing),
        );
}
