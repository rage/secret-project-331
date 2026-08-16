use utoipa::ToSchema;

use crate::credit_registrations::CreditRegistrationErrorCode;
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

/// The products whose access tokens are worth refreshing: those configured on an enabled, unpaused
/// module, least recently attempted first. One product can back several modules, so each appears
/// once.
///
/// Ordered by the last attempt rather than the last success, so a product whose refresh keeps
/// failing rotates to the back instead of holding the head of the queue and starving everything
/// behind it.
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
  t.last_refreshed_at,
  t.last_refresh_failed_at
ORDER BY GREATEST(t.last_refreshed_at, t.last_refresh_failed_at) ASC NULLS FIRST,
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

/// Everything the per-module configuration check reads, gathered in one query so validating every
/// enabled module costs one pass rather than a fan-out per module.
#[derive(Debug, Clone, PartialEq)]
pub struct SuotarModuleConfigFacts {
    pub course_module_id: Uuid,
    pub course_id: Uuid,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    pub open_university_product_id: Option<String>,
    pub grade_scale_id: Option<String>,
    /// The old pull path is on as well, which would register the same completion twice.
    pub old_flow_also_enabled: bool,
    /// A token we could actually build an enrolment link from, not merely a row.
    pub product_token_found: bool,
    pub active_realisation_count: i64,
    /// At least one active realisation has been listed successfully, which proves the course code.
    pub listed_successfully: bool,
    pub course_code_not_found: bool,
    /// A numeric grade scale override cannot map these, so the override and the module disagree.
    pub has_passed_completions_without_a_grade: bool,
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
  c.open_university_product_id AS "open_university_product_id?",
  c.grade_scale_id AS "grade_scale_id?",
  cm.enable_registering_completion_to_uh_open_university AS "old_flow_also_enabled!",
  EXISTS (
    SELECT 1
    FROM open_university_product_access_tokens t
    WHERE t.open_university_product_id = c.open_university_product_id
      AND t.access_token IS NOT NULL
      AND t.deleted_at IS NULL
  ) AS "product_token_found!",
  COALESCE(r.active_realisation_count, 0) AS "active_realisation_count!",
  COALESCE(r.listed_successfully, FALSE) AS "listed_successfully!",
  COALESCE(r.course_code_not_found, FALSE) AS "course_code_not_found!",
  EXISTS (
    SELECT 1
    FROM course_module_completions cmc
    WHERE cmc.course_module_id = cm.id
      AND cmc.passed
      AND cmc.grade IS NULL
      AND cmc.deleted_at IS NULL
  ) AS "has_passed_completions_without_a_grade!"
FROM course_modules cm
  LEFT JOIN course_module_suotar_configurations c ON c.course_module_id = cm.id
  AND c.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS active_realisation_count,
      BOOL_OR(cmsr.last_listed_at IS NOT NULL) AS listed_successfully,
      BOOL_OR(cmsr.last_listing_error = $2) AS course_code_not_found
    FROM course_module_suotar_realisations cmsr
    WHERE cmsr.course_module_id = cm.id
      AND cmsr.active
      AND cmsr.deleted_at IS NULL
  ) r ON TRUE
WHERE cm.enable_credit_registration_via_suotar
  AND cm.deleted_at IS NULL
  AND ($1::uuid IS NULL OR cm.course_id = $1)
ORDER BY cm.course_id,
  cm.order_number
        "#,
        course_id,
        CreditRegistrationErrorCode::CourseCodeNotFound as CreditRegistrationErrorCode,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
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
    pub open_university_product_id: Option<String>,
    pub grade_scale_id: Option<String>,
    pub old_flow_also_enabled: bool,
    pub paused_at: Option<DateTime<Utc>>,
    pub pause_reason: Option<String>,
    pub config_checked_at: Option<DateTime<Utc>>,
    pub course_code_resolves: Option<bool>,
    pub product_token_found: Option<bool>,
    pub config_check_message: Option<String>,
    pub active_realisation_count: i64,
    pub last_listed_at: Option<DateTime<Utc>>,
    /// Completions `materialize` would take. The ledger count beside it is what makes an unfinished
    /// backfill visible.
    pub eligible_completion_count: i64,
}

