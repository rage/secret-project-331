//! The requester's network as the shared limits count it, and keyed digests that keep what they
//! count unreadable.

use std::net::IpAddr;

use headless_lms_base::hmac_sha256::hmac_sha256;
use secrecy::ExposeSecret;

use crate::config::server_runtime_config;

/// The /24 of an IPv4 address or the /48 of an IPv6 address, in CIDR notation.
pub fn prefix(ip: IpAddr) -> String {
    match ip {
        IpAddr::V4(ip) => {
            let [a, b, c, _] = ip.octets();
            format!("{a}.{b}.{c}.0/24")
        }
        IpAddr::V6(ip) => {
            let s = ip.segments();
            format!("{:x}:{:x}:{:x}::/48", s[0], s[1], s[2])
        }
    }
}

/// The address itself for IPv4, its /64 for IPv6: what one subscriber typically has.
pub fn fine_prefix(ip: IpAddr) -> String {
    match ip {
        IpAddr::V4(ip) => ip.to_string(),
        IpAddr::V6(ip) => {
            let s = ip.segments();
            format!("{:x}:{:x}:{:x}:{:x}::/64", s[0], s[1], s[2], s[3])
        }
    }
}

/// An HMAC under the deployment's form context secret, so a stored key cannot be computed from a
/// guessed address without the secret.
pub fn keyed_digest(label: &str, value: &str) -> Vec<u8> {
    let key = server_runtime_config().form_context_secret.expose_secret();
    hmac_sha256(key.as_bytes(), format!("{label}:{value}").as_bytes())
}
