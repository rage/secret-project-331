use models::exercise_task_gradings::ExerciseTaskGradingResult;

use crate::{domain::models_requests::GradingUpdateClaim, prelude::*};

/**
POST `/api/v0/exercise-services/grading/grading-update/:submission_id`

Receives a grading update from an exercise service.
*/
#[instrument(skip(pool))]
async fn grading_update(
    submission_id: web::Path<Uuid>,
    grading_result: web::Json<ExerciseTaskGradingResult>,
    grading_update_claim: GradingUpdateClaim,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<()>> {
    // accessed from exercise services, can't authenticate using login,
    // the upload claim is used to verify requests instead
    let token = skip_authorize();
    let grading_result = grading_result.into_inner();

    // Ensure that the claim is valid for this specific submission
    if *submission_id != grading_update_claim.submission_id() {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Grading upload claim didn't match the submission id".to_string(),
            None,
        ));
    }

    let mut conn = pool.acquire().await?;

    // Add new grading
    let submission =
        models::exercise_task_submissions::get_submission(&mut conn, *submission_id).await?;
    let slide =
        models::exercise_slides::get_exercise_slide(&mut conn, submission.exercise_slide_id)
            .await?;
    let grading = models::exercise_task_gradings::get_by_exercise_task_submission_id(
        &mut conn,
        *submission_id,
    )
    .await?
    .ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::BadRequest,
            "No existing grading for the submission found".to_string(),
            None,
        )
    })?;
    let exercise = models::exercises::get_by_id(&mut conn, slide.exercise_id).await?;
    models::exercise_task_gradings::update_grading(&mut conn, &grading, &grading_result, &exercise)
        .await?;

    token.authorized_ok(web::Json(()))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
#[doc(hidden)]
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "grading-update/{submission_id}",
        web::post().to(grading_update),
    );
}
