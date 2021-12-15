use super::{
    exercise_services::{get_exercise_service_by_exercise_type, get_internal_grade_url},
    exercise_tasks::ExerciseTask,
    exercises::{Exercise, GradingProgress},
    submissions::{GradingResult, Submission},
    user_exercise_states::update_user_exercise_state,
    ModelResult,
};
use crate::{
    models::{
        exercise_service_info::get_service_info_by_exercise_type, submissions::GradingRequest,
        ModelError,
    },
    utils::numbers::f32_to_two_decimals,
};
use chrono::{DateTime, Utc};

use futures::Future;
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use std::time::Duration;
use ts_rs::TS;
use url::Url;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, TS)]
pub struct Grading {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub submission_id: Uuid,
    pub course_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub exercise_id: Uuid,
    pub exercise_task_id: Uuid,
    pub grading_priority: i32,
    pub score_given: Option<f32>,
    pub grading_progress: GradingProgress,
    pub user_points_update_strategy: UserPointsUpdateStrategy,
    pub unscaled_score_given: Option<f32>,
    pub unscaled_score_maximum: Option<i32>,
    pub grading_started_at: Option<DateTime<Utc>>,
    pub grading_completed_at: Option<DateTime<Utc>>,
    pub feedback_json: Option<serde_json::Value>,
    pub feedback_text: Option<String>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type, TS)]
#[sqlx(type_name = "user_points_update_strategy", rename_all = "kebab-case")]
pub enum UserPointsUpdateStrategy {
    CanAddPointsButCannotRemovePoints,
    CanAddPointsAndCanRemovePoints,
}

pub async fn insert(
    conn: &mut PgConnection,
    submission_id: Uuid,
    course_id: Uuid,
    exercise_id: Uuid,
    exercise_task_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO gradings (
    submission_id,
    course_id,
    exercise_id,
    exercise_task_id
  )
VALUES ($1, $2, $3, $4)
RETURNING id
",
        submission_id,
        course_id,
        exercise_id,
        exercise_task_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Grading> {
    let res = sqlx::query_as!(
        Grading,
        r#"
SELECT id,
  created_at,
  updated_at,
  submission_id,
  course_id,
  exam_id,
  exercise_id,
  exercise_task_id,
  grading_priority,
  score_given,
  grading_progress as "grading_progress: _",
  user_points_update_strategy as "user_points_update_strategy: _",
  unscaled_score_maximum,
  unscaled_score_given,
  grading_started_at,
  grading_completed_at,
  feedback_json,
  feedback_text,
  deleted_at
FROM gradings
WHERE id = $1
"#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_course_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Option<Uuid>> {
    let course_id = sqlx::query!(r#"SELECT course_id from gradings where id = $1"#, id)
        .fetch_one(conn)
        .await?
        .course_id;
    Ok(course_id)
}

pub async fn new_grading(conn: &mut PgConnection, submission: &Submission) -> ModelResult<Grading> {
    let grading = sqlx::query_as!(
        Grading,
        r#"
INSERT INTO gradings(
    submission_id,
    course_id,
    exam_id,
    exercise_id,
    exercise_task_id,
    grading_started_at
  )
VALUES($1, $2, $3, $4, $5, now())
RETURNING id,
  created_at,
  updated_at,
  submission_id,
  course_id,
  exam_id,
  exercise_id,
  exercise_task_id,
  grading_priority,
  score_given,
  grading_progress as "grading_progress: _",
  user_points_update_strategy as "user_points_update_strategy: _",
  unscaled_score_given,
  unscaled_score_maximum,
  grading_started_at,
  grading_completed_at,
  feedback_json,
  feedback_text,
  deleted_at
"#,
        submission.id,
        submission.course_id,
        submission.exam_id,
        submission.exercise_id,
        submission.exercise_task_id
    )
    .fetch_one(conn)
    .await?;
    Ok(grading)
}

pub async fn set_grading_progress(
    conn: &mut PgConnection,
    id: Uuid,
    grading_progress: GradingProgress,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE gradings
SET grading_progress = $1
WHERE id = $2
",
        grading_progress as GradingProgress,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn grade_submission(
    conn: &mut PgConnection,
    submission: &Submission,
    exercise_task: &ExerciseTask,
    exercise: &Exercise,
    grading: &Grading,
) -> ModelResult<Grading> {
    let exercise_service_info =
        get_service_info_by_exercise_type(conn, &exercise_task.exercise_type).await?;
    let exercise_service =
        get_exercise_service_by_exercise_type(conn, &exercise_task.exercise_type).await?;
    let grade_url = get_internal_grade_url(&exercise_service, &exercise_service_info).await?;
    let obj = send_grading_request(grade_url, exercise_task, submission).await?;
    let updated_grading = update_grading(conn, grading, &obj, exercise).await?;
    update_user_exercise_state(conn, &updated_grading, &submission).await?;
    Ok(updated_grading)
}

// does not use async fn because the arguments should only be borrowed
// for the part before any async stuff happens
pub fn send_grading_request(
    grade_url: Url,
    exercise_task: &ExerciseTask,
    submission: &Submission,
) -> impl Future<Output = ModelResult<GradingResult>> + 'static {
    let client = reqwest::Client::new();
    let req = client
        .post(grade_url)
        .timeout(Duration::from_secs(120))
        .json(&GradingRequest {
            exercise_spec: &exercise_task.private_spec,
            submission_data: &submission.data_json,
        });
    async {
        let res = req.send().await?;
        let status = res.status();
        if !status.is_success() {
            return Err(ModelError::Generic("Grading failed".to_string()));
        }
        let obj = res.json::<GradingResult>().await?;
        info!("Received a grading result: {:#?}", &obj);
        Ok(obj)
    }
}

pub async fn update_grading(
    conn: &mut PgConnection,
    grading: &Grading,
    grading_result: &GradingResult,
    exercise: &Exercise,
) -> ModelResult<Grading> {
    let grading_completed_at = if grading_result.grading_progress.is_complete() {
        Some(Utc::now())
    } else {
        None
    };
    let correctness_coefficient =
        grading_result.score_given / (grading_result.score_maximum as f32);
    // ensure the score doesn't go over the maximum
    let score_given_with_all_decimals = f32::min(
        (exercise.score_maximum as f32) * correctness_coefficient,
        exercise.score_maximum as f32,
    );
    // Scores are rounded to two decimals
    let score_given_rounded = f32_to_two_decimals(score_given_with_all_decimals);
    let grading = sqlx::query_as!(
        Grading,
        r#"
UPDATE gradings
SET grading_progress = $2,
  unscaled_score_given = $3,
  unscaled_score_maximum = $4,
  feedback_text = $5,
  feedback_json = $6,
  grading_completed_at = $7,
  score_given = $8
WHERE id = $1
RETURNING id,
  created_at,
  updated_at,
  submission_id,
  course_id,
  exam_id,
  exercise_id,
  exercise_task_id,
  grading_priority,
  score_given,
  grading_progress as "grading_progress: _",
  user_points_update_strategy as "user_points_update_strategy: _",
  unscaled_score_given,
  unscaled_score_maximum,
  grading_started_at,
  grading_completed_at,
  feedback_json,
  feedback_text,
  deleted_at
"#,
        grading.id,
        grading_result.grading_progress as GradingProgress,
        grading_result.score_given,
        grading_result.score_maximum,
        grading_result.feedback_text,
        grading_result.feedback_json,
        grading_completed_at,
        score_given_rounded
    )
    .fetch_one(conn)
    .await?;

    Ok(grading)
}
