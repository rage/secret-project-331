use chrono::NaiveDate;
use serde_json::Value;

use crate::{
    courses::Course,
    exercise_tasks::{
        get_exercise_task_by_id, get_exercise_task_model_solution_spec_by_id, ExerciseTask,
    },
    exercises::{Exercise, GradingProgress},
    gradings::{grade_submission, new_grading, Grading},
    prelude::*,
};

// Represents the subset of page fields that are required to create a new course.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct NewSubmission {
    pub exercise_task_id: Uuid,
    /// Required when submitting non-exam exercises
    pub course_instance_id: Option<Uuid>,
    pub data_json: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct Submission {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub exercise_id: Uuid,
    pub course_id: Option<Uuid>,
    pub course_instance_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub exercise_task_id: Uuid,
    pub data_json: Option<serde_json::Value>,
    pub grading_id: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct SubmissionCount {
    pub date: Option<NaiveDate>,
    pub count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct SubmissionCountByWeekAndHour {
    pub isodow: Option<i32>,
    pub hour: Option<i32>,
    pub count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct SubmissionCountByExercise {
    pub exercise_id: Option<Uuid>,
    pub count: Option<i32>,
    pub exercise_name: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq, Clone)]
pub struct GradingRequest<'a> {
    pub exercise_spec: &'a Option<serde_json::Value>,
    pub submission_data: &'a Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct GradingResult {
    pub grading_progress: GradingProgress,
    pub score_given: f32,
    pub score_maximum: i32,
    pub feedback_text: Option<String>,
    pub feedback_json: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, TS)]
pub struct SubmissionResult {
    pub submission: Submission,
    pub grading: Option<Grading>,
    pub model_solution_spec: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, TS)]
pub struct SubmissionInfo {
    pub submission: Submission,
    pub exercise: Exercise,
    pub exercise_task: ExerciseTask,
    pub grading: Option<Grading>,
    pub iframe_path: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, TS)]
