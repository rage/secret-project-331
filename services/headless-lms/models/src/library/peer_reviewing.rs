use std::collections::HashMap;

use futures::future::BoxFuture;
use rand::{seq::SliceRandom, thread_rng};
use url::Url;

use crate::{
    exercise_service_info::ExerciseServiceInfoApi,
    exercise_slide_submissions::{self, ExerciseSlideSubmission},
    exercise_task_submissions,
    exercise_tasks::CourseMaterialExerciseTask,
    exercises::Exercise,
    peer_review_configs::{self, PeerReviewConfig},
    peer_review_question_submissions,
    peer_review_questions::{self, PeerReviewQuestion},
    peer_review_queue_entries::{self, PeerReviewQueueEntry},
    peer_review_submissions,
    prelude::*,
    user_exercise_states::{self, CourseInstanceOrExamId, ReviewingStage, UserExerciseState},
};

use super::user_exercise_state_updater::{
    self, UserExerciseStateUpdateAlreadyLoadedRequiredData,
    UserExerciseStateUpdateAlreadyLoadedRequiredDataPeerReviewInformation,
};

const MAX_PEER_REVIEW_CANDIDATES: i64 = 10;

/// Starts peer review state for the student for this exercise.
pub async fn start_peer_review_for_user(
    conn: &mut PgConnection,
    user_exercise_state: UserExerciseState,
) -> ModelResult<()> {
    if user_exercise_state.reviewing_stage != ReviewingStage::NotStarted {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Cannot start peer review anymore.".to_string(),
            None,
        ));
    }
    let _user_exercise_state = user_exercise_states::update_exercise_progress(
        conn,
        user_exercise_state.id,
        ReviewingStage::PeerReview,
    )
    .await?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialPeerReviewSubmission {
    pub exercise_slide_submission_id: Uuid,
    pub peer_review_config_id: Uuid,
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
    giver_exercise_state: UserExerciseState,
    peer_review_submission: CourseMaterialPeerReviewSubmission,
) -> ModelResult<UserExerciseState> {
    let peer_review = peer_review_configs::get_by_exercise_or_course_id(
        conn,
        exercise,
        exercise.get_course_id()?,
    )
    .await?;
    let sanitized_answers = validate_and_sanitize_peer_review_submission_answers(
        peer_review_questions::get_all_by_peer_review_config_id_as_map(conn, peer_review.id)
            .await?,
        peer_review_submission.peer_review_question_answers,
    )?;

    let mut tx = conn.begin().await?;
    let peer_review_submission_id = peer_review_submissions::insert(
        &mut tx,
        PKeyPolicy::Generate,
        giver_exercise_state.user_id,
        giver_exercise_state.exercise_id,
        giver_exercise_state.get_course_instance_id()?,
        peer_review.id,
        peer_review_submission.exercise_slide_submission_id,
    )
    .await?;
    for answer in sanitized_answers {
        peer_review_question_submissions::insert(
            &mut tx,
            PKeyPolicy::Generate,
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
            giver_exercise_state.user_id,
            giver_exercise_state.exercise_id,
            giver_exercise_state.get_course_instance_id()?,
        )
        .await?
        .try_into()?;
    let giver_exercise_state = if peer_reviews_given >= peer_review.peer_reviews_to_give {
        update_peer_review_giver_exercise_progress(
            &mut tx,
            exercise,
            giver_exercise_state,
            peer_reviews_given,
            peer_review.clone(),
        )
        .await?
    } else {
        giver_exercise_state
    };
    let exercise_slide_submission = exercise_slide_submissions::get_by_id(
        &mut tx,
        peer_review_submission.exercise_slide_submission_id,
    )
    .await?;
    let receiver_peer_review_queue_entry =
        peer_review_queue_entries::try_to_get_by_receiving_submission_and_course_instance_ids(
            &mut tx,
            exercise_slide_submission.id,
            exercise_slide_submission
                .course_instance_id
                .ok_or_else(|| {
                    ModelError::new(
                        ModelErrorType::PreconditionFailed,
                        "Exercise slide not part of a course instance.".to_string(),
                        None,
                    )
                })?,
        )
        .await?;
    if let Some(entry) = receiver_peer_review_queue_entry {
        update_peer_review_receiver_exercise_status(&mut tx, exercise, &peer_review, entry).await?;
    }
    tx.commit().await?;

    Ok(giver_exercise_state)
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
        Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "All required questions need to be answered.".to_string(),
            None,
        ))
    }
}

