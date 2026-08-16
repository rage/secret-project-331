//! Daily queue depth per ledger state.
//!
//! The ledger holds current state only, so a row that passed through a state in an hour leaves no
//! depth trace. Aggregates only: anything per-person belongs in the ledger.
use chrono::NaiveDate;
use utoipa::ToSchema;

use crate::credit_registrations::CreditRegistrationState;
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

pub async fn get_series_for_state(
    conn: &mut PgConnection,
    state: CreditRegistrationState,
    from: NaiveDate,
    to: NaiveDate,
) -> ModelResult<Vec<CreditRegistrationDailySnapshot>> {
    let res = sqlx::query_as!(
        CreditRegistrationDailySnapshot,
        r#"
SELECT *
FROM credit_registration_daily_snapshots
WHERE state = $1
  AND snapshot_date BETWEEN $2 AND $3
  AND deleted_at IS NULL
ORDER BY snapshot_date
        "#,
        state as CreditRegistrationState,
        from,
        to,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
