//! Visits to the registration page and check requests, per completion, kept whether or not the
//! completion has a ledger row or a linked student number yet. A row that starts waiting for an
//! enrolment takes its group from these, see [`crate::library::credit_registration::preconditions`],
//! and a student waiting for a student number makes their course code's enrolment list due by
//! them, see [`crate::credit_registration_roster_schedules`].

use chrono::TimeDelta;

use crate::library::credit_registration::enrolment_check_schedule::EnrolmentCheckSource;
use crate::prelude::*;

/// A visit or check request restarts its enrolment list fetch ladder only this long after the one
/// the ladder is anchored on, so reloading the page or pressing again does not push the rungs out.
pub const LADDER_RESTART_GAP: TimeDelta = TimeDelta::days(1);

/// Records a visit.
pub async fn record_visit(
    conn: &mut PgConnection,
    course_module_completion_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO credit_registration_enrolment_check_signals (
    course_module_completion_id,
    last_visited_at,
    visit_ladder_anchor_at
  )
VALUES ($1, now(), now()) ON CONFLICT (course_module_completion_id, deleted_at) DO
UPDATE
SET last_visited_at = now(),
  visit_ladder_anchor_at = CASE
    WHEN credit_registration_enrolment_check_signals.visit_ladder_anchor_at > now() - ($2::bigint * INTERVAL '1 second') THEN credit_registration_enrolment_check_signals.visit_ladder_anchor_at
    ELSE now()
  END
        "#,
        course_module_completion_id,
        LADDER_RESTART_GAP.num_seconds(),
    )
    .execute(conn)
    .await?;
    Ok(())
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
    check_request_ladder_anchor_at,
    check_request_source
  )
VALUES ($1, now(), now(), $2) ON CONFLICT (course_module_completion_id, deleted_at) DO
UPDATE
SET last_check_requested_at = now(),
  check_request_ladder_anchor_at = CASE
    WHEN credit_registration_enrolment_check_signals.check_request_ladder_anchor_at > now() - ($3::bigint * INTERVAL '1 second') THEN credit_registration_enrolment_check_signals.check_request_ladder_anchor_at
    ELSE now()
  END,
  check_request_source = EXCLUDED.check_request_source
        "#,
        course_module_completion_id,
        source as EnrolmentCheckSource,
        LADDER_RESTART_GAP.num_seconds(),
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records a check request from a link made off a roster mail for every live push-path completion
/// the user has on a module sharing a course code with one of the course's modules, whichever
/// course it is on: the mail does not say which code's list it came from. Returns those
/// completions.
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
    check_request_ladder_anchor_at,
    check_request_source
  )
SELECT cmc.id,
  now(),
  now(),
  'account_link'
FROM course_module_completions cmc
  JOIN course_modules cm ON cm.id = cmc.course_module_id
WHERE cmc.user_id = $1
  AND cmc.register_credits_via_suotar
  AND cmc.deleted_at IS NULL
  AND (
    cmc.course_id = $2
    OR TRIM(cm.uh_course_code) IN (
      SELECT TRIM(linked.uh_course_code)
      FROM course_modules linked
      WHERE linked.course_id = $2
        AND linked.deleted_at IS NULL
        AND TRIM(COALESCE(linked.uh_course_code, '')) <> ''
    )
  ) ON CONFLICT (course_module_completion_id, deleted_at) DO
UPDATE
SET last_check_requested_at = now(),
  check_request_ladder_anchor_at = CASE
    WHEN credit_registration_enrolment_check_signals.check_request_ladder_anchor_at > now() - ($3::bigint * INTERVAL '1 second') THEN credit_registration_enrolment_check_signals.check_request_ladder_anchor_at
    ELSE now()
  END,
  check_request_source = EXCLUDED.check_request_source
RETURNING course_module_completion_id
        "#,
        user_id,
        course_id,
        LADDER_RESTART_GAP.num_seconds(),
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
