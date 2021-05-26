use anyhow::Result;
use chrono::{NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use super::{
    exercises::GradingProgress,
    submissions::{GradingResult, Submission},
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct Grading {
    pub id: Uuid,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub submission_id: Uuid,
    pub course_id: Uuid,
    pub exercise_id: Uuid,
    pub exercise_item_id: Uuid,
    pub grading_priority: i32,
    pub score_given: Option<f32>,
    pub grading_progress: GradingProgress,
    pub user_points_update_strategy: UserPointsUpdateStrategy,
    pub unscaled_score_given: Option<f32>,
    pub unscaled_max_points: Option<i32>,
    pub grading_started_at: Option<NaiveDateTime>,
    pub grading_completed_at: Option<NaiveDateTime>,
    pub feedback_json: Option<serde_json::Value>,
    pub feedback_text: Option<String>,
    pub deleted: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, sqlx::Type)]
#[sqlx(type_name = "user_points_update_strategy", rename_all = "kebab-case")]
pub enum UserPointsUpdateStrategy {
    CanAddPointsButCannotRemovePoints,
    CanAddPointsAndCanRemovePoints,
}

pub async fn new_grading(pool: &PgPool, submission: &Submission) -> Result<Grading> {
    let mut connection = pool.acquire().await?;
    let grading = sqlx::query_as!(
        Grading,
        r#"
INSERT INTO
  gradings(submission_id, course_id, exercise_id, exercise_item_id)
VALUES($1, $2, $3, $4)
RETURNING id, created_at, updated_at, submission_id, course_id, exercise_id, exercise_item_id, grading_priority, score_given, grading_progress as "grading_progress: _", user_points_update_strategy as "user_points_update_strategy: _", unscaled_score_given, unscaled_max_points, grading_started_at, grading_completed_at, feedback_json, feedback_text, deleted
        "#,
        submission.id,
        submission.course_id,
        submission.exercise_id,
        submission.exercise_item_id
    )
    .fetch_one(&mut connection)
    .await?;
    Ok(grading)
}

pub async fn update_grading(
    pool: &PgPool,
    grading: Grading,
    grading_result: GradingResult,
) -> Result<Grading> {
    let mut connection = pool.acquire().await?;
    let grading_completed_at = if grading_result.grading_progress.is_complete() {
        Some(Utc::now().naive_utc())
    } else {
        None
    };
    let grading = sqlx::query_as!(
        Grading,
        r#"
UPDATE gradings
  SET
    grading_progress = $2,
    unscaled_score_given = $3,
    unscaled_max_points = $4,
    feedback_text = $5,
    feedback_json = $6,
    grading_completed_at = $7
WHERE id = $1
RETURNING id, created_at, updated_at, submission_id, course_id, exercise_id, exercise_item_id, grading_priority, score_given, grading_progress as "grading_progress: _", user_points_update_strategy as "user_points_update_strategy: _", unscaled_score_given, unscaled_max_points, grading_started_at, grading_completed_at, feedback_json, feedback_text, deleted
        "#,
        grading.id,
        grading_result.grading_progress as GradingProgress,
        grading_result.score_given,
        grading_result.score_maximum,
        grading_result.feedback_text,
        grading_result.feedback_json,
        grading_completed_at
    )
    .fetch_one(&mut connection)
    .await?;

    Ok(grading)
}

// pub async fn update_grading(
//     pool: &PgPool,
//     grading: &Grading,
//     grading_result: &GradingResult,
// ) -> Result<Grading> {
//     let mut connection = pool.acquire().await?;
//     let submission = sqlx::query_as!(
//         Grading,
//         r#"
// UPDATE gradings
// SET
//     grading_progress = $2,
//     score_given = $3,
//     feedback_text = $5
// WHERE id = $1
// RETURNING id, created_at, updated_at, submission_id, course_id, exercise_id, exercise_item_id, grading_priority, score_given, grading_progress as "grading_progress: _", user_points_update_strategy as "user_points_update_strategy: _", unscaled_score_given, unscaled_max_points, grading_started_at, grading_completed_at, feedback_json, feedback_text, deleted
//         "#,
//         grading.id,
//         grading_result.grading_progress,
//         grading_result.score_given,
//         grading_result.feedback_text,
//     )
//     .fetch_one(&mut connection)
//     .await?;
//     Ok(submission)
// }
