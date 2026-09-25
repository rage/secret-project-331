//! The log of answered enrolment checks, which the check schedules are tuned from, and the
//! dashboard's reads over it.

use utoipa::ToSchema;

use crate::library::credit_registration::enrolment_check_schedule::{
    EnrolmentCheckGroup, EnrolmentCheckSource,
};
use crate::prelude::*;

/// Kept well past the call log's 90 days: a check-requested row lives for 180, and the schedules
/// are refitted from a year of outcomes.
pub const RETENTION_DAYS: i64 = 400;

/// A check lateness past this counts as very late on the dashboard.
pub const VERY_LATE_SECS: i64 = 60 * 60;

#[derive(Debug, Clone, PartialEq)]
pub struct NewEnrolmentCheckOutcome {
    pub credit_registration_id: Uuid,
    pub course_module_id: Uuid,
    pub enrolment_check_group: EnrolmentCheckGroup,
    pub enrolment_check_step: Option<i32>,
    pub source: EnrolmentCheckSource,
    pub due_at: Option<DateTime<Utc>>,
    pub checked_at: DateTime<Utc>,
    pub previous_checked_at: Option<DateTime<Utc>>,
    pub is_enrolment_found: bool,
    pub enrolled_at: Option<DateTime<Utc>>,
}

pub async fn insert(conn: &mut PgConnection, new: &NewEnrolmentCheckOutcome) -> ModelResult<Uuid> {
    let id = sqlx::query_scalar!(
        r#"
INSERT INTO credit_registration_enrolment_check_outcomes (
    credit_registration_id,
    course_module_id,
    enrolment_check_group,
    enrolment_check_step,
    source,
    due_at,
    checked_at,
    previous_checked_at,
    is_enrolment_found,
    enrolled_at
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id
        "#,
        new.credit_registration_id,
        new.course_module_id,
        new.enrolment_check_group as EnrolmentCheckGroup,
        new.enrolment_check_step,
        new.source as EnrolmentCheckSource,
        new.due_at,
        new.checked_at,
        new.previous_checked_at,
        new.is_enrolment_found,
        new.enrolled_at,
    )
    .fetch_one(conn)
    .await?;
    Ok(id)
}

/// Deletes up to `limit` outcomes checked before `cutoff` and returns how many went.
pub async fn delete_older_than(
    conn: &mut PgConnection,
    cutoff: DateTime<Utc>,
    limit: i64,
) -> ModelResult<u64> {
    let res = sqlx::query!(
        r#"
DELETE FROM credit_registration_enrolment_check_outcomes
WHERE id IN (
    SELECT id
    FROM credit_registration_enrolment_check_outcomes
    WHERE checked_at < $1
    ORDER BY checked_at
    LIMIT $2
  )
        "#,
        cutoff,
        limit,
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected())
}

/// How late schedule checks of one group and step ran against their ladder time.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct EnrolmentCheckLateness {
    pub enrolment_check_group: EnrolmentCheckGroup,
    pub enrolment_check_step: i32,
    pub check_count: i64,
    pub p50_late_secs: f64,
    pub p95_late_secs: f64,
    pub max_late_secs: f64,
    /// Checks more than [`VERY_LATE_SECS`] late.
    pub very_late_count: i64,
}

