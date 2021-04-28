use anyhow::Result;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, PgPool};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct ExerciseItem {
    pub id: Uuid,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub exercise_id: Uuid,
    pub exercise_type: String,
    pub assignment: serde_json::Value,
    pub deleted: bool,
    pub spec: Option<serde_json::Value>,
    pub spec_file_id: Option<Uuid>,
}

pub async fn get_random_exercise_item(pool: &PgPool, exercise_id: Uuid) -> Result<ExerciseItem> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let exercise_item = sqlx::query_as!(
        ExerciseItem,
        "SELECT * FROM exercise_items WHERE exercise_id = $1 AND deleted = false ORDER BY random();",
        exercise_id
    )
    .fetch_one(connection)
    .await?;
    return Ok(exercise_item);
}
