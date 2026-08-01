use utoipa::ToSchema;

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseModuleSuotarConfiguration {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_module_id: Uuid,
    pub open_university_product_id: Option<String>,
    /// `None` means derive the grade scale from the completion.
    pub grade_scale_id: Option<String>,
    pub paused_at: Option<DateTime<Utc>>,
    pub paused_by_user_id: Option<Uuid>,
    pub pause_reason: Option<String>,
    pub config_checked_at: Option<DateTime<Utc>>,
    /// `None` means never checked, which is not the same as a failed check.
    pub course_code_resolves: Option<bool>,
    pub product_token_found: Option<bool>,
    pub config_check_message: Option<String>,
}

/// The open university products whose access tokens are worth refreshing: those configured on an
/// enabled, unpaused module, stalest first. One product can back several modules, so each appears
/// once.
pub async fn get_stalest_product_ids_for_enabled_modules(
    conn: &mut PgConnection,
    limit: i64,
    course_id: Option<Uuid>,
) -> ModelResult<Vec<String>> {
    let res = sqlx::query_scalar!(
        r#"
SELECT c.open_university_product_id AS "open_university_product_id!"
FROM course_module_suotar_configurations c
  JOIN course_modules cm ON cm.id = c.course_module_id
  LEFT JOIN open_university_product_access_tokens t ON t.open_university_product_id = c.open_university_product_id
  AND t.deleted_at IS NULL
WHERE c.open_university_product_id IS NOT NULL
  AND c.paused_at IS NULL
  AND c.deleted_at IS NULL
  AND cm.enable_credit_registration_via_suotar
  AND cm.deleted_at IS NULL
  AND ($2::uuid IS NULL OR cm.course_id = $2)
GROUP BY c.open_university_product_id,
  t.last_refreshed_at
ORDER BY t.last_refreshed_at ASC NULLS FIRST,
  c.open_university_product_id
LIMIT $1
        "#,
        limit,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Writes the module's Suotar configuration, creating the row if the module has none. The pause and
/// config-check columns are left alone; their writers are separate.
///
/// Resurrects a soft-deleted row rather than inserting beside it: `ON CONFLICT` can only infer
/// against `uq_course_module_suotar_configurations`, which is keyed on `course_module_id` alone.
pub async fn upsert(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    open_university_product_id: Option<&str>,
    grade_scale_id: Option<&str>,
) -> ModelResult<CourseModuleSuotarConfiguration> {
    let res = sqlx::query_as!(
        CourseModuleSuotarConfiguration,
        r#"
INSERT INTO course_module_suotar_configurations (
    course_module_id,
    open_university_product_id,
    grade_scale_id
  )
VALUES ($1, $2, $3) ON CONFLICT (course_module_id) DO
UPDATE
SET open_university_product_id = $2,
  grade_scale_id = $3,
  deleted_at = NULL
RETURNING *
        "#,
        course_module_id,
        open_university_product_id,
        grade_scale_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
