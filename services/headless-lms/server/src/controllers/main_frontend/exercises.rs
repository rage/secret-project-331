//! Controllers for requests starting with `/api/v0/main-frontend/exercises`.

use futures::future;

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
GET `/api/v0/main-frontend/exercises/:exercise_id/submissions` - Returns an exercise's submissions.
 */
#[generated_doc]
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
#[generated_doc]
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
    );
}
