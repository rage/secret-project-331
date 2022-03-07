use std::collections::HashMap;

use serde_json::Value;

use crate::{
    exercise_slide_submissions::{self, NewExerciseSlideSubmission},
    exercise_task_gradings::{self, ExerciseTaskGrading, UserPointsUpdateStrategy},
    exercise_task_submissions::{self, ExerciseTaskSubmission},
    exercise_tasks::{self, ExerciseTask},
    exercises::{Exercise, ExerciseStatus},
    prelude::*,
    user_exercise_states::{self, UserExerciseState},
};

/// Contains data sent by the student when they make a submission for an exercise slide.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct StudentExerciseSlideSubmission {
    pub exercise_slide_id: Uuid,
    pub exercise_task_submissions: Vec<StudentExerciseTaskSubmission>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, TS)]
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
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct StudentExerciseTaskSubmission {
    pub exercise_task_id: Uuid,
    pub data_json: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, TS)]
pub struct StudentExerciseTaskSubmissionResult {
    pub submission: ExerciseTaskSubmission,
    pub grading: Option<ExerciseTaskGrading>,
    pub model_solution_spec: Option<serde_json::Value>,
}

pub async fn grade_user_submission(
    conn: &mut PgConnection,
    exercise: &Exercise,
    user_exercise_state: &UserExerciseState,
    user_exercise_slide_submission: StudentExerciseSlideSubmission,
) -> ModelResult<StudentExerciseSlideSubmissionResult> {
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
    let user_exercise_task_submissions = user_exercise_slide_submission.exercise_task_submissions;

    let mut tx = conn.begin().await?;
    let mut results = Vec::with_capacity(user_exercise_task_submissions.len());

    // Exercise is only needed for course id here.
    let user_points_update_strategy = if exercise.exam_id.is_some() {
        UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints
    } else {
        UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints
    };
    let new_exercise_slide_submission = NewExerciseSlideSubmission {
        exercise_slide_id: selected_exercise_slide_id,
        course_id: exercise.course_id,
        course_instance_id: user_exercise_state.course_instance_id,
        exam_id: user_exercise_state.exam_id,
        exercise_id: user_exercise_state.exercise_id,
        user_id: user_exercise_state.user_id,
        user_points_update_strategy,
    };
    let exercise_slide_submission = exercise_slide_submissions::insert_exercise_slide_submission(
        &mut tx,
        new_exercise_slide_submission,
    )
    .await?;
    for task_submission in user_exercise_task_submissions {
        let exercise_task = exercise_tasks
            .get(&task_submission.exercise_task_id)
            .ok_or_else(|| {
                ModelError::PreconditionFailed(
                    "Attempting to submit exercise for illegal exercise_task_id.".to_string(),
                )
            })?;
        let submission = grade_user_submission_task(
            &mut tx,
            exercise,
            exercise_task,
            exercise_slide_submission.id,
            task_submission.data_json,
        )
        .await?;
        if let Some(_grading) = submission.grading.as_ref() {
            // user_exercise_task_states::upsert_score_with_grading(
            //     &mut tx,
            //     user_exercise_state.id,
            //     grading,
            // )
            // .await?;
        }
        results.push(submission)
    }

    let user_exercise_state = user_exercise_states::update_user_exercise_state_after_submission(
        &mut tx,
        &exercise_slide_submission,
    )
    .await?;
    tx.commit().await?;

    let exercise_status = Some(ExerciseStatus {
        score_given: user_exercise_state.score_given,
        activity_progress: user_exercise_state.activity_progress,
        grading_progress: user_exercise_state.grading_progress,
    });
    Ok(StudentExerciseSlideSubmissionResult {
        exercise_status,
        exercise_task_submission_results: results,
    })
}

async fn grade_user_submission_task(
    conn: &mut PgConnection,
    exercise: &Exercise,
    exercise_task: &ExerciseTask,
    exercise_slide_submission_id: Uuid,
    data_json: Value,
) -> ModelResult<StudentExerciseTaskSubmissionResult> {
    let submission_id = exercise_task_submissions::insert(
        conn,
        exercise_slide_submission_id,
        exercise_task.exercise_slide_id,
        exercise_task.id,
        data_json,
    )
    .await?;
    let submission = exercise_task_submissions::get_by_id(conn, submission_id).await?;
    let grading = exercise_task_gradings::new_grading(conn, exercise, &submission).await?;
    let updated_submission =
        exercise_task_submissions::set_grading_id(conn, grading.id, submission_id).await?;
    let grading = exercise_task_gradings::grade_submission(
        conn,
        &submission,
        exercise_task,
        exercise,
        &grading,
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
