use rand::RngExt;
use rand::distr::{Alphanumeric, SampleString};
use secrecy::ExposeSecret;

use crate::prelude::*;

/// Length of a generated linking token. Far beyond sufficient on purpose: the token is the only
/// proof of ownership and it is not scoped to any account of ours.
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

/// Probabilistic cleanup, reused from the existing token model rather than adding a cron.
pub async fn maybe_cleanup_expired(conn: &mut PgConnection) -> ModelResult<()> {
    let random_num = rand::rng().random_range(1..=10);
    if random_num == 1 {
        info!("Cleaning up expired student number verification tokens");
        sqlx::query!(
            r#"
DELETE FROM student_number_verification_tokens
WHERE expires_at < now()
  AND used_at IS NULL
            "#,
        )
        .execute(conn)
        .await?;
    }
    Ok(())
}

/// Mints a token for a Sisu person, deliberately without binding it to an account: the click, made
/// while logged in, is what creates the binding.
///
/// Returns the row id and the plaintext token to put in the mailed link.
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

/// Looks up an unused, unexpired token. Never claims it: claiming is an explicit `POST` from a
/// logged-in session after a confirmation step.
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

/// Marks the token claimed by the logged-in account. Returns whether the claim won the race; a
/// second claim of the same token must not succeed.
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

/// Retires outstanding tokens for a student number, for when the link was established some other
/// way and the mailed links must stop working.
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
