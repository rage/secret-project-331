use crate::{
    exercise_slide_submissions::ExerciseSlideSubmission,
    exercises::Exercise,
    peer_review_configs::{self, PeerReviewConfig},
    peer_review_question_submissions::PeerReviewQuestionSubmission,
    peer_review_queue_entries::PeerReviewQueueEntry,
    peer_review_submissions::{self, PeerReviewSubmission},
    prelude::*,
    teacher_grading_decisions::{self, TeacherGradingDecision},
    user_exercise_slide_states::{self, UserExerciseSlideStateGradingSummary},
    user_exercise_states::UserExerciseState,
};

use super::{
    UserExerciseStateUpdateAlreadyLoadedRequiredData,
    UserExerciseStateUpdateAlreadyLoadedRequiredDataPeerReviewInformation,
    UserExerciseStateUpdateRequiredData, UserExerciseStateUpdateRequiredDataPeerReviewInformation,
};

/// Returns an object with all dependencies for the user_exercise_state update loaded. Either uses a preloaded value from already_loaded_internal_dependencies or fetches the necessary information from the database.
pub(super) async fn load_required_data(
    conn: &mut PgConnection,
    user_exercise_state_id: Uuid,
    already_loaded_internal_dependencies: UserExerciseStateUpdateAlreadyLoadedRequiredData,
) -> ModelResult<UserExerciseStateUpdateRequiredData> {
    info!("Loading required data for user_exercise_state update");
    let UserExerciseStateUpdateAlreadyLoadedRequiredData {
        exercise,
        current_user_exercise_state,
        peer_review_information,
        latest_teacher_grading_decision,
        user_exercise_slide_state_grading_summary,
    } = already_loaded_internal_dependencies;

    let loaded_user_exercise_state =
        load_current_user_exercise_state(conn, current_user_exercise_state, user_exercise_state_id)
            .await?;
    let loaded_exercise = load_exercise(conn, exercise, &loaded_user_exercise_state).await?;

    Ok(UserExerciseStateUpdateRequiredData {
        peer_review_information: load_peer_review_information(
            conn,
            peer_review_information,
            &loaded_user_exercise_state,
            &loaded_exercise,
        )
        .await?,
        exercise: loaded_exercise,
        latest_teacher_grading_decision: load_latest_teacher_grading_decision(
            conn,
            latest_teacher_grading_decision,
            &loaded_user_exercise_state,
        )
        .await?,
        user_exercise_slide_state_grading_summary: load_user_exercise_slide_state_grading_summary(
            conn,
            user_exercise_slide_state_grading_summary,
            &loaded_user_exercise_state,
        )
        .await?,
        current_user_exercise_state: loaded_user_exercise_state,
    })
}

async fn load_user_exercise_slide_state_grading_summary(
    conn: &mut PgConnection,
    user_exercise_slide_state_grading_summary: Option<UserExerciseSlideStateGradingSummary>,
    loaded_user_exercise_state: &UserExerciseState,
) -> ModelResult<UserExerciseSlideStateGradingSummary> {
    if let Some(user_exercise_slide_state_grading_summary) =
        user_exercise_slide_state_grading_summary
    {
        info!("Using already loaded user exercise slide state grading summary");
        Ok(user_exercise_slide_state_grading_summary)
    } else {
        info!("Loading user exercise slide state grading summary");
        user_exercise_slide_states::get_grading_summary_by_user_exercise_state_id(
            conn,
            loaded_user_exercise_state.id,
        )
        .await
    }
}

async fn load_latest_teacher_grading_decision(
    conn: &mut PgConnection,
    latest_teacher_grading_decision: Option<Option<TeacherGradingDecision>>,
    loaded_user_exercise_state: &UserExerciseState,
) -> ModelResult<Option<TeacherGradingDecision>> {
    if let Some(latest_teacher_grading_decision) = latest_teacher_grading_decision {
        info!("Using already loaded latest teacher grading decision");
        Ok(latest_teacher_grading_decision)
    } else {
        info!("Loading latest teacher grading decision");
        Ok(teacher_grading_decisions::try_to_get_latest_grading_decision_by_user_exercise_state_id(conn, loaded_user_exercise_state.id).await?)
    }
}

