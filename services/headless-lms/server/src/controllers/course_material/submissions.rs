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
 */
#[cfg_attr(doc, doc = generated_docs!(SubmissionResult))]
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

#[derive(Debug, Clone, Serialize, TS)]
pub struct PreviousSubmission {
    pub submission: Submission,
    pub grading: Option<Grading>,
}

/**
GET `/api/v0/course-material/previous-for-exercise/:id` - Gets the previous submission for the given exercise.
*/
#[cfg_attr(doc, doc = generated_docs!(Option<PreviousSubmission>))]
#[instrument(skip(pool))]
async fn previous_submission(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Option<PreviousSubmission>>> {
    let mut conn = pool.acquire().await?;
    if let Some(submission) =
        submissions::get_latest_user_exercise_submission(&mut conn, user.id, *exercise_id).await?
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
