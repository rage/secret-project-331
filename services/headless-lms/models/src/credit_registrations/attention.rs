//! The Errors tab's attention queue: the rows that want a human, and why.

use super::metrics::StuckThresholds;
use super::state::{CreditRegistrationErrorCode, CreditRegistrationState, ResubmissionFacts};
use crate::prelude::*;
use utoipa::ToSchema;

/// Which detector picked a row for the attention queue. A row can carry several.
///
/// Not `needs_admin_attention`: that flag is one of the conditions that puts a row in the queue,
/// but it says nothing about why, so it is reported per row rather than as a reason of its own.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, ToSchema)]
#[serde(rename_all = "snake_case")]
// The API has always called it this; the short name is for Rust callers, who have the module.
#[schema(as = CreditRegistrationAttentionReason)]
pub enum AttentionReason {
    /// Past its state's threshold with the pipeline still owning it.
    StuckInState,
    PermanentError,
    RetryWindowExpired,
    Misregistered,
    TooManyAttempts,
    /// `submission_uncertain`: never retried automatically, and never in bulk.
    OutcomeUncertain,
}

impl AttentionReason {
    pub const ALL: [Self; 6] = [
        Self::StuckInState,
        Self::PermanentError,
        Self::RetryWindowExpired,
        Self::Misregistered,
        Self::TooManyAttempts,
        Self::OutcomeUncertain,
    ];

    /// Bound into the query as a `text` array element; must match the serde names a caller sends
    /// to narrow the queue.
    fn as_str(self) -> &'static str {
        match self {
            Self::StuckInState => "stuck_in_state",
            Self::PermanentError => "permanent_error",
            Self::RetryWindowExpired => "retry_window_expired",
            Self::Misregistered => "misregistered",
            Self::TooManyAttempts => "too_many_attempts",
            Self::OutcomeUncertain => "outcome_uncertain",
        }
    }
}

/// How the attention queue orders a page. The default puts the row that has been waiting longest
/// first, which is the order an operator works the queue in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum AttentionSort {
    #[default]
    TimeInState,
    NextAttempt,
    Course,
}

impl AttentionSort {
    /// Bound into the query's `ORDER BY` as a `text` parameter.
    fn as_str(self) -> &'static str {
        match self {
            Self::TimeInState => "time_in_state",
            Self::NextAttempt => "next_attempt",
            Self::Course => "course",
        }
    }
}

/// One row the Errors tab wants a human to look at, with the detectors that picked it.
///
/// The `*_count` fields are totals over the whole queue this call selected, not over the page, so a
/// caller reads them off the first row instead of running a second aggregate.
#[derive(Debug, Clone)]
pub struct AttentionRegistration {
    pub id: Uuid,
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub state: CreditRegistrationState,
    pub state_entered_at: DateTime<Utc>,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub attempt_count: i32,
    /// The pipeline's cached "a human should look at this". Membership in the queue does not depend
    /// on it alone, and it is never reported as a reason.
    pub needs_admin_attention: bool,
    pub next_attempt_at: DateTime<Utc>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub resubmit_not_before: Option<DateTime<Utc>>,
    pub student_number: Option<DbSecret>,
    pub stuck_in_state: bool,
    pub permanent_error: bool,
    pub retry_window_expired: bool,
    pub misregistered: bool,
    pub too_many_attempts: bool,
    pub outcome_uncertain: bool,
    pub total_count: i64,
    pub stuck_in_state_count: i64,
    pub permanent_error_count: i64,
    pub retry_window_expired_count: i64,
    pub misregistered_count: i64,
    pub too_many_attempts_count: i64,
    pub outcome_uncertain_count: i64,
    /// Rows the flag alone put in the queue. Reachable by no reason, so a caller grouping by reason
    /// has to account for them separately or leave part of its own queue unreachable.
    pub flagged_without_reason_count: i64,
}

impl AttentionRegistration {
    /// What decides whether a human may move this row; see [`ResubmissionFacts`]. The queue never
    /// holds a superseded row.
    pub fn resubmission_facts(&self) -> ResubmissionFacts {
        ResubmissionFacts {
            state: self.state,
            is_superseded: false,
            error_code: self.error_code,
            resubmit_not_before: self.resubmit_not_before,
            submitted_at: self.submitted_at,
        }
    }

