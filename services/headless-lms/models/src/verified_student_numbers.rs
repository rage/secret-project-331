use utoipa::ToSchema;

use crate::prelude::*;

/// How a student number was proven to belong to an account.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, ToSchema)]
#[sqlx(
    type_name = "student_number_verification_method",
    rename_all = "snake_case"
)]
#[serde(rename_all = "snake_case")]
pub enum StudentNumberVerificationMethod {
    EmailedLink,
    EmailMatchFastTrack,
    AdminManual,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct VerifiedStudentNumber {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub student_number: String,
    pub sisu_person_id: String,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
    pub verified_at: DateTime<Utc>,
    pub verified_via: StudentNumberVerificationMethod,
    pub verified_via_email: Option<String>,
    pub verified_via_email_match_field: Option<String>,
    pub account_email_verified_at: Option<DateTime<Utc>>,
    pub linked_by_user_id: Option<Uuid>,
    pub link_reason: Option<String>,
    pub verified_from_course_id: Option<Uuid>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewVerifiedStudentNumber {
    pub user_id: Uuid,
    pub student_number: String,
    pub sisu_person_id: String,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
    pub verified_via: StudentNumberVerificationMethod,
    /// The Sisu-held address the proof rests on. Must be `None` exactly for `AdminManual`.
    pub verified_via_email: Option<String>,
    pub verified_via_email_match_field: Option<String>,
    pub account_email_verified_at: Option<DateTime<Utc>>,
    pub linked_by_user_id: Option<Uuid>,
    pub link_reason: Option<String>,
    pub verified_from_course_id: Option<Uuid>,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    new: &NewVerifiedStudentNumber,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        r#"
INSERT INTO verified_student_numbers (
    id,
    user_id,
    student_number,
    sisu_person_id,
    first_names,
    last_name,
    verified_via,
    verified_via_email,
    verified_via_email_match_field,
    account_email_verified_at,
    linked_by_user_id,
    link_reason,
    verified_from_course_id
  )
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12,
    $13
  )
RETURNING id
        "#,
        pkey_policy.into_uuid(),
        new.user_id,
        new.student_number,
        new.sisu_person_id,
        new.first_names,
        new.last_name,
        new.verified_via as StudentNumberVerificationMethod,
        new.verified_via_email,
        new.verified_via_email_match_field,
        new.account_email_verified_at,
        new.linked_by_user_id,
        new.link_reason,
        new.verified_from_course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<VerifiedStudentNumber> {
    let res = sqlx::query_as!(
        VerifiedStudentNumber,
        r#"
SELECT *
FROM verified_student_numbers
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// The account's live link, if it has one. At most one exists by partial unique index.
pub async fn get_by_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Option<VerifiedStudentNumber>> {
    let res = sqlx::query_as!(
        VerifiedStudentNumber,
        r#"
SELECT *
FROM verified_student_numbers
WHERE user_id = $1
  AND deleted_at IS NULL
        "#,
        user_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_student_number(
    conn: &mut PgConnection,
    student_number: &str,
) -> ModelResult<Option<VerifiedStudentNumber>> {
    let res = sqlx::query_as!(
        VerifiedStudentNumber,
        r#"
SELECT *
FROM verified_student_numbers
WHERE student_number = $1
  AND deleted_at IS NULL
        "#,
        student_number
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_user_ids(
    conn: &mut PgConnection,
    user_ids: &[Uuid],
) -> ModelResult<Vec<VerifiedStudentNumber>> {
    let res = sqlx::query_as!(
        VerifiedStudentNumber,
        r#"
SELECT *
FROM verified_student_numbers
WHERE user_id = ANY($1::uuid [])
  AND deleted_at IS NULL
        "#,
        user_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The person id rather than the number, because the number changes when a student moves between
/// programmes while the person id does not.
pub async fn get_by_sisu_person_ids(
    conn: &mut PgConnection,
    sisu_person_ids: &[String],
) -> ModelResult<Vec<VerifiedStudentNumber>> {
    let res = sqlx::query_as!(
        VerifiedStudentNumber,
        r#"
SELECT *
FROM verified_student_numbers
WHERE sisu_person_id = ANY($1::varchar [])
  AND deleted_at IS NULL
        "#,
        sisu_person_ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_student_numbers(
    conn: &mut PgConnection,
    student_numbers: &[String],
) -> ModelResult<Vec<VerifiedStudentNumber>> {
    let res = sqlx::query_as!(
        VerifiedStudentNumber,
        r#"
SELECT *
FROM verified_student_numbers
WHERE student_number = ANY($1::varchar [])
  AND deleted_at IS NULL
        "#,
        student_numbers
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Unlinks by soft-delete; relinking inserts a new row, keeping the old number for audit.
pub async fn soft_delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE verified_student_numbers
SET deleted_at = now()
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}
