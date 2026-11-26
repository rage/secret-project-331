//! mooc.fi completions as courses last read them, the subjects of mooc.fi credit registrations.

use std::collections::{HashMap, HashSet};

use headless_lms_utils::services::moocfi::{DelegatedCompletion, DelegatedCompletionRegistration};
use utoipa::ToSchema;

use crate::credit_registrations::CreditRegistrationState;
use crate::external_credit_target_codes::{self, ExternalCreditTargetCode, ExternalGrading};
use crate::external_credit_targets;
use crate::library::credit_registration::moocfi_grade::parse_moocfi_grade;
use crate::prelude::*;

/// A mooc.fi completion as last read, under one code its tier earned then.
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
    /// When the date, language, tier, eligibility or grade last changed; a re-check finding nothing
    /// new leaves it alone.
    pub revised_at: DateTime<Utc>,
    pub upstream_checked_at: DateTime<Utc>,
    /// When re-checking last failed to read it from mooc.fi.
    pub upstream_check_failed_at: Option<DateTime<Utc>>,
    pub upstream_missing_at: Option<DateTime<Utc>>,
    pub registered_upstream_at: Option<DateTime<Utc>>,
    pub reported_at: Option<DateTime<Utc>>,
    pub external_credit_target_code_id: Uuid,
}

/// What one successful read of a completion from mooc.fi says, for [`upsert`].
#[derive(Debug, Clone, PartialEq)]
pub struct ExternalCompletionFacts {
    pub external_credit_target_id: Uuid,
    pub external_credit_target_code_id: Uuid,
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
    /// Another mooc.fi organization has registered the completion under the code.
    pub is_registered_upstream: bool,
    /// Our own organization's registration of the completion under the code is on mooc.fi.
    pub is_reported: bool,
}

/// Records a completion as mooc.fi just returned it, under one code of its target, and returns
/// the row's id. Marks it checked now and present upstream. `registered_upstream_at` and
/// `reported_at` are set the first time their fact is seen and never cleared. `None`, changing
/// nothing, when another account's row already holds the completion.
pub async fn upsert(
    conn: &mut PgConnection,
    facts: &ExternalCompletionFacts,
) -> ModelResult<Option<Uuid>> {
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
    reported_at,
    external_credit_target_code_id
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
    END,
    $14
  ) ON CONFLICT (moocfi_completion_id, external_credit_target_code_id)
WHERE deleted_at IS NULL DO
UPDATE
SET moocfi_user_upstream_id = EXCLUDED.moocfi_user_upstream_id,
  completion_date = EXCLUDED.completion_date,
  completion_language = EXCLUDED.completion_language,
  tier = EXCLUDED.tier,
  eligible_for_ects = EXCLUDED.eligible_for_ects,
  raw_grade = EXCLUDED.raw_grade,
  passed = EXCLUDED.passed,
  grade = EXCLUDED.grade,
  revised_at = CASE
    WHEN (
      external_completions.completion_date,
      external_completions.completion_language,
      external_completions.tier,
      external_completions.eligible_for_ects,
      external_completions.raw_grade,
      external_completions.passed,
      external_completions.grade
    ) IS DISTINCT FROM (
      EXCLUDED.completion_date,
      EXCLUDED.completion_language,
      EXCLUDED.tier,
      EXCLUDED.eligible_for_ects,
      EXCLUDED.raw_grade,
      EXCLUDED.passed,
      EXCLUDED.grade
    ) THEN now()
    ELSE external_completions.revised_at
  END,
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
WHERE external_completions.user_id = EXCLUDED.user_id
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
        facts.external_credit_target_code_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(id)
}

/// Notes a failed mooc.fi lookup of the student's completions of the course, which puts off the
/// next attempt like a successful one would.
pub async fn record_upstream_check_failure(
    conn: &mut PgConnection,
    user_id: Uuid,
    moocfi_course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE external_completions
SET upstream_check_failed_at = now()
WHERE user_id = $1
  AND deleted_at IS NULL
  AND external_credit_target_id IN (
    SELECT id
    FROM external_credit_targets
    WHERE moocfi_course_id = $2
  )
        "#,
        user_id,
        moocfi_course_id,
    )
    .execute(conn)
    .await?;
    Ok(())
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

