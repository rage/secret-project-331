//! Problems a teacher marked as intended ("Mark as intended").

use super::types::{NewProblemDismissal, ProblemDismissal};
use crate::prelude::*;

/// Marks the problem as intended in its current state, replacing an earlier dismissal of the same
/// problem key.
pub async fn upsert(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
    created_by: Uuid,
    dismissal: &NewProblemDismissal,
) -> ModelResult<ProblemDismissal> {
    let res = sqlx::query_as!(
        ProblemDismissal,
        r#"
INSERT INTO language_version_problem_dismissals (
    course_language_group_id,
    problem_key,
    fingerprint,
    created_by
  )
VALUES ($1, $2, $3, $4)
ON CONFLICT (course_language_group_id, problem_key)
WHERE deleted_at IS NULL DO
UPDATE
SET fingerprint = EXCLUDED.fingerprint,
  created_by = EXCLUDED.created_by,
  created_at = now()
RETURNING problem_key,
  fingerprint,
  created_by,
  created_at
        "#,
        course_language_group_id,
        dismissal.problem_key,
        dismissal.fingerprint,
        created_by
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Brings a dismissed problem back. Does nothing if the problem isn't dismissed.
pub async fn delete(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
    problem_key: &str,
) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE language_version_problem_dismissals
SET deleted_at = now()
WHERE course_language_group_id = $1
  AND problem_key = $2
  AND deleted_at IS NULL
        ",
        course_language_group_id,
        problem_key
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// The live dismissals of the group, whether or not their fingerprints still match a problem.
pub async fn get_by_course_language_group_id(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
) -> ModelResult<Vec<ProblemDismissal>> {
    let res = sqlx::query_as!(
        ProblemDismissal,
        "
SELECT problem_key,
  fingerprint,
  created_by,
  created_at
FROM language_version_problem_dismissals
WHERE course_language_group_id = $1
  AND deleted_at IS NULL
        ",
        course_language_group_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
