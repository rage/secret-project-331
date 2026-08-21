use hmac::{Hmac, KeyInit, Mac};
use rand::RngExt;
use rand::distr::SampleString;
use rand::rng;
use secrecy::{ExposeSecret, SecretString};
use sha2::Sha256;

use crate::library::oauth::Digest;

const ACCESS_TOKEN_LENGTH: usize = 64;

/// Crockford base32 alphabet (excludes I, L, O, U to avoid ambiguity with 1/0).
const USER_CODE_ALPHABET: &[u8] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/// Number of characters in each dash-separated group of a user code.
const USER_CODE_GROUP_LEN: usize = 4;

/// Generate a cryptographically strong opaque token suitable for access/refresh/auth codes.
pub fn generate_access_token() -> String {
    rand::distr::Alphanumeric.sample_string(&mut rng(), ACCESS_TOKEN_LENGTH)
}

/// Generate a human-typable `user_code` for the OAuth 2.0 Device Authorization
/// Grant (RFC 8628).
///
/// The code is 8 characters of Crockford base32 (no I, L, O, U), formatted as
/// two dash-separated groups: `XXXX-XXXX`. Characters are drawn from a
/// cryptographically secure RNG. The alphabet has 32 symbols, so index
/// selection over `0..32` is bias-free.
pub fn generate_user_code() -> String {
    let mut rng = rng();
    let mut code = String::with_capacity(USER_CODE_GROUP_LEN * 2 + 1);
    for i in 0..(USER_CODE_GROUP_LEN * 2) {
        if i == USER_CODE_GROUP_LEN {
            code.push('-');
        }
        let idx = rng.random_range(0..USER_CODE_ALPHABET.len());
        code.push(USER_CODE_ALPHABET[idx] as char);
    }
    code
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
