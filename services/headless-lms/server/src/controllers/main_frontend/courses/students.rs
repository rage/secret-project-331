//! Controllers for requests starting with `/api/v0/main-frontend/courses/{course_id}/students`.
use crate::prelude::*;

use headless_lms_models::chapters::CourseUserInfo;
use headless_lms_models::library::students_view::{
    CertificateGridRow, CompletionGridRow, ProgressOverview,
};
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(paths(get_progress, get_course_users, get_completions, get_certificates))]
pub(crate) struct MainFrontendCourseStudentsApiDoc;

/// GET `/api/v0/main-frontend/courses/{course_id}/students/progress`
#[utoipa::path(
    get,
    path = "/progress",
    operation_id = "getCourseStudentsProgress",
    tag = "course-students",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Course student progress overview", body = ProgressOverview)
    )
)]
#[instrument(skip(pool))]
async fn get_progress(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ProgressOverview>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let res =
        headless_lms_models::library::students_view::get_progress(&mut conn, *course_id).await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/courses/{course_id}/students/users`
#[utoipa::path(
    get,
    path = "/users",
    operation_id = "getCourseStudentsUsers",
    tag = "course-students",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Course users", body = [CourseUserInfo])
    )
)]
#[instrument(skip(pool))]
async fn get_course_users(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CourseUserInfo>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let res = headless_lms_models::library::students_view::get_course_users(&mut conn, *course_id)
        .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/courses/{course_id}/students/completions`
#[utoipa::path(
    get,
    path = "/completions",
    operation_id = "getCourseStudentsCompletions",
    tag = "course-students",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Course completions", body = [CompletionGridRow])
    )
)]
#[instrument(skip(pool))]
async fn get_completions(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CompletionGridRow>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let rows = headless_lms_models::library::students_view::get_completions_grid_by_course_id(
        &mut conn, *course_id,
    )
    .await?;

    token.authorized_ok(web::Json(rows))
}

/// GET `/api/v0/main-frontend/courses/{course_id}/students/certificates`
#[utoipa::path(
    get,
    path = "/certificates",
    operation_id = "getCourseStudentsCertificates",
    tag = "course-students",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Course certificates", body = [CertificateGridRow])
    )
)]
#[instrument(skip(pool))]
async fn get_certificates(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CertificateGridRow>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let rows = headless_lms_models::library::students_view::get_certificates_grid_by_course_id(
        &mut conn, *course_id,
    )
    .await?;

    token.authorized_ok(web::Json(rows))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/progress", web::get().to(get_progress));
    cfg.route("/users", web::get().to(get_course_users));
    cfg.route("/completions", web::get().to(get_completions));
    cfg.route("/certificates", web::get().to(get_certificates));
}
