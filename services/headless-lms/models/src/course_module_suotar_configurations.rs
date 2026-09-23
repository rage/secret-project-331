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
    /// `None` means derive the grade scale from the completion.
    pub grade_scale_id: Option<String>,
    pub paused_at: Option<DateTime<Utc>>,
    pub paused_by_user_id: Option<Uuid>,
    pub pause_reason: Option<String>,
    pub config_checked_at: Option<DateTime<Utc>>,
    /// `None` means never checked, which is not the same as a failed check.
    pub course_code_resolves: Option<bool>,
    pub config_check_message: Option<String>,
    pub last_listing_attempted_at: Option<DateTime<Utc>>,
    pub last_listed_at: Option<DateTime<Utc>>,
    pub last_listing_error: Option<CreditRegistrationErrorCode>,
    pub consecutive_listing_failures: i32,
    pub last_listed_person_count: Option<i32>,
    pub last_already_linked_count: Option<i32>,
    pub last_mailed_count: Option<i32>,
    pub last_suppressed_by_dedup_count: Option<i32>,
    pub last_suppressed_by_rate_cap_count: Option<i32>,
    pub last_no_address_count: Option<i32>,
    pub last_fast_tracked_count: Option<i32>,
    pub last_fast_track_skipped_no_account_count: Option<i32>,
    pub last_fast_track_skipped_unverified_count: Option<i32>,
    pub last_fast_track_skipped_stale_verification_count: Option<i32>,
    pub last_fast_track_skipped_name_mismatch_count: Option<i32>,
    pub last_fast_track_skipped_account_has_number_count: Option<i32>,
    pub last_fast_track_skipped_unlinked_before_count: Option<i32>,
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
    grade_scale_id: Option<&str>,
) -> ModelResult<CourseModuleSuotarConfiguration> {
    let res = sqlx::query_as!(
        CourseModuleSuotarConfiguration,
        r#"
INSERT INTO course_module_suotar_configurations (course_module_id, grade_scale_id)
VALUES ($1, $2) ON CONFLICT (course_module_id) DO
UPDATE
SET grade_scale_id = $2,
  deleted_at = NULL
RETURNING id,
  created_at,
  updated_at,
  deleted_at,
  course_module_id,
  grade_scale_id,
  paused_at,
  paused_by_user_id,
  pause_reason,
  config_checked_at,
  course_code_resolves,
  config_check_message,
  last_listing_attempted_at,
  last_listed_at,
  last_listing_error AS "last_listing_error?: CreditRegistrationErrorCode",
  consecutive_listing_failures,
  last_listed_person_count,
  last_already_linked_count,
  last_mailed_count,
  last_suppressed_by_dedup_count,
  last_suppressed_by_rate_cap_count,
  last_no_address_count,
  last_fast_tracked_count,
  last_fast_track_skipped_no_account_count,
  last_fast_track_skipped_unverified_count,
  last_fast_track_skipped_stale_verification_count,
  last_fast_track_skipped_name_mismatch_count,
  last_fast_track_skipped_account_has_number_count,
  last_fast_track_skipped_unlinked_before_count
        "#,
        course_module_id,
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
    pub grade_scale_id: Option<String>,
    /// The old pull path is on as well, which would register the same completion twice.
    pub old_flow_also_enabled: bool,
    /// The course code has been listed successfully, which proves it.
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
  c.grade_scale_id AS "grade_scale_id?",
  cm.enable_registering_completion_to_uh_open_university AS "old_flow_also_enabled!",
  COALESCE(c.last_listed_at IS NOT NULL, FALSE) AS "listed_successfully!",
  COALESCE(c.last_listing_error = $2, FALSE) AS "course_code_not_found!",
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
    /// Where a student with no usable enrolment is sent to enrol.
    pub enrolment_link: Option<String>,
    pub grade_scale_id: Option<String>,
    pub old_flow_also_enabled: bool,
    pub paused_at: Option<DateTime<Utc>>,
    pub pause_reason: Option<String>,
    pub config_checked_at: Option<DateTime<Utc>>,
    pub course_code_resolves: Option<bool>,
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
  conf.grade_scale_id AS "grade_scale_id?",
  cm.enable_registering_completion_to_uh_open_university AS "old_flow_also_enabled!",
  conf.paused_at AS "paused_at?",
  conf.pause_reason AS "pause_reason?",
  conf.config_checked_at AS "config_checked_at?",
  conf.course_code_resolves AS "course_code_resolves?",
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
  JOIN courses c ON c.id = cm.course_id
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

/// Enabled modules the last check found broken. A module nothing has checked yet is not counted:
/// unknown is not a failure.
///
/// Counts the stored message, not the boolean, so the tab badge matches the Courses tab's own
/// "misconfigured" tile. The boolean covers only the course code, while [`check_module_config`]
/// also reports missing credits, an unusable grade scale and a double-enabled registration path.
///
/// [`check_module_config`]: crate::library::credit_registration::config_validation::check_module_config
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
    pub course_code_resolves: Option<bool>,
    /// Every problem found, in one line for the Courses tab. `None` means the module is fine.
    pub message: Option<String>,
}

/// Stamps the check result on the module, creating the configuration row for a module that has
/// none: an enabled module with no configuration is itself one of the problems being reported.
///
/// Resurrects a soft-deleted row for the same reason [`upsert`] does: `ON CONFLICT` can only infer
/// against `uq_course_module_suotar_configurations`, so an insert beside one is impossible.
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
    config_check_message
  )
