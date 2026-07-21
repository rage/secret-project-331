//! Sharing exercise-slide submissions via unguessable-token links.
//!
//! A legacy "paste" is modelled as a share capability on an existing
//! `exercise_slide_submission`, not as a separate stored copy of the answer.

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
