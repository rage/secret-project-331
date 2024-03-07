use headless_lms_utils::numbers::f32_to_two_decimals;
use itertools::Itertools;

use crate::{
    exercises::{ActivityProgress, GradingProgress},
    library::user_exercise_state_updater::validation::validate_input,
    peer_review_configs::PeerReviewProcessingStrategy,
    peer_review_question_submissions::PeerReviewQuestionSubmission,
    peer_review_questions::{PeerReviewQuestion, PeerReviewQuestionType},
    prelude::*,
    user_exercise_states::{ReviewingStage, UserExerciseStateUpdate},
};

use super::UserExerciseStateUpdateRequiredData;

/// What the peer review thinks the state should be changed to
struct PeerReviewOpinion {
    score_given: Option<f32>,
    reviewing_stage: ReviewingStage,
}

pub(super) fn derive_new_user_exercise_state(
    input_data: UserExerciseStateUpdateRequiredData,
) -> ModelResult<UserExerciseStateUpdate> {
    info!("Deriving new user_exercise_state");

    validate_input(&input_data)?;

    let peer_review_opinion = get_peer_review_opinion(&input_data);
    let new_reviewing_stage = derive_new_reviewing_stage(&input_data, &peer_review_opinion);
    let reviewing_stage_changed =
        input_data.current_user_exercise_state.reviewing_stage != new_reviewing_stage;

    if reviewing_stage_changed {
        info!(
            "UserExerciseState {} changed reviewing_stage from {:?} to {:?}",
            input_data.current_user_exercise_state.id,
            input_data.current_user_exercise_state,
            new_reviewing_stage
        );
    }

    let new_score_given =
        derive_new_score_given(&input_data, &new_reviewing_stage, &peer_review_opinion)
            .map(f32_to_two_decimals);

    if input_data.current_user_exercise_state.score_given != new_score_given {
        info!(
            "UserExerciseState {} changed score_given from {:?} to {:?}",
            input_data.current_user_exercise_state.id,
            input_data.current_user_exercise_state.score_given,
            new_score_given
        );
    }

    let new_activity_progress = derive_new_activity_progress(&input_data, &new_reviewing_stage);

    if input_data.current_user_exercise_state.activity_progress != new_activity_progress {
        info!(
            "UserExerciseState {} changed activity_progress from {:?} to {:?}",
            input_data.current_user_exercise_state.id,
            input_data.current_user_exercise_state.activity_progress,
            new_activity_progress
        );
    }

    let new_grading_progress = input_data
        .user_exercise_slide_state_grading_summary
        .grading_progress;

    if input_data.current_user_exercise_state.grading_progress != new_grading_progress {
        info!(
            "UserExerciseState {} changed grading_progress from {:?} to {:?}",
            input_data.current_user_exercise_state.id,
            input_data.current_user_exercise_state.grading_progress,
            new_grading_progress
        );
    }

    Ok(UserExerciseStateUpdate {
        id: input_data.current_user_exercise_state.id,
        score_given: new_score_given,
        activity_progress: new_activity_progress,
        reviewing_stage: new_reviewing_stage,
        grading_progress: new_grading_progress,
    })
}

fn derive_new_activity_progress(
    input_data: &UserExerciseStateUpdateRequiredData,
    new_reviewing_stage: &ReviewingStage,
) -> ActivityProgress {
    let slide_grading_progress = input_data
        .user_exercise_slide_state_grading_summary
        .grading_progress;
    // If no peer review or no self review are needed, the activity is completed as soon as the user has submitted the exercise
    if !input_data.exercise.needs_peer_review {
        if slide_grading_progress == GradingProgress::NotReady {
            // The user has not subitted the exercise
            return ActivityProgress::Initialized;
        }
        // The user has submitted the exercise
        return ActivityProgress::Completed;
    };
    // The exercise needs peer review the activity is complete once the user has done everything they have to do
    if new_reviewing_stage == &ReviewingStage::NotStarted {
        if slide_grading_progress == GradingProgress::NotReady {
            // The user has not subitted the exercise
            return ActivityProgress::Initialized;
        }
        // The user has submitted the exercise
        return ActivityProgress::InProgress;
    }
    if new_reviewing_stage == &ReviewingStage::PeerReview
        || new_reviewing_stage == &ReviewingStage::SelfReview
    {
        // The student still has to give more reviews -- their activity is not complete yet.
        return ActivityProgress::InProgress;
    };

    ActivityProgress::Completed
}

