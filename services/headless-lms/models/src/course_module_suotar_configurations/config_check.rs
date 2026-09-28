//! The configuration check: what it reads about each enabled module, and what it concluded.

use crate::prelude::*;

/// Everything the per-module configuration check reads, gathered in one query so validating every
/// enabled module costs one pass rather than a fan-out per module.
#[derive(Debug, Clone, PartialEq)]
pub struct SuotarModuleConfigFacts {
    pub course_module_id: Uuid,
    pub course_id: Uuid,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    /// The module has a completion registration link override, the enrolment link students without
    /// a usable enrolment are sent to.
    pub has_enrolment_link: bool,
    /// Suotar's verdict on the current course code from the last check; `None` if there is none or
    /// the code has changed since.
    pub stored_course_code_allowed: Option<bool>,
    pub stored_course_code_rejection: Option<String>,
}

/// Every Suotar-enabled module's configuration facts, optionally narrowed to one course. Paused
/// modules are included: a paused module's configuration is exactly what an operator is about to
/// fix.
pub async fn get_config_facts_for_enabled_modules(
    conn: &mut PgConnection,
    course_id: Option<Uuid>,
) -> ModelResult<Vec<SuotarModuleConfigFacts>> {
    let res = sqlx::query_as!(
        SuotarModuleConfigFacts,
        r#"
SELECT cm.id AS "course_module_id!",
  cm.course_id AS "course_id!",
  cm.uh_course_code,
  cm.ects_credits,
  COALESCE(TRIM(cm.completion_registration_link_override) <> '', FALSE) AS "has_enrolment_link!",
  CASE
    WHEN c.checked_course_code = TRIM(cm.uh_course_code) THEN c.course_code_allowed
  END AS "stored_course_code_allowed?",
  CASE
    WHEN c.checked_course_code = TRIM(cm.uh_course_code) THEN c.course_code_rejection
  END AS "stored_course_code_rejection?"
FROM course_modules cm
  LEFT JOIN course_module_suotar_configurations c ON c.course_module_id = cm.id
  AND c.deleted_at IS NULL
WHERE cm.enable_credit_registration_via_suotar
  AND cm.deleted_at IS NULL
  AND ($1::uuid IS NULL OR cm.course_id = $1)
ORDER BY cm.course_id,
  cm.order_number
        "#,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Enabled modules the last check found broken. A module nothing has checked yet is not counted:
/// unknown is not a failure.
///
/// Counts the stored message, not the boolean, so the tab badge matches the Courses tab's own
/// "misconfigured" tile. The boolean covers only the course code, while [`check_module_config`]
/// also reports missing credits, a missing enrolment link and a double-enabled registration path.
///
/// [`check_module_config`]:
/// crate::library::credit_registration::config_validation::check_module_config
pub async fn count_modules_failing_config_check(conn: &mut PgConnection) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM course_module_suotar_configurations conf
  JOIN course_modules cm ON cm.id = conf.course_module_id
WHERE cm.enable_credit_registration_via_suotar
  AND cm.deleted_at IS NULL
  AND conf.deleted_at IS NULL
  AND conf.config_checked_at IS NOT NULL
  AND conf.config_check_message IS NOT NULL
        "#,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// What one configuration check concluded. `None` means the check could not reach an answer, which
/// the dashboard renders as "unknown" rather than as a failure.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct SuotarConfigCheck {
    pub course_code_allowed: Option<bool>,
    /// The course code `course_code_allowed` is about; `None` along with it.
    pub checked_course_code: Option<String>,
    pub course_code_rejection: Option<String>,
    /// Every problem found, in one line for the Courses tab. `None` means the module is fine.
    pub message: Option<String>,
}

/// Stamps the check result on the module, creating the configuration row for a module that has
/// none: an enabled module with no configuration is itself one of the problems being reported.
///
/// Resurrects a soft-deleted row for the same reason [`ensure_exists`](super::ensure_exists) does:
/// `ON CONFLICT` can only infer against `uq_course_module_suotar_configurations`, so an insert
/// beside one is impossible.
pub async fn record_config_check(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    check: &SuotarConfigCheck,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO course_module_suotar_configurations (
    course_module_id,
    config_checked_at,
    course_code_allowed,
    config_check_message,
    checked_course_code,
    course_code_rejection
  )
VALUES ($1, now(), $2, $3, $4, $5) ON CONFLICT (course_module_id) DO
UPDATE
SET config_checked_at = now(),
  course_code_allowed = $2,
  config_check_message = $3,
  checked_course_code = $4,
  course_code_rejection = $5,
  deleted_at = NULL
        "#,
        course_module_id,
        check.course_code_allowed,
        check.message,
        check.checked_course_code,
        check.course_code_rejection,
    )
    .execute(conn)
    .await?;
    Ok(())
}
