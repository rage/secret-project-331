//! Sharing exercise-slide submissions via unguessable-token links.
//!
//! A "paste" in the legacy sense is modelled here as a share capability on an
//! existing `exercise_slide_submission` (the submission the client already made),
//! not as a separate stored copy of the answer. Minting a share hands back an
//! unguessable token that a viewer endpoint resolves back to the submission.

use crate::prelude::*;
use models::exercise_slide_submission_shares::ExerciseSlideSubmissionShare;

/// Mints a new share for the given submission and returns it. The share `id` is
/// the unguessable token embedded in the shareable URL.
///
/// Not idempotent: minting twice creates two independent (individually revocable)
/// shares. Callers are expected to have verified that the submission belongs to
/// the current user.
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
