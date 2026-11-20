//! Limits counted in the database, so they hold across server instances, unlike the in-memory
//! [rate limits](crate::domain::rate_limit_middleware_builder).

use std::net::IpAddr;
use std::sync::LazyLock;
use std::time::Duration as StdDuration;

use headless_lms_models::shared_rate_counts;
use ipnet::IpNet;

use crate::config::form_safety_config::{form_safety_env, network_limit_exempt_networks};
use crate::config::server_runtime_config;
use crate::domain::request_network::{fine_prefix, keyed_digest};
use crate::prelude::*;

/// Window lengths in seconds with the most events each allows.
pub type Windows = [(i64, i64)];

/// Per-network limits of the anonymous account forms, from `<NAME>_NETWORK_LIMITS`, with defaults
/// for deployments that set none.
pub static SIGNUP_NETWORK_LIMITS: LazyLock<Vec<(i64, i64)>> = LazyLock::new(|| {
    windows_from_env(
        "SIGNUP_NETWORK_LIMITS",
        &[(60, 6), (3600, 40), (86_400, 120)],
    )
});
pub static PASSWORD_RESET_NETWORK_LIMITS: LazyLock<Vec<(i64, i64)>> = LazyLock::new(|| {
    windows_from_env(
        "PASSWORD_RESET_NETWORK_LIMITS",
        &[(60, 4), (3600, 20), (86_400, 60)],
    )
});
pub static CHALLENGE_NETWORK_LIMITS: LazyLock<Vec<(i64, i64)>> = LazyLock::new(|| {
    windows_from_env(
        "CHALLENGE_NETWORK_LIMITS",
        &[(60, 30), (3600, 200), (86_400, 1000)],
    )
});

static EXEMPT_NETWORKS: LazyLock<Vec<IpNet>> = LazyLock::new(network_limit_exempt_networks);

/// Counts a request from `ip` for `name` and returns the length of the longest window it is over,
/// if any. Requests without a known address, from an exempt network or in test mode are never
/// over: many people can share one address, and the system tests send many requests from one.
async fn count_over_window(
    conn: &mut PgConnection,
    name: &str,
    ip: Option<IpAddr>,
    windows: &Windows,
) -> ModelResult<Option<i64>> {
    let Some(ip) = ip.filter(|ip| {
        !server_runtime_config().test_mode
            && !EXEMPT_NETWORKS.iter().any(|network| network.contains(ip))
    }) else {
        return Ok(None);
    };
    let key = keyed_digest(&format!("limit:{name}"), &fine_prefix(ip));
    let counts = shared_rate_counts::increment(conn, &key, &lengths(windows)).await?;
    Ok(windows
        .iter()
        .zip(counts)
        .filter(|((_, max), count)| count > max)
        .map(|((length, _), _)| *length)
        .max())
}

/// Counts a request from `ip` for `name`, refusing it with `TooManyRequests` once it is over any of
/// `windows`.
pub async fn check_and_count(
    conn: &mut PgConnection,
    name: &str,
    ip: Option<IpAddr>,
    windows: &Windows,
) -> Result<(), ControllerError> {
    match count_over_window(conn, name, ip, windows).await? {
        Some(length) => Err(too_many_requests(length)),
        None => Ok(()),
    }
}

/// `TooManyRequests` with a `Retry-After` of the time left in the current window of `length`
/// seconds.
pub fn too_many_requests(length: i64) -> ControllerError {
    // Windows are fixed and aligned to the epoch, so the current one ends at the next multiple.
    let remaining = length - Utc::now().timestamp().rem_euclid(length);
    controller_err!(
        TooManyRequests(Some(StdDuration::from_secs(
            u64::try_from(remaining).unwrap_or(60),
        ))),
        "Too many requests. Please try again later.".to_string()
    )
}

/// The length of the longest window of `windows` that `key` already reached, without counting.
pub async fn full_window(
    conn: &mut PgConnection,
    key: &[u8],
    windows: &Windows,
) -> ModelResult<Option<i64>> {
    let counts = shared_rate_counts::current(conn, key, &lengths(windows)).await?;
    Ok(windows
        .iter()
        .zip(counts)
        .filter(|((_, max), count)| count >= max)
        .map(|((length, _), _)| *length)
        .max())
}

/// Counts one event for `key` in each of `windows`.
pub async fn count(conn: &mut PgConnection, key: &[u8], windows: &Windows) -> ModelResult<()> {
    shared_rate_counts::increment(conn, key, &lengths(windows)).await?;
    Ok(())
}

fn lengths(windows: &Windows) -> Vec<i64> {
    windows.iter().map(|(length, _)| *length).collect()
}

/// Windows from an environment variable of comma-separated `seconds:maximum` pairs, or `default`
/// when it is unset or has no valid window.
pub fn windows_from_env(name: &str, default: &Windows) -> Vec<(i64, i64)> {
    let windows: Vec<(i64, i64)> = form_safety_env(name)
        .split(',')
        .filter_map(|window| {
            let (length, max) = window.trim().split_once(':')?;
            Some((length.trim().parse().ok()?, max.trim().parse().ok()?))
        })
        .filter(|(length, max): &(i64, i64)| {
            (1..=i64::from(i32::MAX)).contains(length) && *max >= 0
        })
        .collect();
    if windows.is_empty() {
        default.to_vec()
    } else {
        windows
    }
}
