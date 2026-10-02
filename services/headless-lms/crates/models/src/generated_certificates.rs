use crate::prelude::*;
use headless_lms_utils as utils;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]

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
        verification_id,
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

#[derive(Debug, Deserialize, Serialize, ToSchema)]

pub struct CertificateUpdateRequest {
    pub date_issued: DateTime<Utc>,
    pub name_on_certificate: Option<String>,
}

/// Rewrites what an issued certificate prints: its holder-facing name and the date it is dated.
///
/// The issue date is `created_at`, which is the column the certificate and every listing of it
/// read, so `date_issued` is written unconditionally; pass the row's current value to leave it be.
/// `name_on_certificate` of `None` leaves the name as it is.
///
/// `expected_updated_at` makes this a compare-and-swap: pass the `updated_at` of the row the
/// caller read and the write lands only if nothing has touched the row since, returning `None`
/// when something has. `None` skips the check, for a caller with no earlier read to protect.
/// Without it a name-only update silently restores the date another admin had just corrected.
pub async fn update_certificate(
    conn: &mut PgConnection,
    certificate_id: Uuid,
    date_issued: DateTime<Utc>,
    name_on_certificate: Option<String>,
    expected_updated_at: Option<DateTime<Utc>>,
) -> ModelResult<Option<GeneratedCertificate>> {
    let updated = sqlx::query_as!(
        GeneratedCertificate,
        r#"
UPDATE generated_certificates
SET created_at = $2,
  name_on_certificate = COALESCE($3, name_on_certificate),
  updated_at = NOW()
WHERE id = $1
  AND deleted_at IS NULL
  AND (
    $4::timestamptz IS NULL
    OR updated_at = $4
  )
RETURNING *
        "#,
        certificate_id,
        date_issued,
        name_on_certificate,
        expected_updated_at
    )
    .fetch_optional(conn)
    .await?;
    Ok(updated)
}

pub async fn get_by_id(
    conn: &mut PgConnection,
    certificate_id: Uuid,
) -> ModelResult<GeneratedCertificate> {
    let res = sqlx::query_as!(
        GeneratedCertificate,
        r#"
        SELECT *
        FROM generated_certificates
        WHERE id = $1
          AND deleted_at IS NULL
        "#,
        certificate_id
    )
    .fetch_one(conn)
    .await?;

    Ok(res)
}

/// A certificate with the course it was earned on, as a profile listing or support tooling needs it.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct UserCertificate {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name_on_certificate: String,
    /// Addresses the public validation page, which is also how the holder views the image.
    pub verification_id: String,
    pub created_at: DateTime<Utc>,
    pub course_id: Uuid,
    pub course_name: String,
    /// `None` for a course's default module.
    pub course_module_name: Option<String>,
}

/// Every certificate the user holds, newest first.
///
/// One row per certificate even when its configuration requires several modules: the row names the
/// first required module, which is the whole requirement for every configuration a course editor can
/// currently build.
pub async fn get_all_by_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<UserCertificate>> {
    let res = sqlx::query_as!(
        UserCertificate,
        r#"
SELECT DISTINCT ON (gc.id) gc.id,
  gc.user_id,
  gc.name_on_certificate,
  gc.verification_id,
  gc.created_at,
  c.id AS course_id,
  c.name AS course_name,
  cm.name AS course_module_name
FROM generated_certificates gc
  JOIN certificate_configuration_to_requirements cctr ON cctr.certificate_configuration_id = gc.certificate_configuration_id
  AND cctr.deleted_at IS NULL
  JOIN course_modules cm ON cm.id = cctr.course_module_id
  AND cm.deleted_at IS NULL
  JOIN courses c ON c.id = cm.course_id
  AND c.deleted_at IS NULL
WHERE gc.user_id = $1
  AND gc.deleted_at IS NULL
ORDER BY gc.id,
  cm.order_number
        "#,
        user_id
    )
    .fetch_all(conn)
    .await?;
    // `DISTINCT ON` dictates the query's own ordering, so the newest-first order is applied here.
    let mut res = res;
    res.sort_by_key(|certificate| std::cmp::Reverse(certificate.created_at));
    Ok(res)
}

/// The certificate a verification id addresses, or `None` when no active certificate has that id.
///
/// Unlike [get_certificate_by_verification_id] this carries the owning course, which is what an
/// admin acting on a certificate has to be authorized against.
pub async fn get_by_verification_id(
    conn: &mut PgConnection,
    verification_id: &str,
) -> ModelResult<Option<UserCertificate>> {
    let res = sqlx::query_as!(
        UserCertificate,
        r#"
SELECT DISTINCT ON (gc.id) gc.id,
  gc.user_id,
  gc.name_on_certificate,
  gc.verification_id,
  gc.created_at,
  c.id AS course_id,
  c.name AS course_name,
  cm.name AS course_module_name
FROM generated_certificates gc
  JOIN certificate_configuration_to_requirements cctr ON cctr.certificate_configuration_id = gc.certificate_configuration_id
  AND cctr.deleted_at IS NULL
  JOIN course_modules cm ON cm.id = cctr.course_module_id
  AND cm.deleted_at IS NULL
  JOIN courses c ON c.id = cm.course_id
  AND c.deleted_at IS NULL
WHERE gc.verification_id = $1
  AND gc.deleted_at IS NULL
ORDER BY gc.id,
  cm.order_number
        "#,
        verification_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn find_existing(
    conn: &mut PgConnection,
    user_id: Uuid,
    config_id: Uuid,
) -> ModelResult<Option<Uuid>> {
    let row = sqlx::query!(
        r#"
        SELECT id
        FROM generated_certificates
        WHERE user_id = $1
          AND certificate_configuration_id = $2
          AND deleted_at IS NULL
        "#,
        user_id,
        config_id
    )
    .fetch_optional(conn)
    .await?;

    Ok(row.map(|r| r.id))
}

pub async fn insert_raw(
    conn: &mut PgConnection,
    user_id: Uuid,
    config_id: Uuid,
    name: &str,
    verification_id: &str,
) -> ModelResult<Uuid> {
    let row = sqlx::query!(
        r#"
        INSERT INTO generated_certificates (
            user_id,
            certificate_configuration_id,
            name_on_certificate,
            verification_id
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
        user_id,
        config_id,
        name,
        verification_id
    )
    .fetch_one(conn)
    .await?;

    Ok(row.id)
}