/// Every Suotar-enabled module, one row each, ordered by course then module order.
pub async fn get_module_overviews(
    conn: &mut PgConnection,
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
  conf.open_university_product_id AS "open_university_product_id?",
  conf.grade_scale_id AS "grade_scale_id?",
  cm.enable_registering_completion_to_uh_open_university AS "old_flow_also_enabled!",
  conf.paused_at AS "paused_at?",
  conf.pause_reason AS "pause_reason?",
  conf.config_checked_at AS "config_checked_at?",
  conf.course_code_resolves AS "course_code_resolves?",
  conf.product_token_found AS "product_token_found?",
  conf.config_check_message AS "config_check_message?",
  COALESCE(r.active_realisation_count, 0) AS "active_realisation_count!",
  r.last_listed_at AS "last_listed_at?",
  (
    SELECT COUNT(*)
    FROM course_module_completions cmc
    WHERE cmc.course_module_id = cm.id
      AND cmc.deleted_at IS NULL
      AND cmc.passed
      AND cmc.eligible_for_ects
  ) AS "eligible_completion_count!"
FROM course_modules cm
  JOIN courses c ON c.id = cm.course_id
  LEFT JOIN course_module_suotar_configurations conf ON conf.course_module_id = cm.id
  AND conf.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS active_realisation_count,
      MAX(cmsr.last_listed_at) AS last_listed_at
    FROM course_module_suotar_realisations cmsr
    WHERE cmsr.course_module_id = cm.id
      AND cmsr.active
      AND cmsr.deleted_at IS NULL
  ) r ON TRUE
WHERE cm.enable_credit_registration_via_suotar
  AND cm.deleted_at IS NULL
ORDER BY c.name,
  cm.order_number
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Enabled modules the last check found broken. A module nothing has checked yet is not counted:
/// unknown is not a failure.
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
  AND (
    conf.course_code_resolves IS FALSE
    OR conf.product_token_found IS FALSE
  )
        "#,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// What one configuration check concluded. `None` on either boolean means the check could not
/// reach an answer, which the dashboard renders as "unknown" rather than as a failure.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct SuotarConfigCheck {
    pub course_code_resolves: Option<bool>,
    pub product_token_found: Option<bool>,
    /// Every problem found, in one line for the Courses tab. `None` means the module is fine.
    pub message: Option<String>,
}

/// Stamps the check result on the module, creating the configuration row for a module that has
/// none: an enabled module with no configuration is itself one of the problems being reported.
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
    course_code_resolves,
    product_token_found,
    config_check_message
  )
VALUES ($1, now(), $2, $3, $4) ON CONFLICT (course_module_id) DO
UPDATE
SET config_checked_at = now(),
  course_code_resolves = $2,
  product_token_found = $3,
  config_check_message = $4
        "#,
        course_module_id,
        check.course_code_resolves,
        check.product_token_found,
        check.message,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Who paused a module's credit registration, and why. One value rather than three arguments
/// because `course_module_suotar_configurations_pause_pair` rejects a timestamp without an actor.
#[derive(Debug, Clone)]
pub struct SuotarPause<'a> {
    pub paused_at: DateTime<Utc>,
    pub paused_by_user_id: Uuid,
    pub reason: Option<&'a str>,
}

/// Pauses or resumes the module. Every phase's claim query skips a paused module, so pausing freezes
/// its ledger rows where they stand instead of cancelling them. `None` resumes.
pub async fn set_paused(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    pause: Option<SuotarPause<'_>>,
) -> ModelResult<()> {
    let pause = pause.as_ref();
    sqlx::query!(
        r#"
UPDATE course_module_suotar_configurations
SET paused_at = $2,
  paused_by_user_id = $3,
  pause_reason = $4
WHERE course_module_id = $1
  AND deleted_at IS NULL
        "#,
        course_module_id,
        pause.map(|pause| pause.paused_at),
        pause.map(|pause| pause.paused_by_user_id),
        pause.and_then(|pause| pause.reason),
    )
    .execute(conn)
    .await?;
    Ok(())
}
