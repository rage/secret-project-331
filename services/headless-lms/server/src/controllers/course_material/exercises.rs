//! Controllers for requests starting with `/api/v0/course-material/exercises`.

use std::collections::HashMap;

use chrono::{Duration, Utc};
use models::{
    exams,
    exercise_slide_submissions::NewExerciseSlideSubmission,
    exercise_task_submissions::SubmissionResult,
    exercise_tasks::ExerciseTask,
    exercises::{self, CourseMaterialExercise},
};
use serde_json::Value;

use crate::controllers::prelude::*;

/**
GET `/api/v0/course-material/exercises/:exercise_id` - Get exercise by id. Includes
relevant context so that doing the exercise is possible based on the response.

This endpoint does not expose exercise's private spec because it would
expose the correct answers to the user.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_exercise(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<CourseMaterialExercise>> {
    let mut conn = pool.acquire().await?;
    let user_id = user.map(|u| u.id);
    let exercise =
        models::exercises::get_course_material_exercise(&mut conn, user_id, *exercise_id).await?;
    Ok(web::Json(exercise))
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct ExerciseTaskAnswer {
    exercise_task_id: Uuid,
    data_json: Value,
}

/**
POST `/api/v0/course-material/exercises/:exercise_id/submissions` - Post new submission for an
exercise.

# Example
```http
POST /api/v0/course-material/exercises/:exercise_id/submissions HTTP/1.1
Content-Type: application/json

[
  {
      "exercise_task_id": "0125c21b-6afa-4652-89f7-56c48bd8ffe4",
      "data_json": { "selectedOptionId": "8f09e9a0-ac20-486a-ba29-704e7eeaf6af" }
  }
]
```
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn post_submission(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    payload: web::Json<Vec<ExerciseTaskAnswer>>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<SubmissionResult>>> {
    let mut conn = pool.acquire().await?;

    // Check exercise details
    let exercise = exercises::get_by_id(&mut conn, *exercise_id).await?;
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

    let course_instance_id = if let Some(course_id) = exercise.course_id {
        let user_course_settings =
            models::user_course_settings::get_user_course_settings_by_course_id(
                &mut conn, user.id, course_id,
            )
            .await?
            .ok_or_else(|| anyhow::anyhow!("No course settings"))?;
        Some(user_course_settings.current_course_instance_id)
    } else {
        None
    };
    // Check that user is answering to correct tasks
    let user_exercise_state = models::user_exercise_states::get_user_exercise_state_if_exits(
        &mut conn,
        user.id,
        exercise.id,
        course_instance_id,
        exercise.exam_id,
    )
    .await?
    .ok_or_else(|| ControllerError::NotFound("Missing exercise state.".to_string()))?;
    let selected_exercise_slide_id = user_exercise_state
        .selected_exercise_slide_id
        .ok_or_else(|| ControllerError::NotFound("Exercise slide not selected.".to_string()))?;
    let exercise_tasks: HashMap<Uuid, ExerciseTask> =
        models::exercise_tasks::get_exercise_tasks_by_exercise_slide_id(
            &mut conn,
            selected_exercise_slide_id,
        )
        .await?
        .into_iter()
        .map(|task| (task.id, task))
        .collect();

    let task_submissions = payload.0;
    let mut results = Vec::with_capacity(task_submissions.len());

    let mut tx = conn.begin().await?;
    let exercise_slide_submission =
        models::exercise_slide_submissions::insert_exercise_slide_submission(
            &mut tx,
            NewExerciseSlideSubmission {
                course_id: exercise.course_id,
                course_instance_id: user_exercise_state.course_instance_id,
                exam_id: exercise.exam_id,
                exercise_id: exercise.id,
                user_id: user.id,
            },
        )
        .await?;
    for answer in task_submissions.into_iter() {
        let exercise_task = exercise_tasks
            .get(&answer.exercise_task_id)
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "Attempting to submit exercise for illegal exercise_task_id.".to_string()
                )
            })?;
        let submission = models::exercise_task_submissions::insert_submission(
            &mut tx,
            &exercise,
            exercise_task,
            exercise_slide_submission.id,
            answer.data_json,
        )
        .await?;
        results.push(submission)
    }

    tx.commit().await?;
    Ok(web::Json(results))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{exercise_id}", web::get().to(get_exercise))
        .route(
            "/{exercise_id}/submissions",
            web::post().to(post_submission),
        );
}
