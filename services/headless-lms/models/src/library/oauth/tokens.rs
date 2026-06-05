use hmac::{Hmac, KeyInit, Mac};
use rand::distr::SampleString;
use rand::rng;
use secrecy::{ExposeSecret, SecretString};
use sha2::Sha256;

use crate::library::oauth::Digest;

const ACCESS_TOKEN_LENGTH: usize = 64;

/// Generate a cryptographically strong opaque token suitable for access/refresh/auth codes.
pub fn generate_access_token() -> String {
    rand::distr::Alphanumeric.sample_string(&mut rng(), ACCESS_TOKEN_LENGTH)
}

/// Produce a `Digest` (HMAC-SHA-256) from an access/refresh token plaintext using a secret key.
///
/// This function uses HMAC-SHA-256 instead of plain SHA-256 to provide better security
/// by requiring knowledge of the secret key to compute valid digests.
///
/// # Arguments
/// * `token_plaintext` - The token string to hash
/// * `key` - The secret key (pepper) to use for HMAC
pub fn token_digest_sha256(token_plaintext: &str, key: &SecretString) -> Digest {
    // The HMAC key is exposed only here, where it is fed into the MAC.
    let mut mac = Hmac::<Sha256>::new_from_slice(key.expose_secret().as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(token_plaintext.as_bytes());
    let result = mac.finalize();
    let code_bytes = result.into_bytes();
    let mut arr = [0u8; Digest::LEN];
    arr.copy_from_slice(&code_bytes);
    Digest::new(arr)
}
