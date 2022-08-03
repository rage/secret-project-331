//! Controllers for requests starting with `/api/v0/course-material/exercises`.

use futures::future::OptionFuture;
use models::{
    exercise_slide_submissions::get_exercise_slide_submission_counts_for_exercise_user,
    exercise_task_submissions::PeerReviewsRecieved,
    exercises::{CourseMaterialExercise, Exercise},
    library::{
        grading::{
            GradingPolicy, StudentExerciseSlideSubmission, StudentExerciseSlideSubmissionResult,
        },
        peer_reviewing::{CourseMaterialPeerReviewData, CourseMaterialPeerReviewSubmission},
    },
    user_exercise_states::{self, CourseInstanceOrExamId, ExerciseWithUserState},
};

use chrono::{Duration, Utc};

use crate::{controllers::prelude::*, domain::authorization::skip_authorize};

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
    let mut course_material_exercise =
        models::exercises::get_course_material_exercise(&mut conn, user_id, *exercise_id).await?;
    if course_material_exercise.can_post_submission
        && course_material_exercise.exercise.exam_id.is_some()
    {
        // Explicitely clear grading information from ongoing exam submissions.
        course_material_exercise.clear_grading_information();
    }

    let score_given: f32 = if let Some(status) = &course_material_exercise.exercise_status {
        status.score_given.unwrap_or(0.0)
    } else {
        0.0
    };

    let submission_count = course_material_exercise
        .exercise_slide_submission_counts
        .get(&course_material_exercise.current_exercise_slide.id)
        .unwrap_or(&0);

    let out_of_tries = course_material_exercise.exercise.limit_number_of_tries
        && *submission_count as i32
            >= course_material_exercise
                .exercise
                .max_tries_per_slide
                .unwrap_or(i32::MAX);

    // Model solution spec should only be shown when this is the last try for the current slide or they have gotten full points from the current slide.
    // TODO: this uses points for the whole exercise, change this to slide points when slide grading finalized
    let has_received_full_points = score_given
        >= course_material_exercise.exercise.score_maximum as f32
        || (score_given - course_material_exercise.exercise.score_maximum as f32).abs() < 0.0001;
    if !has_received_full_points && !out_of_tries {
        course_material_exercise.clear_model_solution_specs();
    }
    let token = skip_authorize()?;
    token.authorized_ok(web::Json(course_material_exercise))
}

/**
GET `/api/v0/course-material/exercises/:exercise_id/peer-review` - Get peer review for an exercise. This includes the submission to peer review and the questions the user is supposed to answer.ALTER

This request will fail if the user is not in the peer review stage yet because the information included in the peer review often exposes the correct solution to the exercise.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_peer_review_for_exercise(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseMaterialPeerReviewData>> {
    let mut conn = pool.acquire().await?;
    let peer_review_data = models::peer_reviews::get_course_material_peer_review_data(
        &mut conn,
        user.id,
        *exercise_id,
    )
    .await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Exercise(*exercise_id),
    )
    .await?;
    token.authorized_ok(web::Json(peer_review_data))
}

/**
GET `/api/v0/course-material/exercises/:exercise_id/peer-review-given` - Get peer review given for an exercise. This includes peer review submitted and the question asociated with it.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_peer_reviews_given(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<PeerReviewsRecieved>> {
    let mut conn = pool.acquire().await?;
    let peer_review_data = models::exercise_task_submissions::get_peer_reviews_received(
        &mut conn,
        *exercise_id,
        user.id,
    )
    .await?;
    let token = skip_authorize()?;
    token.authorized_ok(web::Json(peer_review_data))
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
    let token = skip_authorize()?;
    let chapter_option_future: OptionFuture<_> = exercise
        .chapter_id
        .map(|id| models::chapters::get_chapter(&mut conn, id))
        .into();

    let chapter = chapter_option_future.await.transpose()?;

    // Exercise deadlines takes precedence to chapter deadlines
    if let Some(deadline) = exercise
        .deadline
        .or_else(|| chapter.and_then(|c| c.deadline))
    {
        if Utc::now() + Duration::seconds(1) >= deadline {
            return Err(ControllerError::BadRequest(
                "exercise deadline passed".to_string(),
            ));
        }
    }

    let (course_instance_or_exam_id, last_try) =
        resolve_course_instance_or_exam_id_and_verify_that_user_can_submit(
            &mut conn,
            user.id,
            &exercise,
            payload.exercise_slide_id,
        )
        .await?
        .data;

    // TODO: Should this be an upsert?
    let user_exercise_state = models::user_exercise_states::get_user_exercise_state_if_exists(
        &mut conn,
        user.id,
        exercise.id,
        course_instance_or_exam_id,
    )
    .await?
    .ok_or_else(|| ControllerError::Unauthorized("Missing exercise state.".to_string()))?;
    let mut exercise_with_user_state = ExerciseWithUserState::new(exercise, user_exercise_state)?;
    let mut result = models::library::grading::grade_user_submission(
        &mut conn,
        &mut exercise_with_user_state,
        payload.0,
        GradingPolicy::Default,
    )
    .await?;

    if exercise_with_user_state.is_exam_exercise() {
        // If exam, we don't want to expose model any grading details.
        result.clear_grading_information();
    }

    let score_given = if let Some(exercise_status) = &result.exercise_status {
        exercise_status.score_given.unwrap_or(0.0)
    } else {
        0.0
    };

    // Model solution spec should only be shown when this is the last try for the current slide or they have gotten full points from the current slide.
    // TODO: this uses points for the whole exercise, change this to slide points when slide grading finalized
    let has_received_full_points = score_given
        >= exercise_with_user_state.exercise().score_maximum as f32
        || (score_given - exercise_with_user_state.exercise().score_maximum as f32).abs() < 0.0001;
    if !has_received_full_points && !last_try {
        result.clear_model_solution_specs();
    }
    token.authorized_ok(web::Json(result))
}

/**
 * POST `/api/v0/course-material/exercises/:exercise_id/peer-reviews/start` - Post a signal indicating that
 * the user will start peer reviewing process.
 *
 * This operation is only valid for exercises marked for peer reviews. No further submissions will be
 * accepted after posting to this endpoint.
 */
