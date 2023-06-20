use chrono::NaiveDate;

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PageViewDailyReferrerStat {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub referrer: Option<String>,
    pub page_id: Uuid,
    pub course_id: Uuid,
    pub num_visitors: i32,
    pub visit_date: NaiveDate,
}

/// Gets the latest date there are some stastics for.
pub async fn get_latest_date(conn: &mut PgConnection) -> ModelResult<Option<NaiveDate>> {
    let res = sqlx::query!(
        r#"
SELECT MAX(visit_date) AS latest_date
FROM page_view_daily_referrer_stats
WHERE deleted_at IS NULL
"#,
    )
    .fetch_optional(conn)
    .await?;

    Ok(res.and_then(|res| res.latest_date))
}

/// Calculates the statistics for a single day.
pub async fn calculate_and_update_for_date(
    conn: &mut PgConnection,
    date: NaiveDate,
) -> ModelResult<Option<PageViewDailyReferrerStat>> {
    let res = sqlx::query_as!(
        PageViewDailyReferrerStat,
        r#"
INSERT INTO page_view_daily_referrer_stats (
    referrer,
    page_id,
    course_id,
    num_visitors,
    visit_date
  )
SELECT referrer,
  page_id,
  course_id,
  COUNT(DISTINCT anonymous_identifier) AS num_visitors,
  $1 AS visit_date
FROM page_visit_datum
WHERE deleted_at IS NULL
  AND created_at::date = $1
GROUP BY referrer,
  page_id,
  course_id ON CONFLICT (
    page_id,
    course_id,
    visit_date,
    referrer,
    deleted_at
  ) DO
UPDATE
SET num_visitors = EXCLUDED.num_visitors
RETURNING *
"#,
        date
    )
    .fetch_optional(conn)
    .await?;

    Ok(res)
}
