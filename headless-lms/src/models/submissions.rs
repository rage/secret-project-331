use anyhow::Result;
use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use super::{courses::Course, exercises::Exercise, gradings::new_grading};

// Represents the subset of page fields that are required to create a new course.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct NewSubmission {
    pub exercise_item_id: Uuid,
    pub data_json: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct Submission {
    pub id: Uuid,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub deleted: bool,
    pub exercise_id: Uuid,
    pub course_id: Uuid,
    pub exercise_item_id: Uuid,
    pub data_json: Option<serde_json::Value>,
    pub grading_id: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct SubmissionCount {
    pub date: Option<NaiveDate>,
    pub count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct SubmissionCountByWeekAndHour {
    pub isodow: Option<i32>,
    pub hour: Option<i32>,
    pub count: Option<i32>,
}

pub async fn insert_submission(
    pool: &PgPool,
    new_submission: NewSubmission,
    exercise: Exercise,
) -> Result<Submission> {
    let mut connection = pool.acquire().await?;
    let submission = sqlx::query_as!(
        Submission,
        r#"
  INSERT INTO
    submissions(exercise_item_id, data_json, exercise_id, course_id)
  VALUES($1, $2, $3, $4)
  RETURNING *
          "#,
        new_submission.exercise_item_id,
        new_submission.data_json,
        exercise.id,
        exercise.course_id
    )
    .fetch_one(&mut connection)
    .await?;
    Ok(submission)
}

pub async fn grade_submission(pool: &PgPool, submission: &Submission) -> Result<()> {
    let grading = new_grading(pool, submission).await?;
    Ok(())
}

pub async fn get_course_daily_submission_counts(
    pool: &PgPool,
    course: &Course,
) -> Result<Vec<SubmissionCount>> {
    let mut connection = pool.acquire().await?;
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
    .fetch_all(&mut connection)
    .await?;
    Ok(res)
}

pub async fn get_course_submission_counts_by_weekday_and_hour(
    pool: &PgPool,
    course: &Course,
) -> Result<Vec<SubmissionCountByWeekAndHour>> {
    let mut connection = pool.acquire().await?;
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
    .fetch_all(&mut connection)
    .await?;
    Ok(res)
}
