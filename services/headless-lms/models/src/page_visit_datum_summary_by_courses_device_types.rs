use chrono::NaiveDate;

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PageVisitDatumSummaryByCourseDeviceTypes {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub country: Option<String>,
    pub browser: Option<String>,
    pub browser_version: Option<String>,
    pub operating_system: Option<String>,
    pub operating_system_version: Option<String>,
    pub device_type: Option<String>,
    pub course_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub num_visitors: i32,
    pub visit_date: NaiveDate,
}

/// Calculates the statistics for a single day.
pub async fn calculate_and_update_for_date(
    conn: &mut PgConnection,
    date: NaiveDate,
) -> ModelResult<Vec<PageVisitDatumSummaryByCourseDeviceTypes>> {
    let res = sqlx::query_as!(
        PageVisitDatumSummaryByCourseDeviceTypes,
        r#"
INSERT INTO page_visit_datum_summary_by_courses_device_types (
    course_id,
    exam_id,
    country,
    browser,
    browser_version,
    operating_system,
    operating_system_version,
    device_type,
    num_visitors,
    visit_date
  )
SELECT course_id,
  exam_id,
  country,
  browser,
  browser_version,
  operating_system,
  operating_system_version,
  device_type,
  COUNT(DISTINCT anonymous_identifier) AS num_visitors,
  $1 AS visit_date
FROM page_visit_datum
WHERE deleted_at IS NULL
  AND created_at::date = $1
  AND is_bot = FALSE
GROUP BY course_id,
  course_id,
  exam_id,
  country,
  browser,
  browser_version,
  operating_system,
  operating_system_version,
  device_type
  ON CONFLICT (
    course_id,
    exam_id,
    visit_date,
    country,
    browser,
    browser_version,
    operating_system,
    operating_system_version,
    device_type,
    deleted_at
  ) DO
UPDATE
SET num_visitors = EXCLUDED.num_visitors
RETURNING *;
"#,
        date
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}

pub async fn get_all_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<PageVisitDatumSummaryByCourseDeviceTypes>> {
    let res = sqlx::query_as!(
        PageVisitDatumSummaryByCourseDeviceTypes,
        r#"
SELECT *
FROM page_visit_datum_summary_by_courses_device_types
WHERE course_id = $1
  AND deleted_at IS NULL
"#,
        course_id
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}
