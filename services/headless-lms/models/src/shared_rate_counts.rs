//! Fixed-window counters shared by every server instance, for limits that must hold across them.

use crate::prelude::*;

/// Counts one more event for `key` in each of `windows` (window length in seconds) and returns the
/// counts after counting, in the same order. Keys are keyed hashes; see the callers.
pub async fn increment(
    conn: &mut PgConnection,
    key: &[u8],
    windows: &[i64],
) -> ModelResult<Vec<i64>> {
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
  count
"#,
        key,
        &lengths,
    )
    .fetch_all(conn)
    .await?;
    Ok(lengths
        .iter()
        .map(|length| {
            rows.iter()
                .find(|row| row.window_seconds == *length)
                .map_or(0, |row| i64::from(row.count))
        })
        .collect())
}

/// The current counts of `key` in each of `windows`, without counting.
pub async fn current(
    conn: &mut PgConnection,
    key: &[u8],
    windows: &[i64],
) -> ModelResult<Vec<i64>> {
    let counts = sqlx::query_scalar!(
        r#"
SELECT coalesce(t.count, 0) AS "count!"
FROM unnest($2::integer []) WITH ORDINALITY AS w(seconds, position)
  LEFT JOIN shared_rate_counts t ON t.key_digest = $1
  AND t.window_seconds = w.seconds
  AND t.window_start = to_timestamp(floor(extract(epoch FROM now()) / w.seconds) * w.seconds)
ORDER BY w.position
"#,
        key,
        &window_lengths(windows)?,
    )
    .fetch_all(conn)
    .await?;
    Ok(counts.into_iter().map(i64::from).collect())
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
