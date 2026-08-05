use utoipa::ToSchema;

use crate::course_modules::CourseModuleSuotarRealisationEdit;
use crate::credit_registrations::CreditRegistrationErrorCode;
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
    pub last_listing_attempted_at: Option<DateTime<Utc>>,
    pub last_listing_error: Option<CreditRegistrationErrorCode>,
    pub consecutive_listing_failures: i32,
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

/// Makes the module's live realisations exactly `wanted`, soft-deleting the rest rather than setting
/// `active = false`, which means "configured but not polled now".
pub async fn replace_for_course_module(
    conn: &mut PgConnection,
    course_module_id: Uuid,
    wanted: &[CourseModuleSuotarRealisationEdit],
) -> ModelResult<()> {
    let existing = get_by_course_module_id(conn, course_module_id).await?;
    let kept: Vec<&str> = wanted
        .iter()
        .map(|row| row.course_unit_realisation_id.trim())
        .filter(|id| !id.is_empty())
        .collect();
    for row in existing {
        if !kept.contains(&row.course_unit_realisation_id.as_str()) {
            soft_delete(conn, row.id).await?;
        }
    }
    for row in wanted {
        let realisation_id = row.course_unit_realisation_id.trim();
        if realisation_id.is_empty() {
            continue;
        }
        let label = row
            .label
            .as_deref()
            .map(str::trim)
            .filter(|l| !l.is_empty());
        upsert(conn, course_module_id, realisation_id, label, row.active).await?;
    }
    Ok(())
}

