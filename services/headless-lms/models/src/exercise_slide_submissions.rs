use std::collections::HashMap;

use chrono::NaiveDate;
use futures::future::BoxFuture;
use rand::prelude::SliceRandom;
use url::Url;

use crate::{
    CourseOrExamId,
    courses::Course,
    exams::{self, ExamEnrollment},
    exercise_service_info::ExerciseServiceInfoApi,
    exercise_task_gradings::UserPointsUpdateStrategy,
    exercise_tasks::CourseMaterialExerciseTask,
    exercises::{self, Exercise, GradingProgress},
    prelude::*,
    teacher_grading_decisions::{self, TeacherGradingDecision},
    user_exercise_states::{self, CourseInstanceOrExamId, UserExerciseState},
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct AnswerRequiringAttention {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub data_json: Option<serde_json::Value>,
    pub course_instance_id: Option<Uuid>,
    pub grading_progress: GradingProgress,
    pub score_given: Option<f32>,
    pub submission_id: Uuid,
    pub exercise_id: Uuid,
}
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
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
    pub flag_count: Option<i32>,
}

impl ExerciseSlideSubmission {
    pub fn get_course_instance_id(&self) -> ModelResult<Uuid> {
        self.course_instance_id.ok_or_else(|| {
            ModelError::new(
                ModelErrorType::Generic,
                "Submission is not related to a course instance.".to_string(),
                None,
            )
        })
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseAnswersInCourseRequiringAttentionCount {
    pub id: Uuid,
    pub name: String,
    pub page_id: Uuid,
    pub chapter_id: Option<Uuid>,
    pub order_number: i32,
    pub count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseSlideSubmissionCount {
    pub date: Option<NaiveDate>,
    pub count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseSlideSubmissionCountByExercise {
    pub exercise_id: Uuid,
    pub count: Option<i32>,
    pub exercise_name: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseSlideSubmissionAndUserExerciseState {
    pub exercise: Exercise,
    pub exercise_slide_submission: ExerciseSlideSubmission,
    pub user_exercise_state: UserExerciseState,
    pub teacher_grading_decision: Option<TeacherGradingDecision>,
    pub user_exam_enrollment: ExamEnrollment,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseSlideSubmissionAndUserExerciseStateList {
    pub data: Vec<ExerciseSlideSubmissionAndUserExerciseState>,
    pub total_pages: u32,
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
  user_points_update_strategy AS "user_points_update_strategy: _",
  flag_count
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
  user_points_update_strategy AS "user_points_update_strategy: _",
  flag_count
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
user_points_update_strategy AS "user_points_update_strategy: _",
flag_count
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
/// This function is mostly provided for very specific peer review purposes. Used only as a last resort if no other candidates are found to be peer reviewed.
pub async fn try_to_get_random_filtered_by_user_and_submissions(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    excluded_user_id: Uuid,
    excluded_ids: &[Uuid],
) -> ModelResult<Option<ExerciseSlideSubmission>> {
    let mut res = sqlx::query_as!(
        ExerciseSlideSubmission,
        r#"
SELECT DISTINCT ON (user_id)
  ess.id,
  ess.created_at,
  ess.updated_at,
  ess.deleted_at,
  ess.exercise_slide_id,
  ess.course_id,
  ess.course_instance_id,
  ess.exam_id,
  ess.exercise_id,
  ess.user_id,
  ess.user_points_update_strategy AS "user_points_update_strategy: _",
  ess.flag_count
FROM exercise_slide_submissions AS ess
JOIN courses AS c
  ON ess.course_id = c.id
WHERE ess.exercise_id = $1
  AND ess.id <> ALL($2)
  AND ess.user_id <> $3
  AND ess.deleted_at IS NULL
  AND ess.flag_count < c.flagged_answers_threshold
ORDER BY ess.user_id, ess.created_at DESC
        "#,
        exercise_id,
        excluded_ids,
        excluded_user_id,
    )
    .fetch_all(conn)
    .await?;
    // shuffle the res vec
    let mut rng = rand::rng();
    res.shuffle(&mut rng);
    Ok(res.into_iter().next())
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
  user_points_update_strategy AS "user_points_update_strategy: _",
  flag_count
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

pub async fn get_users_all_submissions_for_course_instance_or_exam(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_instance_id_or_exam_id: CourseInstanceOrExamId,
) -> ModelResult<Vec<ExerciseSlideSubmission>> {
    let (course_instance_id, exam_id) = course_instance_id_or_exam_id.to_instance_and_exam_ids();
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
  user_points_update_strategy AS "user_points_update_strategy: _",
  flag_count
FROM exercise_slide_submissions
WHERE user_id = $1
  AND (course_instance_id = $2 OR exam_id = $3)
  AND deleted_at IS NULL
        "#,
        user_id,
        course_instance_id,
        exam_id,
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
  user_points_update_strategy AS "user_points_update_strategy: _",
  flag_count
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
AND deleted_at IS NULL
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
  user_points_update_strategy AS "user_points_update_strategy: _",
  flag_count
FROM exercise_slide_submissions
WHERE exercise_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
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

pub async fn exercise_slide_submission_count_with_exam_id(
    conn: &mut PgConnection,
    exam_id: Uuid,
) -> ModelResult<u32> {
    let count = sqlx::query!(
        "
SELECT COUNT(*) as count
FROM exercise_slide_submissions
WHERE exam_id = $1
AND deleted_at IS NULL
",
        exam_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(count.count.unwrap_or(0).try_into()?)
}

pub async fn exercise_slide_submission_count_with_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
) -> ModelResult<u32> {
    let count = sqlx::query!(
        "
SELECT COUNT(*) as count
FROM exercise_slide_submissions
WHERE exercise_id = $1
AND deleted_at IS NULL
",
        exercise_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(count.count.unwrap_or(0).try_into()?)
}

pub async fn get_latest_exercise_slide_submissions_and_user_exercise_state_list_with_exercise_id(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    pagination: Pagination,
) -> ModelResult<Vec<ExerciseSlideSubmissionAndUserExerciseState>> {
    let submissions = sqlx::query_as!(
        ExerciseSlideSubmission,
        r#"
    SELECT DISTINCT ON (user_id)
        id,
        created_at,
        updated_at,
        deleted_at,
        exercise_slide_id,
        course_id,
        course_instance_id,
        exam_id,
        exercise_id,
        user_id,
        user_points_update_strategy AS "user_points_update_strategy: _",
  flag_count
FROM exercise_slide_submissions
WHERE exercise_id = $1
      AND deleted_at IS NULL
ORDER BY user_id, created_at DESC
LIMIT $2 OFFSET $3
        "#,
        exercise_id,
        pagination.limit(),
        pagination.offset(),
    )
    .fetch_all(&mut *conn)
    .await?;

    let user_ids = submissions
        .iter()
        .map(|sub| sub.user_id)
        .collect::<Vec<_>>();

    let exercise = exercises::get_by_id(conn, exercise_id).await?;
    let exam_id = exercise.exam_id;

    let user_exercise_states_list =
        user_exercise_states::get_or_create_user_exercise_state_for_users(
            conn,
            &user_ids,
            exercise_id,
            None,
            exam_id,
        )
        .await?;

    let mut user_exercise_state_id_list: Vec<Uuid> = Vec::new();

    for (_key, value) in user_exercise_states_list.clone().into_iter() {
        user_exercise_state_id_list.push(value.id);
    }

    let exercise = exercises::get_by_id(conn, exercise_id).await?;
    let exam_id = exercise
        .exam_id
        .ok_or_else(|| ModelError::new(ModelErrorType::Generic, "No exam id found", None))?;

    let teacher_grading_decisions_list = teacher_grading_decisions::try_to_get_latest_grading_decision_by_user_exercise_state_id_for_users(conn, &user_exercise_state_id_list).await?;

    let user_exam_enrollments_list =
        exams::get_exam_enrollments_for_users(conn, exam_id, &user_ids).await?;

    let mut list: Vec<ExerciseSlideSubmissionAndUserExerciseState> = Vec::new();
    for sub in submissions {
        let user_exercise_state = user_exercise_states_list
            .get(&sub.user_id)
            .ok_or_else(|| ModelError::new(ModelErrorType::Generic, "No user found", None))?;

        let teacher_grading_decision = teacher_grading_decisions_list.get(&user_exercise_state.id);
        let user_exam_enrollment =
            user_exam_enrollments_list
                .get(&sub.user_id)
                .ok_or_else(|| {
                    ModelError::new(
                        ModelErrorType::Generic,
                        "No users exam_enrollment found",
                        None,
                    )
                })?;

        //Add submissions to the list only if the students exam time has ended
        if user_exam_enrollment.ended_at.is_some() {
            let data = ExerciseSlideSubmissionAndUserExerciseState {
                exercise: exercise.clone(),
                exercise_slide_submission: sub,
                user_exercise_state: user_exercise_state.clone(),
                teacher_grading_decision: teacher_grading_decision.cloned(),
                user_exam_enrollment: user_exam_enrollment.clone(),
            };
            list.push(data);
        }
    }

    Ok(list)
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
AND deleted_at IS NULL
GROUP BY date
ORDER BY date;
          "#,
        course.id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_course_daily_user_counts_with_submissions(
    conn: &mut PgConnection,
    course: &Course,
) -> ModelResult<Vec<ExerciseSlideSubmissionCount>> {
    let res = sqlx::query_as!(
        ExerciseSlideSubmissionCount,
        r#"
SELECT DATE(created_at) date, count(DISTINCT user_id)::integer
FROM exercise_slide_submissions
WHERE course_id = $1
AND deleted_at IS NULL
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
    AND us_state.deleted_at IS NULL
    AND s_submission.deleted_at IS NULL
    AND t_submission.deleted_at IS NULL"#,
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
SELECT exercises.id,
  (
    SELECT COUNT(us_state.id)::integer AS COUNT
    FROM exercises AS exercises2
      LEFT JOIN user_exercise_states AS us_state ON us_state.exercise_id = exercises2.id
      LEFT JOIN exercise_slide_submissions AS s_submission ON us_state.selected_exercise_slide_id = s_submission.exercise_slide_id
      LEFT JOIN exercise_task_submissions AS t_submission ON s_submission.id = t_submission.exercise_slide_submission_id
    WHERE us_state.selected_exercise_slide_id = t_submission.exercise_slide_id
      AND us_state.user_id = s_submission.user_id
      AND us_state.reviewing_stage = 'waiting_for_manual_grading'
      AND us_state.deleted_at IS NULL
      AND exercises2.course_id = $1
      AND exercises.id = exercises2.id
    GROUP BY exercises2.id
  ),
  exercises.order_number,
  exercises.name,
  exercises.page_id,
  exercises.chapter_id
FROM exercises
WHERE exercises.course_id = $1
  AND exercises.deleted_at IS NULL
GROUP BY exercises.id;
"#,
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
  user_points_update_strategy AS "user_points_update_strategy: _",
  flag_count
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

pub async fn get_all_answers_requiring_attention(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    pagination: Pagination,
) -> ModelResult<Vec<AnswerRequiringAttention>> {
    let submissions = sqlx::query_as!(
        AnswerRequiringAttention,
        r#"
        SELECT
        us_state.id,
        us_state.user_id,
        us_state.exercise_id,
        us_state.course_instance_id,
        us_state.score_given,
        us_state.grading_progress as "grading_progress: _",
        t_submission.data_json,
        s_submission.created_at,
        s_submission.updated_at,
        s_submission.deleted_at,
        s_submission.id AS submission_id
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
    AND us_state.deleted_at IS NULL
    AND us_state.deleted_at IS NULL
    AND s_submission.deleted_at IS NULL
    AND t_submission.deleted_at IS NULL
    ORDER BY t_submission.updated_at
    LIMIT $2 OFFSET $3;"#,
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
AND deleted_at IS NULL
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
        AND deleted_at IS NULL
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
    user_id: Uuid,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<ExerciseSlideSubmissionInfo> {
    let exercise_slide_submission = get_by_id(&mut *conn, exercise_slide_submission_id).await?;
    let exercise =
        crate::exercises::get_by_id(&mut *conn, exercise_slide_submission.exercise_id).await?;
    let tasks = crate::exercise_task_submissions::get_exercise_task_submission_info_by_exercise_slide_submission_id(&mut *conn, exercise_slide_submission_id, user_id, fetch_service_info).await?;
    Ok(ExerciseSlideSubmissionInfo {
        exercise,
        tasks,
        exercise_slide_submission,
    })
}

pub async fn get_all_exercise_slide_submission_info(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
    viewer_user_id: Uuid,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<ExerciseSlideSubmissionInfo> {
    let exercise_slide_submission = get_by_id(&mut *conn, exercise_slide_submission_id).await?;
    let exercise =
        crate::exercises::get_by_id(&mut *conn, exercise_slide_submission.exercise_id).await?;
    let tasks = crate::exercise_task_submissions::get_exercise_task_submission_info_by_exercise_slide_submission_id(&mut *conn, exercise_slide_submission_id, viewer_user_id, fetch_service_info).await?;
    Ok(ExerciseSlideSubmissionInfo {
        exercise,
        tasks,
        exercise_slide_submission,
    })
}

pub async fn delete_exercise_submissions_with_exam_id_and_user_id(
    conn: &mut PgConnection,
    exam_id: Uuid,
    user_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE exercise_slide_submissions
SET deleted_at = now()
WHERE exam_id = $1 AND user_id = $2
    ",
        exam_id,
        user_id,
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}
