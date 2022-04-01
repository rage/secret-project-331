use std::time::Duration;

use futures::Future;
use headless_lms_utils::numbers::f32_to_two_decimals;
use url::Url;

use crate::{
    exams,
    exercise_service_info::get_service_info_by_exercise_type,
    exercise_services::{get_exercise_service_by_exercise_type, get_internal_grade_url},
    exercise_task_submissions::ExerciseTaskSubmission,
    exercise_tasks::ExerciseTask,
    exercises::{Exercise, GradingProgress},
    prelude::*,
    CourseOrExamId,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseTaskGrading {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub exercise_task_submission_id: Uuid,
    pub course_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub exercise_id: Uuid,
    pub exercise_task_id: Uuid,
    pub grading_priority: i32,
    pub score_given: Option<f32>,
    pub grading_progress: GradingProgress,
    pub unscaled_score_given: Option<f32>,
    pub unscaled_score_maximum: Option<i32>,
    pub grading_started_at: Option<DateTime<Utc>>,
    pub grading_completed_at: Option<DateTime<Utc>>,
    pub feedback_json: Option<serde_json::Value>,
    pub feedback_text: Option<String>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, PartialEq, Eq, Clone)]
pub struct ExerciseTaskGradingRequest<'a> {
    pub exercise_spec: &'a Option<serde_json::Value>,
    pub submission_data: &'a Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseTaskGradingResult {
    pub grading_progress: GradingProgress,
    pub score_given: f32,
    pub score_maximum: i32,
    pub feedback_text: Option<String>,
    pub feedback_json: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, sqlx::Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "user_points_update_strategy", rename_all = "kebab-case")]
pub enum UserPointsUpdateStrategy {
    CanAddPointsButCannotRemovePoints,
    CanAddPointsAndCanRemovePoints,
}

