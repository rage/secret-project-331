//! Telling mooc.fi which of its completions we registered, once per completion.
//!
//! mooc.fi records every post as a new registration, so a completion is posted only under a lease,
//! and only after a lookup has shown our registration is not there yet: a post whose answer was
//! lost is then found on the next try instead of being made again.

use chrono::TimeDelta;

use crate::credit_registrations::{CreditRegistrationState, RegistrationScope};
use crate::library::credit_registration::backoff::moocfi_report_backoff;
use crate::library::credit_registration::scrub::scrub_text;
use crate::prelude::*;

/// How many completions one iteration may report.
pub const MOOCFI_REPORT_LIMIT: i64 = 100;

/// Must outlast a lookup and a post at mooc.fi's request timeout each, or a second reporter could
/// claim the completion while the first is still posting it.
pub const MOOCFI_REPORT_LEASE: TimeDelta = TimeDelta::minutes(2);

/// How long a registered mooc.fi completion may stay unreported before a person looks.
pub const MOOCFI_REPORT_OVERDUE_AFTER: TimeDelta = TimeDelta::days(3);

/// A mooc.fi completion claimed for reporting, with what the report says.
#[derive(Debug, Clone)]
pub struct MoocfiReportCandidate {
    pub external_completion_id: Uuid,
    pub moocfi_completion_id: Uuid,
    pub user_id: Uuid,
    pub moocfi_user_upstream_id: i32,
    pub moocfi_course_id: Uuid,
    pub report_attempt_count: i32,
    /// From the completion's first successful attempt.
    pub student_number: DbSecret,
    /// When the first successful attempt's credit landed in the study registry.
    pub registration_date: DateTime<Utc>,
}

/// Leases every live row of the next due, unreported mooc.fi completion with a successful attempt
/// for [`MOOCFI_REPORT_LEASE`], and returns the row whose credit landed first. `None` when nothing
/// is due.
///
/// The lease is per mooc.fi completion, not per row: after a raised tier one completion has rows
/// under two targets, and a reporter for each would post it twice.
pub async fn claim_next_for_report(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
) -> ModelResult<Option<MoocfiReportCandidate>> {
    loop {
        let mut tx = conn.begin().await?;
        let Some(moocfi_completion_id) = sqlx::query_scalar!(
            r#"
SELECT due.moocfi_completion_id
FROM external_completions due
WHERE due.deleted_at IS NULL
  AND due.reported_at IS NULL
  AND due.report_next_attempt_at <= now()
  AND NOT EXISTS (
    SELECT 1
    FROM external_completions leased
    WHERE leased.moocfi_completion_id = due.moocfi_completion_id
      AND leased.deleted_at IS NULL
      AND leased.report_claimed_until > now()
  )
  AND EXISTS (
    SELECT 1
    FROM credit_registrations cr
    WHERE cr.external_completion_id = due.id
      AND cr.deleted_at IS NULL
      AND cr.state = ANY($1::credit_registration_state [])
      AND cr.student_number IS NOT NULL
      AND ($2::uuid IS NULL OR cr.course_id = $2)
      AND ($3::uuid IS NULL OR cr.external_credit_target_id = $3)
      AND ($4::uuid IS NULL OR cr.user_id = $4)
      AND (
        cardinality($5::uuid []) = 0
        OR cr.id = ANY($5::uuid [])
      )
  )
ORDER BY due.report_next_attempt_at
LIMIT 1
            "#,
            &CreditRegistrationState::SUCCESS_STATES as &[CreditRegistrationState],
            scope.course_id,
            scope.external_credit_target_id,
            scope.user_id,
            &scope.credit_registration_ids,
        )
        .fetch_optional(&mut *tx)
        .await?
        else {
            return Ok(None);
        };

        // Serializes the claimers of one completion, so the lease check below sees a lease another
        // claimer has just committed.
        sqlx::query!(
            r#"
SELECT pg_advisory_xact_lock(
    hashtextextended('external_completions:report:' || $1::uuid::text, 0)
  )
            "#,
            moocfi_completion_id,
        )
        .execute(&mut *tx)
        .await?;
        let claimed = sqlx::query_as!(
            MoocfiReportCandidate,
            r#"
WITH claimed AS (
  UPDATE external_completions ec
  SET report_claimed_until = now() + $2::interval
  WHERE ec.moocfi_completion_id = $1
    AND ec.deleted_at IS NULL
    AND ec.reported_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM external_completions leased
      WHERE leased.moocfi_completion_id = $1
        AND leased.deleted_at IS NULL
        AND leased.report_claimed_until > now()
    )
  RETURNING ec.id,
    ec.moocfi_completion_id,
    ec.user_id,
    ec.moocfi_user_upstream_id,
    ec.external_credit_target_id,
    ec.report_attempt_count
)
SELECT claimed.id AS external_completion_id,
  claimed.moocfi_completion_id,
  claimed.user_id,
  claimed.moocfi_user_upstream_id,
  t.moocfi_course_id,
  claimed.report_attempt_count,
  first_success.student_number AS "student_number!: DbSecret",
  first_success.registration_date AS "registration_date!"
FROM claimed
  JOIN external_credit_targets t ON t.id = claimed.external_credit_target_id
  CROSS JOIN LATERAL (
    SELECT cr.student_number,
      COALESCE(cr.registered_at, cr.terminal_at, cr.state_entered_at) AS registration_date
    FROM credit_registrations cr
    WHERE cr.external_completion_id = claimed.id
      AND cr.deleted_at IS NULL
      AND cr.state = ANY($3::credit_registration_state [])
      AND cr.student_number IS NOT NULL
    ORDER BY cr.attempt_number
    LIMIT 1
  ) first_success
ORDER BY first_success.registration_date
LIMIT 1
            "#,
            moocfi_completion_id,
            MOOCFI_REPORT_LEASE as TimeDelta,
            &CreditRegistrationState::SUCCESS_STATES as &[CreditRegistrationState],
        )
        .fetch_optional(&mut *tx)
        .await?;
        tx.commit().await?;
        if claimed.is_some() {
            return Ok(claimed);
        }
        // Another reporter leased it first; the next pass no longer picks it.
    }
}

/// Marks every live row of the mooc.fi completion reported and releases their leases: a
/// registration on mooc.fi is per completion, whichever target the rows are under.
pub async fn mark_reported(conn: &mut PgConnection, moocfi_completion_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE external_completions
SET reported_at = COALESCE(reported_at, now()),
  report_claimed_until = NULL,
  report_last_error = NULL
WHERE moocfi_completion_id = $1
  AND deleted_at IS NULL
        "#,
        moocfi_completion_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records a failed report of the candidate, and releases and backs off every live row of its
/// mooc.fi completion.
pub async fn record_report_failure(
    conn: &mut PgConnection,
    candidate: &MoocfiReportCandidate,
    error: &str,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE external_completions
SET report_attempt_count = report_attempt_count + 1,
  report_next_attempt_at = now() + $2::interval,
  report_last_error = $3,
  report_claimed_until = NULL
WHERE moocfi_completion_id = $1
  AND deleted_at IS NULL
  AND reported_at IS NULL
        "#,
        candidate.moocfi_completion_id,
        moocfi_report_backoff(candidate.report_attempt_count) as TimeDelta,
        scrub_text(error),
    )
    .execute(conn)
    .await?;
    Ok(())
}
