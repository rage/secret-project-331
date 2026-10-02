//! The dashboard's and the health alerts' counts over the whole ledger.

use super::state::{CreditRegistrationErrorCode, CreditRegistrationState};
use crate::credit_registration_policy::pending_reason::PendingReasonCounts;
use crate::prelude::*;
use utoipa::ToSchema;

/// Live rows per state, for the dashboard funnel. Superseded attempts are excluded, as in the
/// per-course sibling, or a course that regrades counts every student twice.
pub async fn count_by_state(
    conn: &mut PgConnection,
) -> ModelResult<Vec<(CreditRegistrationState, i64)>> {
    let rows = sqlx::query!(
        r#"
SELECT state,
  COUNT(*) AS "count!"
FROM credit_registrations
WHERE superseded_by_id IS NULL
  AND deleted_at IS NULL
GROUP BY state
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows.into_iter().map(|r| (r.state, r.count)).collect())
}

/// Live rows parked in `no_usable_enrolment` that an unscoped resolve-enrolments claim would take
/// for an enrolment check now; the rest wait for their schedule, their module, or a lookup already
/// out. Leaves out the claim's one-row-per-student-and-module hold, which only defers a row.
///
/// Shares its filters with the unscoped `claim` and with the released-check test of
/// [`pull_forward_batched_checks`](crate::library::credit_registration::enrolment_checks::pull_forward_batched_checks);
/// change all three together, or the queue depth counts rows no claim takes.
pub async fn count_due_enrolment_checks(conn: &mut PgConnection) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM credit_registrations cr
  JOIN credit_registration_active_course_modules acm ON acm.course_module_id = cr.course_module_id
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
WHERE cr.state = 'no_usable_enrolment'
  AND cr.next_attempt_at <= now()
  AND cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
  AND (
    cmc.register_credits_via_suotar
    OR cr.submitted_at IS NOT NULL
  )
  AND (
    cr.enrolment_check_claimed_until IS NULL
    OR cr.enrolment_check_claimed_until <= now()
  )
  AND NOT EXISTS (
    SELECT 1
    FROM credit_registration_test_exclusive_holds h
    WHERE h.user_id = cr.user_id
      AND (
        h.course_id IS NULL
        OR h.course_id = cr.course_id
      )
      AND h.held_until > now()
  )
        "#,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// Live `pending` rows per blocker. Derived from `credit_registration_preconditions`, so it cannot
/// disagree with what the recompute is waiting for or with what the student is shown.
pub async fn count_pending_by_reason(conn: &mut PgConnection) -> ModelResult<PendingReasonCounts> {
    let row = sqlx::query!(
        r#"
SELECT COUNT(*) FILTER (
    WHERE NOT p.completion_eligible
  ) AS "completion_count!",
  COUNT(*) FILTER (
    WHERE p.completion_eligible
      AND NOT p.has_verified_student_number
  ) AS "student_number_count!"
FROM credit_registrations cr
  JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
WHERE cr.state = 'pending'
  AND cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
        "#,
    )
    .fetch_one(conn)
    .await?;
    Ok(PendingReasonCounts {
        completion_count: row.completion_count,
        student_number_count: row.student_number_count,
    })
}

/// Live rows carrying an error code, split by whether the pipeline is still working on them.
#[derive(Debug, Clone, PartialEq)]
pub struct CreditRegistrationErrorCodeCount {
    pub error_code: CreditRegistrationErrorCode,
    pub in_flight_count: i64,
    pub terminal_failure_count: i64,
}

