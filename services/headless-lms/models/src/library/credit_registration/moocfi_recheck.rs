//! Which mooc.fi completions `moocfi-recheck` reads again, so import finds them fresh and never has
//! to call mooc.fi itself.

use chrono::TimeDelta;

use crate::credit_registrations::{CreditRegistrationState, RegistrationScope};
use crate::prelude::*;

/// A row last read longer ago than this is read again. Half of
/// [`MOOCFI_IMPORT_MAX_CHECK_AGE`](crate::credit_registrations::MOOCFI_IMPORT_MAX_CHECK_AGE), so a
/// row on its way to import is re-read before import stops claiming it.
pub const MOOCFI_RECHECK_AFTER: TimeDelta = TimeDelta::hours(1);

/// How many lookups one iteration may make.
pub const MOOCFI_RECHECK_LIMIT: i64 = 200;

/// The states from which import is next: their rows are the ones a fresh read is for.
const STATES_BEFORE_IMPORT: [CreditRegistrationState; 4] = [
    CreditRegistrationState::ReadyToSubmit,
    CreditRegistrationState::ResolvingEnrolment,
    CreditRegistrationState::CheckingEnrolment,
    CreditRegistrationState::NoUsableEnrolment,
];

/// One student's completions of one mooc.fi course, which one lookup reads.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MoocfiRecheckGroup {
    pub user_id: Uuid,
    pub moocfi_user_upstream_id: i32,
    pub moocfi_course_id: Uuid,
}

/// The lookups due, stalest first: every student and mooc.fi course with a row before import, or
/// blocked on a grade mooc.fi may since have fixed, last read over [`MOOCFI_RECHECK_AFTER`] ago.
/// Rows of a paused or switched-off target wait with their target.
pub async fn get_due_recheck_groups(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<Vec<MoocfiRecheckGroup>> {
    let res = sqlx::query_as!(
        MoocfiRecheckGroup,
        r#"
SELECT ec.user_id,
  ec.moocfi_user_upstream_id,
  t.moocfi_course_id
FROM credit_registrations cr
  JOIN external_completions ec ON ec.id = cr.external_completion_id
  JOIN external_credit_targets t ON t.id = ec.external_credit_target_id
WHERE cr.deleted_at IS NULL
  AND cr.superseded_by_id IS NULL
  AND (
    cr.state = ANY($1::credit_registration_state [])
    OR (
      cr.state = 'blocked'
      AND ec.passed IS NULL
    )
  )
  AND ec.deleted_at IS NULL
  AND ec.upstream_checked_at < now() - $2::interval
  AND EXISTS (
    SELECT 1
    FROM credit_registration_active_units au
    WHERE au.credit_unit_id = cr.credit_unit_id
  )
  AND ($3::uuid IS NULL OR cr.course_id = $3)
  AND ($4::uuid IS NULL OR cr.external_credit_target_id = $4)
  AND ($5::uuid IS NULL OR cr.user_id = $5)
  AND (
    cardinality($6::uuid []) = 0
    OR cr.id = ANY($6::uuid [])
  )
GROUP BY ec.user_id,
  ec.moocfi_user_upstream_id,
  t.moocfi_course_id
ORDER BY MIN(ec.upstream_checked_at)
LIMIT $7
        "#,
        &STATES_BEFORE_IMPORT as &[CreditRegistrationState],
        MOOCFI_RECHECK_AFTER as TimeDelta,
        scope.course_id,
        scope.external_credit_target_id,
        scope.user_id,
        &scope.credit_registration_ids,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
