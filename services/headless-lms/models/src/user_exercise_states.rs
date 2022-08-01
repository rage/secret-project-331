use std::collections::HashMap;

use futures::Stream;
use headless_lms_utils::numbers::option_f32_to_f32_two_decimals;
use serde_json::Value;

use crate::{
    course_instances,
    course_modules::{self, CourseModule},
    courses,
    exercises::{ActivityProgress, Exercise, GradingProgress},
    prelude::*,
    user_course_settings,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[sqlx(type_name = "reviewing_stage", rename_all = "snake_case")]
#[cfg_attr(feature = "ts_rs", derive(TS))]
/**
Tells what stage of reviewing the user is currently in. Used for for peer review, self review, and manual review. If an exercise does not involve reviewing, the value of this stage will always be `NotStarted`.
*/
pub enum ReviewingStage {
    /**
    In this stage the user submits answers to the exercise. If the exercise allows it, the user can answer the exercise multiple times. If the exercise is not in this stage, the user cannot answer the exercise. Most exercises will never leave this stage because other stages are reseverved for situations when we cannot give the user points just based on the automatic gradings.
    */
    NotStarted,
    /// In this stage the student is instructed to give peer reviews to other students.
    PeerReview,
    /// In this stage the student is instructed to review their own answer.
    SelfReview,
    /// In this stage the student has completed the neccessary peer and self reviews but is waiting for other students to peer review their answer before we can give points for this exercise.
    WaitingForPeerReviews,
    /**
    In this stage the student has completed everything they need to do, but before we can give points for this exercise, we need a manual grading from the teacher.

    Reasons for ending up in this stage may be one of these:

    1. The exercise is configured to require all answers to be reviewed by the teacher.
    2. The answer has received poor reviews from the peers, and the exercise has been configured so that the teacher has to double-check whether it is justified to not give full points to the student.
    */
    WaitingForManualGrading,
    /**
    In this stage the the reviews have been completed and the points have been awarded to the student. However, since the answer had to go though the review process, the student may no longer answer the exercise since because

    1. It is likely that we revealed the model solution to the student during the review process.
    2. In case of peer review, a new answer would have to be reviewed by other students again, and that would be unreasonable extra work for others.

    If the teacher for some reasoon feels bad for the student and wants to give them a new chance, the answers for this exercise should be reset, the reason should be recorded somewhere in the database, and the value of this column should be set to `NotStarted`. Deleting the whole user_exercise_state may also be wise. However, if we end up doing this for a teacher, we should make sure that the teacher realizes that they should not give an unfair advantage to anyone.
    */
    ReviewedAndLocked,
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
    pub reviewing_stage: ReviewingStage,
    pub selected_exercise_slide_id: Option<Uuid>,
}

impl UserExerciseState {
    pub fn get_course_instance_id(&self) -> ModelResult<Uuid> {
        self.course_instance_id.ok_or_else(|| {
            ModelError::Generic("Exercise is not part of a course instance.".to_string())
        })
    }

    pub fn get_selected_exercise_slide_id(&self) -> ModelResult<Uuid> {
        self.selected_exercise_slide_id
            .ok_or_else(|| ModelError::Generic("No exercise slide selected.".to_string()))
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct UserExerciseStateUpdate {
    pub id: Uuid,
    pub score_given: Option<f32>,
    pub activity_progress: ActivityProgress,
    pub reviewing_stage: ReviewingStage,
    pub grading_progress: GradingProgress,
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
    pub course_module_id: Uuid,
    pub course_module_name: String,
    pub course_module_order_number: i32,
    pub score_given: f32,
    pub score_required: Option<i32>,
    pub score_maximum: Option<u32>,
    pub total_exercises: Option<u32>,
    pub attempted_exercises: Option<i32>,
    pub attempted_exercises_required: Option<i32>,
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
    pub course_module_id: Uuid,
    pub score_given: Option<f32>,
    pub attempted_exercises: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone)]
pub struct CourseInstanceExerciseMetrics {
    course_module_id: Uuid,
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
) -> ModelResult<Vec<CourseInstanceExerciseMetrics>> {
    let res = sqlx::query_as!(
        CourseInstanceExerciseMetrics,
        r"
SELECT chapters.course_module_id,
  COUNT(exercises.id) AS total_exercises,
  SUM(exercises.score_maximum) AS score_maximum
FROM course_instances
  LEFT JOIN exercises ON (course_instances.course_id = exercises.course_id)
  LEFT JOIN chapters ON (exercises.chapter_id = chapters.id)
WHERE exercises.deleted_at IS NULL
  AND course_instances.id = $1
GROUP BY chapters.course_module_id
        ",
        course_instance_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_course_instance_metrics_indexed_by_module_id(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> ModelResult<HashMap<Uuid, CourseInstanceExerciseMetrics>> {
    let res = get_course_instance_metrics(conn, course_instance_id)
        .await?
        .into_iter()
        .map(|x| (x.course_module_id, x))
        .collect();
    Ok(res)
}

/// Gets course instance metrics for a single module.
pub async fn get_single_module_course_instance_metrics(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    course_module_id: Uuid,
    user_id: Uuid,
) -> ModelResult<UserCourseInstanceMetrics> {
    let res = sqlx::query!(
        "
SELECT COUNT(ues.exercise_id) AS attempted_exercises,
  COALESCE(SUM(ues.score_given), 0) AS score_given
FROM user_exercise_states AS ues
  LEFT JOIN exercises ON (ues.exercise_id = exercises.id)
  LEFT JOIN chapters ON (exercises.chapter_id = chapters.id)
WHERE chapters.course_module_id = $1
  AND ues.course_instance_id = $2
  AND ues.activity_progress IN ('completed', 'submitted')
  AND ues.user_id = $3
  AND ues.deleted_at IS NULL
        ",
        course_module_id,
        course_instance_id,
        user_id,
    )
    .map(|x| UserCourseInstanceMetrics {
        course_module_id,
        score_given: x.score_given,
        attempted_exercises: x.attempted_exercises,
    })
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_user_course_instance_metrics(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Vec<UserCourseInstanceMetrics>> {
    let res = sqlx::query_as!(
        UserCourseInstanceMetrics,
        r"
SELECT chapters.course_module_id,
  COUNT(ues.exercise_id) AS attempted_exercises,
  COALESCE(SUM(ues.score_given), 0) AS score_given
FROM user_exercise_states AS ues
  LEFT JOIN exercises ON (ues.exercise_id = exercises.id)
  LEFT JOIN chapters ON (exercises.chapter_id = chapters.id)
WHERE ues.course_instance_id = $1
  AND ues.activity_progress IN ('completed', 'submitted')
  AND ues.user_id = $2
  AND ues.deleted_at IS NULL
GROUP BY chapters.course_module_id;
        ",
        course_instance_id,
        user_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_user_course_instance_metrics_indexed_by_module_id(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
    user_id: Uuid,
) -> ModelResult<HashMap<Uuid, UserCourseInstanceMetrics>> {
    let res = get_user_course_instance_metrics(conn, course_instance_id, user_id)
        .await?
        .into_iter()
        .map(|x| (x.course_module_id, x))
        .collect();
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
) -> ModelResult<Vec<UserCourseInstanceProgress>> {
    let course_metrics =
        get_course_instance_metrics_indexed_by_module_id(&mut *conn, course_instance_id).await?;
    let user_metrics =
        get_user_course_instance_metrics_indexed_by_module_id(conn, course_instance_id, user_id)
            .await?;
    let course_id = course_instances::get_course_instance(conn, course_instance_id)
        .await?
        .course_id;
    let course_name = courses::get_course(conn, course_id).await?.name;
    let course_modules = course_modules::get_by_course_id(conn, course_id).await?;
    merge_modules_with_metrics(course_modules, &course_metrics, &user_metrics, &course_name)
}

fn merge_modules_with_metrics(
    course_modules: Vec<CourseModule>,
    course_metrics_by_course_module_id: &HashMap<Uuid, CourseInstanceExerciseMetrics>,
    user_metrics_by_course_module_id: &HashMap<Uuid, UserCourseInstanceMetrics>,
    default_course_module_name_placeholder: &str,
) -> ModelResult<Vec<UserCourseInstanceProgress>> {
    course_modules
        .into_iter()
        .map(|course_module| {
            let user_metrics = user_metrics_by_course_module_id.get(&course_module.id);
            let course_metrics = course_metrics_by_course_module_id.get(&course_module.id);
            let progress = UserCourseInstanceProgress {
                course_module_id: course_module.id,
                // Only default course module doesn't have a name.
                course_module_name: course_module
                    .name
                    .unwrap_or_else(|| default_course_module_name_placeholder.to_string()),
                course_module_order_number: course_module.order_number,
                score_given: option_f32_to_f32_two_decimals(
                    user_metrics.and_then(|x| x.score_given),
                ),
                score_required: course_module.automatic_completion_number_of_points_treshold,
                score_maximum: course_metrics
                    .and_then(|x| x.score_maximum)
                    .map(TryInto::try_into)
                    .transpose()?,
                total_exercises: course_metrics
                    .and_then(|x| x.total_exercises)
                    .map(TryInto::try_into)
                    .transpose()?,
                attempted_exercises: user_metrics
                    .and_then(|x| x.attempted_exercises)
                    .map(TryInto::try_into)
                    .transpose()?,
                attempted_exercises_required: course_module
                    .automatic_completion_number_of_exercises_attempted_treshold,
            };
            Ok(progress)
        })
        .collect::<ModelResult<_>>()
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
  reviewing_stage AS "reviewing_stage: _",
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
      reviewing_stage AS "reviewing_stage: _",
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
  reviewing_stage AS "reviewing_stage: _",
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
  reviewing_stage AS "reviewing_stage: _",
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

pub async fn update(
    conn: &mut PgConnection,
    user_exercise_state_update: UserExerciseStateUpdate,
) -> ModelResult<UserExerciseState> {
    let res = sqlx::query_as!(
        UserExerciseState,
        r#"
UPDATE user_exercise_states
SET score_given = $1,
  activity_progress = $2,
  reviewing_stage = $3,
  grading_progress = $4
WHERE id = $5
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
  reviewing_stage AS "reviewing_stage: _",
  selected_exercise_slide_id
        "#,
        user_exercise_state_update.score_given,
        user_exercise_state_update.activity_progress as ActivityProgress,
        user_exercise_state_update.reviewing_stage as ReviewingStage,
        user_exercise_state_update.grading_progress as GradingProgress,
        user_exercise_state_update.id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn update_exercise_progress(
    conn: &mut PgConnection,
    id: Uuid,
    reviewing_stage: ReviewingStage,
) -> ModelResult<UserExerciseState> {
    let res = sqlx::query_as!(
        UserExerciseState,
        r#"
UPDATE user_exercise_states
SET reviewing_stage = $1
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
  reviewing_stage AS "reviewing_stage: _",
  selected_exercise_slide_id
        "#,
        reviewing_stage as ReviewingStage,
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
  reviewing_stage AS "reviewing_stage: _",
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

/// Convenience struct that combines user state to the exercise.
///
/// Many operations require information about both the user state and the exercise. However, because
/// exercises can either belong to a course or an exam, and each course instance will have their
/// own `UserExerciseState`, it can get difficult to track the proper context.
pub struct ExerciseWithUserState {
    exercise: Exercise,
    user_exercise_state: UserExerciseState,
    type_data: EwusCourseOrExam,
}

impl ExerciseWithUserState {
    pub fn new(exercise: Exercise, user_exercise_state: UserExerciseState) -> ModelResult<Self> {
        let state = EwusCourseOrExam::from_exercise_and_user_exercise_state(
            &exercise,
            &user_exercise_state,
        )?;
        Ok(Self {
            exercise,
            user_exercise_state,
            type_data: state,
        })
    }

    /// Provides a reference to the inner `Exercise`.
    pub fn exercise(&self) -> &Exercise {
        &self.exercise
    }

    /// Provides a reference to the inner `UserExerciseState`.
    pub fn user_exercise_state(&self) -> &UserExerciseState {
        &self.user_exercise_state
    }

    pub fn exercise_context(&self) -> &EwusCourseOrExam {
        &self.type_data
    }

    pub fn set_user_exercise_state(
        &mut self,
        user_exercise_state: UserExerciseState,
    ) -> ModelResult<()> {
        self.type_data = EwusCourseOrExam::from_exercise_and_user_exercise_state(
            &self.exercise,
            &user_exercise_state,
        )?;
        self.user_exercise_state = user_exercise_state;
        Ok(())
    }

    pub fn is_exam_exercise(&self) -> bool {
        match self.type_data {
            EwusCourseOrExam::Course(_) => false,
            EwusCourseOrExam::Exam(_) => true,
        }
    }
}

pub struct EwusCourse {
    pub course_id: Uuid,
    pub course_instance_id: Uuid,
}

pub struct EwusExam {
    pub exam_id: Uuid,
}

pub enum EwusContext<C, E> {
    Course(C),
    Exam(E),
}

pub enum EwusCourseOrExam {
    Course(EwusCourse),
    Exam(EwusExam),
}

impl EwusCourseOrExam {
    pub fn from_exercise_and_user_exercise_state(
        exercise: &Exercise,
        user_exercise_state: &UserExerciseState,
    ) -> ModelResult<Self> {
        if exercise.id == user_exercise_state.exercise_id {
            let course_id = exercise.course_id;
            let course_instance_id = user_exercise_state.course_instance_id;
            let exam_id = exercise.exam_id;
            match (course_id, course_instance_id, exam_id) {
                (None, None, Some(exam_id)) => Ok(Self::Exam(EwusExam { exam_id })),
                (Some(course_id), Some(course_instance_id), None) => Ok(Self::Course(EwusCourse {
                    course_id,
                    course_instance_id,
                })),
                _ => Err(ModelError::Generic("Invalid initializer data.".to_string())),
            }
        } else {
            Err(ModelError::Generic(
                "Exercise doesn't match the state.".to_string(),
            ))
        }
    }
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

#[cfg(test)]
mod tests {
    use chrono::TimeZone;

    use super::*;
    use crate::test_helper::*;

    mod getting_single_module_course_instance_metrics {
        use super::*;

        #[tokio::test]
        async fn works_without_any_user_exercise_states() {
            insert_data!(:tx, :user, :org, :course, :instance, :course_module);
            let res = get_single_module_course_instance_metrics(
                tx.as_mut(),
                instance.id,
                course_module.id,
                user,
            )
            .await;
            assert!(res.is_ok())
        }
    }

    #[test]
    fn merges_course_modules_with_metrics() {
        let module_id = Uuid::parse_str("9e831ecc-9751-42f1-ae7e-9b2f06e523e8").unwrap();
        let course_modules = vec![CourseModule {
            created_at: Utc.ymd(2022, 6, 22).and_hms(0, 0, 0),
            updated_at: Utc.ymd(2022, 6, 22).and_hms(0, 0, 0),
            deleted_at: None,
            id: module_id,
            name: None,
            order_number: 0,
            course_id: Uuid::parse_str("3fa4bee6-7390-415e-968f-ecdc5f28330e").unwrap(),
            copied_from: None,
            uh_course_code: None,
            ects_credits: Some(5),
            automatic_completion: false,
            automatic_completion_number_of_exercises_attempted_treshold: None,
            automatic_completion_number_of_points_treshold: None,
        }];
        let course_metrics_by_course_module_id = HashMap::from([(
            module_id,
            CourseInstanceExerciseMetrics {
                course_module_id: module_id,
                total_exercises: Some(4),
                score_maximum: Some(10),
            },
        )]);
        let user_metrics_by_course_module_id = HashMap::from([(
            module_id,
            UserCourseInstanceMetrics {
                course_module_id: module_id,
                score_given: Some(1.0),
                attempted_exercises: Some(3),
            },
        )]);
        let metrics = merge_modules_with_metrics(
            course_modules,
            &course_metrics_by_course_module_id,
            &user_metrics_by_course_module_id,
            "Default module",
        )
        .unwrap();
        assert_eq!(metrics.len(), 1);
        let metric = metrics.first().unwrap();
        assert_eq!(metric.attempted_exercises, Some(3));
        assert_eq!(&metric.course_module_name, "Default module");
        assert_eq!(metric.score_given, 1.0);
        assert_eq!(metric.score_maximum, Some(10));
        assert_eq!(metric.total_exercises, Some(4));
    }
}