fn derive_new_score_given(
    input_data: &UserExerciseStateUpdateRequiredData,
    new_reviewing_stage: &ReviewingStage,
    peer_review_opinion: &Option<PeerReviewOpinion>,
) -> Option<f32> {
    // Teacher grading decisions always override everything else
    if let Some(teacher_grading_decision) = &input_data.latest_teacher_grading_decision {
        return Some(teacher_grading_decision.score_given);
    };
    // We want to give or remove points only when the peer review/self review completes. If the answer receives reviews after this, we won't take away or we won't give more points.
    // If would be confusing for the student if we afterwards changed the peer review outcome due to an additional review. That's why we haved the locked state. If the state is and stays locked, the score won't be changed.
    if input_data.current_user_exercise_state.reviewing_stage == ReviewingStage::ReviewedAndLocked
        && new_reviewing_stage == &ReviewingStage::ReviewedAndLocked
        && input_data.current_user_exercise_state.score_given.is_some()
    {
        return input_data.current_user_exercise_state.score_given;
    }
    if let Some(peer_review_opinion) = peer_review_opinion {
        if input_data.exercise.needs_peer_review {
            return peer_review_opinion.score_given;
        }
    }
    // Peer reviews are not enabled, we'll just give the points according to the automated grading
    // No need to consider the UserPointsUpdateStrategy here because it's already used when updating the user_exercise_slide_state. The user_exercise_state is just taking its data from there (and other sources).
    input_data
        .user_exercise_slide_state_grading_summary
        .score_given
}

fn derive_new_reviewing_stage(
    input_data: &UserExerciseStateUpdateRequiredData,
    peer_review_opinion: &Option<PeerReviewOpinion>,
) -> ReviewingStage {
    // Teacher grading decisions always override everything else
    if let Some(_teacher_grading_decision) = &input_data.latest_teacher_grading_decision {
        return ReviewingStage::ReviewedAndLocked;
    };
    let user_exercise_state = &input_data.current_user_exercise_state;
    if input_data.exercise.needs_peer_review {
        return peer_review_opinion
            .as_ref()
            .map(|o| o.reviewing_stage)
            .unwrap_or_else(|| input_data.current_user_exercise_state.reviewing_stage);
    } else {
        // Valid states for exercises without peer review are `ReviewingStage::NotStarted` or `ReviewingStage::ReviewedAndLocked`.
        // If the state is one of those, we'll keep it but if the state is something not allowed, we'll reset it to the default.
        // Most states need to stay in the ReviewingStage::NotStarted stage
        if user_exercise_state.reviewing_stage == ReviewingStage::NotStarted
            || user_exercise_state.reviewing_stage == ReviewingStage::ReviewedAndLocked
        {
            user_exercise_state.reviewing_stage
        } else {
            warn!(reviewing_stage = ?user_exercise_state.reviewing_stage, "Reviewing stage was in invalid state for an exercise without peer review. Resetting to ReviewingStage::NotStarted.");
            ReviewingStage::NotStarted
        }
    }
}

