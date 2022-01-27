use models::exercise_task_submissions::SubmissionInfo;

use crate::controllers::prelude::*;

/**
GET `/api/v0/main-frontend/submissions/{submission_id}/info"` - Returns data necessary for rendering a submission.
*/
#[generated_doc(SubmissionInfo)]
#[instrument(skip(pool))]
async fn get_submission_info(
    submission_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<SubmissionInfo>> {
    let mut conn = pool.acquire().await?;
    let (course_id, exam_id) =
        models::exercise_task_submissions::get_course_and_exam_id(&mut conn, *submission_id)
            .await?;
    if let Some(course_id) = course_id {
        authorize(&mut conn, Act::View, user.id, Res::Course(course_id)).await?;
    } else if let Some(exam_id) = exam_id {
        authorize(&mut conn, Act::View, user.id, Res::Exam(exam_id)).await?;
    } else {
        return Err(anyhow::anyhow!("Submission not associated with course or exam").into());
    }

    let slide_submission = models::exercise_slide_submissions::get_by_id(&mut conn, *submission_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Missing submission".to_string()))?;
    let task_submission = models::exercise_task_submissions::get_by_exercise_slide_submission_id(
        &mut conn,
        slide_submission.id,
    )
    .await?
    .pop()
    .ok_or_else(|| anyhow::anyhow!("Missing task"))?;
    let exercise = models::exercises::get_by_id(&mut conn, slide_submission.exercise_id).await?;
    let exercise_task = models::exercise_tasks::get_exercise_task_by_id(
        &mut conn,
        task_submission.exercise_task_id,
    )
    .await?;
    let grading = if let Some(id) = task_submission.grading_id {
        Some(models::gradings::get_by_id(&mut conn, id).await?)
    } else {
        None
    };
    let exercise_service_info = models::exercise_service_info::get_service_info_by_exercise_type(
        &mut conn,
        &exercise_task.exercise_type,
    )
    .await?;

    Ok(web::Json(SubmissionInfo {
        submission: task_submission,
        exercise,
        exercise_task,
        grading,
        iframe_path: exercise_service_info.exercise_type_specific_user_interface_iframe,
    }))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{submission_id}/info", web::get().to(get_submission_info));
}
