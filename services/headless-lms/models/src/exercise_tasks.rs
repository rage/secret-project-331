use std::collections::{HashMap, HashSet};

use futures::{future::BoxFuture, Stream, TryStreamExt};

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use url::Url;

use crate::{
    exercise_service_info::{self, ExerciseServiceInfoApi},
    exercise_services,
    exercise_slides::{self, CourseMaterialExerciseSlide},
    exercise_task_gradings::{self, ExerciseTaskGrading},
    exercise_task_submissions::{self, ExerciseTaskSubmission},
    prelude::*,
    user_exercise_states::{self, CourseInstanceOrExamId},
    CourseOrExamId,
};

/// Information necessary for the frontend to render an exercise task
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialExerciseTask {
    pub id: Uuid,
    pub exercise_service_slug: String,
    pub exercise_slide_id: Uuid,
    /**
    If none, the task is not completable at the moment because the service needs to
    be configured to the system.
    */
    pub exercise_iframe_url: Option<String>,
    /**
    Unique for each (exercise_service, user) combo. If none, the task is not completable at the moment because the service needs to
    be configured to the system.
    */
    pub pseudonumous_user_id: Option<Uuid>,
    pub assignment: serde_json::Value,
    pub public_spec: Option<serde_json::Value>,
    pub model_solution_spec: Option<serde_json::Value>,
    pub previous_submission: Option<ExerciseTaskSubmission>,
    pub previous_submission_grading: Option<ExerciseTaskGrading>,
    pub order_number: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct NewExerciseTask {
    pub exercise_slide_id: Uuid,
    pub exercise_type: String,
    pub assignment: Vec<GutenbergBlock>,
    pub public_spec: Option<serde_json::Value>,
    pub private_spec: Option<serde_json::Value>,
    pub model_solution_spec: Option<serde_json::Value>,
    pub order_number: i32,
}

pub struct ExerciseTaskSpec {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub exercise_type: String,
    pub private_spec: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
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
    pub model_solution_spec: Option<serde_json::Value>,
    pub copied_from: Option<Uuid>,
    pub order_number: i32,
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
    pkey_policy: PKeyPolicy<Uuid>,
    new_exercise_task: NewExerciseTask,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercise_tasks (
    id,
    exercise_slide_id,
    exercise_type,
    assignment,
    private_spec,
    public_spec,
    model_solution_spec,
    order_number
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        new_exercise_task.exercise_slide_id,
        new_exercise_task.exercise_type,
        serde_json::to_value(new_exercise_task.assignment)?,
        new_exercise_task.private_spec,
        new_exercise_task.public_spec,
        new_exercise_task.model_solution_spec,
        new_exercise_task.order_number,
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
    exercise_slide_id: Uuid,
    user_id: Option<Uuid>,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<Vec<CourseMaterialExerciseTask>> {
    let exercise_tasks: Vec<ExerciseTask> =
        get_exercise_tasks_by_exercise_slide_id(conn, &exercise_slide_id).await?;
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

    let unique_exercise_service_slugs = exercise_tasks
        .iter()
        .cloned()
        .map(|et| et.exercise_type)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let exercise_service_slug_to_service_and_info =
        exercise_service_info::get_selected_exercise_services_by_type(
            &mut *conn,
            &unique_exercise_service_slugs,
            fetch_service_info,
        )
        .await?;

    let mut material_tasks = Vec::with_capacity(exercise_tasks.len());
    for exercise_task in exercise_tasks.into_iter() {
        let model_solution_spec = exercise_task.model_solution_spec;
        let previous_submission = latest_submissions_by_task_id.remove(&exercise_task.id);
        let previous_submission_grading = if let Some(submission) = previous_submission.as_ref() {
            exercise_task_gradings::get_by_exercise_task_submission_id(conn, submission.id).await?
        } else {
            None
        };

        let (exercise_service, service_info) = exercise_service_slug_to_service_and_info
            .get(&exercise_task.exercise_type)
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::InvalidRequest,
                    "Exercise service not found".to_string(),
                    None,
                )
            })?;
        let mut exercise_iframe_url =
            exercise_services::get_exercise_service_externally_preferred_baseurl(exercise_service)?;
        exercise_iframe_url.set_path(&service_info.user_interface_iframe_path);

        material_tasks.push(CourseMaterialExerciseTask {
            id: exercise_task.id,
            exercise_service_slug: exercise_task.exercise_type,
            exercise_slide_id: exercise_task.exercise_slide_id,
            exercise_iframe_url: Some(exercise_iframe_url.to_string()),
            pseudonumous_user_id: user_id
                .map(|uid| Uuid::new_v5(&service_info.exercise_service_id, uid.as_bytes())),
            assignment: exercise_task.assignment,
            public_spec: exercise_task.public_spec,
            model_solution_spec,
            previous_submission,
            previous_submission_grading,
            order_number: exercise_task.order_number,
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
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
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
                selected_exercise_slide_id,
                Some(user_id),
                fetch_service_info,
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
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
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

    let exercise_tasks = get_course_material_exercise_tasks(
        conn,
        selected_exercise_slide_id,
        Some(user_id),
        fetch_service_info,
    )
    .await?;
    info!("got tasks");
    if exercise_tasks.is_empty() {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Missing exercise definition.".to_string(),
            None,
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

pub async fn get_all_exercise_tas_by_exercise_slide_submission_id(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<Vec<ExerciseTaskGrading>> {
    let res = sqlx::query_as!(
        ExerciseTaskGrading,
        r#"
SELECT id,
created_at,
updated_at,
exercise_task_submission_id,
course_id,
exam_id,
exercise_id,
exercise_task_id,
grading_priority,
score_given,
grading_progress as "grading_progress: _",
unscaled_score_given,
unscaled_score_maximum,
grading_started_at,
grading_completed_at,
feedback_json,
feedback_text,
deleted_at
FROM exercise_task_gradings
WHERE deleted_at IS NULL
  AND exercise_task_submission_id IN (
    SELECT id
    FROM exercise_task_submissions
    WHERE exercise_slide_submission_id = $1
  )
"#,
        exercise_slide_submission_id
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(res)
}

pub fn stream_course_exercise_tasks(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> impl Stream<Item = sqlx::Result<ExerciseTaskSpec>> + '_ {
    sqlx::query_as!(
        ExerciseTaskSpec,
        r#"
SELECT distinct (t.id),
  t.created_at,
  t.updated_at,
  t.exercise_type,
  t.private_spec
from exercise_tasks t
where t.exercise_slide_id in (
    SELECT id
    from exercise_slides s
    where s.exercise_id in (
        SELECT id
        from exercises e
        where e.course_id = $1
      )
  )
  AND deleted_at IS NULL;
        "#,
        course_id
    )
    .fetch(conn)
}