#[instrument(skip(input_data))]
fn get_peer_review_opinion(
    input_data: &UserExerciseStateUpdateRequiredData,
) -> Option<PeerReviewOpinion> {
    if !input_data.exercise.needs_peer_review {
        // Peer review is not enabled, no opinion
        return None;
    }

    let score_maximum = input_data.exercise.score_maximum;
    if let Some(info) = &input_data.peer_review_information {
        let given_enough_peer_reviews = info.given_peer_review_submissions.len() as i32
            >= info.peer_review_config.peer_reviews_to_give;
        // Received enough peer reviews is cached to the queue entry, lets use it here to make sure its value has been kept up-to-date.
        let received_enough_peer_reviews = info
            .peer_review_queue_entry
            .as_ref()
            .map(|o| o.received_enough_peer_reviews)
            .unwrap_or(false);

        if !given_enough_peer_reviews {
            // Keeps the state in Intialized or PeerReview
            return Some(PeerReviewOpinion {
                score_given: None,
                reviewing_stage: input_data.current_user_exercise_state.reviewing_stage,
            });
        } else if !received_enough_peer_reviews {
            // Has given enough but has not received enough: the student has to wait until others have reviewed their answer more

            // Handle the case where the answer is waiting for manual review but is still receiving peer reviews
            if input_data.current_user_exercise_state.reviewing_stage
                == ReviewingStage::WaitingForManualGrading
            {
                return Some(PeerReviewOpinion {
                    score_given: None,
                    reviewing_stage: ReviewingStage::WaitingForManualGrading,
                });
            }

            return Some(PeerReviewOpinion {
                score_given: None,
                reviewing_stage: ReviewingStage::WaitingForPeerReviews,
            });
        }

        // Users have given and received enough peer reviews, time to consider how we're doing the grading
        match info.peer_review_config.processing_strategy {
            PeerReviewProcessingStrategy::AutomaticallyGradeByAverage => {
                let avg = calculate_average_received_peer_review_score(
                    &info
                        .latest_exercise_slide_submission_received_peer_review_question_submissions,
                );
                if !info.peer_review_config.points_are_all_or_nothing {
                    let score_given = calculate_peer_review_weighted_points(
                        &info.peer_review_questions,
                        &info
                            .latest_exercise_slide_submission_received_peer_review_question_submissions,
                        score_maximum,
                    );
                    Some(PeerReviewOpinion {
                        score_given: Some(score_given),
                        reviewing_stage: ReviewingStage::ReviewedAndLocked,
                    })
                } else if avg < info.peer_review_config.accepting_threshold {
                    info!(avg = ?avg, threshold = ?info.peer_review_config.accepting_threshold, peer_review_processing_strategy = ?info.peer_review_config.processing_strategy, "Automatically giving zero points because average is below the threshold");
                    Some(PeerReviewOpinion {
                        score_given: Some(0.0),
                        reviewing_stage: ReviewingStage::ReviewedAndLocked,
                    })
                } else {
                    info!(avg = ?avg, threshold = ?info.peer_review_config.accepting_threshold, peer_review_processing_strategy = ?info.peer_review_config.processing_strategy, "Automatically giving the points since the average is above the threshold");
                    Some(PeerReviewOpinion {
                        score_given: Some(score_maximum as f32),
                        reviewing_stage: ReviewingStage::ReviewedAndLocked,
                    })
                }
            }
            PeerReviewProcessingStrategy::AutomaticallyGradeOrManualReviewByAverage => {
                let avg = calculate_average_received_peer_review_score(
                    &info
                        .latest_exercise_slide_submission_received_peer_review_question_submissions,
                );
                if avg < info.peer_review_config.accepting_threshold {
                    info!(avg = ?avg, threshold = ?info.peer_review_config.accepting_threshold, peer_review_processing_strategy = ?info.peer_review_config.processing_strategy, "Not giving points because average is below the threshold. The answer should be moved to manual review.");
                    Some(PeerReviewOpinion {
                        score_given: None,
                        reviewing_stage: ReviewingStage::WaitingForManualGrading,
                    })
                } else if !info.peer_review_config.points_are_all_or_nothing {
                    let score_given = calculate_peer_review_weighted_points(
                        &info.peer_review_questions,
                        &info
                            .latest_exercise_slide_submission_received_peer_review_question_submissions,
                        score_maximum,
                    );
                    Some(PeerReviewOpinion {
                        score_given: Some(score_given),
                        reviewing_stage: ReviewingStage::ReviewedAndLocked,
                    })
                } else {
                    info!(avg = ?avg, threshold = ?info.peer_review_config.accepting_threshold, peer_review_processing_strategy = ?info.peer_review_config.processing_strategy, "Automatically giving the points since the average is above the threshold");
                    Some(PeerReviewOpinion {
                        score_given: Some(score_maximum as f32),
                        reviewing_stage: ReviewingStage::ReviewedAndLocked,
                    })
                }
            }
            PeerReviewProcessingStrategy::ManualReviewEverything => {
                info!(peer_review_processing_strategy = ?info.peer_review_config.processing_strategy, "Not giving points because the teacher reviews all answers manually");
                Some(PeerReviewOpinion {
                    score_given: None,
                    reviewing_stage: ReviewingStage::WaitingForManualGrading,
                })
            }
        }
    } else {
        // Even though the exercise needs peer review, the peer review has not been configured. The safest thing to do here is to consider peer review as not complete
        warn!("Peer review is enabled in the exercise but no peer_review_config found");
        None
    }
}

fn calculate_average_received_peer_review_score(
    peer_review_question_submissions: &[PeerReviewQuestionSubmission],
) -> f32 {
    let answers_considered = peer_review_question_submissions
        .iter()
        .filter_map(|prqs| {
            if prqs.deleted_at.is_some() {
                return None;
            }
            prqs.number_data
        })
        .collect::<Vec<_>>();
    if answers_considered.is_empty() {
        warn!("No peer review question submissions for this answer with number data. Assuming score is 0.");
        return 0.0;
    }
    answers_considered.iter().sum::<f32>() / answers_considered.len() as f32
}

fn calculate_peer_review_weighted_points(
    peer_review_questions: &[PeerReviewQuestion],
    received_peer_review_question_submissions: &[PeerReviewQuestionSubmission],
    score_maximum: i32,
) -> f32 {
    // Weights should be sum to 1. This should be guranteed by the data loader.
    let questions_considered_for_weighted_points = peer_review_questions
        .iter()
        .filter(|prq| prq.question_type == PeerReviewQuestionType::Scale)
        .collect::<Vec<_>>();
    let question_submissions_considered_for_weighted_points =
        received_peer_review_question_submissions
            .iter()
            .filter(|prqs| {
                questions_considered_for_weighted_points
                    .iter()
                    .any(|prq| prq.id == prqs.peer_review_question_id)
            })
            .collect::<Vec<_>>();
    let number_of_submissions = question_submissions_considered_for_weighted_points
        .iter()
        .map(|prqs| prqs.peer_review_submission_id)
        .unique()
        .count();
    let grouped = question_submissions_considered_for_weighted_points
        .iter()
        .group_by(|prqs| prqs.peer_review_submission_id);

    let weighted_score_by_submission = grouped
        .into_iter()
        .map(
            |(_peer_review_submission_id, peer_review_question_answers)| {
                peer_review_question_answers
                    .filter_map(|prqs| {
                        questions_considered_for_weighted_points
                            .iter()
                            .find(|prq| prq.id == prqs.peer_review_question_id)
                            .map(|question| question.weight * prqs.number_data.unwrap_or_default())
                    })
                    .sum::<f32>()
            },
        )
        .collect::<Vec<_>>();
    let average_weighted_score =
        weighted_score_by_submission.iter().sum::<f32>() / number_of_submissions as f32;
    info!(
        "Average weighted score is {} ({:?})",
        average_weighted_score, weighted_score_by_submission
    );
    // Always 5 because the students answer from 1-5.
    let number_of_answer_options = 5.0;

    average_weighted_score / number_of_answer_options * score_maximum as f32
}

