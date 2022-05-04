use futures::Stream;
use headless_lms_utils::numbers::option_f32_to_f32_two_decimals;
use serde_json::Value;

use crate::{
    exercises::{ActivityProgress, Exercise, GradingProgress},
    prelude::*,
    user_course_settings,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[sqlx(type_name = "exercise_progress", rename_all = "snake_case")]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub enum ExerciseProgress {
    NotAnswered,
    PeerReview,
    SelfReview,
    Complete,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct UserExerciseState {
    pub id: Uuid,
    pub user_id: Uuid,
    pub exercise_id: Uuid,
    pub course_instance_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub score_given: Option<f32>,
    pub grading_progress: GradingProgress,
    pub activity_progress: ActivityProgress,
    pub exercise_progress: ExerciseProgress,
    pub selected_exercise_slide_id: Option<Uuid>,
}

/// Either a course instance or exam id.
///
/// Exercises can either be part of courses or exams. Many user-related actions need to differentiate
/// between two, so `CourseInstanceOrExamId` helps when handling these separate scenarios.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Copy)]
pub enum CourseInstanceOrExamId {
    Instance(Uuid),
    Exam(Uuid),
}

impl CourseInstanceOrExamId {
    pub fn from_instance_and_exam_ids(
        course_instance_id: Option<Uuid>,
        exam_id: Option<Uuid>,
    ) -> ModelResult<Self> {
        match (course_instance_id, exam_id) {
            (None, None) => Err(ModelError::Generic(
                "Expected either course instance or exam id, but neither were provided.".into(),
            )),
            (Some(instance_id), None) => Ok(Self::Instance(instance_id)),
            (None, Some(exam_id)) => Ok(Self::Exam(exam_id)),
            (Some(_), Some(_)) => Err(ModelError::Generic(
                "Expected either course instance or exam id, but both were provided.".into(),
            )),
        }
    }

    pub fn to_instance_and_exam_ids(&self) -> (Option<Uuid>, Option<Uuid>) {
        match self {
            CourseInstanceOrExamId::Instance(instance_id) => (Some(*instance_id), None),
            CourseInstanceOrExamId::Exam(exam_id) => (None, Some(*exam_id)),
        }
    }
}

impl TryFrom<UserExerciseState> for CourseInstanceOrExamId {
    type Error = ModelError;

    fn try_from(user_exercise_state: UserExerciseState) -> Result<Self, Self::Error> {
        Self::from_instance_and_exam_ids(
            user_exercise_state.course_instance_id,
            user_exercise_state.exam_id,
        )
    }
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserCourseInstanceProgress {
    pub score_given: f32,
    pub score_maximum: Option<u32>,
    pub total_exercises: Option<u32>,
    pub attempted_exercises: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserCourseInstanceChapterExerciseProgress {
    pub exercise_id: Uuid,
    pub score_given: f32,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone)]
pub struct DatabaseUserCourseInstanceChapterExerciseProgress {
    pub exercise_id: Uuid,
    pub score_given: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone)]
pub struct UserChapterMetrics {
    pub score_given: Option<f32>,
    pub attempted_exercises: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone)]
pub struct UserCourseInstanceMetrics {
    score_given: Option<f32>,
    attempted_exercises: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone)]
