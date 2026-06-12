use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct CheatingConfirmationGradeSnapshot {
    pub id: Uuid,
    pub course_module_completion_id: Uuid,
    pub passed: bool,
    pub grade: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// Snapshots the current passed/grade of all of a user's completions in a course and then fails
/// them (passed = false, grade = 0) as the consequence of a confirmed cheating suspicion. The
/// snapshots let the failure be undone exactly if the suspicion is later dismissed (see
/// [`restore_and_clear_for_user_course`]). A completion that already has an active snapshot is left
/// as-is, so confirming an already-confirmed student does not overwrite the original values.
pub async fn snapshot_and_fail_completions(
    conn: &mut PgConnection,
    course_id: Uuid,
    user_id: Uuid,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    sqlx::query!(
        "
INSERT INTO cheating_confirmation_grade_snapshots (course_module_completion_id, passed, grade)
SELECT cmc.id, cmc.passed, cmc.grade
FROM course_module_completions cmc
WHERE cmc.user_id = $1
  AND cmc.course_id = $2
  AND cmc.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM cheating_confirmation_grade_snapshots s
    WHERE s.course_module_completion_id = cmc.id
      AND s.deleted_at IS NULL
  )
        ",
        user_id,
        course_id
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "
UPDATE course_module_completions
SET passed = false, grade = 0
WHERE user_id = $1
  AND course_id = $2
  AND deleted_at IS NULL
        ",
        user_id,
        course_id
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// Restores passed/grade onto a user's completions in a course from their active snapshots and then
/// soft-deletes those snapshots, undoing a cheating confirmation. A no-op for users without active
/// snapshots (e.g. a student dismissed straight from the flagged state, who was never failed).
pub async fn restore_and_clear_for_user_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    user_id: Uuid,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    sqlx::query!(
        "
UPDATE course_module_completions cmc
SET passed = s.passed, grade = s.grade
FROM cheating_confirmation_grade_snapshots s
WHERE s.course_module_completion_id = cmc.id
  AND s.deleted_at IS NULL
  AND cmc.user_id = $1
  AND cmc.course_id = $2
  AND cmc.deleted_at IS NULL
        ",
        user_id,
        course_id
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "
UPDATE cheating_confirmation_grade_snapshots s
SET deleted_at = now()
WHERE s.deleted_at IS NULL
  AND s.course_module_completion_id IN (
    SELECT cmc.id
    FROM course_module_completions cmc
    WHERE cmc.user_id = $1
      AND cmc.course_id = $2
      AND cmc.deleted_at IS NULL
  )
        ",
        user_id,
        course_id
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}
