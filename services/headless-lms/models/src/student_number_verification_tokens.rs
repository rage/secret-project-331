use rand::RngExt;
use rand::distr::{Alphanumeric, SampleString};
use secrecy::ExposeSecret;

use crate::prelude::*;

/// Length of a linking token, which is the only proof of ownership and is bound to no account.
const TOKEN_LENGTH: usize = 128;

#[derive(Debug, Clone)]
pub struct StudentNumberVerificationToken {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub token: DbSecret,
    pub claimed_by_user_id: Option<Uuid>,
    pub student_number: String,
    pub sisu_person_id: String,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
    pub emailed_to: String,
    pub course_id: Option<Uuid>,
    pub expires_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewStudentNumberVerificationToken {
    pub student_number: String,
    pub sisu_person_id: String,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
    pub emailed_to: String,
    pub course_id: Option<Uuid>,
}

pub fn is_valid(token: &StudentNumberVerificationToken) -> bool {
    let now = Utc::now();
    token.expires_at > now && token.used_at.is_none() && token.deleted_at.is_none()
}

/// Probabilistic cleanup instead of a cron.
///
/// Soft-delete, not DELETE: `credit_registration_account_linking_emails` references these rows, and
/// this runs on the click path, so a foreign key violation here would 500 a student opening a valid
/// link.
pub async fn maybe_cleanup_expired(conn: &mut PgConnection) -> ModelResult<()> {
    let random_num = rand::rng().random_range(1..=10);
    if random_num == 1 {
        info!("Cleaning up expired student number verification tokens");
        sqlx::query!(
            r#"
UPDATE student_number_verification_tokens
SET deleted_at = now()
WHERE expires_at < now()
  AND used_at IS NULL
  AND deleted_at IS NULL
            "#,
        )
        .execute(conn)
        .await?;
    }
    Ok(())
}

/// Mints a token for a Sisu person, bound to no account: the click while logged in creates the
/// binding. Returns the row id and the plaintext token for the mailed link.
pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    new: &NewStudentNumberVerificationToken,
) -> ModelResult<(Uuid, DbSecret)> {
    let token = DbSecret::new(Alphanumeric.sample_string(&mut rand::rng(), TOKEN_LENGTH));
    let res = sqlx::query!(
        r#"
INSERT INTO student_number_verification_tokens (
    id,
    token,
    student_number,
    sisu_person_id,
    first_names,
    last_name,
    emailed_to,
    course_id
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id
        "#,
        pkey_policy.into_uuid(),
        token.expose_secret(),
        new.student_number,
        new.sisu_person_id,
        new.first_names,
        new.last_name,
        new.emailed_to,
        new.course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok((res.id, token))
}

/// A token row with everything pinned, for the seed only.
#[derive(Debug, Clone, PartialEq)]
pub struct SeedStudentNumberVerificationToken {
    /// Fixed plaintext so a spec can navigate straight to the link. At least 128 characters, or the
    /// `student_number_verification_token_length` check rejects the row.
    pub token: String,
    pub student_number: String,
    pub sisu_person_id: String,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
    pub emailed_to: String,
    pub course_id: Option<Uuid>,
    pub expires_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
    pub claimed_by_user_id: Option<Uuid>,
}

/// Seeds a token with a fixed plaintext value and a chosen expiry/claim state, which [`insert`]
/// cannot do: system tests need the valid, expired and used links to be constants. Seed use only.
pub async fn insert_seed_row(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    seed: &SeedStudentNumberVerificationToken,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        r#"
INSERT INTO student_number_verification_tokens (
    id,
    token,
    student_number,
    sisu_person_id,
    first_names,
    last_name,
    emailed_to,
    course_id,
    expires_at,
    used_at,
    claimed_by_user_id
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING id
        "#,
        pkey_policy.into_uuid(),
        seed.token,
        seed.student_number,
        seed.sisu_person_id,
        seed.first_names,
        seed.last_name,
        seed.emailed_to,
        seed.course_id,
        seed.expires_at,
        seed.used_at,
        seed.claimed_by_user_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

/// Looks up an unused, unexpired token without claiming it; claiming is a separate explicit `POST`.
pub async fn get_unclaimed_by_token(
    conn: &mut PgConnection,
    token: &DbSecret,
) -> ModelResult<Option<StudentNumberVerificationToken>> {
    maybe_cleanup_expired(conn).await?;

    let res = sqlx::query_as!(
        StudentNumberVerificationToken,
        r#"
SELECT *
FROM student_number_verification_tokens
WHERE token = $1
  AND expires_at > now()
  AND used_at IS NULL
  AND deleted_at IS NULL
        "#,
        token.expose_secret()
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// Looks up a token whatever state it is in, so the landing page can tell an expired link from a
/// spent one instead of showing one message for both.
pub async fn get_by_token(
    conn: &mut PgConnection,
    token: &DbSecret,
) -> ModelResult<Option<StudentNumberVerificationToken>> {
    let res = sqlx::query_as!(
        StudentNumberVerificationToken,
        r#"
SELECT *
FROM student_number_verification_tokens
WHERE token = $1
        "#,
        token.expose_secret()
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<StudentNumberVerificationToken> {
    let res = sqlx::query_as!(
        StudentNumberVerificationToken,
        r#"
SELECT *
FROM student_number_verification_tokens
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Marks the token claimed by the account. Returns false if another claim already won the race.
pub async fn claim(
    conn: &mut PgConnection,
    token: &DbSecret,
    claimed_by_user_id: Uuid,
) -> ModelResult<bool> {
    let claimed = sqlx::query!(
        r#"
UPDATE student_number_verification_tokens
SET used_at = now(),
  claimed_by_user_id = $2
WHERE token = $1
  AND used_at IS NULL
  AND deleted_at IS NULL
  AND expires_at > now()
RETURNING id
        "#,
        token.expose_secret(),
        claimed_by_user_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(claimed.is_some())
}

/// Retires outstanding tokens for a student number, once the link was established some other way.
pub async fn soft_delete_unused_for_student_number(
    conn: &mut PgConnection,
    student_number: &str,
) -> ModelResult<u64> {
    let res = sqlx::query!(
        r#"
UPDATE student_number_verification_tokens
SET deleted_at = now()
WHERE student_number = $1
  AND used_at IS NULL
  AND deleted_at IS NULL
        "#,
        student_number
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected())
}
