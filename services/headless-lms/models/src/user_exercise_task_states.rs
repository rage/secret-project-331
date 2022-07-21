use crate::{
    exercise_task_gradings::{ExerciseTaskGrading, UserPointsUpdateStrategy},
    exercises::{ActivityProgress, GradingProgress},
    prelude::*,
};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserExerciseTaskState {
    pub exercise_task_id: Uuid,
    pub user_exercise_slide_state_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub score_given: Option<f32>,
    pub grading_progress: GradingProgress,
}

pub async fn insert(
    conn: &mut PgConnection,
    exercise_task_id: Uuid,
    user_exercise_slide_state_id: Uuid,
    grading_progress: GradingProgress,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO user_exercise_task_states (
    exercise_task_id,
    user_exercise_slide_state_id,
    grading_progress
  )
VALUES ($1, $2, $3)
        ",
        exercise_task_id,
        user_exercise_slide_state_id,
        grading_progress as GradingProgress,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Upserts user score from task grading results. The score can always increase
/// or decrease, since they represent only a part of the whole user submission.
pub async fn upsert_with_grading(
    conn: &mut PgConnection,
    user_exercise_slide_state_id: Uuid,
    exercise_task_grading: &ExerciseTaskGrading,
) -> ModelResult<UserExerciseTaskState> {
    upsert_with_grading_status(
        conn,
        exercise_task_grading.exercise_task_id,
        user_exercise_slide_state_id,
        exercise_task_grading.score_given,
        exercise_task_grading.grading_progress,
    )
    .await
}

async fn upsert_with_grading_status(
    conn: &mut PgConnection,
    exercise_task_id: Uuid,
    user_exercise_slide_state_id: Uuid,
    score_given: Option<f32>,
    grading_progress: GradingProgress,
) -> ModelResult<UserExerciseTaskState> {
    let res = sqlx::query_as!(
        UserExerciseTaskState,
        r#"
INSERT INTO user_exercise_task_states (
    exercise_task_id,
    user_exercise_slide_state_id,
    score_given,
    grading_progress
  )
VALUES ($1, $2, $3, $4) ON CONFLICT (exercise_task_id, user_exercise_slide_state_id) DO
UPDATE
SET deleted_at = NULL,
  score_given = $3,
  grading_progress = $4
RETURNING exercise_task_id,
  user_exercise_slide_state_id,
  created_at,
  updated_at,
  deleted_at,
  score_given,
  grading_progress as "grading_progress: _"
    "#,
        exercise_task_id,
        user_exercise_slide_state_id,
        score_given,
        grading_progress as GradingProgress,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get(
    conn: &mut PgConnection,
    exercise_task_id: Uuid,
    user_exercise_state_id: Uuid,
) -> ModelResult<UserExerciseTaskState> {
    let res = sqlx::query_as!(
        UserExerciseTaskState,
        r#"
SELECT exercise_task_id,
  user_exercise_slide_state_id,
  created_at,
  updated_at,
  deleted_at,
  score_given,
  grading_progress as "grading_progress: _"
FROM user_exercise_task_states
WHERE exercise_task_id = $1
  AND user_exercise_slide_state_id = $2
  AND deleted_at IS NULL
        "#,
        exercise_task_id,
        user_exercise_state_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_grading_summary_by_user_exercise_slide_state_id(
    conn: &mut PgConnection,
    user_exercise_slide_state_id: Uuid,
) -> ModelResult<(Option<f32>, GradingProgress)> {
    let res = sqlx::query!(
        r#"
SELECT score_given,
  grading_progress AS "grading_progress: GradingProgress"
FROM user_exercise_task_states
WHERE user_exercise_slide_state_id = $1
  AND deleted_at IS NULL
        "#,
        user_exercise_slide_state_id
    )
    .fetch_all(conn)
    .await?;
    let total_score_given = res
        .iter()
        .filter_map(|x| x.score_given)
        .reduce(|acc, next| acc + next);
    let least_significant_grading_progress = res
        .iter()
        .map(|x| x.grading_progress)
        .min()
        .unwrap_or(GradingProgress::NotReady);
    Ok((total_score_given, least_significant_grading_progress))
}

pub async fn delete(
    conn: &mut PgConnection,
    exercise_task_id: Uuid,
    user_exercise_slide_state_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE user_exercise_task_states
SET deleted_at = now()
WHERE exercise_task_id = $1
  AND user_exercise_slide_state_id = $2
    ",
        exercise_task_id,
        user_exercise_slide_state_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/**
Returns a new state for the activity progress.

In the future this function will be extended to support peer reviews. When
there's a peer review associated with the exercise, the activity is not complete
before the user has given the peer reviews that they're required to give.
*/
pub fn figure_out_new_activity_progress(
    current_activity_progress: ActivityProgress,
) -> ActivityProgress {
    if current_activity_progress == ActivityProgress::Completed {
        return ActivityProgress::Completed;
    }

    // The case where activity is not completed when the user needs to give peer
    // reviews
    ActivityProgress::Completed
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
pub fn figure_out_new_grading_progress(
    current_grading_progress: Option<GradingProgress>,
    grading_grading_progress: GradingProgress,
) -> GradingProgress {
    match current_grading_progress {
        Some(GradingProgress::FullyGraded) => GradingProgress::FullyGraded,
        _ => grading_grading_progress,
    }
}

pub fn figure_out_new_score_given(
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;

    mod get_grading_summary_by_user_exercise_slide_state_id {
        use headless_lms_utils::numbers::f32_approx_eq;
        use serde_json::Value;

        use crate::{
            chapters, exercise_slides,
            exercise_tasks::{self, NewExerciseTask},
            exercises, pages, user_exercise_slide_states, user_exercise_states,
        };

        use super::*;

        #[tokio::test]
        async fn initial_values() {
            insert_data!(:tx);
            let (user_exercise_slide_state_id, task_1, task_2, task_3) =
                create_test_data(&mut tx).await.unwrap();
            insert(
                tx.as_mut(),
                task_1,
                user_exercise_slide_state_id,
                GradingProgress::NotReady,
            )
            .await
            .unwrap();
            insert(
                tx.as_mut(),
                task_2,
                user_exercise_slide_state_id,
                GradingProgress::NotReady,
            )
            .await
            .unwrap();
            insert(
                tx.as_mut(),
                task_3,
                user_exercise_slide_state_id,
                GradingProgress::NotReady,
            )
            .await
            .unwrap();

            let (score_given, grading_progress) =
                get_grading_summary_by_user_exercise_slide_state_id(
                    tx.as_mut(),
                    user_exercise_slide_state_id,
                )
                .await
                .unwrap();
            assert_eq!(score_given, None);
            assert_eq!(grading_progress, GradingProgress::NotReady);
        }

        #[tokio::test]
        async fn single_task() {
            insert_data!(:tx);
            let (user_exercise_slide_state_id, task_1, task_2, task_3) =
                create_test_data(&mut tx).await.unwrap();
            upsert_with_grading_status(
                tx.as_mut(),
                task_1,
                user_exercise_slide_state_id,
                None,
                GradingProgress::NotReady,
            )
            .await
            .unwrap();
            upsert_with_grading_status(
                tx.as_mut(),
                task_2,
                user_exercise_slide_state_id,
                None,
                GradingProgress::NotReady,
            )
            .await
            .unwrap();
            upsert_with_grading_status(
                tx.as_mut(),
                task_3,
                user_exercise_slide_state_id,
                Some(1.0),
                GradingProgress::FullyGraded,
            )
            .await
            .unwrap();

            let (score_given, grading_progress) =
                get_grading_summary_by_user_exercise_slide_state_id(
                    tx.as_mut(),
                    user_exercise_slide_state_id,
                )
                .await
                .unwrap();
            assert!(f32_approx_eq(score_given.unwrap(), 1.0));
            assert_eq!(grading_progress, GradingProgress::NotReady);
        }

        #[tokio::test]
        async fn all_tasks() {
            insert_data!(:tx);
            let (user_exercise_slide_state_id, task_1, task_2, task_3) =
                create_test_data(&mut tx).await.unwrap();
            upsert_with_grading_status(
                tx.as_mut(),
                task_1,
                user_exercise_slide_state_id,
                Some(1.0),
                GradingProgress::FullyGraded,
            )
            .await
            .unwrap();
            upsert_with_grading_status(
                tx.as_mut(),
                task_2,
                user_exercise_slide_state_id,
                Some(1.0),
                GradingProgress::FullyGraded,
            )
            .await
            .unwrap();
            upsert_with_grading_status(
                tx.as_mut(),
                task_3,
                user_exercise_slide_state_id,
                Some(1.0),
                GradingProgress::FullyGraded,
            )
            .await
            .unwrap();

            let (score_given, grading_progress) =
                get_grading_summary_by_user_exercise_slide_state_id(
                    tx.as_mut(),
                    user_exercise_slide_state_id,
                )
                .await
                .unwrap();
            assert!(f32_approx_eq(score_given.unwrap(), 3.0));
            assert_eq!(grading_progress, GradingProgress::FullyGraded);
        }

        async fn create_test_data(tx: &mut Tx<'_>) -> ModelResult<(Uuid, Uuid, Uuid, Uuid)> {
            insert_data!(tx: tx; :user, :org, :course, :instance, :course_module);
            let chapter_id =
                chapters::insert(tx.as_mut(), "chapter", course, 1, course_module).await?;
            let (page_id, _history) =
                pages::insert_course_page(tx.as_mut(), course, "/test", "test", 1, user).await?;
            let exercise_id =
                exercises::insert(tx.as_mut(), course, "course", page_id, chapter_id, 1).await?;
            let slide_id = exercise_slides::insert(tx.as_mut(), exercise_id, 1).await?;
            let task_1 = exercise_tasks::insert(
                tx.as_mut(),
                NewExerciseTask {
                    exercise_slide_id: slide_id,
                    exercise_type: "test-exercise".to_string(),
                    assignment: vec![],
                    public_spec: Some(Value::Null),
                    private_spec: Some(Value::Null),
                    spec_file_id: None,
                    model_solution_spec: Some(Value::Null),
                    order_number: 1,
                },
            )
            .await?;
            let task_2 = exercise_tasks::insert(
                tx.as_mut(),
                NewExerciseTask {
                    exercise_slide_id: slide_id,
                    exercise_type: "test-exercise".to_string(),
                    assignment: vec![],
                    public_spec: Some(Value::Null),
                    private_spec: Some(Value::Null),
                    spec_file_id: None,
                    model_solution_spec: Some(Value::Null),
                    order_number: 2,
                },
            )
            .await?;
            let task_3 = exercise_tasks::insert(
                tx.as_mut(),
                NewExerciseTask {
                    exercise_slide_id: slide_id,
                    exercise_type: "test-exercise".to_string(),
                    assignment: vec![],
                    public_spec: Some(Value::Null),
                    private_spec: Some(Value::Null),
                    spec_file_id: None,
                    model_solution_spec: Some(Value::Null),
                    order_number: 3,
                },
            )
            .await?;
            let user_exercise_state = user_exercise_states::get_or_create_user_exercise_state(
                tx.as_mut(),
                user,
                exercise_id,
                Some(instance.id),
                None,
            )
            .await?;
            user_exercise_states::upsert_selected_exercise_slide_id(
                tx.as_mut(),
                user,
                exercise_id,
                Some(instance.id),
                None,
                Some(slide_id),
            )
            .await?;
            let user_exercise_slide_state_id =
                user_exercise_slide_states::insert(tx.as_mut(), user_exercise_state.id, slide_id)
                    .await?;
            Ok((user_exercise_slide_state_id, task_1, task_2, task_3))
        }
    }

    mod figure_out_new_activity_progress {
        use super::*;

        #[test]
        fn it_works() {
            assert_eq!(
                figure_out_new_activity_progress(ActivityProgress::Initialized),
                ActivityProgress::Completed
            );
        }
    }

    mod figure_out_new_grading_progress {
        use super::*;

        const ALL_GRADING_PROGRESSES: [GradingProgress; 5] = [
            GradingProgress::FullyGraded,
            GradingProgress::Pending,
            GradingProgress::PendingManual,
            GradingProgress::Failed,
            GradingProgress::NotReady,
        ];

        #[test]
        fn current_fully_graded_progress_always_retains() {
            let current_grading_progress = GradingProgress::FullyGraded;
            for grading_grading_progress in ALL_GRADING_PROGRESSES {
                let new_grading_progress = figure_out_new_grading_progress(
                    Some(current_grading_progress),
                    grading_grading_progress,
                );
                assert_eq!(new_grading_progress, current_grading_progress);
            }
        }

        #[test]
        fn uses_value_from_grading_if_not_completed() {
            for grading_grading_progress in ALL_GRADING_PROGRESSES {
                let current_grading_progresses = vec![
                    None,
                    Some(GradingProgress::Pending),
                    Some(GradingProgress::PendingManual),
                    Some(GradingProgress::Failed),
                    Some(GradingProgress::NotReady),
                ];
                for current_grading_progress in current_grading_progresses {
                    let new_grading_progress = figure_out_new_grading_progress(
                        current_grading_progress,
                        grading_grading_progress,
                    );
                    assert_eq!(new_grading_progress, grading_grading_progress);
                }
            }
        }
    }

    mod figure_out_new_score_given {
        use headless_lms_utils::numbers::{f32_approx_eq, f32_max};

        use super::*;

        #[test]
        fn strategy_can_add_points_and_can_remove_points_works() {
            let test_cases = vec![(1.1, 1.1), (1.1, 20.9), (20.9, 1.1)];
            for (current, new) in test_cases {
                let result = figure_out_new_score_given(
                    Some(current),
                    Some(new),
                    UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
                )
                .unwrap();
                assert!(f32_approx_eq(result, new));
            }
        }

        #[test]
        fn strategy_can_add_points_but_cannot_remove_points_works() {
            let test_cases = vec![(1.1, 1.1), (1.1, 20.9), (20.9, 1.1)];
            for (current, new) in test_cases {
                let result = figure_out_new_score_given(
                    Some(current),
                    Some(new),
                    UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints,
                )
                .unwrap();
                assert!(f32_approx_eq(result, f32_max(current, new)))
            }
        }

        #[test]
        fn it_handles_nones() {
            let user_points_update_strategies = vec![
                UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
                UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints,
            ];
            for update_strategy in user_points_update_strategies {
                assert_eq!(
                    figure_out_new_score_given(None, None, update_strategy),
                    None
                );
                assert!(f32_approx_eq(
                    figure_out_new_score_given(None, Some(1.1), update_strategy).unwrap(),
                    1.1
                ));
                assert!(f32_approx_eq(
                    figure_out_new_score_given(Some(1.1), None, update_strategy).unwrap(),
                    1.1
                ));
            }
        }
    }
}
