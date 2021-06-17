use std::time::Duration;

use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::models::submissions::GradingRequest;

use super::{
    exercise_tasks::ExerciseTask,
    exercises::{Exercise, GradingProgress},
    submissions::{GradingResult, Submission},
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct Grading {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub submission_id: Uuid,
    pub course_id: Uuid,
    pub exercise_id: Uuid,
    pub exercise_task_id: Uuid,
    pub grading_priority: i32,
    pub score_given: Option<f32>,
    pub grading_progress: GradingProgress,
    pub user_points_update_strategy: UserPointsUpdateStrategy,
    pub unscaled_score_maximum: Option<f32>,
    pub unscaled_max_points: Option<i32>,
    pub grading_started_at: Option<DateTime<Utc>>,
    pub grading_completed_at: Option<DateTime<Utc>>,
    pub feedback_json: Option<serde_json::Value>,
    pub feedback_text: Option<String>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type)]
#[sqlx(type_name = "user_points_update_strategy", rename_all = "kebab-case")]
pub enum UserPointsUpdateStrategy {
    CanAddPointsButCannotRemovePoints,
    CanAddPointsAndCanRemovePoints,
}

pub async fn get_course_id(conn: &mut PgConnection, id: Uuid) -> Result<Uuid> {
    let course_id = sqlx::query!(r#"SELECT course_id from gradings where id = $1"#, id)
        .fetch_one(conn)
        .await?
        .course_id;
    Ok(course_id)
}

pub async fn new_grading(conn: &mut PgConnection, submission: &Submission) -> Result<Grading> {
    let grading = sqlx::query_as!(
        Grading,
        r#"
INSERT INTO
  gradings(submission_id, course_id, exercise_id, exercise_task_id, grading_started_at)
VALUES($1, $2, $3, $4, now())
RETURNING id, created_at, updated_at, submission_id, course_id, exercise_id, exercise_task_id, grading_priority, score_given, grading_progress as "grading_progress: _", user_points_update_strategy as "user_points_update_strategy: _", unscaled_score_maximum, unscaled_max_points, grading_started_at, grading_completed_at, feedback_json, feedback_text, deleted_at
        "#,
        submission.id,
        submission.course_id,
        submission.exercise_id,
        submission.exercise_task_id
    )
    .fetch_one(conn)
    .await?;
    Ok(grading)
}

pub async fn grade_submission(
    conn: &mut PgConnection,
    submission: Submission,
    exercise_task: ExerciseTask,
    exercise: Exercise,
    grading: Grading,
) -> Result<Grading> {
    let client = reqwest::Client::new();
    let res = client
        .post("http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/grade")
        .timeout(Duration::from_secs(120))
        .json(&GradingRequest {
            exercise_spec: exercise_task.private_spec,
            submission_data: submission.data_json,
        })
        .send()
        .await?;
    let status = res.status();
    if !status.is_success() {
        anyhow::bail!("Grading failed");
    }
    let obj = res.json::<GradingResult>().await?;
    info!("Received a grading result: {:#?}", &obj);
    let updated_grading = update_grading(conn, grading, obj, exercise).await?;
    Ok(updated_grading)
}

pub async fn update_grading(
    conn: &mut PgConnection,
    grading: Grading,
    grading_result: GradingResult,
    exercise: Exercise,
) -> Result<Grading> {
    let grading_completed_at = if grading_result.grading_progress.is_complete() {
        Some(Utc::now())
    } else {
        None
    };
    let correctness_coefficient =
        grading_result.score_given / (grading_result.score_maximum as f32);
    let score_given_with_all_decumals = f32::max(
        (exercise.score_maximum as f32) * correctness_coefficient,
        exercise.score_maximum as f32,
    );
    // Scores are rounded to two decimals
    let score_given_rounded = (score_given_with_all_decumals * (100_f32)).trunc() / (100_f32);
    let grading = sqlx::query_as!(
        Grading,
        r#"
UPDATE gradings
  SET
    grading_progress = $2,
    unscaled_score_maximum = $3,
    unscaled_max_points = $4,
    feedback_text = $5,
    feedback_json = $6,
    grading_completed_at = $7,
    score_given = $8
WHERE id = $1
RETURNING id, created_at, updated_at, submission_id, course_id, exercise_id, exercise_task_id, grading_priority, score_given, grading_progress as "grading_progress: _", user_points_update_strategy as "user_points_update_strategy: _", unscaled_score_maximum, unscaled_max_points, grading_started_at, grading_completed_at, feedback_json, feedback_text, deleted_at
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
