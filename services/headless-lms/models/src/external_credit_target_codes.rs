//! The course codes a mooc.fi target registers credits under. Each code is the credit unit of the
//! mooc.fi ledger rows registered under it, as a course module is of a native row.

use std::collections::HashMap;

use utoipa::ToSchema;

use crate::course_module_suotar_configurations::SuotarConfigCheck;
use crate::credit_registrations::CreditRegistrationErrorCode;
use crate::prelude::*;

/// How a mooc.fi completion with no grade reads under a code.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(type_name = "external_grading", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ExternalGrading {
    /// No grade is a pass.
    PassFail,
    /// No grade is unrecognised, and the row waits until the grade is fixed on mooc.fi.
    Numeric,
}

/// One course code of a mooc.fi target, and the completion tiers that earn it.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ExternalCreditTargetCode {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub external_credit_target_id: Uuid,
    /// What students see the credits called, such as the course and its level.
    pub name: String,
    pub uh_course_code: String,
    /// The lowest tier that earns the code; every higher tier earns it too. `None` for a code every
    /// completion earns, tiered or not.
    pub minimum_tier: Option<i32>,
    pub ects_credits: f32,
    pub grading: ExternalGrading,
    pub enrolment_link: Option<String>,
    /// A code of the same target that must be in Sisu before this one is sent there.
    pub prerequisite_code_id: Option<Uuid>,
    /// Older codes an attainment of which counts as holding this one.
    pub equivalent_course_codes: Vec<String>,
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

/// Whether a completion of `tier` earns a code of `minimum_tier`. An untiered completion earns
/// only a code without a minimum tier.
pub fn is_tier_earned(minimum_tier: Option<i32>, tier: Option<i32>) -> bool {
    match (minimum_tier, tier) {
        (None, _) => true,
        (Some(minimum_tier), Some(tier)) => tier >= minimum_tier,
        (Some(_), None) => false,
    }
}

impl ExternalCreditTargetCode {
    /// [`is_tier_earned`] for this code.
    pub fn is_earned_by(&self, tier: Option<i32>) -> bool {
        is_tier_earned(self.minimum_tier, tier)
    }

    /// What the configuration check reads about the code, as
    /// [`get_config_facts_for_enabled_targets`] returns it.
    pub fn config_facts(&self) -> ExternalCreditTargetCodeConfigFacts {
        let is_current =
            self.checked_course_code.as_deref() == Some(sql_trim(&self.uh_course_code));
        ExternalCreditTargetCodeConfigFacts {
            external_credit_target_code_id: self.id,
            uh_course_code: self.uh_course_code.clone(),
            stored_course_code_allowed: self.course_code_allowed.filter(|_| is_current),
            stored_course_code_rejection: self.course_code_rejection.clone().filter(|_| is_current),
        }
    }

    /// The code as an admin configured it, to compare with a new configuration.
    pub fn configuration(&self) -> ExternalCreditTargetCodeConfiguration {
        ExternalCreditTargetCodeConfiguration {
            name: self.name.clone(),
            uh_course_code: self.uh_course_code.clone(),
            minimum_tier: self.minimum_tier,
            ects_credits: self.ects_credits,
            grading: self.grading,
            enrolment_link: self.enrolment_link.clone(),
            prerequisite_code_id: self.prerequisite_code_id,
            equivalent_course_codes: self.equivalent_course_codes.clone(),
        }
    }
}

/// `value` trimmed of spaces as SQL `TRIM` does it, which leaves other whitespace.
fn sql_trim(value: &str) -> &str {
    value.trim_matches(' ')
}

/// What an admin configures on a code, for [`insert`] and [`update`].
#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ExternalCreditTargetCodeConfiguration {
    pub name: String,
    pub uh_course_code: String,
    pub minimum_tier: Option<i32>,
    pub ects_credits: f32,
    pub grading: ExternalGrading,
    pub enrolment_link: Option<String>,
    /// Must be a live code of the same target, and must not lead back to this one.
    pub prerequisite_code_id: Option<Uuid>,
    pub equivalent_course_codes: Vec<String>,
}

