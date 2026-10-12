//! Everything a submission needs that does not live on the ledger row yet. One query rather than a
//! lookup per row: the phases work in batches of up to a thousand.

use std::collections::HashMap;

use crate::prelude::*;

use super::payload::CompletionFacts;

/// The module's or mooc.fi target's fields, the linked student number and the completion, for one
/// ledger row.
#[derive(Debug, Clone)]
pub struct SubmissionContext {
    pub registration_id: Uuid,
    /// `None` once the account's number has been unlinked.
    pub student_number: Option<DbSecret>,
    pub sisu_person_id: Option<DbSecret>,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    pub completion: CompletionFacts,
}

/// The per-row facts each phase needs to act on a batch of ledger rows without a lookup per row.
pub async fn get_submission_contexts(
    conn: &mut PgConnection,
    registration_ids: &[Uuid],
) -> ModelResult<HashMap<Uuid, SubmissionContext>> {
    let rows = sqlx::query!(
        r#"
-- Nullability is stated for the outer-joined columns rather than inferred: sqlx-cli 0.9.0 derives
-- them the wrong way round, and an offline build of this query then fails to compile.
SELECT cr.id,
  vsn.student_number AS "student_number?",
  vsn.sisu_person_id AS "sisu_person_id?",
  s.uh_course_code,
  s.ects_credits,
  -- An unrecognised mooc.fi grade blocks the row before anything is built from this.
  COALESCE(s.passed, FALSE) AS "passed!",
  s.grade,
  s.completion_date AS "completion_date!",
  s.completion_language AS "completion_language!"
FROM credit_registrations cr
  JOIN credit_registration_subjects s ON s.subject_id = cr.subject_id
  AND NOT s.is_withdrawn
  LEFT JOIN course_modules cm ON cm.id = cr.course_module_id
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
  AND vsn.deleted_at IS NULL
WHERE cr.id = ANY($1::uuid [])
  AND cr.deleted_at IS NULL
  AND cm.deleted_at IS NULL
        "#,
        registration_ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| {
            (
                row.id,
                SubmissionContext {
                    registration_id: row.id,
                    student_number: row.student_number,
                    sisu_person_id: row.sisu_person_id,
                    uh_course_code: row.uh_course_code,
                    ects_credits: row.ects_credits,
                    completion: CompletionFacts {
                        passed: row.passed,
                        grade: row.grade,
                        completion_date: row.completion_date,
                        completion_language: row.completion_language,
                    },
                },
            )
        })
        .collect())
}
