//! Visits to the registration page and check requests, per completion of either kind, kept whether
//! or not the completion has a ledger row or a linked student number yet. A row that starts
//! waiting for an enrolment takes its group from these, see
//! [`crate::library::credit_registration::preconditions`], and a student waiting for a student
//! number makes their course code's enrolment list due by them, see
//! [`crate::credit_registration_roster_schedules`].

use crate::credit_registration_account_linking_emails::LinkingMailSource;
use crate::credit_registrations::SubjectId;
use crate::library::credit_registration::enrolment_check_schedule::{
    CHECK_REQUEST_RESTART_WINDOW, EnrolmentCheckSource, VISIT_RESTART_MIN_INTERVAL,
};
use crate::prelude::*;

/// Records a visit.
pub async fn record_visit(conn: &mut PgConnection, subject: SubjectId) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO credit_registration_enrolment_check_signals (
    course_module_completion_id,
    external_completion_id,
    last_visited_at,
    visit_ladder_anchor_at
  )
VALUES ($1, $3, now(), now()) ON CONFLICT (
    (COALESCE(course_module_completion_id, external_completion_id)),
    deleted_at
  ) DO
UPDATE
SET last_visited_at = now(),
  visit_ladder_anchor_at = restarted_ladder_anchor(
    credit_registration_enrolment_check_signals.visit_ladder_anchor_at,
    $2::bigint * INTERVAL '1 second'
  )
        "#,
        subject.course_module_completion_id(),
        VISIT_RESTART_MIN_INTERVAL.num_seconds(),
        subject.external_completion_id(),
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records a check request. `source` is who asked: the student, a teacher, or a link made from a
/// roster mail.
pub async fn record_check_request(
    conn: &mut PgConnection,
    subject: SubjectId,
    source: EnrolmentCheckSource,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO credit_registration_enrolment_check_signals (
    course_module_completion_id,
    external_completion_id,
    last_check_requested_at,
    check_request_ladder_anchor_at,
    check_request_source
  )
VALUES ($1, $4, now(), now(), $2) ON CONFLICT (
    (COALESCE(course_module_completion_id, external_completion_id)),
    deleted_at
  ) DO
UPDATE
SET last_check_requested_at = now(),
  check_request_ladder_anchor_at = restarted_ladder_anchor(
    credit_registration_enrolment_check_signals.check_request_ladder_anchor_at,
    $3::bigint * INTERVAL '1 second'
  ),
  check_request_source = EXCLUDED.check_request_source
        "#,
        subject.course_module_completion_id(),
        source as EnrolmentCheckSource,
        CHECK_REQUEST_RESTART_WINDOW.num_seconds(),
        subject.external_completion_id(),
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records a check request from a link made off a roster mail for every live push-path completion
/// the user has, of either kind, on a module or mooc.fi target sharing a course code with the mail's
/// source, whichever course it is on: the mail does not say which code's list it came from. A
/// course's own completions count whatever their code. Returns those completions' subject ids.
pub async fn record_account_link(
    conn: &mut PgConnection,
    user_id: Uuid,
    source: LinkingMailSource,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query_scalar!(
        r#"
WITH codes AS (
  SELECT TRIM(linked.uh_course_code) AS course_code
  FROM course_modules linked
  WHERE linked.course_id = $2
    AND linked.deleted_at IS NULL
    AND TRIM(COALESCE(linked.uh_course_code, '')) <> ''
  UNION
  SELECT TRIM(target.uh_course_code)
  FROM external_credit_targets target
  WHERE target.id = $4
)
INSERT INTO credit_registration_enrolment_check_signals (
    course_module_completion_id,
    external_completion_id,
    last_check_requested_at,
    check_request_ladder_anchor_at,
    check_request_source
  )
SELECT s.course_module_completion_id,
  s.external_completion_id,
  now(),
  now(),
  'account_link'
FROM credit_registration_subjects s
WHERE s.user_id = $1
  AND s.is_on_pipeline
  AND NOT s.is_withdrawn
  AND (
    s.course_id = $2
    OR TRIM(s.uh_course_code) IN (
      SELECT course_code
      FROM codes
    )
  ) ON CONFLICT (
    (COALESCE(course_module_completion_id, external_completion_id)),
    deleted_at
  ) DO
UPDATE
SET last_check_requested_at = now(),
  check_request_ladder_anchor_at = restarted_ladder_anchor(
    credit_registration_enrolment_check_signals.check_request_ladder_anchor_at,
    $3::bigint * INTERVAL '1 second'
  ),
  check_request_source = EXCLUDED.check_request_source
RETURNING COALESCE(course_module_completion_id, external_completion_id) AS "subject_id!"
        "#,
        user_id,
        source.course_id(),
        CHECK_REQUEST_RESTART_WINDOW.num_seconds(),
        source.external_credit_target_id(),
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
