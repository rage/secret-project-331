use std::collections::HashMap;

use crate::{
    courses::Course,
    exercise_task_submissions::{
        self, StudentExerciseTaskSubmission, SubmissionCount, SubmissionCountByExercise,
        SubmissionCountByWeekAndHour, SubmissionResult,
    },
    exercise_tasks::{self, ExerciseTask},
    exercises::Exercise,
    prelude::*,
    user_exercise_states::{self, UserExerciseState},
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct NewExerciseSlideSubmission {
    pub exercise_slide_id: Uuid,
    pub course_id: Option<Uuid>,
    pub course_instance_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub exercise_id: Uuid,
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct ExerciseSlideSubmission {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub exercise_slide_id: Uuid,
    pub course_id: Option<Uuid>,
    pub course_instance_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub exercise_id: Uuid,
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, TS)]
pub struct ExerciseSlideSubmissionResult {
    pub exercise_task_submission_results: Vec<SubmissionResult>,
}

/// Contains data sent by the student when they make a submission for an exercise slide.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct StudentExerciseSlideSubmission {
    exercise_slide_id: Uuid,
    exercise_task_submissions: Vec<StudentExerciseTaskSubmission>,
}

pub async fn insert_exercise_slide_submission(
    conn: &mut PgConnection,
    exercise_slide_submission: NewExerciseSlideSubmission,
) -> ModelResult<ExerciseSlideSubmission> {
    let res = sqlx::query_as!(
        ExerciseSlideSubmission,
        "
INSERT INTO exercise_slide_submissions (
    exercise_slide_id,
    course_id,
    course_instance_id,
    exam_id,
    exercise_id,
    user_id
  )
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *
        ",
        exercise_slide_submission.exercise_slide_id,
        exercise_slide_submission.course_id,
        exercise_slide_submission.course_instance_id,
        exercise_slide_submission.exam_id,
        exercise_slide_submission.exercise_id,
        exercise_slide_submission.user_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn insert_exercise_slide_submission_with_id(
    conn: &mut PgConnection,
    id: Uuid,
    exercise_slide_submission: &NewExerciseSlideSubmission,
) -> ModelResult<ExerciseSlideSubmission> {
    let res = sqlx::query_as!(
        ExerciseSlideSubmission,
        "
INSERT INTO exercise_slide_submissions (
    id,
    exercise_slide_id,
    course_id,
    course_instance_id,
    exam_id,
    exercise_id,
    user_id
  )
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *
        ",
        id,
        exercise_slide_submission.exercise_slide_id,
        exercise_slide_submission.course_id,
        exercise_slide_submission.course_instance_id,
        exercise_slide_submission.exam_id,
        exercise_slide_submission.exercise_id,
        exercise_slide_submission.user_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn create_exercise_slide_submission_for_exercise(
    conn: &mut PgConnection,
    exercise: &Exercise,
    user_exercise_state: &UserExerciseState,
    user_exercise_slide_submission: StudentExerciseSlideSubmission,
) -> ModelResult<ExerciseSlideSubmissionResult> {
    let selected_exercise_slide_id =
        user_exercise_state
            .selected_exercise_slide_id
            .ok_or_else(|| {
                ModelError::PreconditionFailed(
                    "Exercise slide not selected for the student.".to_string(),
                )
            })?;
    let exercise_tasks: HashMap<Uuid, ExerciseTask> =
        exercise_tasks::get_exercise_tasks_by_exercise_slide_id(conn, &selected_exercise_slide_id)
            .await?;
    let user_exercise_task_submissions = user_exercise_slide_submission.exercise_task_submissions;

    let mut tx = conn.begin().await?;
    let mut results = Vec::with_capacity(user_exercise_task_submissions.len());

    // Exercise is only needed for course id here.
    let new_exercise_slide_submission = NewExerciseSlideSubmission {
        exercise_slide_id: selected_exercise_slide_id,
        course_id: exercise.course_id,
        course_instance_id: user_exercise_state.course_instance_id,
        exam_id: user_exercise_state.exam_id,
        exercise_id: user_exercise_state.exercise_id,
        user_id: user_exercise_state.user_id,
    };
    let exercise_slide_submission =
        insert_exercise_slide_submission(&mut tx, new_exercise_slide_submission).await?;
    for task_submission in user_exercise_task_submissions {
        let exercise_task = exercise_tasks
            .get(&task_submission.exercise_task_id)
            .ok_or_else(|| {
                ModelError::PreconditionFailed(
                    "Attempting to submit exercise for illegal exercise_task_id.".to_string(),
                )
            })?;
        let submission = exercise_task_submissions::create_exercise_task_submission_for_exercise(
            &mut tx,
            exercise,
            exercise_task,
            exercise_slide_submission.id,
            task_submission.data_json,
        )
        .await?;
        results.push(submission)
    }

    user_exercise_states::update_user_exercise_state_after_submission(
        &mut tx,
        &exercise_slide_submission,
    )
    .await?;
    tx.commit().await?;
    Ok(ExerciseSlideSubmissionResult {
        exercise_task_submission_results: results,
    })
}

pub async fn get_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<Option<ExerciseSlideSubmission>> {
    let exercise_slide_submission = sqlx::query_as!(
        ExerciseSlideSubmission,
        "
SELECT *
FROM exercise_slide_submissions
WHERE id = $1
  AND deleted_at IS NULL;
        ",
        id
    )
    .fetch_optional(conn)
    .await?;
    Ok(exercise_slide_submission)
}

pub async fn get_by_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    pagination: Pagination,
) -> ModelResult<Vec<ExerciseSlideSubmission>> {
    let submissions = sqlx::query_as!(
        ExerciseSlideSubmission,
        r#"
SELECT *
FROM exercise_slide_submissions
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

pub async fn get_users_latest_exercise_slide_submission(
    conn: &mut PgConnection,
    exercise_slide_id: &Uuid,
    user_id: &Uuid,
) -> ModelResult<Option<ExerciseSlideSubmission>> {
    let res = sqlx::query_as!(
        ExerciseSlideSubmission,
        "
SELECT *
FROM exercise_slide_submissions
WHERE exercise_slide_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 1
    ",
        exercise_slide_id,
        user_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn exercise_slide_submission_count(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<u32> {
    let count = sqlx::query!(
        "
SELECT COUNT(*) as count
FROM exercise_slide_submissions
WHERE exercise_id = $1
",
        exercise_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(count.count.unwrap_or(0).try_into()?)
}

pub async fn get_course_daily_slide_submission_counts(
    conn: &mut PgConnection,
    course: &Course,
) -> ModelResult<Vec<SubmissionCount>> {
    let res = sqlx::query_as!(
        SubmissionCount,
        r#"
SELECT DATE(created_at) date, count(*)::integer
FROM exercise_slide_submissions
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

pub async fn get_course_exercise_slide_submission_counts_by_weekday_and_hour(
    conn: &mut PgConnection,
    course: &Course,
) -> ModelResult<Vec<SubmissionCountByWeekAndHour>> {
    let res = sqlx::query_as!(
        SubmissionCountByWeekAndHour,
        r#"
SELECT date_part('isodow', created_at)::integer isodow,
  date_part('hour', created_at)::integer "hour",
  count(*)::integer
FROM exercise_slide_submissions
WHERE course_id = $1
GROUP BY isodow,
  "hour"
ORDER BY isodow,
  hour;
          "#,
        course.id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_course_exercise_slide_submission_counts_by_exercise(
    conn: &mut PgConnection,
    course: &Course,
) -> ModelResult<Vec<SubmissionCountByExercise>> {
    let res = sqlx::query_as!(
        SubmissionCountByExercise,
        r#"
SELECT counts.*, exercises.name exercise_name
    FROM (
        SELECT exercise_id, count(*)::integer count
        FROM exercise_slide_submissions
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