pub struct SubmissionData {
    pub exercise_id: Uuid,
    pub course_id: Uuid,
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
) -> ModelResult<Submission> {
    let res = sqlx::query_as!(
        Submission,
        "
SELECT *
FROM submissions
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
INSERT INTO submissions (
    exercise_id,
    course_id,
    exercise_task_id,
    user_id,
    course_instance_id,
    data_json,
    id
  )
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id
",
        submission_data.exercise_id,
        submission_data.course_id,
        submission_data.exercise_task_id,
        submission_data.user_id,
        submission_data.course_instance_id,
        submission_data.data_json,
        submission_data.id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn insert(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    course_id: Uuid,
    exercise_task_id: Uuid,
    user_id: Uuid,
    course_instance_id: Uuid,
    data_json: Value,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO submissions (
    exercise_id,
    course_id,
    exercise_task_id,
    user_id,
    course_instance_id,
    data_json
  )
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING id
",
        exercise_id,
        course_id,
        exercise_task_id,
        user_id,
        course_instance_id,
        data_json,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Submission> {
    let submission = sqlx::query_as!(
        Submission,
        "
SELECT *
FROM submissions
WHERE id = $1
",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(submission)
}

pub async fn get_course_and_exam_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<(Option<Uuid>, Option<Uuid>)> {
    let res = sqlx::query!(
        "SELECT course_id, exam_id FROM submissions WHERE id = $1",
        id
    )
    .fetch_one(conn)
    .await?;
    Ok((res.course_id, res.exam_id))
}

pub async fn exercise_submission_count(
    conn: &mut PgConnection,
    exercise_id: &Uuid,
) -> ModelResult<u32> {
    let count = sqlx::query!(
        "SELECT COUNT(*) as count FROM submissions WHERE exercise_id = $1",
        exercise_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(count.count.unwrap_or(0).try_into()?)
}

pub async fn exercise_submissions(
    conn: &mut PgConnection,
    exercise_id: &Uuid,
    pagination: &Pagination,
) -> ModelResult<Vec<Submission>> {
    let submissions = sqlx::query_as!(
        Submission,
        r#"
SELECT *
FROM submissions
WHERE exercise_id = $1
  AND deleted_at IS NULL
LIMIT $2
OFFSET $3;
        "#,
        exercise_id,
        pagination.limit(),
        pagination.offset(),
    )
    .fetch_all(conn)
    .await?;
    Ok(submissions)
}

pub async fn get_user_exercise_submissions(
    conn: &mut PgConnection,
    user_id: &Uuid,
    exercise_id: &Uuid,
    pagination: &Pagination,
) -> ModelResult<Vec<Submission>> {
    let submissions = sqlx::query_as!(
        Submission,
        r#"
SELECT *
FROM submissions
WHERE exercise_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
LIMIT $3
OFFSET $4;
        "#,
        exercise_id,
        user_id,
        pagination.limit(),
        pagination.offset(),
    )
    .fetch_all(conn)
    .await?;
    Ok(submissions)
}

pub async fn get_latest_user_exercise_submission(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
) -> ModelResult<Option<Submission>> {
    let submission = sqlx::query_as!(
        Submission,
        r#"
SELECT *
FROM submissions
WHERE exercise_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 1
"#,
        exercise_id,
        user_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(submission)
}

pub async fn insert_submission(
    conn: &mut PgConnection,
    new_submission: &NewSubmission,
    user_id: Uuid,
    exercise: &Exercise,
) -> ModelResult<SubmissionResult> {
    let submission = sqlx::query_as!(
        Submission,
        r#"
INSERT INTO submissions(
    exercise_task_id,
    data_json,
    exercise_id,
    course_id,
    user_id,
    course_instance_id,
    exam_id
  )
VALUES($1, $2, $3, $4, $5, $6, $7)
RETURNING *
"#,
        new_submission.exercise_task_id,
        new_submission.data_json,
        exercise.id,
        exercise.course_id,
        user_id,
        new_submission.course_instance_id,
        exercise.exam_id,
    )
    .fetch_one(&mut *conn)
    .await?;
    let exercise_task = get_exercise_task_by_id(conn, submission.exercise_task_id).await?;
    let grading = new_grading(conn, &submission).await?;
    let updated_submission = sqlx::query_as!(
        Submission,
        "UPDATE submissions SET grading_id = $1 WHERE id = $2 RETURNING *",
        grading.id,
        submission.id
    )
    .fetch_one(&mut *conn)
    .await?;
    let grading = grade_submission(conn, &submission, &exercise_task, exercise, &grading).await?;

    let model_solution_spec =
        get_exercise_task_model_solution_spec_by_id(conn, submission.exercise_task_id).await?;

    Ok(SubmissionResult {
        submission: updated_submission,
        grading: Some(grading),
        model_solution_spec,
    })
}

pub async fn get_course_daily_submission_counts(
    conn: &mut PgConnection,
    course: &Course,
) -> ModelResult<Vec<SubmissionCount>> {
    let res = sqlx::query_as!(
        SubmissionCount,
        r#"
SELECT DATE(created_at) date, count(*)::integer
FROM submissions
WHERE course_id = $1
GROUP BY date
ORDER BY date;
          "#,
        course.id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_course_submission_counts_by_weekday_and_hour(
    conn: &mut PgConnection,
    course: &Course,
) -> ModelResult<Vec<SubmissionCountByWeekAndHour>> {
    let res = sqlx::query_as!(
        SubmissionCountByWeekAndHour,
        r#"
SELECT date_part('isodow', created_at)::integer isodow, date_part('hour', created_at)::integer "hour", count(*)::integer
FROM submissions
WHERE course_id = $1
GROUP BY isodow, "hour"
ORDER BY isodow, hour;
          "#,
        course.id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_course_submission_counts_by_exercise(
    conn: &mut PgConnection,
    course: &Course,
) -> ModelResult<Vec<SubmissionCountByExercise>> {
    let res = sqlx::query_as!(
        SubmissionCountByExercise,
        r#"
SELECT counts.*, exercises.name exercise_name
    FROM (
        SELECT exercise_id, count(*)::integer count
        FROM submissions
        WHERE course_id = $1
        GROUP BY exercise_id
    ) counts
    JOIN exercises ON (counts.exercise_id = exercises.id);
          "#,
        course.id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn set_grading_id(
    conn: &mut PgConnection,
    grading_id: Uuid,
    submission_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE submissions
SET grading_id = $1
WHERE id = $2
",
        grading_id,
        submission_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub fn stream_exam_submissions(
    conn: &mut PgConnection,
    exam_id: Uuid,
) -> impl Stream<Item = sqlx::Result<ExportedSubmission>> + '_ {
    sqlx::query_as!(
        ExportedSubmission,
        "
SELECT submissions.id,
  user_id,
  submissions.created_at,
  submissions.exercise_id,
  submissions.exercise_task_id,
  gradings.score_given,
  submissions.data_json
FROM submissions
  JOIN gradings on submissions.grading_id = gradings.id
  JOIN exercises on submissions.exercise_id = exercises.id
WHERE submissions.exam_id = $1
  AND submissions.deleted_at IS NULL
  AND gradings.deleted_at IS NULL
  AND exercises.deleted_at IS NULL;
",
        exam_id
    )
    .fetch(conn)
}
