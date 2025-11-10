//! pkce.rs — Strong types for PKCE (RFC 7636)
//!
//! - `CodeVerifier`: validated at construction (43–128 chars, unreserved charset)
//! - `CodeChallenge`: wrapper for stored challenge
//! - `PkceMethod`: "plain" | "S256", with serde + sqlx mapping
//! - Constant-time verification
//!
//! Usage (token endpoint):
//! ```ignore
//! let verifier = CodeVerifier::new(code_verifier_str)?;
//! let challenge = CodeChallenge::from_stored(stored_challenge_str);
//! if !challenge.verify(&verifier, method) {
//!     return Err(oauth_err_invalid_grant("PKCE verification failed"));
//! }
//! ```

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::Type;

/// RFC 7636: code_verifier length MUST be between 43 and 128 characters.
pub const VERIFIER_MIN_LEN: usize = 43;
pub const VERIFIER_MAX_LEN: usize = 128;

/// PKCE method (RFC 7636 §4.3). Mirrors Postgres enum: `pkce_method = ('plain','S256')`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "pkce_method")]
pub enum PkceMethod {
    #[serde(rename = "plain")]
    Plain,
    #[serde(rename = "S256")]
    S256,
}

impl PkceMethod {
    #[inline]
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "plain" => Some(Self::Plain),
            "S256" => Some(Self::S256),
            _ => None,
        }
    }
}

/// Errors constructing/validating PKCE values.
#[derive(Debug, thiserror::Error)]
pub enum PkceError {
    #[error("code_verifier length out of bounds")]
    BadLength,
    #[error("code_verifier contains invalid characters")]
    BadCharset,
    #[error("Disallowed PKCE method")]
    BadMethod,
}

/// Validated PKCE code_verifier (RFC 7636).
#[derive(Debug, Clone)]
pub struct CodeVerifier(String);

impl CodeVerifier {
    /// Construct after validating length and allowed charset.
    pub fn new(s: &str) -> Result<Self, PkceError> {
        validate_verifier(s)?;
        Ok(Self(s.to_owned()))
    }

    /// Construct without allocation if you already own a String; still validates.
    pub fn try_from_string(s: String) -> Result<Self, PkceError> {
        validate_verifier(&s)?;
        Ok(Self(s))
    }

    /// Borrow the inner str.
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Compute the PKCE `code_challenge` for this verifier using `method`.
    pub fn to_challenge(&self, method: PkceMethod) -> CodeChallenge {
        match method {
            PkceMethod::Plain => CodeChallenge(self.0.clone()),
            PkceMethod::S256 => {
                let digest = Sha256::digest(self.0.as_bytes());
                CodeChallenge(URL_SAFE_NO_PAD.encode(digest))
            }
        }
    }
}

/// Stored PKCE code_challenge.
#[derive(Debug, Clone)]
pub struct CodeChallenge(String);

impl CodeChallenge {
    /// Wrap a stored challenge (e.g., from DB). No extra validation needed at this layer.
    pub fn from_stored<S: Into<String>>(s: S) -> Self {
        Self(s.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Verify that `verifier` corresponds to this challenge under `method`.
    pub fn verify(&self, verifier: &CodeVerifier, method: PkceMethod) -> bool {
        let computed = verifier.to_challenge(method);
        constant_time_eq(self.as_str(), computed.as_str())
    }
}

/// Strict RFC 7636 validator: length 43–128 and only unreserved characters.
///
/// Unreserved: ALPHA / DIGIT / "-" / "." / "_" / "~"
fn validate_verifier(v: &str) -> Result<(), PkceError> {
    let len = v.len();
    if !(VERIFIER_MIN_LEN..=VERIFIER_MAX_LEN).contains(&len) {
        return Err(PkceError::BadLength);
    }
    if !v.bytes().all(|b| {
        matches!(
            b,
            b'A'..=b'Z' |
            b'a'..=b'z' |
            b'0'..=b'9' |
            b'-' | b'.' | b'_' | b'~'
        )
    }) {
        return Err(PkceError::BadCharset);
    }
    Ok(())
}

/// Constant-time equality on ASCII strings (safe for our base64url/plain outputs).
fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.bytes().zip(b.bytes()) {
        diff |= x ^ y;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_short_verifier() {
        let s = "a".repeat(VERIFIER_MIN_LEN - 1);
        assert!(matches!(CodeVerifier::new(&s), Err(PkceError::BadLength)));
    }

    #[test]
    fn rejects_long_verifier() {
        let s = "a".repeat(VERIFIER_MAX_LEN + 1);
        assert!(matches!(CodeVerifier::new(&s), Err(PkceError::BadLength)));
    }

    #[test]
    fn rejects_bad_charset() {
        let s = "valid_but space"; // contains space
        assert!(matches!(CodeVerifier::new(s), Err(PkceError::BadCharset)));
    }

    #[test]
    fn accepts_valid_charset_and_len() {
        let s = "A.-_~0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_____";
        assert!(CodeVerifier::new(s).is_ok());
    }

    #[test]
    fn s256_round_trip() {
        let v =
            CodeVerifier::new("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-._~")
                .unwrap();
        let ch = v.to_challenge(PkceMethod::S256);
        assert!(ch.verify(&v, PkceMethod::S256));
        // Should fail with wrong method
        assert!(!ch.verify(&v, PkceMethod::Plain));
    }

    #[test]
    fn plain_round_trip() {
        let v =
            CodeVerifier::new("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-._~")
                .unwrap();
        let ch = v.to_challenge(PkceMethod::Plain);
        assert!(ch.verify(&v, PkceMethod::Plain));
        assert!(!ch.verify(&v, PkceMethod::S256));
    }
}
