//! Daily queue depth per ledger state, and per timeline step with the Needs attention count.
//!
//! The ledger holds current state only, so a row that passed through a state in an hour leaves no
//! depth trace. Aggregates only: anything per-person belongs in the ledger.
use chrono::NaiveDate;
use utoipa::ToSchema;

use crate::credit_registrations::{CreditRegistrationState, StepCount};
use crate::library::credit_registration::timeline::{Engagement, TimelineStep};
use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CreditRegistrationDailySnapshot {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub snapshot_date: NaiveDate,
    pub state: CreditRegistrationState,
    pub count: i32,
    pub entered_count: i32,
    pub left_count: i32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DailyStateCounts {
    pub state: CreditRegistrationState,
    pub count: i32,
    pub entered_count: i32,
    pub left_count: i32,
}

/// One row per state, whether or not anything is in it: a state missing from a day would read as a
/// gap in the chart rather than as an empty queue.
///
/// `count` is the depth right now, so this has to be called on the day it describes.
/// `entered_count`/`left_count` come from the transitions inside `[day_start, day_end)`, which the
/// caller passes explicitly: `snapshot_date` alone would make the day boundary depend on the
/// database's timezone.
pub async fn count_states_for_day(
    conn: &mut PgConnection,
    day_start: DateTime<Utc>,
    day_end: DateTime<Utc>,
) -> ModelResult<Vec<DailyStateCounts>> {
    let states = CreditRegistrationState::ALL.to_vec();
    let res = sqlx::query_as!(
        DailyStateCounts,
        r#"
WITH depth AS (
  SELECT state,
    COUNT(*)::int AS count
  FROM credit_registrations
  WHERE deleted_at IS NULL
    -- As in `credit_registrations::count_by_state`, which feeds the funnel and the alerts off the
    -- same states: counting replaced attempts here would make the two disagree on every course
    -- that regrades.
    AND superseded_by_id IS NULL
  GROUP BY state
),
-- A transition writes one event carrying both ends, so entering and leaving are the same rows read
-- from either side. A self-transition is neither.
flow AS (
  SELECT from_state,
    to_state
  FROM credit_registration_events
  WHERE deleted_at IS NULL
    AND created_at >= $2
    AND created_at < $3
    AND from_state IS DISTINCT FROM to_state
)
SELECT s.state AS "state!: CreditRegistrationState",
  COALESCE(depth.count, 0) AS "count!",
  (
    SELECT COUNT(*)::int
    FROM flow
    WHERE flow.to_state = s.state
  ) AS "entered_count!",
  (
    SELECT COUNT(*)::int
    FROM flow
    WHERE flow.from_state = s.state
  ) AS "left_count!"
FROM UNNEST($1::credit_registration_state []) AS s(state)
  LEFT JOIN depth ON depth.state = s.state
        "#,
        &states as &[CreditRegistrationState],
        day_start,
        day_end,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Writes one day's counts. Idempotent, so a re-run cannot double-count.
pub async fn write_snapshot_for_date(
    conn: &mut PgConnection,
    snapshot_date: NaiveDate,
    counts: &[DailyStateCounts],
) -> ModelResult<()> {
    for row in counts {
        sqlx::query!(
            r#"
INSERT INTO credit_registration_daily_snapshots (
    snapshot_date,
    state,
    count,
    entered_count,
    left_count
  )
VALUES ($1, $2, $3, $4, $5) ON CONFLICT (snapshot_date, state, deleted_at) DO
UPDATE
SET count = $3,
  entered_count = $4,
  left_count = $5
            "#,
            snapshot_date,
            row.state as CreditRegistrationState,
            row.count,
            row.entered_count,
            row.left_count,
        )
        .execute(&mut *conn)
        .await?;
    }
    Ok(())
}

pub async fn get_between(
    conn: &mut PgConnection,
    from: NaiveDate,
    to: NaiveDate,
) -> ModelResult<Vec<CreditRegistrationDailySnapshot>> {
    let res = sqlx::query_as!(
        CreditRegistrationDailySnapshot,
        r#"
SELECT *
FROM credit_registration_daily_snapshots
WHERE snapshot_date BETWEEN $1 AND $2
  AND deleted_at IS NULL
ORDER BY snapshot_date,
  state
        "#,
        from,
        to,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// One timeline step's count on one day.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct DailyStepCount {
    pub snapshot_date: NaiveDate,
    pub step: TimelineStep,
    pub engagement: Option<Engagement>,
    pub count: i32,
}

/// Writes one day's counts per step and engagement, as
/// [`count_by_step_and_engagement`](crate::credit_registrations::count_by_step_and_engagement)
/// returns them summed over modules. Idempotent.
pub async fn write_step_snapshot_for_date(
    conn: &mut PgConnection,
    snapshot_date: NaiveDate,
    counts: &[StepCount],
) -> ModelResult<()> {
    let mut totals: Vec<(TimelineStep, Option<Engagement>, i64)> = Vec::new();
    for row in counts {
        match totals
            .iter_mut()
            .find(|(step, engagement, _)| *step == row.step && *engagement == row.engagement)
        {
            Some(total) => total.2 += row.count,
            None => totals.push((row.step, row.engagement, row.count)),
        }
    }
    let steps: Vec<TimelineStep> = totals.iter().map(|total| total.0).collect();
    let engagements: Vec<Option<Engagement>> = totals.iter().map(|total| total.1).collect();
    let step_counts: Vec<i32> = totals
        .iter()
        .map(|total| i32::try_from(total.2).unwrap_or(i32::MAX))
        .collect();
    let mut tx = conn.begin().await?;
    // A step emptied since an earlier run today must not keep that run's count.
    sqlx::query!(
        r#"
DELETE FROM credit_registration_daily_step_snapshots
WHERE snapshot_date = $1
        "#,
        snapshot_date,
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        r#"
INSERT INTO credit_registration_daily_step_snapshots (
    snapshot_date,
    timeline_step,
    engagement,
    count
  )
SELECT $1,
  u.step,
  u.engagement,
  u.count
FROM UNNEST(
    $2::credit_registration_timeline_step [],
    $3::credit_registration_engagement [],
    $4::int []
  ) AS u(step, engagement, count)
        "#,
        snapshot_date,
        &steps as &[TimelineStep],
        &engagements as &[Option<Engagement>],
        &step_counts,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// Writes one day's Needs attention count. Idempotent.
pub async fn write_attention_snapshot_for_date(
    conn: &mut PgConnection,
    snapshot_date: NaiveDate,
    needs_attention_count: i64,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO credit_registration_daily_attention_snapshots (snapshot_date, needs_attention_count)
VALUES ($1, $2) ON CONFLICT (snapshot_date, deleted_at) DO
UPDATE
SET needs_attention_count = $2
        "#,
        snapshot_date,
        i32::try_from(needs_attention_count).unwrap_or(i32::MAX),
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_step_counts_between(
    conn: &mut PgConnection,
    from: NaiveDate,
    to: NaiveDate,
) -> ModelResult<Vec<DailyStepCount>> {
    let res = sqlx::query_as!(
        DailyStepCount,
        r#"
SELECT snapshot_date,
  timeline_step AS "step: TimelineStep",
  engagement AS "engagement: Engagement",
  count
FROM credit_registration_daily_step_snapshots
WHERE snapshot_date BETWEEN $1 AND $2
  AND deleted_at IS NULL
ORDER BY snapshot_date
        "#,
        from,
        to,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The Needs attention count per day that has one.
pub async fn get_attention_counts_between(
    conn: &mut PgConnection,
    from: NaiveDate,
    to: NaiveDate,
) -> ModelResult<Vec<(NaiveDate, i32)>> {
    let rows = sqlx::query!(
        r#"
SELECT snapshot_date,
  needs_attention_count
FROM credit_registration_daily_attention_snapshots
WHERE snapshot_date BETWEEN $1 AND $2
  AND deleted_at IS NULL
ORDER BY snapshot_date
        "#,
        from,
        to,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.snapshot_date, row.needs_attention_count))
        .collect())
}
