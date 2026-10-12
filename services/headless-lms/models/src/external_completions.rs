//! mooc.fi completions as courses last read them, the subjects of mooc.fi credit registrations.

use std::collections::HashSet;

use headless_lms_base::config::MoocfiDelegationConfiguration;
use headless_lms_utils::error::util_error::UtilError;
use headless_lms_utils::services::moocfi::{DelegatedCompletion, MoocfiClient};
use utoipa::ToSchema;

use crate::credit_registrations::CreditRegistrationState;
use crate::external_credit_targets::{self, ExternalGrading, TierRange};
use crate::library::credit_registration::moocfi_grade::parse_moocfi_grade;
use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ExternalCompletion {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub external_credit_target_id: Uuid,
    pub user_id: Uuid,
    pub moocfi_completion_id: Uuid,
    /// The student's TMC user id, which the mooc.fi completion lookup is keyed on.
    pub moocfi_user_upstream_id: i32,
    /// mooc.fi's completion date, or its creation time when it has none.
    pub completion_date: DateTime<Utc>,
    /// In mooc.fi's form, such as `fi_FI`.
    pub completion_language: Option<String>,
    pub tier: Option<i32>,
    pub eligible_for_ects: bool,
    /// mooc.fi's grade verbatim; `passed` and `grade` are parsed from it.
    pub raw_grade: Option<String>,
    /// `None` when the grade was not recognised.
    pub passed: Option<bool>,
    pub grade: Option<i32>,
    pub upstream_checked_at: DateTime<Utc>,
    pub upstream_missing_at: Option<DateTime<Utc>>,
    pub registered_upstream_at: Option<DateTime<Utc>>,
    pub reported_at: Option<DateTime<Utc>>,
    pub report_claimed_until: Option<DateTime<Utc>>,
    pub report_attempt_count: i32,
    pub report_next_attempt_at: DateTime<Utc>,
    pub report_last_error: Option<String>,
}

/// What one successful read of a completion from mooc.fi says, for [`upsert`].
#[derive(Debug, Clone, PartialEq)]
pub struct ExternalCompletionFacts {
    pub external_credit_target_id: Uuid,
    pub user_id: Uuid,
    pub moocfi_completion_id: Uuid,
    pub moocfi_user_upstream_id: i32,
    pub completion_date: DateTime<Utc>,
    pub completion_language: Option<String>,
    pub tier: Option<i32>,
    pub eligible_for_ects: bool,
    pub raw_grade: Option<String>,
    pub passed: Option<bool>,
    pub grade: Option<i32>,
    /// Another mooc.fi organization has registered the completion.
    pub is_registered_upstream: bool,
    /// Our own organization's registration of the completion is on mooc.fi.
    pub is_reported: bool,
}

/// Records a completion as mooc.fi just returned it, under the target its tier maps to, and returns
/// the row's id. Marks it checked now and present upstream. `registered_upstream_at` and
/// `reported_at` are set the first time their fact is seen and never cleared.
pub async fn upsert(conn: &mut PgConnection, facts: &ExternalCompletionFacts) -> ModelResult<Uuid> {
    let id = sqlx::query_scalar!(
        r#"
INSERT INTO external_completions (
    external_credit_target_id,
    user_id,
    moocfi_completion_id,
    moocfi_user_upstream_id,
    completion_date,
    completion_language,
    tier,
    eligible_for_ects,
    raw_grade,
    passed,
    grade,
    upstream_checked_at,
    registered_upstream_at,
    reported_at
  )
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    now(),
    CASE
      WHEN $12 THEN now()
    END,
    CASE
      WHEN $13 THEN now()
    END
  ) ON CONFLICT (moocfi_completion_id, external_credit_target_id)
WHERE deleted_at IS NULL DO
UPDATE
SET user_id = EXCLUDED.user_id,
  moocfi_user_upstream_id = EXCLUDED.moocfi_user_upstream_id,
  completion_date = EXCLUDED.completion_date,
  completion_language = EXCLUDED.completion_language,
  tier = EXCLUDED.tier,
  eligible_for_ects = EXCLUDED.eligible_for_ects,
  raw_grade = EXCLUDED.raw_grade,
  passed = EXCLUDED.passed,
  grade = EXCLUDED.grade,
  upstream_checked_at = EXCLUDED.upstream_checked_at,
  upstream_missing_at = NULL,
  registered_upstream_at = COALESCE(
    external_completions.registered_upstream_at,
    EXCLUDED.registered_upstream_at
  ),
  reported_at = COALESCE(
    external_completions.reported_at,
    EXCLUDED.reported_at
  )
RETURNING id
        "#,
        facts.external_credit_target_id,
        facts.user_id,
        facts.moocfi_completion_id,
        facts.moocfi_user_upstream_id,
        facts.completion_date,
        facts.completion_language,
        facts.tier,
        facts.eligible_for_ects,
        facts.raw_grade,
        facts.passed,
        facts.grade,
        facts.is_registered_upstream,
        facts.is_reported,
    )
    .fetch_one(conn)
    .await?;
    Ok(id)
}

