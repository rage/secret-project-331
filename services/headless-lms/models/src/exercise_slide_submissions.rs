use std::collections::HashMap;

use chrono::NaiveDate;

use crate::{
    courses::Course,
    exercise_task_gradings::UserPointsUpdateStrategy,
    exercise_tasks::CourseMaterialExerciseTask,
    exercises::Exercise,
    prelude::*,
    user_exercise_states::{CourseInstanceOrExamId, UserExerciseState},
    CourseOrExamId,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewExerciseSlideSubmission {
    pub exercise_slide_id: Uuid,
    pub course_id: Option<Uuid>,
    pub course_instance_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub user_id: Uuid,
    pub exercise_id: Uuid,
    pub user_points_update_strategy: UserPointsUpdateStrategy,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
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
    pub user_points_update_strategy: UserPointsUpdateStrategy,
}

impl ExerciseSlideSubmission {
    pub fn get_course_instance_id(&self) -> ModelResult<Uuid> {
        self.course_instance_id.ok_or_else(|| {
            ModelError::Generic("Submission is not related to a course instance.".to_string())
        })
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseAnswersInCourseRequiringAttentionCount {
    pub exercise_id: Uuid,
    pub count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseSlideSubmissionCount {
    pub date: Option<NaiveDate>,
    pub count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseSlideSubmissionCountByExercise {
    pub exercise_id: Option<Uuid>,
    pub count: Option<i32>,
    pub exercise_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseSlideSubmissionCountByWeekAndHour {
    pub isodow: Option<i32>,
    pub hour: Option<i32>,
    pub count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseSlideSubmissionInfo {
    pub tasks: Vec<CourseMaterialExerciseTask>,
    pub exercise: Exercise,
    pub exercise_slide_submission: ExerciseSlideSubmission,
}

pub async fn insert_exercise_slide_submission(
    conn: &mut PgConnection,
    exercise_slide_submission: NewExerciseSlideSubmission,
) -> ModelResult<ExerciseSlideSubmission> {
    let res = sqlx::query_as!(
        ExerciseSlideSubmission,
        r#"
INSERT INTO exercise_slide_submissions (
    exercise_slide_id,
    course_id,
    course_instance_id,
    exam_id,
    exercise_id,
    user_id,
    user_points_update_strategy
  )
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id,
  created_at,
  updated_at,
  deleted_at,
  exercise_slide_id,
  course_id,
  course_instance_id,
  exam_id,
  exercise_id,
  user_id,
  user_points_update_strategy AS "user_points_update_strategy: _"
        "#,
        exercise_slide_submission.exercise_slide_id,
        exercise_slide_submission.course_id,
        exercise_slide_submission.course_instance_id,
        exercise_slide_submission.exam_id,
        exercise_slide_submission.exercise_id,
        exercise_slide_submission.user_id,
        exercise_slide_submission.user_points_update_strategy as UserPointsUpdateStrategy,
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
        r#"
INSERT INTO exercise_slide_submissions (
    id,
    exercise_slide_id,
    course_id,
    course_instance_id,
    exam_id,
    exercise_id,
    user_id,
    user_points_update_strategy
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id,
  created_at,
  updated_at,
  deleted_at,
  exercise_slide_id,
  course_id,
  course_instance_id,
  exam_id,
  exercise_id,
  user_id,
  user_points_update_strategy AS "user_points_update_strategy: _"
        "#,
        id,
        exercise_slide_submission.exercise_slide_id,
        exercise_slide_submission.course_id,
        exercise_slide_submission.course_instance_id,
        exercise_slide_submission.exam_id,
        exercise_slide_submission.exercise_id,
        exercise_slide_submission.user_id,
        exercise_slide_submission.user_points_update_strategy as UserPointsUpdateStrategy,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<ExerciseSlideSubmission> {
    let exercise_slide_submission = sqlx::query_as!(
        ExerciseSlideSubmission,
        r#"
SELECT id,
created_at,
updated_at,
deleted_at,
exercise_slide_id,
course_id,
course_instance_id,
exam_id,
exercise_id,
user_id,
user_points_update_strategy AS "user_points_update_strategy: _"
FROM exercise_slide_submissions
WHERE id = $1
  AND deleted_at IS NULL;
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(exercise_slide_submission)
}

/// Attempts to find a single random `ExerciseSlideSubmission` that is not related to the provided user.
///
/// This function is mostly provided for very specific peer review purposes.
pub async fn try_to_get_random_filtered_by_user_and_submissions(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    excluded_user_id: Uuid,
    excluded_ids: &[Uuid],
) -> ModelResult<Option<ExerciseSlideSubmission>> {
    // TODO: Filter to only latest submission per student.
    let res = sqlx::query_as!(
        ExerciseSlideSubmission,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  exercise_slide_id,
  course_id,
  course_instance_id,
  exam_id,
  exercise_id,
  user_id,
  user_points_update_strategy AS "user_points_update_strategy: _"
FROM exercise_slide_submissions
WHERE exercise_id = $1
  AND id <> ALL($2)
  AND user_id <> $3
  AND deleted_at IS NULL
ORDER BY random() ASC
        "#,
        exercise_id,
        excluded_ids,
        excluded_user_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    pagination: Pagination,
) -> ModelResult<Vec<ExerciseSlideSubmission>> {
    let submissions = sqlx::query_as!(
        ExerciseSlideSubmission,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  exercise_slide_id,
  course_id,
  course_instance_id,
  exam_id,
  exercise_id,
  user_id,
  user_points_update_strategy AS "user_points_update_strategy: _"
FROM exercise_slide_submissions
WHERE exercise_id = $1
  AND deleted_at IS NULL
LIMIT $2 OFFSET $3;
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
    exercise_slide_id: Uuid,
    user_id: Uuid,
) -> ModelResult<ExerciseSlideSubmission> {
    let res = sqlx::query_as!(
        ExerciseSlideSubmission,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  exercise_slide_id,
  course_id,
  course_instance_id,
  exam_id,
  exercise_id,
  user_id,
  user_points_update_strategy AS "user_points_update_strategy: _"
FROM exercise_slide_submissions
WHERE exercise_slide_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 1
        "#,
        exercise_slide_id,
        user_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn try_to_get_users_latest_exercise_slide_submission(
    conn: &mut PgConnection,
    exercise_slide_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Option<ExerciseSlideSubmission>> {
    get_users_latest_exercise_slide_submission(conn, exercise_slide_id, user_id)
        .await
        .optional()
}

pub async fn get_course_and_exam_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<CourseOrExamId> {
    let res = sqlx::query!(
        "
SELECT course_id,
  exam_id
FROM exercise_slide_submissions
WHERE id = $1
  AND deleted_at IS NULL
        ",
        id
    )
    .fetch_one(conn)
    .await?;
    CourseOrExamId::from(res.course_id, res.exam_id)
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

pub async fn exercise_slide_submissions(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    pagination: Pagination,
) -> ModelResult<Vec<ExerciseSlideSubmission>> {
    let submissions = sqlx::query_as!(
        ExerciseSlideSubmission,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  exercise_slide_id,
  course_id,
  course_instance_id,
  exam_id,
  exercise_id,
  user_id,
  user_points_update_strategy AS "user_points_update_strategy: _"
FROM exercise_slide_submissions
WHERE exercise_id = $1
  AND deleted_at IS NULL
LIMIT $2 OFFSET $3
        "#,
        exercise_id,
        pagination.limit(),
        pagination.offset(),
    )
    .fetch_all(conn)
    .await?;
    Ok(submissions)
}

pub async fn get_course_daily_slide_submission_counts(
    conn: &mut PgConnection,
    course: &Course,
) -> ModelResult<Vec<ExerciseSlideSubmissionCount>> {
    let res = sqlx::query_as!(
        ExerciseSlideSubmissionCount,
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

pub async fn answer_requiring_attention_count(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<u32> {
    let count = sqlx::query!(
        r#"
        SELECT
        COUNT(*) as count
    FROM user_exercise_states AS us_state
    JOIN exercise_task_submissions AS t_submission
        ON us_state.selected_exercise_slide_id =
            t_submission.exercise_slide_id
    JOIN exercise_slide_submissions AS s_submission
            ON t_submission.exercise_slide_submission_id =
                s_submission.id
    WHERE us_state.selected_exercise_slide_id =
            t_submission.exercise_slide_id
    AND us_state.user_id = s_submission.user_id
    AND us_state.exercise_id = $1
    AND us_state.reviewing_stage = 'waiting_for_manual_grading'
    AND us_state.deleted_at IS NULL;"#,
        exercise_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(count.count.unwrap_or(0).try_into()?)
}

pub async fn get_count_of_answers_requiring_attention_in_exercise_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<ExerciseAnswersInCourseRequiringAttentionCount>> {
    let count_list = sqlx::query_as!(
        ExerciseAnswersInCourseRequiringAttentionCount,
        r#"
        SELECT
        us_state.exercise_id, COUNT(us_state.exercise_id)::integer as count
    FROM user_exercise_states AS us_state
    JOIN exercise_task_submissions AS t_submission
        ON us_state.selected_exercise_slide_id =
            t_submission.exercise_slide_id
    JOIN exercise_slide_submissions AS s_submission
            ON t_submission.exercise_slide_submission_id =
                s_submission.id
    WHERE us_state.selected_exercise_slide_id =
            t_submission.exercise_slide_id
    AND us_state.user_id = s_submission.user_id
    AND s_submission.course_id = $1
    AND us_state.reviewing_stage = 'waiting_for_manual_grading'
    AND us_state.deleted_at IS NULL
    GROUP BY us_state.exercise_id;"#,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(count_list)
}

pub async fn exercise_slide_submissions_for_answers_requiring_attention(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    pagination: Pagination,
) -> ModelResult<Vec<ExerciseSlideSubmission>> {
    let submissions = sqlx::query_as!(
        ExerciseSlideSubmission,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  exercise_slide_id,
  course_id,
  course_instance_id,
  exam_id,
  exercise_id,
  user_id,
  user_points_update_strategy AS "user_points_update_strategy: _"
FROM exercise_slide_submissions
WHERE exercise_id = $1
  AND deleted_at IS NULL
LIMIT $2 OFFSET $3
        "#,
        exercise_id,
        pagination.limit(),
        pagination.offset(),
    )
    .fetch_all(conn)
    .await?;
    Ok(submissions)
}

pub async fn get_course_exercise_slide_submission_counts_by_weekday_and_hour(
    conn: &mut PgConnection,
    course: &Course,
) -> ModelResult<Vec<ExerciseSlideSubmissionCountByWeekAndHour>> {
    let res = sqlx::query_as!(
        ExerciseSlideSubmissionCountByWeekAndHour,
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
) -> ModelResult<Vec<ExerciseSlideSubmissionCountByExercise>> {
    let res = sqlx::query_as!(
        ExerciseSlideSubmissionCountByExercise,
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

pub async fn get_exercise_slide_submission_counts_for_exercise_user(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    course_instance_id_or_exam_id: CourseInstanceOrExamId,
    user_id: Uuid,
) -> ModelResult<HashMap<Uuid, i64>> {
    let ci_id_or_e_id = match course_instance_id_or_exam_id {
        CourseInstanceOrExamId::Instance(id) => id,
        CourseInstanceOrExamId::Exam(id) => id,
    };
    let res = sqlx::query!(
        r#"
SELECT exercise_slide_id,
  COUNT(*) as count
FROM exercise_slide_submissions
WHERE exercise_id = $1
  AND (course_instance_id = $2 OR exam_id = $2)
  AND user_id = $3
  AND deleted_at IS NULL
GROUP BY exercise_slide_id;
    "#,
        exercise_id,
        ci_id_or_e_id,
        user_id
    )
    .fetch_all(conn)
    .await?
    .iter()
    .map(|row| (row.exercise_slide_id, row.count.unwrap_or(0)))
    .collect::<HashMap<Uuid, i64>>();

    Ok(res)
}

pub async fn get_exercise_slide_submission_info(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<ExerciseSlideSubmissionInfo> {
    let exercise_slide_submission = get_by_id(&mut *conn, exercise_slide_submission_id).await?;
    let exercise =
        crate::exercises::get_by_id(&mut *conn, exercise_slide_submission.exercise_id).await?;
    let tasks = crate::exercise_task_submissions::get_exercise_task_submission_info_by_exercise_slide_submission_id(&mut *conn, exercise_slide_submission_id).await?;
    Ok(ExerciseSlideSubmissionInfo {
        exercise,
        tasks,
        exercise_slide_submission,
    })
}

pub async fn update_user_exercise_state(
    conn: &mut PgConnection,
    user_exercise_state_id: Uuid,
    max_points: f32,
) -> ModelResult<UserExerciseState> {
    let res = sqlx::query_as!(
        UserExerciseState,
        r#"
        UPDATE user_exercise_states SET reviewing_stage='reviewed_and_locked', score_given=$2 WHERE id=$1 RETURNING
        id,
        user_id,
        exercise_id,
        course_instance_id,
        exam_id,
        created_at,
        updated_at,
        deleted_at,
        score_given,
        grading_progress AS "grading_progress: _",
        activity_progress AS "activity_progress: _",
        reviewing_stage AS "reviewing_stage: _",
        selected_exercise_slide_id;
        "#,
        user_exercise_state_id,
        max_points
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_exercise_slide_submission_info(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
) -> ModelResult<ExerciseSlideSubmissionInfo> {
    let exercise_slide_submission = get_by_id(&mut *conn, exercise_slide_submission_id).await?;
    let exercise =
        crate::exercises::get_by_id(&mut *conn, exercise_slide_submission.exercise_id).await?;
    let tasks = crate::exercise_task_submissions::get_exercise_task_submission_info_by_exercise_slide_submission_id(&mut *conn, exercise_slide_submission_id).await?;
    Ok(ExerciseSlideSubmissionInfo {
        exercise,
        tasks,
        exercise_slide_submission,
    })
}
