//! HMAC-SHA-256, for hashes only a holder of the key can compute.

use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;

/// For incremental MACs; [`hmac_sha256`] covers a single message.
pub type HmacSha256 = Hmac<Sha256>;

/// The MAC of `message` under `key`.
pub fn hmac_sha256(key: &[u8], message: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC takes a key of any size");
    mac.update(message);
    mac.finalize().into_bytes().to_vec()
}