/// The live rows of one user on any code of one mooc.fi course, newest completion first.
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

/// The live rows of one user's mooc.fi completion, one per code, lowest minimum tier first.
pub async fn get_by_user_and_moocfi_completion_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    moocfi_completion_id: Uuid,
) -> ModelResult<Vec<ExternalCompletion>> {
    let res = sqlx::query_as!(
        ExternalCompletion,
        r#"
SELECT ec.*
FROM external_completions ec
  JOIN external_credit_target_codes code ON code.id = ec.external_credit_target_code_id
WHERE ec.user_id = $1
  AND ec.moocfi_completion_id = $2
  AND ec.deleted_at IS NULL
ORDER BY code.minimum_tier NULLS FIRST,
  code.uh_course_code
        "#,
        user_id,
        moocfi_completion_id,
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
/// A completion gets a new row under every live code of the course's target that its tier earns,
/// but only when it is ECTS-eligible and dated on or after the cutoff, or registered under the
/// code on mooc.fi, which a later completion with the same grade is checked against. Existing rows
/// are always updated, so a completion that turned ineligible, moved before the cutoff or dropped
/// below a code's tier is withdrawn by the subjects view rather than left stale. Stored
/// completions absent from the answer are marked missing upstream.
pub async fn sync_from_upstream(
    conn: &mut PgConnection,
    upstream: UpstreamCompletions<'_>,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    let target =
        external_credit_targets::get_by_moocfi_course_id(&mut tx, upstream.moocfi_course_id)
            .await?;
    let codes = match &target {
        Some(target) => external_credit_target_codes::get_by_target_id(&mut tx, target.id).await?,
        None => Vec::new(),
    };
    let stored = get_stored_rows(&mut tx, upstream.user_id, upstream.moocfi_course_id).await?;

    for completion in upstream.completions {
        let earned: Vec<&ExternalCreditTargetCode> = codes
            .iter()
            .filter(|code| code.is_earned_by(completion.tier))
            .collect();
        for code in &earned {
            let Some(target) = &target else { break };
            let has_row = stored.iter().any(|row| {
                row.moocfi_completion_id == completion.id
                    && row.external_credit_target_code_id == code.id
            });
            let registrations = registrations_under(completion, &code.uh_course_code);
            let is_new_and_ours = completion.eligible_for_ects == Some(true)
                && completion.effective_date() >= target.delegated_at;
            if (has_row || is_new_and_ours || !registrations.is_empty())
                && upsert(
                    &mut tx,
                    &completion_facts(
                        &upstream,
                        completion,
                        StoredRow {
                            moocfi_completion_id: completion.id,
                            external_credit_target_id: target.id,
                            external_credit_target_code_id: code.id,
                            uh_course_code: code.uh_course_code.clone(),
                            grading: code.grading,
                        },
                        &registrations,
                    ),
                )
                .await?
                .is_none()
            {
                warn!(
                    moocfi_completion_id = %completion.id,
                    "Not syncing a mooc.fi completion another account holds"
                );
            }
        }
        for row in stored.iter().filter(|row| {
            row.moocfi_completion_id == completion.id
                && !earned
                    .iter()
                    .any(|code| code.id == row.external_credit_target_code_id)
        }) {
            let registrations = registrations_under(completion, &row.uh_course_code);
            upsert(
                &mut tx,
                &completion_facts(&upstream, completion, row.clone(), &registrations),
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
    /// See `credit_registration_prerequisite_met`.
    pub prerequisite_met: bool,
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
  p.course_code_allowed AS "course_code_allowed!",
  p.prerequisite_met AS "prerequisite_met!"
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

/// For each of the rows that has one, the mooc.fi id of its registered equivalent: an earlier
/// completion with the same grade already registered under the same code, which keeps this one from
/// being registered under it again. See the `moocfi_registered_equivalent` SQL function.
pub async fn get_registered_equivalents(
    conn: &mut PgConnection,
    external_completion_ids: &[Uuid],
) -> ModelResult<HashMap<Uuid, Uuid>> {
    let rows = sqlx::query!(
        r#"
SELECT ec.id,
  moocfi_registered_equivalent(ec) AS "registered_equivalent_moocfi_completion_id!"
FROM external_completions ec
WHERE ec.id = ANY($1)
  AND moocfi_registered_equivalent(ec) IS NOT NULL
        "#,
        external_completion_ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.id, row.registered_equivalent_moocfi_completion_id))
        .collect())
}

/// A stored row's place, for deciding which rows a sync updates.
#[derive(Debug, Clone)]
struct StoredRow {
    moocfi_completion_id: Uuid,
    external_credit_target_id: Uuid,
    external_credit_target_code_id: Uuid,
    uh_course_code: String,
    grading: ExternalGrading,
}

async fn get_stored_rows(
    conn: &mut PgConnection,
    user_id: Uuid,
    moocfi_course_id: Uuid,
) -> ModelResult<Vec<StoredRow>> {
    let res = sqlx::query_as!(
        StoredRow,
        r#"
SELECT ec.moocfi_completion_id,
  ec.external_credit_target_id,
  ec.external_credit_target_code_id,
  code.uh_course_code,
  code.grading
FROM external_completions ec
  JOIN external_credit_targets t ON t.id = ec.external_credit_target_id
  JOIN external_credit_target_codes code ON code.id = ec.external_credit_target_code_id
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

/// The registrations of `completion` on mooc.fi under one course code: those naming it, and those
/// naming none, which predate mooc.fi keeping codes and are taken to cover every code.
fn registrations_under<'a>(
    completion: &'a DelegatedCompletion,
    uh_course_code: &str,
) -> Vec<&'a DelegatedCompletionRegistration> {
    completion
        .registrations
        .iter()
        .filter(|registration| {
            registration
                .course_code
                .as_deref()
                .is_none_or(|course_code| {
                    course_code
                        .trim()
                        .eq_ignore_ascii_case(uh_course_code.trim())
                })
        })
        .collect()
}

/// Whether mooc.fi's free-text completion language is a locale such as `fi` or `fi_FI`; anything
/// else is stored as none, so the target's language is sent to Sisu in its place.
fn is_locale(language: &str) -> bool {
    let (code, region) = match language.split_once(['_', '-']) {
        Some((code, region)) => (code, Some(region)),
        None => (language, None),
    };
    code.len() == 2
        && code.bytes().all(|b| b.is_ascii_lowercase())
        && region.is_none_or(|region| {
            region.len() == 2 && region.bytes().all(|b| b.is_ascii_uppercase())
        })
}

fn completion_facts(
    upstream: &UpstreamCompletions<'_>,
    completion: &DelegatedCompletion,
    row: StoredRow,
    registrations: &[&DelegatedCompletionRegistration],
) -> ExternalCompletionFacts {
    let parsed = parse_moocfi_grade(completion.grade.as_deref(), row.grading);
    let is_ours = |slug: &Option<String>| slug.as_deref() == Some(upstream.organization_slug);
    ExternalCompletionFacts {
        external_credit_target_id: row.external_credit_target_id,
        external_credit_target_code_id: row.external_credit_target_code_id,
        user_id: upstream.user_id,
        moocfi_completion_id: completion.id,
        moocfi_user_upstream_id: upstream.moocfi_user_upstream_id,
        completion_date: completion.effective_date(),
        completion_language: completion
            .completion_language
            .clone()
            .filter(|language| is_locale(language)),
        tier: completion.tier,
        eligible_for_ects: completion.eligible_for_ects.unwrap_or(false),
        raw_grade: completion.grade.clone(),
        passed: parsed.passed,
        grade: parsed.grade,
        is_registered_upstream: registrations
            .iter()
            .any(|registration| !is_ours(&registration.organization_slug)),
        is_reported: registrations
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