async fn load_current_user_exercise_state(
    conn: &mut PgConnection,
    already_loaded_user_exercise_state: Option<UserExerciseState>,
    user_exercise_state_id: Uuid,
) -> ModelResult<UserExerciseState> {
    if let Some(user_exercise_state) = already_loaded_user_exercise_state {
        info!("Using already loaded user exercise state");
        Ok(user_exercise_state)
    } else {
        info!("Loading user exercise state");
        Ok(crate::user_exercise_states::get_by_id(conn, user_exercise_state_id).await?)
    }
}

async fn load_exercise(
    conn: &mut PgConnection,
    already_loaded_exercise: Option<Exercise>,
    current_user_exercise_state: &UserExerciseState,
) -> ModelResult<Exercise> {
    if let Some(exercise) = already_loaded_exercise {
        info!("Using already loaded exercise");
        Ok(exercise)
    } else {
        info!("Loading exercise");
        Ok(crate::exercises::get_by_id(conn, current_user_exercise_state.exercise_id).await?)
    }
}

async fn load_peer_review_information(
    conn: &mut PgConnection,
    already_loaded_peer_review_information: Option<
        UserExerciseStateUpdateAlreadyLoadedRequiredDataPeerReviewInformation,
    >,
    loaded_user_exercise_state: &UserExerciseState,
    loaded_exercise: &Exercise,
) -> ModelResult<Option<UserExerciseStateUpdateRequiredDataPeerReviewInformation>> {
    info!("Loading peer review information");
    if loaded_exercise.needs_peer_review {
        info!("Exercise needs peer review");
        // Destruct the contents of already_loaded_peer_review_information so that we can use the fields of the parent struct independently
        let UserExerciseStateUpdateAlreadyLoadedRequiredDataPeerReviewInformation {
            given_peer_review_submissions,
            latest_exercise_slide_submission,
            latest_exercise_slide_submission_received_peer_review_question_submissions,
            peer_review_queue_entry,
            peer_review_config,
        } = if let Some(already_loaded_peer_review_information) =
            already_loaded_peer_review_information
        {
            already_loaded_peer_review_information
        } else {
            Default::default()
        };

        let loaded_latest_exercise_slide_submission = load_latest_exercise_slide_submission(
            conn,
            latest_exercise_slide_submission,
            loaded_user_exercise_state,
        )
        .await?;

        Ok(Some(
            UserExerciseStateUpdateRequiredDataPeerReviewInformation {
                given_peer_review_submissions: load_given_peer_review_submissions(
                    conn,
                    given_peer_review_submissions,
                    loaded_user_exercise_state,
                )
                .await?,
                latest_exercise_slide_submission_received_peer_review_question_submissions:
                    load_latest_exercise_slide_submission_received_peer_review_question_submissions(
                        conn,
                        latest_exercise_slide_submission_received_peer_review_question_submissions,
                        loaded_latest_exercise_slide_submission.id,
                    )
                    .await?,
                peer_review_queue_entry: load_peer_review_queue_entry(
                    conn,
                    peer_review_queue_entry,
                    loaded_latest_exercise_slide_submission.id,
                    loaded_user_exercise_state,
                )
                .await?,
                peer_review_config: load_peer_review_config(
                    conn,
                    peer_review_config,
                    loaded_exercise,
                )
                .await?,
            },
        ))
    } else {
        info!("Exercise does not need peer review");
        // Peer review disabled for the exercise, no need to load any information related to peer reviews.
        Ok(None)
    }
}

async fn load_peer_review_config(
    conn: &mut PgConnection,
    already_loaded_peer_review_config: Option<crate::peer_review_configs::PeerReviewConfig>,
    loaded_exercise: &Exercise,
) -> ModelResult<PeerReviewConfig> {
    if let Some(prc) = already_loaded_peer_review_config {
        info!("Using already loaded peer review config");
        Ok(prc)
    } else {
        info!("Loading peer review config");
        Ok(peer_review_configs::get_by_exercise_or_course_id(
            conn,
            loaded_exercise,
            loaded_exercise.course_id.ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::InvalidRequest,
                    "Peer reviews work only on courses (and not, for example, on exams)"
                        .to_string(),
                    None,
                )
            })?,
        )
        .await?)
    }
}

