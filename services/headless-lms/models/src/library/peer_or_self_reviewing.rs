use std::collections::HashMap;

use chrono::Duration;
use futures::future::BoxFuture;
use rand::{rng, seq::SliceRandom};
use url::Url;

use crate::{
    exercise_service_info::ExerciseServiceInfoApi,
    exercise_slide_submissions::{self, ExerciseSlideSubmission},
    exercise_task_submissions,
    exercise_tasks::CourseMaterialExerciseTask,
    exercises::Exercise,
    peer_or_self_review_configs::{self, PeerOrSelfReviewConfig},
    peer_or_self_review_question_submissions,
    peer_or_self_review_questions::{self, PeerOrSelfReviewQuestion},
    peer_or_self_review_submissions,
    peer_review_queue_entries::{self, PeerReviewQueueEntry},
    prelude::*,
    user_exercise_states::{self, CourseInstanceOrExamId, ReviewingStage, UserExerciseState},
};

use super::user_exercise_state_updater::{
    self, UserExerciseStateUpdateAlreadyLoadedRequiredData,
    UserExerciseStateUpdateAlreadyLoadedRequiredDataPeerReviewInformation,
};

const MAX_PEER_REVIEW_CANDIDATES: i64 = 10;

/// Starts peer review state for the student for this exercise.
pub async fn start_peer_or_self_review_for_user(
    conn: &mut PgConnection,
    user_exercise_state: UserExerciseState,
    exercise: &Exercise,
) -> ModelResult<()> {
    if user_exercise_state.reviewing_stage != ReviewingStage::NotStarted {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Cannot start peer or self review anymore.".to_string(),
            None,
        ));
    }
    if !exercise.needs_peer_review && !exercise.needs_self_review {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Exercise does not need peer or self review.".to_string(),
            None,
        ));
    }
    let new_reviewing_stage = if exercise.needs_peer_review {
        ReviewingStage::PeerReview
    } else {
        ReviewingStage::SelfReview
    };

    let _user_exercise_state = user_exercise_states::update_exercise_progress(
        conn,
        user_exercise_state.id,
        new_reviewing_stage,
    )
    .await?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialPeerOrSelfReviewSubmission {
    pub exercise_slide_submission_id: Uuid,
    pub peer_or_self_review_config_id: Uuid,
    pub peer_review_question_answers: Vec<CourseMaterialPeerOrSelfReviewQuestionAnswer>,
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialPeerOrSelfReviewQuestionAnswer {
    pub peer_or_self_review_question_id: Uuid,
    pub text_data: Option<String>,
    pub number_data: Option<f32>,
}

pub async fn create_peer_or_self_review_submission_for_user(
    conn: &mut PgConnection,
    exercise: &Exercise,
    giver_exercise_state: UserExerciseState,
    receiver_exercise_state: UserExerciseState,
    peer_review_submission: CourseMaterialPeerOrSelfReviewSubmission,
) -> ModelResult<UserExerciseState> {
    let is_self_review = giver_exercise_state.user_id == receiver_exercise_state.user_id;

    if is_self_review
        && (!exercise.needs_self_review
            || giver_exercise_state.reviewing_stage != ReviewingStage::SelfReview)
    {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Self review not allowed.".to_string(),
            None,
        ));
    }
    if !is_self_review
        && (!exercise.needs_peer_review
            || giver_exercise_state.reviewing_stage == ReviewingStage::NotStarted)
    {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "Peer review not allowed.".to_string(),
            None,
        ));
    }

    let peer_or_self_review_config = peer_or_self_review_configs::get_by_exercise_or_course_id(
        conn,
        exercise,
        exercise.get_course_id()?,
    )
    .await?;
    let sanitized_answers = validate_and_sanitize_peer_review_submission_answers(
        peer_or_self_review_questions::get_all_by_peer_or_self_review_config_id_as_map(
            conn,
            peer_or_self_review_config.id,
        )
        .await?,
        peer_review_submission.peer_review_question_answers,
    )?;

    let mut tx = conn.begin().await?;

    let peer_reviews_given_before_this_review: i32 =
        peer_or_self_review_submissions::get_users_submission_count_for_exercise_and_course_instance(
            &mut tx,
            giver_exercise_state.user_id,
            giver_exercise_state.exercise_id,
            giver_exercise_state.get_course_instance_id()?,
        )
        .await?
        .try_into()?;
    let peer_reviews_given = peer_reviews_given_before_this_review + 1;

    if !is_self_review {
        let unacceptable_amount_of_peer_reviews =
            std::cmp::max(peer_or_self_review_config.peer_reviews_to_give, 1) * 15;
        let suspicious_amount_of_peer_reviews = std::cmp::max(
            std::cmp::max(peer_or_self_review_config.peer_reviews_to_give, 1) * 2,
            4,
        );
        // To prevent someone from spamming peer reviews
        if peer_reviews_given > unacceptable_amount_of_peer_reviews {
            return Err(ModelError::new(
                ModelErrorType::PreconditionFailed,
                "You have given too many peer reviews to this exercise".to_string(),
                None,
            ));
        }
        // If someone has created more peer reviews than usual, apply rate limiting
        if peer_reviews_given > suspicious_amount_of_peer_reviews {
            // This is purposefully getting submission time to any peer reviewed exercise to prevent the user from spamming multiple exercises at the same time.
            let last_submission_time =
                peer_or_self_review_submissions::get_last_time_user_submitted_peer_review(
                    &mut tx,
                    giver_exercise_state.user_id,
                    giver_exercise_state.exercise_id,
                    giver_exercise_state.get_course_instance_id()?,
                )
                .await?;

            if let Some(last_submission_time) = last_submission_time {
                let diff = peer_reviews_given - suspicious_amount_of_peer_reviews;
                let coefficient = diff.clamp(1, 10);
                // Between 30 seconds and 5 minutes
                if Utc::now() - Duration::seconds(30 * coefficient as i64) < last_submission_time {
                    return Err(ModelError::new(
                        ModelErrorType::InvalidRequest,
                        "You are submitting too fast. Try again later.".to_string(),
                        None,
                    ));
                }
            }
        }
    }
    let peer_or_self_review_submission_id = peer_or_self_review_submissions::insert(
        &mut tx,
        PKeyPolicy::Generate,
        giver_exercise_state.user_id,
        giver_exercise_state.exercise_id,
        giver_exercise_state.get_course_instance_id()?,
        peer_or_self_review_config.id,
        peer_review_submission.exercise_slide_submission_id,
    )
    .await?;
    for answer in sanitized_answers {
        peer_or_self_review_question_submissions::insert(
            &mut tx,
            PKeyPolicy::Generate,
            answer.peer_or_self_review_question_id,
            peer_or_self_review_submission_id,
            answer.text_data,
            answer.number_data,
        )
        .await?;
    }

    if !is_self_review && peer_reviews_given >= peer_or_self_review_config.peer_reviews_to_give {
        // Update peer review queue entry
        let users_latest_submission =
            exercise_slide_submissions::get_users_latest_exercise_slide_submission(
                &mut tx,
                giver_exercise_state.get_selected_exercise_slide_id()?,
                giver_exercise_state.user_id,
            )
            .await?;
        let peer_reviews_received: i32 =
        peer_or_self_review_submissions::count_peer_or_self_review_submissions_for_exercise_slide_submission(
            &mut tx,
            users_latest_submission.id,
            &[giver_exercise_state.user_id],
        )
        .await?
        .try_into()?;
        let _peer_review_queue_entry = peer_review_queue_entries::upsert_peer_review_priority(
            &mut tx,
            giver_exercise_state.user_id,
            giver_exercise_state.exercise_id,
            giver_exercise_state.get_course_instance_id()?,
            peer_reviews_given,
            users_latest_submission.id,
            peer_reviews_received >= peer_or_self_review_config.peer_reviews_to_receive,
        )
        .await?;
    }

    let giver_exercise_state =
        user_exercise_state_updater::update_user_exercise_state(&mut tx, giver_exercise_state.id)
            .await?;

    let exercise_slide_submission = exercise_slide_submissions::get_by_id(
        &mut tx,
        peer_review_submission.exercise_slide_submission_id,
    )
    .await?;
    let receiver_peer_review_queue_entry =
        peer_review_queue_entries::get_by_receiving_peer_reviews_exercise_slide_submission_id(
            &mut tx,
            exercise_slide_submission.id,
        )
        .await
        .optional()?;
    if let Some(entry) = receiver_peer_review_queue_entry {
        // No need to update the user exercise state again if this is a self review
        if entry.user_id != giver_exercise_state.user_id {
            update_peer_review_receiver_exercise_status(
                &mut tx,
                exercise,
                &peer_or_self_review_config,
                entry,
            )
            .await?;
        }
    }
    // Make it possible for the user to receive a new submission to review
    crate::offered_answers_to_peer_review_temporary::delete_saved_submissions_for_user(
        &mut tx,
        exercise.id,
        giver_exercise_state.user_id,
    )
    .await?;
    tx.commit().await?;

    Ok(giver_exercise_state)
}

