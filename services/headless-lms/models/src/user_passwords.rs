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

/// Passwords whose hash was stored under the pre-normalization (raw byte) form are accepted until
/// this instant; afterwards only the NFC form is checked and any not-yet-converted user must reset
/// their password. Set to one year after the normalization rollout — ADJUST to one year after the
/// actual deploy date.
static LEGACY_RAW_PASSWORD_FALLBACK_UNTIL: LazyLock<DateTime<Utc>> = LazyLock::new(|| {
    DateTime::parse_from_rfc3339("2027-06-12T00:00:00Z")
        .expect("hardcoded fallback deadline must be valid RFC3339")
        .with_timezone(&Utc)
});

/// Whether the legacy raw-byte password form is still accepted at `now`.
fn legacy_raw_fallback_active(now: DateTime<Utc>) -> bool {
    now < *LEGACY_RAW_PASSWORD_FALLBACK_UNTIL
}

/// Outcome of verifying a password against a stored Argon2 hash.
enum PasswordVerifyResult {
    /// No form of the password matched the stored hash.
    NoMatch,
    /// Matched the canonical NFC-normalized form (how hashes are written today).
    MatchedNormalized,
    /// Matched only the raw, pre-normalization byte form. The hash should be re-stored under NFC;
    /// this form is accepted only while [`legacy_raw_fallback_active`] holds.
    MatchedLegacyRaw,
}

/// Verify a password against a stored Argon2 hash, tolerant of Unicode normalization.
///
/// When NFC normalization does not change the input (the common case, e.g. any pure-ASCII
/// password) this performs a single verify. Otherwise it checks the NFC form first (how hashes are
/// written today) and, only if `try_legacy_raw` is set, falls back to the raw submitted bytes (how
/// hashes created before normalization were written). When `try_legacy_raw` is false the raw form
/// is not checked at all.
fn verify_against_hash(
    password: &SecretString,
    parsed_hash: &PasswordHash,
    try_legacy_raw: bool,
) -> PasswordVerifyResult {
    let argon2 = Argon2::default();
    let raw = password.expose_secret();
    let normalized = normalize_password(password);

    // Normalization is a no-op for this password: there is only one form, so verify once.
    if normalized.expose_secret() == raw {
        return if argon2.verify_password(raw.as_bytes(), parsed_hash).is_ok() {
            PasswordVerifyResult::MatchedNormalized
        } else {
            PasswordVerifyResult::NoMatch
        };
    }

    // Canonical (NFC) form first.
    if argon2
        .verify_password(normalized.expose_secret().as_bytes(), parsed_hash)
        .is_ok()
    {
        return PasswordVerifyResult::MatchedNormalized;
    }

    // Legacy fallback: only attempted while still within the migration window.
    if try_legacy_raw && argon2.verify_password(raw.as_bytes(), parsed_hash).is_ok() {
        return PasswordVerifyResult::MatchedLegacyRaw;
    }

    PasswordVerifyResult::NoMatch
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

/// Re-stores `new_hash` for the user only if the currently stored hash still equals
/// `expected_current_hash` (a compare-and-swap). Returns `true` if the row was updated and `false`
/// if the stored hash had already changed (e.g. a concurrent password change) or no active row
/// matched, in which case nothing is written. Used by the legacy-rehash path so that a concurrent
/// password change is never clobbered by re-storing a hash derived from the old password.
async fn update_password_hash_if_unchanged(
    conn: &mut PgConnection,
    user_id: Uuid,
    new_hash: &SecretString,
    expected_current_hash: &str,
) -> ModelResult<bool> {
    let result = sqlx::query!(
        r#"
UPDATE user_passwords
SET password_hash = $2
WHERE user_id = $1
  AND password_hash = $3
  AND deleted_at IS NULL
        "#,
        user_id,
        new_hash.expose_secret(),
        expected_current_hash,
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
    .fetch_optional(&mut *conn)
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

    let try_legacy = legacy_raw_fallback_active(Utc::now());
    match verify_against_hash(password, &parsed_hash, try_legacy) {
        PasswordVerifyResult::MatchedNormalized => Ok(true),
        PasswordVerifyResult::NoMatch => Ok(false),
        PasswordVerifyResult::MatchedLegacyRaw => {
            // The stored hash is in the old raw-byte form. Re-store it under NFC so the row
            // converges to the canonical form and survives the fallback deadline. Best-effort: a
            // failure here is logged but must not fail an otherwise-valid login. The re-store is a
            // compare-and-swap against the hash we just read, so a password change committed
            // concurrently (between the read above and this write) is never overwritten by this
            // rehash of the old password.
            match hash_password(password) {
                Ok(new_hash) => match update_password_hash_if_unchanged(
                    conn,
                    user_id,
                    &new_hash,
                    &user_password.password_hash,
                )
                .await
                {
                    Ok(true) => {}
                    Ok(false) => {
                        info!(
                            "Skipped legacy password rehash for user {user_id}: stored hash changed concurrently"
                        );
                    }
                    Err(e) => {
                        warn!("Failed to re-store NFC-normalized password for user {user_id}: {e}");
                    }
                },
                Err(e) => {
                    warn!("Failed to hash NFC-normalized password for user {user_id}: {e}");
                }
            }
            Ok(true)
        }
    }
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
    fn legacy_raw_hash_matches_only_when_fallback_enabled() {
        // Simulate a hash stored BEFORE normalization existed: computed from the raw NFD bytes.
        let stored = Argon2::default()
            .hash_password(NFD_PASSWORD.as_bytes())
            .expect("hashing should succeed")
            .to_string();
        let parsed = PasswordHash::new(&stored).expect("stored hash should parse");

        // While the migration window is open, the raw form is recognized as a legacy match
        // (the caller will then re-store it under NFC).
        assert!(matches!(
            verify_against_hash(&secret(NFD_PASSWORD), &parsed, true),
            PasswordVerifyResult::MatchedLegacyRaw
        ));
        // After the deadline the raw form is not checked at all, so the same hash no longer matches.
        assert!(matches!(
            verify_against_hash(&secret(NFD_PASSWORD), &parsed, false),
            PasswordVerifyResult::NoMatch
        ));
    }

    #[test]
    fn normalized_hash_matches_regardless_of_fallback() {
        // A hash written today is NFC-normalized.
        let stored = hash_password(&secret(NFD_PASSWORD)).expect("hashing should succeed");
        let parsed = PasswordHash::new(stored.expose_secret()).expect("stored hash should parse");

        for try_legacy in [true, false] {
            // The NFC form matches whether or not the legacy fallback is enabled...
            assert!(matches!(
                verify_against_hash(&secret(NFC_PASSWORD), &parsed, try_legacy),
                PasswordVerifyResult::MatchedNormalized
            ));
            // ...and a wrong password never matches.
            assert!(matches!(
                verify_against_hash(&secret("different"), &parsed, try_legacy),
                PasswordVerifyResult::NoMatch
            ));
        }
    }

    #[test]
    fn legacy_fallback_is_time_gated() {
        let deadline = *LEGACY_RAW_PASSWORD_FALLBACK_UNTIL;
        assert!(legacy_raw_fallback_active(
            deadline - chrono::Duration::days(1)
        ));
        assert!(!legacy_raw_fallback_active(
            deadline + chrono::Duration::days(1)
        ));
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
