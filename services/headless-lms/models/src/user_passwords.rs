use crate::prelude::*;
use argon2::password_hash::{SaltString, rand_core::OsRng};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use secrecy::{ExposeSecret, SecretString};

#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct UserPassword {
    pub user_id: Uuid,
    pub password_hash: SecretString,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub async fn upsert_user_password(
    conn: &mut PgConnection,
    user_id: Uuid,
    password_hash: SecretString,
) -> ModelResult<bool> {
    let result = sqlx::query!(
        r#"
        INSERT INTO user_passwords (user_id, password_hash, created_at, updated_at)
VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (user_id) DO
UPDATE
SET password_hash = EXCLUDED.password_hash,
  updated_at = NOW()
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
        WHERE user_id = $1 AND deleted_at IS NULL
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
