//! Always update the user_exercise_state table though this module
//!

// Internal modules, not public to make sure someone does not accidentally import them and mess things up.
mod data_loader;
mod state_deriver;
mod validation;

use crate::{
    course_modules,
    exercise_slide_submissions::ExerciseSlideSubmission,
    exercises::Exercise,
    peer_or_self_review_configs::PeerOrSelfReviewConfig,
    peer_or_self_review_question_submissions::PeerOrSelfReviewQuestionSubmission,
    peer_or_self_review_questions::PeerOrSelfReviewQuestion,
    peer_or_self_review_submissions::PeerOrSelfReviewSubmission,
    peer_review_queue_entries::PeerReviewQueueEntry,
    prelude::*,
    teacher_grading_decisions::TeacherGradingDecision,
    user_exercise_slide_states::UserExerciseSlideStateGradingSummary,
    user_exercise_states::{self, UserExerciseState, UserExerciseStateUpdate},
};

use std::default::Default;

/// Visible only in the current module (and submodules) to prevent misuse.
#[derive(Debug)]
pub struct UserExerciseStateUpdateRequiredData {
    pub exercise: Exercise,
    pub current_user_exercise_state: UserExerciseState,
    /// None if peer review is not enabled for the exercise
    pub peer_or_self_review_information:
        Option<UserExerciseStateUpdateRequiredDataPeerReviewInformation>,
    /// None if a teacher has not made a grading decision yet.
    pub latest_teacher_grading_decision: Option<TeacherGradingDecision>,
    /// The grades summed up from all the user exercise slide states. Note that multiple slides can give points, and they are all aggregated here.
    pub user_exercise_slide_state_grading_summary: UserExerciseSlideStateGradingSummary,
}

/// Visible only in the current module (and submodules) to prevent misuse.
#[derive(Debug)]
pub struct UserExerciseStateUpdateRequiredDataPeerReviewInformation {
    pub given_peer_or_self_review_submissions: Vec<PeerOrSelfReviewSubmission>,
    pub given_self_review_submission: Option<PeerOrSelfReviewSubmission>,
    pub latest_exercise_slide_submission_received_peer_or_self_review_question_submissions:
        Vec<PeerOrSelfReviewQuestionSubmission>,
    pub peer_review_queue_entry: Option<PeerReviewQueueEntry>,
    pub peer_or_self_review_config: PeerOrSelfReviewConfig,
    pub peer_or_self_review_questions: Vec<PeerOrSelfReviewQuestion>,
}

/**
Same as `UserExerciseStateUpdateRequiredData` but public and everything is optional. Can be used to pass some already loaded dependencies to the update function.
*/
#[derive(Default)]
pub struct UserExerciseStateUpdateAlreadyLoadedRequiredData {
    pub exercise: Option<Exercise>,
    pub current_user_exercise_state: Option<UserExerciseState>,
    pub peer_or_self_review_information:
        Option<UserExerciseStateUpdateAlreadyLoadedRequiredDataPeerReviewInformation>,
    /// The outer option is to indicate whether this cached value is provided or not, and the inner option is to tell whether a teacher has made a grading decision or not.
    pub latest_teacher_grading_decision: Option<Option<TeacherGradingDecision>>,
    pub user_exercise_slide_state_grading_summary: Option<UserExerciseSlideStateGradingSummary>,
}

