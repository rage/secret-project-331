use anyhow::Result;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, FromRow, PgPool};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct CourseMaterialExerciseItem {
    pub id: Uuid,
    pub exercise_id: Uuid,
    pub exercise_type: String,
    pub assignment: serde_json::Value,
    pub public_spec: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
pub struct ExerciseItem {
    pub id: Uuid,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub exercise_id: Uuid,
    pub exercise_type: String,
    pub assignment: serde_json::Value,
    pub deleted_at: Option<NaiveDateTime>,
    pub public_spec: Option<serde_json::Value>,
    pub private_spec: Option<serde_json::Value>,
    pub spec_file_id: Option<Uuid>,
}

pub async fn get_random_exercise_item(
    pool: &PgPool,
    exercise_id: Uuid,
) -> Result<CourseMaterialExerciseItem> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let exercise_item = sqlx::query_as!(
        CourseMaterialExerciseItem,
        "SELECT id, exercise_id, exercise_type, assignment, public_spec FROM exercise_items WHERE exercise_id = $1 AND deleted_at IS NULL ORDER BY random();",
        exercise_id
    )
    .fetch_one(connection)
    .await?;
    Ok(exercise_item)
}

pub async fn get_exercise_item_by_id(pool: &PgPool, id: Uuid) -> Result<ExerciseItem> {
    let mut transaction = pool.begin().await?;
    let connection = transaction.acquire().await?;
    let exercise_item = sqlx::query_as!(
        ExerciseItem,
        "SELECT * FROM exercise_items WHERE id = $1;",
        id
    )
    .fetch_one(connection)
    .await?;
    Ok(exercise_item)
}
