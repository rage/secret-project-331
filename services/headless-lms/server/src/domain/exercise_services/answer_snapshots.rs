//! Storing ungraded answer snapshots (pastes and backups) for a native client.

use crate::domain::exercise_services::answer_uploads;
use crate::prelude::*;
use models::exercise_answer_snapshots::{
    ExerciseAnswerSnapshot, NewExerciseAnswerSnapshot, SnapshotPurpose,
};

/// How many backups of one exercise a user keeps; storing another deletes the oldest. Pastes are
/// not counted, since each one backs a link the user has handed out.
pub const MAX_BACKUPS_PER_USER_AND_EXERCISE: i64 = 20;

/// The answer a snapshot stores. The caller has established which course exercise, slide and task
/// it is for and that the user may view them.
pub struct SnapshotAnswer {
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub exercise_id: Uuid,
    pub exercise_slide_id: Uuid,
    pub exercise_task_id: Uuid,
    pub purpose: SnapshotPurpose,
    pub data_json: Option<serde_json::Value>,
    pub file_upload_ids: Vec<Uuid>,
}

/// Stores a snapshot of the named uploads, then trims the user's backups of the exercise to
/// [`MAX_BACKUPS_PER_USER_AND_EXERCISE`].
///
/// Applies the same upload checks as a file submit, but nothing a submit's acceptance depends on:
/// no deadline, try limit or chapter lock, because a snapshot is never graded.
pub async fn store_snapshot(
    conn: &mut PgConnection,
    answer: SnapshotAnswer,
) -> Result<ExerciseAnswerSnapshot, ControllerError> {
    answer_uploads::verify_answer_names_uploads(&answer.file_upload_ids)?;

    let mut tx = conn.begin().await?;
    answer_uploads::lock_and_verify_uploads_are_usable(
        &mut tx,
        answer.exercise_id,
        answer.user_id,
        &answer.file_upload_ids,
    )
    .await?;
    let snapshot = models::exercise_answer_snapshots::insert(
        &mut tx,
        NewExerciseAnswerSnapshot {
            user_id: answer.user_id,
            course_id: answer.course_id,
            exercise_id: answer.exercise_id,
            exercise_slide_id: answer.exercise_slide_id,
            exercise_task_id: answer.exercise_task_id,
            purpose: answer.purpose,
            data_json: answer.data_json,
        },
        &answer.file_upload_ids,
    )
    .await?;
    if answer.purpose == SnapshotPurpose::Backup {
        models::exercise_answer_snapshots::delete_backups_beyond(
            &mut tx,
            answer.user_id,
            answer.exercise_id,
            MAX_BACKUPS_PER_USER_AND_EXERCISE,
        )
        .await?;
    }
    tx.commit().await?;
    Ok(snapshot)
}