/// Adds a code to a target. A code the target already has fails with the
/// `uq_external_credit_target_codes_course_code` constraint error, and a prerequisite of another
/// target with the `external_credit_target_codes_prerequisite_same_target` one. Cycles are the
/// caller's to refuse.
pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    external_credit_target_id: Uuid,
    configuration: &ExternalCreditTargetCodeConfiguration,
) -> ModelResult<Uuid> {
    let id = sqlx::query_scalar!(
        r#"
INSERT INTO external_credit_target_codes (
    id,
    external_credit_target_id,
    uh_course_code,
    minimum_tier,
    ects_credits,
    grading,
    enrolment_link,
    prerequisite_code_id,
    equivalent_course_codes,
    name
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id
        "#,
        pkey_policy.into_uuid(),
        external_credit_target_id,
        configuration.uh_course_code,
        configuration.minimum_tier,
        configuration.ects_credits,
        configuration.grading as ExternalGrading,
        configuration.enrolment_link,
        configuration.prerequisite_code_id,
        &configuration.equivalent_course_codes,
        configuration.name,
    )
    .fetch_one(conn)
    .await?;
    Ok(id)
}

/// Replaces a live code's configuration. Fails like [`insert`].
pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    configuration: &ExternalCreditTargetCodeConfiguration,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE external_credit_target_codes
SET uh_course_code = $2,
  minimum_tier = $3,
  ects_credits = $4,
  grading = $5,
  enrolment_link = $6,
  prerequisite_code_id = $7,
  equivalent_course_codes = $8,
  name = $9
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id
        "#,
        id,
        configuration.uh_course_code,
        configuration.minimum_tier,
        configuration.ects_credits,
        configuration.grading as ExternalGrading,
        configuration.enrolment_link,
        configuration.prerequisite_code_id,
        &configuration.equivalent_course_codes,
        configuration.name,
    )
    .fetch_one(conn)
    .await?;
    Ok(())
}

