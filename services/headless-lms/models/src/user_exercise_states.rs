use futures::Stream;
use headless_lms_utils::numbers::option_f32_to_f32_two_decimals;
use serde_json::Value;

use crate::{
    exercise_slide_submissions::ExerciseSlideSubmission,
    exercise_task_gradings::{self, UserPointsUpdateStrategy},
    exercises::{ActivityProgress, GradingProgress},
    prelude::*,
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct UserExerciseState {
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
SELECT user_id,
  exercise_id,
  course_instance_id,
  exam_id,
  created_at,
  updated_at,
  deleted_at,
  score_given,
  grading_progress as "grading_progress: _",
  activity_progress as "activity_progress: _",
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
    RETURNING user_id,
      exercise_id,
      course_instance_id,
      exam_id,
      created_at,
      updated_at,
      deleted_at,
      score_given,
      grading_progress as "grading_progress: _",
      activity_progress as "activity_progress: _",
      selected_exercise_slide_id;
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
SELECT user_id,
  exercise_id,
  course_instance_id,
  exam_id,
  created_at,
  updated_at,
  deleted_at,
  score_given,
  grading_progress as "grading_progress: _",
  activity_progress as "activity_progress: _",
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

fn figure_out_new_score_given(
    current_score_given: Option<f32>,
    grading_score_given: Option<f32>,
    user_points_update_strategy: UserPointsUpdateStrategy,
) -> Option<f32> {
    let current_score_given = if let Some(current_score_given) = current_score_given {
        current_score_given
    } else {
        info!(
            "Current state has no score, using score from grading ({:?})",
            grading_score_given
        );
        return grading_score_given;
    };
    let grading_score_given = if let Some(grading_score_given) = grading_score_given {
        grading_score_given
    } else {
        info!(
            "Grading has no score, using score from current state ({:?})",
            current_score_given
        );
        return Some(current_score_given);
    };

    let new_score = match user_points_update_strategy {
        UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints => {
            if current_score_given >= grading_score_given {
                info!(
                    "Not updating score ({:?} >= {:?})",
                    current_score_given, grading_score_given
                );
                current_score_given
            } else {
                info!(
                    "Updating score from {:?} to {:?}",
                    current_score_given, grading_score_given
                );
                grading_score_given
            }
        }
        UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints => {
            info!(
                "Updating score from {:?} to {:?}",
                current_score_given, grading_score_given
            );
            grading_score_given
        }
    };
    Some(new_score)
}

/**
Returns a new state for the grading progress.

The new grading progress is always the grading progress from the new grading
unless the current grading progress is already finished. If the current grading
progress is finished, we don't change it to anything else so that a new worse
submission won't take the user's progress away.

In the future this function will be extended to support peer reviews. When
there's a peer review associated with the exercise, it is part of the overall
grading progress.
*/
fn figure_out_new_grading_progress(
    current_grading_progress: GradingProgress,
    grading_grading_progress: GradingProgress,
) -> GradingProgress {
    match current_grading_progress {
        GradingProgress::FullyGraded => GradingProgress::FullyGraded,
        _ => grading_grading_progress,
    }
}

/**
Returns a new state for the activity progress.

In the future this function will be extended to support peer reviews. When
there's a peer review associated with the exercise, the activity is not complete
before the user has given the peer reviews that they're required to give.
*/
fn figure_out_new_activity_progress(
    current_activity_progress: ActivityProgress,
) -> ActivityProgress {
    if current_activity_progress == ActivityProgress::Completed {
        return ActivityProgress::Completed;
    }

    // The case where activity is not completed when the user needs to give peer
    // reviews
    ActivityProgress::Completed
}

pub async fn update_user_exercise_state_after_submission(
    conn: &mut PgConnection,
    exercise_slide_submission: &ExerciseSlideSubmission,
) -> ModelResult<UserExerciseState> {
    let current_state = get_or_create_user_exercise_state(
        conn,
        exercise_slide_submission.user_id,
        exercise_slide_submission.exercise_id,
        exercise_slide_submission.course_instance_id,
        exercise_slide_submission.exam_id,
    )
    .await?;

    // There used to be only one task per exercise. For now this data is summarized from a set of
    // submissions belonging to a slide submission.
    let score_given = exercise_task_gradings::get_total_score_given_for_exercise_slide_submission(
        conn,
        &exercise_slide_submission.id,
    )
    .await?;
    let (grading_progress, points_update_strategy) =
        exercise_task_gradings::get_point_update_strategy_from_gradings(
            conn,
            &exercise_slide_submission.id,
        )
        .await?;
    info!(
        "Using user points updating strategy {:?}",
        points_update_strategy
    );
    let new_score_given = figure_out_new_score_given(
        current_state.score_given,
        score_given,
        points_update_strategy,
    );

    let new_grading_progress =
        figure_out_new_grading_progress(current_state.grading_progress, grading_progress);
    let new_activity_progress = figure_out_new_activity_progress(current_state.activity_progress);

    let res = sqlx::query_as!(
        UserExerciseState,
        r#"
UPDATE user_exercise_states
SET score_given = $4, grading_progress = $5, activity_progress = $6
WHERE user_id = $1
AND exercise_id = $2
AND (course_instance_id = $3 OR exam_id = $7)
RETURNING user_id,
  exercise_id,
  course_instance_id,
  exam_id,
  created_at,
  updated_at,
  deleted_at,
  score_given,
  grading_progress as "grading_progress: _",
  activity_progress as "activity_progress: _",
  selected_exercise_slide_id;
    "#,
        exercise_slide_submission.user_id,
        exercise_slide_submission.exercise_id,
        exercise_slide_submission.course_instance_id,
        new_score_given,
        new_grading_progress as GradingProgress,
        new_activity_progress as ActivityProgress,
        exercise_slide_submission.exam_id
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
      SUM(ues.score_given) AS points_for_chapter
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
    use super::*;
    use crate::{
        exercise_slide_submissions::{self, NewExerciseSlideSubmission},
        exercise_task_gradings::{self, ExerciseTaskGradingResult},
        exercise_task_submissions::{self, SubmissionData},
        exercises,
        test_helper::*,
    };

    mod figure_out_new_score_given {
        use headless_lms_utils::numbers::f32_approx_eq;

        use crate::{
            exercise_task_gradings::UserPointsUpdateStrategy,
            user_exercise_states::figure_out_new_score_given,
        };

        #[test]
        fn strategy_can_add_points_and_can_remove_points_works() {
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        Some(1.1),
                        Some(1.1),
                        UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints
                    )
                    .unwrap(),
                    1.1,
                ),
                true
            );
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        Some(1.1),
                        Some(20.9),
                        UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints
                    )
                    .unwrap(),
                    20.9,
                ),
                true
            );
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        Some(20.9),
                        Some(1.1),
                        UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints
                    )
                    .unwrap(),
                    1.1,
                ),
                true
            );
        }

        #[test]
        fn strategy_can_add_points_but_cannot_remove_points_works() {
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        Some(1.1),
                        Some(1.1),
                        UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints
                    )
                    .unwrap(),
                    1.1,
                ),
                true
            );
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        Some(1.1),
                        Some(20.9),
                        UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints
                    )
                    .unwrap(),
                    20.9,
                ),
                true
            );
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        Some(20.9),
                        Some(1.1),
                        UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints
                    )
                    .unwrap(),
                    20.9,
                ),
                true
            );
        }

        #[test]
        fn it_handles_nones() {
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        None,
                        Some(1.1),
                        UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints
                    )
                    .unwrap(),
                    1.1,
                ),
                true
            );
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        None,
                        Some(1.1),
                        UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints
                    )
                    .unwrap(),
                    1.1,
                ),
                true
            );
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        Some(1.1),
                        None,
                        UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints
                    )
                    .unwrap(),
                    1.1,
                ),
                true
            );
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        Some(1.1),
                        None,
                        UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints
                    )
                    .unwrap(),
                    1.1,
                ),
                true
            );
            assert_eq!(
                figure_out_new_score_given(
                    None,
                    None,
                    UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints
                ),
                None
            );
            assert_eq!(
                figure_out_new_score_given(
                    None,
                    None,
                    UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints
                ),
                None
            );
        }
    }

    mod figure_out_new_grading_progress {
        use crate::{
            exercises::GradingProgress, user_exercise_states::figure_out_new_grading_progress,
        };

        #[test]
        fn it_works() {
            assert_eq!(
                figure_out_new_grading_progress(
                    GradingProgress::Failed,
                    GradingProgress::FullyGraded
                ),
                GradingProgress::FullyGraded
            );
            assert_eq!(
                figure_out_new_grading_progress(
                    GradingProgress::FullyGraded,
                    GradingProgress::Failed
                ),
                GradingProgress::FullyGraded
            );
            assert_eq!(
                figure_out_new_grading_progress(GradingProgress::Failed, GradingProgress::Pending),
                GradingProgress::Pending
            );
        }
    }

    mod figure_out_new_activity_progress {
        use crate::{
            exercises::ActivityProgress, user_exercise_states::figure_out_new_activity_progress,
        };

        #[test]
        fn it_works() {
            assert_eq!(
                figure_out_new_activity_progress(ActivityProgress::Initialized),
                ActivityProgress::Completed
            );
        }
    }

    #[tokio::test]
    async fn updates_exercise_states() {
        insert_data!(:tx, :user, :org, :course, :instance, :chapter, :page, :exercise, :slide, :task);
        let slide_submission =
            exercise_slide_submissions::insert_exercise_slide_submission_with_id(
                tx.as_mut(),
                Uuid::new_v4(),
                &NewExerciseSlideSubmission {
                    course_id: Some(course),
                    course_instance_id: Some(instance.id),
                    exam_id: None,
                    exercise_id: exercise,
                    user_id: user,
                    exercise_slide_id: slide,
                },
            )
            .await
            .unwrap();
        let task_submission_id = exercise_task_submissions::insert_with_id(
            tx.as_mut(),
            &SubmissionData {
                exercise_id: exercise,
                course_id: course,
                exercise_task_id: task,
                user_id: user,
                course_instance_id: instance.id,
                exercise_slide_id: slide,
                data_json: serde_json::json! {"abcd"},
                id: Uuid::new_v4(),
                exercise_slide_submission_id: slide_submission.id,
            },
        )
        .await
        .unwrap();
        let task_submission = exercise_task_submissions::get_by_id(tx.as_mut(), task_submission_id)
            .await
            .unwrap();
        let exercise = exercises::get_by_id(tx.as_mut(), exercise).await.unwrap();
        let task_grading =
            exercise_task_gradings::new_grading(tx.as_mut(), &exercise, &task_submission)
                .await
                .unwrap();
        exercise_task_gradings::update_grading(
            tx.as_mut(),
            &task_grading,
            &ExerciseTaskGradingResult {
                feedback_json: None,
                feedback_text: None,
                grading_progress: GradingProgress::FullyGraded,
                score_given: 100.0,
                score_maximum: 100,
            },
            &exercise,
        )
        .await
        .unwrap();
        exercise_task_submissions::set_grading_id(tx.as_mut(), task_grading.id, task_submission.id)
            .await
            .unwrap();
        update_user_exercise_state_after_submission(tx.as_mut(), &slide_submission)
            .await
            .unwrap();
        let state = get_or_create_user_exercise_state(
            tx.as_mut(),
            user,
            exercise.id,
            Some(instance.id),
            None,
        )
        .await
        .unwrap();
        assert!(state.score_given.is_some());
    }
}