    /// The detectors that picked this row.
    pub fn reasons(&self) -> Vec<AttentionReason> {
        AttentionReason::ALL
            .into_iter()
            .filter(|reason| match reason {
                AttentionReason::StuckInState => self.stuck_in_state,
                AttentionReason::PermanentError => self.permanent_error,
                AttentionReason::RetryWindowExpired => self.retry_window_expired,
                AttentionReason::Misregistered => self.misregistered,
                AttentionReason::TooManyAttempts => self.too_many_attempts,
                AttentionReason::OutcomeUncertain => self.outcome_uncertain,
            })
            .collect()
    }

    /// How many rows of the whole queue each detector picked, in [`AttentionReason::ALL`] order.
    pub fn counts_by_reason(&self) -> Vec<(AttentionReason, i64)> {
        vec![
            (AttentionReason::StuckInState, self.stuck_in_state_count),
            (AttentionReason::PermanentError, self.permanent_error_count),
            (
                AttentionReason::RetryWindowExpired,
                self.retry_window_expired_count,
            ),
            (AttentionReason::Misregistered, self.misregistered_count),
            (
                AttentionReason::TooManyAttempts,
                self.too_many_attempts_count,
            ),
            (
                AttentionReason::OutcomeUncertain,
                self.outcome_uncertain_count,
            ),
        ]
    }
}

/// Which rows of the attention queue a call wants, and which slice of them.
///
/// `reasons` and `only_without_reason` narrow the whole selection, totals included, so a caller
/// after facet counts over the unnarrowed queue leaves both at their defaults.
#[derive(Debug, Clone, Copy)]
pub struct AttentionSelection<'a> {
    pub reasons: &'a [AttentionReason],
    pub only_without_reason: bool,
    pub sort: AttentionSort,
    pub limit: i64,
    pub offset: i64,
}

impl Default for AttentionSelection<'_> {
    fn default() -> Self {
        Self {
            reasons: &[],
            only_without_reason: false,
            sort: AttentionSort::TimeInState,
            limit: 1,
            offset: 0,
        }
    }
}

