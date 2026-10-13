//! The nightly hours when Finland is already on the next day but Sisu, which dates attainments by
//! the UTC day, is not: 00:00–03:00 Finnish time in summer, 00:00–02:00 in winter. Suotar dates an
//! attainment by its Finnish day, so one dated today is in the future for Sisu then, and Sisu
//! refuses it. Importing waits the gap out.

use chrono::TimeDelta;

use crate::prelude::*;

/// The gap starts this long before Finnish midnight, so a batch claimed just before it reaches
/// Sisu in time.
const SISU_DAY_GAP_LEAD: TimeDelta = TimeDelta::minutes(5);
/// The gap ends this long after UTC midnight, for clock differences between us, Suotar and Sisu.
const SISU_DAY_GAP_TAIL: TimeDelta = TimeDelta::minutes(5);
/// How long after the gap the imports it held back are spread over, so they do not all reach
/// Suotar the moment it ends.
const SISU_DAY_GAP_SPREAD: TimeDelta = TimeDelta::hours(2);

/// When the gap we are in ends, or `None` outside it. Read off the database's clock and time zone
/// data, which knows when Finland changes to and from summer time.
pub async fn current_gap_end(conn: &mut PgConnection) -> ModelResult<Option<DateTime<Utc>>> {
    let gap_end = sqlx::query_scalar!(
        r#"
SELECT CASE
    WHEN ((now() + make_interval(secs => $1)) AT TIME ZONE 'Europe/Helsinki')::date
      > ((now() - make_interval(secs => $2)) AT TIME ZONE 'UTC')::date
    THEN (
      ((now() + make_interval(secs => $1)) AT TIME ZONE 'Europe/Helsinki')::date::timestamp
        AT TIME ZONE 'UTC'
    ) + make_interval(secs => $2)
  END AS "gap_end?: DateTime<Utc>"
        "#,
        SISU_DAY_GAP_LEAD.num_seconds() as f64,
        SISU_DAY_GAP_TAIL.num_seconds() as f64,
    )
    .fetch_one(conn)
    .await?;
    Ok(gap_end)
}

/// Moves every import due before `gap_end` to a random moment in the [`SISU_DAY_GAP_SPREAD`]
/// after it. A moved row is no longer due before `gap_end`, so running this on every tick of the
/// gap moves each row once. Returns how many rows moved.
pub async fn spread_imports_past_gap(
    conn: &mut PgConnection,
    gap_end: DateTime<Utc>,
) -> ModelResult<u64> {
    let moved = sqlx::query!(
        r#"
UPDATE credit_registrations
SET next_attempt_at = $1 + random() * make_interval(secs => $2)
WHERE state = 'checking_enrolment'
  AND deleted_at IS NULL
  AND next_attempt_at < $1
        "#,
        gap_end,
        SISU_DAY_GAP_SPREAD.num_seconds() as f64,
    )
    .execute(conn)
    .await?;
    Ok(moved.rows_affected())
}
