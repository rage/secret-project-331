use super::{
    exercises::{ActivityProgress, GradingProgress},
    gradings::Grading,
    submissions::Submission,
    ModelResult,
};
use crate::{
    models::gradings::UserPointsUpdateStrategy, utils::numbers::option_f32_to_f32_two_decimals,
};
use chrono::{DateTime, Utc};
use core::f32;
use futures::{future, Stream};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, PgConnection, PgPool};
use ts_rs::TS;
use uuid::Uuid;

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

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone, TS)]
pub struct UserCourseInstanceProgress {
    score_given: f32,
    score_maximum: Option<u32>,
    total_exercises: Option<u32>,
    completed_exercises: Option<u32>,
}
#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone, TS)]
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
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone)]
pub struct UserCourseInstanceMetrics {
    score_given: Option<f32>,
    completed_exercises: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone)]
pub struct CourseInstanceExerciseMetrics {
    total_exercises: Option<i64>,
    score_maximum: Option<i64>,
}

pub async fn get_course_instance_metrics(
    pool: &PgPool,
    course_instance_id: &Uuid,
) -> ModelResult<CourseInstanceExerciseMetrics> {
    let mut connection = pool.acquire().await?;
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
    .fetch_one(&mut connection)
    .await?;
    Ok(res)
}

pub async fn get_user_course_instance_metrics(
    pool: &PgPool,
    course_instance_id: &Uuid,
    user_id: &Uuid,
) -> ModelResult<UserCourseInstanceMetrics> {
    let mut connection = pool.acquire().await?;
    let res = sqlx::query_as!(
        UserCourseInstanceMetrics,
        r#"
SELECT COUNT(ues.exercise_id) AS completed_exercises,
  COALESCE(SUM(ues.score_given), 0) AS score_given
FROM user_exercise_states AS ues
WHERE ues.course_instance_id = $1
  AND ues.user_id = $2
  AND ues.deleted_at IS NULL;
        "#,
        course_instance_id,
        user_id
    )
    .fetch_one(&mut connection)
    .await?;
    Ok(res)
}

pub async fn get_user_course_instance_chapter_metrics(
    pool: &PgPool,
    course_instance_id: &Uuid,
    exercise_ids: &[Uuid],
    user_id: &Uuid,
) -> ModelResult<UserChapterMetrics> {
    let mut connection = pool.acquire().await?;
    let res = sqlx::query_as!(
        UserChapterMetrics,
        r#"
SELECT COALESCE(SUM(ues.score_given), 0) AS score_given
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
    .fetch_one(&mut connection)
    .await?;
    Ok(res)
}

pub async fn get_user_course_instance_progress(
    pool: &PgPool,
    course_instance_id: &Uuid,
    user_id: &Uuid,
) -> ModelResult<UserCourseInstanceProgress> {
    let (course_metrics, user_metrics) = future::try_join(
        get_course_instance_metrics(pool, course_instance_id),
        get_user_course_instance_metrics(pool, course_instance_id, user_id),
    )
    .await?;
    let result = UserCourseInstanceProgress {
        score_given: option_f32_to_f32_two_decimals(user_metrics.score_given),
        completed_exercises: user_metrics
            .completed_exercises
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
    pool: &PgPool,
    course_instance_id: &Uuid,
    exercise_ids: &[Uuid],
    user_id: &Uuid,
) -> ModelResult<Vec<DatabaseUserCourseInstanceChapterExerciseProgress>> {
    let mut connection = pool.acquire().await?;
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
    .fetch_all(&mut connection)
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
  AND course_instance_id = $3
  AND exam_id = $4
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
    INSERT INTO user_exercise_states (user_id, exercise_id, course_instance_id)
    VALUES ($1, $2, $3)
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
            course_instance_id
        )
        .fetch_one(&mut *conn)
        .await?
    };
    Ok(res)
}