VALUES ($1, now(), $2, $3) ON CONFLICT (course_module_id) DO
UPDATE
SET config_checked_at = now(),
  course_code_resolves = $2,
  config_check_message = $3,
  deleted_at = NULL
        "#,
        course_module_id,
        check.course_code_resolves,
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

/// Outcome counters for one enrolment-discovery run over one module. Written whole, so the
/// dashboard never mixes two runs.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ModuleListingOutcome {
    pub listed_person_count: i32,
    pub already_linked_count: i32,
    pub mailed_count: i32,
    pub suppressed_by_dedup_count: i32,
    pub suppressed_by_rate_cap_count: i32,
    pub no_address_count: i32,
    pub fast_tracked_count: i32,
    pub fast_track_skipped_no_account_count: i32,
    pub fast_track_skipped_unverified_count: i32,
    pub fast_track_skipped_stale_verification_count: i32,
    pub fast_track_skipped_name_mismatch_count: i32,
    pub fast_track_skipped_account_has_number_count: i32,
    pub fast_track_skipped_unlinked_before_count: i32,
}

/// An active module and the facts a `list-by-course` request for it needs.
#[derive(Debug, Clone, PartialEq)]
pub struct ModuleToList {
    pub course_module_id: Uuid,
    pub course_id: Uuid,
    pub uh_course_code: String,
    /// The language the mails this listing sets off are written in.
    pub course_language_code: String,
}

