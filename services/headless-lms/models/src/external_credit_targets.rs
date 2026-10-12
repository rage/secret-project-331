//! mooc.fi courses whose credits courses registers: each target stands in for a course module and
//! its credit registration configuration on the mooc.fi ledger rows it owns.

use std::collections::HashMap;

use utoipa::ToSchema;

use crate::course_module_suotar_configurations::{SuotarConfigCheck, SuotarPause};
use crate::credit_registrations::CreditRegistrationErrorCode;
use crate::prelude::*;

/// How a mooc.fi completion with no grade reads on a target.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(type_name = "external_grading", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ExternalGrading {
    /// No grade is a pass.
    PassFail,
    /// No grade is unrecognised, and the row waits until the grade is fixed on mooc.fi.
    Numeric,
}

/// The completion tiers a target registers, both ends inclusive. `None` for an end leaves it open.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
pub struct TierRange {
    pub lowest: Option<i32>,
    pub highest: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ExternalCreditTarget {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    /// The mooc.fi course the completions are stored on, never the slug.
    pub moocfi_course_id: Uuid,
    pub moocfi_course_slug: String,
    pub name: String,
    pub language_code: String,
    /// `None` for an untiered course, which registers every completion.
    pub tiers: Option<TierRange>,
    pub uh_course_code: String,
    pub ects_credits: f32,
    pub grading: ExternalGrading,
    pub enrolment_link: Option<String>,
    /// The cutoff: completions dated at or after it are ours, earlier ones mooc.fi's pull path's.
    pub delegated_at: DateTime<Utc>,
    /// `None` keeps every phase away from the target.
    pub enabled_at: Option<DateTime<Utc>>,
    pub paused_at: Option<DateTime<Utc>>,
    pub paused_by_user_id: Option<Uuid>,
    pub pause_reason: Option<String>,
    pub config_checked_at: Option<DateTime<Utc>>,
    /// The course code `course_code_allowed` is a verdict on.
    pub checked_course_code: Option<String>,
    /// `None` means never checked, which is not the same as a failed check.
    pub course_code_allowed: Option<bool>,
    pub course_code_rejection: Option<String>,
    pub config_check_message: Option<String>,
    pub last_listing_attempted_at: Option<DateTime<Utc>>,
    pub last_listed_at: Option<DateTime<Utc>>,
    pub last_listing_error: Option<CreditRegistrationErrorCode>,
    pub consecutive_listing_failures: i32,
}

impl ExternalCreditTarget {
    /// Whether the pipeline moves the target's rows: enabled and not paused.
    pub fn is_active(&self) -> bool {
        self.enabled_at.is_some() && self.paused_at.is_none()
    }
}

/// What an admin configures on a target, for [`insert`] and [`update`].
#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ExternalCreditTargetConfiguration {
    pub moocfi_course_id: Uuid,
    pub moocfi_course_slug: String,
    pub name: String,
    pub language_code: String,
    pub tiers: Option<TierRange>,
    pub uh_course_code: String,
    pub ects_credits: f32,
    pub grading: ExternalGrading,
    pub enrolment_link: Option<String>,
    pub delegated_at: DateTime<Utc>,
    pub enabled_at: Option<DateTime<Utc>>,
}

/// One row as the queries below read it; `tiers` comes split, since `INT4RANGE` has no serde form.
struct ExternalCreditTargetRow {
    id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    deleted_at: Option<DateTime<Utc>>,
    moocfi_course_id: Uuid,
    moocfi_course_slug: String,
    name: String,
    language_code: String,
    is_tiered: bool,
    lowest_tier: Option<i32>,
    highest_tier: Option<i32>,
    uh_course_code: String,
    ects_credits: f32,
    grading: ExternalGrading,
    enrolment_link: Option<String>,
    delegated_at: DateTime<Utc>,
    enabled_at: Option<DateTime<Utc>>,
    paused_at: Option<DateTime<Utc>>,
    paused_by_user_id: Option<Uuid>,
    pause_reason: Option<String>,
    config_checked_at: Option<DateTime<Utc>>,
    checked_course_code: Option<String>,
    course_code_allowed: Option<bool>,
    course_code_rejection: Option<String>,
    config_check_message: Option<String>,
    last_listing_attempted_at: Option<DateTime<Utc>>,
    last_listed_at: Option<DateTime<Utc>>,
    last_listing_error: Option<CreditRegistrationErrorCode>,
    consecutive_listing_failures: i32,
}

