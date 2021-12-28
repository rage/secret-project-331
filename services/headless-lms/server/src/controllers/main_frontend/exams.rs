use crate::controllers::prelude::*;
use crate::domain::csv_export::{self, CSVExportAdapter};
use bytes::Bytes;
use chrono::Utc;
use models::exams::{self, Exam};
use tokio_stream::wrappers::UnboundedReceiverStream;

pub async fn get_exam(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Exam>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::View, user.id, Res::Exam(*id)).await?;
    let exam = exams::get(&mut conn, id.into_inner()).await?;
    Ok(web::Json(exam))
}

#[derive(Debug, Deserialize, TS)]
pub struct ExamCourseInfo {
    course_id: Uuid,
}

pub async fn set_course(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    course_id: web::Json<ExamCourseInfo>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Edit, user.id, Res::Exam(*id)).await?;

    exams::set_course(&mut conn, id.into_inner(), course_id.into_inner().course_id).await?;
    Ok(web::Json(()))
}

pub async fn unset_course(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    course_id: web::Json<ExamCourseInfo>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Edit, user.id, Res::Exam(*id)).await?;

    exams::unset_course(&mut conn, id.into_inner(), course_id.into_inner().course_id).await?;
    Ok(web::Json(()))
}

#[instrument(skip(pool))]
pub async fn export_points(
    exam_id_path: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Teach, user.id, Res::Exam(*exam_id_path)).await?;
    let (sender, receiver) = tokio::sync::mpsc::unbounded_channel::<ControllerResult<Bytes>>();
    let exam_id = exam_id_path.into_inner();

    // spawn handle that writes the csv row by row into the sender
    let mut handle_conn = pool.acquire().await?;
    let _handle = tokio::spawn(async move {
        let res =
            csv_export::export_exam_points(&mut handle_conn, exam_id, CSVExportAdapter { sender })
                .await;
        if let Err(err) = res {
            tracing::error!("Failed to export exam points: {}", err);
        }
    });

    let exam = exams::get(&mut conn, exam_id).await?;

    // return response that streams data from the receiver
    Ok(HttpResponse::Ok()
        .append_header((
            "Content-Disposition",
            format!(
                "attachment; filename=\"Exam: {} - Point export {}.csv\"",
                exam.name,
                Utc::today().format("%Y-%m-%d")
            ),
        ))
        .streaming(UnboundedReceiverStream::new(receiver)))
}

#[instrument(skip(pool))]
pub async fn export_submissions(
    exam_id_path: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Teach, user.id, Res::Exam(*exam_id_path)).await?;
    let (sender, receiver) = tokio::sync::mpsc::unbounded_channel::<ControllerResult<Bytes>>();
    let exam_id = exam_id_path.into_inner();

    // spawn handle that writes the csv row by row into the sender
    let mut handle_conn = pool.acquire().await?;
    let _handle = tokio::spawn(async move {
        let res = csv_export::export_exam_submissions(
            &mut handle_conn,
            exam_id,
            CSVExportAdapter { sender },
        )
        .await;
        if let Err(err) = res {
            tracing::error!("Failed to export exam submissions: {}", err);
        }
    });

    let exam = exams::get(&mut conn, exam_id).await?;

    // return response that streams data from the receiver
    Ok(HttpResponse::Ok()
        .append_header((
            "Content-Disposition",
            format!(
                "attachment; filename=\"Exam: {} - Submissions {}.csv\"",
                exam.name,
                Utc::today().format("%Y-%m-%d")
            ),
        ))
        .streaming(UnboundedReceiverStream::new(receiver)))
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
        );
}