/// The error-code breakdown the Overview shows.
pub async fn count_by_error_code(
    conn: &mut PgConnection,
) -> ModelResult<Vec<CreditRegistrationErrorCodeCount>> {
    let rows = sqlx::query!(
        r#"
SELECT error_code AS "error_code!",
  COUNT(*) FILTER (WHERE terminal_at IS NULL) AS "in_flight_count!",
  COUNT(*) FILTER (
    WHERE state = ANY($1::credit_registration_state [])
  ) AS "terminal_failure_count!"
FROM credit_registrations
WHERE error_code IS NOT NULL
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
GROUP BY error_code
ORDER BY COUNT(*) DESC
        "#,
        &CreditRegistrationState::HARD_FAILURE_STATES as &[CreditRegistrationState],
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| CreditRegistrationErrorCodeCount {
            error_code: row.error_code,
            in_flight_count: row.in_flight_count,
            terminal_failure_count: row.terminal_failure_count,
        })
        .collect())
}

/// The row that has been waiting longest for the pipeline to do something with it.
#[derive(Debug, Clone, PartialEq)]
pub struct OldestNonTerminalRegistration {
    pub id: Uuid,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
}

pub async fn get_oldest_non_terminal(
    conn: &mut PgConnection,
) -> ModelResult<Option<OldestNonTerminalRegistration>> {
    let row = sqlx::query_as!(
        OldestNonTerminalRegistration,
        r#"
SELECT id,
  state,
  state_entered_at
FROM credit_registrations
WHERE terminal_at IS NULL
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
ORDER BY state_entered_at
LIMIT 1
        "#,
    )
    .fetch_optional(conn)
    .await?;
    Ok(row)
}

/// One day of terminal outcomes, for the throughput series.
#[derive(Debug, Clone, PartialEq)]
pub struct CreditRegistrationThroughputDay {
    pub day: DateTime<Utc>,
    pub registered_count: i64,
    pub other_success_count: i64,
    pub failed_count: i64,
}

/// Daily terminal outcomes over the window. Withdrawn rows are in no column: they are neither a
/// success nor a failure.
pub async fn get_throughput_by_day(
    conn: &mut PgConnection,
    since: DateTime<Utc>,
) -> ModelResult<Vec<CreditRegistrationThroughputDay>> {
    let rows = sqlx::query_as!(
        CreditRegistrationThroughputDay,
        r#"
SELECT DATE_TRUNC('day', terminal_at) AS "day!",
  COUNT(*) FILTER (WHERE state = 'registered') AS "registered_count!",
  COUNT(*) FILTER (
    WHERE state = ANY($2::credit_registration_state [])
  ) AS "other_success_count!",
  COUNT(*) FILTER (WHERE state = 'failed_permanent') AS "failed_count!"
FROM credit_registrations
WHERE terminal_at >= $1
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
GROUP BY 1
ORDER BY 1
        "#,
        since,
        &CreditRegistrationState::OTHER_SUCCESS_STATES as &[CreditRegistrationState],
    )
    .fetch_all(conn)
    .await?;
    Ok(rows)
}

/// What the pipeline finished in a window.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct TerminalOutcomeTotals {
    /// `registered`, `duplicate` and `not_improved`.
    pub success_count: i64,
    /// The subset we put in the registry ourselves.
    pub registered_count: i64,
    pub failed_permanent_count: i64,
    pub cancelled_count: i64,
    /// The denominator of the success rate.
    pub total_count: i64,
}

