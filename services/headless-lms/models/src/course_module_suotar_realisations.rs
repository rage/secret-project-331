use utoipa::ToSchema;

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseModuleSuotarRealisation {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_module_id: Uuid,
    pub course_unit_realisation_id: String,
    pub label: Option<String>,
    pub active: bool,
    pub last_listed_at: Option<DateTime<Utc>>,
    pub last_listed_person_count: Option<i32>,
    pub last_already_linked_count: Option<i32>,
    pub last_mailed_count: Option<i32>,
    pub last_suppressed_by_dedup_count: Option<i32>,
    pub last_suppressed_by_rate_cap_count: Option<i32>,
    pub last_no_address_count: Option<i32>,
}

/// Outcome counters for one enrolment-discovery run over one realisation. Written whole, so the
/// dashboard never mixes two runs.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct RealisationListingOutcome {
    pub listed_person_count: i32,
    pub already_linked_count: i32,
    pub mailed_count: i32,
    pub suppressed_by_dedup_count: i32,
    pub suppressed_by_rate_cap_count: i32,
    pub no_address_count: i32,
}

pub async fn upsert(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    course_unit_realisation_id: &str,
    label: Option<&str>,
    active: bool,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        r#"
INSERT INTO course_module_suotar_realisations (
    course_module_id,
    course_unit_realisation_id,
    label,
    active
  )
VALUES ($1, $2, $3, $4) ON CONFLICT (
    course_module_id,
    course_unit_realisation_id,
    deleted_at
  ) DO
UPDATE
SET label = $3,
  active = $4
RETURNING id
        "#,
        course_module_id,
        course_unit_realisation_id,
        label,
        active,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_course_module_id(
    conn: &mut PgConnection,
    course_module_id: Uuid,
) -> ModelResult<Vec<CourseModuleSuotarRealisation>> {
    let res = sqlx::query_as!(
        CourseModuleSuotarRealisation,
        r#"
SELECT *
FROM course_module_suotar_realisations
WHERE course_module_id = $1
  AND deleted_at IS NULL
ORDER BY created_at
        "#,
        course_module_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Realisations enrolment discovery should poll: active, on an enabled module that is not paused.
pub async fn get_all_active_for_enabled_modules(
    conn: &mut PgConnection,
) -> ModelResult<Vec<CourseModuleSuotarRealisation>> {
    let res = sqlx::query_as!(
        CourseModuleSuotarRealisation,
        r#"
SELECT cmsr.*
FROM course_module_suotar_realisations cmsr
  JOIN course_modules cm ON cm.id = cmsr.course_module_id
  LEFT JOIN course_module_suotar_configurations c ON c.course_module_id = cm.id
  AND c.deleted_at IS NULL
WHERE cmsr.active
  AND cmsr.deleted_at IS NULL
  AND cm.enable_credit_registration_via_suotar
  AND c.paused_at IS NULL
  AND cm.deleted_at IS NULL
ORDER BY cmsr.last_listed_at ASC NULLS FIRST
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn record_listing_outcome(
    conn: &mut PgConnection,
    id: Uuid,
    outcome: &RealisationListingOutcome,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE course_module_suotar_realisations
SET last_listed_at = now(),
  last_listed_person_count = $2,
  last_already_linked_count = $3,
  last_mailed_count = $4,
  last_suppressed_by_dedup_count = $5,
  last_suppressed_by_rate_cap_count = $6,
  last_no_address_count = $7
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        outcome.listed_person_count,
        outcome.already_linked_count,
        outcome.mailed_count,
        outcome.suppressed_by_dedup_count,
        outcome.suppressed_by_rate_cap_count,
        outcome.no_address_count,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn soft_delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE course_module_suotar_realisations
SET deleted_at = now()
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}
