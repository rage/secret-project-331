use headless_lms_models::courses::CourseAuditingData;
use models::courses::CourseAuditingDataUpdate;
use utoipa::OpenApi;

use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(get_courses_for_auditing, update_course_after_auditing))]
pub(crate) struct MainFrontendCourseAuditingApiDoc;

/**
GET `/api/v0/main-frontend/course-auditing`
*/
#[utoipa::path(
    get,
    path = "/",
    operation_id = "getCoursesForAuditing",
    tag = "course_auditing",
    responses(
        (status = 200, description = "Courses for auditing", body = Vec<CourseAuditingData>)
    )
)]
#[instrument(skip(pool))]
async fn get_courses_for_auditing(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CourseAuditingData>>> {
    let mut conn = pool.acquire().await?;

    let data = models::courses::get_all_course_data_for_auditing(&mut conn).await?;
    // let courses_for_auditing = models::courses::get_all_courses_for_auditing(&mut conn).await?;

    let token = authorize(&mut conn, Act::View, Some(user.id), Res::GlobalPermissions).await?;
    token.authorized_ok(web::Json(data))
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
    request_body = CourseAuditingDataUpdate,
    responses(
        (status = 200, description = "Updated course", body = CourseAuditingData)
    )
)]
#[instrument(skip(pool))]
async fn update_course_after_auditing(
    payload: web::Json<CourseAuditingDataUpdate>,
    course_to_audit_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseAuditingData>> {
    let mut conn = pool.acquire().await?;
    models::courses::update_course_after_auditing(&mut conn, *course_to_audit_id, payload.0)
        .await?;

    let updated_course =
        models::courses::get_course_for_auditing(&mut conn, *course_to_audit_id).await?;

    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?;

    token.authorized_ok(web::Json(updated_course))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/", web::get().to(get_courses_for_auditing))
        .route(
            "/{course_to_audit_id}",
            web::put().to(update_course_after_auditing),
        );
}
