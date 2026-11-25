//! Whether Sisu holds a course code for a student, for the codes no ledger row of theirs is under:
//! the equivalent older codes of a mooc.fi code, and a code's prerequisite with its equivalents.
//! Asked by resolve-enrolments; read by the prerequisite gate and when a row is resolved.

use std::collections::HashMap;

use chrono::TimeDelta;

use crate::credit_registrations::RegistrationScope;
use crate::prelude::*;

/// How long an answer that Sisu does not hold a code stands before the code is asked about again.
pub const CHECK_MAX_AGE: TimeDelta = TimeDelta::days(1);

/// One student and course code that is due to be asked about.
#[derive(Debug, Clone)]
pub struct DueCodeCheck {
    pub user_id: Uuid,
    pub student_number: DbSecret,
    /// Upper-cased and trimmed.
    pub course_code: String,
    /// The ledger rows that wait on the answer, for the audit log.
    pub credit_registration_ids: Vec<Uuid>,
}

/// Up to `limit` student and code pairs whose answer is missing or older than [`CHECK_MAX_AGE`]
/// without an attainment: the equivalent codes of mooc.fi rows due a resolve, first or parked
/// (as [`claim_due_for_resolve`](crate::credit_registrations::claim_due_for_resolve) takes them),
/// and the prerequisite and its equivalents of rows held in `checking_enrolment` by
/// `credit_registration_prerequisite_met`. Only students with a verified student number.
pub async fn get_due(
    conn: &mut PgConnection,
    scope: &RegistrationScope,
    limit: i64,
) -> ModelResult<Vec<DueCodeCheck>> {
    let rows = sqlx::query!(
        r#"
WITH wanted AS (
  SELECT cr.id AS credit_registration_id,
    cr.user_id,
    UPPER(TRIM(equivalent)) AS course_code
  FROM credit_registrations cr
    JOIN credit_registration_active_units au ON au.credit_unit_id = cr.credit_unit_id
    JOIN external_credit_target_codes code ON code.id = cr.external_credit_target_code_id
    CROSS JOIN LATERAL UNNEST(code.equivalent_course_codes) AS equivalent
  WHERE cr.state IN ('ready_to_submit', 'no_usable_enrolment')
    AND cr.deleted_at IS NULL
    AND cr.superseded_by_id IS NULL
    AND cr.next_attempt_at <= now()
    AND (
      cr.enrolment_check_claimed_until IS NULL
      OR cr.enrolment_check_claimed_until <= now()
    )
    AND ($2::uuid IS NULL OR cr.external_credit_target_id = $2)
    AND ($3::uuid IS NULL OR cr.user_id = $3)
    AND (
      cardinality($4::uuid []) = 0
      OR cr.id = ANY($4::uuid [])
    )
    AND $5::uuid IS NULL
  UNION ALL
  SELECT cr.id,
    cr.user_id,
    UPPER(TRIM(prerequisite_code))
  FROM credit_registrations cr
    JOIN credit_registration_active_units au ON au.credit_unit_id = cr.credit_unit_id
    JOIN external_credit_target_codes code ON code.id = cr.external_credit_target_code_id
    JOIN external_credit_target_codes prerequisite ON prerequisite.id = code.prerequisite_code_id
    CROSS JOIN LATERAL UNNEST(
      prerequisite.uh_course_code::text || prerequisite.equivalent_course_codes
    ) AS prerequisite_code
  WHERE cr.state = 'checking_enrolment'
    AND cr.deleted_at IS NULL
    AND cr.superseded_by_id IS NULL
    AND NOT credit_registration_prerequisite_met(cr)
    AND ($2::uuid IS NULL OR cr.external_credit_target_id = $2)
    AND ($3::uuid IS NULL OR cr.user_id = $3)
    AND (
      cardinality($4::uuid []) = 0
      OR cr.id = ANY($4::uuid [])
    )
    AND $5::uuid IS NULL
)
SELECT w.user_id AS "user_id!",
  vsn.student_number AS "student_number!",
  w.course_code AS "course_code!",
  ARRAY_AGG(DISTINCT w.credit_registration_id) AS "credit_registration_ids!"
FROM wanted w
  JOIN verified_student_numbers vsn ON vsn.user_id = w.user_id
  AND vsn.deleted_at IS NULL
WHERE NOT EXISTS (
    SELECT 1
    FROM credit_registration_sisu_code_checks c
    WHERE c.user_id = w.user_id
      AND c.course_code = w.course_code
      AND c.deleted_at IS NULL
      AND (
        c.attained_at IS NOT NULL
        OR c.checked_at > now() - $6::interval
      )
  )
GROUP BY w.user_id,
  vsn.student_number,
  w.course_code
ORDER BY w.user_id,
  w.course_code
LIMIT $1
        "#,
        limit,
        scope.external_credit_target_id,
        scope.user_id,
        &scope.credit_registration_ids,
        // mooc.fi rows have no course, so a course scope leaves them all out.
        scope.course_id,
        CHECK_MAX_AGE as TimeDelta,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| DueCodeCheck {
            user_id: row.user_id,
            student_number: row.student_number,
            course_code: row.course_code,
            credit_registration_ids: row.credit_registration_ids,
        })
        .collect())
}

