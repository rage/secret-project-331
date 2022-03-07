use futures::Stream;
use serde_json::Value;

use crate::{
    exercise_slide_submissions, exercise_task_gradings::ExerciseTaskGrading,
    exercise_tasks::ExerciseTask, exercises::Exercise, prelude::*, CourseOrExamId,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, TS)]
pub struct SubmissionInfo {
    pub submission: ExerciseTaskSubmission,
    pub exercise: Exercise,
    pub exercise_task: ExerciseTask,
    pub grading: Option<ExerciseTaskGrading>,
    pub iframe_path: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, TS)]
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, TS)]
pub struct ExportedSubmission {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
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
    exercise_slide_submission_id: Uuid,
    exercise_slide_id: Uuid,
    exercise_task_id: Uuid,
    data_json: Value,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercise_task_submissions (
    exercise_slide_submission_id,
    exercise_slide_id,
    exercise_task_id,
    data_json
  )
  VALUES ($1, $2, $3, $4)
  RETURNING id
",
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
  AND deleted_at IS NULL
        ",
        exercise_slide_submission_id
    )
    .fetch_all(conn)
    .await?;
    Ok(submissions)
}

pub async fn get_users_latest_exercise_task_submissions_for_exercise_slide(
    conn: &mut PgConnection,
    exercise_slide_id: &Uuid,
    user_id: &Uuid,
) -> ModelResult<Option<Vec<ExerciseTaskSubmission>>> {
    let exercise_slide_submission =
        exercise_slide_submissions::get_users_latest_exercise_slide_submission(
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
