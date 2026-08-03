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