impl From<ExternalCreditTargetRow> for ExternalCreditTarget {
    fn from(row: ExternalCreditTargetRow) -> Self {
        Self {
            id: row.id,
            created_at: row.created_at,
            updated_at: row.updated_at,
            deleted_at: row.deleted_at,
            moocfi_course_id: row.moocfi_course_id,
            moocfi_course_slug: row.moocfi_course_slug,
            name: row.name,
            language_code: row.language_code,
            tiers: row.is_tiered.then_some(TierRange {
                lowest: row.lowest_tier,
                highest: row.highest_tier,
            }),
            uh_course_code: row.uh_course_code,
            ects_credits: row.ects_credits,
            grading: row.grading,
            enrolment_link: row.enrolment_link,
            delegated_at: row.delegated_at,
            enabled_at: row.enabled_at,
            paused_at: row.paused_at,
            paused_by_user_id: row.paused_by_user_id,
            pause_reason: row.pause_reason,
            config_checked_at: row.config_checked_at,
            checked_course_code: row.checked_course_code,
            course_code_allowed: row.course_code_allowed,
            course_code_rejection: row.course_code_rejection,
            config_check_message: row.config_check_message,
            last_listing_attempted_at: row.last_listing_attempted_at,
            last_listed_at: row.last_listed_at,
            last_listing_error: row.last_listing_error,
            consecutive_listing_failures: row.consecutive_listing_failures,
        }
    }
}

/// Creates a target. A tier range overlapping another live target of the same mooc.fi course fails
/// with the `external_credit_targets_tier_overlap` constraint error.
pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    configuration: &ExternalCreditTargetConfiguration,
) -> ModelResult<Uuid> {
    let tiers = configuration.tiers;
    let id = sqlx::query_scalar!(
        r#"
INSERT INTO external_credit_targets (
    id,
    moocfi_course_id,
    moocfi_course_slug,
    name,
    language_code,
    tiers,
    uh_course_code,
    ects_credits,
    grading,
    enrolment_link,
    delegated_at,
    enabled_at
  )
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    CASE
      WHEN $6 THEN int4range($7::int, $8::int, '[]')
    END,
    $9,
    $10,
    $11,
    $12,
    $13,
    $14
  )
RETURNING id
        "#,
        pkey_policy.into_uuid(),
        configuration.moocfi_course_id,
        configuration.moocfi_course_slug,
        configuration.name,
        configuration.language_code,
        tiers.is_some(),
        tiers.and_then(|tiers| tiers.lowest),
        tiers.and_then(|tiers| tiers.highest),
        configuration.uh_course_code,
        configuration.ects_credits,
        configuration.grading as ExternalGrading,
        configuration.enrolment_link,
        configuration.delegated_at,
        configuration.enabled_at,
    )
    .fetch_one(conn)
    .await?;
    Ok(id)
}

/// Replaces a live target's configuration. Fails like [`insert`] on overlapping tiers.
pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    configuration: &ExternalCreditTargetConfiguration,
) -> ModelResult<()> {
    let tiers = configuration.tiers;
    sqlx::query!(
        r#"
UPDATE external_credit_targets
SET moocfi_course_id = $2,
  moocfi_course_slug = $3,
  name = $4,
  language_code = $5,
  tiers = CASE
    WHEN $6 THEN int4range($7::int, $8::int, '[]')
  END,
  uh_course_code = $9,
  ects_credits = $10,
  grading = $11,
  enrolment_link = $12,
  delegated_at = $13,
  enabled_at = $14
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id
        "#,
        id,
        configuration.moocfi_course_id,
        configuration.moocfi_course_slug,
        configuration.name,
        configuration.language_code,
        tiers.is_some(),
        tiers.and_then(|tiers| tiers.lowest),
        tiers.and_then(|tiers| tiers.highest),
        configuration.uh_course_code,
        configuration.ects_credits,
        configuration.grading as ExternalGrading,
        configuration.enrolment_link,
        configuration.delegated_at,
        configuration.enabled_at,
    )
    .fetch_one(conn)
    .await?;
    Ok(())
}