pub async fn get_user_exercise_state_if_exits(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<Option<UserExerciseState>> {
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
  AND course_instance_id = $3
      "#,
        user_id,
        exercise_id,
        course_instance_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn upsert_selected_exercise_slide_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Uuid,
    selected_exercise_slide_id: Option<Uuid>,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO user_exercise_states (
    user_id,
    exercise_id,
    course_instance_id,
    selected_exercise_slide_id
  )
VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, exercise_id, course_instance_id) DO
UPDATE
SET selected_exercise_slide_id = $4
",
        user_id,
        exercise_id,
        course_instance_id,
        selected_exercise_slide_id,
    )
    .execute(&mut *conn)
    .await?;
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

pub async fn update_user_exercise_state(
    conn: &mut PgConnection,
    grading: &Grading,
    submission: &Submission,
) -> ModelResult<UserExerciseState> {
    let Submission {
        user_id,
        exercise_id,
        course_instance_id,
        exam_id,
        ..
    } = submission;
    let current_state = get_or_create_user_exercise_state(
        conn,
        *user_id,
        *exercise_id,
        *course_instance_id,
        *exam_id,
    )
    .await?;

    info!(
        "Using user points updating strategy {:?}",
        grading.user_points_update_strategy
    );
    let new_score_given = figure_out_new_score_given(
        current_state.score_given,
        grading.score_given,
        grading.user_points_update_strategy,
    );
    let new_grading_progress =
        figure_out_new_grading_progress(current_state.grading_progress, grading.grading_progress);
    let new_activity_progress = figure_out_new_activity_progress(current_state.activity_progress);

    let res = sqlx::query_as!(
        UserExerciseState,
        r#"
UPDATE user_exercise_states
SET score_given = $4, grading_progress = $5, activity_progress = $6
WHERE user_id = $1
AND exercise_id = $2
AND course_instance_id = $3
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
        *course_instance_id,
        new_score_given,
        new_grading_progress as GradingProgress,
        new_activity_progress as ActivityProgress,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct CourseInstancePoints {
    pub user_id: Uuid,
    pub points_for_each_chapter: Vec<Inner>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct Inner {
    pub chapter_number: i32,
    pub points_for_chapter: f32,
}

pub fn stream_course_instance_points(
    conn: &mut PgConnection,
    course_instance_id: Uuid,
) -> impl Stream<Item = sqlx::Result<CourseInstancePoints>> + '_ {
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
            .map(|points_for_each_chapter| CourseInstancePoints {
                user_id,
                points_for_each_chapter,
            })
            .map_err(|e| sqlx::Error::Decode(Box::new(e)))
    })
    .fetch(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        models::{
            exercises, gradings,
            submissions::{self, GradingResult, SubmissionData},
        },
        test_helper::{insert_data, Conn},
    };

    mod figure_out_new_score_given {
        use crate::{
            models::{
                gradings::UserPointsUpdateStrategy,
                user_exercise_states::figure_out_new_score_given,
            },
            utils::numbers::f32_approx_eq,
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
        use crate::models::{
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
        use crate::models::{
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
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let data = insert_data(tx.as_mut(), "").await.unwrap();

        let submission = submissions::insert_with_id(
            tx.as_mut(),
            &SubmissionData {
                exercise_id: data.exercise,
                course_id: data.course,
                exercise_task_id: data.task,
                user_id: data.user,
                course_instance_id: data.instance,
                data_json: serde_json::json! {"abcd"},
                id: Uuid::new_v4(),
            },
        )
        .await
        .unwrap();
        let submission = submissions::get_by_id(tx.as_mut(), submission)
            .await
            .unwrap();
        let grading = gradings::new_grading(tx.as_mut(), &submission)
            .await
            .unwrap();
        let exercise = exercises::get_by_id(tx.as_mut(), data.exercise)
            .await
            .unwrap();
        let grading = gradings::update_grading(
            tx.as_mut(),
            &grading,
            &GradingResult {
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
        submissions::set_grading_id(tx.as_mut(), grading.id, submission.id)
            .await
            .unwrap();
        let submission = submissions::get_by_id(tx.as_mut(), submission.id)
            .await
            .unwrap();
        update_user_exercise_state(tx.as_mut(), &grading, &submission)
            .await
            .unwrap();
        let state = get_or_create_user_exercise_state(
            tx.as_mut(),
            data.user,
            exercise.id,
            Some(data.instance),
            None,
        )
        .await
        .unwrap();
        assert!(state.score_given.is_some());
    }
}
