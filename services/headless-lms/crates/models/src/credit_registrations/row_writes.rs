//! Writes to a row's fields other than its state, which only [`transition`](super::transition::transition)
//! writes: the frozen payload, what the study registry answered, the schedule, the counters and the flags.

use super::transition::AdminAttention;
use crate::credit_registration_policy::enrolment_check_schedule::EnrolmentCheckSource;
use crate::prelude::*;
use chrono::NaiveDate;
use headless_lms_utils::secret_string::expose_option;
use secrecy::ExposeSecret;
use std::collections::HashMap;

/// Frozen copy of what we are about to submit. Written once, before the row leaves
/// `checking_enrolment`: a later regrade must not alter a submitted row.
#[derive(Debug, Clone)]
pub struct PayloadSnapshot {
    pub student_number: DbSecret,
    pub sisu_person_id: Option<DbSecret>,
    pub uh_course_code: String,
    pub selected_enrolment_id: Option<String>,
    pub selected_enrolment_kind: Option<String>,
    pub selected_enrolment_realisation_id: Option<String>,
    /// Localized `{fi, sv, en}` realisation name, as Suotar reported it.
    pub selected_enrolment_realisation_name: Option<serde_json::Value>,
    pub attainment_date: NaiveDate,
    pub attainment_language: String,
    pub grade_scale_id: String,
    pub grade_id: String,
    pub credits: f32,
}

