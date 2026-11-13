//! Sharing exercise-slide submissions and answer snapshots via unguessable-token links.
//!
//! A share is a capability on an answer that already exists, not a copy of it. A client's paste is
//! a share of an ungraded paste snapshot, so pasting never uses a try.

use crate::prelude::*;
use models::exercise_slide_submission_shares::ExerciseSlideSubmissionShare;

/// Mints a new share for the given submission; the returned `id` is the unguessable
/// token embedded in the shareable URL.
///
/// Not idempotent: minting twice creates two independent, individually revocable
/// shares. Callers must have verified that the submission belongs to the user.
pub async fn share_submission(
    conn: &mut PgConnection,
    exercise_slide_submission_id: Uuid,
    created_by: Uuid,
) -> Result<ExerciseSlideSubmissionShare, ControllerError> {
    let share = models::exercise_slide_submission_shares::insert(
        conn,
        exercise_slide_submission_id,
        created_by,
    )
    .await?;
    Ok(share)
}

/// [`share_submission`] for an answer snapshot. Callers must have verified that the snapshot
/// belongs to the user.
pub async fn share_snapshot(
    conn: &mut PgConnection,
    exercise_answer_snapshot_id: Uuid,
    created_by: Uuid,
) -> Result<ExerciseSlideSubmissionShare, ControllerError> {
    let share = models::exercise_slide_submission_shares::insert_for_snapshot(
        conn,
        exercise_answer_snapshot_id,
        created_by,
    )
    .await?;
    Ok(share)
}
