use crate::prelude::*;
use argon2::password_hash::{SaltString, rand_core::OsRng};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use secrecy::{ExposeSecret, SecretString};

pub struct UserPassword {
    pub user_id: Uuid,
    pub password_hash: SecretString,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub struct PasswordResetToken {
    pub token: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub async fn upsert_user_password(
    conn: &mut PgConnection,
    user_id: Uuid,
    password_hash: SecretString,
) -> ModelResult<bool> {
    let result = sqlx::query!(
        r#"
INSERT INTO user_passwords (user_id, password_hash)
VALUES ($1, $2) ON CONFLICT (user_id) DO
UPDATE
SET password_hash = EXCLUDED.password_hash
        "#,
        user_id,
        password_hash.expose_secret()
    )
    .execute(conn)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub fn hash_password(
    password: &SecretString,
) -> Result<SecretString, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let password_hash = argon2.hash_password(password.expose_secret().as_bytes(), &salt)?;
    Ok(SecretString::new(password_hash.to_string().into()))
}

pub async fn verify_user_password(
    conn: &mut PgConnection,
    user_id: Uuid,
    password: &SecretString,
) -> ModelResult<bool> {
    let user_password = match sqlx::query!(
        r#"
SELECT password_hash
FROM user_passwords
WHERE user_id = $1
  AND deleted_at IS NULL
        "#,
        user_id
    )
    .fetch_optional(conn)
    .await?
    {
        Some(p) => p,
        None => return Ok(false),
    };

    let parsed_hash = match PasswordHash::new(&user_password.password_hash) {
        Ok(hash) => hash,
        Err(_) => return Ok(false),
    };

    let is_valid = Argon2::default()
        .verify_password(password.expose_secret().as_bytes(), &parsed_hash)
        .is_ok();

    Ok(is_valid)
}

pub async fn check_if_users_password_is_stored(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<bool> {
    let result = sqlx::query!(
        r#"
SELECT *
FROM user_passwords
WHERE user_id = $1
  AND deleted_at IS NULL
        "#,
        user_id
    )
    .fetch_optional(conn)
    .await?;

    Ok(result.is_some())
}

pub async fn insert_password_reset_token(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Uuid> {
    let token = Uuid::new_v4();

    sqlx::query!(
        r#"
INSERT INTO password_reset_tokens (
    token,
    user_id
  )
VALUES ($1, $2)
        "#,
        token,
        user_id
    )
    .execute(conn)
    .await?;

    Ok(token)
}

pub async fn get_unused_reset_password_token_with_user_id(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Option<PasswordResetToken>> {
    let now = Utc::now();
    let record = sqlx::query_as!(
        PasswordResetToken,
        r#"
SELECT token,
  user_id,
  created_at,
  updated_at,
  used_at,
  deleted_at,
  expires_at
FROM password_reset_tokens
WHERE user_id = $1
  AND deleted_at IS NULL
  AND used_at IS NULL
  AND expires_at > $2
        "#,
        user_id,
        now
    )
    .fetch_optional(conn)
    .await?;

    Ok(record)
}

pub async fn is_reset_password_token_valid(
    conn: &mut PgConnection,
    token: &Uuid,
) -> ModelResult<bool> {
    let now = Utc::now();
    let record = sqlx::query!(
        r#"
SELECT *
FROM password_reset_tokens
WHERE token = $1
  AND deleted_at IS NULL
  AND used_at IS NULL
  AND expires_at > $2
       "#,
        token,
        now
    )
    .fetch_optional(conn)
    .await?;

    Ok(record.is_some())
}

pub async fn change_user_password(
    conn: &mut PgConnection,
    token: Uuid,
    password_hash: SecretString,
) -> ModelResult<bool> {
    let record = sqlx::query!(
        r#"
        SELECT user_id
        FROM password_reset_tokens
        WHERE token = $1
          AND deleted_at IS NULL
          AND used_at IS NULL
          AND expires_at > NOW()
        "#,
        token
    )
    .fetch_optional(&mut *conn)
    .await?;

    let user_id = match record {
        Some(r) => r.user_id,
        None => return Ok(false),
    };

    upsert_user_password(conn, user_id, password_hash).await?;

    mark_token_used(conn, token).await?;

    Ok(true)
}

pub async fn mark_token_used(conn: &mut PgConnection, token: Uuid) -> ModelResult<bool> {
    let result = sqlx::query!(
        r#"
UPDATE password_reset_tokens
SET used_at = NOW(),
  deleted_at = NOW()
WHERE token = $1
  AND deleted_at IS NULL
        "#,
        token
    )
    .execute(conn)
    .await?;

    Ok(result.rows_affected() > 0)
}
