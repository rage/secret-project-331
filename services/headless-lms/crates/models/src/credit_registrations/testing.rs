//! Test-mode setup the system tests drive through the mock Suotar control routes. Nothing here
//! belongs on a live path: each helper writes a stamp or a hold the pipeline otherwise owns.

use super::claims::RegistrationScope;
use crate::prelude::*;
use chrono::TimeDelta;

/// Backdates `state_entered_at` for a registration, so a test can simulate a row that has been
/// sitting in its state long enough for a backoff or timeout to fire.
///
/// Exists only for test setup: [`transition`](super::transition::transition) owns this stamp, and calling this
/// from a live path would desynchronize it from the state it is supposed to describe.
pub async fn set_state_entered_at_for_testing(
    conn: &mut PgConnection,
    id: Uuid,
    state_entered_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE credit_registrations
SET state_entered_at = $2
WHERE id = $1
        ",
        id,
        state_entered_at,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Backdates `first_failed_at` for a registration, so a test can simulate a retry window that
/// started long enough ago for its retry limit to have elapsed.
///
/// Exists only for test setup: [`transition`](super::transition::transition) owns this stamp, and calling this
/// from a live path would desynchronize it from the failure it is supposed to describe.
pub async fn set_first_failed_at_for_testing(
    conn: &mut PgConnection,
    id: Uuid,
    first_failed_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE credit_registrations
SET first_failed_at = $2
WHERE id = $1
        ",
        id,
        first_failed_at,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Excuses every one of a user's rows (or, with `course_id`, just that course's) from every
/// unscoped claim until `held_until`; a scoped claim ignores every hold regardless. Keyed on
/// identity rather than a row id so a spec can hold before materialize creates the row it means to
/// protect, closing the window a row-id hold could only ever narrow: the live background worker
/// ticks every 10s regardless of any single test, so a hold applied after the row exists still
/// races the worker's own next tick.
///
/// Exists only for test setup: nothing in the product ever needs to hide a user's rows from the
/// worker that owns them.
pub async fn set_test_exclusive_hold_for_testing(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Option<Uuid>,
    held_until: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO credit_registration_test_exclusive_holds (user_id, course_id, held_until)
VALUES ($1, $2, $3)
        ",
        user_id,
        course_id,
        held_until,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Backdates the row's last enrolment check and last check request past the limit on asking, so a
/// spec can press a recheck button without waiting it out. With `clear_restarts`, also forgets the
/// day's restarts. Exists only for test setup.
pub async fn expire_enrolment_recheck_allowance_for_testing(
    conn: &mut PgConnection,
    id: Uuid,
    clear_restarts: bool,
) -> ModelResult<()> {
    use crate::library::credit_registration::enrolment_check_schedule::CHECK_REQUEST_MIN_INTERVAL;
    sqlx::query!(
        "
UPDATE credit_registrations
SET enrolment_checked_at = enrolment_checked_at - $2::interval,
  enrolment_check_requested_at = enrolment_check_requested_at - $2::interval,
  enrolment_check_restart_count = CASE
    WHEN $3 THEN 0
    ELSE enrolment_check_restart_count
  END
WHERE id = $1
        ",
        id,
        CHECK_REQUEST_MIN_INTERVAL as TimeDelta,
        clear_restarts,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Makes every row in `scope` that waits for an enrolment check due now, as if its next rung had
/// come, and returns how many it moved. Exists only for test setup: specs cannot wait out a day for
/// a row's first check.
pub async fn make_enrolment_checks_due_for_testing(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
) -> ModelResult<u64> {
    let res = sqlx::query!(
        r#"
UPDATE credit_registrations
SET next_attempt_at = now()
WHERE state = 'no_usable_enrolment'
  AND next_attempt_at > now()
  AND deleted_at IS NULL
  AND ($1::uuid IS NULL OR course_id = $1)
  AND ($2::uuid IS NULL OR user_id = $2)
  AND (
    cardinality($3::uuid []) = 0
    OR id = ANY($3::uuid [])
  )
        "#,
        scope.course_id,
        scope.user_id,
        &scope.credit_registration_ids,
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected())
}
