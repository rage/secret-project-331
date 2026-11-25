//! mooc.fi courses whose credits courses registers: each target stands in for a course and its
//! credit registration switches on the mooc.fi ledger rows it owns. The course codes it registers
//! under are its [`crate::external_credit_target_codes`].

use utoipa::ToSchema;

use crate::course_module_suotar_configurations::SuotarPause;
use crate::prelude::*;

/// A mooc.fi course whose completions courses registers, under the course codes of its
/// [`ExternalCreditTargetCode`](crate::external_credit_target_codes::ExternalCreditTargetCode)s.
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
    /// The cutoff: completions dated at or after it are ours, earlier ones mooc.fi's pull path's.
    pub delegated_at: DateTime<Utc>,
    /// `None` keeps every phase away from the target.
    pub enabled_at: Option<DateTime<Utc>>,
    pub paused_at: Option<DateTime<Utc>>,
    pub paused_by_user_id: Option<Uuid>,
    pub pause_reason: Option<String>,
    /// What mooc.fi last said; `None` until it has answered.
    pub moocfi_has_certificate: Option<bool>,
    pub moocfi_course_checked_at: Option<DateTime<Utc>>,
}

impl ExternalCreditTarget {
    /// How admin views name the target beside courses: "mooc.fi: " and its name.
    pub fn display_name(&self) -> String {
        format!("mooc.fi: {}", self.name)
    }

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
    pub delegated_at: DateTime<Utc>,
    pub enabled_at: Option<DateTime<Utc>>,
}

/// Creates a target. A second live target for the same mooc.fi course fails with the
/// `uq_external_credit_targets_moocfi_course` constraint error.
pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    configuration: &ExternalCreditTargetConfiguration,
) -> ModelResult<Uuid> {
    let id = sqlx::query_scalar!(
        r#"
INSERT INTO external_credit_targets (
    id,
    moocfi_course_id,
    moocfi_course_slug,
    name,
    language_code,
    delegated_at,
    enabled_at
  )
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id
        "#,
        pkey_policy.into_uuid(),
        configuration.moocfi_course_id,
        configuration.moocfi_course_slug,
        configuration.name,
        configuration.language_code,
        configuration.delegated_at,
        configuration.enabled_at,
    )
    .fetch_one(conn)
    .await?;
    Ok(id)
}

/// Replaces a live target's configuration. Fails like [`insert`] on a mooc.fi course that already
/// has another live target.
pub async fn update(
    conn: &mut PgConnection,
    id: Uuid,
    configuration: &ExternalCreditTargetConfiguration,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE external_credit_targets
SET moocfi_course_id = $2,
  moocfi_course_slug = $3,
  name = $4,
  language_code = $5,
  delegated_at = $6,
  enabled_at = $7
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id
        "#,
        id,
        configuration.moocfi_course_id,
        configuration.moocfi_course_slug,
        configuration.name,
        configuration.language_code,
        configuration.delegated_at,
        configuration.enabled_at,
    )
    .fetch_one(conn)
    .await?;
    Ok(())
}

/// A live target by id.
pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<ExternalCreditTarget> {
    let res = sqlx::query_as!(
        ExternalCreditTarget,
        r#"
SELECT *
FROM external_credit_targets
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// [`get_by_id`], locking the row until the transaction ends, which serializes changes to the
/// target's codes.
pub async fn get_by_id_for_update(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<ExternalCreditTarget> {
    let res = sqlx::query_as!(
        ExternalCreditTarget,
        r#"
SELECT *
FROM external_credit_targets
WHERE id = $1
  AND deleted_at IS NULL
FOR UPDATE
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// The live target of one mooc.fi course, if it has one.
pub async fn get_by_moocfi_course_id(
    conn: &mut PgConnection,
    moocfi_course_id: Uuid,
) -> ModelResult<Option<ExternalCreditTarget>> {
    let res = sqlx::query_as!(
        ExternalCreditTarget,
        r#"
SELECT *
FROM external_credit_targets
WHERE moocfi_course_id = $1
  AND deleted_at IS NULL
        "#,
        moocfi_course_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
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

/// The mooc.fi course id of the live target with this mooc.fi course slug.
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

/// Stores what mooc.fi said about the course on its live target.
pub async fn record_moocfi_course_details(
    conn: &mut PgConnection,
    moocfi_course_id: Uuid,
    has_certificate: bool,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE external_credit_targets
SET moocfi_has_certificate = $2,
  moocfi_course_checked_at = now()
WHERE moocfi_course_id = $1
  AND deleted_at IS NULL
        "#,
        moocfi_course_id,
        has_certificate,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Notes that mooc.fi gave no answer about the course, so the details are not asked for again
/// until they age; what was last known stays.
pub async fn record_moocfi_course_check_failure(
    conn: &mut PgConnection,
    moocfi_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE external_credit_targets
SET moocfi_course_checked_at = now()
WHERE moocfi_course_id = $1
  AND deleted_at IS NULL
        "#,
        moocfi_course_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// The distinct mooc.fi courses of enabled live targets, optionally only one target's.
pub async fn get_moocfi_course_ids_of_enabled_targets(
    conn: &mut PgConnection,
    external_credit_target_id: Option<Uuid>,
) -> ModelResult<Vec<Uuid>> {
    let ids = sqlx::query_scalar!(
        r#"
SELECT DISTINCT moocfi_course_id
FROM external_credit_targets
WHERE enabled_at IS NOT NULL
  AND deleted_at IS NULL
  AND ($1::uuid IS NULL OR id = $1)
        "#,
        external_credit_target_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(ids)
}

/// Every live target, enabled or not, for the admin Courses tab.
pub async fn get_all(conn: &mut PgConnection) -> ModelResult<Vec<ExternalCreditTarget>> {
    let res = sqlx::query_as!(
        ExternalCreditTarget,
        r#"
SELECT *
FROM external_credit_targets
WHERE deleted_at IS NULL
ORDER BY name
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Whether any mooc.fi completion or ledger row, live or not, was ever stored under the target.
pub async fn has_completions(conn: &mut PgConnection, id: Uuid) -> ModelResult<bool> {
    let res = sqlx::query_scalar!(
        r#"
SELECT EXISTS (
    SELECT 1
    FROM external_completions
    WHERE external_credit_target_id = $1
  )
  OR EXISTS (
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
        for code in crate::external_credit_target_codes::get_by_target_id(&mut tx, id).await? {
            crate::library::credit_registration::enrolment_checks::shift_past_pause(
                &mut tx, code.id, paused_at,
            )
            .await?;
        }
    }
    tx.commit().await?;
    Ok(())
}
