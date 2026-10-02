//! Pausing and resuming a module's credit registration.

use crate::prelude::*;

/// Who paused a module's credit registration, and why. One value rather than three arguments
/// because `course_module_suotar_configurations_pause_pair` rejects a timestamp without an actor.
#[derive(Debug, Clone)]
pub struct SuotarPause<'a> {
    pub paused_at: DateTime<Utc>,
    pub paused_by_user_id: Uuid,
    pub reason: Option<&'a str>,
}

/// Pauses or resumes the module. Every phase's claim query skips a paused module, so pausing
/// freezes its ledger rows where they stand instead of cancelling them. Pausing a paused module
/// only updates who paused it and why. `None` resumes, and moves the rows' enrolment check
/// schedules on by as long as the pause lasted.
pub async fn set_paused(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    pause: Option<SuotarPause<'_>>,
) -> ModelResult<()> {
    let pause = pause.as_ref();
    let mut tx = conn.begin().await?;
    let previously_paused_at = sqlx::query_scalar!(
        r#"
SELECT paused_at
FROM course_module_suotar_configurations
WHERE course_module_id = $1
  AND deleted_at IS NULL
FOR UPDATE
        "#,
        course_module_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .flatten();
    sqlx::query!(
        r#"
UPDATE course_module_suotar_configurations
SET paused_at = CASE
    WHEN $2::timestamptz IS NOT NULL THEN COALESCE(paused_at, $2)
  END,
  paused_by_user_id = $3,
  pause_reason = $4
WHERE course_module_id = $1
  AND deleted_at IS NULL
        "#,
        course_module_id,
        pause.map(|pause| pause.paused_at),
        pause.map(|pause| pause.paused_by_user_id),
        pause.and_then(|pause| pause.reason),
    )
    .execute(&mut *tx)
    .await?;
    if pause.is_none()
        && let Some(paused_at) = previously_paused_at
    {
        super::enrolment_checks::shift_past_pause(
            &mut tx,
            course_module_id,
            // Whole seconds: Postgres intervals hold no nanoseconds, which the clock has.
            chrono::TimeDelta::seconds((Utc::now() - paused_at).num_seconds()),
        )
        .await?;
    }
    tx.commit().await?;
    Ok(())
}
