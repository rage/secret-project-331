//! The row itself, and the Courses tab's overview of every enabled module.

use crate::credit_registrations::CreditRegistrationErrorCode;
use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseModuleSuotarConfiguration {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_module_id: Uuid,
    pub paused_at: Option<DateTime<Utc>>,
    pub paused_by_user_id: Option<Uuid>,
    pub pause_reason: Option<String>,
    pub config_checked_at: Option<DateTime<Utc>>,
    /// `None` means never checked, which is not the same as a failed check.
    pub course_code_allowed: Option<bool>,
    pub config_check_message: Option<String>,
    /// The course code `course_code_allowed` is a verdict on.
    pub checked_course_code: Option<String>,
    /// Suotar's reason for not accepting `checked_course_code`.
    pub course_code_rejection: Option<String>,
    pub last_listing_attempted_at: Option<DateTime<Utc>>,
    pub last_listed_at: Option<DateTime<Utc>>,
    pub last_listing_error: Option<CreditRegistrationErrorCode>,
    pub consecutive_listing_failures: i32,
}

/// Whether the module already has a live configuration row. Lets a caller tell "nothing to store"
/// apart from "the teacher cleared what was stored", which look the same in an edit payload.
pub async fn exists(conn: &mut PgConnection, course_module_id: Uuid) -> ModelResult<bool> {
    let res = sqlx::query_scalar!(
        r#"
SELECT EXISTS (
    SELECT 1
    FROM course_module_suotar_configurations
    WHERE course_module_id = $1
      AND deleted_at IS NULL
  ) AS "exists!"
        "#,
        course_module_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Gives the module a live configuration row, which the pause and config-check writers update.
///
/// Resurrects a soft-deleted row rather than inserting beside it: `ON CONFLICT` can only infer
/// against `uq_course_module_suotar_configurations`, which is keyed on `course_module_id` alone.
pub async fn ensure_exists(conn: &mut PgConnection, course_module_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO course_module_suotar_configurations (course_module_id)
VALUES ($1) ON CONFLICT (course_module_id) DO
UPDATE
SET deleted_at = NULL
        "#,
        course_module_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// A Suotar-enabled module as the Courses tab lists it: what it is configured with, what the last
/// check concluded, and how much work it has produced.
///
/// The stored verdict may be older than the configuration; `config_checked_at` is `None` for a
/// module nothing has checked yet, which is not the same as one checked and found broken.
#[derive(Debug, Clone, PartialEq)]
pub struct SuotarModuleOverview {
    pub course_module_id: Uuid,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_name: Option<String>,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    /// Where a student with no usable enrolment is sent to enrol.
    pub enrolment_link: Option<String>,
    pub paused_at: Option<DateTime<Utc>>,
    pub pause_reason: Option<String>,
    pub config_checked_at: Option<DateTime<Utc>>,
    pub course_code_allowed: Option<bool>,
    pub config_check_message: Option<String>,
    pub last_listed_at: Option<DateTime<Utc>>,
    /// Every passed, ECTS-eligible completion on the module, whichever path owns it. Wider than
    /// what `materialize` takes, which is only the ones carrying `register_credits_via_suotar`.
    pub eligible_completion_count: i64,
}

/// Every Suotar-enabled module, one row each, ordered by course then module order.
pub async fn get_module_overviews(
    conn: &mut PgConnection,
    limit: i64,
) -> ModelResult<Vec<SuotarModuleOverview>> {
    let res = sqlx::query_as!(
        SuotarModuleOverview,
        r#"
SELECT cm.id AS "course_module_id!",
  cm.course_id AS "course_id!",
  c.name AS "course_name!",
  cm.name AS course_module_name,
  cm.uh_course_code,
  cm.ects_credits,
  NULLIF(TRIM(cm.completion_registration_link_override), '') AS "enrolment_link?",
  conf.paused_at AS "paused_at?",
  conf.pause_reason AS "pause_reason?",
  conf.config_checked_at AS "config_checked_at?",
  conf.course_code_allowed AS "course_code_allowed?",
  conf.config_check_message AS "config_check_message?",
  conf.last_listed_at AS "last_listed_at?",
  (
    SELECT COUNT(*)
    FROM course_module_completions cmc
    WHERE cmc.course_module_id = cm.id
      AND cmc.deleted_at IS NULL
      AND cmc.passed
      AND cmc.eligible_for_ects
  ) AS "eligible_completion_count!"
FROM course_modules cm
  JOIN courses c ON c.id = cm.course_id AND c.deleted_at IS NULL
  LEFT JOIN course_module_suotar_configurations conf ON conf.course_module_id = cm.id
  AND conf.deleted_at IS NULL
WHERE cm.enable_credit_registration_via_suotar
  AND cm.deleted_at IS NULL
ORDER BY c.name,
  cm.order_number
LIMIT $1
        "#,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