/// Removes a live code's prerequisite, so the codes of a target can be rearranged one write at a
/// time without passing through a cycle.
pub async fn clear_prerequisite(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE external_credit_target_codes
SET prerequisite_code_id = NULL
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

/// Soft-deletes a code, which withdraws its completions not yet submitted. The caller must first
/// clear the prerequisite of any live code that has this one as it.
pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE external_credit_target_codes
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

/// The live codes of one target, lowest minimum tier first.
pub async fn get_by_target_id(
    conn: &mut PgConnection,
    external_credit_target_id: Uuid,
) -> ModelResult<Vec<ExternalCreditTargetCode>> {
    let res = sqlx::query_as!(
        ExternalCreditTargetCode,
        r#"
SELECT *
FROM external_credit_target_codes
WHERE external_credit_target_id = $1
  AND deleted_at IS NULL
ORDER BY minimum_tier NULLS FIRST,
  uh_course_code
        "#,
        external_credit_target_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Codes by id, soft-deleted or not, lowest minimum tier first: for showing what was registered
/// under a code that has since been deleted.
pub async fn get_by_ids_including_deleted(
    conn: &mut PgConnection,
    ids: &[Uuid],
) -> ModelResult<Vec<ExternalCreditTargetCode>> {
    let res = sqlx::query_as!(
        ExternalCreditTargetCode,
        r#"
SELECT *
FROM external_credit_target_codes
WHERE id = ANY($1)
ORDER BY minimum_tier NULLS FIRST,
  uh_course_code
        "#,
        ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The live codes of a target, and the codes of `referenced_ids` even when deleted, lowest minimum
/// tier first: what a student's completions are listed under.
pub async fn get_by_target_id_including_referenced(
    conn: &mut PgConnection,
    external_credit_target_id: Option<Uuid>,
    referenced_ids: &[Uuid],
) -> ModelResult<Vec<ExternalCreditTargetCode>> {
    let res = sqlx::query_as!(
        ExternalCreditTargetCode,
        r#"
SELECT *
FROM external_credit_target_codes
WHERE (
    external_credit_target_id = $1
    AND deleted_at IS NULL
  )
  OR id = ANY($2)
ORDER BY minimum_tier NULLS FIRST,
  uh_course_code
        "#,
        external_credit_target_id,
        referenced_ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Every live code of a live target, enabled or not, for the admin Courses tab.
pub async fn get_all(conn: &mut PgConnection) -> ModelResult<Vec<ExternalCreditTargetCode>> {
    let res = sqlx::query_as!(
        ExternalCreditTargetCode,
        r#"
SELECT code.id,
  code.created_at,
  code.updated_at,
  code.deleted_at,
  code.external_credit_target_id,
  code.name,
  code.uh_course_code,
  code.minimum_tier,
  code.ects_credits,
  code.grading,
  code.enrolment_link,
  code.prerequisite_code_id,
  code.equivalent_course_codes,
  code.config_checked_at,
  code.checked_course_code,
  code.course_code_allowed,
  code.course_code_rejection,
  code.config_check_message,
  code.last_listing_attempted_at,
  code.last_listed_at,
  code.last_listing_error,
  code.consecutive_listing_failures
FROM external_credit_target_codes code
  JOIN external_credit_targets t ON t.id = code.external_credit_target_id
WHERE code.deleted_at IS NULL
  AND t.deleted_at IS NULL
ORDER BY t.name,
  code.minimum_tier NULLS FIRST,
  code.uh_course_code
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// What the configuration check reads about one live code of an enabled target.
#[derive(Debug, Clone, PartialEq)]
pub struct ExternalCreditTargetCodeConfigFacts {
    pub external_credit_target_code_id: Uuid,
    pub uh_course_code: String,
    /// Suotar's verdict on the current course code from the last check; `None` if there is none or
    /// the code has changed since.
    pub stored_course_code_allowed: Option<bool>,
    pub stored_course_code_rejection: Option<String>,
}

/// The configuration facts of every live code of an enabled live target, optionally only one
/// target's. Codes of paused targets are included, as paused modules are.
pub async fn get_config_facts_for_enabled_targets(
    conn: &mut PgConnection,
    external_credit_target_id: Option<Uuid>,
) -> ModelResult<Vec<ExternalCreditTargetCodeConfigFacts>> {
    let res = sqlx::query_as!(
        ExternalCreditTargetCodeConfigFacts,
        r#"
SELECT code.id AS external_credit_target_code_id,
  code.uh_course_code,
  CASE
    WHEN code.checked_course_code = TRIM(code.uh_course_code) THEN code.course_code_allowed
  END AS "stored_course_code_allowed?",
  CASE
    WHEN code.checked_course_code = TRIM(code.uh_course_code) THEN code.course_code_rejection
  END AS "stored_course_code_rejection?"
FROM external_credit_target_codes code
  JOIN external_credit_targets t ON t.id = code.external_credit_target_id
WHERE t.enabled_at IS NOT NULL
  AND t.deleted_at IS NULL
  AND code.deleted_at IS NULL
  AND ($1::uuid IS NULL OR t.id = $1)
ORDER BY t.moocfi_course_id,
  code.minimum_tier NULLS FIRST
        "#,
        external_credit_target_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Stamps a configuration check result on the code.
pub async fn record_config_check(
    conn: &mut PgConnection,
    id: Uuid,
    check: &SuotarConfigCheck,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE external_credit_target_codes
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

/// Live codes of enabled live targets the last configuration check found broken; never-checked ones
/// are not.
pub async fn get_ids_failing_config_check(conn: &mut PgConnection) -> ModelResult<Vec<Uuid>> {
    let ids = sqlx::query_scalar!(
        r#"
SELECT code.id
FROM external_credit_target_codes code
  JOIN external_credit_targets t ON t.id = code.external_credit_target_id
WHERE t.enabled_at IS NOT NULL
  AND t.deleted_at IS NULL
  AND code.deleted_at IS NULL
  AND code.config_checked_at IS NOT NULL
  AND code.config_check_message IS NOT NULL
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(ids)
}

/// Completions per code that registration is responsible for, whether or not they have a ledger
/// row: passed, ECTS-eligible and not withdrawn, by the same rule as
/// `credit_registration_eligible_completions`.
pub async fn count_eligible_completions_by_code(
    conn: &mut PgConnection,
) -> ModelResult<HashMap<Uuid, i64>> {
    let rows = sqlx::query!(
        r#"
SELECT external_credit_target_code_id AS "external_credit_target_code_id!",
  COUNT(*) AS "count!"
FROM credit_registration_eligible_completions
WHERE kind = 'mooc_fi'
GROUP BY external_credit_target_code_id
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.external_credit_target_code_id, row.count))
        .collect())
}
