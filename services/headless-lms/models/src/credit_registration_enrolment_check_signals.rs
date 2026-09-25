//! Visits to the registration page and check requests, per completion, kept whether or not the
//! completion has a ledger row or a linked student number yet. A row that starts waiting for an
//! enrolment takes its group from these; see
//! [`crate::library::credit_registration::preconditions`].

use crate::library::credit_registration::enrolment_check_schedule::EnrolmentCheckSource;
use crate::prelude::*;

/// Records a visit and returns when the one before it was, if any.
pub async fn record_visit(
    conn: &mut PgConnection,
    course_module_completion_id: Uuid,
) -> ModelResult<Option<DateTime<Utc>>> {
    let previous = sqlx::query_scalar!(
        r#"
WITH previous AS (
  SELECT last_visited_at
  FROM credit_registration_enrolment_check_signals
  WHERE course_module_completion_id = $1
    AND deleted_at IS NULL
  FOR UPDATE
),
recorded AS (
  INSERT INTO credit_registration_enrolment_check_signals (
      course_module_completion_id,
      last_visited_at
    )
  VALUES ($1, now()) ON CONFLICT (course_module_completion_id)
  WHERE deleted_at IS NULL DO
  UPDATE
  SET last_visited_at = now()
)
SELECT last_visited_at
FROM previous
        "#,
        course_module_completion_id,
    )
    .fetch_optional(conn)
    .await?
    .flatten();
    Ok(previous)
}

/// Records a check request. `source` is who asked: the student, a teacher, or a link made from a
/// roster mail.
pub async fn record_check_request(
    conn: &mut PgConnection,
    course_module_completion_id: Uuid,
    source: EnrolmentCheckSource,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO credit_registration_enrolment_check_signals (
    course_module_completion_id,
    last_check_requested_at,
    check_request_source
  )
VALUES ($1, now(), $2) ON CONFLICT (course_module_completion_id)
WHERE deleted_at IS NULL DO
UPDATE
SET last_check_requested_at = now(),
  check_request_source = EXCLUDED.check_request_source
        "#,
        course_module_completion_id,
        source as EnrolmentCheckSource,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records a check request from a link made off a roster mail for every live push-path completion
/// the user has on the course, and returns those completions.
pub async fn record_account_link_for_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query_scalar!(
        r#"
INSERT INTO credit_registration_enrolment_check_signals (
    course_module_completion_id,
    last_check_requested_at,
    check_request_source
  )
SELECT cmc.id,
  now(),
  'account_link'
FROM course_module_completions cmc
WHERE cmc.user_id = $1
  AND cmc.course_id = $2
  AND cmc.register_credits_via_suotar
  AND cmc.deleted_at IS NULL ON CONFLICT (course_module_completion_id)
WHERE deleted_at IS NULL DO
UPDATE
SET last_check_requested_at = now(),
  check_request_source = EXCLUDED.check_request_source
RETURNING course_module_completion_id
        "#,
        user_id,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