pub struct CourseInstanceExerciseMetrics {
    total_exercises: Option<i64>,
    score_maximum: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ExerciseUserCounts {
    exercise_name: Option<String>,
    exercise_order_number: Option<i32>,
    page_order_number: Option<i32>,
    chapter_number: Option<i32>,
    exercise_id: Option<Uuid>,
    #[cfg_attr(feature = "ts_rs", ts(type = "number"))]
    n_users_attempted: Option<i64>,
    #[cfg_attr(feature = "ts_rs", ts(type = "number"))]
    n_users_with_some_points: Option<i64>,
    #[cfg_attr(feature = "ts_rs", ts(type = "number"))]
    n_users_with_max_points: Option<i64>,
}

pub async fn get_course_instance_metrics(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<CourseInstanceExerciseMetrics> {
    let res = sqlx::query_as!(
        CourseInstanceExerciseMetrics,
        r#"
SELECT COUNT(e.id) AS total_exercises,
  SUM(e.score_maximum) AS score_maximum
FROM course_instances AS ci
  LEFT JOIN exercises AS e ON ci.course_id = e.course_id
WHERE e.deleted_at IS NULL
  AND ci.id = $1;
        "#,
        course_instance_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_user_course_instance_metrics(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<UserCourseInstanceMetrics> {
    let res = sqlx::query_as!(
        UserCourseInstanceMetrics,
        r#"
SELECT COUNT(ues.exercise_id) AS attempted_exercises,
  COALESCE(SUM(ues.score_given), 0) AS score_given
FROM user_exercise_states AS ues
WHERE ues.course_instance_id = $1
  AND ues.activity_progress IN ('completed', 'submitted')
  AND ues.user_id = $2
  AND ues.deleted_at IS NULL;
        "#,
        course_instance_id,
        user_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_user_course_instance_chapter_metrics(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    exercise_ids: &[Uuid],
    user_id: Uuid,
) -> ModelResult<UserChapterMetrics> {
    let res = sqlx::query_as!(
        UserChapterMetrics,
        r#"
SELECT COUNT(ues.exercise_id) AS attempted_exercises,
  COALESCE(SUM(ues.score_given), 0) AS score_given
FROM user_exercise_states AS ues
WHERE ues.exercise_id IN (
    SELECT UNNEST($1::uuid [])
  )
  AND ues.deleted_at IS NULL
  AND ues.activity_progress IN ('completed', 'submitted')
  AND ues.user_id = $2
  AND ues.course_instance_id = $3;
                "#,
        &exercise_ids,
        user_id,
        course_instance_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_user_course_instance_progress(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<UserCourseInstanceProgress> {
    let course_metrics = get_course_instance_metrics(&mut *conn, course_instance_id).await?;
    let user_metrics = get_user_course_instance_metrics(conn, course_instance_id, user_id).await?;

    let result = UserCourseInstanceProgress {
        score_given: option_f32_to_f32_two_decimals(user_metrics.score_given),
        attempted_exercises: user_metrics
            .attempted_exercises
            .map(TryInto::try_into)
            .transpose()?,
        score_maximum: course_metrics
            .score_maximum
            .map(TryInto::try_into)
            .transpose()?,
        total_exercises: course_metrics
            .total_exercises
            .map(TryInto::try_into)
            .transpose()?,
    };
    Ok(result)
}

pub async fn get_user_course_instance_chapter_exercises_progress(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    exercise_ids: &[Uuid],
    user_id: Uuid,
) -> ModelResult<Vec<DatabaseUserCourseInstanceChapterExerciseProgress>> {
    let res = sqlx::query_as!(
        DatabaseUserCourseInstanceChapterExerciseProgress,
        r#"
SELECT COALESCE(ues.score_given, 0) AS score_given,
  ues.exercise_id AS exercise_id
FROM user_exercise_states AS ues
WHERE ues.deleted_at IS NULL
  AND ues.exercise_id IN (
    SELECT UNNEST($1::uuid [])
  )
  AND ues.course_instance_id = $2
  AND ues.user_id = $3;
        "#,
        exercise_ids,
        course_instance_id,
        user_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_or_create_user_exercise_state(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Option<Uuid>,
    exam_id: Option<Uuid>,
) -> ModelResult<UserExerciseState> {
    let existing = sqlx::query_as!(
        UserExerciseState,
        r#"
SELECT id,
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
  exercise_progress AS "exercise_progress: _",
  selected_exercise_slide_id
FROM user_exercise_states
WHERE user_id = $1
  AND exercise_id = $2
  AND (course_instance_id = $3 OR exam_id = $4)
"#,
        user_id,
        exercise_id,
        course_instance_id,
        exam_id
    )
    .fetch_optional(&mut *conn)
    .await?;

    let res = if let Some(existing) = existing {
        existing
    } else {
        sqlx::query_as!(
            UserExerciseState,
            r#"
    INSERT INTO user_exercise_states (user_id, exercise_id, course_instance_id, exam_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id,
      user_id,
      exercise_id,
      course_instance_id,
      exam_id,
      created_at,
      updated_at,
      deleted_at,
      score_given,
      grading_progress as "grading_progress: _",
      activity_progress as "activity_progress: _",
      exercise_progress AS "exercise_progress: _",
      selected_exercise_slide_id
      "#,
            user_id,
            exercise_id,
            course_instance_id,
            exam_id
        )
        .fetch_one(&mut *conn)
        .await?
    };
    Ok(res)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<UserExerciseState> {
    let res = sqlx::query_as!(
        UserExerciseState,
        r#"
SELECT id,
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
  exercise_progress AS "exercise_progress: _",
  selected_exercise_slide_id
FROM user_exercise_states
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_users_current_by_exercise(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise: &Exercise,
) -> ModelResult<UserExerciseState> {
    let course_or_exam_id = CourseOrExamId::from(exercise.course_id, exercise.exam_id)?;
    let course_instance_or_exam_id = match course_or_exam_id {
        CourseOrExamId::Course(course_id) => {
            user_course_settings::get_user_course_settings_by_course_id(conn, user_id, course_id)
                .await?
                .map(|settings| {
                    CourseInstanceOrExamId::Instance(settings.current_course_instance_id)
                })
                .ok_or_else(|| {
                    ModelError::PreconditionFailed("Missing user course settings.".to_string())
                })
        }
        CourseOrExamId::Exam(exam_id) => Ok(CourseInstanceOrExamId::Exam(exam_id)),
    }?;
    let user_exercise_state =
        get_user_exercise_state_if_exists(conn, user_id, exercise.id, course_instance_or_exam_id)
            .await?
            .ok_or_else(|| {
                ModelError::PreconditionFailed("Missing user exercise state.".to_string())
            })?;
    Ok(user_exercise_state)
}

pub async fn get_user_exercise_state_if_exists(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_or_exam_id: CourseInstanceOrExamId,
) -> ModelResult<Option<UserExerciseState>> {
    let (course_instance_id, exam_id) = course_instance_or_exam_id.to_instance_and_exam_ids();
    let res = sqlx::query_as!(
        UserExerciseState,
        r#"
SELECT id,
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
  exercise_progress AS "exercise_progress: _",
  selected_exercise_slide_id
FROM user_exercise_states
WHERE user_id = $1
  AND exercise_id = $2
  AND (course_instance_id = $3 OR exam_id = $4)
      "#,
        user_id,
        exercise_id,
        course_instance_id,
        exam_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn upsert_selected_exercise_slide_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Option<Uuid>,
    exam_id: Option<Uuid>,
    selected_exercise_slide_id: Option<Uuid>,
) -> ModelResult<()> {
    let existing = sqlx::query!(
        "
SELECT
FROM user_exercise_states
WHERE user_id = $1
  AND exercise_id = $2
  AND (course_instance_id = $3 OR exam_id = $4)
",
        user_id,
        exercise_id,
        course_instance_id,
        exam_id
    )
    .fetch_optional(&mut *conn)
    .await?;
    if existing.is_some() {
        sqlx::query!(
            "
UPDATE user_exercise_states
SET selected_exercise_slide_id = $4
WHERE user_id = $1
  AND exercise_id = $2
  AND (course_instance_id = $3 OR exam_id = $5)
    ",
            user_id,
            exercise_id,
            course_instance_id,
            selected_exercise_slide_id,
            exam_id
        )
        .execute(&mut *conn)
        .await?;
    } else {
        sqlx::query!(
            "
    INSERT INTO user_exercise_states (
        user_id,
        exercise_id,
        course_instance_id,
        selected_exercise_slide_id,
        exam_id
      )
    VALUES ($1, $2, $3, $4, $5)
    ",
            user_id,
            exercise_id,
            course_instance_id,
            selected_exercise_slide_id,
            exam_id
        )
        .execute(&mut *conn)
        .await?;
    }
    Ok(())
}

pub async fn update_exercise_progress(
    conn: &mut PgConnection,
    id: Uuid,
    exercise_progress: ExerciseProgress,
) -> ModelResult<UserExerciseState> {
    let res = sqlx::query_as!(
        UserExerciseState,
        r#"
UPDATE user_exercise_states
SET exercise_progress = $1
WHERE id = $2
  AND deleted_at IS NULL
RETURNING id,
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
  exercise_progress AS "exercise_progress: _",
  selected_exercise_slide_id
        "#,
        exercise_progress as ExerciseProgress,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn update_grading_state(
    conn: &mut PgConnection,
    id: Uuid,
    score_given: Option<f32>,
    grading_progress: GradingProgress,
    activity_progress: ActivityProgress,
) -> ModelResult<UserExerciseState> {
    let res = sqlx::query_as!(
        UserExerciseState,
        r#"
UPDATE user_exercise_states
SET score_given = $1,
  grading_progress = $2,
  activity_progress = $3
WHERE id = $4
  AND deleted_at IS NULL
RETURNING id,
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
  exercise_progress AS "exercise_progress: _",
  selected_exercise_slide_id
        "#,
        score_given,
        grading_progress as GradingProgress,
        activity_progress as ActivityProgress,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct CourseInstanceUserPoints {
    pub user_id: Uuid,
    pub points_for_each_chapter: Vec<CourseInstanceUserPointsInner>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct CourseInstanceUserPointsInner {
    pub chapter_number: i32,
    pub points_for_chapter: f32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct ExamUserPoints {
    pub user_id: Uuid,
    pub email: String,
    pub points_for_exercise: Vec<ExamUserPointsInner>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct ExamUserPointsInner {
    pub exercise_id: Uuid,
    pub score_given: f32,
}

pub fn stream_course_instance_points(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> impl Stream<Item = sqlx::Result<CourseInstanceUserPoints>> + '_ {
    sqlx::query!(
        "
SELECT user_id,
  to_jsonb(array_agg(to_jsonb(uue) - 'email' - 'user_id')) AS points_for_each_chapter
FROM (
    SELECT u.email,
      u.id AS user_id,
      c.chapter_number,
      COALESCE(SUM(ues.score_given), 0) AS points_for_chapter
    FROM user_exercise_states ues
      JOIN users u ON u.id = ues.user_id
      JOIN exercises e ON e.id = ues.exercise_id
      JOIN chapters c on e.chapter_id = c.id
    WHERE ues.course_instance_id = $1
      AND ues.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND u.deleted_at IS NULL
      AND e.deleted_at IS NULL
    GROUP BY u.email,
      u.id,
      c.chapter_number
  ) as uue
GROUP BY user_id

",
        course_instance_id
    )
    .try_map(|i| {
        let user_id = i.user_id;
        let points_for_each_chapter = i.points_for_each_chapter.unwrap_or(Value::Null);
        serde_json::from_value(points_for_each_chapter)
            .map(|points_for_each_chapter| CourseInstanceUserPoints {
                user_id,
                points_for_each_chapter,
            })
            .map_err(|e| sqlx::Error::Decode(Box::new(e)))
    })
    .fetch(conn)
}

pub fn stream_exam_points(
    conn: &mut PgConnection,
    exam_id: Uuid,
) -> impl Stream<Item = sqlx::Result<ExamUserPoints>> + '_ {
    sqlx::query!(
        "
SELECT user_id,
  email,
  to_jsonb(array_agg(to_jsonb(uue) - 'email' - 'user_id')) AS points_for_exercises
FROM (
    SELECT u.id AS user_id,
      u.email,
      exercise_id,
      COALESCE(score_given, 0) as score_given
    FROM user_exercise_states ues
      JOIN users u ON u.id = ues.user_id
      JOIN exercises e ON e.id = ues.exercise_id
    WHERE ues.exam_id = $1
      AND ues.deleted_at IS NULL
      AND u.deleted_at IS NULL
      AND e.deleted_at IS NULL
  ) as uue
GROUP BY user_id,
  email
",
        exam_id
    )
    .try_map(|i| {
        let user_id = i.user_id;
        let points_for_exercises = i.points_for_exercises.unwrap_or(Value::Null);
        serde_json::from_value(points_for_exercises)
            .map(|points_for_exercise| ExamUserPoints {
                user_id,
                points_for_exercise,
                email: i.email,
            })
            .map_err(|e| sqlx::Error::Decode(Box::new(e)))
    })
    .fetch(conn)
}

pub async fn get_course_users_counts_by_exercise(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<ExerciseUserCounts>> {
    let res = sqlx::query_as!(
        ExerciseUserCounts,
        r#"
SELECT exercises.name as exercise_name,
        exercises.order_number as exercise_order_number,
        pages.order_number     as page_order_number,
        chapters.chapter_number,
        stat_data.*
 FROM (SELECT exercise_id,
              COUNT(DISTINCT user_id) as n_users_attempted,
              COUNT(DISTINCT user_id) FILTER ( WHERE ues.score_given IS NOT NULL and ues.score_given > 0 ) as n_users_with_some_points,
              COUNT(DISTINCT user_id) FILTER ( WHERE ues.score_given IS NOT NULL and ues.score_given >= exercises.score_maximum ) as n_users_with_max_points
       FROM exercises
       JOIN user_exercise_states ues on exercises.id = ues.exercise_id
       WHERE exercises.course_id = $1
         AND exercises.deleted_at IS NULL
         AND ues.deleted_at IS NULL
       GROUP BY exercise_id) as stat_data
        JOIN exercises ON stat_data.exercise_id = exercises.id
        JOIN pages on exercises.page_id = pages.id
        JOIN chapters on pages.chapter_id = chapters.id
 WHERE exercises.deleted_at IS NULL
   AND pages.deleted_at IS NULL
   AND chapters.deleted_at IS NULL
          "#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
