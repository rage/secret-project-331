use super::{
    exercises::{ActivityProgress, GradingProgress},
    gradings::Grading,
    submissions::Submission,
    ModelResult,
};
use crate::models::gradings::UserPointsUpdateStrategy;
use chrono::{DateTime, Utc};
use core::f32;
use futures::future;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgConnection, PgPool};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct UserExerciseState {
    pub user_id: Uuid,
    pub exercise_id: Uuid,
    pub course_instance_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub score_given: Option<f32>,
    pub grading_progress: GradingProgress,
    pub activity_progress: ActivityProgress,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone)]
pub struct UserProgress {
    score_given: Option<f32>,
    score_maximum: Option<i64>,
    total_exercises: Option<i64>,
    completed_exercises: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone)]
pub struct UserMetrics {
    score_given: Option<f32>,
    completed_exercises: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, PartialEq, Clone)]
pub struct CourseMetrics {
    total_exercises: Option<i64>,
    score_maximum: Option<i64>,
}

pub async fn get_course_metrics(
    pool: &PgPool,
    course_instance_id: &Uuid,
) -> ModelResult<CourseMetrics> {
    let mut connection = pool.acquire().await?;
    let res = sqlx::query_as!(
        CourseMetrics,
        r#"
SELECT COUNT(e.id) as total_exercises,
  COALESCE(0, SUM(e.score_maximum)) as score_maximum
FROM course_instances ci
  LEFT JOIN exercises e on ci.course_id = e.course_id
WHERE e.deleted_at IS NULL
  AND ci.id = $1;
        "#,
        course_instance_id
    )
    .fetch_one(&mut connection)
    .await?;
    Ok(res)
}

pub async fn get_user_metrics(
    pool: &PgPool,
    course_instance_id: &Uuid,
    user_id: &Uuid,
) -> ModelResult<UserMetrics> {
    let mut connection = pool.acquire().await?;
    let res = sqlx::query_as!(
        UserMetrics,
        r#"
SELECT COUNT(ues.exercise_id) as completed_exercises,
  COALESCE(0, SUM(ues.score_given)) as score_given
FROM user_exercise_states ues
WHERE ues.course_instance_id = $1
  AND ues.user_id = $2
  AND ues.deleted_at IS NULL
  AND ues.activity_progress IN ('submitted', 'completed');
        "#,
        course_instance_id,
        user_id
    )
    .fetch_one(&mut connection)
    .await?;
    Ok(res)
}

pub async fn get_user_progress(
    pool: &PgPool,
    course_instance_id: &Uuid,
    user_id: &Uuid,
) -> ModelResult<UserProgress> {
    let (course_metrics, user_metrics) = future::try_join(
        get_course_metrics(pool, course_instance_id),
        get_user_metrics(pool, user_id, course_instance_id),
    )
    .await?;
    let result = UserProgress {
        score_given: user_metrics.score_given,
        completed_exercises: user_metrics.completed_exercises,
        score_maximum: course_metrics.score_maximum,
        total_exercises: course_metrics.total_exercises,
    };
    Ok(result)
}

pub async fn get_or_create_user_exercise_state(
    conn: &mut PgConnection,
    user_id: &Uuid,
    exercise_id: &Uuid,
    course_instance_id: &Uuid,
) -> ModelResult<UserExerciseState> {
    let res = sqlx::query_as!(
        UserExerciseState,
        r#"
INSERT INTO user_exercise_states (user_id, exercise_id, course_instance_id)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, exercise_id, course_instance_id) DO NOTHING
RETURNING user_id,
  exercise_id,
  course_instance_id,
  created_at,
  updated_at,
  deleted_at,
  score_given,
  grading_progress as "grading_progress: _",
  activity_progress as "activity_progress: _";
  "#,
        user_id,
        exercise_id,
        course_instance_id
    )
    .fetch_one(conn)
    .await?;
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
  created_at,
  updated_at,
  deleted_at,
  score_given,
  grading_progress as "grading_progress: _",
  activity_progress as "activity_progress: _"
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
        ..
    } = submission;
    let current_state =
        get_or_create_user_exercise_state(conn, user_id, exercise_id, course_instance_id).await?;

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
  created_at,
  updated_at,
  deleted_at,
  score_given,
  grading_progress as "grading_progress: _",
  activity_progress as "activity_progress: _"
    "#,
        user_id,
        exercise_id,
        course_instance_id,
        new_score_given,
        new_grading_progress as GradingProgress,
        new_activity_progress as ActivityProgress,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

#[cfg(test)]
mod tests {

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
}
