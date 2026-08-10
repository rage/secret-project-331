use rand::RngExt;
use secrecy::ExposeSecret;

use crate::prelude::*;

/// What a code authorises. Every read is scoped by it, so a code mailed for one action cannot be
/// spent on another.
#[derive(Debug, PartialEq, Eq, Clone, Copy, Type)]
#[sqlx(type_name = "user_email_code_purpose", rename_all = "snake_case")]
pub enum UserEmailCodePurpose {
    AdminLogin,
    AccountDeletion,
    EmailOwnershipVerification,
}

#[derive(sqlx::FromRow, Debug, Clone)]
pub struct UserEmailCode {
    pub id: Uuid,
    pub user_id: Uuid,
    pub code: DbSecret,
    pub purpose: UserEmailCodePurpose,
    pub attempt_count: i32,
    pub expires_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// A fresh code for mailing to a user.
///
/// Zero padded from a range that starts at zero: formatting `random_range(100_000..1_000_000)`
/// instead would silently exclude the 100 000 codes with a leading zero.
pub fn generate_code() -> DbSecret {
    DbSecret::new(format!("{:06}", rand::rng().random_range(0..1_000_000u32)))
}

/// Retires the user's outstanding code for `purpose` and inserts a new one.
///
/// The unique index allows only one live code per user and purpose, so the retirement is what makes
/// a resend possible at all.
pub async fn insert_user_email_code(
    conn: &mut PgConnection,
    user_id: Uuid,
    purpose: UserEmailCodePurpose,
    code: &DbSecret,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;

    sqlx::query!(
        r#"
UPDATE user_email_codes
SET deleted_at = NOW()
WHERE user_id = $1
  AND purpose = $2
  AND deleted_at IS NULL
    "#,
        user_id,
        purpose as UserEmailCodePurpose,
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        r#"
INSERT INTO user_email_codes (code, user_id, purpose)
VALUES ($1, $2, $3)
        "#,
        code.expose_secret(),
        user_id,
        purpose as UserEmailCodePurpose,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(())
}

pub async fn get_unused_user_email_code_with_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
    purpose: UserEmailCodePurpose,
) -> ModelResult<Option<UserEmailCode>> {
    let now = Utc::now();
    let record = sqlx::query_as!(
        UserEmailCode,
        r#"
SELECT id,
  user_id,
  code,
  purpose AS "purpose: UserEmailCodePurpose",
  attempt_count,
  expires_at,
  used_at,
  created_at,
  updated_at,
  deleted_at
FROM user_email_codes
WHERE user_id = $1
  AND purpose = $2
  AND deleted_at IS NULL
  AND used_at IS NULL
  AND expires_at > $3
        "#,
        user_id,
        purpose as UserEmailCodePurpose,
        now
    )
    .fetch_optional(conn)
    .await?;

    Ok(record)
}

pub async fn is_reset_user_email_code_valid(
    conn: &mut PgConnection,
    user_id: Uuid,
    purpose: UserEmailCodePurpose,
    code: &DbSecret,
) -> ModelResult<bool> {
    let now = Utc::now();
    let record = sqlx::query!(
        r#"
SELECT id
FROM user_email_codes
WHERE user_id = $1
  AND purpose = $2
  AND code = $3
  AND deleted_at IS NULL
  AND used_at IS NULL
  AND expires_at > $4
       "#,
        user_id,
        purpose as UserEmailCodePurpose,
        code.expose_secret(),
        now
    )
    .fetch_optional(conn)
    .await?;

    Ok(record.is_some())
}

pub async fn mark_user_email_code_used(
    conn: &mut PgConnection,
    user_id: Uuid,
    purpose: UserEmailCodePurpose,
    code: &DbSecret,
) -> ModelResult<bool> {
    let result = sqlx::query!(
        r#"
UPDATE user_email_codes
SET used_at = NOW(),
  deleted_at = NOW()
WHERE user_id = $1
  AND purpose = $2
  AND code = $3
  AND deleted_at IS NULL
        "#,
        user_id,
        purpose as UserEmailCodePurpose,
        code.expose_secret(),
    )
    .execute(conn)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Counts a wrong guess against the user's live code and retires it once `max_attempts` is reached.
///
/// Keyed on the user and purpose rather than on what was typed: there is only ever one live code, so
/// any refused guess is a guess against it.
pub async fn record_failed_attempt(
    conn: &mut PgConnection,
    user_id: Uuid,
    purpose: UserEmailCodePurpose,
    max_attempts: i32,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE user_email_codes
SET attempt_count = attempt_count + 1,
  deleted_at = CASE
    WHEN attempt_count + 1 >= $3 THEN NOW()
    ELSE deleted_at
  END
WHERE user_id = $1
  AND purpose = $2
  AND deleted_at IS NULL
  AND used_at IS NULL
        "#,
        user_id,
        purpose as UserEmailCodePurpose,
        max_attempts,
    )
    .execute(conn)
    .await?;

    Ok(())
}
