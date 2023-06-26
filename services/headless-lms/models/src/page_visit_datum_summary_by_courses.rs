use chrono::NaiveDate;

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PageVisitDatumSummaryByCourse {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub country: Option<String>,
    pub device_type: Option<String>,
    pub referrer: Option<String>,
    pub utm_source: Option<String>,
    pub utm_medium: Option<String>,
    pub utm_campaign: Option<String>,
    pub utm_term: Option<String>,
    pub utm_content: Option<String>,
    pub num_visitors: i32,
    pub visit_date: NaiveDate,
}

/// Calculates the statistics for a single day.
pub async fn calculate_and_update_for_date(
    conn: &mut PgConnection,
    date: NaiveDate,
) -> ModelResult<Vec<PageVisitDatumSummaryByCourse>> {
    let res = sqlx::query_as!(
        PageVisitDatumSummaryByCourse,
        r#"
INSERT INTO page_visit_datum_summary_by_courses (
    course_id,
    exam_id,
    country,
    device_type,
    referrer,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    num_visitors,
    visit_date
  )
SELECT
  course_id,
  exam_id,
  country,
  device_type,
  referrer,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_term,
  utm_content,
  COUNT(DISTINCT anonymous_identifier) AS num_visitors,
  $1 AS visit_date
FROM page_visit_datum
WHERE deleted_at IS NULL
  AND created_at::date = $1
  AND is_bot = FALSE
GROUP BY course_id,
  exam_id,
  country,
  device_type,
  referrer,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_term,
  utm_content
  ON CONFLICT (
    course_id,
    exam_id,
    country,
    device_type,
    referrer,
    visit_date,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    deleted_at
  ) DO
UPDATE
SET num_visitors = EXCLUDED.num_visitors
RETURNING *
"#,
        date
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}

/// Gets the latest date for which the statistics have been calculated.
pub async fn get_latest_date(conn: &mut PgConnection) -> ModelResult<Option<NaiveDate>> {
    let res = sqlx::query!(
        r#"
SELECT MAX(visit_date) AS latest_date
FROM page_visit_datum_summary_by_courses
WHERE deleted_at IS NULL
"#,
    )
    .fetch_optional(conn)
    .await?;

    Ok(res.and_then(|r| r.latest_date))
}

pub async fn get_all_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<PageVisitDatumSummaryByCourse>> {
    let res = sqlx::query_as!(
        PageVisitDatumSummaryByCourse,
        r#"
SELECT *
FROM page_visit_datum_summary_by_courses
WHERE course_id = $1
AND deleted_at IS NULL
"#,
        course_id
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}
