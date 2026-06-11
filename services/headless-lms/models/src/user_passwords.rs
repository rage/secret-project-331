use crate::prelude::*;
use crate::users::get_by_id;
use argon2::password_hash::{PasswordHasher, PasswordVerifier, phc::PasswordHash};
use argon2::{Algorithm, Argon2, Params, Version};
use headless_lms_utils::tmc::TmcClient;
use secrecy::{ExposeSecret, SecretString};
use std::sync::LazyLock;
use unicode_normalization::UnicodeNormalization;

/// Normalize a password to Unicode NFC before it is hashed or verified.
///
/// Argon2 hashes raw bytes, so the same password typed on different platforms/forms can hash
/// differently when it contains composed characters (e.g. `å`/`ä`/`ö`): NFC `ä` (U+00E4) and
/// NFD `ä` (U+0061 U+0308) are different byte sequences. Applying NFC at both hash and verify
/// guarantees storage and checking agree. The normalized form is kept in a `SecretString` so it
/// is zeroized on drop like every other password value here.
fn normalize_password(password: &SecretString) -> SecretString {
    SecretString::new(password.expose_secret().nfc().collect::<String>().into())
}

/// Verify a password against a stored Argon2 hash, tolerant of Unicode normalization.
///
/// When NFC normalization does not change the input (the common case, e.g. any pure-ASCII
/// password) this performs a single verify. Only when normalization actually changes the bytes do
/// we verify twice: against the NFC form (how new hashes are written) and, as a fallback, against
/// the raw submitted bytes (how hashes created before normalization existed were written).
fn verify_against_hash(password: &SecretString, parsed_hash: &PasswordHash) -> bool {
    let argon2 = Argon2::default();
    let raw = password.expose_secret();
    let normalized = normalize_password(password);

    // Normalization is a no-op for this password: there is only one form, so verify once.
    if normalized.expose_secret() == raw {
        return argon2.verify_password(raw.as_bytes(), parsed_hash).is_ok();
    }

    // Normalization changed the input, so the stored hash could be in either form.
    argon2
        .verify_password(normalized.expose_secret().as_bytes(), parsed_hash)
        .is_ok()
        || argon2.verify_password(raw.as_bytes(), parsed_hash).is_ok()
}

pub struct UserPassword {
    pub user_id: Uuid,
    pub password_hash: SecretString,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(sqlx::FromRow, Debug, Clone)]
pub struct PasswordResetToken {
    pub id: Uuid,
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
    password_hash: &SecretString,
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
    let argon2 = Argon2::new(
        Algorithm::Argon2id,
        Version::V0x13,
        Params::new(65536, 3, 4, None)?,
    );

    let normalized = normalize_password(password);
    let password_hash = argon2.hash_password(normalized.expose_secret().as_bytes())?;
    Ok(SecretString::new(password_hash.to_string().into()))
}

pub async fn verify_user_password(
    conn: &mut PgConnection,
    user_id: Uuid,
    password: &SecretString,
) -> ModelResult<bool> {
    let user_password = match sqlx::query!(
        r#"
SELECT *
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
                Argon2::default()
                    .hash_password(b"dummy-password")
                    .expect("failed to create dummy hash")
                    .to_string()
            });

            let parsed = PasswordHash::new(&DUMMY_HASH).map_err(|e| {
                ModelError::new(
                    ModelErrorType::Generic,
                    format!("Failed to parse DUMMY_HASH: {}", e),
                    Some(anyhow::anyhow!("Password hash error: {}", e)),
                )
            })?;
            let _ = Argon2::default().verify_password(b"dummy-password", &parsed);
            return Ok(false);
        }
    };

    let parsed_hash = match PasswordHash::new(&user_password.password_hash) {
        Ok(hash) => hash,
        Err(e) => {
            warn!("Stored password hash for user {user_id} is malformed: {e}");
            return Ok(false);
        }
    };

    Ok(verify_against_hash(password, &parsed_hash))
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
RETURNING *
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
SELECT *
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
    password_hash: &SecretString,
    tmc_client: &TmcClient,
) -> ModelResult<bool> {
    // Start a transaction and lock the token row
    let mut tx = conn.begin().await?;

    // Check if token is valid
    let record = sqlx::query!(
        r#"
SELECT *
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
    new_password_hash: &SecretString,
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

#[cfg(test)]
mod tests {
    use super::*;
    use argon2::password_hash::PasswordVerifier;

    fn secret(s: &str) -> SecretString {
        SecretString::new(s.to_string().into())
    }

    // The same visual password "pässword" in two Unicode forms:
    // NFC: "ä" = U+00E4 (one code point); NFD: "ä" = U+0061 U+0308 (a + combining diaeresis).
    const NFC_PASSWORD: &str = "p\u{00e4}ssword";
    const NFD_PASSWORD: &str = "pa\u{0308}ssword";

    #[test]
    fn nfc_and_nfd_inputs_normalize_to_identical_bytes() {
        // The raw inputs differ byte-for-byte...
        assert_ne!(NFC_PASSWORD.as_bytes(), NFD_PASSWORD.as_bytes());
        // ...but normalize to the same value, so they will hash identically.
        let a = normalize_password(&secret(NFC_PASSWORD));
        let b = normalize_password(&secret(NFD_PASSWORD));
        assert_eq!(a.expose_secret(), b.expose_secret());
    }

    #[test]
    fn hash_of_one_form_verifies_against_the_other_form() {
        // Hash the NFD form (as a Rails form might submit it)...
        let hash = hash_password(&secret(NFD_PASSWORD)).expect("hashing should succeed");
        let parsed = PasswordHash::new(hash.expose_secret()).expect("stored hash should parse");
        // ...and verify the NFC form (as a browser form might submit it), normalized the same way
        // verify_user_password does. Without normalization this would fail.
        let candidate = normalize_password(&secret(NFC_PASSWORD));
        assert!(
            Argon2::default()
                .verify_password(candidate.expose_secret().as_bytes(), &parsed)
                .is_ok()
        );
    }

    #[test]
    fn pre_normalization_hash_still_verifies() {
        // Simulate a hash stored BEFORE normalization existed: computed from the raw NFD bytes.
        let stored = Argon2::default()
            .hash_password(NFD_PASSWORD.as_bytes())
            .expect("hashing should succeed")
            .to_string();
        let parsed = PasswordHash::new(&stored).expect("stored hash should parse");

        // The user logs in with the same raw form they originally used. Even though verification
        // now normalizes to NFC first (which would miss this hash), the raw-bytes fallback must
        // still let them in. Without back-compat this would regress an existing user.
        assert!(verify_against_hash(&secret(NFD_PASSWORD), &parsed));
        // And a genuinely wrong password is still rejected.
        assert!(!verify_against_hash(&secret("different"), &parsed));
    }

    #[test]
    fn ascii_password_is_unchanged_by_normalization() {
        let normalized = normalize_password(&secret("plain-ascii-123"));
        assert_eq!(normalized.expose_secret(), "plain-ascii-123");
    }

    #[test]
    fn wrong_password_still_fails_after_normalization() {
        let hash = hash_password(&secret(NFC_PASSWORD)).expect("hashing should succeed");
        let parsed = PasswordHash::new(hash.expose_secret()).expect("stored hash should parse");
        let wrong = normalize_password(&secret("totally-different"));
        assert!(
            Argon2::default()
                .verify_password(wrong.expose_secret().as_bytes(), &parsed)
                .is_err()
        );
    }
}
