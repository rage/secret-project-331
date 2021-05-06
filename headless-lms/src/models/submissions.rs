use anyhow::Result;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use super::{exercises::Exercise, gradings::new_grading};

// Represents the subset of page fields that are required to create a new course.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct NewSubmission {
    pub exercise_item_id: Uuid,
    pub data_json: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct Submission {
    pub id: Uuid,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub deleted: bool,
    pub exercise_id: Uuid,
    pub course_id: Uuid,
    pub exercise_item_id: Uuid,
    pub data_json: Option<serde_json::Value>,
    pub grading_id: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
    pub user_id: Uuid,
}

pub async fn insert_submission(
    pool: &PgPool,
    new_submission: NewSubmission,
    exercise: Exercise,
) -> Result<Submission> {
    let mut connection = pool.acquire().await?;
    let submission = sqlx::query_as!(
        Submission,
        r#"
  INSERT INTO
    submissions(exercise_item_id, data_json, exercise_id, course_id)
  VALUES($1, $2, $3, $4)
  RETURNING *
          "#,
        new_submission.exercise_item_id,
        new_submission.data_json,
        exercise.id,
        exercise.course_id
    )
    .fetch_one(&mut connection)
    .await?;
    Ok(submission)
}

pub async fn grade_submission(pool: &PgPool, submission: &Submission) -> Result<()> {
    let grading = new_grading(pool, submission).await?;
    Ok(())
}
