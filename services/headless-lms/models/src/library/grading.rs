use std::collections::HashMap;

use crate::{
    exercise_slide_submissions::{self, ExerciseSlideSubmission, NewExerciseSlideSubmission},
    exercise_task_gradings::{
        self, ExerciseTaskGrading, ExerciseTaskGradingResult, UserPointsUpdateStrategy,
    },
    exercise_task_submissions::{self, ExerciseTaskSubmission},
    exercise_tasks::{self, ExerciseTask},
    exercises::{ActivityProgress, Exercise, ExerciseStatus},
    prelude::*,
    user_exercise_slide_states::{self, UserExerciseSlideState},
    user_exercise_states::{self, UserExerciseState},
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

#[inline]
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

#[inline]
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
    let user_exercise_state = update_points_for_user_exercise_state(
        &mut tx,
        user_exercise_state,
        exercise_slide_submission.user_points_update_strategy,
    )
    .await?;

    tx.commit().await?;
    Ok(StudentExerciseSlideSubmissionResult {
        exercise_status: Some(ExerciseStatus {
            score_given: user_exercise_state.score_given,
            activity_progress: user_exercise_state.activity_progress,
            grading_progress: user_exercise_state.grading_progress,
        }),
        exercise_task_submission_results: results,
    })
}

/// Updates points for given user exercise state and all its related slide states. Returns updated
/// user exercise state.
pub async fn update_points_for_user_exercise_state(
    conn: &mut PgConnection,
    user_exercise_state: UserExerciseState,
    user_points_update_strategy: UserPointsUpdateStrategy,
) -> ModelResult<UserExerciseState> {
    let mut tx = conn.begin().await?;

    let user_exercise_slide_states = user_exercise_slide_states::get_all_by_user_exercise_state_id(
        &mut tx,
        user_exercise_state.id,
    )
    .await?;
    for user_exercise_slide_state in user_exercise_slide_states {
        update_user_exercise_slide_state(
            &mut tx,
            &user_exercise_slide_state,
            user_points_update_strategy,
        )
        .await?;
    }
    let new_user_exercise_state =
        update_user_exercise_state(&mut tx, &user_exercise_state, user_points_update_strategy)
            .await?;

    tx.commit().await?;
    Ok(new_user_exercise_state)
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

async fn update_user_exercise_state(
    conn: &mut PgConnection,
    user_exercise_state: &UserExerciseState,
    user_points_update_strategy: UserPointsUpdateStrategy,
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
    let new_user_exercise_state = user_exercise_states::update_grading_state(
        conn,
        user_exercise_state.id,
        new_score_given,
        grading_progress,
        ActivityProgress::Completed,
    )
    .await?;
    Ok(new_user_exercise_state)
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
