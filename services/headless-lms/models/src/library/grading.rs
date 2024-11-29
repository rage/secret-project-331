//! Collection of functions used for processing and evaluating user submissions for exercises.

use futures::future::BoxFuture;
use std::collections::HashMap;
use url::Url;

use crate::{
    exercise_service_info::ExerciseServiceInfoApi,
    exercise_slide_submissions::{self, ExerciseSlideSubmission, NewExerciseSlideSubmission},
    exercise_task_gradings::{
        self, ExerciseTaskGrading, ExerciseTaskGradingResult, UserPointsUpdateStrategy,
    },
    exercise_task_regrading_submissions::ExerciseTaskRegradingSubmission,
    exercise_task_submissions::{self, ExerciseTaskSubmission},
    exercise_tasks::{self, CourseMaterialExerciseTask, ExerciseTask},
    exercises::{self, Exercise, ExerciseStatus, GradingProgress},
    peer_or_self_review_configs::PeerReviewProcessingStrategy,
    peer_or_self_review_question_submissions::{
        self, PeerOrSelfReviewQuestionSubmission, PeerReviewWithQuestionsAndAnswers,
    },
    prelude::*,
    regradings,
    user_course_exercise_service_variables::UserCourseExerciseServiceVariable,
    user_exercise_slide_states::{self, UserExerciseSlideState},
    user_exercise_states::{self, CourseOrExamId, ExerciseWithUserState, UserExerciseState},
    user_exercise_task_states,
};

use super::user_exercise_state_updater;

/// Contains data sent by the student when they make a submission for an exercise slide.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
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
    pub user_course_instance_exercise_service_variables: Vec<UserCourseExerciseServiceVariable>,
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
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
    pub exercise_task_exercise_service_slug: String,
}

#[derive(Debug)]
pub struct ExerciseSlideSubmissionWithTasks {
    pub exercise_slide_submission: ExerciseSlideSubmission,
    pub exercise_slide_submission_tasks: Vec<ExerciseTaskSubmission>,
}

/// If passed to to an exercise state update, it will update the peer review status with the given information
#[derive(Debug)]
pub struct ExerciseStateUpdateNeedToUpdatePeerReviewStatusWithThis {
    pub given_enough_peer_reviews: bool,
    pub received_enough_peer_reviews: bool,
    pub peer_review_processing_strategy: PeerReviewProcessingStrategy,
    pub peer_review_accepting_threshold: f32,
    /// Used to for calculating averages when acting on PeerReviewProcessingStrategy
    pub received_peer_or_self_review_question_submissions: Vec<PeerOrSelfReviewQuestionSubmission>,
}

