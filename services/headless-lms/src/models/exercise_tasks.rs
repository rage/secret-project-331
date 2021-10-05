use super::{exercise_tasks, user_exercise_states, ModelResult};
use crate::utils::document_schema_processor::GutenbergBlock;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, PgConnection};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct CourseMaterialExerciseTask {
    pub id: Uuid,
    pub exercise_slide_id: Uuid,
    pub exercise_type: String,
    pub assignment: serde_json::Value,
    pub public_spec: Option<serde_json::Value>,
}

impl From<ExerciseTask> for CourseMaterialExerciseTask {
    fn from(exercise_task: ExerciseTask) -> Self {
        CourseMaterialExerciseTask {
            id: exercise_task.id,
            assignment: exercise_task.assignment,
            exercise_slide_id: exercise_task.exercise_slide_id,
            exercise_type: exercise_task.exercise_type,
            public_spec: exercise_task.public_spec,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Eq, Clone, TS)]
pub struct ExerciseTask {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub exercise_slide_id: Uuid,
    pub exercise_type: String,
    pub assignment: serde_json::Value,
    pub deleted_at: Option<DateTime<Utc>>,
    pub public_spec: Option<serde_json::Value>,
    pub private_spec: Option<serde_json::Value>,
    pub spec_file_id: Option<Uuid>,
    pub model_solution_spec: Option<serde_json::Value>,
    pub copied_from: Option<Uuid>,
}

pub async fn insert(
    conn: &mut PgConnection,
    exercise_slide_id: Uuid,
    exercise_type: &str,
    assignment: Vec<GutenbergBlock>,
    private_spec: Value,
    public_spec: Value,
    model_solution_spec: Value,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercise_tasks (
    exercise_slide_id,
    exercise_type,
    assignment,
    private_spec,
    public_spec,
    model_solution_spec
  )
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id
",
        exercise_slide_id,
        exercise_type,
        serde_json::to_value(assignment).unwrap(),
        private_spec,
        public_spec,
        model_solution_spec
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_course_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Uuid> {
    let course_id = sqlx::query!(
        "
SELECT course_id
FROM exercises
WHERE id = (
    SELECT s.exercise_id
    FROM exercise_slides s
      JOIN exercise_tasks t ON (s.id = t.exercise_slide_id)
    WHERE s.deleted_at IS NULL
      AND t.id = $1
      AND t.deleted_at IS NULL
  );
        ",
        id
    )
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
SELECT t.id,
  t.exercise_slide_id,
  t.exercise_type,
  t.assignment,
  t.public_spec
FROM exercise_tasks t
  JOIN exercise_slides s ON (t.exercise_slide_id = s.id)
WHERE s.exercise_id = $1
  AND s.deleted_at IS NULL
  AND t.deleted_at IS NULL
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

pub async fn get_existing_user_exercise_task_for_course_instance(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<Option<CourseMaterialExerciseTask>> {
    let user_exercise_state = user_exercise_states::get_user_exercise_state_if_exits(
        conn,
        user_id,
        exercise_id,
        course_instance_id,
    )
    .await?;
    let exercise_task = if let Some(user_exercise_state) = user_exercise_state {
        if let Some(selected_exercise_task_id) = user_exercise_state.selected_exercise_task_id {
            let exercise_task =
                exercise_tasks::get_exercise_task_by_id(conn, selected_exercise_task_id).await?;
            Some(exercise_task.into())
        } else {
            None
        }
    } else {
        None
    };
    Ok(exercise_task)
}

pub async fn get_or_select_user_exercise_task_for_course_instance(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<CourseMaterialExerciseTask> {
    let user_exercise_state = user_exercise_states::get_or_create_user_exercise_state(
        conn,
        user_id,
        exercise_id,
        course_instance_id,
    )
    .await?;
    if let Some(selected_exercise_task_id) = user_exercise_state.selected_exercise_task_id {
        let exercise_task =
            exercise_tasks::get_exercise_task_by_id(conn, selected_exercise_task_id).await?;
        Ok(exercise_task.into())
    } else {
        let exercise_task = get_random_exercise_task(conn, exercise_id).await?;
        user_exercise_states::upsert_selected_exercise_task_id(
            conn,
            user_id,
            exercise_id,
            course_instance_id,
            Some(exercise_task.id),
        )
        .await?;
        Ok(exercise_task)
    }
}

pub async fn get_exercise_tasks_by_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<Vec<ExerciseTask>> {
    let exercise_tasks = sqlx::query_as!(
        ExerciseTask,
        "
SELECT t.*
FROM exercise_tasks t
  JOIN exercise_slides s ON (t.exercise_slide_id = s.id)
WHERE s.exercise_id = $1
  AND s.deleted_at IS NULL
  AND t.deleted_at IS NULL;
        ",
        exercise_id
    )
    .fetch_all(conn)
    .await?;
    Ok(exercise_tasks)
}
