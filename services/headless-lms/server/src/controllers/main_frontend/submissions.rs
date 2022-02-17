use models::submissions::SubmissionInfo;

use crate::controllers::prelude::*;

/**
GET `/api/v0/main-frontend/submissions/{submission_id}/info"` - Returns data necessary for rendering a submission.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_submission_info(
    submission_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<SubmissionInfo>> {
    let mut conn = pool.acquire().await?;
    authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Submission(*submission_id),
    )
    .await?;

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

    Ok(web::Json(SubmissionInfo {
        submission,
        exercise,
        exercise_task,
        grading,
        iframe_path: exercise_service_info.exercise_type_specific_user_interface_iframe,
    }))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{submission_id}/info", web::get().to(get_submission_info));
}