pub async fn insert(
    conn: &mut PgConnection,
    submission_id: Uuid,
    course_id: Uuid,
    exercise_id: Uuid,
    exercise_task_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO exercise_task_gradings (
    exercise_task_submission_id,
    course_id,
    exercise_id,
    exercise_task_id
  )
VALUES ($1, $2, $3, $4)
RETURNING id
",
        submission_id,
        course_id,
        exercise_id,
        exercise_task_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<ExerciseTaskGrading> {
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
  unscaled_score_maximum,
  unscaled_score_given,
  grading_started_at,
  grading_completed_at,
  feedback_json,
  feedback_text,
  deleted_at
FROM exercise_task_gradings
WHERE id = $1
"#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_exercise_task_submission_id(
    conn: &mut PgConnection,
    exercise_task_submission_id: &Uuid,
) -> ModelResult<Option<ExerciseTaskGrading>> {
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
  unscaled_score_maximum,
  unscaled_score_given,
  grading_started_at,
  grading_completed_at,
  feedback_json,
  feedback_text,
  deleted_at
FROM exercise_task_gradings
WHERE exercise_task_submission_id = $1
  AND deleted_at IS NULL
        "#,
        exercise_task_submission_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_total_score_given_for_exercise_slide_submission(
    conn: &mut PgConnection,
    exercise_slide_submission_id: &Uuid,
) -> ModelResult<Option<f32>> {
    let res = sqlx::query!(
        "
SELECT SUM(COALESCE(etg.score_given, 0))::real
FROM exercise_task_gradings etg
  JOIN exercise_task_submissions ets ON etg.exercise_task_submission_id = ets.id
WHERE ets.exercise_slide_submission_id = $1
  AND etg.deleted_at IS NULL
  AND ets.deleted_at IS NULL
        ",
        exercise_slide_submission_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.sum)
}

/// For now gets this information from some task submission in a slide submission.
pub async fn get_point_update_strategy_from_gradings(
    conn: &mut PgConnection,
    exercise_slide_submission_id: &Uuid,
) -> ModelResult<GradingProgress> {
    let res = sqlx::query!(
        r#"
SELECT etg.grading_progress as "grading_progress: GradingProgress"
FROM exercise_task_gradings etg
  JOIN exercise_task_submissions ets ON etg.exercise_task_submission_id = ets.id
WHERE ets.exercise_slide_submission_id = $1
  AND etg.deleted_at IS NULL
  AND ets.deleted_at IS NULL
LIMIT 1
    "#,
        exercise_slide_submission_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.grading_progress)
}

pub async fn get_course_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<Option<Uuid>> {
    let course_id = sqlx::query!(
        "
SELECT course_id
from exercise_task_gradings
where id = $1
        ",
        id
    )
    .fetch_one(conn)
    .await?
    .course_id;
    Ok(course_id)
}

pub async fn get_course_or_exam_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<CourseOrExamId> {
    let res = sqlx::query!(
        "
SELECT course_id,
  exam_id
from exercise_task_gradings
where id = $1
",
        id
    )
    .fetch_one(conn)
    .await?;
    CourseOrExamId::from(res.course_id, res.exam_id)
}

pub async fn new_grading(
    conn: &mut PgConnection,
    exercise: &Exercise,
    submission: &ExerciseTaskSubmission,
) -> ModelResult<ExerciseTaskGrading> {
    let grading = sqlx::query_as!(
        ExerciseTaskGrading,
        r#"
INSERT INTO exercise_task_gradings(
    exercise_task_submission_id,
    course_id,
    exam_id,
    exercise_id,
    exercise_task_id,
    grading_started_at
  )
VALUES($1, $2, $3, $4, $5, now())
RETURNING id,
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
"#,
        submission.id,
        exercise.course_id,
        exercise.exam_id,
        exercise.id,
        submission.exercise_task_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(grading)
}

pub async fn set_grading_progress(
    conn: &mut PgConnection,
    id: Uuid,
    grading_progress: GradingProgress,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_task_gradings
SET grading_progress = $1
WHERE id = $2
",
        grading_progress as GradingProgress,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn grade_submission(
    conn: &mut PgConnection,
    submission: &ExerciseTaskSubmission,
    exercise_task: &ExerciseTask,
    exercise: &Exercise,
    grading: &ExerciseTaskGrading,
) -> ModelResult<ExerciseTaskGrading> {
    let exercise_service_info =
        get_service_info_by_exercise_type(conn, &exercise_task.exercise_type).await?;
    let exercise_service =
        get_exercise_service_by_exercise_type(conn, &exercise_task.exercise_type).await?;
    let grade_url = get_internal_grade_url(&exercise_service, &exercise_service_info).await?;
    let obj = send_grading_request(grade_url, exercise_task, submission).await?;
    let updated_grading = update_grading(conn, grading, &obj, exercise).await?;
    Ok(updated_grading)
}

// does not use async fn because the arguments should only be borrowed
// for the part before any async stuff happens
pub fn send_grading_request(
    grade_url: Url,
    exercise_task: &ExerciseTask,
    submission: &ExerciseTaskSubmission,
) -> impl Future<Output = ModelResult<ExerciseTaskGradingResult>> + 'static {
    let client = reqwest::Client::new();
    let req = client
        .post(grade_url)
        .timeout(Duration::from_secs(120))
        .json(&ExerciseTaskGradingRequest {
            exercise_spec: &exercise_task.private_spec,
            submission_data: &submission.data_json,
        });
    async {
        let res = req.send().await?;
        let status = res.status();
        if !status.is_success() {
            let response_body = res.text().await;
            error!(
                ?response_body,
                "Grading request returned an unsuccesful status code"
            );
            return Err(ModelError::Generic("Grading failed".to_string()));
        }
        let obj = res.json::<ExerciseTaskGradingResult>().await?;
        info!("Received a grading result: {:#?}", &obj);
        Ok(obj)
    }
}

pub async fn update_grading(
    conn: &mut PgConnection,
    grading: &ExerciseTaskGrading,
    grading_result: &ExerciseTaskGradingResult,
    exercise: &Exercise,
) -> ModelResult<ExerciseTaskGrading> {
    let grading_completed_at = if grading_result.grading_progress.is_complete() {
        Some(Utc::now())
    } else {
        None
    };
    let correctness_coefficient =
        grading_result.score_given / (grading_result.score_maximum as f32);
    // ensure the score doesn't go over the maximum
    let score_given_with_all_decimals = f32::min(
        (exercise.score_maximum as f32) * correctness_coefficient,
        exercise.score_maximum as f32,
    );
    // Scores are rounded to two decimals
    let score_given_rounded = f32_to_two_decimals(score_given_with_all_decimals);
    let grading = sqlx::query_as!(
        ExerciseTaskGrading,
        r#"
UPDATE exercise_task_gradings
SET grading_progress = $2,
  unscaled_score_given = $3,
  unscaled_score_maximum = $4,
  feedback_text = $5,
  feedback_json = $6,
  grading_completed_at = $7,
  score_given = $8
WHERE id = $1
RETURNING id,
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
"#,
        grading.id,
        grading_result.grading_progress as GradingProgress,
        grading_result.score_given,
        grading_result.score_maximum,
        grading_result.feedback_text,
        grading_result.feedback_json,
        grading_completed_at,
        score_given_rounded
    )
    .fetch_one(conn)
    .await?;

    Ok(grading)
}

/// Fetches the grading for the student, but hides the result in some circumstances.
/// For example, for an ongoing exam.
pub async fn get_for_student(
    conn: &mut PgConnection,
    grading_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Option<ExerciseTaskGrading>> {
    let grading = get_by_id(conn, grading_id).await?;
    if let Some(exam_id) = grading.exam_id {
        let exam = exams::get(conn, exam_id).await?;
        let enrollment = exams::get_enrollment(conn, exam_id, user_id)
            .await?
            .ok_or_else(|| {
                ModelError::Generic("User has grading for exam but no enrollment".to_string())
            })?;
        if Utc::now() > enrollment.started_at + chrono::Duration::minutes(exam.time_minutes.into())
            || exam.ends_at.map(|ea| Utc::now() > ea).unwrap_or_default()
        {
            // exam over, return grading
            Ok(Some(grading))
        } else {
            // exam still ongoing, do not return grading
            Ok(None)
        }
    } else {
        Ok(Some(grading))
    }
}
