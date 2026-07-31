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
