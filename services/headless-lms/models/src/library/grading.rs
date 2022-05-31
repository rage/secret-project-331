use std::collections::HashMap;

use crate::{
    exercise_slide_submissions::{self, ExerciseSlideSubmission, NewExerciseSlideSubmission},
    exercise_task_gradings::{
        self, ExerciseTaskGrading, ExerciseTaskGradingResult, UserPointsUpdateStrategy,
    },
    exercise_task_regrading_submissions::ExerciseTaskRegradingSubmission,
    exercise_task_submissions::{self, ExerciseTaskSubmission},
    exercise_tasks::{self, ExerciseTask},
    exercises::{ActivityProgress, Exercise, ExerciseStatus, GradingProgress},
    prelude::*,
    regradings,
    user_exercise_slide_states::{self, UserExerciseSlideState},
    user_exercise_states::{self, ReviewingStage, UserExerciseState, UserExerciseStateUpdate},
    user_exercise_task_states,
};

/// Contains data sent by the student when they make a submission for an exercise slide.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct StudentExerciseSlideSubmission {
    pub exercise_slide_id: Uuid,
    pub exercise_task_submissions: Vec<StudentExerciseTaskSubmission>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct StudentExerciseSlideSubmissionResult {
    pub exercise_status: Option<ExerciseStatus>,
    pub exercise_task_submission_results: Vec<StudentExerciseTaskSubmissionResult>,
}

impl StudentExerciseSlideSubmissionResult {
    pub fn clear_grading_information(&mut self) {
        self.exercise_status = None;
        self.exercise_task_submission_results
            .iter_mut()
            .for_each(|result| {
                result.grading = None;
                result.model_solution_spec = None;
            });
    }

