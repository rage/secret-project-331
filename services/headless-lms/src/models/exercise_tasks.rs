use super::ModelResult;
use crate::utils::document_schema_processor::GutenbergBlock;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
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
    assignment: Vec<GutenbergBlock>,
    private_spec: Value,
    public_spec: Value,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercise_tasks (
    exercise_id,
    exercise_type,
    assignment,
    private_spec,
    public_spec
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id
",
        exercise_id,
        exercise_type,
        serde_json::to_value(assignment).unwrap(),
        private_spec,
        public_spec
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_course_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Uuid> {
    let course_id = sqlx::query!("SELECT course_id FROM exercises WHERE id = (SELECT exercise_id FROM exercise_tasks WHERE id = $1)", id)
        .fetch_one(conn)
        .await?
        .course_id;
    Ok(course_id)
}

pub async fn get_random_exercise_task(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<CourseMaterialExerciseTask> {
    let exercise_task = sqlx::query_as!(
        CourseMaterialExerciseTask,
        r#"
SELECT id,
  exercise_id,
  exercise_type,
  assignment,
  public_spec
FROM exercise_tasks
WHERE exercise_id = $1
  AND deleted_at IS NULL
ORDER BY random();
        "#,
        exercise_id
    )
    .fetch_one(conn)
    .await?;
    Ok(exercise_task)
}

pub async fn get_exercise_task_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<ExerciseTask> {
    let exercise_task = sqlx::query_as!(
        ExerciseTask,
        "SELECT * FROM exercise_tasks WHERE id = $1;",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(exercise_task)
}
