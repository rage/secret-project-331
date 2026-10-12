//! Enrolment discovery's per-module listing: which modules a roster request covers, and what the
//! last listing of each module and mooc.fi target found.

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
SELECT au.credit_unit_id AS "course_module_id!",
  au.course_id AS "course_id!",
  TRIM(au.uh_course_code) AS "uh_course_code!",
  co.language_code AS "course_language_code!"
FROM credit_registration_active_units au
  JOIN course_modules cm ON cm.id = au.credit_unit_id
  JOIN courses co ON co.id = au.course_id AND co.deleted_at IS NULL
WHERE TRIM(COALESCE(au.uh_course_code, '')) <> ''
  AND au.course_id = $1
ORDER BY cm.order_number,
  cm.id
        "#,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// One active module's or mooc.fi target's last successful listing, and whether the attempts since
/// then have been failing.
#[derive(Debug, Clone, PartialEq)]
pub struct ModuleDiscoveryReport {
    /// The module's or target's id.
    pub credit_unit_id: Uuid,
    /// The course's name, or "mooc.fi: " and the target's name.
    pub course_name: String,
    /// `None` for a mooc.fi target.
    pub course_module_name: Option<String>,
    pub uh_course_code: Option<String>,
    pub last_listed_at: Option<DateTime<Utc>>,
    pub last_listing_attempted_at: Option<DateTime<Utc>>,
    pub last_listing_error: Option<CreditRegistrationErrorCode>,
    pub consecutive_listing_failures: i32,
}

/// Every active module's and mooc.fi target's listing status, for the account-linking dashboard.
pub async fn get_active_discovery_reports(
    conn: &mut PgConnection,
) -> ModelResult<Vec<ModuleDiscoveryReport>> {
    let res = sqlx::query_as!(
        ModuleDiscoveryReport,
        r#"
SELECT r.credit_unit_id AS "credit_unit_id!",
  r.course_name AS "course_name!",
  r.course_module_name AS "course_module_name?",
  r.uh_course_code AS "uh_course_code?",
  r.last_listed_at AS "last_listed_at?",
  r.last_listing_attempted_at AS "last_listing_attempted_at?",
  r.last_listing_error AS "last_listing_error?: CreditRegistrationErrorCode",
  r.consecutive_listing_failures AS "consecutive_listing_failures!"
FROM (
    SELECT conf.course_module_id AS credit_unit_id,
      c.name AS course_name,
      cm.name AS course_module_name,
      cm.uh_course_code,
      conf.last_listed_at,
      conf.last_listing_attempted_at,
      conf.last_listing_error,
      conf.consecutive_listing_failures,
      cm.order_number
    FROM course_module_suotar_configurations conf
      JOIN credit_registration_active_units au ON au.credit_unit_id = conf.course_module_id
      JOIN course_modules cm ON cm.id = conf.course_module_id
      JOIN courses c ON c.id = cm.course_id
      AND c.deleted_at IS NULL
    WHERE conf.deleted_at IS NULL
    UNION ALL
    SELECT target.id,
      'mooc.fi: ' || target.name,
      NULL,
      target.uh_course_code,
      target.last_listed_at,
      target.last_listing_attempted_at,
      target.last_listing_error,
      target.consecutive_listing_failures,
      0
    FROM external_credit_targets target
      JOIN credit_registration_active_units au ON au.credit_unit_id = target.id
  ) r
ORDER BY r.course_name,
  r.order_number
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Records a listing attempt of a module or mooc.fi target whose roster never arrived.
/// `last_listed_at` keeps describing the last roster that did, because a failed listing must not
/// read as an empty course.
pub async fn mark_listing_failed(
    conn: &mut PgConnection,
    credit_unit_id: Uuid,
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
        credit_unit_id,
        error as CreditRegistrationErrorCode,
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        r#"
UPDATE external_credit_targets
SET last_listing_attempted_at = now(),
  last_listing_error = $2,
  consecutive_listing_failures = consecutive_listing_failures + 1
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        credit_unit_id,
        error as CreditRegistrationErrorCode,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records a listing of a module or mooc.fi target whose roster arrived and clears the failure
/// streak. `fed_linking` is whether account linking was on for it; only then does it move
/// `last_listed_at`. Sibling of [`mark_listing_failed`].
pub async fn mark_listing_succeeded(
    conn: &mut PgConnection,
    credit_unit_id: Uuid,
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
        credit_unit_id,
        fed_linking,
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        r#"
UPDATE external_credit_targets
SET last_listed_at = CASE
    WHEN $2 THEN now()
    ELSE last_listed_at
  END,
  last_listing_attempted_at = now(),
  last_listing_error = NULL,
  consecutive_listing_failures = 0
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        credit_unit_id,
        fed_linking,
    )
    .execute(conn)
    .await?;
    Ok(())
}
