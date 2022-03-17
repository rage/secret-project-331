use std::collections::HashMap;

use futures::TryStreamExt;
use serde_json::Value;

use headless_lms_utils::document_schema_processor::GutenbergBlock;

use crate::{
    exercise_service_info,
    exercise_slides::{self, CourseMaterialExerciseSlide},
    exercise_task_gradings::{self, ExerciseTaskGrading},
    exercise_task_submissions::{self, ExerciseTaskSubmission},
    prelude::*,
    user_exercise_states::{self, CourseInstanceOrExamId},
    CourseOrExamId,
};

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct CourseMaterialExerciseTask {
    pub id: Uuid,
    pub exercise_slide_id: Uuid,
    /**
    If none, the task is not completable at the moment because the service needs to
    be configured to the system.
    */
    pub exercise_iframe_url: Option<String>,
    pub assignment: serde_json::Value,
    pub public_spec: Option<serde_json::Value>,
    pub model_solution_spec: Option<serde_json::Value>,
    pub previous_submission: Option<ExerciseTaskSubmission>,
    pub previous_submission_grading: Option<ExerciseTaskGrading>,
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

impl FromIterator<ExerciseTask> for HashMap<Uuid, ExerciseTask> {
    fn from_iter<I: IntoIterator<Item = ExerciseTask>>(iter: I) -> Self {
        let mut map = HashMap::new();
        map.extend(iter);
        map
    }
}

impl Extend<ExerciseTask> for HashMap<Uuid, ExerciseTask> {
    fn extend<T: IntoIterator<Item = ExerciseTask>>(&mut self, iter: T) {
        for exercise_task in iter {
            self.insert(exercise_task.id, exercise_task);
        }
    }
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

pub async fn get_course_or_exam_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<CourseOrExamId> {
    let res = sqlx::query!(
        "
SELECT
    course_id,
    exam_id
FROM exercises
WHERE id = (
    SELECT s.exercise_id
    FROM exercise_slides s
      JOIN exercise_tasks t ON (s.id = t.exercise_slide_id)
    WHERE s.deleted_at IS NULL
      AND t.id = $1
      AND t.deleted_at IS NULL
  )
",
        id
    )
    .fetch_one(conn)
    .await?;
    CourseOrExamId::from(res.course_id, res.exam_id)
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

pub async fn get_course_material_exercise_tasks(
    conn: &mut PgConnection,
    exercise_slide_id: &Uuid,
    user_id: Option<&Uuid>,
) -> ModelResult<Vec<CourseMaterialExerciseTask>> {
    let exercise_tasks: Vec<ExerciseTask> =
        get_exercise_tasks_by_exercise_slide_id(conn, exercise_slide_id).await?;
    let mut latest_submissions_by_task_id = if let Some(user_id) = user_id {
        exercise_task_submissions::get_users_latest_exercise_task_submissions_for_exercise_slide(
            conn,
            exercise_slide_id,
            user_id,
        )
        .await?
        .unwrap_or_default()
        .into_iter()
        .map(|s| (s.exercise_task_id, s))
        .collect()
    } else {
        HashMap::new()
    };

    let mut material_tasks = Vec::with_capacity(exercise_tasks.len());
    for exercise_task in exercise_tasks.into_iter() {
        // This can be improved in the future so that the same info isn't fetched multiple times.
        let exercise_iframe_url = exercise_service_info::get_service_info_by_exercise_type(
            conn,
            &exercise_task.exercise_type,
        )
        .await?
        .exercise_type_specific_user_interface_iframe;
        let model_solution_spec = exercise_task.model_solution_spec;
        let previous_submission = latest_submissions_by_task_id.remove(&exercise_task.id);
        let previous_submission_grading = if let Some(submission) = previous_submission.as_ref() {
            exercise_task_gradings::get_by_exercise_task_submission_id(conn, &submission.id).await?
        } else {
            None
        };
        material_tasks.push(CourseMaterialExerciseTask {
            id: exercise_task.id,
            exercise_slide_id: exercise_task.exercise_slide_id,
            exercise_iframe_url: Some(exercise_iframe_url),
            assignment: exercise_task.assignment,
            public_spec: exercise_task.public_spec,
            model_solution_spec,
            previous_submission,
            previous_submission_grading,
        });
    }
    Ok(material_tasks)
}

pub async fn get_exercise_tasks_by_exercise_slide_id<T>(
    conn: &mut PgConnection,
    exercise_slide_id: &Uuid,
) -> ModelResult<T>
where
    T: Default + Extend<ExerciseTask> + FromIterator<ExerciseTask>,
{
    let res = sqlx::query_as!(
        ExerciseTask,
        "
SELECT *
FROM exercise_tasks
WHERE exercise_slide_id = $1
  AND deleted_at IS NULL;
        ",
        exercise_slide_id,
    )
    .fetch(conn)
    .try_collect()
    .await?;
    Ok(res)
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

// TODO: Move most of this to exercise_slides
pub async fn get_existing_users_exercise_slide_for_course_instance(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<Option<CourseMaterialExerciseSlide>> {
    let user_exercise_state = user_exercise_states::get_user_exercise_state_if_exists(
        conn,
        user_id,
        exercise_id,
        CourseInstanceOrExamId::Instance(course_instance_id),
    )
    .await?;
    let exercise_tasks = if let Some(user_exercise_state) = user_exercise_state {
        if let Some(selected_exercise_slide_id) = user_exercise_state.selected_exercise_slide_id {
            let exercise_tasks = get_course_material_exercise_tasks(
                conn,
                &selected_exercise_slide_id,
                Some(&user_id),
            )
            .await?;
            Some(CourseMaterialExerciseSlide {
                id: selected_exercise_slide_id,
                exercise_tasks,
            })
        } else {
            None
        }
    } else {
        None
    };
    Ok(exercise_tasks)
}

// TODO: Move most of this logic to exercise_slides
pub async fn get_or_select_user_exercise_tasks_for_course_instance_or_exam(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Option<Uuid>,
    exam_id: Option<Uuid>,
) -> ModelResult<CourseMaterialExerciseSlide> {
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
        get_course_material_exercise_tasks(conn, &selected_exercise_slide_id, Some(&user_id))
            .await?;
    info!("got tasks");
    if exercise_tasks.is_empty() {
        return Err(ModelError::PreconditionFailed(
            "Missing exercise definition.".to_string(),
        ));
    }

    Ok(CourseMaterialExerciseSlide {
        id: selected_exercise_slide_id,
        exercise_tasks,
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
