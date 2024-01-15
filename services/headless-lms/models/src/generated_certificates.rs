use crate::prelude::*;
use headless_lms_utils as utils;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct GeneratedCertificate {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub name_on_certificate: String,
    pub verification_id: String,
    pub certificate_configuration_id: Uuid,
}

pub async fn get_certificate_for_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    certificate_configuration_id: Uuid,
) -> ModelResult<GeneratedCertificate> {
    let res = sqlx::query_as!(
        GeneratedCertificate,
        "
SELECT *
FROM generated_certificates
WHERE user_id = $1
  AND certificate_configuration_id = $2
  AND deleted_at IS NULL
",
        user_id,
        certificate_configuration_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
/// Verifies that the user has completed the given module and creates the certificate in the database.
pub async fn generate_and_insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    name_on_certificate: &str,
    certificate_configuration_id: Uuid,
) -> ModelResult<GeneratedCertificate> {
    let requirements = crate::certificate_configuration_to_requirements::get_all_requirements_for_certificate_configuration(conn, certificate_configuration_id).await?;
    // Verify that the user has completed the module in the course instance
    if !requirements
        .has_user_completed_all_requirements(conn, user_id)
        .await?
    {
        return Err(ModelError::new(
            ModelErrorType::PreconditionFailed,
            "User has not completed all the requirements to be eligible for this certificate."
                .to_string(),
            None,
        ));
    }

    // Verify that a certificate doesn't already exist
    if sqlx::query!(
        "
SELECT id
FROM generated_certificates
WHERE user_id = $1
    AND certificate_configuration_id = $2
    AND deleted_at IS NULL
",
        user_id,
        certificate_configuration_id,
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
        GeneratedCertificate,
        "
INSERT INTO generated_certificates (
    user_id,
    certificate_configuration_id,
    name_on_certificate,
    verification_id
  )
VALUES ($1, $2, $3, $4)
RETURNING *
",
        user_id,
        certificate_configuration_id,
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
) -> ModelResult<GeneratedCertificate> {
    let res = sqlx::query_as!(
        GeneratedCertificate,
        "
SELECT *
FROM generated_certificates
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