/// A page of the attention queue, with the totals for everything the call selected on every row.
///
/// The one query behind the Errors tab's pages and [`count_needing_attention`], so the queue an
/// operator works through and the counts the Overview tile and tab badge show cannot disagree.
///
/// A row is in the queue when at least one detector fired or the pipeline flagged it, so clearing
/// the flag by hand only removes a row no detector also picked. Superseded rows are excluded in the
/// query itself rather than a later predicate: a false positive here costs an operator's attention
/// directly. `thresholds` are the same seconds [`count_stuck`](super::count_stuck) uses, so the
/// table and the alert can't disagree about what stuck means. `reasons` and `only_without_reason`
/// behave as on [`AttentionSelection`].
pub async fn get_attention_items(
    conn: &mut PgConnection,
    thresholds: &StuckThresholds,
    too_many_attempts: i32,
    selection: AttentionSelection<'_>,
) -> ModelResult<Vec<AttentionRegistration>> {
    let AttentionSelection {
        reasons,
        only_without_reason,
        sort,
        limit,
        offset,
    } = selection;
    let (state_thresholds, threshold_secs) = thresholds.state_seconds_arrays();
    let reason_names: Vec<&str> = reasons.iter().map(|reason| reason.as_str()).collect();
    let res = sqlx::query_as!(
        AttentionRegistration,
        r#"
SELECT cr.id,
  cr.user_id,
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  ud.email AS "email?",
  cr.course_id,
  c.name AS course_name,
  cr.course_module_id,
  cm.name AS course_module_name,
  cr.state,
  cr.state_entered_at,
  cr.error_code AS "error_code?",
  cr.submit_retry_count + cr.verify_attempt_count AS "attempt_count!",
  cr.needs_admin_attention,
  cr.next_attempt_at,
  cr.submitted_at,
  cr.resubmit_not_before,
  cr.student_number,
  d.stuck_in_state AS "stuck_in_state!",
  d.permanent_error AS "permanent_error!",
  d.retry_window_expired AS "retry_window_expired!",
  d.misregistered AS "misregistered!",
  d.too_many_attempts AS "too_many_attempts!",
  d.outcome_uncertain AS "outcome_uncertain!",
  COUNT(*) OVER () AS "total_count!",
  COUNT(*) FILTER (
    WHERE d.stuck_in_state
  ) OVER () AS "stuck_in_state_count!",
  COUNT(*) FILTER (
    WHERE d.permanent_error
  ) OVER () AS "permanent_error_count!",
  COUNT(*) FILTER (
    WHERE d.retry_window_expired
  ) OVER () AS "retry_window_expired_count!",
  COUNT(*) FILTER (
    WHERE d.misregistered
  ) OVER () AS "misregistered_count!",
  COUNT(*) FILTER (
    WHERE d.too_many_attempts
  ) OVER () AS "too_many_attempts_count!",
  COUNT(*) FILTER (
    WHERE d.outcome_uncertain
  ) OVER () AS "outcome_uncertain_count!",
  COUNT(*) FILTER (
    WHERE NOT any_d.any_reason
  ) OVER () AS "flagged_without_reason_count!"
FROM credit_registrations cr
  JOIN courses c ON c.id = cr.course_id
  JOIN course_modules cm ON cm.id = cr.course_module_id
  LEFT JOIN user_details ud ON ud.user_id = cr.user_id
  LEFT JOIN LATERAL (
    SELECT u.threshold_secs
    FROM UNNEST($1::credit_registration_state [], $2::double precision []) AS u(state, threshold_secs)
    WHERE u.state = cr.state
  ) t ON TRUE
  CROSS JOIN LATERAL (
    SELECT cr.terminal_at IS NULL
      AND t.threshold_secs IS NOT NULL
      AND now() - cr.state_entered_at > MAKE_INTERVAL(secs => t.threshold_secs) AS stuck_in_state,
      cr.state = 'failed_permanent'
      AND cr.needs_admin_attention AS permanent_error,
      -- Coalesced because error_code is nullable and this is selected into a plain `bool`: a row
      -- another detector picked while holding no error code would otherwise fail to decode and take
      -- the whole table down with it.
      COALESCE(cr.error_code = 'retry_window_expired', FALSE) AS retry_window_expired,
      cr.state = 'misregistered' AS misregistered,
      cr.submit_retry_count >= $3 AS too_many_attempts,
      cr.state = 'submission_uncertain' AS outcome_uncertain
  ) d
  CROSS JOIN LATERAL (
    SELECT d.stuck_in_state
      OR d.permanent_error
      OR d.retry_window_expired
      OR d.misregistered
      OR d.too_many_attempts
      OR d.outcome_uncertain AS any_reason
  ) any_d
WHERE cr.superseded_by_id IS NULL
  AND cr.deleted_at IS NULL
  AND (
    any_d.any_reason
    OR cr.needs_admin_attention
  )
  AND (
    NOT $8::bool
    OR NOT any_d.any_reason
  )
  AND (
    CARDINALITY($4::text []) = 0
    OR (d.stuck_in_state AND 'stuck_in_state' = ANY($4))
    OR (d.permanent_error AND 'permanent_error' = ANY($4))
    OR (
      d.retry_window_expired
      AND 'retry_window_expired' = ANY($4)
    )
    OR (d.misregistered AND 'misregistered' = ANY($4))
    OR (
      d.too_many_attempts
      AND 'too_many_attempts' = ANY($4)
    )
    OR (
      d.outcome_uncertain
      AND 'outcome_uncertain' = ANY($4)
    )
  )
ORDER BY CASE
    WHEN $5::text = 'course' THEN c.name
  END,
  CASE
    WHEN $5::text = 'next_attempt' THEN cr.next_attempt_at
    ELSE cr.state_entered_at
  END,
  cr.id
LIMIT $6 OFFSET $7
        "#,
        &state_thresholds as &[CreditRegistrationState],
        &threshold_secs as &[f64],
        too_many_attempts,
        &reason_names as &[&str],
        sort.as_str(),
        limit,
        offset,
        only_without_reason,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The whole queue's totals: how many rows need a human, and how many of them each detector picked.
///
/// The canonical "needs a human" count. Every surface that shows one — the Overview tile, the tab
/// badge, the Errors queue — reads this, so none can disagree. `None` when the queue is empty.
pub async fn count_needing_attention(
    conn: &mut PgConnection,
    thresholds: &StuckThresholds,
    too_many_attempts: i32,
) -> ModelResult<Option<AttentionRegistration>> {
    let rows = get_attention_items(
        conn,
        thresholds,
        too_many_attempts,
        AttentionSelection::default(),
    )
    .await?;
    Ok(rows.into_iter().next())
}
