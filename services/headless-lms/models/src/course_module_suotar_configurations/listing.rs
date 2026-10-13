//! Enrolment discovery's per-module listing: which modules a roster request covers, and what the
//! last listing of each found.

use crate::credit_registrations::CreditRegistrationErrorCode;
use crate::prelude::*;

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
  JOIN course_modules cm ON cm.id = acm.course_module_id AND cm.deleted_at IS NULL
  JOIN courses co ON co.id = acm.course_id AND co.deleted_at IS NULL
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

/// One active module's last successful listing, and whether the attempts since then have been
/// failing.
#[derive(Debug, Clone, PartialEq)]
pub struct ModuleDiscoveryReport {
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub uh_course_code: Option<String>,
    pub last_listed_at: Option<DateTime<Utc>>,
    pub last_listing_attempted_at: Option<DateTime<Utc>>,
    pub last_listing_error: Option<CreditRegistrationErrorCode>,
    pub consecutive_listing_failures: i32,
}

/// Every active module's listing status, for the account-linking dashboard.
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
  conf.last_listing_attempted_at,
  conf.last_listing_error AS "last_listing_error?",
  conf.consecutive_listing_failures
FROM course_module_suotar_configurations conf
  JOIN credit_registration_active_course_modules acm ON acm.course_module_id = conf.course_module_id
  JOIN course_modules cm ON cm.id = conf.course_module_id AND cm.deleted_at IS NULL
  JOIN courses c ON c.id = cm.course_id AND c.deleted_at IS NULL
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

/// Records a listing attempt whose roster never arrived. `last_listed_at` keeps describing the last
/// roster that did, because a failed listing must not read as an empty course.
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

/// Records a listing whose roster arrived and clears the failure streak. `fed_linking` is whether
/// account linking was on for it; only then does it move `last_listed_at`. Sibling of
/// [`mark_listing_failed`].
pub async fn mark_listing_succeeded(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    fed_linking: bool,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE course_module_suotar_configurations
SET last_listed_at = CASE
    WHEN $2 THEN now()
    ELSE last_listed_at
  END,
  last_listing_attempted_at = now(),
  last_listing_error = NULL,
  consecutive_listing_failures = 0
WHERE course_module_id = $1
  AND deleted_at IS NULL
        "#,
        course_module_id,
        fed_linking,
    )
    .execute(conn)
    .await?;
    Ok(())
}
