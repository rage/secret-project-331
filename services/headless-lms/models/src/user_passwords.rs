use crate::prelude::*;
use crate::users::get_by_id;
use argon2::password_hash::{SaltString, rand_core::OsRng};
use argon2::{Algorithm, Argon2, Params, PasswordHash, PasswordHasher, PasswordVerifier, Version};
use headless_lms_utils::tmc::TmcClient;
use secrecy::{ExposeSecret, SecretString};
use std::sync::LazyLock;
pub struct UserPassword {
    pub user_id: Uuid,
    pub password_hash: SecretString,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(sqlx::FromRow, Debug, Clone)]
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
SET password_hash = EXCLUDED.password_hash,
    deleted_at = NULL
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
    let argon2 = Argon2::new(
        Algorithm::Argon2id,
        Version::V0x13,
        Params::new(65536, 3, 4, None)?,
    );

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
        None => {
            // Perform a dummy verify to normalize timing when user has no password row.
            // This mitigates timing attack vulnerabilities.

            static DUMMY_HASH: LazyLock<String> = LazyLock::new(|| {
                let salt = SaltString::generate(&mut OsRng);
                Argon2::default()
                    .hash_password(b"dummy-password", &salt)
                    .expect("failed to create dummy hash")
                    .to_string()
            });

            let parsed = PasswordHash::new(&DUMMY_HASH).unwrap();
            let _ = Argon2::default().verify_password(b"dummy-password", &parsed);
            return Ok(false);
        }
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
    token: Uuid,
) -> ModelResult<Uuid> {
    let mut tx = conn.begin().await?;

    // Soft delete possible previous tokens so that only one token is at use at a time
    let _ = sqlx::query!(
        r#"
   UPDATE password_reset_tokens
SET deleted_at = NOW()
WHERE user_id = $1
  AND deleted_at IS NULL
    "#,
        user_id
    )
    .execute(&mut *tx)
    .await?;

    // Attempt to insert new token; the unique index ensures no more than one active token per user
    let record = sqlx::query!(
        r#"
      INSERT INTO password_reset_tokens (token, user_id)
VALUES ($1, $2)
RETURNING token
        "#,
        token,
        user_id
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(record.token)
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

pub async fn change_user_password_with_password_reset_token(
    conn: &mut PgConnection,
    token: Uuid,
    password_hash: SecretString,
    tmc_client: &TmcClient,
) -> ModelResult<bool> {
    // Start a transaction and lock the token row
    let mut tx = conn.begin().await?;

    // Check if token is valid
    let record = sqlx::query!(
        r#"
SELECT user_id
FROM password_reset_tokens
WHERE token = $1
  AND deleted_at IS NULL
  AND used_at IS NULL
  AND expires_at > NOW()
FOR UPDATE
        "#,
        token
    )
    .fetch_optional(&mut *tx)
    .await?;

    let user_id = match record {
        Some(r) => r.user_id,
        None => return Ok(false),
    };

    // Check if the user has an existing password
    let had_existing_password = sqlx::query!(
        r#"
SELECT *
FROM user_passwords
WHERE user_id = $1
AND deleted_at IS NULL
        "#,
        user_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .is_some();

    // Upsert the new password
    upsert_user_password(&mut tx, user_id, password_hash).await?;

    // Mark the token as used
    mark_token_used(&mut tx, token).await?;

    // Fetch user
    let user = get_by_id(&mut tx, user_id).await?;

    tx.commit().await?;

    // If user didn't have a password stored previously, notify tmc that password is now managed by courses.mooc
    if !had_existing_password {
        if let Some(upstream_id) = user.upstream_id {
            if let Err(e) = tmc_client
                .set_user_password_managed_by_courses_mooc_fi(upstream_id.to_string(), user_id)
                .await
            {
                warn!(
                    "Failed to notify TMC about password ownership change: {:?}",
                    e
                );
            }
        } else {
            warn!("User has no upstream_id; skipping TMC notification");
        }
    }

    Ok(true)
}

pub async fn change_user_password_with_old_password(
    conn: &mut PgConnection,
    user_id: Uuid,
    old_password: &SecretString,
    new_password_hash: SecretString,
) -> ModelResult<bool> {
    let mut tx = conn.begin().await?;

    // Verify old password
    let is_valid = verify_user_password(&mut tx, user_id, old_password).await?;
    if !is_valid {
        return Ok(false);
    }

    // Upsert the new password
    upsert_user_password(&mut tx, user_id, new_password_hash).await?;

    tx.commit().await?;

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
  AND used_at IS NULL
        "#,
        token
    )
    .execute(conn)
    .await?;

    Ok(result.rows_affected() > 0)
}
