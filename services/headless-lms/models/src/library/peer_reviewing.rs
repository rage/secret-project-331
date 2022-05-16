use std::collections::HashMap;

use rand::{seq::SliceRandom, thread_rng};

use crate::{
    exercise_slide_submissions::{self, ExerciseSlideSubmission},
    exercise_task_submissions::{self, ExerciseTaskSubmissionWithSpec},
    exercises::Exercise,
    peer_review_question_submissions,
    peer_review_questions::{self, PeerReviewQuestion},
    peer_review_queue_entries, peer_review_submissions,
    peer_reviews::{self, PeerReview},
    prelude::*,
    user_exercise_states::{self, ExerciseProgress, UserExerciseState},
};

const MAX_PEER_REVIEW_CANDIDATES: i64 = 10;

/// Starts peer review state for the student for this exercise.
pub async fn start_peer_review_for_user(
    conn: &mut PgConnection,
    user_exercise_state: UserExerciseState,
) -> ModelResult<()> {
    if user_exercise_state.exercise_progress != ExerciseProgress::NotAnswered {
        return Err(ModelError::PreconditionFailed(
            "Cannot start peer review anymore.".to_string(),
        ));
    }
    let _user_exercise_state = user_exercise_states::update_exercise_progress(
        conn,
        user_exercise_state.id,
        ExerciseProgress::PeerReview,
    )
    .await?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialPeerReviewSubmission {
    pub exercise_slide_submission_id: Uuid,
    pub peer_review_id: Uuid,
    pub peer_review_question_answers: Vec<CourseMaterialPeerReviewQuestionAnswer>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialPeerReviewQuestionAnswer {
    pub peer_review_question_id: Uuid,
    pub text_data: Option<String>,
    pub number_data: Option<f32>,
}

pub async fn create_peer_review_submission_for_user(
    conn: &mut PgConnection,
    exercise: &Exercise,
    user_exercise_state: &UserExerciseState,
    peer_review_submission: CourseMaterialPeerReviewSubmission,
) -> ModelResult<()> {
    let peer_review = peer_reviews::get_by_exercise_or_course_id(
        conn,
        user_exercise_state.exercise_id,
        exercise.get_course_id()?,
    )
    .await?;
    let sanitized_answers = validate_and_sanitize_peer_review_submission_answers(
        peer_review_questions::get_all_by_peer_review_id_as_map(conn, peer_review.id).await?,
        peer_review_submission.peer_review_question_answers,
    )?;
    let users_latest_submission =
        exercise_slide_submissions::get_users_latest_exercise_slide_submission(
            conn,
            user_exercise_state.get_selected_exercise_slide_id()?,
            user_exercise_state.user_id,
        )
        .await?;

    let mut tx = conn.begin().await?;
    let peer_review_submission_id = peer_review_submissions::insert(
        &mut tx,
        user_exercise_state.user_id,
        user_exercise_state.exercise_id,
        user_exercise_state.get_course_instance_id()?,
        peer_review.id,
        peer_review_submission.exercise_slide_submission_id,
    )
    .await?;
    for answer in sanitized_answers {
        peer_review_question_submissions::insert(
            &mut tx,
            answer.peer_review_question_id,
            peer_review_submission_id,
            answer.text_data,
            answer.number_data,
        )
        .await?;
    }
    peer_review_queue_entries::upsert(
        &mut tx,
        user_exercise_state.user_id,
        user_exercise_state.exercise_id,
        user_exercise_state.get_course_instance_id()?,
        users_latest_submission.id,
    )
    .await?;
    tx.commit().await?;

    Ok(())
}

/// Filters submitted peer review answers to those that are part of the peer review.
fn validate_and_sanitize_peer_review_submission_answers(
    mut peer_review_questions: HashMap<Uuid, PeerReviewQuestion>,
    peer_review_submission_question_answers: Vec<CourseMaterialPeerReviewQuestionAnswer>,
) -> ModelResult<Vec<CourseMaterialPeerReviewQuestionAnswer>> {
    let valid_peer_review_question_answers = peer_review_submission_question_answers
        .into_iter()
        .filter(|answer| {
            peer_review_questions
                .remove(&answer.peer_review_question_id)
                .is_some()
        })
        .collect();
    if peer_review_questions
        .into_iter()
        .all(|question| !question.1.answer_required)
    {
        // Answer is valid if all required questions are answered.
        Ok(valid_peer_review_question_answers)
    } else {
        Err(ModelError::PreconditionFailed(
            "All required questions need to be answered.".to_string(),
        ))
    }
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
    exercise: &Exercise,
    user_exercise_state: &UserExerciseState,
) -> ModelResult<Option<CourseMaterialPeerReviewData>> {
    let peer_review = peer_reviews::get_by_exercise_or_course_id(
        conn,
        user_exercise_state.exercise_id,
        exercise.get_course_id()?,
    )
    .await?;
    let excluded_submission_ids =
        peer_review_submissions::get_users_submission_ids_for_exercise_and_course_instance(
            conn,
            user_exercise_state.user_id,
            user_exercise_state.exercise_id,
            user_exercise_state.get_course_instance_id()?,
        )
        .await?;
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
            // TODO: Filter already submitted also here!!!
            exercise_slide_submissions::try_to_get_random_from_other_users_by_exercise_id(
                conn,
                user_exercise_state.exercise_id,
                user_exercise_state.user_id,
            )
            .await?
        }
    };
    let data = match exercise_slide_submission_to_review {
        Some(exercise_slide_submission) => {
            let data = get_course_material_peer_review_data(
                conn,
                &peer_review,
                &exercise_slide_submission,
            )
            .await?;
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
        MAX_PEER_REVIEW_CANDIDATES,
    ).await?;
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
    peer_review: &PeerReview,
    exercise_slide_submission: &ExerciseSlideSubmission,
) -> ModelResult<CourseMaterialPeerReviewData> {
    let peer_review_questions =
        peer_review_questions::get_all_by_peer_review_id(conn, peer_review.id).await?;
    let exercise_task_submissions =
        exercise_task_submissions::get_task_submissions_with_specs_by_exercise_slide_id(
            conn,
            exercise_slide_submission.id,
        )
        .await?;
    Ok(CourseMaterialPeerReviewData {
        exercise_slide_submission_id: exercise_slide_submission.id,
        exercise_task_submissions,
        peer_review_id: peer_review.id,
        peer_review_questions,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    mod validate_peer_review_submissions_answers {
        use chrono::TimeZone;

        use crate::peer_review_questions::PeerReviewQuestionType;

        use super::*;

        #[test]
        fn accepts_valid_answers() {
            let peer_review_id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let question_id = Uuid::parse_str("68d5cda3-6ad8-464b-9af1-bd1692fcbee1").unwrap();
            let questions = HashMap::from([(
                question_id,
                create_peer_review_question(question_id, peer_review_id, true).unwrap(),
            )]);
            let answers = vec![create_peer_review_answer(question_id)];
            assert_eq!(
                validate_and_sanitize_peer_review_submission_answers(questions, answers)
                    .unwrap()
                    .len(),
                1
            );
        }

        #[test]
        fn filters_illegal_answers() {
            let peer_review_id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let questions = HashMap::new();
            let answers = vec![create_peer_review_answer(peer_review_id)];
            assert_eq!(
                validate_and_sanitize_peer_review_submission_answers(questions, answers)
                    .unwrap()
                    .len(),
                0
            );
        }

        #[test]
        fn errors_on_missing_required_answers() {
            let peer_review_id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let question_id = Uuid::parse_str("68d5cda3-6ad8-464b-9af1-bd1692fcbee1").unwrap();
            let questions = HashMap::from([(
                question_id,
                create_peer_review_question(question_id, peer_review_id, true).unwrap(),
            )]);
            assert!(
                validate_and_sanitize_peer_review_submission_answers(questions, vec![]).is_err()
            )
        }

        fn create_peer_review_question(
            id: Uuid,
            peer_review_id: Uuid,
            answer_required: bool,
        ) -> ModelResult<PeerReviewQuestion> {
            Ok(PeerReviewQuestion {
                id,
                created_at: Utc.ymd(2022, 1, 1).and_hms(0, 0, 0),
                updated_at: Utc.ymd(2022, 1, 1).and_hms(0, 0, 0),
                deleted_at: None,
                peer_review_id,
                order_number: 0,
                question: "".to_string(),
                question_type: PeerReviewQuestionType::Essay,
                answer_required,
            })
        }

        fn create_peer_review_answer(
            peer_review_question_id: Uuid,
        ) -> CourseMaterialPeerReviewQuestionAnswer {
            CourseMaterialPeerReviewQuestionAnswer {
                peer_review_question_id,
                text_data: Some("".to_string()),
                number_data: None,
            }
        }
    }
}
