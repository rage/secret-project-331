use super::{
    courses::Course,
    exercise_tasks::ExerciseTask,
    exercises::{Exercise, GradingProgress},
    gradings::{new_grading, Grading},
    ModelResult,
};
use crate::{
    models::{exercise_tasks::get_exercise_task_by_id, gradings::grade_submission},
    utils::pagination::Pagination,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgConnection;
use ts_rs::TS;
use uuid::Uuid;

// Represents the subset of page fields that are required to create a new course.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct NewSubmission {
    pub exercise_task_id: Uuid,
    pub course_instance_id: Uuid,
    pub data_json: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct Submission {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub exercise_id: Uuid,
    pub course_id: Uuid,
    pub course_instance_id: Uuid,
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct GradingRequest {
    pub exercise_spec: Option<serde_json::Value>,
    pub submission_data: Option<serde_json::Value>,
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
    submission: Submission,
    grading: Grading,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, TS)]
pub struct SubmissionInfo {
    pub submission: Submission,
    pub exercise: Exercise,
    pub exercise_task: ExerciseTask,
    pub grading: Option<Grading>,
    pub submission_iframe_path: String,
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
        data_json
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

pub async fn get_course_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Uuid> {
    let course_id = sqlx::query!("SELECT course_id FROM submissions WHERE id = $1", id)
        .fetch_one(conn)
        .await?
        .course_id;
    Ok(course_id)
}

pub async fn exercise_submission_count(
    conn: &mut PgConnection,
    exercise_id: &Uuid,
) -> ModelResult<i64> {
    let count = sqlx::query!(
        "SELECT COUNT(*) as count FROM submissions WHERE exercise_id = $1",
        exercise_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(count.count.unwrap_or(0))
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

pub async fn insert_submission(
    conn: &mut PgConnection,
    new_submission: NewSubmission,
    user_id: Uuid,
    exercise: Exercise,
) -> ModelResult<SubmissionResult> {
    let submission = sqlx::query_as!(
        Submission,
        r#"
  INSERT INTO
    submissions(exercise_task_id, data_json, exercise_id, course_id, user_id, course_instance_id)
  VALUES($1, $2, $3, $4, $5, $6)
  RETURNING *
          "#,
        new_submission.exercise_task_id,
        new_submission.data_json,
        exercise.id,
        exercise.course_id,
        user_id,
        new_submission.course_instance_id
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
    let updated_grading =
        grade_submission(conn, submission.clone(), exercise_task, exercise, grading).await?;

    Ok(SubmissionResult {
        submission: updated_submission,
        grading: updated_grading,
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