#[cfg(test)]
mod tests {
    use super::*;

    mod derive_new_user_exercise_state {
        use chrono::TimeZone;

        use crate::{
            exercises::Exercise,
            library::user_exercise_state_updater::UserExerciseStateUpdateRequiredDataPeerReviewInformation,
            peer_review_configs::PeerReviewConfig, peer_review_queue_entries::PeerReviewQueueEntry,
            peer_review_submissions::PeerReviewSubmission,
            user_exercise_slide_states::UserExerciseSlideStateGradingSummary,
            user_exercise_states::UserExerciseState,
        };

        use super::*;

        #[test]
        fn updates_state_for_normal_exercise() {
            let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let exercise = create_exercise(CourseOrExamId::Course(id), false, false);
            let user_exercise_state = create_user_exercise_state(
                &exercise,
                None,
                ActivityProgress::Initialized,
                ReviewingStage::NotStarted,
            );
            let new_user_exercise_state =
                derive_new_user_exercise_state(UserExerciseStateUpdateRequiredData {
                    exercise,
                    current_user_exercise_state: user_exercise_state,
                    peer_review_information: None,
                    latest_teacher_grading_decision: None,
                    user_exercise_slide_state_grading_summary:
                        UserExerciseSlideStateGradingSummary {
                            score_given: Some(1.0),
                            grading_progress: GradingProgress::FullyGraded,
                        },
                })
                .unwrap();
            assert_results(
                &new_user_exercise_state,
                Some(1.0),
                ActivityProgress::Completed,
                // Exercises that don't have peer review new leave the not started stage
                ReviewingStage::NotStarted,
            );
        }

        #[test]
        fn doesnt_update_score_for_exercise_that_needs_to_be_peer_reviewed() {
            let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let exercise = create_exercise(CourseOrExamId::Course(id), true, true);
            let user_exercise_state = create_user_exercise_state(
                &exercise,
                None,
                ActivityProgress::Initialized,
                ReviewingStage::NotStarted,
            );
            let new_user_exercise_state =
                derive_new_user_exercise_state(UserExerciseStateUpdateRequiredData {
                    exercise,
                    current_user_exercise_state: user_exercise_state,
                    peer_review_information: Some(
                        UserExerciseStateUpdateRequiredDataPeerReviewInformation {
                            given_peer_review_submissions: Vec::new(), latest_exercise_slide_submission_received_peer_review_question_submissions: Vec::new(), peer_review_queue_entry: None,
                            peer_review_config: create_peer_review_config(PeerReviewProcessingStrategy::AutomaticallyGradeByAverage),
                            peer_review_questions: Vec::new(),
                        },
                    ),
                    latest_teacher_grading_decision: None,
                    user_exercise_slide_state_grading_summary:
                        UserExerciseSlideStateGradingSummary {
                            score_given: Some(1.0),
                            grading_progress: GradingProgress::FullyGraded,
                        },
                })
                .unwrap();
            assert_results(
                &new_user_exercise_state,
                None,
                ActivityProgress::InProgress,
                ReviewingStage::NotStarted,
            );
        }

        mod automatically_accept_or_reject_by_average {
            use super::*;

