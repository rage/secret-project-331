//! Fixed-window counters shared by every server instance, for limits that must hold across them.

use crate::prelude::*;

/// A key's count in the window of one length that contains the database's `now()`.
#[derive(Debug, Clone, Copy)]
pub struct WindowCount {
    pub count: i64,
    pub ends_at: DateTime<Utc>,
}

/// Counts one more event for `key` in each of `windows` (window length in seconds) and returns the
/// windows after counting, in the same order. Keys are keyed hashes; see the callers. The server
/// counts through `shared_limits::increment`, which also deletes old windows.
pub async fn increment(
    conn: &mut PgConnection,
    key: &[u8],
    windows: &[i64],
) -> ModelResult<Vec<WindowCount>> {
    let lengths = window_lengths(windows)?;
    let rows = sqlx::query!(
        r#"
INSERT INTO shared_rate_counts AS t (key_digest, window_seconds, window_start, count)
SELECT DISTINCT $1::bytea,
  seconds,
  to_timestamp(floor(extract(epoch FROM now()) / seconds) * seconds),
  1
FROM unnest($2::integer []) AS w(seconds)
ON CONFLICT (key_digest, window_seconds, window_start) DO UPDATE
SET count = t.count + 1
RETURNING window_seconds,
  count,
  window_start + make_interval(secs => window_seconds) AS "ends_at!"
"#,
        key,
        &lengths,
    )
    .fetch_all(conn)
    .await?;
    lengths
        .iter()
        .map(|length| {
            rows.iter()
                .find(|row| row.window_seconds == *length)
                .map(|row| WindowCount {
                    count: i64::from(row.count),
                    ends_at: row.ends_at,
                })
                .ok_or_else(|| {
                    model_err!(Generic, format!("No count returned for window {length}"))
                })
        })
        .collect()
}

/// The current windows of `key` for each of `windows`, without counting.
pub async fn current(
    conn: &mut PgConnection,
    key: &[u8],
    windows: &[i64],
) -> ModelResult<Vec<WindowCount>> {
    let rows = sqlx::query!(
        r#"
SELECT coalesce(t.count, 0) AS "count!",
  w.start + make_interval(secs => w.seconds) AS "ends_at!"
FROM (
    SELECT seconds,
      position,
      to_timestamp(floor(extract(epoch FROM now()) / seconds) * seconds) AS start
    FROM unnest($2::integer []) WITH ORDINALITY AS u(seconds, position)
  ) w
  LEFT JOIN shared_rate_counts t ON t.key_digest = $1
  AND t.window_seconds = w.seconds
  AND t.window_start = w.start
ORDER BY w.position
"#,
        key,
        &window_lengths(windows)?,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| WindowCount {
            count: i64::from(row.count),
            ends_at: row.ends_at,
        })
        .collect())
}

/// Estimated events of `key` in the last `window_seconds`, without counting: the current window plus
/// the previous one, weighted by how much of it the last `window_seconds` still cover.
pub async fn sliding_count(
    conn: &mut PgConnection,
    key: &[u8],
    window_seconds: i64,
) -> ModelResult<f64> {
    let window_seconds = window_lengths(&[window_seconds])?[0];
    let count = sqlx::query_scalar!(
        r#"
WITH w AS (
  SELECT to_timestamp(floor(extract(epoch FROM now()) / $2::integer) * $2::integer) AS start,
    extract(epoch FROM now()) / $2::integer - floor(extract(epoch FROM now()) / $2::integer) AS elapsed_fraction
)
SELECT coalesce(
    sum(
      t.count * CASE
        WHEN t.window_start = w.start THEN 1
        ELSE 1 - w.elapsed_fraction
      END
    ),
    0
  )::float8 AS "count!"
FROM w
  LEFT JOIN shared_rate_counts t ON t.key_digest = $1
  AND t.window_seconds = $2::integer
  AND t.window_start >= w.start - make_interval(secs => $2::integer)
"#,
        key,
        window_seconds,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// Hard-deletes windows that ended over a day ago.
pub async fn delete_old(conn: &mut PgConnection) -> ModelResult<u64> {
    let result = sqlx::query!(
        r#"
DELETE FROM shared_rate_counts
-- Implied by the next condition, but lets the window_start index narrow the scan.
WHERE window_start < now() - INTERVAL '1 day'
  AND window_start + make_interval(secs => window_seconds) < now() - INTERVAL '1 day'
"#
    )
    .execute(conn)
    .await?;
    Ok(result.rows_affected())
}

fn window_lengths(windows: &[i64]) -> ModelResult<Vec<i32>> {
    windows
        .iter()
        .map(|window| {
            i32::try_from(*window).map_err(|_| {
                model_err!(
                    InvalidRequest,
                    format!("Window length {window} is out of range")
                )
            })
        })
        .collect()
}
