use std::collections::HashSet;

use futures::{Stream, future::BoxFuture};
use serde_json::Value;
use url::Url;

use crate::{
    CourseOrExamId,
    exercise_service_info::{self, ExerciseServiceInfoApi},
    exercise_services, exercise_slide_submissions,
    exercise_tasks::{CourseMaterialExerciseTask, ExerciseTask},
    library::custom_view_exercises::{CustomViewExerciseTaskSubmission, CustomViewExerciseTasks},
    peer_or_self_review_question_submissions::PeerOrSelfReviewQuestionSubmission,
    peer_or_self_review_questions::PeerOrSelfReviewQuestion,
    peer_or_self_review_submissions::PeerOrSelfReviewSubmission,
    prelude::*,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseTaskSubmission {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub exercise_slide_submission_id: Uuid,
    pub exercise_task_id: Uuid,
    pub exercise_slide_id: Uuid,
    pub data_json: Option<serde_json::Value>,
    pub exercise_task_grading_id: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PeerOrSelfReviewsReceived {
    pub peer_or_self_review_questions: Vec<PeerOrSelfReviewQuestion>,
    pub peer_or_self_review_question_submissions: Vec<PeerOrSelfReviewQuestionSubmission>,
    pub peer_or_self_review_submissions: Vec<PeerOrSelfReviewSubmission>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct SubmissionData {
    pub exercise_id: Uuid,
    pub course_id: Uuid,
    pub exercise_slide_submission_id: Uuid,
    pub exercise_slide_id: Uuid,
    pub exercise_task_id: Uuid,
    pub user_id: Uuid,
    pub course_instance_id: Uuid,
    pub data_json: Value,
    pub id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExportedSubmission {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub exercise_id: Uuid,
    pub exercise_task_id: Uuid,
    pub score_given: Option<f32>,
    pub data_json: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExportedCourseSubmission {
    pub exercise_slide_submission_id: Uuid,
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub course_instance_id: Option<Uuid>,
    pub exercise_id: Uuid,
    pub exercise_task_id: Uuid,
    pub score_given: Option<f32>,
    pub data_json: Option<serde_json::Value>,
}

pub async fn get_submission(
    conn: &mut PgConnection,
    submission_id: Uuid,
) -> ModelResult<ExerciseTaskSubmission> {
    let res = sqlx::query_as!(
        ExerciseTaskSubmission,
        "
SELECT *
FROM exercise_task_submissions
WHERE id = $1
",
        submission_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

// TODO: Merge with the other insert, but need to resolve different parameters.
pub async fn insert_with_id(
    conn: &mut PgConnection,
    submission_data: &SubmissionData,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercise_task_submissions (
    id,
    exercise_slide_submission_id,
    exercise_slide_id,
    exercise_task_id,
    data_json
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id
        ",
        submission_data.id,
        submission_data.exercise_slide_submission_id,
        submission_data.exercise_slide_id,
        submission_data.exercise_task_id,
        submission_data.data_json,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    exercise_slide_submission_id: Uuid,
    exercise_slide_id: Uuid,
    exercise_task_id: Uuid,
    data_json: &Value,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercise_task_submissions (
    id,
    exercise_slide_submission_id,
    exercise_slide_id,
    exercise_task_id,
    data_json
  )
  VALUES ($1, $2, $3, $4, $5)
  RETURNING id
        ",
        pkey_policy.into_uuid(),
        exercise_slide_submission_id,
        exercise_slide_id,
        exercise_task_id,
        data_json,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<ExerciseTaskSubmission> {
    let submission = sqlx::query_as!(
        ExerciseTaskSubmission,
        "
SELECT *
FROM exercise_task_submissions
WHERE id = $1
",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(submission)
}

pub async fn get_by_exercise_slide_submission_id(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<Vec<ExerciseTaskSubmission>> {
    let submissions = sqlx::query_as!(
        ExerciseTaskSubmission,
        "
SELECT *
FROM exercise_task_submissions
WHERE exercise_slide_submission_id = $1
        ",
        exercise_slide_submission_id
    )
    .fetch_all(conn)
    .await?;
    Ok(submissions)
}

pub async fn get_users_latest_exercise_task_submissions_for_exercise_slide(
    conn: &mut PgConnection,
    exercise_slide_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Option<Vec<ExerciseTaskSubmission>>> {
    let exercise_slide_submission =
        exercise_slide_submissions::try_to_get_users_latest_exercise_slide_submission(
            conn,
            exercise_slide_id,
            user_id,
        )
        .await?;
    if let Some(exercise_slide_submission) = exercise_slide_submission {
        let task_submissions = sqlx::query_as!(
            ExerciseTaskSubmission,
            "
SELECT *
FROM exercise_task_submissions
WHERE exercise_slide_submission_id = $1
  AND deleted_at IS NULL
            ",
            exercise_slide_submission.id
        )
        .fetch_all(conn)
        .await?;
        Ok(Some(task_submissions))
    } else {
        Ok(None)
    }
}

pub async fn get_course_and_exam_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<CourseOrExamId> {
    let res = sqlx::query!(
        "
SELECT ess.course_id,
  ess.exam_id
FROM exercise_task_submissions ets
  JOIN exercise_slide_submissions ess ON ets.exercise_slide_submission_id = ess.id
WHERE ets.id = $1
  AND ets.deleted_at IS NULL
  AND ess.deleted_at IS NULL
        ",
        id
    )
    .fetch_one(conn)
    .await?;
    CourseOrExamId::from(res.course_id, res.exam_id)
}

pub async fn get_peer_reviews_received(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    exercise_slide_submission_id: Uuid,
    user_id: Uuid,
) -> ModelResult<PeerOrSelfReviewsReceived> {
    let exercise = crate::exercises::get_by_id(&mut *conn, exercise_id).await?;
    let peer_or_self_review_config =
        crate::peer_or_self_review_configs::get_by_exercise_or_course_id(
            &mut *conn,
            &exercise,
            exercise.course_id.ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::InvalidRequest,
                    "Peer reviews work only on courses (and not, for example, on exams)"
                        .to_string(),
                    None,
                )
            })?,
        )
        .await?;
    let peer_or_self_review_questions =
        crate::peer_or_self_review_questions::get_by_peer_or_self_review_configs_id(
            &mut *conn,
            peer_or_self_review_config.id,
        )
        .await?;

    let peer_or_self_review_question_ids = peer_or_self_review_questions
        .iter()
        .map(|x| (x.id))
        .collect::<Vec<_>>();

    let peer_or_self_review_submissions =
        crate::peer_or_self_review_submissions::get_received_peer_or_self_review_submissions_for_user_by_peer_or_self_review_config_id_and_exercise_slide_submission(
            &mut *conn,
            user_id,
            exercise_slide_submission_id,
            peer_or_self_review_config.id,
        )
        .await?;

    let peer_or_self_review_question_submissions =
        crate::peer_or_self_review_question_submissions::get_by_peer_reviews_question_ids(
            &mut *conn,
            &peer_or_self_review_question_ids,
            user_id,
            exercise_slide_submission_id,
        )
        .await?;

    Ok(PeerOrSelfReviewsReceived {
        peer_or_self_review_questions,
        peer_or_self_review_question_submissions,
        peer_or_self_review_submissions,
    })
}

pub async fn set_grading_id(
    conn: &mut PgConnection,
    grading_id: Uuid,
    submission_id: Uuid,
) -> ModelResult<ExerciseTaskSubmission> {
    let res = sqlx::query_as!(
        ExerciseTaskSubmission,
        "
UPDATE exercise_task_submissions
SET exercise_task_grading_id = $1
WHERE id = $2
RETURNING *
",
        grading_id,
        submission_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub fn stream_exam_submissions(
    conn: &mut PgConnection,
    exam_id: Uuid,
) -> impl Stream<Item = sqlx::Result<ExportedSubmission>> + '_ {
    sqlx::query_as!(
        ExportedSubmission,
        "
SELECT exercise_task_submissions.id,
  user_id,
  exercise_task_submissions.created_at,
  exercise_slide_submissions.exercise_id,
  exercise_task_submissions.exercise_task_id,
  exercise_task_gradings.score_given,
  exercise_task_submissions.data_json
FROM exercise_task_submissions
  JOIN exercise_slide_submissions ON exercise_task_submissions.exercise_slide_submission_id = exercise_slide_submissions.id
  JOIN exercise_task_gradings on exercise_task_submissions.exercise_task_grading_id = exercise_task_gradings.id
  JOIN exercises on exercise_slide_submissions.exercise_id = exercises.id
WHERE exercise_slide_submissions.exam_id = $1
  AND exercise_task_submissions.deleted_at IS NULL
  AND exercise_task_gradings.deleted_at IS NULL
  AND exercises.deleted_at IS NULL;
        ",
        exam_id
    )
    .fetch(conn)
}

pub fn stream_course_submissions(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> impl Stream<Item = sqlx::Result<ExportedCourseSubmission>> + '_ {
    sqlx::query_as!(
        ExportedCourseSubmission,
        "
SELECT exercise_task_submissions.exercise_slide_submission_id,
  exercise_task_submissions.id,
  user_id,
  exercise_task_submissions.created_at,
  exercise_slide_submissions.course_instance_id,
  exercise_slide_submissions.exercise_id,
  exercise_task_submissions.exercise_task_id,
  exercise_task_gradings.score_given,
  exercise_task_submissions.data_json
FROM exercise_task_submissions
  JOIN exercise_slide_submissions ON exercise_task_submissions.exercise_slide_submission_id = exercise_slide_submissions.id
  JOIN exercise_task_gradings ON exercise_task_submissions.exercise_task_grading_id = exercise_task_gradings.id
  JOIN exercises ON exercise_slide_submissions.exercise_id = exercises.id
WHERE exercise_slide_submissions.course_id = $1
  AND exercise_slide_submissions.deleted_at IS NULL
  AND exercise_task_submissions.deleted_at IS NULL
  AND exercise_task_gradings.deleted_at IS NULL
  AND exercises.deleted_at IS NULL;
        ",
        course_id
    )
    .fetch(conn)
}

/// Used to get the necessary info for rendering a submission either when we're viewing a submission, or we're conducting a peer review.
pub async fn get_exercise_task_submission_info_by_exercise_slide_submission_id(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
    viewer_user_id: Uuid,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
    include_deleted_tasks: bool,
) -> ModelResult<Vec<CourseMaterialExerciseTask>> {
    let task_submisssions = crate::exercise_task_submissions::get_by_exercise_slide_submission_id(
        &mut *conn,
        exercise_slide_submission_id,
    )
    .await?;
    let exercise_task_gradings =
        crate::exercise_task_gradings::get_all_gradings_by_exercise_slide_submission_id(
            &mut *conn,
            exercise_slide_submission_id,
        )
        .await?;

    let exercise_tasks = if include_deleted_tasks {
        crate::exercise_tasks::get_exercise_tasks_by_exercise_slide_id_including_deleted::<
            Vec<ExerciseTask>,
        >(&mut *conn, &task_submisssions[0].exercise_slide_id)
        .await?
    } else {
        crate::exercise_tasks::get_exercise_tasks_by_exercise_slide_id::<Vec<ExerciseTask>>(
            &mut *conn,
            &task_submisssions[0].exercise_slide_id,
        )
        .await?
    };

    let mut res = Vec::with_capacity(task_submisssions.len());

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

    for ts in task_submisssions {
        let grading = exercise_task_gradings
            .iter()
            .find(|g| Some(g.id) == ts.exercise_task_grading_id)
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::NotFound,
                    "Grading not found".to_string(),
                    None,
                )
            })?;
        let task = exercise_tasks
            .iter()
            .find(|t| t.id == ts.exercise_task_id)
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::NotFound,
                    "Exercise task not found".to_string(),
                    None,
                )
            })?;
        let (exercise_service, service_info) = exercise_service_slug_to_service_and_info
            .get(&task.exercise_type)
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
        let course_material_exercise_task = CourseMaterialExerciseTask {
            id: task.id,
            exercise_service_slug: task.exercise_type.clone(),
            exercise_slide_id: task.exercise_slide_id,
            exercise_iframe_url: Some(exercise_iframe_url.to_string()),
            pseudonumous_user_id: Some(Uuid::new_v5(
                &service_info.exercise_service_id,
                viewer_user_id.as_bytes(),
            )),
            assignment: task.assignment.clone(),
            public_spec: task.public_spec.clone(),
            model_solution_spec: task.model_solution_spec.clone(),
            previous_submission: Some(ts),
            previous_submission_grading: Some(grading.clone()),
            order_number: task.order_number,
            deleted_at: task.deleted_at,
        };
        res.push(course_material_exercise_task);
    }
    Ok(res)
}

pub async fn get_user_custom_view_exercise_tasks_by_module_and_exercise_type(
    conn: &mut PgConnection,
    exercise_type: &str,
    course_module_id: Uuid,
    user_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<CustomViewExerciseTasks> {
    let task_submissions =
        crate::exercise_task_submissions::get_user_latest_exercise_task_submissions_by_course_module_and_exercise_type(
            &mut *conn,
            user_id,
            exercise_type,
            course_module_id,
            course_instance_id,
        )
        .await?;
    let task_gradings =
        crate::exercise_task_gradings::get_user_exercise_task_gradings_by_module_and_exercise_type(
            &mut *conn,
            user_id,
            exercise_type,
            course_module_id,
            course_instance_id,
        )
        .await?;

    let exercise_tasks = crate::exercise_tasks::get_all_exercise_tasks_by_module_and_exercise_type(
        &mut *conn,
        exercise_type,
        course_module_id,
    )
    .await?;
    let res: CustomViewExerciseTasks = CustomViewExerciseTasks {
        exercise_tasks,
        task_submissions,
        task_gradings,
    };
    Ok(res)
}

/// get all submissions for user and course module and exercise type
pub async fn get_user_latest_exercise_task_submissions_by_course_module_and_exercise_type(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_type: &str,
    module_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<Vec<CustomViewExerciseTaskSubmission>> {
    let res: Vec<CustomViewExerciseTaskSubmission> = sqlx::query_as!(
        CustomViewExerciseTaskSubmission,
        r#"
        SELECT DISTINCT ON (g.exercise_task_id)
        g.id,
        g.created_at,
        g.exercise_slide_submission_id,
        g.exercise_slide_id,
        g.exercise_task_id,
        g.exercise_task_grading_id,
        g.data_json
      FROM exercise_task_submissions g
        JOIN exercise_tasks et ON et.id = g.exercise_task_id
        JOIN exercise_slide_submissions ess ON ess.id = g.exercise_slide_submission_id
        JOIN exercises e ON e.id = ess.exercise_id
        JOIN chapters c ON c.id = e.chapter_id
      WHERE ess.user_id = $1
      AND ess.course_instance_id = $2
      AND et.exercise_type = $3
      AND c.course_module_id = $4
      AND g.deleted_at IS NULL
      AND et.deleted_at IS NULL
      AND ess.deleted_at IS NULL
      AND e.deleted_at IS NULL
      AND c.deleted_at IS NULL
      ORDER BY g.exercise_task_id, g.created_at DESC
      "#,
        user_id,
        course_instance_id,
        exercise_type,
        module_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_ids_by_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        "
SELECT id
FROM exercise_task_submissions
WHERE exercise_slide_submission_id IN (
    SELECT id
    FROM exercise_slide_submissions
    WHERE exercise_id = $1
)
AND deleted_at IS NULL
",
        &exercise_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res.iter().map(|x| x.id).collect())
}

/// Similar to get_ids_by_exercise_id but returns the record with the highest created_at for a user_id
pub async fn get_latest_submission_ids_by_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        "
SELECT id
FROM exercise_task_submissions
WHERE exercise_slide_submission_id IN (SELECT id
    FROM (SELECT DISTINCT ON (user_id, exercise_id) *
        FROM exercise_slide_submissions
        WHERE exercise_id = $1
        AND deleted_at IS NULL
        ORDER BY user_id, exercise_id, created_at DESC) a )
    AND deleted_at IS NULL
",
        &exercise_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res.iter().map(|x| x.id).collect())
}
