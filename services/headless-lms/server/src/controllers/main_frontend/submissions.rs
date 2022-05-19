use crate::controllers::prelude::*;
use headless_lms_models::exercise_slide_submissions::ExerciseSlideSubmissionInfo;

/**
GET `/api/v0/main-frontend/submissions/{submission_id}/info"` - Returns data necessary for rendering a submission.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_submission_info(
    submission_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ExerciseSlideSubmissionInfo>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::ExerciseSlideSubmission(*submission_id),
    )
    .await?;

    let res = models::exercise_slide_submissions::get_exercise_slide_submission_info(
        &mut conn,
        submission_id.into_inner(),
    )
    .await?;
    let grading = if let Some(id) = task_submission.exercise_task_grading_id {
        Some(models::exercise_task_gradings::get_by_id(&mut conn, id).await?)
    } else {
        None
    };
    let exercise_service_info = models::exercise_service_info::get_service_info_by_exercise_type(
        &mut conn,
        &exercise_task.exercise_type,
    )
    .await?;

    token.0.ok(web::Json(res))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{submission_id}/info", web::get().to(get_submission_info));
}