/// Creates or updates submitter's exercise state and peer review queue entry.
async fn update_peer_review_giver_exercise_progress(
    conn: &mut PgConnection,
    exercise: &Exercise,
    user_exercise_state: UserExerciseState,
    peer_reviews_given: i32,
    peer_review: PeerReviewConfig,
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
        peer_reviews_received >= peer_review.peer_reviews_to_receive,
    )
    .await?;
    let received_peer_review_question_submissions = crate::peer_review_question_submissions::get_received_question_submissions_for_exercise_slide_submission(conn, users_latest_submission.id).await?;
    let updated_user_exercise_state =
        user_exercise_state_updater::update_user_exercise_state_with_some_already_loaded_data(
            conn,
            user_exercise_state.id,
            UserExerciseStateUpdateAlreadyLoadedRequiredData {
                current_user_exercise_state: Some(user_exercise_state),
                exercise: Some(exercise.clone()),
                peer_review_information: Some(UserExerciseStateUpdateAlreadyLoadedRequiredDataPeerReviewInformation {
                    peer_review_queue_entry: Some(Some(peer_review_queue_entry)),
                    latest_exercise_slide_submission_received_peer_review_question_submissions:
                        Some(received_peer_review_question_submissions),
                    latest_exercise_slide_submission: Some(users_latest_submission),
                    ..Default::default()
                }),
                ..Default::default()
            },
        )
        .await?;

    Ok(updated_user_exercise_state)
}

