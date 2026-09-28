//! Enrolment discovery's per-module listing: which modules a roster request covers, and what the
//! last listing of each found.

use crate::credit_registrations::CreditRegistrationErrorCode;
use crate::prelude::*;

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

/// Every active, listable module of one course, unpaginated.
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
    pub last_listing_attempted_at: Option<DateTime<Utc>>,
    pub last_listing_error: Option<CreditRegistrationErrorCode>,
    pub consecutive_listing_failures: i32,
}

/// Every active module's last discovery counters, for the account-linking dashboard.
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
  conf.last_listing_attempted_at,
  conf.last_listing_error AS "last_listing_error?",
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

/// Records a listing whose roster arrived while account linking is switched off: clears the failure
/// streak, but leaves `last_listed_at` and the counters describing the last run that fed linking.
/// Sibling of [`record_listing_outcome`].
pub async fn mark_listing_succeeded_without_linking(
    conn: &mut PgConnection,
    course_module_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE course_module_suotar_configurations
SET last_listing_attempted_at = now(),
  last_listing_error = NULL,
  consecutive_listing_failures = 0
WHERE course_module_id = $1
  AND deleted_at IS NULL
        "#,
        course_module_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records a listing whose roster arrived: overwrites every counter and clears the failure streak.
/// Sibling of [`mark_listing_failed`].
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
  last_no_address_count = $7
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
    )
    .execute(conn)
    .await?;
    Ok(())
}
