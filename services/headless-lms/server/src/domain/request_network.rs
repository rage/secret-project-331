//! The requester's network as the shared limits count it, and keyed digests that keep what they
//! count unreadable.

use std::net::IpAddr;

use headless_lms_base::hmac_sha256::hmac_sha256;
use ipnet::IpNet;
use secrecy::ExposeSecret;

use crate::config::server_runtime_config;

/// The /24 of an IPv4 address or the /48 of an IPv6 address, in CIDR notation.
pub fn prefix(ip: IpAddr) -> String {
    network(ip, 24, 48)
}

/// The address itself for IPv4, its /64 for IPv6: what one subscriber typically has.
pub fn fine_prefix(ip: IpAddr) -> String {
    network(ip, 32, 64)
}

fn network(ip: IpAddr, v4_length: u8, v6_length: u8) -> String {
    let length = if ip.is_ipv4() { v4_length } else { v6_length };
    IpNet::new_assert(ip, length).trunc().to_string()
}

/// An HMAC under the deployment's form context secret, so a stored key cannot be computed from a
/// guessed address without the secret.
pub fn keyed_digest(label: &str, value: &str) -> Vec<u8> {
    let key = server_runtime_config().form_context_secret.expose_secret();
    hmac_sha256(key.as_bytes(), format!("{label}:{value}").as_bytes())
}
