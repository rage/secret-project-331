//! The other credits of a student's module that a new attempt is weighed against before it is sent.

use super::state::CreditRegistrationState;
use crate::credit_registration_policy::grade_mapping::{GradeSource, MappedGrade, map_grade};
use crate::prelude::*;

/// Another live attempt, of any completion of the same student and module, that the study registry
/// already holds.
#[derive(Debug, Clone)]
pub struct LiveSuccessForModule {
    pub id: Uuid,
    pub credit: RecordedCredit,
}

/// A credit for the student and module that our own records say the study registry holds.
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

/// Every credit for the row's student and module that our records say the registry holds: another
/// of our live attempts in a success state, or a registrar's pull-path registration.
///
/// For an answer that lists no existing attainments. Not [`lock_live_successes_for_same_module`],
/// which locks, and leaves out the pull path because nothing there can be marked for replacement.
pub async fn get_recorded_credits_for_same_module(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<Vec<RecordedCredit>> {
    let res = sqlx::query_as!(
        RecordedCredit,
        r#"
SELECT other.grade_scale_id::text AS "grade_scale_id?",
  other.grade_id::text AS "grade_id?",
  cmc.passed AS "completion_passed!",
  cmc.grade AS "completion_grade?"
FROM credit_registrations cr
  JOIN credit_registrations other ON other.user_id = cr.user_id
  AND other.course_module_id = cr.course_module_id
  AND other.id <> cr.id
  JOIN course_module_completions cmc ON cmc.id = other.course_module_completion_id
WHERE cr.id = $1
  AND other.deleted_at IS NULL
  AND other.superseded_by_id IS NULL
  AND other.state = ANY($2::credit_registration_state [])
UNION ALL
SELECT NULL::text,
  NULL::text,
  cmc.passed,
  cmc.grade
FROM credit_registrations cr
  JOIN course_module_completion_registered_to_study_registries r ON r.user_id = cr.user_id
  AND r.course_module_id = cr.course_module_id
  JOIN course_module_completions cmc ON cmc.id = r.course_module_completion_id
WHERE cr.id = $1
  -- A null registrar is our own mirror of a row the first half already reads.
  AND r.study_registry_registrar_id IS NOT NULL
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
/// Drops the row's claim on `uq_credit_registrations_person_module`, left from an earlier freeze,
/// since the slot belongs to the credit the registry holds, and the frozen credits, which nothing
/// registered. Keeps `weighed_grade`, the grade we would have sent, as the grade a later regrade of
/// the completion has to beat.
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

/// The student's other live attempts for the row's module that the registry already holds, locked
/// until the caller's transaction ends.
///
/// What another attempt has to beat to be sent, and what it replaces when it does, through
/// [`mark_pending_superseded`](super::mark_pending_superseded). Includes rows already waiting on an
/// earlier replacement, which a better one takes over.
pub async fn lock_live_successes_for_same_module(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<Vec<LiveSuccessForModule>> {
    let rows = sqlx::query!(
        r#"
SELECT other.id,
  other.grade_scale_id,
  other.grade_id,
  cmc.passed AS completion_passed,
  cmc.grade AS completion_grade
FROM credit_registrations cr
  JOIN credit_registrations other ON other.user_id = cr.user_id
  AND other.course_module_id = cr.course_module_id
  AND other.id <> cr.id
  JOIN course_module_completions cmc ON cmc.id = other.course_module_completion_id
WHERE cr.id = $1
  AND other.deleted_at IS NULL
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
        .map(|row| LiveSuccessForModule {
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