/// Claims the modules one discovery iteration lists, stalest attempt first. Only modules with a
/// course code are listable.
///
/// Locks the configuration rows `FOR UPDATE SKIP LOCKED` and stamps `last_listing_attempted_at` in
/// the same transaction the caller commits before dropping the connection: the stamp is what keeps a
/// second concurrent run from reselecting the same modules once the lock is released ahead of the
/// (potentially slow) Suotar call.
///
/// Attempts order the queue rather than successes, so a module that keeps failing cannot starve the
/// rest.
pub async fn claim_stalest_modules_for_listing(
    conn: &mut PgConnection,
    limit: i64,
    course_id: Option<Uuid>,
) -> ModelResult<Vec<ModuleToList>> {
    // The stamp and the lock need a row to live on.
    sqlx::query!(
        r#"
INSERT INTO course_module_suotar_configurations (course_module_id)
SELECT acm.course_module_id
FROM credit_registration_active_course_modules acm
  JOIN course_modules cm ON cm.id = acm.course_module_id
WHERE TRIM(COALESCE(cm.uh_course_code, '')) <> ''
  AND ($1::uuid IS NULL OR acm.course_id = $1) ON CONFLICT (course_module_id) DO NOTHING
        "#,
        course_id,
    )
    .execute(&mut *conn)
    .await?;
    let res = sqlx::query_as!(
        ModuleToList,
        r#"
SELECT acm.course_module_id AS "course_module_id!",
  acm.course_id AS "course_id!",
  TRIM(cm.uh_course_code) AS "uh_course_code!",
  co.language_code AS "course_language_code!"
FROM credit_registration_active_course_modules acm
  JOIN course_modules cm ON cm.id = acm.course_module_id
  JOIN courses co ON co.id = acm.course_id
  JOIN course_module_suotar_configurations conf ON conf.course_module_id = acm.course_module_id
  AND conf.deleted_at IS NULL
WHERE TRIM(COALESCE(cm.uh_course_code, '')) <> ''
  AND ($2::uuid IS NULL OR acm.course_id = $2)
ORDER BY COALESCE(conf.last_listing_attempted_at, conf.last_listed_at) ASC NULLS FIRST,
  conf.id
LIMIT $1
FOR UPDATE OF conf SKIP LOCKED
        "#,
        limit,
        course_id,
    )
    .fetch_all(&mut *conn)
    .await?;
    let ids: Vec<Uuid> = res.iter().map(|row| row.course_module_id).collect();
    if !ids.is_empty() {
        sqlx::query!(
            r#"
UPDATE course_module_suotar_configurations
SET last_listing_attempted_at = now()
WHERE course_module_id = ANY($1)
  AND deleted_at IS NULL
            "#,
            &ids,
        )
        .execute(conn)
        .await?;
    }
    Ok(res)
}