pub async fn count_terminal_outcomes_since(
    conn: &mut PgConnection,
    since: DateTime<Utc>,
) -> ModelResult<TerminalOutcomeTotals> {
    let res = sqlx::query_as!(
        TerminalOutcomeTotals,
        r#"
SELECT COUNT(*) FILTER (
    WHERE state = ANY($2::credit_registration_state [])
  ) AS "success_count!",
  COUNT(*) FILTER (WHERE state = 'registered') AS "registered_count!",
  COUNT(*) FILTER (WHERE state = 'failed_permanent') AS "failed_permanent_count!",
  COUNT(*) FILTER (WHERE state = 'cancelled') AS "cancelled_count!",
  COUNT(*) AS "total_count!"
FROM credit_registrations
WHERE terminal_at >= $1
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
        "#,
        since,
        &CreditRegistrationState::SUCCESS_STATES as &[CreditRegistrationState],
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Live rows that entered one state within the window. `misregistered` is not terminal, so
/// `terminal_at` cannot answer this.
pub async fn count_entered_state_since(
    conn: &mut PgConnection,
    state: CreditRegistrationState,
    since: DateTime<Utc>,
) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM credit_registrations
WHERE state = $1
  AND state_entered_at >= $2
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
        "#,
        state as CreditRegistrationState,
        since,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// How long registration took, in seconds, for rows that reached `registered` in a window.
#[derive(Debug, Clone, PartialEq)]
pub struct RegistrationLatency {
    pub registered_count: i64,
    /// `terminal_at - created_at`: the student's wait, most of which is theirs to end.
    pub p50_end_to_end_secs: Option<i64>,
    pub p95_end_to_end_secs: Option<i64>,
    /// `registered_at - submitted_at`: how long the study registry took, which is the number to
    /// quote at them.
    pub p50_confirmation_secs: Option<i64>,
    pub p95_confirmation_secs: Option<i64>,
}

pub async fn get_registration_latency_between(
    conn: &mut PgConnection,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> ModelResult<RegistrationLatency> {
    let res = sqlx::query_as!(
        RegistrationLatency,
        r#"
SELECT COUNT(*) AS "registered_count!",
  CEIL(
    EXTRACT(
      EPOCH
      FROM PERCENTILE_DISC(0.5) WITHIN GROUP (
          ORDER BY terminal_at - created_at
        )
    )
  )::bigint AS "p50_end_to_end_secs",
  CEIL(
    EXTRACT(
      EPOCH
      FROM PERCENTILE_DISC(0.95) WITHIN GROUP (
          ORDER BY terminal_at - created_at
        )
    )
  )::bigint AS "p95_end_to_end_secs",
  CEIL(
    EXTRACT(
      EPOCH
      FROM PERCENTILE_DISC(0.5) WITHIN GROUP (
          ORDER BY registered_at - submitted_at
        )
    )
  )::bigint AS "p50_confirmation_secs",
  CEIL(
    EXTRACT(
      EPOCH
      FROM PERCENTILE_DISC(0.95) WITHIN GROUP (
          ORDER BY registered_at - submitted_at
        )
    )
  )::bigint AS "p95_confirmation_secs"
FROM credit_registrations
WHERE state = 'registered'
  AND terminal_at >= $1
  AND terminal_at < $2
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
        "#,
        from,
        to,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Live volumes per course module, for the Courses tab's one row per module.
#[derive(Debug, Clone, PartialEq)]
pub struct ModuleRegistrationTotals {
    pub course_module_id: Uuid,
    pub total_count: i64,
    pub success_count: i64,
    pub in_flight_count: i64,
    pub failed_count: i64,
    pub needs_admin_attention_count: i64,
    pub last_registered_at: Option<DateTime<Utc>>,
    /// The code most of the module's failing rows carry, which is usually the whole diagnosis.
    pub top_error_code: Option<CreditRegistrationErrorCode>,
}

/// `failed_count` is `failed_permanent` and `misregistered` only, so the columns do not add up to
/// the total by design.
pub async fn count_by_module(
    conn: &mut PgConnection,
) -> ModelResult<Vec<ModuleRegistrationTotals>> {
    let res = sqlx::query_as!(
        ModuleRegistrationTotals,
        r#"
SELECT cr.course_module_id,
  COUNT(*) AS "total_count!",
  COUNT(*) FILTER (
    WHERE cr.state = ANY($1::credit_registration_state [])
  ) AS "success_count!",
  COUNT(*) FILTER (WHERE cr.terminal_at IS NULL) AS "in_flight_count!",
  COUNT(*) FILTER (
    WHERE cr.state = ANY($2::credit_registration_state [])
  ) AS "failed_count!",
  COUNT(*) FILTER (WHERE cr.needs_admin_attention) AS "needs_admin_attention_count!",
  MAX(cr.registered_at) AS "last_registered_at",
  (
    SELECT inner_cr.error_code
    FROM credit_registrations inner_cr
    WHERE inner_cr.course_module_id = cr.course_module_id
      AND inner_cr.error_code IS NOT NULL
      AND inner_cr.superseded_by_id IS NULL
      AND inner_cr.deleted_at IS NULL
    GROUP BY inner_cr.error_code
    ORDER BY COUNT(*) DESC,
      inner_cr.error_code
    LIMIT 1
  ) AS "top_error_code?: CreditRegistrationErrorCode"
FROM credit_registrations cr
WHERE superseded_by_id IS NULL
  AND deleted_at IS NULL
GROUP BY cr.course_module_id
        "#,
        &CreditRegistrationState::SUCCESS_STATES as &[CreditRegistrationState],
        &CreditRegistrationState::HARD_FAILURE_STATES as &[CreditRegistrationState],
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// How long a row may sit in one state before it counts as stuck. Seconds, per state.
///
/// Also the wire payload the health endpoint reports as thresholds: field names are the
/// `stuck_*_secs` keys the frontend reads, so do not rename without updating it.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct StuckThresholds {
    pub stuck_ready_to_submit_secs: i64,
    pub stuck_submitting_secs: i64,
    pub stuck_awaiting_verification_secs: i64,
    pub stuck_failed_retryable_secs: i64,
}

impl StuckThresholds {
    /// The four states this covers, paired with their threshold in seconds, in a fixed order both
    /// `get_attention_items` and `count_stuck` bind the same way: `UNNEST`ed into a
    /// state -> threshold lookup rather than each carrying its own copy of the `CASE`.
    pub(super) fn state_seconds_arrays(&self) -> ([CreditRegistrationState; 4], [f64; 4]) {
        (
            [
                CreditRegistrationState::ReadyToSubmit,
                CreditRegistrationState::Submitting,
                CreditRegistrationState::AwaitingVerification,
                CreditRegistrationState::FailedRetryable,
            ],
            [
                self.stuck_ready_to_submit_secs as f64,
                self.stuck_submitting_secs as f64,
                self.stuck_awaiting_verification_secs as f64,
                self.stuck_failed_retryable_secs as f64,
            ],
        )
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct StuckRegistrationCount {
    pub state: CreditRegistrationState,
    pub count: i64,
    /// Over three times the threshold, which is what makes the alert critical.
    pub severely_stuck_count: i64,
    pub oldest_state_entered_at: Option<DateTime<Utc>>,
}

/// Rows the pipeline should have moved by now, per state. Only the four states with a threshold
/// count: the rest wait on a student or a human, where an alert would fire on normal operation.
pub async fn count_stuck(
    conn: &mut PgConnection,
    thresholds: &StuckThresholds,
) -> ModelResult<Vec<StuckRegistrationCount>> {
    let (state_thresholds, threshold_secs) = thresholds.state_seconds_arrays();
    let rows = sqlx::query_as!(
        StuckRegistrationCount,
        r#"
SELECT cr.state AS "state!",
  COUNT(*) AS "count!",
  COUNT(*) FILTER (
    WHERE now() - cr.state_entered_at > MAKE_INTERVAL(secs => t.threshold_secs * 3)
  ) AS "severely_stuck_count!",
  MIN(cr.state_entered_at) AS "oldest_state_entered_at"
FROM credit_registrations cr
  JOIN UNNEST($1::credit_registration_state [], $2::double precision []) AS t(state, threshold_secs) ON t.state = cr.state
WHERE cr.terminal_at IS NULL
  AND cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
  AND now() - cr.state_entered_at > MAKE_INTERVAL(secs => t.threshold_secs)
GROUP BY cr.state
        "#,
        &state_thresholds as &[CreditRegistrationState],
        &threshold_secs as &[f64],
    )
    .fetch_all(conn)
    .await?;
    Ok(rows)
}