#[generated_doc]
#[instrument(skip(pool))]
async fn start_peer_review(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    // Authorization

    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;
    let user_exercise_state =
        user_exercise_states::get_users_current_by_exercise(&mut conn, user.id, &exercise).await?;
    models::library::peer_reviewing::start_peer_review_for_user(&mut conn, user_exercise_state)
        .await?;

    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Exercise(*exercise_id),
    )
    .await?;
    token.authorized_ok(web::Json(true))
}

/**
 * POST `/api/v0/course-material/exercises/:exercise_id/peer-reviews - Post a peer review for an
 * exercise submission.
 */
#[generated_doc]
#[instrument(skip(pool))]
async fn submit_peer_review(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    payload: web::Json<CourseMaterialPeerReviewSubmission>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;
    // Authorization

    let user_exercise_state =
        user_exercise_states::get_users_current_by_exercise(&mut conn, user.id, &exercise).await?;
    models::library::peer_reviewing::create_peer_review_submission_for_user(
        &mut conn,
        &exercise,
        user_exercise_state,
        payload.0,
    )
    .await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Exercise(exercise.id),
    )
    .await?;
    token.authorized_ok(web::Json(true))
}

/// Submissions for exams are posted from course instances or from exams. Make respective validations
/// while figuring out which.
async fn resolve_course_instance_or_exam_id_and_verify_that_user_can_submit(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise: &Exercise,
    slide_id: Uuid,
) -> ControllerResult<(CourseInstanceOrExamId, bool)> {
    let mut last_try = false;
    let course_instance_id_or_exam_id: CourseInstanceOrExamId = if let Some(course_id) =
        exercise.course_id
    {
        // If submitting for a course, there should be existing course settings that dictate which
        // instance the user is on.
        let settings = models::user_course_settings::get_user_course_settings_by_course_id(
            conn, user_id, course_id,
        )
        .await?;
        if let Some(settings) = settings {
            let token = authorize(conn, Act::View, Some(user_id), Res::Course(course_id)).await?;
            token.authorized_ok(CourseInstanceOrExamId::Instance(
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
            let token = authorize(conn, Act::View, Some(user_id), Res::Exam(exam_id)).await?;
            token.authorized_ok(CourseInstanceOrExamId::Exam(exam_id))
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
    }?
    .data;
    if exercise.limit_number_of_tries {
        if let Some(max_tries_per_slide) = exercise.max_tries_per_slide {
            // check if the user has attempts remaining
            let slide_id_to_submissions_count =
                get_exercise_slide_submission_counts_for_exercise_user(
                    conn,
                    exercise.id,
                    course_instance_id_or_exam_id,
                    user_id,
                )
                .await?;

            let count = slide_id_to_submissions_count.get(&slide_id).unwrap_or(&0);
            if count >= &(max_tries_per_slide as i64) {
                return Err(ControllerError::BadRequest(
                    "You've ran out of tries.".to_string(),
                ));
            }
            if count + 1 >= (max_tries_per_slide as i64) {
                last_try = true;
            }
        }
    }
    let token = authorize(conn, Act::View, Some(user_id), Res::Exercise(exercise.id)).await?;
    token.authorized_ok((course_instance_id_or_exam_id, last_try))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{exercise_id}", web::get().to(get_exercise))
        .route(
            "/{exercise_id}/peer-reviews",
            web::post().to(submit_peer_review),
        )
        .route(
            "/{exercise_id}/peer-reviews/start",
            web::post().to(start_peer_review),
        )
        .route(
            "/{exercise_id}/peer-review",
            web::get().to(get_peer_review_for_exercise),
        )
        .route(
            "/{exercise_id}/peer-reviews-given",
            web::get().to(get_peer_reviews_given),
        )
        .route(
            "/{exercise_id}/submissions",
            web::post().to(post_submission),
        );
}
