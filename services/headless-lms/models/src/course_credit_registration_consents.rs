use utoipa::ToSchema;

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CourseCreditRegistrationConsent {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub consent_given: bool,
    pub consent_given_at: Option<DateTime<Utc>>,
    pub consent_withdrawn_at: Option<DateTime<Utc>>,
    pub asked_at: DateTime<Utc>,
}

/// Records the student's answer, keeping both timestamps so gave-then-withdrew history survives.
pub async fn upsert(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    consent_given: bool,
) -> ModelResult<CourseCreditRegistrationConsent> {
    let res = sqlx::query_as!(
        CourseCreditRegistrationConsent,
        r#"
INSERT INTO course_credit_registration_consents (
    user_id,
    course_id,
    consent_given,
    consent_given_at,
    consent_withdrawn_at
  )
VALUES (
    $1,
    $2,
    $3,
    CASE
      WHEN $3 THEN now()
    END,
    CASE
      WHEN NOT $3 THEN now()
    END
  ) ON CONFLICT (user_id, course_id, deleted_at) DO
UPDATE
SET consent_given = $3,
  consent_given_at = CASE
    WHEN $3 THEN now()
    ELSE course_credit_registration_consents.consent_given_at
  END,
  consent_withdrawn_at = CASE
    WHEN NOT $3 THEN now()
    ELSE course_credit_registration_consents.consent_withdrawn_at
  END
RETURNING *
        "#,
        user_id,
        course_id,
        consent_given,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// `None` means never asked; `consent_given = false` means asked and declined. Only the former
/// re-opens the course-start dialog.
pub async fn get_by_user_and_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Option<CourseCreditRegistrationConsent>> {
    let res = sqlx::query_as!(
        CourseCreditRegistrationConsent,
        r#"
SELECT *
FROM course_credit_registration_consents
WHERE user_id = $1
  AND course_id = $2
  AND deleted_at IS NULL
        "#,
        user_id,
        course_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<CourseCreditRegistrationConsent>> {
    let res = sqlx::query_as!(
        CourseCreditRegistrationConsent,
        r#"
SELECT *
FROM course_credit_registration_consents
WHERE user_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
        "#,
        user_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Why the course's enrolled students are not going to get credits. Neither count includes a student
/// who has both consented and linked a number.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Copy, ToSchema)]
pub struct CourseCreditRegistrationBlockedStudentCounts {
    /// Consented, but we hold no student number for them.
    pub unlinked_consented_student_count: i64,
    /// Never asked or declined.
    pub no_consent_student_count: i64,
}

pub async fn count_blocked_students_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<CourseCreditRegistrationBlockedStudentCounts> {
    let res = sqlx::query_as!(
        CourseCreditRegistrationBlockedStudentCounts,
        r#"
WITH enrolled AS (
  SELECT DISTINCT cie.user_id
  FROM course_instance_enrollments cie
  WHERE cie.course_id = $1
    AND cie.deleted_at IS NULL
)
SELECT COUNT(*) FILTER (
    WHERE c.consent_given
      AND vsn.id IS NULL
  ) AS "unlinked_consented_student_count!",
  COUNT(*) FILTER (
    WHERE c.consent_given IS NOT TRUE
  ) AS "no_consent_student_count!"
FROM enrolled e
  LEFT JOIN course_credit_registration_consents c ON c.user_id = e.user_id
  AND c.course_id = $1
  AND c.deleted_at IS NULL
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = e.user_id
  AND vsn.deleted_at IS NULL
        "#,
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Standing consents of these accounts, as `(user_id, course_id)` pairs. Consent is per course, so
/// a selection spanning courses cannot be judged by user alone.
///
/// `consent_withdrawn_at` survives a later consent as an audit trail, so `consent_given` alone is
/// what counts as consented, here and in the precondition engine.
pub async fn get_consenting_user_and_course_ids(
    conn: &mut PgConnection,
    user_ids: &[Uuid],
) -> ModelResult<Vec<(Uuid, Uuid)>> {
    let res = sqlx::query!(
        r#"
SELECT user_id,
  course_id
FROM course_credit_registration_consents
WHERE user_id = ANY($1::uuid [])
  AND consent_given
  AND deleted_at IS NULL
        "#,
        user_ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(res
        .into_iter()
        .map(|row| (row.user_id, row.course_id))
        .collect())
}

pub async fn get_consenting_user_ids_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query_scalar!(
        r#"
SELECT user_id
FROM course_credit_registration_consents
WHERE course_id = $1
  AND consent_given
  AND deleted_at IS NULL
        "#,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
