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