/// A live target by id.
pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<ExternalCreditTarget> {
    let row = sqlx::query_as!(
        ExternalCreditTargetRow,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  moocfi_course_id,
  moocfi_course_slug,
  name,
  language_code,
  tiers IS NOT NULL AS "is_tiered!",
  LOWER(tiers) AS lowest_tier,
  UPPER(tiers) - 1 AS highest_tier,
  uh_course_code,
  ects_credits,
  grading AS "grading: ExternalGrading",
  enrolment_link,
  delegated_at,
  enabled_at,
  paused_at,
  paused_by_user_id,
  pause_reason,
  config_checked_at,
  checked_course_code,
  course_code_allowed,
  course_code_rejection,
  config_check_message,
  last_listing_attempted_at,
  last_listed_at,
  last_listing_error AS "last_listing_error: CreditRegistrationErrorCode",
  consecutive_listing_failures
FROM external_credit_targets
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(row.into())
}

/// The live targets of one mooc.fi course, lowest tiers first, the untiered one alone if there is
/// one.
pub async fn get_by_moocfi_course_id(
    conn: &mut PgConnection,
    moocfi_course_id: Uuid,
) -> ModelResult<Vec<ExternalCreditTarget>> {
    let rows = sqlx::query_as!(
        ExternalCreditTargetRow,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  moocfi_course_id,
  moocfi_course_slug,
  name,
  language_code,
  tiers IS NOT NULL AS "is_tiered!",
  LOWER(tiers) AS lowest_tier,
  UPPER(tiers) - 1 AS highest_tier,
  uh_course_code,
  ects_credits,
  grading AS "grading: ExternalGrading",
  enrolment_link,
  delegated_at,
  enabled_at,
  paused_at,
  paused_by_user_id,
  pause_reason,
  config_checked_at,
  checked_course_code,
  course_code_allowed,
  course_code_rejection,
  config_check_message,
  last_listing_attempted_at,
  last_listed_at,
  last_listing_error AS "last_listing_error: CreditRegistrationErrorCode",
  consecutive_listing_failures
FROM external_credit_targets
WHERE moocfi_course_id = $1
  AND deleted_at IS NULL
ORDER BY LOWER(tiers) NULLS FIRST
        "#,
        moocfi_course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows.into_iter().map(Into::into).collect())
}

/// Soft-deletes a target, which withdraws its completions not yet submitted.
pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE external_credit_targets
SET deleted_at = now()
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(())
}