async fn load_peer_review_queue_entry(
    conn: &mut PgConnection,
    already_loaded_peer_review_queue_entry: Option<Option<PeerReviewQueueEntry>>,
    latest_exercise_submission_id: Uuid,
    loaded_user_exercise_state: &UserExerciseState,
) -> ModelResult<Option<PeerReviewQueueEntry>> {
    if let Some(prqe) = already_loaded_peer_review_queue_entry {
        info!("Using already loaded peer review queue entry");
        Ok(prqe)
    } else {
        info!("Loading peer review queue entry");
        let course_instance_id =
            loaded_user_exercise_state
                .course_instance_id
                .ok_or_else(|| {
                    ModelError::new(
                        ModelErrorType::InvalidRequest,
                        "Peer reviews work only on courses (and not, for example, on exams)"
                            .to_string(),
                        None,
                    )
                })?;
        // The result is optinal because not all answers are in the peer review queue yet. For example, we don't place any answers to the queue if their giver has not given enough peer reviews.
        Ok(crate::peer_review_queue_entries::try_to_get_by_receiving_submission_and_course_instance_ids(conn, latest_exercise_submission_id, course_instance_id ).await?)
    }
}

async fn load_latest_exercise_slide_submission_received_peer_review_question_submissions(
    conn: &mut PgConnection,
    latest_exercise_slide_submission_received_peer_review_question_submissions: Option<
        Vec<PeerReviewQuestionSubmission>,
    >,
    latest_exercise_slide_submission_id: Uuid,
) -> ModelResult<Vec<PeerReviewQuestionSubmission>> {
    if let Some(latest_exercise_slide_submission_received_peer_review_question_submissions) =
        latest_exercise_slide_submission_received_peer_review_question_submissions
    {
        info!("Using already loaded latest exercise slide submission received peer review question submissions");
        Ok(latest_exercise_slide_submission_received_peer_review_question_submissions)
    } else {
        info!("Loading latest exercise slide submission received peer review question submissions");
        Ok(crate::peer_review_question_submissions::get_received_question_submissions_for_exercise_slide_submission(conn, latest_exercise_slide_submission_id).await?)
    }
}

async fn load_latest_exercise_slide_submission(
    conn: &mut PgConnection,
    already_loaded_latest_exercise_slide_submission: Option<ExerciseSlideSubmission>,
    loaded_user_exercise_state: &UserExerciseState,
) -> ModelResult<ExerciseSlideSubmission> {
    if let Some(latest_exercise_slide_submission) = already_loaded_latest_exercise_slide_submission
    {
        info!("Using already loaded latest exercise slide submission");
        Ok(latest_exercise_slide_submission)
    } else {
        info!("Loading latest exercise slide submission");
        let selected_exercise_slide_id = loaded_user_exercise_state.selected_exercise_slide_id.ok_or_else(|| ModelError::new(ModelErrorType::PreconditionFailed, "No selected exercise slide id found: presumably the user has not answered the exercise.".to_string(), None))?;
        // Received peer reviews are only considered for the latest submission.
        let latest_exercise_slide_submission =
            crate::exercise_slide_submissions::get_users_latest_exercise_slide_submission(
                conn,
                selected_exercise_slide_id,
                loaded_user_exercise_state.user_id,
            )
            .await?;
        Ok(latest_exercise_slide_submission)
    }
}

async fn load_given_peer_review_submissions(
    conn: &mut PgConnection,
    already_loaded_given_peer_review_submissions: Option<Vec<PeerReviewSubmission>>,
    loaded_user_exercise_state: &UserExerciseState,
) -> ModelResult<Vec<PeerReviewSubmission>> {
    if let Some(given_peer_review_submissions) = already_loaded_given_peer_review_submissions {
        info!("Using already loaded given peer review submissions");
        Ok(given_peer_review_submissions)
    } else {
        info!("Loading given peer review submissions");
        let course_instance_id =
            loaded_user_exercise_state
                .course_instance_id
                .ok_or_else(|| {
                    ModelError::new(
                        ModelErrorType::InvalidRequest,
                        "Peer reviews work only on courses (and not, for example, on exams)"
                            .to_string(),
                        None,
                    )
                })?;
        Ok(peer_review_submissions::get_peer_reviews_given_by_user_and_course_instance_and_exercise(conn, loaded_user_exercise_state.user_id, course_instance_id, loaded_user_exercise_state.exercise_id).await?)
    }
}