async fn update_peer_review_receiver_exercise_status(
    conn: &mut PgConnection,
    exercise: &Exercise,
    peer_review: &PeerReviewConfig,
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
            let received_peer_review_question_submissions = crate::peer_review_question_submissions::get_received_question_submissions_for_exercise_slide_submission(conn, peer_review_queue_entry.receiving_peer_reviews_exercise_slide_submission_id).await?;
            let _updated_user_exercise_state =
            user_exercise_state_updater::update_user_exercise_state_with_some_already_loaded_data(
                conn,
                user_exercise_state.id,
                UserExerciseStateUpdateAlreadyLoadedRequiredData {
                    current_user_exercise_state: Some(user_exercise_state),
                    exercise: Some(exercise.clone()),
                    peer_review_information: Some(UserExerciseStateUpdateAlreadyLoadedRequiredDataPeerReviewInformation {
                        peer_review_queue_entry: Some(Some(peer_review_queue_entry)),
                        latest_exercise_slide_submission_received_peer_review_question_submissions:
                            Some(received_peer_review_question_submissions),
                        ..Default::default()
                    }),
                    ..Default::default()
                },
            )
            .await?;
        }
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialPeerReviewData {
    /// If none, no answer was available for review.
    pub answer_to_review: Option<CourseMaterialPeerReviewDataAnswerToReview>,
    pub peer_review_config: PeerReviewConfig,
    pub peer_review_questions: Vec<PeerReviewQuestion>,
    #[cfg_attr(feature = "ts_rs", ts(type = "number"))]
    pub num_peer_reviews_given: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialPeerReviewDataAnswerToReview {
    pub exercise_slide_submission_id: Uuid,
    /// Uses the same type as we use when we render and exercise in course material. Allows us to reuse existing logic for getting all the necessary information for rendering the submission.
    pub course_material_exercise_tasks: Vec<CourseMaterialExerciseTask>,
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
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<CourseMaterialPeerReviewData> {
    let peer_review_config = peer_review_configs::get_by_exercise_or_course_id(
        conn,
        exercise,
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
        Some(exercise_slide_submission) => Some(exercise_slide_submission),
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
    let data = get_course_material_peer_review_data(
        conn,
        &peer_review_config,
        &exercise_slide_submission_to_review,
        reviewer_user_exercise_state.user_id,
        course_instance_id,
        exercise.id,
        fetch_service_info,
    )
    .await?;

    Ok(data)
}

async fn try_to_select_peer_review_candidate_from_queue(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    excluded_user_id: Uuid,
    excluded_exercise_slide_submission_ids: &[Uuid],
) -> ModelResult<Option<ExerciseSlideSubmission>> {
    // Loop until we either find a non deleted submission or we find no submission at all
    loop {
        let exercise_slide_submission_id = try_to_select_peer_review_candidate_from_queue_impl(
            conn,
            exercise_id,
            excluded_user_id,
            excluded_exercise_slide_submission_ids,
        )
        .await?;
        // Let's make sure we don't return peer review queue entries for exercise slide submissions that are deleted.
        if let Some(ess_id) = exercise_slide_submission_id {
            let ess = exercise_slide_submissions::get_by_id(conn, ess_id)
                .await
                .optional()?;
            if let Some(ess) = ess {
                if ess.deleted_at.is_none() {
                    return Ok(Some(ess));
                } else {
                }
            }
            // We found a submission from the peer reveiw queue but the submission was deleted. This is unfortunate since if
            // the submission was deleted the peer review queue entry should have been deleted too. We can try to fix the situation somehow.
            warn!(exercise_slide_submission_id = %ess_id, "Selected exercise slide submission that was deleted from the peer review queue. The peer review queue entry should've been deleted too! Deleting it now.");
            peer_review_queue_entries::delete_by_receiving_peer_reviews_exercise_slide_submission_id(
                conn, ess_id,
            ).await?;
            info!("Deleting done, trying to select a new peer review candidate");
        } else {
            // We didn't manage to select a candidate from the queue
            return Ok(None);
        }
    }
}

async fn try_to_select_peer_review_candidate_from_queue_impl(
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
    peer_review_config: &PeerReviewConfig,
    exercise_slide_submission: &Option<ExerciseSlideSubmission>,
    reviewer_user_id: Uuid,
    reviewer_course_instance_id: Uuid,
    exercise_id: Uuid,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<CourseMaterialPeerReviewData> {
    let peer_review_questions =
        peer_review_questions::get_all_by_peer_review_config_id(conn, peer_review_config.id)
            .await?;
    let num_peer_reviews_given =
        peer_review_submissions::get_num_peer_reviews_given_by_user_and_course_instance_and_exercise(
            conn,
            reviewer_user_id,
            reviewer_course_instance_id,
            exercise_id,
        )
        .await?;

    let answer_to_review = match exercise_slide_submission {
        Some(exercise_slide_submission) => {
            let exercise_slide_submission_id = exercise_slide_submission.id;
            let course_material_exercise_tasks = exercise_task_submissions::get_exercise_task_submission_info_by_exercise_slide_submission_id(
                conn,
                exercise_slide_submission_id,
                reviewer_user_id,
                 fetch_service_info
            ).await?;
            Some(CourseMaterialPeerReviewDataAnswerToReview {
                exercise_slide_submission_id,
                course_material_exercise_tasks,
            })
        }
        None => None,
    };

    Ok(CourseMaterialPeerReviewData {
        answer_to_review,
        peer_review_config: peer_review_config.clone(),
        peer_review_questions,
        num_peer_reviews_given,
    })
}

#[instrument(skip(conn))]
pub async fn update_peer_review_queue_reviews_received(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    info!("Updating peer review queue reviews received");
    let exercises = crate::exercises::get_exercises_by_course_id(&mut tx, course_id)
        .await?
        .into_iter()
        .filter(|e| e.needs_peer_review)
        .collect::<Vec<_>>();
    for exercise in exercises {
        info!("Processing exercise {:?}", exercise.id);
        let peer_review_config =
            peer_review_configs::get_by_exercise_or_course_id(&mut tx, &exercise, course_id)
                .await?;
        let peer_review_queue_entries =
            crate::peer_review_queue_entries::get_all_that_need_peer_reviews_by_exercise_id(
                &mut tx,
                exercise.id,
            )
            .await?;
        info!(
            "Processing {:?} peer review queue entries",
            peer_review_queue_entries.len()
        );
        for peer_review_queue_entry in peer_review_queue_entries {
            update_peer_review_receiver_exercise_status(
                &mut tx,
                &exercise,
                &peer_review_config,
                peer_review_queue_entry,
            )
            .await?;
        }
    }
    info!("Done");
    tx.commit().await?;
    Ok(())
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
            let peer_review_config_id =
                Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let question_id = Uuid::parse_str("68d5cda3-6ad8-464b-9af1-bd1692fcbee1").unwrap();
            let questions = HashMap::from([(
                question_id,
                create_peer_review_question(question_id, peer_review_config_id, true).unwrap(),
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
            let peer_review_config_id =
                Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let questions = HashMap::new();
            let answers = vec![create_peer_review_answer(peer_review_config_id)];
            assert_eq!(
                validate_and_sanitize_peer_review_submission_answers(questions, answers)
                    .unwrap()
                    .len(),
                0
            );
        }

        #[test]
        fn errors_on_missing_required_answers() {
            let peer_review_config_id =
                Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let question_id = Uuid::parse_str("68d5cda3-6ad8-464b-9af1-bd1692fcbee1").unwrap();
            let questions = HashMap::from([(
                question_id,
                create_peer_review_question(question_id, peer_review_config_id, true).unwrap(),
            )]);
            assert!(
                validate_and_sanitize_peer_review_submission_answers(questions, vec![]).is_err()
            )
        }

        fn create_peer_review_question(
            id: Uuid,
            peer_review_config_id: Uuid,
            answer_required: bool,
        ) -> ModelResult<PeerReviewQuestion> {
            Ok(PeerReviewQuestion {
                id,
                created_at: Utc.with_ymd_and_hms(2022, 1, 1, 0, 0, 0).unwrap(),
                updated_at: Utc.with_ymd_and_hms(2022, 1, 1, 0, 0, 0).unwrap(),
                deleted_at: None,
                peer_review_config_id,
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