/// Lateness of the schedule checks answered since `since`, per group and step. A check brought
/// forward by anything else has no lateness and is left out.
pub async fn get_lateness_since(
    conn: &mut PgConnection,
    since: DateTime<Utc>,
) -> ModelResult<Vec<EnrolmentCheckLateness>> {
    let res = sqlx::query_as!(
        EnrolmentCheckLateness,
        r#"
SELECT enrolment_check_group AS "enrolment_check_group!: EnrolmentCheckGroup",
  enrolment_check_step AS "enrolment_check_step!",
  COUNT(*) AS "check_count!",
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY late_secs
  ) AS "p50_late_secs!",
  PERCENTILE_CONT(0.95) WITHIN GROUP (
    ORDER BY late_secs
  ) AS "p95_late_secs!",
  MAX(late_secs) AS "max_late_secs!",
  COUNT(*) FILTER (
    WHERE late_secs > $2
  ) AS "very_late_count!"
FROM (
    SELECT enrolment_check_group,
      enrolment_check_step,
      GREATEST(EXTRACT(EPOCH FROM checked_at - due_at), 0)::double precision AS late_secs
    FROM credit_registration_enrolment_check_outcomes
    WHERE checked_at >= $1
      AND source = 'schedule'
      AND due_at IS NOT NULL
      AND enrolment_check_step IS NOT NULL
  ) checks
GROUP BY enrolment_check_group,
  enrolment_check_step
ORDER BY enrolment_check_group,
  enrolment_check_step
        "#,
        since,
        VERY_LATE_SECS as f64,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// What the checks of one group, step and source found.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct EnrolmentCheckFindings {
    pub enrolment_check_group: EnrolmentCheckGroup,
    /// `None` for checks of rows whose schedule had run out.
    pub enrolment_check_step: Option<i32>,
    pub source: EnrolmentCheckSource,
    pub check_count: i64,
    pub found_count: i64,
    /// Time from the enrolment, as Sisu records it, to the check that found it; over the finds
    /// that carry an enrolment time.
    pub p50_detection_secs: Option<f64>,
    pub p95_detection_secs: Option<f64>,
}

/// What the checks answered since `since` found, per group, step and source.
pub async fn get_findings_since(
    conn: &mut PgConnection,
    since: DateTime<Utc>,
) -> ModelResult<Vec<EnrolmentCheckFindings>> {
    let res = sqlx::query_as!(
        EnrolmentCheckFindings,
        r#"
SELECT enrolment_check_group AS "enrolment_check_group!: EnrolmentCheckGroup",
  enrolment_check_step,
  source AS "source!: EnrolmentCheckSource",
  COUNT(*) AS "check_count!",
  COUNT(*) FILTER (
    WHERE is_enrolment_found
  ) AS "found_count!",
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM checked_at - enrolled_at)::double precision
  ) FILTER (
    WHERE is_enrolment_found
      AND enrolled_at IS NOT NULL
  ) AS p50_detection_secs,
  PERCENTILE_CONT(0.95) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM checked_at - enrolled_at)::double precision
  ) FILTER (
    WHERE is_enrolment_found
      AND enrolled_at IS NOT NULL
  ) AS p95_detection_secs
FROM credit_registration_enrolment_check_outcomes
WHERE checked_at >= $1
GROUP BY enrolment_check_group,
  enrolment_check_step,
  source
ORDER BY enrolment_check_group,
  source,
  enrolment_check_step NULLS LAST
        "#,
        since,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// How many rows wait for an enrolment in one group and step.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct EnrolmentCheckPopulation {
    pub enrolment_check_group: EnrolmentCheckGroup,
    /// `None` for rows whose schedule has run out.
    pub enrolment_check_step: Option<i32>,
    pub row_count: i64,
    /// Of those, how many have never been checked.
    pub never_checked_count: i64,
}

/// The live rows waiting for an enrolment right now, per group and step.
pub async fn get_population(conn: &mut PgConnection) -> ModelResult<Vec<EnrolmentCheckPopulation>> {
    let res = sqlx::query_as!(
        EnrolmentCheckPopulation,
        r#"
SELECT enrolment_check_group AS "enrolment_check_group!: EnrolmentCheckGroup",
  enrolment_check_step,
  COUNT(*) AS "row_count!",
  COUNT(*) FILTER (
    WHERE enrolment_checked_at IS NULL
  ) AS "never_checked_count!"
FROM credit_registrations
WHERE state IN (
    'no_usable_enrolment',
    'ready_to_submit',
    'resolving_enrolment',
    'failed_retryable'
  )
  AND enrolment_check_anchor_at IS NOT NULL
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
GROUP BY enrolment_check_group,
  enrolment_check_step
ORDER BY enrolment_check_group,
  enrolment_check_step NULLS LAST
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
