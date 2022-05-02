use crate::{
    exercise_slide_submissions::ExerciseSlideSubmission,
    peer_review_questions::PeerReviewQuestion,
    peer_review_queue_entries,
    peer_review_submissions::{self, PeerReviewSubmission},
    prelude::*,
    user_exercise_states::{self, ExerciseProgress, UserExerciseState},
};

pub struct CourseMaterialPeerReviewQuestions {
    pub peer_review_id: Uuid,
    pub peer_review_questions: Vec<PeerReviewQuestion>,
}

/// Starts peer review state for the student for this exercise.
pub async fn start_peer_review_for_user(
    conn: &mut PgConnection,
    user_exercise_state: UserExerciseState,
    exercise_slide_submission: &ExerciseSlideSubmission,
) -> ModelResult<()> {
    if user_exercise_state.exercise_progress != ExerciseProgress::Incomplete {
        return Err(ModelError::PreconditionFailed(
            "Cannot start peer review anymore.".to_string(),
        ));
    }

    let mut tx = conn.begin().await?;

    let _user_exercise_state = user_exercise_states::update_exercise_progress(
        &mut tx,
        user_exercise_state.id,
        ExerciseProgress::PeerReview,
    )
    .await?;
    let _peer_review_queue_entry = peer_review_queue_entries::insert_by_exercise_slide_submission(
        &mut tx,
        exercise_slide_submission,
    )
    .await?;

    tx.commit().await?;
    Ok(())
}

/// Tries to select a submission for user to peer review, if there is any available.
pub async fn try_to_select_submission_for_peer_review(
    conn: &mut PgConnection,
    user_exercise_state: &UserExerciseState,
) -> ModelResult<Option<PeerReviewSubmission>> {
    let peer_review_queue_entry =
        peer_review_queue_entries::try_to_get_random_other_users_peer_review_entry(
            conn,
            user_exercise_state.user_id,
            user_exercise_state.exercise_id,
        )
        .await?;
    if let Some(peer_review_queue_entry) = peer_review_queue_entry {
        let peer_review_submission = peer_review_submissions::insert(
            conn,
            peer_review_queue_entry.user_id,
            peer_review_queue_entry.exercise_id,
            peer_review_queue_entry.receiving_peer_reviews_exercise_slide_submission_id,
        )
        .await?;
        Ok(Some(peer_review_submission))
    } else {
        Ok(None)
    }
}
