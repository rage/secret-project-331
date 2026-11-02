//! The other credits of a student's course code that a new attempt is weighed against before it is
//! sent, whichever module or mooc.fi target they came from: the study registry holds one attainment
//! per person and course unit.

use super::state::CreditRegistrationState;
use crate::library::credit_registration::grade_mapping::{GradeSource, MappedGrade, map_grade};
use crate::prelude::*;

/// Another live attempt, of any completion of the same student and course code, that the study
/// registry already holds.
#[derive(Debug, Clone)]
pub struct LiveSuccessForCourseCode {
    pub id: Uuid,
    pub credit: RecordedCredit,
}

/// A credit for the student and course code that our own records say the study registry holds.
#[derive(Debug, Clone)]
pub struct RecordedCredit {
    /// `None` for a credit the pull path registered, which freezes nothing.
    pub grade_scale_id: Option<String>,
    pub grade_id: Option<String>,
    pub completion_passed: bool,
    pub completion_grade: Option<i32>,
}

impl RecordedCredit {
    /// The grade the registry holds: the frozen one, or for a credit with nothing frozen (settled
    /// before a freeze, or registered by the pull path), its completion's, which the registry held
    /// at least as well.
    pub fn held_grade(&self) -> Option<MappedGrade> {
        MappedGrade::from_columns(self.grade_scale_id.as_deref(), self.grade_id.as_deref()).or_else(
            || {
                map_grade(GradeSource {
                    passed: self.completion_passed,
                    grade: self.completion_grade,
                    enrolment_grade_scale_id: None,
                })
                .ok()
            },
        )
    }
}

/// Every credit for the row's student and course code that our records say the registry holds:
/// another of our live attempts in a success state, or a registrar's pull-path registration. The
/// row's code is its unit's current one, which is what a payload frozen now would carry; credits of
/// the same unit count whatever code they were frozen with.
///
/// For an answer that lists no existing attainments. Not
/// [`lock_live_successes_for_same_course_code`], which locks, and leaves out the pull path because
/// nothing there can be marked for replacement.
pub async fn get_recorded_credits_for_same_course_code(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<Vec<RecordedCredit>> {
    let res = sqlx::query_as!(
        RecordedCredit,
        r#"
WITH this AS (
  SELECT cr.id,
    cr.user_id,
    cr.credit_unit_id,
    UPPER(TRIM(s.uh_course_code)) AS course_code
  FROM credit_registrations cr
    JOIN credit_registration_subjects s ON s.subject_id = cr.subject_id
  WHERE cr.id = $1
)
SELECT other.grade_scale_id::text AS "grade_scale_id?",
  other.grade_id::text AS "grade_id?",
  os.passed IS TRUE AS "completion_passed!",
  os.grade AS "completion_grade?"
FROM this
  JOIN credit_registrations other ON other.user_id = this.user_id
  AND (
    UPPER(TRIM(other.uh_course_code)) = this.course_code
    OR other.credit_unit_id = this.credit_unit_id
  )
  AND other.id <> this.id
  JOIN credit_registration_subjects os ON os.subject_id = other.subject_id
WHERE other.deleted_at IS NULL
  AND other.superseded_by_id IS NULL
  AND other.state = ANY($2::credit_registration_state [])
UNION ALL
SELECT NULL::text,
  NULL::text,
  cmc.passed,
  cmc.grade
FROM this
  JOIN course_module_completion_registered_to_study_registries r ON r.user_id = this.user_id
  JOIN course_modules cm ON cm.id = r.course_module_id
  AND (
    UPPER(TRIM(cm.uh_course_code)) = this.course_code
    OR cm.id = this.credit_unit_id
  )
  JOIN course_module_completions cmc ON cmc.id = r.course_module_completion_id
  -- A null registrar is our own mirror of a row the first half already reads.
WHERE r.study_registry_registrar_id IS NOT NULL
  AND r.deleted_at IS NULL
        "#,
        id,
        &CreditRegistrationState::SUCCESS_STATES as &[CreditRegistrationState],
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Readies a row that resolve-enrolments settles as `duplicate` without sending it, in the caller's
/// transaction and before the transition.
///
/// Drops the row's claim on `uq_credit_registrations_person_course_code`, left from an earlier
/// freeze, since the slot belongs to the credit the registry holds, and the frozen credits, which
/// nothing registered. Keeps `weighed_grade`, the grade we would have sent, as the grade a later
/// regrade of the completion has to beat.
pub async fn prepare_unsent_duplicate(
    conn: &mut PgConnection,
    id: Uuid,
    weighed_grade: Option<&MappedGrade>,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE credit_registrations
SET sisu_person_id = NULL,
  grade_scale_id = $2,
  grade_id = $3,
  credits = NULL
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
        weighed_grade.map(|grade| grade.grade_scale_id.as_str()),
        weighed_grade.map(|grade| grade.grade_id.as_str()),
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// The student's other live attempts for the row's course code that the registry already holds,
/// locked until the caller's transaction ends. The row's code is its unit's current one, as in
/// [`get_recorded_credits_for_same_course_code`].
///
/// What another attempt has to beat to be sent, and what it replaces when it does, through
/// [`mark_pending_superseded`](super::mark_pending_superseded). Includes rows already waiting on an
/// earlier replacement, which a better one takes over.
pub async fn lock_live_successes_for_same_course_code(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<Vec<LiveSuccessForCourseCode>> {
    let rows = sqlx::query!(
        r#"
WITH this AS (
  SELECT cr.id,
    cr.user_id,
    cr.credit_unit_id,
    UPPER(TRIM(s.uh_course_code)) AS course_code
  FROM credit_registrations cr
    JOIN credit_registration_subjects s ON s.subject_id = cr.subject_id
  WHERE cr.id = $1
)
SELECT other.id,
  other.grade_scale_id,
  other.grade_id,
  os.passed IS TRUE AS "completion_passed!",
  os.grade AS "completion_grade?"
FROM this
  JOIN credit_registrations other ON other.user_id = this.user_id
  AND (
    UPPER(TRIM(other.uh_course_code)) = this.course_code
    OR other.credit_unit_id = this.credit_unit_id
  )
  AND other.id <> this.id
  JOIN credit_registration_subjects os ON os.subject_id = other.subject_id
WHERE other.deleted_at IS NULL
  AND other.superseded_by_id IS NULL
  AND other.state = ANY($2::credit_registration_state [])
ORDER BY other.id FOR
UPDATE OF other
        "#,
        id,
        &CreditRegistrationState::SUCCESS_STATES as &[CreditRegistrationState],
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| LiveSuccessForCourseCode {
            id: row.id,
            credit: RecordedCredit {
                grade_scale_id: row.grade_scale_id,
                grade_id: row.grade_id,
                completion_passed: row.completion_passed,
                completion_grade: row.completion_grade,
            },
        })
        .collect())
}
