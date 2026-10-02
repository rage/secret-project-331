//! Chapter locking workflows that update exercise review states.

use crate::CourseOrExamId;
use crate::exercise_slide_submissions;
use crate::exercises::{self, GradingProgress};
use crate::prelude::*;
use crate::user_exercise_states::{self, ReviewingStage};

use super::user_exercise_state_updater;

pub async fn move_chapter_exercises_to_manual_review(
    conn: &mut PgConnection,
    chapter_id: Uuid,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<()> {
    let exercises = exercises::get_exercises_by_chapter_id(conn, chapter_id).await?;

    // Same predicate as the repair in migration 20260806122511, so a locked state and a repaired
    // one classify an answer identically.
    let exercise_ids: Vec<Uuid> = exercises.iter().map(|e| e.id).collect();
    let answered_ids: std::collections::HashSet<Uuid> =
        exercise_slide_submissions::get_exercise_ids_with_submissions_for_user(
            conn,
            &exercise_ids,
            user_id,
            course_id,
        )
        .await?
        .into_iter()
        .collect();

    for exercise in exercises {
        let user_exercise_state_result =
            user_exercise_states::get_users_current_by_exercise(conn, user_id, &exercise).await;

        let user_exercise_state = match user_exercise_state_result {
            Ok(state) => state,
            Err(e) => {
                if matches!(
                    e.error_type(),
                    ModelErrorType::PreconditionFailed | ModelErrorType::RecordNotFound
                ) {
                    continue;
                }
                return Err(e);
            }
        };
        if user_exercise_state.reviewing_stage == ReviewingStage::WaitingForManualGrading
            || user_exercise_state.reviewing_stage == ReviewingStage::ReviewedAndLocked
            || user_exercise_state.reviewing_stage == ReviewingStage::Locked
            || user_exercise_state.selected_exercise_slide_id.is_none()
        {
            continue;
        }

        if !answered_ids.contains(&exercise.id) {
            user_exercise_states::update_reviewing_stage(
                conn,
                user_id,
                CourseOrExamId::Course(course_id),
                exercise.id,
                ReviewingStage::NotAnsweredAndLocked,
            )
            .await?;
            continue;
        }

        if exercise.needs_peer_review || exercise.needs_self_review {
            user_exercise_states::update_reviewing_stage(
                conn,
                user_id,
                CourseOrExamId::Course(course_id),
                exercise.id,
                ReviewingStage::WaitingForManualGrading,
            )
            .await?;
            continue;
        }

        if !exercise.teacher_reviews_answer_after_locking
            && user_exercise_state.grading_progress == GradingProgress::FullyGraded
        {
            user_exercise_states::update_reviewing_stage(
                conn,
                user_id,
                CourseOrExamId::Course(course_id),
                exercise.id,
                ReviewingStage::Locked,
            )
            .await?;
            user_exercise_state_updater::update_user_exercise_state(conn, user_exercise_state.id)
                .await?;
            continue;
        }

        user_exercise_states::update_reviewing_stage(
            conn,
            user_id,
            CourseOrExamId::Course(course_id),
            exercise.id,
            ReviewingStage::WaitingForManualGrading,
        )
        .await?;
    }

    Ok(())
}