/// Filters submitted peer review answers to those that are part of the peer review.
fn validate_and_sanitize_peer_review_submission_answers(
    peer_or_self_review_questions: HashMap<Uuid, PeerOrSelfReviewQuestion>,
    peer_review_submission_question_answers: Vec<CourseMaterialPeerOrSelfReviewQuestionAnswer>,
) -> ModelResult<Vec<CourseMaterialPeerOrSelfReviewQuestionAnswer>> {
    // Filter to valid answers (those with a matching question ID)
    let valid_peer_review_question_answers: Vec<_> = peer_review_submission_question_answers
        .into_iter()
        .filter(|answer| {
            peer_or_self_review_questions.contains_key(&answer.peer_or_self_review_question_id)
        })
        .collect();

    // Get IDs of questions that have been answered
    let answered_question_ids: std::collections::HashSet<_> = valid_peer_review_question_answers
        .iter()
        .map(|answer| answer.peer_or_self_review_question_id)
        .collect();

    // Check if any required question is unanswered
    let has_unanswered_required_questions = peer_or_self_review_questions
        .iter()
        .any(|(id, question)| question.answer_required && !answered_question_ids.contains(id));

    if has_unanswered_required_questions {
        Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "All required questions need to be answered.".to_string(),
            None,
        ))
    } else {
        // All required questions are answered
        Ok(valid_peer_review_question_answers)
    }
}