/**
Same as `UserExerciseStateUpdateRequiredDataPeerReviewInformation` but public and everything is optional. Can be used to pass some already loaded dependencies to the update function.
*/
#[derive(Default)]
pub struct UserExerciseStateUpdateAlreadyLoadedRequiredDataPeerReviewInformation {
    pub given_peer_or_self_review_submissions: Option<Vec<PeerOrSelfReviewSubmission>>,
    pub given_self_review_submission: Option<Option<PeerOrSelfReviewSubmission>>,
    pub latest_exercise_slide_submission: Option<ExerciseSlideSubmission>,
    pub latest_exercise_slide_submission_received_peer_or_self_review_question_submissions:
        Option<Vec<PeerOrSelfReviewQuestionSubmission>>,
    /// The outer option is to indicate whether this cached value is provided or not, and the inner option is to tell whether the answer has been added to the the peer review queue or not
    pub peer_review_queue_entry: Option<Option<PeerReviewQueueEntry>>,
    pub peer_or_self_review_config: Option<PeerOrSelfReviewConfig>,
    pub peer_or_self_review_questions: Option<Vec<PeerOrSelfReviewQuestion>>,
}

/// Loads all required data and updates user_exercise_state. Also creates completions if needed.
pub async fn update_user_exercise_state(
    conn: &mut PgConnection,
    user_exercise_state_id: Uuid,
) -> ModelResult<UserExerciseState> {
    update_user_exercise_state_with_some_already_loaded_data(
        conn,
        user_exercise_state_id,
        // Fills all the fields with None so that all the data will be loaded from the database.
        Default::default(),
    )
    .await
}

/**
Allows you to pass some data that `update_user_exercise_state` fetches to avoid repeating SQL queries for performance. Note that the caller must be careful that it passes correct data to the function. A good rule of thumb is that this function expects unmodified data directly from the database.

Usage:

```no_run
# use headless_lms_models::library::user_exercise_state_updater::{update_user_exercise_state_with_some_already_loaded_data, UserExerciseStateUpdateAlreadyLoadedRequiredData};
# use headless_lms_models::ModelResult;
#
# async fn example_function() -> ModelResult<()> {
# let conn = panic!("Placeholder");
# let user_exercise_state_id = panic!("Placeholder");
# let previously_loaded_exercise = panic!("Placeholder");
update_user_exercise_state_with_some_already_loaded_data(
    conn,
    user_exercise_state_id,
    UserExerciseStateUpdateAlreadyLoadedRequiredData {
        exercise: previously_loaded_exercise,
        // Allows us to omit the data we have not manually loaded by setting `None` to all the other fields.
        ..Default::default()
    },
)
.await?;
# Ok(())
# }
```
*/
#[instrument(skip(conn, already_loaded_internal_dependencies))]
pub async fn update_user_exercise_state_with_some_already_loaded_data(
    conn: &mut PgConnection,
    user_exercise_state_id: Uuid,
    already_loaded_internal_dependencies: UserExerciseStateUpdateAlreadyLoadedRequiredData,
) -> ModelResult<UserExerciseState> {
    let required_data = data_loader::load_required_data(
        conn,
        user_exercise_state_id,
        already_loaded_internal_dependencies,
    )
    .await?;
    let exercise_id = required_data.exercise.id;

    let prev_user_exercise_state = required_data.current_user_exercise_state.clone();

    let derived_user_exercise_state = state_deriver::derive_new_user_exercise_state(required_data)?;

    // Try to avoid updating if nothing changed
    if derived_user_exercise_state
        == (UserExerciseStateUpdate {
            id: prev_user_exercise_state.id,
            score_given: prev_user_exercise_state.score_given,
            activity_progress: prev_user_exercise_state.activity_progress,
            reviewing_stage: prev_user_exercise_state.reviewing_stage,
            grading_progress: prev_user_exercise_state.grading_progress,
        })
    {
        info!("Update resulting in no changes, not updating the database.");
        return Ok(prev_user_exercise_state);
    }

    let new_saved_user_exercise_state =
        user_exercise_states::update(conn, derived_user_exercise_state).await?;

    // Always when the user_exercise_state updates, we need to also check if the user has completed the course.
    let course_module = course_modules::get_by_exercise_id(conn, exercise_id).await?;
    super::progressing::update_automatic_completion_status_and_grant_if_eligible(
        conn,
        &course_module,
        new_saved_user_exercise_state.user_id,
    )
    .await?;

    Ok(new_saved_user_exercise_state)
}
