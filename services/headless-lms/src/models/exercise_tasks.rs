use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgConnection};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct CourseMaterialExerciseTask {
    pub id: Uuid,
    pub exercise_id: Uuid,
    pub exercise_type: String,
    pub assignment: serde_json::Value,
    pub public_spec: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone)]
pub struct ExerciseTask {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub exercise_id: Uuid,
    pub exercise_type: String,
    pub assignment: serde_json::Value,
    pub deleted_at: Option<DateTime<Utc>>,
    pub public_spec: Option<serde_json::Value>,
    pub private_spec: Option<serde_json::Value>,
    pub spec_file_id: Option<Uuid>,
}

pub async fn insert(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    exercise_type: &str,
    assignment: serde_json::Value,
    private_spec: serde_json::Value,
    spec_file_id: Uuid,
) -> Result<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercise_tasks (
    exercise_id,
    exercise_type,
    assignment,
    private_spec,
    spec_file_id
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id
",
        exercise_id,
        exercise_type,
        assignment,
        private_spec,
        spec_file_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_course_id(conn: &mut PgConnection, id: Uuid) -> Result<Uuid> {
    let course_id = sqlx::query!("SELECT course_id FROM exercises WHERE id = (SELECT exercise_id FROM exercise_tasks WHERE id = $1)", id)
        .fetch_one(conn)
        .await?
        .course_id;
    Ok(course_id)
}

pub async fn get_random_exercise_task(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> Result<CourseMaterialExerciseTask> {
    let exercise_task = sqlx::query_as!(
        CourseMaterialExerciseTask,
        "SELECT id, exercise_id, exercise_type, assignment, public_spec FROM exercise_tasks WHERE exercise_id = $1 AND deleted_at IS NULL ORDER BY random();",
        exercise_id
    )
    .fetch_one(conn)
    .await?;
    Ok(exercise_task)
}

pub async fn get_exercise_task_by_id(conn: &mut PgConnection, id: Uuid) -> Result<ExerciseTask> {
    let exercise_task = sqlx::query_as!(
        ExerciseTask,
        "SELECT * FROM exercise_tasks WHERE id = $1;",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(exercise_task)
}