async fn update_peer_review_receiver_exercise_status(
    conn: &mut PgConnection,
    exercise: &Exercise,
    peer_review: &PeerOrSelfReviewConfig,
    peer_review_queue_entry: PeerReviewQueueEntry,
) -> ModelResult<()> {
    let peer_reviews_received =
        peer_or_self_review_submissions::count_peer_or_self_review_submissions_for_exercise_slide_submission(
            conn,
            peer_review_queue_entry.receiving_peer_reviews_exercise_slide_submission_id,
            &[peer_review_queue_entry.user_id],
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
            let received_peer_or_self_review_question_submissions = crate::peer_or_self_review_question_submissions::get_received_question_submissions_for_exercise_slide_submission(conn, peer_review_queue_entry.receiving_peer_reviews_exercise_slide_submission_id).await?;
            let _updated_user_exercise_state =
            user_exercise_state_updater::update_user_exercise_state_with_some_already_loaded_data(
                conn,
                user_exercise_state.id,
                UserExerciseStateUpdateAlreadyLoadedRequiredData {
                    current_user_exercise_state: Some(user_exercise_state),
                    exercise: Some(exercise.clone()),
                    peer_or_self_review_information: Some(UserExerciseStateUpdateAlreadyLoadedRequiredDataPeerReviewInformation {
                        peer_review_queue_entry: Some(Some(peer_review_queue_entry)),
                        latest_exercise_slide_submission_received_peer_or_self_review_question_submissions:
                            Some(received_peer_or_self_review_question_submissions),
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
pub struct CourseMaterialPeerOrSelfReviewData {
    /// If none, no answer was available for review.
    pub answer_to_review: Option<CourseMaterialPeerOrSelfReviewDataAnswerToReview>,
    pub peer_or_self_review_config: PeerOrSelfReviewConfig,
    pub peer_or_self_review_questions: Vec<PeerOrSelfReviewQuestion>,
    #[cfg_attr(feature = "ts_rs", ts(type = "number"))]
    pub num_peer_reviews_given: i64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseMaterialPeerOrSelfReviewDataAnswerToReview {
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
) -> ModelResult<CourseMaterialPeerOrSelfReviewData> {
    let peer_or_self_review_config = peer_or_self_review_configs::get_by_exercise_or_course_id(
        conn,
        exercise,
        exercise.get_course_id()?,
    )
    .await?;
    let course_instance_id = reviewer_user_exercise_state.get_course_instance_id()?;

    // If an answer has been given within 1 hour to be reviewed and it still needs peer review, return the same one
    if let Some(saved_exercise_slide_submission_to_review) = crate::offered_answers_to_peer_review_temporary::try_to_restore_previously_given_exercise_slide_submission(&mut *conn, exercise.id, reviewer_user_exercise_state.user_id, course_instance_id).await? {
        let data = get_course_material_peer_or_self_review_data(
            conn,
            &peer_or_self_review_config,
            &Some(saved_exercise_slide_submission_to_review),
            reviewer_user_exercise_state.user_id,
            course_instance_id,
            exercise.id,
            fetch_service_info,
        )
        .await?;

        return Ok(data)
    }

    let mut excluded_exercise_slide_submission_ids =
        peer_or_self_review_submissions::get_users_submission_ids_for_exercise_and_course_instance(
            conn,
            reviewer_user_exercise_state.user_id,
            reviewer_user_exercise_state.exercise_id,
            course_instance_id,
        )
        .await?;
    let reported_submissions =
        crate::flagged_answers::get_flagged_answers_submission_ids_by_flaggers_id(
            conn,
            reviewer_user_exercise_state.user_id,
        )
        .await?;
    excluded_exercise_slide_submission_ids.extend(reported_submissions);

    let candidate_submission_id = try_to_select_peer_review_candidate_from_queue(
        conn,
        reviewer_user_exercise_state.exercise_id,
        reviewer_user_exercise_state.user_id,
        &excluded_exercise_slide_submission_ids,
    )
    .await?;
    let exercise_slide_submission_to_review = match candidate_submission_id {
        Some(exercise_slide_submission) => {
            crate::offered_answers_to_peer_review_temporary::save_given_exercise_slide_submission(
                &mut *conn,
                exercise_slide_submission.id,
                exercise.id,
                reviewer_user_exercise_state.user_id,
                course_instance_id,
            )
            .await?;
            Some(exercise_slide_submission)
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
    let data = get_course_material_peer_or_self_review_data(
        conn,
        &peer_or_self_review_config,
        &exercise_slide_submission_to_review,
        reviewer_user_exercise_state.user_id,
        course_instance_id,
        exercise.id,
        fetch_service_info,
    )
    .await?;

    Ok(data)
}

/// Selects a user's own submission to be self-reviewed. Works similarly to `try_to_select_exercise_slide_submission_for_peer_review` but selects the user's latest submission.
pub async fn select_own_submission_for_self_review(
    conn: &mut PgConnection,
    exercise: &Exercise,
    reviewer_user_exercise_state: &UserExerciseState,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<CourseMaterialPeerOrSelfReviewData> {
    let peer_or_self_review_config = peer_or_self_review_configs::get_by_exercise_or_course_id(
        conn,
        exercise,
        exercise.get_course_id()?,
    )
    .await?;
    let course_instance_id = reviewer_user_exercise_state.get_course_instance_id()?;
    let exercise_slide_submission =
        exercise_slide_submissions::get_users_latest_exercise_slide_submission(
            conn,
            reviewer_user_exercise_state.get_selected_exercise_slide_id()?,
            reviewer_user_exercise_state.user_id,
        )
        .await?;
    let data = get_course_material_peer_or_self_review_data(
        conn,
        &peer_or_self_review_config,
        &Some(exercise_slide_submission),
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
    const MAX_ATTEMPTS: u32 = 10;
    let mut attempts = 0;

    // Loop until we either find a non deleted submission or we find no submission at all
    while attempts < MAX_ATTEMPTS {
        attempts += 1;
        let maybe_submission = try_to_select_peer_review_candidate_from_queue_impl(
            conn,
            exercise_id,
            excluded_user_id,
            excluded_exercise_slide_submission_ids,
        )
        .await?;

        if let Some((ess_id, selected_submission_needs_peer_review)) = maybe_submission {
            if excluded_exercise_slide_submission_ids.contains(&ess_id) {
                warn!(exercise_slide_submission_id = %ess_id, "Selected exercise slide submission that should have been excluded from the selection process. Trying again.");
                continue;
            }

            let ess = exercise_slide_submissions::get_by_id(conn, ess_id)
                .await
                .optional()?;
            if let Some(ess) = ess {
                // Peer reviewing only works if there is a course_id and a course instance id in it.
                if ess.course_id.is_none() || ess.course_instance_id.is_none() {
                    warn!(exercise_slide_submission_id = %ess_id, "Selected exercise slide submission that doesn't have a course_id or course_instance_id. Skipping it.");
                    continue;
                };
                if ess.deleted_at.is_none() {
                    // Double check that the submission has not been removed from the queue.
                    let peer_review_queue_entry = peer_review_queue_entries::get_by_receiving_peer_reviews_exercise_slide_submission_id(conn, ess_id).await?;
                    // If we have selected a submission outside of the peer review queue, there is no need for double checking.
                    if !selected_submission_needs_peer_review {
                        return Ok(Some(ess));
                    }
                    if peer_review_queue_entry.deleted_at.is_none()
                        && !peer_review_queue_entry.removed_from_queue_for_unusual_reason
                    {
                        return Ok(Some(ess));
                    } else {
                        if attempts == MAX_ATTEMPTS {
                            warn!(exercise_slide_submission_id = %ess_id, deleted_at = ?peer_review_queue_entry.deleted_at, removed_from_queue = %peer_review_queue_entry.removed_from_queue_for_unusual_reason, "Max attempts reached, returning submission despite being removed from queue");
                            return Ok(Some(ess));
                        }
                        warn!(exercise_slide_submission_id = %ess_id, deleted_at = ?peer_review_queue_entry.deleted_at, removed_from_queue = %peer_review_queue_entry.removed_from_queue_for_unusual_reason, "Selected exercise slide submission that was removed from the peer review queue. Trying again.");
                        continue;
                    }
                }
            } else {
                // We found a submission from the peer reveiw queue but the submission was deleted. This is unfortunate since if
                // the submission was deleted the peer review queue entry should have been deleted too. We can try to fix the situation somehow.
                warn!(exercise_slide_submission_id = %ess_id, "Selected exercise slide submission that was deleted. The peer review queue entry should've been deleted too! Deleting it now.");
                peer_review_queue_entries::delete_by_receiving_peer_reviews_exercise_slide_submission_id(
                    conn, ess_id,
                ).await?;
                info!("Deleting done, trying to select a new peer review candidate");
            }
        } else {
            // We didn't manage to select a candidate from the queue
            return Ok(None);
        }
    }

    warn!("Maximum attempts ({MAX_ATTEMPTS}) reached without finding a valid submission");
    Ok(None)
}

/// Returns a tuple of the exercise slide submission id and a boolean indicating if the submission needs peer review.
async fn try_to_select_peer_review_candidate_from_queue_impl(
    conn: &mut PgConnection,
    exercise_id: Uuid,
    excluded_user_id: Uuid,
    excluded_exercise_slide_submission_ids: &[Uuid],
) -> ModelResult<Option<(Uuid, bool)>> {
    let mut rng = rng();
    // Try to get a candidate that needs reviews from queue.
    let mut candidates = peer_review_queue_entries::get_many_that_need_peer_reviews_by_exercise_id_and_review_priority(conn,
        exercise_id,
        excluded_user_id,
        excluded_exercise_slide_submission_ids,
        MAX_PEER_REVIEW_CANDIDATES,
    ).await?;
    candidates.shuffle(&mut rng);
    match candidates.into_iter().next() {
        Some(candidate) => Ok(Some((
            candidate.receiving_peer_reviews_exercise_slide_submission_id,
            true,
        ))),
        None => {
            // Try again for any queue entry.
            let mut candidates = peer_review_queue_entries::get_any_including_not_needing_review(
                conn,
                exercise_id,
                excluded_user_id,
                excluded_exercise_slide_submission_ids,
                MAX_PEER_REVIEW_CANDIDATES,
            )
            .await?;
            candidates.shuffle(&mut rng);
            Ok(candidates.into_iter().next().map(|entry| {
                (
                    entry.receiving_peer_reviews_exercise_slide_submission_id,
                    false,
                )
            }))
        }
    }
}

async fn get_course_material_peer_or_self_review_data(
    conn: &mut PgConnection,
    peer_or_self_review_config: &PeerOrSelfReviewConfig,
    exercise_slide_submission: &Option<ExerciseSlideSubmission>,
    reviewer_user_id: Uuid,
    reviewer_course_instance_id: Uuid,
    exercise_id: Uuid,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<CourseMaterialPeerOrSelfReviewData> {
    let peer_or_self_review_questions =
        peer_or_self_review_questions::get_all_by_peer_or_self_review_config_id(
            conn,
            peer_or_self_review_config.id,
        )
        .await?;
    let num_peer_reviews_given =
        peer_or_self_review_submissions::get_num_peer_reviews_given_by_user_and_course_instance_and_exercise(
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
                 fetch_service_info,
                 false
            ).await?;
            Some(CourseMaterialPeerOrSelfReviewDataAnswerToReview {
                exercise_slide_submission_id,
                course_material_exercise_tasks,
            })
        }
        None => None,
    };

    Ok(CourseMaterialPeerOrSelfReviewData {
        answer_to_review,
        peer_or_self_review_config: peer_or_self_review_config.clone(),
        peer_or_self_review_questions,
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
        let peer_or_self_review_config = peer_or_self_review_configs::get_by_exercise_or_course_id(
            &mut tx, &exercise, course_id,
        )
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
                &peer_or_self_review_config,
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

    mod validate_peer_or_self_review_submissions_answers {
        use chrono::TimeZone;

        use crate::peer_or_self_review_questions::PeerOrSelfReviewQuestionType;

        use super::*;

        #[test]
        fn accepts_valid_answers() {
            let peer_or_self_review_config_id =
                Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let question_id = Uuid::parse_str("68d5cda3-6ad8-464b-9af1-bd1692fcbee1").unwrap();
            let questions = HashMap::from([(
                question_id,
                create_peer_review_question(question_id, peer_or_self_review_config_id, true)
                    .unwrap(),
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
            let peer_or_self_review_config_id =
                Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let questions = HashMap::new();
            let answers = vec![create_peer_review_answer(peer_or_self_review_config_id)];
            assert_eq!(
                validate_and_sanitize_peer_review_submission_answers(questions, answers)
                    .unwrap()
                    .len(),
                0
            );
        }

        #[test]
        fn errors_on_missing_required_answers() {
            let peer_or_self_review_config_id =
                Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let question_id = Uuid::parse_str("68d5cda3-6ad8-464b-9af1-bd1692fcbee1").unwrap();
            let questions = HashMap::from([(
                question_id,
                create_peer_review_question(question_id, peer_or_self_review_config_id, true)
                    .unwrap(),
            )]);
            assert!(
                validate_and_sanitize_peer_review_submission_answers(questions, vec![]).is_err()
            )
        }

        fn create_peer_review_question(
            id: Uuid,
            peer_or_self_review_config_id: Uuid,
            answer_required: bool,
        ) -> ModelResult<PeerOrSelfReviewQuestion> {
            Ok(PeerOrSelfReviewQuestion {
                id,
                created_at: Utc.with_ymd_and_hms(2022, 1, 1, 0, 0, 0).unwrap(),
                updated_at: Utc.with_ymd_and_hms(2022, 1, 1, 0, 0, 0).unwrap(),
                deleted_at: None,
                peer_or_self_review_config_id,
                order_number: 0,
                question: "".to_string(),
                question_type: PeerOrSelfReviewQuestionType::Essay,
                answer_required,
                weight: 0.0,
            })
        }

        fn create_peer_review_answer(
            peer_or_self_review_question_id: Uuid,
        ) -> CourseMaterialPeerOrSelfReviewQuestionAnswer {
            CourseMaterialPeerOrSelfReviewQuestionAnswer {
                peer_or_self_review_question_id,
                text_data: Some("".to_string()),
                number_data: None,
            }
        }
    }
}