            #[test]
            fn peer_review_automatically_accept_or_reject_by_average_works_gives_full_points() {
                let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
                let exercise = create_exercise(CourseOrExamId::Course(id), true, true);
                let user_exercise_state = create_user_exercise_state(
                    &exercise,
                    None,
                    ActivityProgress::Initialized,
                    ReviewingStage::NotStarted,
                );
                let new_user_exercise_state =
                    derive_new_user_exercise_state(UserExerciseStateUpdateRequiredData {
                        exercise,
                        current_user_exercise_state: user_exercise_state,
                        peer_review_information: Some(
                            UserExerciseStateUpdateRequiredDataPeerReviewInformation {
                                given_peer_review_submissions: vec![create_peer_review_submission(), create_peer_review_submission(), create_peer_review_submission()],
                                latest_exercise_slide_submission_received_peer_review_question_submissions: vec![create_peer_review_question_submission(4.0), create_peer_review_question_submission(3.0), create_peer_review_question_submission(4.0)],
                                peer_review_queue_entry: Some(create_peer_review_queue_entry()),
                                peer_review_config: create_peer_review_config(PeerReviewProcessingStrategy::AutomaticallyGradeByAverage),
                                peer_review_questions: Vec::new(),
                            },
                        ),
                        latest_teacher_grading_decision: None,
                        user_exercise_slide_state_grading_summary:
                            UserExerciseSlideStateGradingSummary {
                                score_given: Some(1.0),
                                grading_progress: GradingProgress::FullyGraded,
                            },
                    })
                    .unwrap();
                assert_results(
                    &new_user_exercise_state,
                    // The user passed peer review, so they deserve full points from the exercise
                    Some(9000.0),
                    ActivityProgress::Completed,
                    ReviewingStage::ReviewedAndLocked,
                );
            }

            #[test]
            fn peer_review_automatically_accept_or_reject_by_average_works_gives_zero_points() {
                let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
                let exercise = create_exercise(CourseOrExamId::Course(id), true, true);
                let user_exercise_state = create_user_exercise_state(
                    &exercise,
                    None,
                    ActivityProgress::Initialized,
                    ReviewingStage::NotStarted,
                );
                let new_user_exercise_state =
                    derive_new_user_exercise_state(UserExerciseStateUpdateRequiredData {
                        exercise,
                        current_user_exercise_state: user_exercise_state,
                        peer_review_information: Some(
                            UserExerciseStateUpdateRequiredDataPeerReviewInformation {
                                given_peer_review_submissions: vec![create_peer_review_submission(), create_peer_review_submission(), create_peer_review_submission()],
                                // Average below 2.1
                                latest_exercise_slide_submission_received_peer_review_question_submissions: vec![create_peer_review_question_submission(3.0), create_peer_review_question_submission(1.0), create_peer_review_question_submission(1.0)],
                                peer_review_queue_entry: Some(create_peer_review_queue_entry()),
                                peer_review_config: create_peer_review_config(PeerReviewProcessingStrategy::AutomaticallyGradeByAverage),
                                peer_review_questions: Vec::new(),
                            },
                        ),
                        latest_teacher_grading_decision: None,
                        user_exercise_slide_state_grading_summary:
                            UserExerciseSlideStateGradingSummary {
                                score_given: Some(1.0),
                                grading_progress: GradingProgress::FullyGraded,
                            },
                    })
                    .unwrap();
                assert_results(
                    &new_user_exercise_state,
                    // The user failed peer review, so they get zero points
                    Some(0.0),
                    ActivityProgress::Completed,
                    ReviewingStage::ReviewedAndLocked,
                );
            }
        }

        mod automatically_accept_or_manual_review_by_average {
            use super::*;

            #[test]
            fn peer_review_automatically_accept_or_manual_review_by_average_works_gives_full_points(
            ) {
                let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
                let exercise = create_exercise(CourseOrExamId::Course(id), true, true);
                let user_exercise_state = create_user_exercise_state(
                    &exercise,
                    None,
                    ActivityProgress::Initialized,
                    ReviewingStage::NotStarted,
                );
                let new_user_exercise_state =
                    derive_new_user_exercise_state(UserExerciseStateUpdateRequiredData {
                        exercise,
                        current_user_exercise_state: user_exercise_state,
                        peer_review_information: Some(
                            UserExerciseStateUpdateRequiredDataPeerReviewInformation {
                                given_peer_review_submissions: vec![create_peer_review_submission(), create_peer_review_submission(), create_peer_review_submission()],
                                latest_exercise_slide_submission_received_peer_review_question_submissions: vec![create_peer_review_question_submission(4.0), create_peer_review_question_submission(3.0), create_peer_review_question_submission(4.0)],
                                peer_review_queue_entry: Some(create_peer_review_queue_entry()),
                                peer_review_config: create_peer_review_config(PeerReviewProcessingStrategy::AutomaticallyGradeOrManualReviewByAverage),
                                peer_review_questions: Vec::new(),
                            },
                        ),
                        latest_teacher_grading_decision: None,
                        user_exercise_slide_state_grading_summary:
                            UserExerciseSlideStateGradingSummary {
                                score_given: Some(1.0),
                                grading_progress: GradingProgress::FullyGraded,
                            },
                    })
                    .unwrap();
                assert_results(
                    &new_user_exercise_state,
                    // The user passed peer review, so they deserve full points from the exercise
                    Some(9000.0),
                    ActivityProgress::Completed,
                    ReviewingStage::ReviewedAndLocked,
                );
            }

