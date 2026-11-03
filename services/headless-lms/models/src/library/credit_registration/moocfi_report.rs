//! Telling mooc.fi about each registration we made of its completions, once per registration.
//!
//! mooc.fi keeps every registration as history and does not skip a repeated post, so each
//! registration is posted only under a lease, and each post follows a lookup that finds a
//! registration whose answer was lost, by our organization and its registration date. Which
//! registrations are reported at all is `moocfi_reportable_registrations`.

use chrono::TimeDelta;

use crate::credit_registrations::{CreditRegistrationState, RegistrationScope};
use crate::library::credit_registration::backoff::moocfi_report_backoff;
use crate::library::credit_registration::scrub::scrub_text;
use crate::prelude::*;

/// How many registrations one iteration may report.
pub const MOOCFI_REPORT_LIMIT: i64 = 100;

/// Must outlast a lookup and a post at mooc.fi's request timeout each, or a second reporter could
/// claim the registration while the first is still posting it.
pub const MOOCFI_REPORT_LEASE: TimeDelta = TimeDelta::minutes(2);

/// How long a registration may stay unreported before a person looks.
pub const MOOCFI_REPORT_OVERDUE_AFTER: TimeDelta = TimeDelta::days(3);

/// A registration claimed for reporting, with what the report says.
#[derive(Debug, Clone)]
pub struct MoocfiReportCandidate {
    pub credit_registration_id: Uuid,
    pub moocfi_completion_id: Uuid,
    pub user_id: Uuid,
    pub moocfi_user_upstream_id: i32,
    pub moocfi_course_id: Uuid,
    pub attempt_count: i32,
    pub student_number: DbSecret,
    /// When the credit landed in the study registry, as first claimed; see
    /// `moocfi_registration_reports.registration_date`.
    pub registration_date: DateTime<Utc>,
}

