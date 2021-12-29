//! Controllers for requests starting with `/api/v0/course-material/submissions`.

use chrono::{Duration, Utc};
use models::{
    exams,
    gradings::{self, Grading},
    submissions::{self, NewSubmission, Submission, SubmissionResult},
};

use crate::controllers::prelude::*;

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
) -> ControllerResult<web::Json<SubmissionResult>> {
    let mut conn = pool.acquire().await?;

    let exercise_task_id = payload.0.exercise_task_id;
    let exercise_slide = models::exercise_slides::get_exercise_slide_by_exercise_task_id(
        &mut conn,
        exercise_task_id,
    )
    .await?
    .ok_or_else(|| ControllerError::NotFound("Exercise definition not found.".to_string()))?;
    let exercise = models::exercises::get_by_id(&mut conn, exercise_slide.exercise_id).await?;

    if let Some(exam_id) = exercise.exam_id.as_ref().copied() {
        // check if the submission is still valid for the exam
        let exam = exams::get(&mut conn, exam_id).await?;
        let enrollment = exams::get_enrollment(&mut conn, exam_id, user.id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("User has no enrollment for the exam"))?;
        let student_time_is_up =
            Utc::now() > enrollment.started_at + Duration::minutes(exam.time_minutes.into());
        let exam_is_over = exam.ends_at.map(|ea| Utc::now() > ea).unwrap_or_default();
        if student_time_is_up || exam_is_over {
            return Err(anyhow::anyhow!("Cannot submit for this exam anymore").into());
        }
    }

    let mut submission =
        models::submissions::insert_submission(&mut conn, &payload.0, user.id, &exercise).await?;
    if exercise.exam_id.is_some() {
        // remove grading information from submission
        submission.grading = None;
        submission.model_solution_spec = None;
        submission.submission.grading_id = None;
    }
    Ok(web::Json(submission))
}

#[derive(Debug, Serialize, TS)]
pub struct PreviousSubmission {
    pub submission: Submission,
    pub grading: Option<Grading>,
}

async fn previous_submission(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Option<PreviousSubmission>>> {
    let mut conn = pool.acquire().await?;
    if let Some(submission) = submissions::get_latest_user_exercise_submission(
        &mut conn,
        user.id,
        exercise_id.into_inner(),
    )
    .await?
    {
        let grading = if let Some(grading_id) = submission.grading_id {
            gradings::get_for_student(&mut conn, grading_id, user.id).await?
        } else {
            None
        };
        Ok(web::Json(Some(PreviousSubmission {
            submission,
            grading,
        })))
    } else {
        Ok(web::Json(None))
    }
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(post_submission)).route(
        "/previous-for-exercise/{exercise_id}",
        web::get().to(previous_submission),
    );
}
