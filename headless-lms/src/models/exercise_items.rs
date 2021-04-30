use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, PgPool};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct CourseMaterialExerciseItem {
    pub id: Uuid,
    pub exercise_id: Uuid,
    pub exercise_type: String,
    pub assignment: serde_json::Value,
    pub public_spec: Option<serde_json::Value>,
}

pub async fn get_random_exercise_item(
    pool: &PgPool,
    exercise_id: Uuid,
) -> Result<CourseMaterialExerciseItem> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let exercise_item = sqlx::query_as!(
        CourseMaterialExerciseItem,
        "SELECT id, exercise_id, exercise_type, assignment, public_spec FROM exercise_items WHERE exercise_id = $1 AND deleted = false ORDER BY random();",
        exercise_id
    )
    .fetch_one(connection)
    .await?;
    return Ok(exercise_item);
}
