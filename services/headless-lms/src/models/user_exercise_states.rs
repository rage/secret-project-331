use crate::models::gradings::UserPointsUpdateStrategy;
use core::f32;

use super::{
    exercises::{ActivityProgress, GradingProgress},
    gradings::Grading,
    submissions::Submission,
};
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct UserExerciseState {
    user_id: Uuid,
    exercise_id: Uuid,
    course_instance_id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    deleted_at: Option<DateTime<Utc>>,
    score_given: Option<f32>,
    grading_progress: GradingProgress,
    activity_progress: ActivityProgress,
}

pub async fn get_or_create_user_exercise_state(
    pool: &PgPool,
    user_id: &Uuid,
    exercise_id: &Uuid,
    course_instance_id: &Uuid,
) -> Result<UserExerciseState> {
    let mut connection = pool.acquire().await?;
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
    .fetch_one(&mut connection)
    .await?;
    Ok(res)
}

fn figure_out_new_score_given<'a>(
    current_score_given: &'a Option<f32>,
    grading_score_given: &'a Option<f32>,
    user_points_update_strategy: &'a UserPointsUpdateStrategy,
) -> &'a Option<f32> {
    if current_score_given.is_none() {
        info!(
            "Current state has no score, using score from grading ({:?})",
            &grading_score_given
        );
        return grading_score_given;
    }
    if grading_score_given.is_none() {
        info!(
            "Grading has no score, using score from current state ({:?})",
            &current_score_given
        );
        return current_score_given;
    }
    let some_current_score_given = current_score_given.expect("Never none, checked above");
    let some_grading_score_given = grading_score_given.expect("Never none, checked above");
    let new_score = match user_points_update_strategy {
        UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints => {
            if some_current_score_given >= some_grading_score_given {
                info!(
                    "Not updating score ({:?} >= {:?})",
                    &some_current_score_given, &some_grading_score_given
                );
                current_score_given
            } else {
                info!(
                    "Updating score from {:?} to {:?}",
                    &some_current_score_given, &some_grading_score_given
                );
                grading_score_given
            }
        }
        UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints => {
            info!(
                "Updating score from {:?} to {:?}",
                &some_current_score_given, &some_grading_score_given
            );
            grading_score_given
        }
    };
    new_score
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
fn figure_out_new_grading_progress<'a>(
    current_grading_progress: &'a GradingProgress,
    grading_grading_progress: &'a GradingProgress,
) -> GradingProgress {
    match current_grading_progress {
        GradingProgress::FullyGraded => GradingProgress::FullyGraded,
        _ => *grading_grading_progress,
    }
}

/**
Returns a new state for the activity progress.

In the future this function will be extended to support peer reviews. When
there's a peer review associated with the exercise, the activity is not complete
before the user has given the peer reviews that they're required to give.
*/
fn figure_out_new_activity_progress(
    current_activity_progress: &ActivityProgress,
) -> ActivityProgress {
    if current_activity_progress == &ActivityProgress::Completed {
        return ActivityProgress::Completed;
    }

    // The case where activity is not completed when the user needs to give peer
    // reviews
    ActivityProgress::Completed
}

pub async fn update_user_exercise_state(
    pool: &PgPool,
    grading: &Grading,
    submission: &Submission,
) -> Result<UserExerciseState> {
    let mut connection = pool.acquire().await?;
    let Submission {
        user_id,
        exercise_id,
        course_instance_id,
        ..
    } = submission;
    let current_state =
        get_or_create_user_exercise_state(pool, user_id, exercise_id, course_instance_id).await?;

    info!(
        "Using user points updating strategy {:?}",
        grading.user_points_update_strategy
    );
    let new_score_given = figure_out_new_score_given(
        &current_state.score_given,
        &grading.score_given,
        &grading.user_points_update_strategy,
    );
    let new_grading_progress =
        figure_out_new_grading_progress(&current_state.grading_progress, &grading.grading_progress);
    let new_activity_progress = figure_out_new_activity_progress(&current_state.activity_progress);

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
        *new_score_given,
        new_grading_progress as GradingProgress,
        new_activity_progress as ActivityProgress,
    )
    .fetch_one(&mut connection)
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
                        &Some(1.1),
                        &Some(1.1),
                        &UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints
                    )
                    .unwrap(),
                    1.1,
                ),
                true
            );
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        &Some(1.1),
                        &Some(20.9),
                        &UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints
                    )
                    .unwrap(),
                    20.9,
                ),
                true
            );
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        &Some(20.9),
                        &Some(1.1),
                        &UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints
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
                        &Some(1.1),
                        &Some(1.1),
                        &UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints
                    )
                    .unwrap(),
                    1.1,
                ),
                true
            );
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        &Some(1.1),
                        &Some(20.9),
                        &UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints
                    )
                    .unwrap(),
                    20.9,
                ),
                true
            );
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        &Some(20.9),
                        &Some(1.1),
                        &UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints
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
                        &None,
                        &Some(1.1),
                        &UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints
                    )
                    .unwrap(),
                    1.1,
                ),
                true
            );
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        &None,
                        &Some(1.1),
                        &UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints
                    )
                    .unwrap(),
                    1.1,
                ),
                true
            );
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        &Some(1.1),
                        &None,
                        &UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints
                    )
                    .unwrap(),
                    1.1,
                ),
                true
            );
            assert_eq!(
                f32_approx_eq(
                    figure_out_new_score_given(
                        &Some(1.1),
                        &None,
                        &UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints
                    )
                    .unwrap(),
                    1.1,
                ),
                true
            );
            assert_eq!(
                figure_out_new_score_given(
                    &None,
                    &None,
                    &UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints
                ),
                &None
            );
            assert_eq!(
                figure_out_new_score_given(
                    &None,
                    &None,
                    &UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints
                ),
                &None
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
                    &GradingProgress::Failed,
                    &GradingProgress::FullyGraded
                ),
                GradingProgress::FullyGraded
            );
            assert_eq!(
                figure_out_new_grading_progress(
                    &GradingProgress::FullyGraded,
                    &GradingProgress::Failed
                ),
                GradingProgress::FullyGraded
            );
            assert_eq!(
                figure_out_new_grading_progress(
                    &GradingProgress::Failed,
                    &GradingProgress::Pending
                ),
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
                figure_out_new_activity_progress(&ActivityProgress::Initialized),
                ActivityProgress::Completed
            );
        }
    }
}
