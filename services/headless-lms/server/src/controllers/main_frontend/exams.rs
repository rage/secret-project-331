use chrono::Utc;
use models::{
    course_exams,
    exams::{self, Exam, NewExam},
};

use crate::{
    domain::csv_export::{
        general_export, points::ExamPointExportOperation,
        submissions::ExamSubmissionExportOperation,
    },
    prelude::*,
};

/**
GET `/api/v0/main-frontend/exams/:id
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn get_exam(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Exam>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(*exam_id)).await?;

    let exam = exams::get(&mut conn, *exam_id).await?;

    token.authorized_ok(web::Json(exam))
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExamCourseInfo {
    course_id: Uuid,
}

/**
POST `/api/v0/main-frontend/exams/:id/set`
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn set_course(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    exam: web::Json<ExamCourseInfo>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Exam(*exam_id)).await?;

    course_exams::upsert(&mut conn, *exam_id, exam.course_id).await?;

    token.authorized_ok(web::Json(()))
}

/**
POST `/api/v0/main-frontend/exams/:id/unset`
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn unset_course(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    exam: web::Json<ExamCourseInfo>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Exam(*exam_id)).await?;

    course_exams::delete(&mut conn, *exam_id, exam.course_id).await?;

    token.authorized_ok(web::Json(()))
}

/**
GET `/api/v0/main-frontend/exams/:id/export-points`
*/
#[instrument(skip(pool))]
pub async fn export_points(
    exam_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(*exam_id)).await?;

    let exam = exams::get(&mut conn, *exam_id).await?;

    general_export(
        pool,
        &format!(
            "attachment; filename=\"Exam: {} - Point export {}.csv\"",
            exam.name,
            Utc::now().format("%Y-%m-%d")
        ),
        ExamPointExportOperation { exam_id: *exam_id },
        token,
    )
    .await
}

/**
GET `/api/v0/main-frontend/exams/:id/export-submissions`
*/
#[instrument(skip(pool))]
pub async fn export_submissions(
    exam_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(*exam_id)).await?;

    let exam = exams::get(&mut conn, *exam_id).await?;

    general_export(
        pool,
        &format!(
            "attachment; filename=\"Exam: {} - Submissions {}.csv\"",
            exam.name,
            Utc::now().format("%Y-%m-%d")
        ),
        ExamSubmissionExportOperation { exam_id: *exam_id },
        token,
    )
    .await
}

/**
 * POST `/api/v0/cms/exams/:exam_id/duplicate` - duplicates existing exam.
 */
#[generated_doc]
#[instrument(skip(pool))]
async fn duplicate_exam(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    new_exam: web::Json<NewExam>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let organization_id = models::exams::get_organization_id(&mut conn, *exam_id).await?;
    let token = authorize(
        &mut conn,
        Act::CreateCoursesOrExams,
        Some(user.id),
        Res::Organization(organization_id),
    )
    .await?;

    let mut tx = conn.begin().await?;
    let new_exam = models::library::copying::copy_exam(&mut tx, &exam_id, &new_exam).await?;

    models::roles::insert(
        &mut tx,
        user.id,
        models::roles::UserRole::Teacher,
        models::roles::RoleDomain::Exam(new_exam.id),
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(true))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{id}", web::get().to(get_exam))
        .route("/{id}/set", web::post().to(set_course))
        .route("/{id}/unset", web::post().to(unset_course))
        .route("/{id}/export-points", web::get().to(export_points))
        .route(
            "/{id}/export-submissions",
            web::get().to(export_submissions),
        )
        .route("/{id}/duplicate", web::post().to(duplicate_exam));
}
