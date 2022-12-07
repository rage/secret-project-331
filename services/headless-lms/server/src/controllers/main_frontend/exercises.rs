//! Controllers for requests starting with `/api/v0/main-frontend/exercises`.

use chrono::{DateTime, Utc};
use futures::future;

use models::{
    exercise_slide_submissions::{get_all_answers_requiring_attention, ExerciseSlideSubmission},
    exercise_task_submissions::get_exercise_task_submission_info_by_exercise_slide_submission_id,
    exercise_tasks::CourseMaterialExerciseTask,
    exercises::{get_exercise_by_id, GradingProgress},
    CourseOrExamId,
};

use crate::{domain::models_requests, prelude::*};

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseSubmissions {
    pub data: Vec<ExerciseSlideSubmission>,
    pub total_pages: u32,
}
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct AnswersRequiringAttention {
    pub exercise_max_points: i32,
    pub data: Vec<AnswerRequiringAttentionWithTasks>,
    pub total_pages: u32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct AnswerRequiringAttentionWithTasks {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub data_json: Option<serde_json::Value>,
    pub grading_progress: GradingProgress,
    pub score_given: Option<f32>,
    pub submission_id: Uuid,
    pub exercise_id: Uuid,
    pub tasks: Vec<CourseMaterialExerciseTask>,
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
    let exercise = get_exercise_by_id(&mut conn, *exercise_id).await?;
    let answer_requiring_attention_count =
        models::exercise_slide_submissions::answer_requiring_attention_count(
            &mut conn,
            *exercise_id,
        )
        .await?;
    let mut conn = pool.acquire().await?;
    let data = get_all_answers_requiring_attention(&mut conn, exercise.id, *pagination).await?;
    let mut answers = Vec::with_capacity(data.len());

    for answer in &data {
        let tasks = get_exercise_task_submission_info_by_exercise_slide_submission_id(
            &mut conn,
            answer.submission_id,
            user.id,
            models_requests::fetch_service_info,
        )
        .await?;
        let new_answer = AnswerRequiringAttentionWithTasks {
            id: answer.id,
            user_id: answer.user_id,
            created_at: answer.created_at,
            updated_at: answer.updated_at,
            deleted_at: answer.deleted_at,
            data_json: answer.data_json.to_owned(),
            grading_progress: answer.grading_progress,
            score_given: answer.score_given,
            submission_id: answer.submission_id,
            exercise_id: answer.exercise_id,
            tasks,
        };
        answers.push(new_answer);
    }

    let total_pages = pagination.total_pages(answer_requiring_attention_count);

    token.authorized_ok(web::Json(AnswersRequiringAttention {
        exercise_max_points: exercise.score_maximum,
        data: answers,
        total_pages,
    }))
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