/// Records Sisu's answer about one student and code. `attained_at` is kept once set.
pub async fn record(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_code: &str,
    is_attained: bool,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO credit_registration_sisu_code_checks (user_id, course_code, checked_at, attained_at)
VALUES (
    $1,
    UPPER(TRIM($2)),
    now(),
    CASE
      WHEN $3 THEN now()
    END
  ) ON CONFLICT (user_id, course_code, deleted_at) DO
UPDATE
SET checked_at = EXCLUDED.checked_at,
  attained_at = COALESCE(
    credit_registration_sisu_code_checks.attained_at,
    EXCLUDED.attained_at
  )
        "#,
        user_id,
        course_code,
        is_attained,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// What Sisu is known to hold of a ledger row's equivalent codes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EquivalentHolding {
    /// Sisu holds this equivalent code, which counts as holding the row's own.
    Held { course_code: String },
    /// Every equivalent was asked about recently and none is held.
    NotHeld,
    /// Some equivalent has not been asked about recently, so the row cannot be resolved yet.
    Unchecked,
}

/// [`EquivalentHolding`] for each of the rows whose code has equivalent codes; rows without any
/// are left out.
pub async fn get_equivalent_holdings(
    conn: &mut PgConnection,
    credit_registration_ids: &[Uuid],
) -> ModelResult<HashMap<Uuid, EquivalentHolding>> {
    let rows = sqlx::query!(
        r#"
SELECT cr.id,
  (
    SELECT MIN(c.course_code)
    FROM credit_registration_sisu_code_checks c
    WHERE c.user_id = cr.user_id
      AND c.deleted_at IS NULL
      AND c.attained_at IS NOT NULL
      AND c.course_code IN (
        SELECT UPPER(TRIM(equivalent))
        FROM UNNEST(code.equivalent_course_codes) AS equivalent
      )
  ) AS held_course_code,
  EXISTS (
    SELECT 1
    FROM UNNEST(code.equivalent_course_codes) AS equivalent
    WHERE NOT EXISTS (
        SELECT 1
        FROM credit_registration_sisu_code_checks c
        WHERE c.user_id = cr.user_id
          AND c.deleted_at IS NULL
          AND c.course_code = UPPER(TRIM(equivalent))
          AND c.checked_at > now() - $2::interval
      )
  ) AS "has_unchecked!"
FROM credit_registrations cr
  JOIN external_credit_target_codes code ON code.id = cr.external_credit_target_code_id
WHERE cr.id = ANY($1)
  AND cardinality(code.equivalent_course_codes) > 0
        "#,
        credit_registration_ids,
        CHECK_MAX_AGE as TimeDelta,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| {
            let holding = match row.held_course_code {
                Some(course_code) => EquivalentHolding::Held { course_code },
                None if row.has_unchecked => EquivalentHolding::Unchecked,
                None => EquivalentHolding::NotHeld,
            };
            (row.id, holding)
        })
        .collect())
}
