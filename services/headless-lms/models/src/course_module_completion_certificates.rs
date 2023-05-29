use crate::prelude::*;
use headless_lms_utils as utils;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseModuleCompletionCertificate {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub course_module_id: Uuid,
    pub course_instance_id: Uuid,
    pub name_on_certificate: String,
    pub verification_id: String,
}

pub async fn get_certificate_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_module_id: Uuid,
    course_instance_id: Uuid,
) -> ModelResult<CourseModuleCompletionCertificate> {
    let res = sqlx::query_as!(
        CourseModuleCompletionCertificate,
        "
SELECT *
FROM course_module_completion_certificates
WHERE user_id = $1
  AND course_module_id = $2
  AND course_instance_id = $3
  AND deleted_at IS NULL
",
        user_id,
        course_module_id,
        course_instance_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
/// Verifies that the user has completed the given module and creates the certificate in the database.
pub async fn generate_and_insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_module_id: Uuid,
    course_instance_id: Uuid,
    name_on_certificate: &str,
) -> ModelResult<CourseModuleCompletionCertificate> {
    // Verify that the user has completed the module in the course instance
    if !crate::course_module_completions::user_has_completed_course_module_on_instance(
        conn,
        user_id,
        course_module_id,
        course_instance_id,
    )
    .await?
    {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "User has not completed the module in the given course instance".to_string(),
            None,
        ));
    }
    // Verify that a certificate doesn't already exist
    if sqlx::query!(
        "
SELECT id
FROM course_module_completion_certificates
WHERE user_id = $1
    AND course_module_id = $2
    AND course_instance_id = $3
    AND deleted_at IS NULL
",
        user_id,
        course_module_id,
        course_instance_id,
    )
    .fetch_optional(&mut *conn)
    .await?
    .is_some()
    {
        // Certificate already exists
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "User already has a certificate for the given module and course instance".to_string(),
            None,
        ));
    }

    let verification_id = generate_verification_id();
    let res = sqlx::query_as!(
        CourseModuleCompletionCertificate,
        "
INSERT INTO course_module_completion_certificates (
    user_id,
    course_module_id,
    course_instance_id,
    name_on_certificate,
    verification_id
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING *
",
        user_id,
        course_module_id,
        course_instance_id,
        name_on_certificate,
        verification_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_certificate_by_verification_id(
    conn: &mut PgConnection,
    certificate_verification_id: &str,
) -> ModelResult<CourseModuleCompletionCertificate> {
    let res = sqlx::query_as!(
        CourseModuleCompletionCertificate,
        "
SELECT *
FROM course_module_completion_certificates
WHERE verification_id = $1
  AND deleted_at IS NULL
",
        certificate_verification_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

fn generate_verification_id() -> String {
    utils::strings::generate_easily_writable_random_string(15)
}
