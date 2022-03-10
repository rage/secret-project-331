//! Controllers for requests starting with `/api/v0/course-material/exercises`.

use models::{
    exercises::{CourseMaterialExercise, Exercise},
    library::grading::{StudentExerciseSlideSubmission, StudentExerciseSlideSubmissionResult},
    user_exercise_states::CourseInstanceOrExamId,
};

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
    let mut exercise =
        models::exercises::get_course_material_exercise(&mut conn, user_id, *exercise_id).await?;
    if exercise.can_post_submission && exercise.exercise.exam_id.is_some() {
        // Explicitely clear grading information from ongoing exam submissions.
        exercise.clear_grading_information();
    }
    Ok(web::Json(exercise))
}

/**
POST `/api/v0/course-material/exercises/:exercise_id/submissions` - Post new submission for an
exercise.

# Example
```http
POST /api/v0/course-material/exercises/:exercise_id/submissions HTTP/1.1
Content-Type: application/json

{
  "exercise_slide_id": "0125c21b-6afa-4652-89f7-56c48bd8ffe4",
  "exercise_task_answers": [
    {
      "exercise_task_id": "0125c21b-6afa-4652-89f7-56c48bd8ffe4",
      "data_json": { "selectedOptionId": "8f09e9a0-ac20-486a-ba29-704e7eeaf6af" }
    }
  ]
}
```
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn post_submission(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    payload: web::Json<StudentExerciseSlideSubmission>,
    user: AuthUser,
) -> ControllerResult<web::Json<StudentExerciseSlideSubmissionResult>> {
    let mut conn = pool.acquire().await?;
    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;

    let course_instance_or_exam_id =
        resolve_course_instance_or_exam_id_and_verify_that_user_can_submit(
            &mut conn, user.id, &exercise,
        )
        .await?;
    let user_exercise_state = models::user_exercise_states::get_user_exercise_state_if_exists(
        &mut conn,
        user.id,
        exercise.id,
        course_instance_or_exam_id,
    )
    .await?
    .ok_or_else(|| ControllerError::Unauthorized("Missing exercise state.".to_string()))?;

    let mut result = models::library::grading::grade_user_submission(
        &mut conn,
        &exercise,
        &user_exercise_state,
        payload.0,
    )
    .await?;
    if exercise.exam_id.is_some() {
        // If exam, we don't want to expose model any grading details.
        result.clear_grading_information();
    }
    Ok(web::Json(result))
}

/// Submissions for exams are posted from course instances or from exams. Make respective validations
/// while figuring out which.
async fn resolve_course_instance_or_exam_id_and_verify_that_user_can_submit(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise: &Exercise,
) -> ControllerResult<CourseInstanceOrExamId> {
    if let Some(course_id) = exercise.course_id {
        // If submitting for a course, there should be existing course settings that dictate which
        // instance the user is on.
        let settings = models::user_course_settings::get_user_course_settings_by_course_id(
            conn, user_id, course_id,
        )
        .await?;
        if let Some(settings) = settings {
            Ok(CourseInstanceOrExamId::Instance(
                settings.current_course_instance_id,
            ))
        } else {
            Err(ControllerError::Unauthorized(
                "User is not enrolled on this course.".to_string(),
            ))
        }
    } else if let Some(exam_id) = exercise.exam_id {
        // If submitting for an exam, make sure that user's time is not up.
        if models::exams::verify_exam_submission_can_be_made(conn, exam_id, user_id).await? {
            Ok(CourseInstanceOrExamId::Exam(exam_id))
        } else {
            Err(ControllerError::Unauthorized(
                "Submissions for this exam are no longer accepted.".to_string(),
            ))
        }
    } else {
        // On database level this scenario is impossible.
        Err(ControllerError::InternalServerError(
            "Exam doesn't belong to either a course nor exam.".to_string(),
        ))
    }
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
