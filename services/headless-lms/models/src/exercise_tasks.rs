use serde_json::Value;

use headless_lms_utils::document_schema_processor::GutenbergBlock;

use crate::{exams, exercise_slides, exercise_tasks, exercises, prelude::*, user_exercise_states};

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct CourseMaterialExerciseTask {
    pub id: Uuid,
    pub exercise_slide_id: Uuid,
    pub exercise_type: String,
    pub assignment: serde_json::Value,
    pub public_spec: Option<serde_json::Value>,
    pub model_solution_spec: Option<serde_json::Value>,
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
        r#"
SELECT course_id as "course_id!"
FROM exercises
WHERE id = (
    SELECT s.exercise_id
    FROM exercise_slides s
      JOIN exercise_tasks t ON (s.id = t.exercise_slide_id)
    WHERE s.deleted_at IS NULL
      AND t.id = $1
      AND t.deleted_at IS NULL
  )
  AND course_id IS NOT NULL
"#,
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
    let mut exercise_task = sqlx::query_as!(
        CourseMaterialExerciseTask,
        r#"
SELECT t.id,
  t.exercise_slide_id,
  t.exercise_type,
  t.assignment,
  t.public_spec,
  t.model_solution_spec
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
    exercise_task.model_solution_spec = None;
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

pub async fn get_exercise_tasks_by_exercise_slide_id(
    conn: &mut PgConnection,
    exercise_slide_id: Uuid,
) -> ModelResult<Vec<ExerciseTask>> {
    let exercise_tasks = sqlx::query_as!(
        ExerciseTask,
        "
SELECT *
FROM exercise_tasks
WHERE exercise_slide_id = $1
  AND deleted_at IS NULL;
        ",
        exercise_slide_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(exercise_tasks)
}

pub async fn get_exercise_tasks_by_exercise_slide_ids(
    conn: &mut PgConnection,
    exercise_slide_ids: &[Uuid],
) -> ModelResult<Vec<ExerciseTask>> {
    let exercise_tasks = sqlx::query_as!(
        ExerciseTask,
        "
SELECT *
FROM exercise_tasks
WHERE exercise_slide_id = ANY($1)
  AND deleted_at IS NULL;
        ",
        exercise_slide_ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(exercise_tasks)
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
        Some(course_instance_id),
        None,
    )
    .await?;
    let exercise_task = if let Some(user_exercise_state) = user_exercise_state {
        if let Some(selected_exercise_task_id) = user_exercise_state.selected_exercise_slide_id {
            let exercise_task =
                exercise_tasks::get_exercise_task_by_id(conn, selected_exercise_task_id).await?;
            Some(CourseMaterialExerciseTask {
                id: exercise_task.id,
                assignment: exercise_task.assignment,
                exercise_slide_id: exercise_task.exercise_slide_id,
                exercise_type: exercise_task.exercise_type,
                public_spec: exercise_task.public_spec,
                model_solution_spec: None,
            })
        } else {
            None
        }
    } else {
        None
    };
    Ok(exercise_task)
}

pub async fn get_or_select_user_exercise_task_for_course_instance_or_exam(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Option<Uuid>,
    exam_id: Option<Uuid>,
) -> ModelResult<CourseMaterialExerciseTask> {
    let user_exercise_state = user_exercise_states::get_or_create_user_exercise_state(
        conn,
        user_id,
        exercise_id,
        course_instance_id,
        exam_id,
    )
    .await?;
    info!("statestate {:#?}", user_exercise_state);
    let selected_exercise_slide_id =
        if let Some(selected_exercise_slide_id) = user_exercise_state.selected_exercise_slide_id {
            info!("found {}", selected_exercise_slide_id);
            selected_exercise_slide_id
        } else {
            info!("random");
            let exercise_slide_id =
                exercise_slides::get_random_exercise_slide_for_exercise(conn, exercise_id)
                    .await?
                    .id;
            user_exercise_states::upsert_selected_exercise_slide_id(
                conn,
                user_id,
                exercise_id,
                course_instance_id,
                exam_id,
                Some(exercise_slide_id),
            )
            .await?;
            exercise_slide_id
        };
    let exercise_tasks =
        get_exercise_tasks_by_exercise_slide_id(conn, selected_exercise_slide_id).await?;
    info!("got tasks");
    // TODO: Return all tasks in the slide but for now we're still legacy mode.
    let exercise_task = exercise_tasks.into_iter().next().ok_or_else(|| {
        ModelError::PreconditionFailed("Missing exercise definition.".to_string())
    })?;

    let exercise = exercises::get_by_id(conn, exercise_id).await?;
    let model_solution_spec = if let Some(exam_id) = exercise.exam_id {
        let exam = exams::get(conn, exam_id).await?;
        if exam.ends_at.map(|ea| ea < Utc::now()).unwrap_or_default() {
            // if exam has ended, include model solution spec if any
            exercise_task.model_solution_spec
        } else {
            None
        }
    } else {
        None
    };
    Ok(CourseMaterialExerciseTask {
        id: exercise_task.id,
        assignment: exercise_task.assignment,
        exercise_slide_id: exercise_task.exercise_slide_id,
        exercise_type: exercise_task.exercise_type,
        public_spec: exercise_task.public_spec,
        model_solution_spec,
    })
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

pub async fn delete_exercise_tasks_by_slide_ids(
    conn: &mut PgConnection,
    exercise_slide_ids: &[Uuid],
) -> ModelResult<Vec<Uuid>> {
    let deleted_ids = sqlx::query!(
        "
UPDATE exercise_tasks
SET deleted_at = now()
WHERE exercise_slide_id = ANY($1)
RETURNING id;
        ",
        &exercise_slide_ids,
    )
    .fetch_all(conn)
    .await?
    .into_iter()
    .map(|x| x.id)
    .collect();
    Ok(deleted_ids)
}

pub async fn get_exercise_task_model_solution_spec_by_id(
    conn: &mut PgConnection,
    exercise_task_id: Uuid,
) -> ModelResult<Option<serde_json::Value>> {
    let exercise_task = sqlx::query_as!(
        ExerciseTask,
        "
SELECT *
FROM exercise_tasks et
WHERE et.id = $1;
    ",
        exercise_task_id
    )
    .fetch_one(conn)
    .await?;
    Ok(exercise_task.model_solution_spec)
}