            #[test]
            fn peer_review_automatically_accept_or_manual_review_by_average_works_puts_the_answer_to_manual_review(
            ) {
                let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
                let exercise = create_exercise(CourseOrExamId::Course(id), true, true);
                let user_exercise_state = create_user_exercise_state(
                    &exercise,
                    None,
                    ActivityProgress::Initialized,
                    ReviewingStage::NotStarted,
                );
                let new_user_exercise_state =
                    derive_new_user_exercise_state(UserExerciseStateUpdateRequiredData {
                        exercise,
                        current_user_exercise_state: user_exercise_state,
                        peer_review_information: Some(
                            UserExerciseStateUpdateRequiredDataPeerReviewInformation {
                                given_peer_review_submissions: vec![create_peer_review_submission(), create_peer_review_submission(), create_peer_review_submission()],
                                // Average below 2.1
                                latest_exercise_slide_submission_received_peer_review_question_submissions: vec![create_peer_review_question_submission(3.0), create_peer_review_question_submission(1.0), create_peer_review_question_submission(1.0)],
                                peer_review_queue_entry: Some(create_peer_review_queue_entry()),
                                peer_review_config: create_peer_review_config(PeerReviewProcessingStrategy::AutomaticallyGradeOrManualReviewByAverage),
                                peer_review_questions: Vec::new(),
                            },
                        ),
                        latest_teacher_grading_decision: None,
                        user_exercise_slide_state_grading_summary:
                            UserExerciseSlideStateGradingSummary {
                                score_given: Some(1.0),
                                grading_progress: GradingProgress::FullyGraded,
                            },
                    })
                    .unwrap();
                assert_results(
                    &new_user_exercise_state,
                    // Manual review, we won't give any points because the points are up to the teacher's descision in the review
                    None,
                    ActivityProgress::Completed,
                    ReviewingStage::WaitingForManualGrading,
                );
            }
        }

        mod manual_review_everything {
            use super::*;

            #[test]
            fn peer_review_manual_review_everything_works_does_not_give_full_points_to_passing_answer_and_puts_to_manual_review(
            ) {
                let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
                let exercise = create_exercise(CourseOrExamId::Course(id), true, true);
                let user_exercise_state = create_user_exercise_state(
                    &exercise,
                    None,
                    ActivityProgress::Initialized,
                    ReviewingStage::NotStarted,
                );
                let new_user_exercise_state =
                    derive_new_user_exercise_state(UserExerciseStateUpdateRequiredData {
                        exercise,
                        current_user_exercise_state: user_exercise_state,
                        peer_review_information: Some(
                            UserExerciseStateUpdateRequiredDataPeerReviewInformation {
                                given_peer_review_submissions: vec![create_peer_review_submission(), create_peer_review_submission(), create_peer_review_submission()],
                                latest_exercise_slide_submission_received_peer_review_question_submissions: vec![create_peer_review_question_submission(4.0), create_peer_review_question_submission(3.0), create_peer_review_question_submission(4.0)],
                                peer_review_queue_entry: Some(create_peer_review_queue_entry()),
                                peer_review_config: create_peer_review_config(PeerReviewProcessingStrategy::ManualReviewEverything),
                                peer_review_questions: Vec::new(),
                            },
                        ),
                        latest_teacher_grading_decision: None,
                        user_exercise_slide_state_grading_summary:
                            UserExerciseSlideStateGradingSummary {
                                score_given: Some(1.0),
                                grading_progress: GradingProgress::FullyGraded,
                            },
                    })
                    .unwrap();
                assert_results(
                    &new_user_exercise_state,
                    // Score will be given from the manual review
                    None,
                    ActivityProgress::Completed,
                    ReviewingStage::WaitingForManualGrading,
                );
            }

            #[test]
            fn peer_review_manual_review_everything_works_puts_failing_answer_the_answer_to_manual_review(
            ) {
                let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
                let exercise = create_exercise(CourseOrExamId::Course(id), true, true);
                let user_exercise_state = create_user_exercise_state(
                    &exercise,
                    None,
                    ActivityProgress::Initialized,
                    ReviewingStage::NotStarted,
                );
                let new_user_exercise_state =
                    derive_new_user_exercise_state(UserExerciseStateUpdateRequiredData {
                        exercise,
                        current_user_exercise_state: user_exercise_state,
                        peer_review_information: Some(
                            UserExerciseStateUpdateRequiredDataPeerReviewInformation {
                                given_peer_review_submissions: vec![create_peer_review_submission(), create_peer_review_submission(), create_peer_review_submission()],
                                // Average below 2.1
                                latest_exercise_slide_submission_received_peer_review_question_submissions: vec![create_peer_review_question_submission(3.0), create_peer_review_question_submission(1.0), create_peer_review_question_submission(1.0)],
                                peer_review_queue_entry: Some(create_peer_review_queue_entry()),
                                peer_review_config: create_peer_review_config(PeerReviewProcessingStrategy::ManualReviewEverything),
                                peer_review_questions: Vec::new(),
                            },
                        ),
                        latest_teacher_grading_decision: None,
                        user_exercise_slide_state_grading_summary:
                            UserExerciseSlideStateGradingSummary {
                                score_given: Some(1.0),
                                grading_progress: GradingProgress::FullyGraded,
                            },
                    })
                    .unwrap();
                assert_results(
                    &new_user_exercise_state,
                    // Score will be given from the manual review
                    None,
                    ActivityProgress::Completed,
                    ReviewingStage::WaitingForManualGrading,
                );
            }
        }