/// Inserts user submission to database. Tasks within submission are validated to make sure that
/// they belong to the correct exercise slide.
pub async fn create_user_exercise_slide_submission(
    conn: &mut PgConnection,
    exercise_with_user_state: &ExerciseWithUserState,
    user_exercise_slide_submission: &StudentExerciseSlideSubmission,
) -> ModelResult<ExerciseSlideSubmissionWithTasks> {
    let selected_exercise_slide_id = exercise_with_user_state
        .user_exercise_state()
        .selected_exercise_slide_id
        .ok_or_else(|| {
            ModelError::new(
                ModelErrorType::PreconditionFailed,
                "Exercise slide not selected for the student.".to_string(),
                None,
            )
        })?;
    let exercise_tasks: HashMap<Uuid, ExerciseTask> =
        exercise_tasks::get_exercise_tasks_by_exercise_slide_id(conn, &selected_exercise_slide_id)
            .await?;
    let user_points_update_strategy = if exercise_with_user_state.is_exam_exercise() {
        UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints
    } else {
        UserPointsUpdateStrategy::CanAddPointsButCannotRemovePoints
    };

    let mut tx = conn.begin().await?;

    let exercise_slide_submission = exercise_slide_submissions::insert_exercise_slide_submission(
        &mut tx,
        NewExerciseSlideSubmission {
            exercise_slide_id: selected_exercise_slide_id,
            course_id: exercise_with_user_state.exercise().course_id,
            exam_id: exercise_with_user_state.exercise().exam_id,
            exercise_id: exercise_with_user_state.exercise().id,
            user_id: exercise_with_user_state.user_exercise_state().user_id,
            user_points_update_strategy,
        },
    )
    .await?;
    let user_exercise_task_submissions = &user_exercise_slide_submission.exercise_task_submissions;
    let mut exercise_slide_submission_tasks =
        Vec::with_capacity(user_exercise_task_submissions.len());
    for task_submission in user_exercise_task_submissions {
        let exercise_task = exercise_tasks
            .get(&task_submission.exercise_task_id)
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::PreconditionFailed,
                    "Attempting to submit exercise for illegal exercise_task_id.".to_string(),
                    None,
                )
            })?;
        let submission_id = exercise_task_submissions::insert(
            &mut tx,
            PKeyPolicy::Generate,
            exercise_slide_submission.id,
            exercise_task.exercise_slide_id,
            exercise_task.id,
            &task_submission.data_json,
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
        slide_submission.course_id,
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

pub enum GradingPolicy {
    /// Grades exercise tasks by sending a request to their respective services.
    Default,
    /// Intended for test purposes only.
    Fixed(HashMap<Uuid, ExerciseTaskGradingResult>),
}

pub async fn grade_user_submission(
    conn: &mut PgConnection,
    exercise_with_user_state: &mut ExerciseWithUserState,
    user_exercise_slide_submission: &StudentExerciseSlideSubmission,
    grading_policy: GradingPolicy,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
    send_grading_request: impl Fn(
        Url,
        &ExerciseTask,
        &ExerciseTaskSubmission,
    ) -> BoxFuture<'static, ModelResult<ExerciseTaskGradingResult>>,
) -> ModelResult<StudentExerciseSlideSubmissionResult> {
    let mut tx = conn.begin().await?;

    let ExerciseSlideSubmissionWithTasks {
        exercise_slide_submission,
        exercise_slide_submission_tasks,
    } = create_user_exercise_slide_submission(
        &mut tx,
        exercise_with_user_state,
        user_exercise_slide_submission,
    )
    .await?;
    let user_exercise_state = exercise_with_user_state.user_exercise_state();
    let user_exercise_slide_state = user_exercise_slide_states::get_or_insert_by_unique_index(
        &mut tx,
        user_exercise_state.id,
        exercise_slide_submission.exercise_slide_id,
    )
    .await?;
    let results = match grading_policy {
        GradingPolicy::Default => {
            let mut results = Vec::with_capacity(exercise_slide_submission_tasks.len());
            for task_submission in exercise_slide_submission_tasks {
                let submission = grade_user_submission_task(
                    &mut tx,
                    &task_submission,
                    exercise_with_user_state.exercise(),
                    user_exercise_slide_state.id,
                    user_exercise_state,
                    &fetch_service_info,
                    &send_grading_request,
                )
                .await?;
                results.push(submission);
            }
            results
        }
        GradingPolicy::Fixed(fixed_results) => {
            let mut results = Vec::with_capacity(exercise_slide_submission_tasks.len());
            for task_submission in exercise_slide_submission_tasks {
                let fixed_result = fixed_results
                    .get(&task_submission.exercise_task_id)
                    .ok_or_else(|| {
                        ModelError::new(
                            ModelErrorType::Generic,
                            "Could not find fixed test result for testing".to_string(),
                            None,
                        )
                    })?
                    .clone();
                let submission = create_fixed_grading_for_submission_task(
                    &mut tx,
                    &task_submission,
                    exercise_with_user_state.exercise(),
                    user_exercise_slide_state.id,
                    &fixed_result,
                )
                .await?;
                results.push(submission);
            }
            results
        }
    };
    let user_exercise_state = update_user_exercise_slide_state_and_user_exercise_state(
        &mut tx,
        user_exercise_slide_state,
        exercise_slide_submission.user_points_update_strategy,
    )
    .await?;

    let course_or_exam_id = CourseOrExamId::from_course_and_exam_ids(
        user_exercise_state.course_id,
        user_exercise_state.exam_id,
    )?;

    let user_course_instance_exercise_service_variables  = crate::user_course_exercise_service_variables::get_all_variables_for_user_and_course_instance_or_exam(&mut tx, user_exercise_state.user_id, course_or_exam_id).await?;

    let result = StudentExerciseSlideSubmissionResult {
        exercise_status: Some(ExerciseStatus {
            score_given: user_exercise_state.score_given,
            activity_progress: user_exercise_state.activity_progress,
            grading_progress: user_exercise_state.grading_progress,
            reviewing_stage: user_exercise_state.reviewing_stage,
        }),
        exercise_task_submission_results: results,
        user_course_instance_exercise_service_variables,
    };
    exercise_with_user_state.set_user_exercise_state(user_exercise_state)?;
    tx.commit().await?;
    Ok(result)
}

async fn grade_user_submission_task(
    conn: &mut PgConnection,
    submission: &ExerciseTaskSubmission,
    exercise: &Exercise,
    user_exercise_slide_state_id: Uuid,
    user_exercise_state: &UserExerciseState,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
    send_grading_request: impl Fn(
        Url,
        &ExerciseTask,
        &ExerciseTaskSubmission,
    ) -> BoxFuture<'static, ModelResult<ExerciseTaskGradingResult>>,
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
        user_exercise_state,
        fetch_service_info,
        send_grading_request,
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
        exercise_task_exercise_service_slug: exercise_task.exercise_type,
    })
}

