//! When a partially registered row next looks for its course unit attainment. Sisu creates those in
//! a nightly batch, so a row polls once after it, on the morning slot, and again on the noon slot if
//! the morning poll came too early. A row that first shows its assessment item attainment during the
//! day waits for the next morning.

use chrono::TimeDelta;
use headless_lms_utils::backoff::next_attempt_at;

use crate::prelude::*;

/// Finnish wall-clock time of the daily poll, after Sisu's nightly course unit batch.
const MORNING_SLOT: TimeDelta = TimeDelta::minutes(7 * 60 + 15);
/// Finnish wall-clock time of the catch-up poll for a row the morning poll missed.
const CATCH_UP_SLOT: TimeDelta = TimeDelta::hours(12);
/// How long after its slot a poll may land, so the rows of one slot do not reach Suotar at once.
pub const SLOT_SPREAD: TimeDelta = TimeDelta::minutes(30);

/// The next course unit poll of each row, spread over the [`SLOT_SPREAD`] after its slot, in the
/// order of `first_seen_at`: when a poll first saw the row's assessment item attainment, or `now`
/// for a row whose poll may see it now.
pub async fn next_course_unit_polls(
    conn: &mut PgConnection,
    now: DateTime<Utc>,
    first_seen_at: &[DateTime<Utc>],
) -> ModelResult<Vec<DateTime<Utc>>> {
    Ok(next_slots(conn, now, first_seen_at)
        .await?
        .into_iter()
        .map(|slot| next_attempt_at(slot, 0, SLOT_SPREAD.num_seconds()))
        .collect())
}

/// Read off the database's time zone data, which knows when Finland changes to and from summer
/// time. Neither slot falls in the hour a change skips or repeats.
async fn next_slots(
    conn: &mut PgConnection,
    now: DateTime<Utc>,
    first_seen_at: &[DateTime<Utc>],
) -> ModelResult<Vec<DateTime<Utc>>> {
    let slots = sqlx::query_scalar!(
        r#"
SELECT (
    CASE
      WHEN slot.local_now < slot.morning THEN slot.morning
      WHEN slot.local_now < slot.catch_up
      AND slot.local_first_seen < slot.morning THEN slot.catch_up
      ELSE slot.morning + INTERVAL '1 day'
    END
  ) AT TIME ZONE 'Europe/Helsinki' AS "slot!: DateTime<Utc>"
FROM UNNEST($2::timestamptz []) WITH ORDINALITY AS seen(first_seen_at, position)
  CROSS JOIN LATERAL (
    SELECT $1::timestamptz AT TIME ZONE 'Europe/Helsinki' AS local_now,
      seen.first_seen_at AT TIME ZONE 'Europe/Helsinki' AS local_first_seen,
      ($1::timestamptz AT TIME ZONE 'Europe/Helsinki')::date + $3::interval AS morning,
      ($1::timestamptz AT TIME ZONE 'Europe/Helsinki')::date + $4::interval AS catch_up
  ) slot
ORDER BY seen.position
        "#,
        now,
        first_seen_at,
        MORNING_SLOT as TimeDelta,
        CATCH_UP_SLOT as TimeDelta,
    )
    .fetch_all(conn)
    .await?;
    Ok(slots)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;

    fn utc(at: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(at).unwrap().to_utc()
    }

    async fn slot(conn: &mut PgConnection, now: &str, first_seen_at: &str) -> DateTime<Utc> {
        next_slots(conn, utc(now), &[utc(first_seen_at)])
            .await
            .unwrap()[0]
    }

    #[tokio::test]
    async fn a_row_seen_overnight_polls_the_same_morning_and_then_at_noon() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let seen = "2027-01-12T03:30:00+02:00";
        assert_eq!(
            slot(tx.as_mut(), seen, seen).await,
            utc("2027-01-12T07:15:00+02:00")
        );
        assert_eq!(
            slot(tx.as_mut(), "2027-01-12T07:40:00+02:00", seen).await,
            utc("2027-01-12T12:00:00+02:00")
        );
        assert_eq!(
            slot(tx.as_mut(), "2027-01-12T12:20:00+02:00", seen).await,
            utc("2027-01-13T07:15:00+02:00")
        );
    }

    #[tokio::test]
    async fn a_row_seen_during_the_day_waits_for_the_next_morning() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let seen = "2026-08-10T09:00:00+03:00";
        assert_eq!(
            slot(tx.as_mut(), seen, seen).await,
            utc("2026-08-11T07:15:00+03:00")
        );
        let evening = "2026-08-10T22:00:00+03:00";
        assert_eq!(
            slot(tx.as_mut(), evening, evening).await,
            utc("2026-08-11T07:15:00+03:00")
        );
    }

    #[tokio::test]
    async fn slots_keep_finnish_wall_clock_time_across_summer_time_changes() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        // Summer time ends on the night to 2026-10-25.
        assert_eq!(
            slot(
                tx.as_mut(),
                "2026-10-24T12:30:00+03:00",
                "2026-10-24T03:00:00+03:00"
            )
            .await,
            utc("2026-10-25T07:15:00+02:00")
        );
        let in_the_repeated_hour = "2026-10-25T03:30:00+03:00";
        assert_eq!(
            slot(tx.as_mut(), in_the_repeated_hour, in_the_repeated_hour).await,
            utc("2026-10-25T07:15:00+02:00")
        );
        // Summer time starts on the night to 2027-03-28.
        assert_eq!(
            slot(
                tx.as_mut(),
                "2027-03-27T13:00:00+02:00",
                "2027-03-27T13:00:00+02:00"
            )
            .await,
            utc("2027-03-28T07:15:00+03:00")
        );
        assert_eq!(
            slot(
                tx.as_mut(),
                "2027-03-28T07:30:00+03:00",
                "2027-03-28T02:30:00+02:00"
            )
            .await,
            utc("2027-03-28T12:00:00+03:00")
        );
    }
}