        mod calculate_peer_review_weighted_points {
            use uuid::Uuid;

            use crate::library::user_exercise_state_updater::state_deriver::{
                calculate_peer_review_weighted_points,
                tests::derive_new_user_exercise_state::{
                    create_peer_review_question_essay, create_peer_review_question_scale,
                    create_peer_review_question_submission_with_ids,
                },
            };

            #[test]
            fn calculate_peer_review_weighted_points_works() {
                let q1_id = Uuid::parse_str("d42ecbc9-34ff-4549-aacf-1b8ac6e672c2").unwrap();
                let q2_id = Uuid::parse_str("1a018bb2-023f-4f58-b5f1-b09d58b42ed8").unwrap();
                let q3_id = Uuid::parse_str("9ab2df96-60a4-40c2-a097-900654f44700").unwrap();
                let q4_id = Uuid::parse_str("4bed2265-3c8f-4387-83e9-76e2b673eea3").unwrap();
                let e1_id = Uuid::parse_str("fd4e5f7e-e794-4993-954e-fbd2d8b04d6b").unwrap();

                let s1_id = Uuid::parse_str("2795b352-d5ef-41c7-92f7-a60d90c62c91").unwrap();
                let s2_id = Uuid::parse_str("e5c16a89-2a3f-4910-9b00-dd981cedcbcc").unwrap();
                let s3_id = Uuid::parse_str("462a6493-a506-42e6-869d-10220b2885b8").unwrap();

                let res = calculate_peer_review_weighted_points(
                    &vec![
                        create_peer_review_question_scale(q1_id, 0.25),
                        create_peer_review_question_scale(q2_id, 0.25),
                        create_peer_review_question_scale(q3_id, 0.25),
                        create_peer_review_question_scale(q4_id, 0.25),
                        // Extra one to check that ignoring questions works
                        create_peer_review_question_essay(e1_id, 0.25),
                    ],
                    &vec![
                        // First student
                        create_peer_review_question_submission_with_ids(5.0, q1_id, s1_id),
                        create_peer_review_question_submission_with_ids(4.0, q2_id, s1_id),
                        create_peer_review_question_submission_with_ids(5.0, q3_id, s1_id),
                        create_peer_review_question_submission_with_ids(5.0, q4_id, s1_id),
                        // Second student
                        create_peer_review_question_submission_with_ids(4.0, q1_id, s2_id),
                        create_peer_review_question_submission_with_ids(2.0, q2_id, s2_id),
                        create_peer_review_question_submission_with_ids(3.0, q3_id, s2_id),
                        create_peer_review_question_submission_with_ids(4.0, q4_id, s2_id),
                        // Third student
                        create_peer_review_question_submission_with_ids(3.0, q1_id, s3_id),
                        create_peer_review_question_submission_with_ids(2.0, q2_id, s3_id),
                        create_peer_review_question_submission_with_ids(4.0, q3_id, s3_id),
                        create_peer_review_question_submission_with_ids(4.0, q4_id, s3_id),
                        // Extra one to check that ignoring questions works
                        create_peer_review_question_submission_with_ids(3.0, e1_id, s3_id),
                    ],
                    4,
                );
                assert_eq!(res, 3.0);
            }
        }

        fn assert_results(
            update: &UserExerciseStateUpdate,
            score_given: Option<f32>,
            activity_progress: ActivityProgress,
            reviewing_stage: ReviewingStage,
        ) {
            assert_eq!(update.score_given, score_given);
            assert_eq!(update.activity_progress, activity_progress);
            assert_eq!(update.reviewing_stage, reviewing_stage);
        }

        fn create_exercise(
            course_or_exam_id: CourseOrExamId,
            needs_peer_review: bool,
            use_course_default_peer_review_config: bool,
        ) -> Exercise {
            let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            let (course_id, exam_id) = course_or_exam_id.to_course_and_exam_ids();
            Exercise {
                id,
                created_at: Utc.with_ymd_and_hms(2022, 1, 1, 0, 0, 0).unwrap(),
                updated_at: Utc.with_ymd_and_hms(2022, 1, 1, 0, 0, 0).unwrap(),
                name: "".to_string(),
                course_id,
                exam_id,
                page_id: id,
                chapter_id: None,
                deadline: None,
                deleted_at: None,
                score_maximum: 9000,
                order_number: 0,
                copied_from: None,
                max_tries_per_slide: None,
                limit_number_of_tries: false,
                needs_peer_review,
                use_course_default_peer_review_config,
                exercise_language_group_id: None,
                needs_self_review: false,
            }
        }