/// The mooc.fi course id of the live targets with this mooc.fi course slug.
pub async fn get_moocfi_course_id_by_slug(
    conn: &mut PgConnection,
    moocfi_course_slug: &str,
) -> ModelResult<Option<Uuid>> {
    let res = sqlx::query_scalar!(
        r#"
SELECT moocfi_course_id
FROM external_credit_targets
WHERE moocfi_course_slug = $1
  AND deleted_at IS NULL
LIMIT 1
        "#,
        moocfi_course_slug,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// What the configuration check reads about one enabled target.
#[derive(Debug, Clone, PartialEq)]
pub struct ExternalCreditTargetConfigFacts {
    pub external_credit_target_id: Uuid,
    pub uh_course_code: String,
    /// Suotar's verdict on the current course code from the last check; `None` if there is none or
    /// the code has changed since.
    pub stored_course_code_allowed: Option<bool>,
    pub stored_course_code_rejection: Option<String>,
}

/// Every enabled live target's configuration facts, optionally only one target's. Paused targets
/// are included, as paused modules are.
pub async fn get_config_facts_for_enabled_targets(
    conn: &mut PgConnection,
    external_credit_target_id: Option<Uuid>,
) -> ModelResult<Vec<ExternalCreditTargetConfigFacts>> {
    let res = sqlx::query_as!(
        ExternalCreditTargetConfigFacts,
        r#"
SELECT id AS external_credit_target_id,
  uh_course_code,
  CASE
    WHEN checked_course_code = TRIM(uh_course_code) THEN course_code_allowed
  END AS "stored_course_code_allowed?",
  CASE
    WHEN checked_course_code = TRIM(uh_course_code) THEN course_code_rejection
  END AS "stored_course_code_rejection?"
FROM external_credit_targets
WHERE enabled_at IS NOT NULL
  AND deleted_at IS NULL
  AND ($1::uuid IS NULL OR id = $1)
ORDER BY moocfi_course_id,
  LOWER(tiers) NULLS FIRST
        "#,
        external_credit_target_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Stamps a configuration check result on the target.
pub async fn record_config_check(
    conn: &mut PgConnection,
    id: Uuid,
    check: &SuotarConfigCheck,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE external_credit_targets
SET config_checked_at = now(),
  course_code_allowed = $2,
  config_check_message = $3,
  checked_course_code = $4,
  course_code_rejection = $5
WHERE id = $1
        "#,
        id,
        check.course_code_allowed,
        check.message,
        check.checked_course_code,
        check.course_code_rejection,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Enabled live targets the last configuration check found broken; never-checked ones are not.
pub async fn get_ids_failing_config_check(conn: &mut PgConnection) -> ModelResult<Vec<Uuid>> {
    let ids = sqlx::query_scalar!(
        r#"
SELECT id
FROM external_credit_targets
WHERE enabled_at IS NOT NULL
  AND deleted_at IS NULL
  AND config_checked_at IS NOT NULL
  AND config_check_message IS NOT NULL
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(ids)
}

/// Every live target, enabled or not, for the admin Courses tab.
pub async fn get_all(conn: &mut PgConnection) -> ModelResult<Vec<ExternalCreditTarget>> {
    let rows = sqlx::query_as!(
        ExternalCreditTargetRow,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  moocfi_course_id,
  moocfi_course_slug,
  name,
  language_code,
  tiers IS NOT NULL AS "is_tiered!",
  LOWER(tiers) AS lowest_tier,
  UPPER(tiers) - 1 AS highest_tier,
  uh_course_code,
  ects_credits,
  grading AS "grading: ExternalGrading",
  enrolment_link,
  delegated_at,
  enabled_at,
  paused_at,
  paused_by_user_id,
  pause_reason,
  config_checked_at,
  checked_course_code,
  course_code_allowed,
  course_code_rejection,
  config_check_message,
  last_listing_attempted_at,
  last_listed_at,
  last_listing_error AS "last_listing_error: CreditRegistrationErrorCode",
  consecutive_listing_failures
FROM external_credit_targets
WHERE deleted_at IS NULL
ORDER BY name,
  LOWER(tiers) NULLS FIRST
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows.into_iter().map(Into::into).collect())
}

/// Passed, ECTS-eligible live completions per target, whether or not they have a ledger row.
pub async fn count_eligible_completions_by_target(
    conn: &mut PgConnection,
) -> ModelResult<HashMap<Uuid, i64>> {
    let rows = sqlx::query!(
        r#"
SELECT external_credit_target_id,
  COUNT(*) AS "count!"
FROM external_completions
WHERE deleted_at IS NULL
  AND passed
  AND eligible_for_ects
GROUP BY external_credit_target_id
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.external_credit_target_id, row.count))
        .collect())
}

/// Whether any ledger row, live or not, was made for the target.
pub async fn has_credit_registrations(conn: &mut PgConnection, id: Uuid) -> ModelResult<bool> {
    let res = sqlx::query_scalar!(
        r#"
SELECT EXISTS (
    SELECT 1
    FROM credit_registrations
    WHERE external_credit_target_id = $1
  ) AS "exists!"
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Pauses or resumes a live target, as
/// [`set_paused`](crate::course_module_suotar_configurations::set_paused) does a module.
pub async fn set_paused(
    conn: &mut PgConnection,
    id: Uuid,
    pause: Option<SuotarPause<'_>>,
) -> ModelResult<()> {
    let pause = pause.as_ref();
    let mut tx = conn.begin().await?;
    let previously_paused_at = sqlx::query_scalar!(
        r#"
SELECT paused_at
FROM external_credit_targets
WHERE id = $1
  AND deleted_at IS NULL
FOR UPDATE
        "#,
        id,
    )
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query!(
        r#"
UPDATE external_credit_targets
SET paused_at = CASE
    WHEN $2::timestamptz IS NOT NULL THEN COALESCE(paused_at, $2)
  END,
  paused_by_user_id = $3,
  pause_reason = $4
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        pause.map(|pause| pause.paused_at),
        pause.map(|pause| pause.paused_by_user_id),
        pause.and_then(|pause| pause.reason),
    )
    .execute(&mut *tx)
    .await?;
    if pause.is_none()
        && let Some(paused_at) = previously_paused_at
    {
        crate::library::credit_registration::enrolment_checks::shift_past_pause(
            &mut tx,
            id,
            // Whole seconds: Postgres intervals hold no nanoseconds, which the clock has.
            chrono::TimeDelta::seconds((Utc::now() - paused_at).num_seconds()),
        )
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Whether a target with this id exists, deleted or not.
pub async fn exists(conn: &mut PgConnection, id: Uuid) -> ModelResult<bool> {
    let res = sqlx::query_scalar!(
        r#"
SELECT EXISTS (
    SELECT 1
    FROM external_credit_targets
    WHERE id = $1
  ) AS "exists!"
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
