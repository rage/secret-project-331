use rand::distr::SampleString;
use rand::rng;
use sha2::{Digest as ShaDigest, Sha256};

use crate::library::oauth::Digest;

const ACCESS_TOKEN_LENGTH: usize = 64;

/// Generate a cryptographically strong opaque token suitable for access/refresh/auth codes.
pub fn generate_access_token() -> String {
    rand::distr::Alphanumeric.sample_string(&mut rng(), ACCESS_TOKEN_LENGTH)
}

/// Produce a `Digest` (SHA-256) from an access/refresh token plaintext.
pub fn token_digest_sha256(token_plaintext: &str) -> Digest {
    let mut hasher = Sha256::new();
    hasher.update(token_plaintext.as_bytes());
    let result = hasher.finalize();
    let mut arr = [0u8; Digest::LEN];
    arr.copy_from_slice(&result);
    Digest::new(arr)
}
