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

/// The account's most recent link, retired ones included.
///
/// Reporting on a linking mail needs the Sisu person the mail was addressed to, and a retired link
/// is the only record of that an unlinked account has: the mail is keyed by Sisu person and we do
/// not identify an account by matching its email address against Sisu's.
pub async fn get_latest_including_deleted_by_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Option<VerifiedStudentNumber>> {
    let res = sqlx::query_as!(
        VerifiedStudentNumber,
        r#"
SELECT *
FROM verified_student_numbers
WHERE user_id = $1
ORDER BY verified_at DESC
LIMIT 1
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

/// One link as an admin support view shows it: the account it belongs to, in full, and how it was
/// established.
#[derive(Debug, Clone, PartialEq)]
pub struct AdminVerifiedStudentNumber {
    pub id: Uuid,
    pub user_id: Uuid,
    pub user_email: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub student_number: String,
    pub sisu_person_id: String,
    pub verified_at: DateTime<Utc>,
    pub verified_via: StudentNumberVerificationMethod,
    /// The Sisu-held address the proof rests on, in full. `None` for an admin-established link.
    pub verified_via_email: Option<String>,
    pub linked_by_user_id: Option<Uuid>,
    pub link_reason: Option<String>,
    pub verified_from_course_id: Option<Uuid>,
    pub live_registration_count: i64,
}

/// Live links only, newest first: a retired link is not a number we hold.
pub async fn get_admin_page(
    conn: &mut PgConnection,
    verified_via: Option<StudentNumberVerificationMethod>,
    search: Option<&str>,
    limit: i64,
    offset: i64,
) -> ModelResult<Vec<AdminVerifiedStudentNumber>> {
    let res = sqlx::query_as!(
        AdminVerifiedStudentNumber,
        r#"
SELECT vsn.id,
  vsn.user_id,
  ud.email AS "user_email?",
  ud.first_name AS "first_name?",
  ud.last_name AS "last_name?",
  vsn.student_number,
  vsn.sisu_person_id,
  vsn.verified_at,
  vsn.verified_via AS "verified_via: StudentNumberVerificationMethod",
  vsn.verified_via_email,
  vsn.linked_by_user_id,
  vsn.link_reason,
  vsn.verified_from_course_id,
  (
    SELECT COUNT(*)
    FROM credit_registrations cr
    WHERE cr.user_id = vsn.user_id
      AND cr.superseded_by_id IS NULL
      AND cr.deleted_at IS NULL
  ) AS "live_registration_count!"
FROM verified_student_numbers vsn
  LEFT JOIN user_details ud ON ud.user_id = vsn.user_id
WHERE vsn.deleted_at IS NULL
  AND (
    $1::student_number_verification_method IS NULL
    OR vsn.verified_via = $1
  )
  AND (
    $2::text IS NULL
    OR LOWER(vsn.student_number) LIKE '%' || $2 || '%' ESCAPE '\'
    OR ud.name_search_helper LIKE '%' || $2 || '%' ESCAPE '\'
    OR ud.email_search_helper LIKE '%' || $2 || '%' ESCAPE '\'
  )
ORDER BY vsn.verified_at DESC,
  vsn.id
LIMIT $3 OFFSET $4
        "#,
        verified_via as Option<StudentNumberVerificationMethod>,
        search,
        limit,
        offset,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn count_admin_page(
    conn: &mut PgConnection,
    verified_via: Option<StudentNumberVerificationMethod>,
    search: Option<&str>,
) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM verified_student_numbers vsn
  LEFT JOIN user_details ud ON ud.user_id = vsn.user_id
WHERE vsn.deleted_at IS NULL
  AND (
    $1::student_number_verification_method IS NULL
    OR vsn.verified_via = $1
  )
  AND (
    $2::text IS NULL
    OR LOWER(vsn.student_number) LIKE '%' || $2 || '%' ESCAPE '\'
    OR ud.name_search_helper LIKE '%' || $2 || '%' ESCAPE '\'
    OR ud.email_search_helper LIKE '%' || $2 || '%' ESCAPE '\'
  )
        "#,
        verified_via as Option<StudentNumberVerificationMethod>,
        search,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

/// Live links per method, so an admin-established one is never hidden inside a total.
pub async fn count_by_method_since(
    conn: &mut PgConnection,
    since: Option<DateTime<Utc>>,
) -> ModelResult<Vec<(StudentNumberVerificationMethod, i64)>> {
    let rows = sqlx::query!(
        r#"
SELECT verified_via AS "verified_via: StudentNumberVerificationMethod",
  COUNT(*) AS "count!"
FROM verified_student_numbers
WHERE deleted_at IS NULL
  AND ($1::timestamptz IS NULL OR verified_at >= $1)
GROUP BY verified_via
        "#,
        since,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.verified_via, row.count))
        .collect())
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
