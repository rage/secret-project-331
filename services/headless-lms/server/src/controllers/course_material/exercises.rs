//! Controllers for requests starting with `/api/v0/course-material/exercises`.

use crate::{
    domain::{
        authorization::skip_authorize,
        models_requests::{self, GivePeerReviewClaim, JwtKey},
    },
    prelude::*,
};
use models::{
    exercise_task_submissions::PeerOrSelfReviewsReceived,
    exercises::CourseMaterialExercise,
    library::{
        grading::{StudentExerciseSlideSubmission, StudentExerciseSlideSubmissionResult},
        peer_or_self_reviewing::{
            CourseMaterialPeerOrSelfReviewData, CourseMaterialPeerOrSelfReviewSubmission,
        },
    },
    user_exercise_states,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialPeerOrSelfReviewDataWithToken {
    pub course_material_peer_or_self_review_data: CourseMaterialPeerOrSelfReviewData,
    pub token: Option<String>,
}

/**
GET `/api/v0/course-material/exercises/:exercise_id` - Get exercise by id. Includes
relevant context so that doing the exercise is possible based on the response.

This endpoint does not expose exercise's private spec because it would
expose the correct answers to the user.
*/
#[instrument(skip(pool))]
async fn get_exercise(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<CourseMaterialExercise>> {
    let mut conn = pool.acquire().await?;
    let user_id = user.map(|u| u.id);
    let mut course_material_exercise = models::exercises::get_course_material_exercise(
        &mut conn,
        user_id,
        *exercise_id,
        models_requests::fetch_service_info,
    )
    .await?;

    let mut should_clear_grading_information = true;
    // Check if teacher is testing an exam and wants to see the exercise answers
    if let Some(exam_id) = course_material_exercise.exercise.exam_id {
        let user_enrollment =
            models::exams::get_enrollment(&mut conn, exam_id, user_id.unwrap()).await?;

        if let Some(enrollment) = user_enrollment {
            if let Some(show_answers) = enrollment.show_exercise_answers {
                if enrollment.is_teacher_testing && show_answers {
                    should_clear_grading_information = false;
                }
            }
        }
    }

    if course_material_exercise.can_post_submission
        && course_material_exercise.exercise.exam_id.is_some()
        && should_clear_grading_information
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
    let token = skip_authorize();
    token.authorized_ok(web::Json(course_material_exercise))
}

/**
GET `/api/v0/course-material/exercises/:exercise_id/peer-review` - Get peer review for an exercise. This includes the submission to peer review and the questions the user is supposed to answer.ALTER

This request will fail if the user is not in the peer review stage yet because the information included in the peer review often exposes the correct solution to the exercise.
*/
#[instrument(skip(pool))]
async fn get_peer_review_for_exercise(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    user: AuthUser,
    jwt_key: web::Data<JwtKey>,
) -> ControllerResult<web::Json<CourseMaterialPeerOrSelfReviewDataWithToken>> {
    let mut conn = pool.acquire().await?;
    let course_material_peer_or_self_review_data =
        models::peer_or_self_review_configs::get_course_material_peer_or_self_review_data(
            &mut conn,
            user.id,
            *exercise_id,
            models_requests::fetch_service_info,
        )
        .await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Exercise(*exercise_id),
    )
    .await?;
    let give_peer_review_claim =
        if let Some(to_review) = &course_material_peer_or_self_review_data.answer_to_review {
            Some(
                GivePeerReviewClaim::expiring_in_1_day(
                    to_review.exercise_slide_submission_id,
                    course_material_peer_or_self_review_data
                        .peer_or_self_review_config
                        .id,
                )
                .sign(&jwt_key),
            )
        } else {
            None
        };

    let res = CourseMaterialPeerOrSelfReviewDataWithToken {
        course_material_peer_or_self_review_data,
        token: give_peer_review_claim,
    };
    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/course-material/exercises/:exercise_id/peer-review-received` - Get peer review recieved from other student for an exercise. This includes peer review submitted and the question asociated with it.
*/
#[instrument(skip(pool))]
async fn get_peer_reviews_received(
    pool: web::Data<PgPool>,
    params: web::Path<(Uuid, Uuid)>,
    user: AuthUser,
) -> ControllerResult<web::Json<PeerOrSelfReviewsReceived>> {
    let mut conn = pool.acquire().await?;
    let (exercise_id, exercise_slide_submission_id) = params.into_inner();
    let peer_review_data = models::exercise_task_submissions::get_peer_reviews_received(
        &mut conn,
        exercise_id,
        exercise_slide_submission_id,
        user.id,
    )
    .await?;
    let token = skip_authorize();
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
#[instrument(skip(pool))]
async fn post_submission(
    pool: web::Data<PgPool>,
    jwt_key: web::Data<JwtKey>,
    exercise_id: web::Path<Uuid>,
    payload: web::Json<StudentExerciseSlideSubmission>,
    user: AuthUser,
) -> ControllerResult<web::Json<StudentExerciseSlideSubmissionResult>> {
    let submission = payload.0;
    let mut conn = pool.acquire().await?;
    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Exercise(exercise.id),
    )
    .await?;
    let result = domain::exercises::process_submission(
        &mut conn,
        user.id,
        exercise,
        &submission,
        jwt_key.into_inner(),
    )
    .await;
    return match result {
        Ok(res) => token.authorized_ok(web::Json(res)),
        Err(err) => {
            // TODO: insert into failed submissions
            Err(err)
        }
    };
}

/**
 * POST `/api/v0/course-material/exercises/:exercise_id/peer-or-self-reviews/start` - Post a signal indicating that
 * the user will start the peer or self reviewing process.
 *
 * This operation is only valid for exercises marked for peer reviews. No further submissions will be
 * accepted after posting to this endpoint.
 */
#[instrument(skip(pool))]
async fn start_peer_or_self_review(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;

    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;
    let user_exercise_state =
        user_exercise_states::get_users_current_by_exercise(&mut conn, user.id, &exercise).await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Exercise(*exercise_id),
    )
    .await?;
    models::library::peer_or_self_reviewing::start_peer_or_self_review_for_user(
        &mut conn,
        user_exercise_state,
        &exercise,
    )
    .await?;

    token.authorized_ok(web::Json(true))
}

/**
 * POST `/api/v0/course-material/exercises/:exercise_id/peer-or-self-reviews - Post a peer review or a self review for an
 * exercise submission.
 */
#[instrument(skip(pool))]
async fn submit_peer_or_self_review(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    payload: web::Json<CourseMaterialPeerOrSelfReviewSubmission>,
    user: AuthUser,
    jwt_key: web::Data<JwtKey>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;
    // If the claim in the token validates, we can be sure that the user submitting this peer review got the peer review candidate from the backend.
    // The validation prevents users from chaging which answer they peer review.
    let claim = GivePeerReviewClaim::validate(&payload.token, &jwt_key)?;
    if claim.exercise_slide_submission_id != payload.exercise_slide_submission_id
        || claim.peer_or_self_review_config_id != payload.peer_or_self_review_config_id
    {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "You are not allowed to review this answer.".to_string(),
            None,
        ));
    }

    let giver_user_exercise_state =
        user_exercise_states::get_users_current_by_exercise(&mut conn, user.id, &exercise).await?;
    let exercise_slide_submission: models::exercise_slide_submissions::ExerciseSlideSubmission =
        models::exercise_slide_submissions::get_by_id(
            &mut conn,
            payload.exercise_slide_submission_id,
        )
        .await?;
    let receiver_user_exercise_state = user_exercise_states::get_users_current_by_exercise(
        &mut conn,
        exercise_slide_submission.user_id,
        &exercise,
    )
    .await?;
    models::library::peer_or_self_reviewing::create_peer_or_self_review_submission_for_user(
        &mut conn,
        &exercise,
        giver_user_exercise_state,
        receiver_user_exercise_state,
        payload.0,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(true))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{exercise_id}", web::get().to(get_exercise))
        .route(
            "/{exercise_id}/peer-or-self-reviews",
            web::post().to(submit_peer_or_self_review),
        )
        .route(
            "/{exercise_id}/peer-or-self-reviews/start",
            web::post().to(start_peer_or_self_review),
        )
        .route(
            "/{exercise_id}/peer-review",
            web::get().to(get_peer_review_for_exercise),
        )
        .route(
            "/{exercise_id}/exercise-slide-submission/{exercise_slide_submission_id}/peer-or-self-reviews-received",
            web::get().to(get_peer_reviews_received),
        )
        .route(
            "/{exercise_id}/submissions",
            web::post().to(post_submission),
        );
}