/// A live external completion by id.
pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<ExternalCompletion> {
    let res = sqlx::query_as!(
        ExternalCompletion,
        r#"
SELECT *
FROM external_completions
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// The live rows of one user on any target of one mooc.fi course, newest completion first.
pub async fn get_by_user_and_moocfi_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    moocfi_course_id: Uuid,
) -> ModelResult<Vec<ExternalCompletion>> {
    let res = sqlx::query_as!(
        ExternalCompletion,
        r#"
SELECT ec.*
FROM external_completions ec
  JOIN external_credit_targets t ON t.id = ec.external_credit_target_id
WHERE ec.user_id = $1
  AND t.moocfi_course_id = $2
  AND ec.deleted_at IS NULL
ORDER BY ec.completion_date DESC,
  ec.created_at DESC
        "#,
        user_id,
        moocfi_course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// One student's completions of one mooc.fi course as the lookup just returned them, for
/// [`sync_from_upstream`].
#[derive(Debug, Clone, Copy)]
pub struct UpstreamCompletions<'a> {
    pub user_id: Uuid,
    pub moocfi_user_upstream_id: i32,
    /// The handler course the lookup was for.
    pub moocfi_course_id: Uuid,
    /// The lookup's whole answer: a stored completion missing from it is marked gone upstream.
    pub completions: &'a [DelegatedCompletion],
    /// Our organization's slug on mooc.fi.
    pub organization_slug: &'a str,
}

/// Brings the student's stored rows for one mooc.fi course in line with a fresh lookup.
///
/// A completion gets a new row only under the live target its tier maps to, and only when it is
/// ECTS-eligible and dated on or after the target's cutoff. Rows that already exist are always
/// updated, under whichever target they are on, so a completion that turned ineligible, moved
/// before the cutoff or changed tier is withdrawn by the subjects view rather than left stale.
/// Stored completions absent from the answer are marked missing upstream.
pub async fn sync_from_upstream(
    conn: &mut PgConnection,
    upstream: UpstreamCompletions<'_>,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    let targets =
        external_credit_targets::get_by_moocfi_course_id(&mut tx, upstream.moocfi_course_id)
            .await?;
    let stored = get_stored_targets(&mut tx, upstream.user_id, upstream.moocfi_course_id).await?;

    for completion in upstream.completions {
        let matching_target = targets
            .iter()
            .find(|target| admits_tier(target.tiers, completion.tier));
        if let Some(target) = matching_target {
            let has_row = stored.iter().any(|row| {
                row.moocfi_completion_id == completion.id
                    && row.external_credit_target_id == target.id
            });
            let is_new_and_ours = completion.eligible_for_ects == Some(true)
                && completion.effective_date() >= target.delegated_at;
            if has_row || is_new_and_ours {
                upsert(
                    &mut tx,
                    &completion_facts(&upstream, completion, target.id, target.grading),
                )
                .await?;
            }
        }
        for row in stored.iter().filter(|row| {
            row.moocfi_completion_id == completion.id
                && matching_target.is_none_or(|target| target.id != row.external_credit_target_id)
        }) {
            upsert(
                &mut tx,
                &completion_facts(
                    &upstream,
                    completion,
                    row.external_credit_target_id,
                    row.grading,
                ),
            )
            .await?;
        }
    }

    let returned_ids: Vec<Uuid> = upstream
        .completions
        .iter()
        .map(|completion| completion.id)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    sqlx::query!(
        r#"
UPDATE external_completions
SET upstream_missing_at = now()
WHERE user_id = $1
  AND deleted_at IS NULL
  AND upstream_missing_at IS NULL
  AND external_credit_target_id IN (
    SELECT id
    FROM external_credit_targets
    WHERE moocfi_course_id = $2
  )
  AND NOT moocfi_completion_id = ANY($3)
        "#,
        upstream.user_id,
        upstream.moocfi_course_id,
        &returned_ids,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// Re-reads the student's completions of one mooc.fi course from mooc.fi and syncs them, as
/// [`sync_from_upstream`] does. Holds `conn` across the lookup.
pub async fn fetch_and_sync(
    conn: &mut PgConnection,
    delegation: &MoocfiDelegationConfiguration,
    user_id: Uuid,
    moocfi_user_upstream_id: i32,
    moocfi_course_id: Uuid,
) -> ModelResult<()> {
    let completions = MoocfiClient::new(delegation)
        .get_user_completions(moocfi_course_id, moocfi_user_upstream_id)
        .await
        .map_err(UtilError::from)?;
    sync_from_upstream(
        conn,
        UpstreamCompletions {
            user_id,
            moocfi_user_upstream_id,
            moocfi_course_id,
            completions: &completions,
            organization_slug: &delegation.organization_slug,
        },
    )
    .await
}

/// Re-checks one external completion against mooc.fi, syncing every completion of the same student
/// and course with it. Errors with the lookup's error if mooc.fi gives no answer.
pub async fn recheck(
    conn: &mut PgConnection,
    delegation: &MoocfiDelegationConfiguration,
    external_completion_id: Uuid,
) -> ModelResult<()> {
    let completion = get_by_id(conn, external_completion_id).await?;
    let moocfi_course_id = sqlx::query_scalar!(
        r#"
SELECT moocfi_course_id
FROM external_credit_targets
WHERE id = $1
        "#,
        completion.external_credit_target_id,
    )
    .fetch_one(&mut *conn)
    .await?;
    fetch_and_sync(
        conn,
        delegation,
        completion.user_id,
        completion.moocfi_user_upstream_id,
        moocfi_course_id,
    )
    .await
}

/// The latest live attempt at registering one external completion, with what its student-facing
/// status is computed from.
#[derive(Debug, Clone)]
pub struct ExternalCompletionRegistrationState {
    pub external_completion_id: Uuid,
    pub credit_registration_id: Uuid,
    pub state: CreditRegistrationState,
    pub enrolment_resolved: bool,
    pub completion_eligible: bool,
    pub has_verified_student_number: bool,
    pub course_code_allowed: bool,
}

/// [`ExternalCompletionRegistrationState`] for each of the user's external completions on one
/// mooc.fi course that has a ledger row.
pub async fn get_registration_states_by_user_and_moocfi_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    moocfi_course_id: Uuid,
) -> ModelResult<Vec<ExternalCompletionRegistrationState>> {
    let res = sqlx::query_as!(
        ExternalCompletionRegistrationState,
        r#"
SELECT DISTINCT ON (cr.external_completion_id) cr.external_completion_id AS "external_completion_id!",
  cr.id AS credit_registration_id,
  cr.state AS "state: CreditRegistrationState",
  cr.selected_enrolment_id IS NOT NULL AS "enrolment_resolved!",
  p.completion_eligible AS "completion_eligible!",
  p.has_verified_student_number AS "has_verified_student_number!",
  p.course_code_allowed AS "course_code_allowed!"
FROM credit_registrations cr
  JOIN external_credit_targets t ON t.id = cr.external_credit_target_id
  JOIN credit_registration_preconditions p ON p.credit_registration_id = cr.id
WHERE cr.user_id = $1
  AND t.moocfi_course_id = $2
  AND cr.deleted_at IS NULL
  AND cr.superseded_by_id IS NULL
ORDER BY cr.external_completion_id,
  cr.attempt_number DESC
        "#,
        user_id,
        moocfi_course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Whether a target with `tiers` registers a completion of `tier`.
pub fn admits_tier(tiers: Option<TierRange>, tier: Option<i32>) -> bool {
    let Some(tiers) = tiers else {
        return true;
    };
    let Some(tier) = tier else {
        return false;
    };
    tiers.lowest.is_none_or(|lowest| tier >= lowest)
        && tiers.highest.is_none_or(|highest| tier <= highest)
}

/// A stored row's place, for deciding which rows a sync updates.
struct StoredTarget {
    moocfi_completion_id: Uuid,
    external_credit_target_id: Uuid,
    grading: ExternalGrading,
}

async fn get_stored_targets(
    conn: &mut PgConnection,
    user_id: Uuid,
    moocfi_course_id: Uuid,
) -> ModelResult<Vec<StoredTarget>> {
    let res = sqlx::query_as!(
        StoredTarget,
        r#"
SELECT ec.moocfi_completion_id,
  ec.external_credit_target_id,
  t.grading AS "grading: ExternalGrading"
FROM external_completions ec
  JOIN external_credit_targets t ON t.id = ec.external_credit_target_id
WHERE ec.user_id = $1
  AND t.moocfi_course_id = $2
  AND ec.deleted_at IS NULL
        "#,
        user_id,
        moocfi_course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

fn completion_facts(
    upstream: &UpstreamCompletions<'_>,
    completion: &DelegatedCompletion,
    external_credit_target_id: Uuid,
    grading: ExternalGrading,
) -> ExternalCompletionFacts {
    let parsed = parse_moocfi_grade(completion.grade.as_deref(), grading);
    let is_ours = |slug: &Option<String>| slug.as_deref() == Some(upstream.organization_slug);
    ExternalCompletionFacts {
        external_credit_target_id,
        user_id: upstream.user_id,
        moocfi_completion_id: completion.id,
        moocfi_user_upstream_id: upstream.moocfi_user_upstream_id,
        completion_date: completion.effective_date(),
        completion_language: completion.completion_language.clone(),
        tier: completion.tier,
        eligible_for_ects: completion.eligible_for_ects.unwrap_or(false),
        raw_grade: completion.grade.clone(),
        passed: parsed.passed,
        grade: parsed.grade,
        is_registered_upstream: completion
            .registrations
            .iter()
            .any(|registration| !is_ours(&registration.organization_slug)),
        is_reported: completion
            .registrations
            .iter()
            .any(|registration| is_ours(&registration.organization_slug)),
    }
}

/// An external completion by id, soft-deleted or not, for the admin registration detail.
pub async fn get_by_id_including_deleted(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<ExternalCompletion> {
    let res = sqlx::query_as!(
        ExternalCompletion,
        r#"
SELECT *
FROM external_completions
WHERE id = $1
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