    pub fn clear_model_solution_specs(&mut self) {
        self.exercise_task_submission_results
            .iter_mut()
            .for_each(|result| {
                result.model_solution_spec = None;
            })
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct StudentExerciseTaskSubmission {
    pub exercise_task_id: Uuid,
    pub data_json: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct StudentExerciseTaskSubmissionResult {
    pub submission: ExerciseTaskSubmission,
    pub grading: Option<ExerciseTaskGrading>,
    pub model_solution_spec: Option<serde_json::Value>,
}

#[derive(Debug)]
pub struct ExerciseSlideSubmissionWithTasks {
    pub exercise_slide_submission: ExerciseSlideSubmission,
    pub exercise_slide_submission_tasks: Vec<ExerciseTaskSubmission>,
}

/// Inserts user submission to database. Tasks within submission are validated to make sure that
/// they belong to the correct exercise slide.
pub async fn create_user_exercise_slide_submission(
    conn: &mut PgConnection,
    exercise: &Exercise,
    user_exercise_state: &UserExerciseState,
    user_exercise_slide_submission: StudentExerciseSlideSubmission,
) -> ModelResult<ExerciseSlideSubmissionWithTasks> {
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
    let user_points_update_strategy = if exercise.exam_id.is_some() {
        UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints
    } else {
        UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints
    };

    let mut tx = conn.begin().await?;

    let exercise_slide_submission = exercise_slide_submissions::insert_exercise_slide_submission(
        &mut tx,
        NewExerciseSlideSubmission {
            exercise_slide_id: selected_exercise_slide_id,
            course_id: exercise.course_id,
            course_instance_id: user_exercise_state.course_instance_id,
            exam_id: user_exercise_state.exam_id,
            exercise_id: user_exercise_state.exercise_id,
            user_id: user_exercise_state.user_id,
            user_points_update_strategy,
        },
    )
    .await?;
    let user_exercise_task_submissions = user_exercise_slide_submission.exercise_task_submissions;
    let mut exercise_slide_submission_tasks =
        Vec::with_capacity(user_exercise_task_submissions.len());
    for task_submission in user_exercise_task_submissions {
        let exercise_task = exercise_tasks
            .get(&task_submission.exercise_task_id)
            .ok_or_else(|| {
                ModelError::PreconditionFailed(
                    "Attempting to submit exercise for illegal exercise_task_id.".to_string(),
                )
            })?;
        let submission_id = exercise_task_submissions::insert(
            &mut tx,
            exercise_slide_submission.id,
            exercise_task.exercise_slide_id,
            exercise_task.id,
            task_submission.data_json,
        )
        .await?;
        let submission = exercise_task_submissions::get_by_id(&mut tx, submission_id).await?;
        exercise_slide_submission_tasks.push(submission)
    }

    tx.commit().await?;
    Ok(ExerciseSlideSubmissionWithTasks {
        exercise_slide_submission,
        exercise_slide_submission_tasks,
    })
}

pub async fn grade_user_submission(
    conn: &mut PgConnection,
    exercise: &Exercise,
    user_exercise_state: UserExerciseState,
    user_exercise_slide_submission: StudentExerciseSlideSubmission,
) -> ModelResult<StudentExerciseSlideSubmissionResult> {
    grade_user_submission_internal(
        conn,
        exercise,
        user_exercise_state,
        user_exercise_slide_submission,
        None,
    )
    .await
}

// Relocated regrading logic to condensate score update logic in a single place.
// Needs better separation of concerns in the far future.
pub async fn update_grading_with_single_regrading_result(
    conn: &mut PgConnection,
    exercise: &Exercise,
    regrading_submission: &ExerciseTaskRegradingSubmission,
    exercise_task_grading: &ExerciseTaskGrading,
    exercise_task_grading_result: &ExerciseTaskGradingResult,
) -> ModelResult<()> {
    let task_submission = exercise_task_submissions::get_by_id(
        &mut *conn,
        regrading_submission.exercise_task_submission_id,
    )
    .await?;
    let slide_submission = exercise_slide_submissions::get_by_id(
        &mut *conn,
        task_submission.exercise_slide_submission_id,
    )
    .await?;
    let user_exercise_state = user_exercise_states::get_or_create_user_exercise_state(
        conn,
        slide_submission.user_id,
        exercise.id,
        slide_submission.course_instance_id,
        slide_submission.exam_id,
    )
    .await?;
    let user_exercise_slide_state = user_exercise_slide_states::get_or_insert_by_unique_index(
        &mut *conn,
        user_exercise_state.id,
        slide_submission.exercise_slide_id,
    )
    .await?;
    let regrading = regradings::get_by_id(&mut *conn, regrading_submission.regrading_id).await?;
    propagate_user_exercise_state_update_from_exercise_task_grading_result(
        conn,
        exercise,
        exercise_task_grading,
        exercise_task_grading_result,
        user_exercise_slide_state,
        regrading.user_points_update_strategy,
    )
    .await?;
    Ok(())
}

pub async fn update_exercise_state_with_single_exercise_task_grading_result(
    conn: &mut PgConnection,
    exercise: &Exercise,
    exercise_task_grading: &ExerciseTaskGrading,
    exercise_task_grading_result: &ExerciseTaskGradingResult,
    user_exercise_slide_state: UserExerciseSlideState,
    user_points_update_strategy: UserPointsUpdateStrategy,
) -> ModelResult<()> {
    propagate_user_exercise_state_update_from_exercise_task_grading_result(
        conn,
        exercise,
        exercise_task_grading,
        exercise_task_grading_result,
        user_exercise_slide_state,
        user_points_update_strategy,
    )
    .await?;
    Ok(())
}

pub async fn test_only_grade_user_submission_with_fixed_results(
    conn: &mut PgConnection,
    exercise: &Exercise,
    user_exercise_state: UserExerciseState,
    user_exercise_slide_submission: StudentExerciseSlideSubmission,
    mock_results: HashMap<Uuid, ExerciseTaskGradingResult>,
) -> ModelResult<StudentExerciseSlideSubmissionResult> {
    grade_user_submission_internal(
        conn,
        exercise,
        user_exercise_state,
        user_exercise_slide_submission,
        Some(mock_results),
    )
    .await
}

async fn grade_user_submission_internal(
    conn: &mut PgConnection,
    exercise: &Exercise,
    user_exercise_state: UserExerciseState,
    user_exercise_slide_submission: StudentExerciseSlideSubmission,
    mock_results: Option<HashMap<Uuid, ExerciseTaskGradingResult>>,
) -> ModelResult<StudentExerciseSlideSubmissionResult> {
    let mut tx = conn.begin().await?;

    let ExerciseSlideSubmissionWithTasks {
        exercise_slide_submission,
        exercise_slide_submission_tasks,
    } = create_user_exercise_slide_submission(
        &mut tx,
        exercise,
        &user_exercise_state,
        user_exercise_slide_submission,
    )
    .await?;
    let user_exercise_slide_state = user_exercise_slide_states::get_or_insert_by_unique_index(
        &mut tx,
        user_exercise_state.id,
        exercise_slide_submission.exercise_slide_id,
    )
    .await?;
    let mut results = Vec::with_capacity(exercise_slide_submission_tasks.len());
    if let Some(mock_results) = mock_results {
        for task_submission in exercise_slide_submission_tasks {
            let mock_result = mock_results
                .get(&task_submission.exercise_task_id)
                .ok_or_else(|| ModelError::Generic("".to_string()))?
                .clone();
            let submission = create_fixed_grading_for_submission_task(
                &mut tx,
                &task_submission,
                exercise,
                user_exercise_slide_state.id,
                &mock_result,
            )
            .await?;
            results.push(submission);
        }
    } else {
        for task_submission in exercise_slide_submission_tasks {
            let submission = grade_user_submission_task(
                &mut tx,
                &task_submission,
                exercise,
                user_exercise_slide_state.id,
            )
            .await?;
            results.push(submission);
        }
    }
    let user_exercise_state = propagate_user_exercise_state_update_from_slide(
        &mut tx,
        exercise,
        user_exercise_slide_state,
        exercise_slide_submission.user_points_update_strategy,
    )
    .await?;

    tx.commit().await?;
    Ok(StudentExerciseSlideSubmissionResult {
        exercise_status: Some(ExerciseStatus {
            score_given: user_exercise_state.score_given,
            activity_progress: user_exercise_state.activity_progress,
            grading_progress: user_exercise_state.grading_progress,
            reviewing_stage: user_exercise_state.reviewing_stage,
        }),
        exercise_task_submission_results: results,
    })
}

async fn grade_user_submission_task(
    conn: &mut PgConnection,
    submission: &ExerciseTaskSubmission,
    exercise: &Exercise,
    user_exercise_slide_state_id: Uuid,
) -> ModelResult<StudentExerciseTaskSubmissionResult> {
    let grading = exercise_task_gradings::new_grading(conn, exercise, submission).await?;
    let updated_submission =
        exercise_task_submissions::set_grading_id(conn, grading.id, submission.id).await?;
    let exercise_task =
        exercise_tasks::get_exercise_task_by_id(conn, submission.exercise_task_id).await?;
    let grading = exercise_task_gradings::grade_submission(
        conn,
        submission,
        &exercise_task,
        exercise,
        &grading,
    )
    .await?;
    user_exercise_task_states::upsert_with_grading(conn, user_exercise_slide_state_id, &grading)
        .await?;
    let model_solution_spec = exercise_tasks::get_exercise_task_model_solution_spec_by_id(
        conn,
        submission.exercise_task_id,
    )
    .await?;

    Ok(StudentExerciseTaskSubmissionResult {
        submission: updated_submission,
        grading: Some(grading),
        model_solution_spec,
    })
}

async fn create_fixed_grading_for_submission_task(
    conn: &mut PgConnection,
    submission: &ExerciseTaskSubmission,
    exercise: &Exercise,
    user_exercise_slide_state_id: Uuid,
    asd: &ExerciseTaskGradingResult,
) -> ModelResult<StudentExerciseTaskSubmissionResult> {
    let grading = exercise_task_gradings::new_grading(conn, exercise, submission).await?;
    let updated_submission =
        exercise_task_submissions::set_grading_id(conn, grading.id, submission.id).await?;
    let updated_grading =
        exercise_task_gradings::update_grading(conn, &grading, asd, exercise).await?;
    user_exercise_task_states::upsert_with_grading(
        conn,
        user_exercise_slide_state_id,
        &updated_grading,
    )
    .await?;
    let model_solution_spec = exercise_tasks::get_exercise_task_model_solution_spec_by_id(
        conn,
        submission.exercise_task_id,
    )
    .await?;

    Ok(StudentExerciseTaskSubmissionResult {
        submission: updated_submission,
        grading: Some(grading),
        model_solution_spec,
    })
}

pub async fn update_user_exercise_state_peer_review_status(
    conn: &mut PgConnection,
    exercise: &Exercise,
    user_exercise_state: UserExerciseState,
    given_enough_peer_reviews: bool,
    received_enough_peer_reviews: bool,
) -> ModelResult<UserExerciseState> {
    let user_exercise_state = update_user_exercise_state(
        conn,
        exercise,
        &user_exercise_state,
        UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
        given_enough_peer_reviews,
        received_enough_peer_reviews,
    )
    .await?;
    Ok(user_exercise_state)
}

async fn update_user_exercise_state(
    conn: &mut PgConnection,
    exercise: &Exercise,
    user_exercise_state: &UserExerciseState,
    user_points_update_strategy: UserPointsUpdateStrategy,
    given_enough_peer_reviews: bool,
    received_enough_peer_reviews: bool,
) -> ModelResult<UserExerciseState> {
    let (points_from_slides, grading_progress) =
        user_exercise_slide_states::get_grading_summary_by_user_exercise_state_id(
            conn,
            user_exercise_state.id,
        )
        .await?;
    let new_score_given = user_exercise_task_states::figure_out_new_score_given(
        user_exercise_state.score_given,
        points_from_slides,
        user_points_update_strategy,
    );
    let user_exercise_state_update = derive_new_user_exercise_state(
        exercise,
        user_exercise_state,
        new_score_given,
        grading_progress,
        given_enough_peer_reviews,
        received_enough_peer_reviews,
    );
    let new_user_exercise_state =
        user_exercise_states::update(conn, user_exercise_state_update).await?;
    Ok(new_user_exercise_state)
}

fn derive_new_user_exercise_state(
    exercise: &Exercise,
    user_exercise_state: &UserExerciseState,
    new_score_given: Option<f32>,
    new_grading_progress: GradingProgress,
    given_enough_peer_reviews: bool,
    received_enough_peer_reviews: bool,
) -> UserExerciseStateUpdate {
    let reviewing_stage = if exercise.needs_peer_review {
        // Separate booleans in case we want more elaborate exercise state later
        if given_enough_peer_reviews && received_enough_peer_reviews {
            ReviewingStage::ReviewedAndLocked
        } else if given_enough_peer_reviews {
            ReviewingStage::WaitingForPeerReviews
        } else {
            user_exercise_state.reviewing_stage
        }
    } else {
        // Don't change the field value ever for exercises that don't need peer review
        // Most states need to stay in the ReviewingStage::NotStarted stage
        user_exercise_state.reviewing_stage
    };
    if user_exercise_state.reviewing_stage != reviewing_stage {
        info!(
            "UserExerciseState {} changed reviewing_stage from {:?} to {:?}",
            user_exercise_state.id, user_exercise_state.reviewing_stage, reviewing_stage
        );
    }
    let score_given = match (exercise.needs_peer_review, reviewing_stage) {
        (true, ReviewingStage::ReviewedAndLocked) => new_score_given,
        (false, ReviewingStage::NotStarted) => new_score_given,
        // This case could happen if an answer without peer review requirement would be marked for manual teacher review
        (false, ReviewingStage::ReviewedAndLocked) => new_score_given,
        _ => user_exercise_state.score_given,
    };

    UserExerciseStateUpdate {
        id: user_exercise_state.id,
        score_given,
        grading_progress: new_grading_progress,
        activity_progress: ActivityProgress::Completed,
        reviewing_stage,
    }
}

/// Updates the user exercise state starting from a slide state, and propagates the update up to the
/// whole user exercise state.
async fn propagate_user_exercise_state_update_from_slide(
    conn: &mut PgConnection,
    exercise: &Exercise,
    user_exercise_slide_state: UserExerciseSlideState,
    user_points_update_strategy: UserPointsUpdateStrategy,
) -> ModelResult<UserExerciseState> {
    update_user_exercise_slide_state(
        conn,
        &user_exercise_slide_state,
        user_points_update_strategy,
    )
    .await?;
    let user_exercise_state =
        user_exercise_states::get_by_id(conn, user_exercise_slide_state.user_exercise_state_id)
            .await?;
    let user_exercise_state = update_user_exercise_state(
        conn,
        exercise,
        &user_exercise_state,
        user_points_update_strategy,
        false,
        false,
    )
    .await?;
    Ok(user_exercise_state)
}

async fn update_user_exercise_slide_state(
    conn: &mut PgConnection,
    user_exercise_slide_state: &UserExerciseSlideState,
    user_points_update_strategy: UserPointsUpdateStrategy,
) -> ModelResult<()> {
    let (points_from_tasks, grading_progress) =
        user_exercise_task_states::get_grading_summary_by_user_exercise_slide_state_id(
            conn,
            user_exercise_slide_state.id,
        )
        .await?;
    let new_score_given = user_exercise_task_states::figure_out_new_score_given(
        user_exercise_slide_state.score_given,
        points_from_tasks,
        user_points_update_strategy,
    );
    let changes = user_exercise_slide_states::update(
        conn,
        user_exercise_slide_state.id,
        new_score_given,
        grading_progress,
    )
    .await?;
    info!(
        "Updating user exercise slide state {} affected {} rows.",
        user_exercise_slide_state.id, changes
    );
    Ok(())
}

/// Updates the user exercise state starting from a single task, and propagates the update up to the
/// whole user exercise state.
async fn propagate_user_exercise_state_update_from_exercise_task_grading_result(
    conn: &mut PgConnection,
    exercise: &Exercise,
    exercise_task_grading: &ExerciseTaskGrading,
    exercise_task_grading_result: &ExerciseTaskGradingResult,
    user_exercise_slide_state: UserExerciseSlideState,
    user_points_update_strategy: UserPointsUpdateStrategy,
) -> ModelResult<UserExerciseState> {
    let updated_exercise_task_grading = exercise_task_gradings::update_grading(
        conn,
        exercise_task_grading,
        exercise_task_grading_result,
        exercise,
    )
    .await?;
    exercise_task_submissions::set_grading_id(
        conn,
        updated_exercise_task_grading.id,
        updated_exercise_task_grading.exercise_task_submission_id,
    )
    .await?;
    let user_exercise_task_state = user_exercise_task_states::upsert_with_grading(
        conn,
        user_exercise_slide_state.id,
        &updated_exercise_task_grading,
    )
    .await?;
    let user_exercise_slide_state = user_exercise_slide_states::get_by_id(
        conn,
        user_exercise_task_state.user_exercise_slide_state_id,
    )
    .await?;
    let user_exercise_state = propagate_user_exercise_state_update_from_slide(
        conn,
        exercise,
        user_exercise_slide_state,
        user_points_update_strategy,
    )
    .await?;
    Ok(user_exercise_state)
}

#[cfg(test)]
mod tests {
    use super::*;

    mod derive_new_user_exercise_state {
        use chrono::TimeZone;
        use headless_lms_utils::numbers::f32_approx_eq;

        use super::*;

        #[test]
        fn updates_state_for_normal_exercise() {
            let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let exercise = create_exercise(CourseOrExamId::Course(id), false);
            let user_exercise_state = create_user_exercise_state(
                &exercise,
                None,
                ActivityProgress::Initialized,
                ReviewingStage::NotStarted,
            );
            let new_user_exercise_state = derive_new_user_exercise_state(
                &exercise,
                &user_exercise_state,
                Some(1.0),
                GradingProgress::FullyGraded,
                false,
                false,
            );
            assert_results(
                &new_user_exercise_state,
                Some(1.0),
                ActivityProgress::Completed,
                ReviewingStage::ReviewedAndLocked,
            );
        }

        #[test]
        fn doesnt_update_score_for_exercise_that_needs_to_be_peer_reviewed() {
            let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let exercise = create_exercise(CourseOrExamId::Course(id), true);
            let user_exercise_state = create_user_exercise_state(
                &exercise,
                Some(0.0),
                ActivityProgress::Initialized,
                ReviewingStage::NotStarted,
            );
            let new_user_exercise_state = derive_new_user_exercise_state(
                &exercise,
                &user_exercise_state,
                Some(1.0),
                GradingProgress::FullyGraded,
                false,
                false,
            );
            assert_results(
                &new_user_exercise_state,
                Some(0.0),
                ActivityProgress::Completed,
                ReviewingStage::NotStarted,
            );
        }

        #[test]
        fn updates_score_for_exercise_that_has_been_peer_reviewed() {
            let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let exercise = create_exercise(CourseOrExamId::Course(id), true);
            let user_exercise_state = create_user_exercise_state(
                &exercise,
                Some(0.0),
                ActivityProgress::Initialized,
                ReviewingStage::NotStarted,
            );
            let new_user_exercise_state = derive_new_user_exercise_state(
                &exercise,
                &user_exercise_state,
                Some(1.0),
                GradingProgress::FullyGraded,
                true,
                true,
            );
            assert_results(
                &new_user_exercise_state,
                Some(1.0),
                ActivityProgress::Completed,
                ReviewingStage::ReviewedAndLocked,
            );
        }

        // Not sure if this makes sense in the long run, but having to get peer review information
        // for every single submission would be cumbersome. There shouldn't be any scenario where
        // we want to (automatically) revert peer review progress back to incomplete.
        #[test]
        fn doesnt_degrade_state_if_peer_review_was_once_finished() {
            let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let exercise = create_exercise(CourseOrExamId::Course(id), true);
            let user_exercise_state = create_user_exercise_state(
                &exercise,
                Some(1.0),
                ActivityProgress::Completed,
                ReviewingStage::ReviewedAndLocked,
            );
            let new_user_exercise_state = derive_new_user_exercise_state(
                &exercise,
                &user_exercise_state,
                Some(1.0),
                GradingProgress::FullyGraded,
                false,
                false,
            );
            assert_results(
                &new_user_exercise_state,
                Some(1.0),
                ActivityProgress::Completed,
                ReviewingStage::ReviewedAndLocked,
            );
        }

        fn assert_results(
            update: &UserExerciseStateUpdate,
            score_given: Option<f32>,
            activity_progress: ActivityProgress,
            reviewing_stage: ReviewingStage,
        ) {
            if let Some(score_given) = score_given {
                assert!(f32_approx_eq(update.score_given.unwrap(), score_given,));
            } else {
                assert_eq!(update.score_given, None);
            }
            assert_eq!(update.activity_progress, activity_progress);
            assert_eq!(update.reviewing_stage, reviewing_stage);
        }

        fn create_exercise(course_or_exam_id: CourseOrExamId, needs_peer_review: bool) -> Exercise {
            let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let (course_id, exam_id) = course_or_exam_id.to_course_and_exam_ids();
            Exercise {
                id,
                created_at: Utc.ymd(2022, 1, 1).and_hms(0, 0, 0),
                updated_at: Utc.ymd(2022, 1, 1).and_hms(0, 0, 0),
                name: "".to_string(),
                course_id,
                exam_id,
                page_id: id,
                chapter_id: None,
                deadline: None,
                deleted_at: None,
                score_maximum: 9000,
                order_number: 0,
                copied_from: None,
                max_tries_per_slide: None,
                limit_number_of_tries: false,
                needs_peer_review,
            }
        }

        fn create_user_exercise_state(
            exercise: &Exercise,
            score_given: Option<f32>,
            activity_progress: ActivityProgress,
            reviewing_stage: ReviewingStage,
        ) -> UserExerciseState {
            let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            UserExerciseState {
                id,
                user_id: id,
                exercise_id: exercise.id,
                course_instance_id: exercise.course_id,
                exam_id: exercise.exam_id,
                created_at: Utc.ymd(2022, 1, 1).and_hms(0, 0, 0),
                updated_at: Utc.ymd(2022, 1, 1).and_hms(0, 0, 0),
                deleted_at: None,
                score_given,
                grading_progress: GradingProgress::NotReady,
                activity_progress,
                reviewing_stage,
                selected_exercise_slide_id: None,
            }
        }
    }
}
