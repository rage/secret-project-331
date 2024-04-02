use crate::prelude::*;

use super::UserExerciseStateUpdateRequiredData;

/// Makes sure we don't do state updates with deleted data accidentally.
pub(super) fn validate_input(input_data: &UserExerciseStateUpdateRequiredData) -> ModelResult<()> {
    if input_data.current_user_exercise_state.deleted_at.is_some() {
        return Err(ModelError::new(
            ModelErrorType::Generic,
            "Attempted to update user_exercise_state with a deleted current user exercise state"
                .to_string(),
            None,
        ));
    }
    if let Some(peer_or_self_review_information) = &input_data.peer_or_self_review_information {
        if peer_or_self_review_information
            .given_peer_or_self_review_submissions
            .iter()
            .any(|prs| prs.deleted_at.is_some())
        {
            return Err(ModelError::new(
          ModelErrorType::Generic,
          "Attempted to update user_exercise_state with a deleted given peer review submission"
              .to_string(),
          None,
            ));
        }

        if peer_or_self_review_information
            .latest_exercise_slide_submission_received_peer_or_self_review_question_submissions
            .iter()
            .any(|prqs| prqs.deleted_at.is_some())
        {
            return Err(ModelError::new(
      ModelErrorType::Generic,
      "Attempted to update user_exercise_state with a deleted latest exercise slide submission received peer review question submission"
          .to_string(),
      None,
            ));
        }

        if let Some(peer_review_queue_entry) =
            &peer_or_self_review_information.peer_review_queue_entry
        {
            if peer_review_queue_entry.deleted_at.is_some() {
                return Err(ModelError::new(
              ModelErrorType::Generic,
              "Attempted to update user_exercise_state with a deleted peer review queue entry"
                  .to_string(),
              None,
                ));
            }
        }

        if peer_or_self_review_information
            .peer_or_self_review_config
            .deleted_at
            .is_some()
        {
            return Err(ModelError::new(
                ModelErrorType::Generic,
                "Attempted to update user_exercise_state with a deleted peer review config"
                    .to_string(),
                None,
            ));
        }
    }

    if let Some(latest_teacher_grading_decision) = &input_data.latest_teacher_grading_decision {
        if latest_teacher_grading_decision.deleted_at.is_some() {
            return Err(ModelError::new(
                ModelErrorType::Generic,
                "Attempted to update user_exercise_state with a latest teacher grading decision"
                    .to_string(),
                None,
            ));
        }
    }
    Ok(())
}
