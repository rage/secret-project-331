//! Deployment settings of the account forms that come from the environment.

use std::env;

use ipnet::IpNet;
use tracing::error;

/// The raw value of the setting `name`, or "" when unset.
pub fn form_safety_env(name: &str) -> String {
    env::var(name).unwrap_or_default()
}

/// Networks exempt from the per-network limits of the account forms, from
/// `NETWORK_LIMIT_EXEMPT_NETWORKS`: CIDR blocks separated by commas or whitespace. Invalid entries
/// are logged and skipped.
pub fn network_limit_exempt_networks() -> Vec<IpNet> {
    form_safety_env("NETWORK_LIMIT_EXEMPT_NETWORKS")
        .split(|c: char| c == ',' || c.is_whitespace())
        .filter(|entry| !entry.is_empty())
        .filter_map(|entry| match entry.parse() {
            Ok(network) => Some(network),
            Err(_) => {
                error!("NETWORK_LIMIT_EXEMPT_NETWORKS has an invalid network: {entry}");
                None
            }
        })
        .collect()
}