async fn create_fixed_grading_for_submission_task(
    conn: &mut PgConnection,
    submission: &ExerciseTaskSubmission,
    exercise: &Exercise,
    user_exercise_slide_state_id: Uuid,
    fixed_result: &ExerciseTaskGradingResult,
) -> ModelResult<StudentExerciseTaskSubmissionResult> {
    let grading = exercise_task_gradings::new_grading(conn, exercise, submission).await?;
    let updated_submission =
        exercise_task_submissions::set_grading_id(conn, grading.id, submission.id).await?;
    let updated_grading =
        exercise_task_gradings::update_grading(conn, &grading, fixed_result, exercise).await?;
    user_exercise_task_states::upsert_with_grading(
        conn,
        user_exercise_slide_state_id,
        &updated_grading,
    )
    .await?;
    let exercise_task =
        exercise_tasks::get_exercise_task_by_id(conn, submission.exercise_task_id).await?;
    let model_solution_spec = exercise_task.model_solution_spec;

    Ok(StudentExerciseTaskSubmissionResult {
        submission: updated_submission,
        grading: Some(grading),
        model_solution_spec,
        exercise_task_exercise_service_slug: exercise_task.exercise_type,
    })
}

/// Updates the user exercise state starting from a slide state, and propagates the update up to the
/// whole user exercise state.
async fn update_user_exercise_slide_state_and_user_exercise_state(
    conn: &mut PgConnection,
    user_exercise_slide_state: UserExerciseSlideState,
    user_points_update_strategy: UserPointsUpdateStrategy,
) -> ModelResult<UserExerciseState> {
    update_user_exercise_slide_state(
        conn,
        &user_exercise_slide_state,
        user_points_update_strategy,
    )
    .await?;
    let user_exercise_state = user_exercise_state_updater::update_user_exercise_state(
        conn,
        user_exercise_slide_state.user_exercise_state_id,
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
pub async fn propagate_user_exercise_state_update_from_exercise_task_grading_result(
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
    let user_exercise_state = update_user_exercise_slide_state_and_user_exercise_state(
        conn,
        user_exercise_slide_state,
        user_points_update_strategy,
    )
    .await?;
    Ok(user_exercise_state)
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct AnswersRequiringAttention {
    pub exercise_max_points: i32,
    pub data: Vec<AnswerRequiringAttentionWithTasks>,
    pub total_pages: u32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct AnswerRequiringAttentionWithTasks {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub data_json: Option<serde_json::Value>,
    pub grading_progress: GradingProgress,
    pub score_given: Option<f32>,
    pub submission_id: Uuid,
    pub exercise_id: Uuid,
    pub tasks: Vec<CourseMaterialExerciseTask>,
    pub given_peer_reviews: Vec<PeerReviewWithQuestionsAndAnswers>,
    pub received_peer_or_self_reviews: Vec<PeerReviewWithQuestionsAndAnswers>,
}

/// Gets submissions that require input from the teacher to continue processing.
pub async fn get_paginated_answers_requiring_attention_for_exercise(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    pagination: Pagination,
    viewer_user_id: Uuid,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<AnswersRequiringAttention> {
    let exercise = exercises::get_exercise_by_id(conn, exercise_id).await?;
    let answer_requiring_attention_count =
        exercise_slide_submissions::answer_requiring_attention_count(conn, exercise_id).await?;
    let data = exercise_slide_submissions::get_all_answers_requiring_attention(
        conn,
        exercise.id,
        pagination,
    )
    .await?;
    let mut answers = Vec::with_capacity(data.len());
    for answer in &data {
        let tasks = exercise_task_submissions::get_exercise_task_submission_info_by_exercise_slide_submission_id(
            conn,
            answer.submission_id,
            viewer_user_id,
            &fetch_service_info,
        )
        .await?;
        let given_peer_reviews = peer_or_self_review_question_submissions::get_given_peer_reviews(
            conn,
            answer.user_id,
            answer.exercise_id,
        )
        .await?;

        let received_peer_or_self_reviews =
            peer_or_self_review_question_submissions::get_questions_and_answers_by_submission_id(
                conn,
                answer.submission_id,
            )
            .await?;
        let new_answer = AnswerRequiringAttentionWithTasks {
            id: answer.id,
            user_id: answer.user_id,
            created_at: answer.created_at,
            updated_at: answer.updated_at,
            deleted_at: answer.deleted_at,
            data_json: answer.data_json.to_owned(),
            grading_progress: answer.grading_progress,
            score_given: answer.score_given,
            submission_id: answer.submission_id,
            exercise_id: answer.exercise_id,
            tasks,
            given_peer_reviews,
            received_peer_or_self_reviews,
        };
        answers.push(new_answer);
    }
    Ok(AnswersRequiringAttention {
        exercise_max_points: exercise.score_maximum,
        data: answers,
        total_pages: pagination.total_pages(answer_requiring_attention_count),
    })
}
