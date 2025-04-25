//! Controllers for requests starting with `/api/v0/main-frontend/exercises`.

use futures::future;

use headless_lms_models::exercises::Exercise;
use models::{
    exercise_slide_submissions::ExerciseSlideSubmission,
    library::grading::AnswersRequiringAttention, CourseOrExamId,
};

use crate::{domain::models_requests, prelude::*};

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseSubmissions {
    pub data: Vec<ExerciseSlideSubmission>,
    pub total_pages: u32,
}

/**
GET `/api/v0/main-frontend/exercises/:exercise_id` - Returns a single exercise.
 */
#[instrument(skip(pool))]
async fn get_exercise(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Exercise>> {
    let mut conn = pool.acquire().await?;

    let exercise = models::exercises::get_by_id(&mut conn, *exercise_id).await?;

    let token = if let Some(course_id) = exercise.course_id {
        authorize(&mut conn, Act::View, Some(user.id), Res::Course(course_id)).await?
    } else if let Some(exam_id) = exercise.exam_id {
        authorize(&mut conn, Act::View, Some(user.id), Res::Exam(exam_id)).await?
    } else {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Exercise is not associated with a course or exam".to_string(),
            None,
        ));
    };

    token.authorized_ok(web::Json(exercise))
}

/**
GET `/api/v0/main-frontend/exercises/:exercise_id/submissions` - Returns an exercise's submissions.
 */
#[instrument(skip(pool))]
async fn get_exercise_submissions(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    pagination: web::Query<Pagination>,
    user: AuthUser,
) -> ControllerResult<web::Json<ExerciseSubmissions>> {
    let mut conn = pool.acquire().await?;

    let token = match models::exercises::get_course_or_exam_id(&mut conn, *exercise_id).await? {
        CourseOrExamId::Course(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(id)).await?
        }
        CourseOrExamId::Exam(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(id)).await?
        }
    };

    let submission_count = models::exercise_slide_submissions::exercise_slide_submission_count(
        &mut conn,
        *exercise_id,
    );
    let mut conn = pool.acquire().await?;
    let submissions = models::exercise_slide_submissions::exercise_slide_submissions(
        &mut conn,
        *exercise_id,
        *pagination,
    );
    let (submission_count, submissions) = future::try_join(submission_count, submissions).await?;

    let total_pages = pagination.total_pages(submission_count);

    token.authorized_ok(web::Json(ExerciseSubmissions {
        data: submissions,
        total_pages,
    }))
}

/**
GET `/api/v0/main-frontend/exercises/:exercise_id/answers-requiring-attention` - Returns an exercise's answers requiring attention.
 */
#[instrument(skip(pool))]
async fn get_exercise_answers_requiring_attention(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    pagination: web::Query<Pagination>,
    user: AuthUser,
) -> ControllerResult<web::Json<AnswersRequiringAttention>> {
    let mut conn = pool.acquire().await?;
    let token = match models::exercises::get_course_or_exam_id(&mut conn, *exercise_id).await? {
        CourseOrExamId::Course(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(id)).await?
        }
        CourseOrExamId::Exam(id) => {
            authorize(&mut conn, Act::Teach, Some(user.id), Res::Exam(id)).await?
        }
    };
    let res = models::library::grading::get_paginated_answers_requiring_attention_for_exercise(
        &mut conn,
        *exercise_id,
        *pagination,
        user.id,
        models_requests::fetch_service_info,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/exercises/:course_id/exercises-by-course-id` - Returns all exercises for a course with course_id
 */
pub async fn get_exercises_by_course_id(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<Exercise>>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let mut exercises =
        models::exercises::get_exercises_by_course_id(&mut conn, *course_id).await?;

    exercises.sort_by_key(|e| (e.chapter_id, e.page_id, e.order_number));

    token.authorized_ok(web::Json(exercises))
}

#[derive(Deserialize)]
pub struct ResetExercisesPayload {
    pub user_ids: Vec<Uuid>,
    pub exercise_ids: Vec<Uuid>,
    pub threshold: Option<f64>,
    pub reset_all_below_max_points: bool,
    pub reset_only_locked_peer_reviews: bool,
}

/**
POST `/api/v0/main-frontend/exercises/:course_id/reset-exercises-for-selected-users` - Resets all selected exercises for selected users and then logs the resets to exercise_reset_logs table
 */
pub async fn reset_exercises_for_selected_users(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<ResetExercisesPayload>,
) -> ControllerResult<web::Json<i32>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    // Gets all valid users and their related exercises using the given filters
    let users_and_exercises = models::exercises::collect_user_ids_and_exercise_ids_for_reset(
        &mut conn,
        &payload.user_ids,
        &payload.exercise_ids,
        payload.threshold,
        payload.reset_all_below_max_points,
        payload.reset_only_locked_peer_reviews,
    )
    .await?;

    // Resets exercises for selected users and add the resets to a log
    let reset_results = models::exercises::reset_exercises_for_selected_users(
        &mut conn,
        &users_and_exercises,
        user.id,
        *course_id,
    )
    .await?;

    let successful_resets_count = reset_results.len();

    token.authorized_ok(web::Json(successful_resets_count as i32))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{exercise_id}/submissions",
        web::get().to(get_exercise_submissions),
    )
    .route(
        "/{exercise_id}/answers-requiring-attention",
        web::get().to(get_exercise_answers_requiring_attention),
    )
    .route(
        "/{course_id}/exercises-by-course-id",
        web::get().to(get_exercises_by_course_id),
    )
    .route(
        "/{course_id}/reset-exercises-for-selected-users",
        web::post().to(reset_exercises_for_selected_users),
    );
    cfg.route("/{exercise_id}", web::get().to(get_exercise))
        .route(
            "/{exercise_id}/submissions",
            web::get().to(get_exercise_submissions),
        )
        .route(
            "/{exercise_id}/answers-requiring-attention",
            web::get().to(get_exercise_answers_requiring_attention),
        );
}