        fn create_peer_review_config(
            processing_strategy: PeerReviewProcessingStrategy,
        ) -> PeerReviewConfig {
            let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            PeerReviewConfig {
                id,
                created_at: Utc.with_ymd_and_hms(2022, 1, 1, 0, 0, 0).unwrap(),
                updated_at: Utc.with_ymd_and_hms(2022, 1, 1, 0, 0, 0).unwrap(),
                deleted_at: None,
                course_id: id,
                exercise_id: None,
                peer_reviews_to_give: 3,
                peer_reviews_to_receive: 2,
                accepting_threshold: 2.1,
                processing_strategy,
                manual_review_cutoff_in_days: 21,
                points_are_all_or_nothing: true,
                review_instructions: None,
            }
        }

        fn create_peer_review_question_submission(
            number_data: f32,
        ) -> PeerReviewQuestionSubmission {
            PeerReviewQuestionSubmission {
                id: Uuid::parse_str("bf923ea4-a637-4d97-b78b-6f843d76120a").unwrap(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
                deleted_at: None,
                peer_review_question_id: Uuid::parse_str("b853bbd7-feee-4447-ab14-c9622e565ea1")
                    .unwrap(),
                peer_review_submission_id: Uuid::parse_str("be4061b5-b468-4f50-93b0-cf3bf9de9a13")
                    .unwrap(),
                text_data: None,
                number_data: Some(number_data),
            }
        }

        fn create_peer_review_question_submission_with_ids(
            number_data: f32,
            peer_review_question_id: Uuid,
            peer_review_submission_id: Uuid,
        ) -> PeerReviewQuestionSubmission {
            PeerReviewQuestionSubmission {
                id: Uuid::parse_str("bf923ea4-a637-4d97-b78b-6f843d76120a").unwrap(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
                deleted_at: None,
                peer_review_question_id,
                peer_review_submission_id,
                text_data: None,
                number_data: Some(number_data),
            }
        }

        fn create_peer_review_question_scale(id: Uuid, weight: f32) -> PeerReviewQuestion {
            PeerReviewQuestion {
                id,
                weight,
                created_at: Utc::now(),
                updated_at: Utc::now(),
                deleted_at: None,
                peer_review_config_id: Uuid::parse_str("bf923ea4-a637-4d97-b78b-6f843d76120a")
                    .unwrap(),
                order_number: 1,
                question: "A question".to_string(),
                question_type: PeerReviewQuestionType::Scale,
                answer_required: true,
            }
        }

        fn create_peer_review_question_essay(id: Uuid, weight: f32) -> PeerReviewQuestion {
            PeerReviewQuestion {
                id,
                weight,
                created_at: Utc::now(),
                updated_at: Utc::now(),
                deleted_at: None,
                peer_review_config_id: Uuid::parse_str("bf923ea4-a637-4d97-b78b-6f843d76120a")
                    .unwrap(),
                order_number: 1,
                question: "A question".to_string(),
                question_type: PeerReviewQuestionType::Essay,
                answer_required: true,
            }
        }

        fn create_peer_review_submission() -> PeerReviewSubmission {
            let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            PeerReviewSubmission {
                id,
                created_at: Utc::now(),
                updated_at: Utc::now(),
                deleted_at: None,
                user_id: id,
                exercise_id: id,
                course_instance_id: id,
                peer_review_config_id: id,
                exercise_slide_submission_id: id,
            }
        }

        fn create_peer_review_queue_entry() -> PeerReviewQueueEntry {
            let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            PeerReviewQueueEntry {
                id,
                created_at: Utc::now(),
                updated_at: Utc::now(),
                deleted_at: None,
                user_id: id,
                exercise_id: id,
                course_instance_id: id,
                receiving_peer_reviews_exercise_slide_submission_id: id,
                received_enough_peer_reviews: true,
                peer_review_priority: 100,
                removed_from_queue_for_unusual_reason: false,
            }
        }

        fn create_user_exercise_state(
            exercise: &Exercise,
            score_given: Option<f32>,
            activity_progress: ActivityProgress,
            reviewing_stage: ReviewingStage,
        ) -> UserExerciseState {
            let id = Uuid::parse_str("5f464818-1e68-4839-ae86-850b310f508c").unwrap();
            UserExerciseState {
                id,
                user_id: id,
                exercise_id: exercise.id,
                course_instance_id: exercise.course_id,
                exam_id: exercise.exam_id,
                created_at: Utc.with_ymd_and_hms(2022, 1, 1, 0, 0, 0).unwrap(),
                updated_at: Utc.with_ymd_and_hms(2022, 1, 1, 0, 0, 0).unwrap(),
                deleted_at: None,
                score_given,
                grading_progress: GradingProgress::NotReady,
                activity_progress,
                reviewing_stage,
                selected_exercise_slide_id: None,
            }
        }
    }
}
