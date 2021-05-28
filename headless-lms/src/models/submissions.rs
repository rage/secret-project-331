use std::time::Duration;

use crate::models::{exercise_items::get_exercise_item_by_id, gradings::update_grading};

use super::{
    courses::Course,
    exercise_items::ExerciseItem,
    exercises::{Exercise, GradingProgress},
    gradings::{new_grading, Grading},
};
use anyhow::Result;
use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct SubmissionResult {
    submission: Submission,
    grading: Grading,
}

pub async fn insert_submission(
    pool: &PgPool,
    new_submission: NewSubmission,
    user_id: Uuid,
    exercise: Exercise,
) -> Result<SubmissionResult> {
    let mut connection = pool.acquire().await?;
    let submission = sqlx::query_as!(
        Submission,
        r#"
  INSERT INTO
    submissions(exercise_item_id, data_json, exercise_id, course_id, user_id)
  VALUES($1, $2, $3, $4, $5)
  RETURNING *
          "#,
        new_submission.exercise_item_id,
        new_submission.data_json,
        exercise.id,
        exercise.course_id,
        user_id
    )
    .fetch_one(&mut connection)
    .await?;
    let exercise_item = get_exercise_item_by_id(pool, submission.exercise_item_id).await?;
    let grading = new_grading(pool, &submission).await?;
    let updated_submission = sqlx::query_as!(
        Submission,
        "UPDATE submissions SET grading_id = $1 WHERE id = $2 RETURNING *",
        grading.id,
        submission.id
    )
    .fetch_one(&mut connection)
    .await?;
    let updated_grading =
        grade_submission(pool, submission.clone(), exercise_item, exercise, grading).await?;

    Ok(SubmissionResult {
        submission: updated_submission,
        grading: updated_grading,
    })
}

pub async fn grade_submission(
    pool: &PgPool,
    submission: Submission,
    exercise_item: ExerciseItem,
    exercise: Exercise,
    grading: Grading,
) -> Result<Grading> {
    let client = reqwest::Client::new();
    let res = client
        .post("http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/grade")
        .timeout(Duration::from_secs(120))
        .json(&GradingRequest {
            exercise_spec: exercise_item.private_spec,
            submission_data: submission.data_json,
        })
        .send()
        .await?;
    let status = res.status();
    if !status.is_success() {
        // failed
    }
    let obj = res.json::<GradingResult>().await?;
    println!("{:#?}", &obj);
    let updated_grading = update_grading(&pool, grading, obj, exercise).await?;
    Ok(updated_grading)
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

pub async fn get_course_submission_counts_by_exercise(
    pool: &PgPool,
    course: &Course,
) -> Result<Vec<SubmissionCountByExercise>> {
    let mut connection = pool.acquire().await?;
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
    .fetch_all(&mut connection)
    .await?;
    Ok(res)
}
