use std::collections::HashMap;

use rand::{seq::SliceRandom, thread_rng};

use crate::{
    exercise_slide_submissions::{self, ExerciseSlideSubmission},
    exercise_task_submissions,
    exercise_tasks::CourseMaterialExerciseTask,
    exercises::Exercise,
    peer_review_question_submissions,
    peer_review_questions::{self, PeerReviewQuestion},
    peer_review_queue_entries::{self, PeerReviewQueueEntry},
    peer_review_submissions,
    peer_reviews::{self, PeerReview},
    prelude::*,
    user_exercise_states::{self, CourseInstanceOrExamId, ExerciseProgress, UserExerciseState},
};

use super::grading;

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
    user_exercise_state: UserExerciseState,
    peer_review_submission: CourseMaterialPeerReviewSubmission,
) -> ModelResult<UserExerciseState> {
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
    let peer_reviews_given: i32 =
        peer_review_submissions::get_users_submission_count_for_exercise_and_course_instance(
            &mut tx,
            user_exercise_state.user_id,
            user_exercise_state.exercise_id,
            user_exercise_state.get_course_instance_id()?,
        )
        .await?
        .try_into()?;
    let user_exercise_state = if peer_reviews_given >= peer_review.peer_reviews_to_give {
        update_peer_review_giver_exercise_progress(
            &mut tx,
            exercise,
            user_exercise_state,
            peer_reviews_given,
            peer_review.peer_reviews_to_receive,
        )
        .await?
    } else {
        user_exercise_state
    };
    let receiver_peer_review_queue_entry =
        peer_review_queue_entries::try_to_get_by_receiving_submission_and_course_instance_ids(
            &mut tx,
            peer_review_submission.exercise_slide_submission_id,
            user_exercise_state.get_course_instance_id()?,
        )
        .await?;
    if let Some(entry) = receiver_peer_review_queue_entry {
        update_peer_review_receiver_exercise_status(&mut tx, exercise, &peer_review, entry).await?;
    }
    tx.commit().await?;

    Ok(user_exercise_state)
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

/// Creates or updates submitter's exercise state and peer review queue entry.
async fn update_peer_review_giver_exercise_progress(
    conn: &mut PgConnection,
    exercise: &Exercise,
    user_exercise_state: UserExerciseState,
    peer_reviews_given: i32,
    peer_reviews_to_receive: i32,
) -> ModelResult<UserExerciseState> {
    let users_latest_submission =
        exercise_slide_submissions::get_users_latest_exercise_slide_submission(
            conn,
            user_exercise_state.get_selected_exercise_slide_id()?,
            user_exercise_state.user_id,
        )
        .await?;
    let peer_reviews_received: i32 =
        peer_review_submissions::count_peer_review_submissions_for_exercise_slide_submission(
            conn,
            users_latest_submission.id,
        )
        .await?
        .try_into()?;
    let peer_review_queue_entry = peer_review_queue_entries::upsert_peer_review_priority(
        conn,
        user_exercise_state.user_id,
        user_exercise_state.exercise_id,
        user_exercise_state.get_course_instance_id()?,
        peer_reviews_given,
        users_latest_submission.id,
        peer_reviews_received >= peer_reviews_to_receive,
    )
    .await?;
    let user_exercise_state = grading::update_user_exercise_state_peer_review_status(
        conn,
        exercise,
        user_exercise_state,
        true,
        peer_review_queue_entry.received_enough_peer_reviews,
    )
    .await?;
    Ok(user_exercise_state)
}

async fn update_peer_review_receiver_exercise_status(
    conn: &mut PgConnection,
    exercise: &Exercise,
    peer_review: &PeerReview,
    peer_review_queue_entry: PeerReviewQueueEntry,
) -> ModelResult<()> {
    let peer_reviews_received =
        peer_review_submissions::count_peer_review_submissions_for_exercise_slide_submission(
            conn,
            peer_review_queue_entry.receiving_peer_reviews_exercise_slide_submission_id,
        )
        .await?;
    if peer_reviews_received >= peer_review.peer_reviews_to_receive.try_into()? {
        // Only ever set this to true
        let peer_review_queue_entry =
            peer_review_queue_entries::update_received_enough_peer_reviews(
                conn,
                peer_review_queue_entry.id,
                true,
            )
            .await?;
        let user_exercise_state = user_exercise_states::get_user_exercise_state_if_exists(
            conn,
            peer_review_queue_entry.user_id,
            peer_review_queue_entry.exercise_id,
            CourseInstanceOrExamId::Instance(peer_review_queue_entry.course_instance_id),
        )
        .await?;
        if let Some(user_exercise_state) = user_exercise_state {
            let peer_reviews_given: i32 =
            peer_review_submissions::get_users_submission_count_for_exercise_and_course_instance(
                conn,
                peer_review_queue_entry.user_id,
                peer_review_queue_entry.exercise_id,
                peer_review_queue_entry.course_instance_id,
            )
            .await?
            .try_into()?;
            grading::update_user_exercise_state_peer_review_status(
                conn,
                exercise,
                user_exercise_state,
                peer_reviews_given >= peer_review.peer_reviews_to_give,
                true,
            )
            .await?;
        }
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialPeerReviewData {
    pub exercise_slide_submission_id: Uuid,
    /// Uses the same type as we use when we render and exercise in course material. Allows us to reuse existing logic for getting all the necessary information for rendering the submission.
    pub course_material_exercise_tasks: Vec<CourseMaterialExerciseTask>,
    pub peer_review: PeerReview,
    pub peer_review_questions: Vec<PeerReviewQuestion>,
    #[cfg_attr(feature = "ts_rs", ts(type = "number"))]
    pub num_peer_reviews_given: i64,
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
    reviewer_user_exercise_state: &UserExerciseState,
) -> ModelResult<Option<CourseMaterialPeerReviewData>> {
    let peer_review = peer_reviews::get_by_exercise_or_course_id(
        conn,
        reviewer_user_exercise_state.exercise_id,
        exercise.get_course_id()?,
    )
    .await?;
    let course_instance_id = reviewer_user_exercise_state.get_course_instance_id()?;
    let excluded_exercise_slide_submission_ids =
        peer_review_submissions::get_users_submission_ids_for_exercise_and_course_instance(
            conn,
            reviewer_user_exercise_state.user_id,
            reviewer_user_exercise_state.exercise_id,
            course_instance_id,
        )
        .await?;
    let candidate_submission_id = try_to_select_peer_review_candidate_from_queue(
        conn,
        reviewer_user_exercise_state.exercise_id,
        reviewer_user_exercise_state.user_id,
        &excluded_exercise_slide_submission_ids,
    )
    .await?;
    let exercise_slide_submission_to_review = match candidate_submission_id {
        Some(exercise_slide_submission_id) => {
            Some(exercise_slide_submissions::get_by_id(conn, exercise_slide_submission_id).await?)
        }
        None => {
            // At the start of a course there can be a short period when there aren't any peer reviews.
            // In that case just get a random one.
            exercise_slide_submissions::try_to_get_random_filtered_by_user_and_submissions(
                conn,
                reviewer_user_exercise_state.exercise_id,
                reviewer_user_exercise_state.user_id,
                &excluded_exercise_slide_submission_ids,
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
                reviewer_user_exercise_state.user_id,
                course_instance_id,
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
    reviewer_user_id: Uuid,
    reviewer_course_instance_id: Uuid,
) -> ModelResult<CourseMaterialPeerReviewData> {
    let peer_review_questions =
        peer_review_questions::get_all_by_peer_review_id(conn, peer_review.id).await?;
    let course_material_exercise_tasks = exercise_task_submissions::get_exercise_task_submission_info_by_exercise_slide_submission_id(
        conn,
        exercise_slide_submission.id,
    ).await?;
    let num_peer_reviews_given =
        peer_review_submissions::get_num_peer_reviews_given_by_user_and_course_instance_and_exercise(
            conn,
            reviewer_user_id,
            reviewer_course_instance_id,
            exercise_slide_submission.exercise_id,
        )
        .await?;
    Ok(CourseMaterialPeerReviewData {
        exercise_slide_submission_id: exercise_slide_submission.id,
        course_material_exercise_tasks,
        peer_review: peer_review.clone(),
        peer_review_questions,
        num_peer_reviews_given,
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