/// Leases the next due, unreported registration for [`MOOCFI_REPORT_LEASE`]. `None` when nothing
/// is due.
pub async fn claim_next_for_report(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
) -> ModelResult<Option<MoocfiReportCandidate>> {
    loop {
        let mut tx = conn.begin().await?;
        let Some(due) = sqlx::query!(
            r#"
SELECT rr.credit_registration_id AS "credit_registration_id!",
  rr.moocfi_completion_id AS "moocfi_completion_id!"
FROM moocfi_reportable_registrations rr
  JOIN credit_registrations cr ON cr.id = rr.credit_registration_id
  LEFT JOIN moocfi_registration_reports report ON report.credit_registration_id = rr.credit_registration_id
  AND report.deleted_at IS NULL
WHERE (
    report.id IS NULL
    OR (
      report.reported_at IS NULL
      AND report.next_attempt_at <= now()
      AND (
        report.claimed_until IS NULL
        OR report.claimed_until <= now()
      )
    )
  )
  AND ($1::uuid IS NULL OR cr.course_id = $1)
  AND ($2::uuid IS NULL OR cr.external_credit_target_id = $2)
  AND ($3::uuid IS NULL OR cr.user_id = $3)
  AND (
    cardinality($4::uuid []) = 0
    OR cr.id = ANY($4::uuid [])
  )
ORDER BY COALESCE(report.next_attempt_at, rr.registration_date)
LIMIT 1
            "#,
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

        // Serializes the claimers of one completion's registrations, so two of them cannot fix the
        // same registration date.
        sqlx::query!(
            r#"
SELECT pg_advisory_xact_lock(
    hashtextextended('moocfi_registration_reports:' || $1::uuid::text, 0)
  )
            "#,
            due.moocfi_completion_id,
        )
        .execute(&mut *tx)
        .await?;
        // The conflict update is what makes the lease exclusive: of two claimers, only the one
        // that finds no live lease gets a row back. The date is fixed only by the insert.
        let claimed = sqlx::query_as!(
            MoocfiReportCandidate,
            r#"
WITH claimed AS (
  INSERT INTO moocfi_registration_reports (
      credit_registration_id,
      moocfi_completion_id,
      registration_date,
      claimed_until
    )
  SELECT rr.credit_registration_id,
    rr.moocfi_completion_id,
    (
      SELECT MIN(free.registration_date)
      FROM generate_series(0, 999) step
        CROSS JOIN LATERAL (
          SELECT date_trunc('milliseconds', rr.registration_date) + step * INTERVAL '1 millisecond' AS registration_date
        ) free
      WHERE NOT EXISTS (
          SELECT 1
          FROM moocfi_registration_reports taken
          WHERE taken.moocfi_completion_id = rr.moocfi_completion_id
            AND taken.registration_date = free.registration_date
            AND taken.deleted_at IS NULL
        )
    ),
    now() + $2::interval
  FROM moocfi_reportable_registrations rr
  WHERE rr.credit_registration_id = $1 ON CONFLICT (credit_registration_id)
  WHERE deleted_at IS NULL DO
  UPDATE
  SET claimed_until = EXCLUDED.claimed_until
  WHERE moocfi_registration_reports.reported_at IS NULL
    AND (
      moocfi_registration_reports.claimed_until IS NULL
      OR moocfi_registration_reports.claimed_until <= now()
    )
  RETURNING credit_registration_id,
    attempt_count,
    registration_date
)
SELECT claimed.credit_registration_id,
  ec.moocfi_completion_id,
  ec.user_id,
  ec.moocfi_user_upstream_id,
  t.moocfi_course_id,
  claimed.attempt_count,
  cr.student_number AS "student_number!: DbSecret",
  claimed.registration_date
FROM claimed
  JOIN credit_registrations cr ON cr.id = claimed.credit_registration_id
  JOIN external_completions ec ON ec.id = cr.external_completion_id
  JOIN external_credit_targets t ON t.id = ec.external_credit_target_id
            "#,
            due.credit_registration_id,
            MOOCFI_REPORT_LEASE as TimeDelta,
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

/// Marks the registration reported and releases its lease, and records on the completion that our
/// registration is on mooc.fi.
pub async fn mark_reported(
    conn: &mut PgConnection,
    candidate: &MoocfiReportCandidate,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    sqlx::query!(
        r#"
UPDATE moocfi_registration_reports
SET reported_at = COALESCE(reported_at, now()),
  claimed_until = NULL,
  last_error = NULL
WHERE credit_registration_id = $1
  AND deleted_at IS NULL
        "#,
        candidate.credit_registration_id,
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        r#"
UPDATE external_completions
SET reported_at = COALESCE(reported_at, now())
WHERE moocfi_completion_id = $1
  AND deleted_at IS NULL
        "#,
        candidate.moocfi_completion_id,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// Records a failed report of the candidate, and releases and backs off its registration.
pub async fn record_report_failure(
    conn: &mut PgConnection,
    candidate: &MoocfiReportCandidate,
    error: &str,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE moocfi_registration_reports
SET attempt_count = attempt_count + 1,
  next_attempt_at = now() + $2::interval,
  last_error = $3,
  claimed_until = NULL
WHERE credit_registration_id = $1
  AND deleted_at IS NULL
  AND reported_at IS NULL
        "#,
        candidate.credit_registration_id,
        moocfi_report_backoff(candidate.attempt_count) as TimeDelta,
        scrub_text(error),
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// The report-back state of one registration, for the admin registration detail.
#[derive(Debug, Clone, PartialEq)]
pub struct MoocfiRegistrationReport {
    /// A success mooc.fi is never told about: a duplicate or not-improved row after an earlier
    /// success of the same completion.
    pub is_skipped: bool,
    pub reported_at: Option<DateTime<Utc>>,
    pub attempt_count: i32,
    pub next_attempt_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
}

/// [`MoocfiRegistrationReport`] of the registration, with no attempts before report-back first
/// claims it.
pub async fn get_registration_report(
    conn: &mut PgConnection,
    credit_registration_id: Uuid,
) -> ModelResult<MoocfiRegistrationReport> {
    let res = sqlx::query_as!(
        MoocfiRegistrationReport,
        r#"
SELECT (
    cr.state = ANY($2::credit_registration_state [])
    AND cr.student_number IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM moocfi_reportable_registrations rr
      WHERE rr.credit_registration_id = cr.id
    )
  ) AS "is_skipped!",
  report.reported_at AS "reported_at?",
  COALESCE(report.attempt_count, 0) AS "attempt_count!",
  report.next_attempt_at AS "next_attempt_at?",
  report.last_error AS "last_error?"
FROM credit_registrations cr
  LEFT JOIN moocfi_registration_reports report ON report.credit_registration_id = cr.id
  AND report.deleted_at IS NULL
WHERE cr.id = $1
        "#,
        credit_registration_id,
        &CreditRegistrationState::OTHER_SUCCESS_STATES as &[CreditRegistrationState],
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
