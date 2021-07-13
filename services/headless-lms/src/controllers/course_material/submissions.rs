//! Controllers for requests starting with `/api/v0/course-material/submissions`.

use crate::{
    controllers::ControllerResult,
    domain::authorization::AuthUser,
    models::submissions::{NewSubmission, SubmissionResult},
};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;

/**
POST `/api/v0/course-material/submissions` - Post a new submission.

# Example
```http
POST http://project-331.local/api/v0/course-material/submissions HTTP/1.1
Content-Type: application/json

{
  "exercise_task_id": "0125c21b-6afa-4652-89f7-56c48bd8ffe4",
  "course_instance_id": "25800692-0d99-4f29-b741-92d69b0900b9",
  "data_json": { "selectedOptionId": "8f09e9a0-ac20-486a-ba29-704e7eeaf6af" }
}
```

Response:

```json
{
  "submission": {
    "id": "e5c53d36-cb0a-4df4-8571-17a13d36f488",
    "created_at": "2021-06-10T15:28:16.793335Z",
    "updated_at": "2021-06-10T15:28:16.845037Z",
    "deleted_at": null,
    "exercise_id": "34e47a8e-d573-43be-8f23-79128cbb29b8",
    "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
    "course_instance_id": "25800692-0d99-4f29-b741-92d69b0900b9",
    "exercise_task_id": "0125c21b-6afa-4652-89f7-56c48bd8ffe4",
    "data_json": {
      "selectedOptionId": "8f09e9a0-ac20-486a-ba29-704e7eeaf6af"
    },
    "grading_id": "6bd767fb-97ce-47d6-8e34-b105cf1e035b",
    "metadata": null,
    "user_id": "0278dd58-30b9-4037-bba9-d1b9bb5f1d66"
  },
  "grading": {
    "id": "6bd767fb-97ce-47d6-8e34-b105cf1e035b",
    "created_at": "2021-06-10T15:28:16.829438Z",
    "updated_at": "2021-06-10T15:28:17.165327Z",
    "submission_id": "e5c53d36-cb0a-4df4-8571-17a13d36f488",
    "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
    "exercise_id": "34e47a8e-d573-43be-8f23-79128cbb29b8",
    "exercise_task_id": "0125c21b-6afa-4652-89f7-56c48bd8ffe4",
    "grading_priority": 100,
    "score_given": 1.0,
    "grading_progress": "FullyGraded",
    "user_points_update_strategy": "CanAddPointsButCannotRemovePoints",
    "unscaled_score_maximum": 1.0,
    "unscaled_max_points": 1,
    "grading_started_at": "2021-06-10T15:28:16.829438Z",
    "grading_completed_at": "2021-06-10T15:28:17.147231Z",
    "feedback_json": null,
    "feedback_text": "Good job!",
    "deleted_at": null
  }
}
```
 */
#[instrument(skip(pool))]
async fn post_submission(
    pool: web::Data<PgPool>,
    payload: web::Json<NewSubmission>,
    user: AuthUser,
) -> ControllerResult<Json<SubmissionResult>> {
    let mut conn = pool.acquire().await?;
    let exercise_task_id = payload.0.exercise_task_id;
    let exercise_task =
        crate::models::exercise_tasks::get_exercise_task_by_id(&mut conn, exercise_task_id).await?;
    let exercise =
        crate::models::exercises::get_exercise_by_id(&mut conn, exercise_task.exercise_id).await?;
    let submission =
        crate::models::submissions::insert_submission(&mut conn, payload.0, user.id, exercise)
            .await?;
    Ok(Json(submission))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_submissions_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(post_submission));
}
