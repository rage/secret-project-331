use chrono::NaiveDate;

use crate::prelude::*;

pub struct NewPageVisitDatum {
    pub course_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub page_id: Uuid,
    pub country: Option<String>,
    pub browser: Option<String>,
    pub browser_version: Option<String>,
    pub operating_system: Option<String>,
    pub operating_system_version: Option<String>,
    pub device_type: Option<String>,
    pub referrer: Option<String>,
    pub is_bot: bool,
    pub utm_source: Option<String>,
    pub utm_medium: Option<String>,
    pub utm_campaign: Option<String>,
    pub utm_term: Option<String>,
    pub utm_content: Option<String>,
    pub anonymous_identifier: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    new_page_visit_datum: NewPageVisitDatum,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO page_visit_datum (
    course_id,
    exam_id,
    page_id,
    country,
    browser,
    browser_version,
    operating_system,
    operating_system_version,
    device_type,
    referrer,
    is_bot,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    anonymous_identifier
  )
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12,
    $13,
    $14,
    $15,
    $16,
    $17
  )
RETURNING id
",
        new_page_visit_datum.course_id,
        new_page_visit_datum.exam_id,
        new_page_visit_datum.page_id,
        new_page_visit_datum.country,
        unknown_is_none(new_page_visit_datum.browser),
        unknown_is_none(new_page_visit_datum.browser_version),
        unknown_is_none(new_page_visit_datum.operating_system),
        unknown_is_none(new_page_visit_datum.operating_system_version),
        unknown_is_none(new_page_visit_datum.device_type),
        new_page_visit_datum.referrer,
        new_page_visit_datum.is_bot,
        new_page_visit_datum.utm_source,
        new_page_visit_datum.utm_medium,
        new_page_visit_datum.utm_campaign,
        new_page_visit_datum.utm_term,
        new_page_visit_datum.utm_content,
        new_page_visit_datum.anonymous_identifier
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

/// Woothee uses UNKNOWN instead of None, this fixes that
fn unknown_is_none(value: Option<String>) -> Option<String> {
    value.filter(|v| v != "UNKNOWN")
}

// Gets the oldest date there are some stastics for.
pub async fn get_oldest_date(conn: &mut PgConnection) -> ModelResult<Option<NaiveDate>> {
    let res = sqlx::query!(
        r#"
SELECT MIN(created_at) AS oldest_date
FROM page_visit_datum
WHERE deleted_at IS NULL
"#,
    )
    .fetch_optional(conn)
    .await?;

    Ok(res.and_then(|res| res.oldest_date.map(|d| d.date_naive())))
}
