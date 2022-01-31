//! Controllers for requests starting with `/api/v0/course-material/submissions`.

use models::{exercise_task_submissions::ExerciseTaskSubmission, gradings::Grading};

use crate::controllers::prelude::*;

#[derive(Debug, Clone, Serialize, TS)]
pub struct PreviousSubmission {
    pub submission: ExerciseTaskSubmission,
    pub grading: Option<Grading>,
}

/**
GET `/api/v0/course-material/previous-for-exercise/:id` - Gets the previous submission for the given exercise.
*/
#[generated_doc]
#[instrument(skip(_pool))]
async fn previous_submission(
    _pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Option<PreviousSubmission>>> {
    // let mut conn = pool.acquire().await?;
    // TODO: Handle properly for multiple tasks
    Ok(web::Json(None))
    // if let Some(submission) =
    //     exercise_task_submissions::get_latest_exercise_task_submissions_for_exercise(
    //         &mut conn,
    //         &*exercise_id,
    //         &user.id,
    //     )
    //     .await?
    //     .and_then(|mut submissions| submissions.pop())
    // {
    //     let grading = if let Some(grading_id) = submission.grading_id {
    //         gradings::get_for_student(&mut conn, grading_id, user.id).await?
    //     } else {
    //         None
    //     };
    //     Ok(web::Json(Some(PreviousSubmission {
    //         submission,
    //         grading,
    //     })))
    // } else {
    //     Ok(web::Json(None))
    // }
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/previous-for-exercise/{exercise_id}",
        web::get().to(previous_submission),
    );
}
