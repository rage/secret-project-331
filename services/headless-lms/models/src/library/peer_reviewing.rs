use rand::{seq::SliceRandom, thread_rng};

use crate::{
    exercise_slide_submissions::{self, ExerciseSlideSubmission},
    exercise_task_submissions::{self, ExerciseTaskSubmissionWithSpec},
    peer_review_questions::{self, PeerReviewQuestion},
    peer_review_queue_entries, peer_reviews,
    prelude::*,
    user_exercise_states::{self, ExerciseProgress, UserExerciseState},
};

const MAX_PEER_REVIEW_CANDIDATES: i64 = 10;

/// Starts peer review state for the student for this exercise.
pub async fn start_peer_review_for_user(
    conn: &mut PgConnection,
    user_exercise_state: UserExerciseState,
    exercise_slide_submission: &ExerciseSlideSubmission,
) -> ModelResult<()> {
    if user_exercise_state.exercise_progress != ExerciseProgress::NotAnswered {
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialPeerReviewData {
    pub exercise_slide_submission_id: Uuid,
    pub exercise_task_submissions: Vec<ExerciseTaskSubmissionWithSpec>,
    pub peer_review_id: Uuid,
    pub peer_review_questions: Vec<PeerReviewQuestion>,
}

/// Tries to select a submission for user to peer review.
///
/// The selection process prioritizes peer review queue when selecting a submission for peer review.
/// In the event where the queue is empty - in practice only when a course has just started - a random
/// submission is selected instead. This function will only return `None` if no other user has made
/// submissions for the specified exercise.
pub async fn try_to_select_exercise_slide_submission_for_peer_review(
    conn: &mut PgConnection,
    user_exercise_state: &UserExerciseState,
) -> ModelResult<Option<CourseMaterialPeerReviewData>> {
    // TODO: Get already answered from peer review submissions.
    let excluded_submission_ids = Vec::new();
    let candidate_submission_id = try_to_select_peer_review_candidate_from_queue(
        conn,
        user_exercise_state.exercise_id,
        user_exercise_state.user_id,
        &excluded_submission_ids,
    )
    .await?;
    let exercise_slide_submission_to_review = match candidate_submission_id {
        Some(exercise_slide_submission_id) => {
            Some(exercise_slide_submissions::get_by_id(conn, exercise_slide_submission_id).await?)
        }
        None => {
            // At the start of a course there can be a short period when there aren't any peer reviews.
            // In that case just get a random one.
            exercise_slide_submissions::try_to_get_random_from_other_users_by_exercise_and_course_instance_ids(
                conn,
                user_exercise_state.exercise_id,
                user_exercise_state.get_course_instance_id()?,
                user_exercise_state.user_id
            )
            .await?
        }
    };
    let data = match exercise_slide_submission_to_review {
        Some(exercise_slide_submission) => {
            let data =
                get_course_material_peer_review_data(conn, &exercise_slide_submission).await?;
            Some(data)
        }
        None => None,
    };
    Ok(data)
}

async fn try_to_select_peer_review_candidate_from_queue(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    excluded_user_id: Uuid,
    excluded_exercise_slide_submission_ids: &[Uuid],
) -> ModelResult<Option<Uuid>> {
    let mut rng = thread_rng();
    // Try to get a candidate that needs reviews from queue.
    let mut candidates = peer_review_queue_entries::get_many_that_need_peer_reviews_by_exercise_id_and_review_priority(conn,
        exercise_id,
        excluded_user_id,
        excluded_exercise_slide_submission_ids,
        MAX_PEER_REVIEW_CANDIDATES,).await?;
    candidates.shuffle(&mut rng);
    match candidates.into_iter().next() {
        Some(candidate) => Ok(Some(
            candidate.receiving_peer_reviews_exercise_slide_submission_id,
        )),
        None => {
            // Try again for any queue entry.
            let mut candidates =
                peer_review_queue_entries::get_many_by_exercise_id_and_review_priority(
                    conn,
                    exercise_id,
                    excluded_user_id,
                    excluded_exercise_slide_submission_ids,
                    MAX_PEER_REVIEW_CANDIDATES,
                )
                .await?;
            candidates.shuffle(&mut rng);
            Ok(candidates
                .into_iter()
                .next()
                .map(|entry| entry.receiving_peer_reviews_exercise_slide_submission_id))
        }
    }
}

async fn get_course_material_peer_review_data(
    conn: &mut PgConnection,
    exercise_slide_submission: &ExerciseSlideSubmission,
) -> ModelResult<CourseMaterialPeerReviewData> {
    let peer_review = peer_reviews::get_by_exercise_or_course_instance_id(
        conn,
        exercise_slide_submission.exercise_id,
        exercise_slide_submission.get_course_instance_id()?,
    )
    .await?;
    let peer_review_questions =
        peer_review_questions::get_all_by_peer_review_id(conn, peer_review.id).await?;
    let exercise_task_submissions =
        exercise_task_submissions::get_stuff(conn, exercise_slide_submission.id).await?;
    Ok(CourseMaterialPeerReviewData {
        exercise_slide_submission_id: exercise_slide_submission.id,
        exercise_task_submissions,
        peer_review_id: peer_review.id,
        peer_review_questions,
    })
}
