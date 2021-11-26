use actix_web::web::{self, Json, ServiceConfig};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    controllers::ControllerResult,
    domain::authorization::{authorize, Action, AuthUser, Resource},
    models::{self, submissions::SubmissionInfo},
};

/**
GET `/api/v0/main-frontend/submissions/{submission_id}/info"` - Returns data necessary for rendering a submission.
*/
#[instrument(skip(pool))]
async fn get_submission_info(
    submission_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<Json<SubmissionInfo>> {
    let mut conn = pool.acquire().await?;
    let (course_id, exam_id) =
        crate::models::submissions::get_course_and_exam_id(&mut conn, *submission_id).await?;
    if let Some(course_id) = course_id {
        authorize(
            &mut conn,
            Action::View,
            user.id,
            Resource::Course(course_id),
        )
        .await?;
    } else if let Some(exam_id) = exam_id {
        authorize(&mut conn, Action::View, user.id, Resource::Exam(exam_id)).await?;
    } else {
        return Err(anyhow::anyhow!("Submission not associated with course or exam").into());
    }

    let submission = models::submissions::get_by_id(&mut conn, *submission_id).await?;
    let exercise = models::exercises::get_by_id(&mut conn, submission.exercise_id).await?;
    let exercise_task =
        models::exercise_tasks::get_exercise_task_by_id(&mut conn, submission.exercise_task_id)
            .await?;
    let grading = if let Some(id) = submission.grading_id {
        Some(models::gradings::get_by_id(&mut conn, id).await?)
    } else {
        None
    };
    let exercise_service_info = models::exercise_service_info::get_service_info_by_exercise_type(
        &mut conn,
        &exercise_task.exercise_type,
    )
    .await?;

    Ok(Json(SubmissionInfo {
        submission,
        exercise,
        exercise_task,
        grading,
        submission_iframe_path: exercise_service_info.submission_iframe_path,
    }))
}

pub fn _add_submissions_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{submission_id}/info", web::get().to(get_submission_info));
}
