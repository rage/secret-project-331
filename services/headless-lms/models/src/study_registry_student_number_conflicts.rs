//! Student numbers a registrar reported that could not become a link because another stood in the way.

use crate::prelude::*;
use crate::verified_student_numbers::StudentNumberVerificationMethod;

/// A conflict that still holds: the account does not hold the reported number.
#[derive(Debug, Clone)]
pub struct UnresolvedStudyRegistryConflict {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub user_id: Uuid,
    pub user_email: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub reported_student_number: DbSecret,
    pub course_id: Uuid,
    pub course_name: String,
    pub conflicting_link_user_id: Uuid,
    pub conflicting_link_user_email: Option<String>,
    pub conflicting_link_student_number: DbSecret,
    pub conflicting_link_verified_via: StudentNumberVerificationMethod,
}

/// How many conflicts still hold.
pub async fn count_unresolved(conn: &mut PgConnection) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM study_registry_student_number_conflicts c
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM verified_student_numbers vsn
    WHERE vsn.user_id = c.user_id
      AND vsn.student_number = c.student_number
      AND vsn.deleted_at IS NULL
  )
        "#
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// Conflicts that still hold, newest first.
pub async fn get_unresolved(
    conn: &mut PgConnection,
    limit: i64,
) -> ModelResult<Vec<UnresolvedStudyRegistryConflict>> {
    let rows = sqlx::query_as!(
        UnresolvedStudyRegistryConflict,
        r#"
SELECT c.id,
  c.created_at,
  c.user_id,
  ud.email AS "user_email?",
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  c.student_number AS reported_student_number,
  r.course_id,
  co.name AS course_name,
  vsn.user_id AS conflicting_link_user_id,
  holder.email AS "conflicting_link_user_email?",
  vsn.student_number AS conflicting_link_student_number,
  vsn.verified_via AS "conflicting_link_verified_via: StudentNumberVerificationMethod"
FROM study_registry_student_number_conflicts c
  JOIN course_module_completion_registered_to_study_registries r ON r.id = c.registered_completion_id
  JOIN courses co ON co.id = r.course_id
  JOIN verified_student_numbers vsn ON vsn.id = c.conflicting_verified_student_number_id
  LEFT JOIN user_details ud ON ud.user_id = c.user_id
  LEFT JOIN user_details holder ON holder.user_id = vsn.user_id
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM verified_student_numbers held
    WHERE held.user_id = c.user_id
      AND held.student_number = c.student_number
      AND held.deleted_at IS NULL
  )
ORDER BY c.created_at DESC,
  c.id
LIMIT $1
        "#,
        limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows)
}

/// Records that a registrar-reported link could not take its Sisu person because `blocking_link_id`,
/// another account's live link, already holds that person. Nothing is recorded unless `link_id`'s
/// number is still the latest one a registrar reported for its account.
pub async fn record_person_conflict(
    conn: &mut PgConnection,
    link_id: Uuid,
    blocking_link_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
INSERT INTO study_registry_student_number_conflicts (
    user_id,
    student_number,
    registered_completion_id,
    conflicting_verified_student_number_id
  )
SELECT reported.user_id,
  reported.student_number,
  reported.registered_completion_id,
  $2
FROM verified_student_numbers link
  JOIN study_registry_reported_student_numbers reported ON reported.user_id = link.user_id
  AND reported.student_number = link.student_number
WHERE link.id = $1
ON CONFLICT DO NOTHING
        "#,
        link_id,
        blocking_link_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}