pub async fn get_by_course_module_id(
    conn: &mut PgConnection,
    course_module_id: Uuid,
) -> ModelResult<Vec<CourseModuleSuotarRealisation>> {
    let res = sqlx::query_as!(
        CourseModuleSuotarRealisation,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  course_module_id,
  course_unit_realisation_id,
  label,
  active,
  last_listed_at,
  last_listed_person_count,
  last_already_linked_count,
  last_mailed_count,
  last_suppressed_by_dedup_count,
  last_suppressed_by_rate_cap_count,
  last_no_address_count,
  last_listing_attempted_at,
  last_listing_error AS "last_listing_error?: CreditRegistrationErrorCode",
  consecutive_listing_failures
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

pub async fn get_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CourseModuleSuotarRealisation>> {
    let res = sqlx::query_as!(
        CourseModuleSuotarRealisation,
        r#"
SELECT cmsr.id,
  cmsr.created_at,
  cmsr.updated_at,
  cmsr.deleted_at,
  cmsr.course_module_id,
  cmsr.course_unit_realisation_id,
  cmsr.label,
  cmsr.active,
  cmsr.last_listed_at,
  cmsr.last_listed_person_count,
  cmsr.last_already_linked_count,
  cmsr.last_mailed_count,
  cmsr.last_suppressed_by_dedup_count,
  cmsr.last_suppressed_by_rate_cap_count,
  cmsr.last_no_address_count,
  cmsr.last_listing_attempted_at,
  cmsr.last_listing_error AS "last_listing_error?: CreditRegistrationErrorCode",
  cmsr.consecutive_listing_failures
FROM course_module_suotar_realisations cmsr
  JOIN course_modules cm ON cm.id = cmsr.course_module_id
WHERE cm.course_id = $1
  AND cmsr.deleted_at IS NULL
  AND cm.deleted_at IS NULL
ORDER BY cm.order_number,
  cmsr.created_at
        "#,
        course_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The id `list-by-course` echoes back for one realisation. Derived rather than stored, so the
/// realisation stays greppable in both call logs without a ledger row.
pub fn listing_request_item_id(realisation_id: Uuid) -> String {
    format!("cur-{realisation_id}")
}

/// A realisation and the module facts a `list-by-course` request for it needs.
#[derive(Debug, Clone, PartialEq)]
pub struct RealisationToList {
    pub id: Uuid,
    pub course_module_id: Uuid,
    pub course_id: Uuid,
    pub course_unit_realisation_id: String,
    /// `None` means the module has no course code configured, so it cannot be listed.
    pub uh_course_code: Option<String>,
}

/// Claims the realisations one discovery iteration takes, stalest attempt first.
///
/// Locks the rows `FOR UPDATE SKIP LOCKED` and stamps `last_listing_attempted_at` in the same
/// transaction the caller commits before dropping the connection: the stamp is what keeps a second
/// concurrent run from reselecting the same realisations once the lock itself is released ahead of
/// the (potentially slow) Suotar call.
///
/// Ordering only: due-ness comes from the phase's own interval, never from the timestamps. Attempts
/// order the queue rather than successes, so a realisation that keeps failing cannot starve the rest.
pub async fn claim_stalest_for_listing(
    conn: &mut PgConnection,
    limit: i64,
    course_id: Option<Uuid>,
) -> ModelResult<Vec<RealisationToList>> {
    let res = sqlx::query_as!(
        RealisationToList,
        r#"
SELECT cmsr.id AS "id!",
  cmsr.course_module_id AS "course_module_id!",
  cm.course_id AS "course_id!",
  cmsr.course_unit_realisation_id AS "course_unit_realisation_id!",
  cm.uh_course_code AS "uh_course_code?"
FROM course_module_suotar_realisations cmsr
  JOIN course_modules cm ON cm.id = cmsr.course_module_id
  LEFT JOIN course_module_suotar_configurations c ON c.course_module_id = cm.id
  AND c.deleted_at IS NULL
WHERE cmsr.active
  AND cmsr.deleted_at IS NULL
  AND cm.enable_credit_registration_via_suotar
  AND c.paused_at IS NULL
  AND cm.deleted_at IS NULL
  AND ($2::uuid IS NULL OR cm.course_id = $2)
ORDER BY COALESCE(cmsr.last_listing_attempted_at, cmsr.last_listed_at) ASC NULLS FIRST,
  cmsr.id
LIMIT $1
FOR UPDATE OF cmsr SKIP LOCKED
        "#,
        limit,
        course_id,
    )
    .fetch_all(&mut *conn)
    .await?;
    let ids: Vec<Uuid> = res.iter().map(|row| row.id).collect();
    if !ids.is_empty() {
        sqlx::query!(
            r#"
UPDATE course_module_suotar_realisations
SET last_listing_attempted_at = now()
WHERE id = ANY($1)
            "#,
            &ids,
        )
        .execute(conn)
        .await?;
    }
    Ok(res)
}

/// Every active realisation of one course, unpaginated: unlike [`claim_stalest_for_listing`], which
/// pages by staleness for the scheduler, this one must not miss any of them.
pub async fn get_active_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<RealisationToList>> {
    let res = sqlx::query_as!(
        RealisationToList,
        r#"
SELECT cmsr.id AS "id!",
  cmsr.course_module_id AS "course_module_id!",
  cm.course_id AS "course_id!",
  cmsr.course_unit_realisation_id AS "course_unit_realisation_id!",
  cm.uh_course_code AS "uh_course_code?"
FROM course_module_suotar_realisations cmsr
  JOIN course_modules cm ON cm.id = cmsr.course_module_id
  LEFT JOIN course_module_suotar_configurations c ON c.course_module_id = cm.id
  AND c.deleted_at IS NULL
WHERE cmsr.active
  AND cmsr.deleted_at IS NULL
  AND cm.enable_credit_registration_via_suotar
  AND c.paused_at IS NULL
  AND cm.deleted_at IS NULL
  AND cm.course_id = $1
ORDER BY cmsr.id
        "#,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// One active realisation's counters from its last successful discovery run, and whether the attempts
/// since then have been failing. Point-in-time, not a windowed sum: the phase overwrites the row
/// whole, so every surface rendering them has to say so.
#[derive(Debug, Clone, PartialEq)]
pub struct RealisationDiscoveryReport {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub course_unit_realisation_id: String,
    pub label: Option<String>,
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

pub async fn get_active_discovery_reports(
    conn: &mut PgConnection,
) -> ModelResult<Vec<RealisationDiscoveryReport>> {
    let res = sqlx::query_as!(
        RealisationDiscoveryReport,
        r#"
SELECT cmsr.id,
  cm.course_id,
  c.name AS course_name,
  cmsr.course_module_id,
  cm.name AS course_module_name,
  cmsr.course_unit_realisation_id,
  cmsr.label,
  cm.uh_course_code,
  cmsr.last_listed_at,
  cmsr.last_listed_person_count,
  cmsr.last_already_linked_count,
  cmsr.last_mailed_count,
  cmsr.last_suppressed_by_dedup_count,
  cmsr.last_suppressed_by_rate_cap_count,
  cmsr.last_no_address_count,
  cmsr.last_listing_attempted_at,
  cmsr.last_listing_error AS "last_listing_error?: CreditRegistrationErrorCode",
  cmsr.consecutive_listing_failures
FROM course_module_suotar_realisations cmsr
  JOIN course_modules cm ON cm.id = cmsr.course_module_id
  JOIN courses c ON c.id = cm.course_id
WHERE cmsr.active
  AND cmsr.deleted_at IS NULL
  AND cm.deleted_at IS NULL
ORDER BY c.name,
  cmsr.course_unit_realisation_id
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
    id: Uuid,
    error: CreditRegistrationErrorCode,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE course_module_suotar_realisations
SET last_listing_attempted_at = now(),
  last_listing_error = $2,
  consecutive_listing_failures = consecutive_listing_failures + 1
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        error as CreditRegistrationErrorCode,
    )
    .execute(conn)
    .await?;
    Ok(())
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
  last_listing_attempted_at = now(),
  last_listing_error = NULL,
  consecutive_listing_failures = 0,
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