/// Every active, listable module of one course, unpaginated: unlike
/// [`claim_stalest_modules_for_listing`], which pages by staleness for the scheduler, this one must
/// not miss any of them.
pub async fn get_active_modules_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<ModuleToList>> {
    let res = sqlx::query_as!(
        ModuleToList,
        r#"
SELECT acm.course_module_id AS "course_module_id!",
  acm.course_id AS "course_id!",
  TRIM(cm.uh_course_code) AS "uh_course_code!",
  co.language_code AS "course_language_code!"
FROM credit_registration_active_course_modules acm
  JOIN course_modules cm ON cm.id = acm.course_module_id
  JOIN courses co ON co.id = acm.course_id
WHERE TRIM(COALESCE(cm.uh_course_code, '')) <> ''
  AND acm.course_id = $1
ORDER BY cm.order_number,
  cm.id
        "#,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// One active module's counters from its last successful discovery run, and whether the attempts
/// since then have been failing. Point-in-time, not a windowed sum: the phase overwrites the row
/// whole, so every surface rendering them has to say so.
#[derive(Debug, Clone, PartialEq)]
pub struct ModuleDiscoveryReport {
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub uh_course_code: Option<String>,
    pub last_listed_at: Option<DateTime<Utc>>,
    pub last_listed_person_count: Option<i32>,
    pub last_already_linked_count: Option<i32>,
    pub last_mailed_count: Option<i32>,
    pub last_suppressed_by_dedup_count: Option<i32>,
    pub last_suppressed_by_rate_cap_count: Option<i32>,
    pub last_no_address_count: Option<i32>,
    pub last_fast_tracked_count: Option<i32>,
    pub last_fast_track_skipped_no_account_count: Option<i32>,
    pub last_fast_track_skipped_unverified_count: Option<i32>,
    pub last_fast_track_skipped_stale_verification_count: Option<i32>,
    pub last_fast_track_skipped_name_mismatch_count: Option<i32>,
    pub last_fast_track_skipped_account_has_number_count: Option<i32>,
    pub last_fast_track_skipped_unlinked_before_count: Option<i32>,
    pub last_listing_attempted_at: Option<DateTime<Utc>>,
    pub last_listing_error: Option<CreditRegistrationErrorCode>,
    pub consecutive_listing_failures: i32,
}

pub async fn get_active_discovery_reports(
    conn: &mut PgConnection,
) -> ModelResult<Vec<ModuleDiscoveryReport>> {
    let res = sqlx::query_as!(
        ModuleDiscoveryReport,
        r#"
SELECT cm.course_id,
  c.name AS course_name,
  conf.course_module_id,
  cm.name AS course_module_name,
  cm.uh_course_code,
  conf.last_listed_at,
  conf.last_listed_person_count,
  conf.last_already_linked_count,
  conf.last_mailed_count,
  conf.last_suppressed_by_dedup_count,
  conf.last_suppressed_by_rate_cap_count,
  conf.last_no_address_count,
  conf.last_fast_tracked_count,
  conf.last_fast_track_skipped_no_account_count,
  conf.last_fast_track_skipped_unverified_count,
  conf.last_fast_track_skipped_stale_verification_count,
  conf.last_fast_track_skipped_name_mismatch_count,
  conf.last_fast_track_skipped_account_has_number_count,
  conf.last_fast_track_skipped_unlinked_before_count,
  conf.last_listing_attempted_at,
  conf.last_listing_error AS "last_listing_error?: CreditRegistrationErrorCode",
  conf.consecutive_listing_failures
FROM course_module_suotar_configurations conf
  JOIN credit_registration_active_course_modules acm ON acm.course_module_id = conf.course_module_id
  JOIN course_modules cm ON cm.id = conf.course_module_id
  JOIN courses c ON c.id = cm.course_id
WHERE conf.deleted_at IS NULL
  AND c.deleted_at IS NULL
ORDER BY c.name,
  cm.order_number
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Records a listing attempt whose roster never arrived. `last_listed_at` and the counters keep
/// describing the last roster that did, because zeroing them would make a failed listing read as an
/// empty course.
pub async fn mark_listing_failed(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    error: CreditRegistrationErrorCode,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE course_module_suotar_configurations
SET last_listing_attempted_at = now(),
  last_listing_error = $2,
  consecutive_listing_failures = consecutive_listing_failures + 1
WHERE course_module_id = $1
  AND deleted_at IS NULL
        "#,
        course_module_id,
        error as CreditRegistrationErrorCode,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn record_listing_outcome(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    outcome: &ModuleListingOutcome,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE course_module_suotar_configurations
SET last_listed_at = now(),
  last_listing_attempted_at = now(),
  last_listing_error = NULL,
  consecutive_listing_failures = 0,
  last_listed_person_count = $2,
  last_already_linked_count = $3,
  last_mailed_count = $4,
  last_suppressed_by_dedup_count = $5,
  last_suppressed_by_rate_cap_count = $6,
  last_no_address_count = $7,
  last_fast_tracked_count = $8,
  last_fast_track_skipped_no_account_count = $9,
  last_fast_track_skipped_unverified_count = $10,
  last_fast_track_skipped_stale_verification_count = $11,
  last_fast_track_skipped_name_mismatch_count = $12,
  last_fast_track_skipped_account_has_number_count = $13,
  last_fast_track_skipped_unlinked_before_count = $14
WHERE course_module_id = $1
  AND deleted_at IS NULL
        "#,
        course_module_id,
        outcome.listed_person_count,
        outcome.already_linked_count,
        outcome.mailed_count,
        outcome.suppressed_by_dedup_count,
        outcome.suppressed_by_rate_cap_count,
        outcome.no_address_count,
        outcome.fast_tracked_count,
        outcome.fast_track_skipped_no_account_count,
        outcome.fast_track_skipped_unverified_count,
        outcome.fast_track_skipped_stale_verification_count,
        outcome.fast_track_skipped_name_mismatch_count,
        outcome.fast_track_skipped_account_has_number_count,
        outcome.fast_track_skipped_unlinked_before_count,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// How many persons the last discovery run refused to fast-track because the registry's name did
/// not look like the matched account's, summed over the active modules.
///
/// A last-run value, not a window: the counters are overwritten whole on every run.
pub async fn sum_last_fast_track_name_mismatches(conn: &mut PgConnection) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COALESCE(
    SUM(conf.last_fast_track_skipped_name_mismatch_count),
    0
  ) AS "count!"
FROM course_module_suotar_configurations conf
  JOIN credit_registration_active_course_modules acm ON acm.course_module_id = conf.course_module_id
WHERE conf.deleted_at IS NULL
        "#,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}