pub async fn set_payload_snapshot(
    conn: &mut PgConnection,
    id: Uuid,
    snapshot: &PayloadSnapshot,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET student_number = $2,
  sisu_person_id = $3,
  uh_course_code = $4,
  selected_enrolment_id = $5,
  selected_enrolment_kind = $6,
  selected_enrolment_realisation_id = $7,
  attainment_date = $8,
  attainment_language = $9,
  grade_scale_id = $10,
  grade_id = $11,
  credits = $12,
  selected_enrolment_realisation_name = $13
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        snapshot.student_number.expose_secret(),
        expose_option(&snapshot.sisu_person_id),
        snapshot.uh_course_code,
        snapshot.selected_enrolment_id,
        snapshot.selected_enrolment_kind,
        snapshot.selected_enrolment_realisation_id,
        snapshot.attainment_date,
        snapshot.attainment_language,
        snapshot.grade_scale_id,
        snapshot.grade_id,
        snapshot.credits,
        snapshot.selected_enrolment_realisation_name,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn set_submitted_attainment(
    conn: &mut PgConnection,
    id: Uuid,
    submitted_attainment_id: &str,
    submitted_attainment_type: Option<&str>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET submitted_attainment_id = $2,
  submitted_attainment_type = $3
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        submitted_attainment_id,
        submitted_attainment_type,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Notes that verify saw only the assessment item attainment, keeping the first sighting, and
/// returns when that was.
pub async fn mark_partially_registered(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<DateTime<Utc>> {
    let partially_registered_at = sqlx::query_scalar!(
        r#"
UPDATE credit_registrations
SET partially_registered_at = COALESCE(partially_registered_at, now())
WHERE id = $1
  AND deleted_at IS NULL
RETURNING partially_registered_at AS "partially_registered_at!"
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(partially_registered_at)
}

/// Restamps `submitted_at` on rows still `submitting`, for an import that sends them again after
/// splitting a refused batch: the precondition sweep times a lost submission from this stamp, and
/// must not condemn a row still waiting its turn in the same iteration.
pub async fn restamp_submitting(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET submitted_at = now()
WHERE id = ANY($1)
  AND state = 'submitting'
  AND deleted_at IS NULL
        "#,
        ids,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Restarts the recovery grace of rows waiting out an enrolment lookup in `resolving_enrolment`,
/// which runs from `state_entered_at`, for a split batch whose later halves are still to be sent.
pub async fn restamp_resolving_enrolment(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
    if ids.is_empty() {
        return Ok(());
    }
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET state_entered_at = now()
WHERE id = ANY($1)
  AND state = 'resolving_enrolment'
  AND deleted_at IS NULL
        "#,
        ids,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records Suotar's `retryAfter` for the pending submission, before which a resubmission may
/// register the credits twice. See
/// [`ResubmissionFacts::resubmission_refusal`](super::ResubmissionFacts::resubmission_refusal).
pub async fn set_resubmit_not_before(
    conn: &mut PgConnection,
    id: Uuid,
    resubmit_not_before: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET resubmit_not_before = $2
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        resubmit_not_before,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Forgets a submission Suotar says never landed, so the row resolves its enrolment and imports
/// again from scratch, and returns how many times that has now happened.
///
/// Also restarts the retry window and the verify count: the resend is new work, and the old
/// submission's history would expire it or flag it at once.
pub async fn reset_for_resubmission(conn: &mut PgConnection, id: Uuid) -> ModelResult<i32> {
    let reimport_count = sqlx::query_scalar!(
        r#"
UPDATE credit_registrations
SET submitted_attainment_id = NULL,
  submitted_attainment_type = NULL,
  partially_registered_at = NULL,
  resubmit_not_before = NULL,
  selected_enrolment_id = NULL,
  grade_id = NULL,
  first_failed_at = NULL,
  verify_attempt_count = 0,
  not_registered_reimport_count = not_registered_reimport_count + 1
WHERE id = $1
  AND deleted_at IS NULL
RETURNING not_registered_reimport_count
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(reimport_count)
}

/// Records the attainment the study registry holds, unless another live row already claims it.
///
/// Two rows may legitimately be told about one attainment — a grade improvement Sisu declines names
/// the attainment the first attempt registered — so this returns `false` instead of failing.
pub async fn set_sisu_attainment_if_unclaimed(
    conn: &mut PgConnection,
    id: Uuid,
    sisu_attainment_id: &str,
    sisu_attainment_type: Option<&str>,
) -> ModelResult<bool> {
    let updated = sqlx::query_scalar!(
        r#"
UPDATE credit_registrations
SET sisu_attainment_id = $2,
  sisu_attainment_type = $3
WHERE id = $1
  AND deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM credit_registrations other
    WHERE other.sisu_attainment_id = $2
      AND other.deleted_at IS NULL
      AND other.id <> $1
  )
RETURNING id
        "#,
        id,
        sisu_attainment_id,
        sisu_attainment_type,
    )
    .fetch_optional(conn)
    .await;
    match updated {
        Ok(updated) => Ok(updated.is_some()),
        // The NOT EXISTS guard above isn't atomic against a concurrent caller claiming the
        // same sisu_attainment_id for a different row; the loser hits this unique index instead.
        Err(err) => {
            let err: ModelError = err.into();
            match err.error_type() {
                ModelErrorType::DatabaseConstraint { constraint, .. }
                    if constraint == "uq_credit_registrations_sisu_attainment" =>
                {
                    Ok(false)
                }
                _ => Err(err),
            }
        }
    }
}

/// Defers when the pipeline may next claim this row; the delay is the caller's policy.
///
/// Deliberately leaves `first_failed_at` alone: a state that waits on a human defers too, and
/// anchoring the retry window here would expire it.
pub async fn schedule_next_attempt(
    conn: &mut PgConnection,
    id: Uuid,
    next_attempt_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET next_attempt_at = $2
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        next_attempt_at,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Makes rows claimable again now, whatever backoff parked them. A row waiting for an enrolment
/// check has its check marked as `enrolment_check_source`: who asked for it.
///
/// Uses the database clock: an app-clock value sampled after `BEGIN` is still in the future when
/// the same transaction compares it against `now()`.
pub async fn make_due_now_batch(
    conn: &mut PgConnection,
    ids: &[Uuid],
    enrolment_check_source: EnrolmentCheckSource,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET next_attempt_at = now(),
  enrolment_check_source = CASE
    WHEN state = 'no_usable_enrolment' THEN $2
    ELSE enrolment_check_source
  END
WHERE id = ANY($1)
  AND next_attempt_at > now()
  AND superseded_by_id IS NULL
  AND deleted_at IS NULL
        "#,
        ids,
        enrolment_check_source as EnrolmentCheckSource,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn increment_submit_retry_count(conn: &mut PgConnection, id: Uuid) -> ModelResult<i32> {
    let res = sqlx::query!(
        r#"
UPDATE credit_registrations
SET submit_retry_count = submit_retry_count + 1
WHERE id = $1
  AND deleted_at IS NULL
RETURNING submit_retry_count
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.submit_retry_count)
}

/// Counts one verify poll for every row of a batch and returns each row's new count, which sets the
/// backoff the poll's answer is scheduled by.
pub async fn increment_verify_attempt_counts(
    conn: &mut PgConnection,
    ids: &[Uuid],
) -> ModelResult<HashMap<Uuid, i32>> {
    let rows = sqlx::query!(
        r#"
UPDATE credit_registrations
SET verify_attempt_count = verify_attempt_count + 1
WHERE id = ANY($1)
  AND deleted_at IS NULL
RETURNING id,
  verify_attempt_count
        "#,
        ids
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.id, row.verify_attempt_count))
        .collect())
}

/// [`schedule_next_attempt`] for a whole batch, each row with its own time.
pub async fn schedule_next_attempts(
    conn: &mut PgConnection,
    scheduled: &[(Uuid, DateTime<Utc>)],
) -> ModelResult<()> {
    let (ids, times): (Vec<Uuid>, Vec<DateTime<Utc>>) = scheduled.iter().copied().unzip();
    sqlx::query!(
        r#"
UPDATE credit_registrations cr
SET next_attempt_at = scheduled.at
FROM UNNEST($1::uuid [], $2::timestamptz []) AS scheduled(id, at)
WHERE cr.id = scheduled.id
  AND cr.deleted_at IS NULL
        "#,
        &ids,
        &times,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn set_needs_admin_attention(
    conn: &mut PgConnection,
    id: Uuid,
    attention: AdminAttention,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET needs_admin_attention = $2
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        attention.is_raised(),
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Points an old attempt at the newer one that replaced it. The old row keeps its state and
/// `terminal_at`: it really was registered.
///
/// For fixtures planting a finished replacement. The pipeline goes through
/// [`mark_pending_superseded`], which supersedes the row only once the new attempt is registered.
///
/// `superseded_by_id` may name a row that does not exist yet, as long as it is inserted before the
/// caller's transaction commits: the foreign key is deferred.
pub async fn mark_superseded(
    conn: &mut PgConnection,
    id: Uuid,
    superseded_by_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET superseded_by_id = $2,
  superseded_at = now()
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        superseded_by_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Marks a registered row as being replaced by `superseded_by_id`, a later attempt with a better
/// grade, of the same completion or another, which takes over the row's slot in
/// `uq_credit_registrations_person_module`.
///
/// Not [`mark_superseded`]: the row stays the live credit until the new attempt is registered,
/// since Sisu may accept the better grade without ever making it the course unit's attainment.
/// [`transition`](super::transition::transition) then supersedes the row, or clears the mark if
/// the new attempt stops short.
pub async fn mark_pending_superseded(
    conn: &mut PgConnection,
    id: Uuid,
    superseded_by_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET pending_superseded_by_id = $2
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        superseded_by_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records that the grade-improvement scan looked at this accepted attempt against a completion in
/// the given revision and found nothing better.
///
/// `completion_updated_at` must be the `updated_at` the scan actually read, not `now()`: the point
/// is that the row stops being a candidate until the completion changes again.
pub async fn mark_improvement_checked(
    conn: &mut PgConnection,
    id: Uuid,
    completion_updated_at: DateTime<Utc>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET improvement_checked_completion_updated_at = $2
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        completion_updated_at,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Makes every due-later `failed_retryable` row due now; returns how many. The button pressed once
/// the study registry says an outage is over.
///
/// Only `failed_retryable`: no other state's backoff means "waiting out an outage", and
/// `submission_uncertain` must never be swept forward in bulk.
pub async fn requeue_retryable_now(
    conn: &mut PgConnection,
    course_id: Option<Uuid>,
    course_module_id: Option<Uuid>,
    limit: i64,
) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
WITH due AS (
  SELECT id
  FROM credit_registrations
  WHERE state = 'failed_retryable'
    AND next_attempt_at > now()
    AND superseded_by_id IS NULL
    AND deleted_at IS NULL
    AND ($2::uuid IS NULL OR course_id = $2)
    AND ($3::uuid IS NULL OR course_module_id = $3)
  ORDER BY next_attempt_at
  LIMIT $1
),
updated AS (
  UPDATE credit_registrations cr
  SET next_attempt_at = now()
  FROM due
  WHERE cr.id = due.id
  RETURNING cr.id
)
SELECT COUNT(*) AS "count!"
FROM updated
        "#,
        limit,
        course_id,
        course_module_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}
