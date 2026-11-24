//! Limits counted in the database, so they hold across server instances, unlike the in-memory
//! [rate limits](crate::domain::rate_limit_middleware_builder).

use std::net::IpAddr;
use std::sync::LazyLock;
use std::time::Duration as StdDuration;

use chrono::Duration;
use headless_lms_models::{account_form_decisions, shared_rate_counts};
use ipnet::IpNet;
use sqlx::PgPool;

use crate::config::form_safety_config::{form_safety_env, network_limit_exempt_networks};
use crate::config::server_runtime_config;
use crate::domain::account_form_checks;
use crate::domain::request_network::{fine_prefix, keyed_digest};
use crate::prelude::*;

/// Window lengths in seconds with the most events each allows.
pub type Windows = [(i64, i64)];

/// Per-network limits of the signup form, from `SIGNUP_NETWORK_LIMITS`, with defaults for
/// deployments that set none.
pub static SIGNUP_NETWORK_LIMITS: LazyLock<Vec<(i64, i64)>> = LazyLock::new(|| {
    windows_from_env(
        "SIGNUP_NETWORK_LIMITS",
        &[(60, 6), (3600, 40), (86_400, 120)],
    )
});
/// Per-network limits of the password reset form, from `PASSWORD_RESET_NETWORK_LIMITS`.
pub static PASSWORD_RESET_NETWORK_LIMITS: LazyLock<Vec<(i64, i64)>> = LazyLock::new(|| {
    windows_from_env(
        "PASSWORD_RESET_NETWORK_LIMITS",
        &[(60, 4), (3600, 20), (86_400, 60)],
    )
});
/// Per-network limits of fetching proof-of-work challenges, from `CHALLENGE_NETWORK_LIMITS`.
pub static CHALLENGE_NETWORK_LIMITS: LazyLock<Vec<(i64, i64)>> = LazyLock::new(|| {
    windows_from_env(
        "CHALLENGE_NETWORK_LIMITS",
        &[(60, 30), (3600, 200), (86_400, 1000)],
    )
});

static EXEMPT_NETWORKS: LazyLock<Vec<IpNet>> = LazyLock::new(network_limit_exempt_networks);

const CLEANUP_PROBABILITY: f64 = 0.01;

/// Counts a request from `ip` for `name` and returns when the last window it is over ends, if any.
/// Requests without a known address, from an exempt network or in test mode are never over: many
/// people can share one address, and the system tests send many requests from one.
async fn count_over_window(
    conn: &mut PgConnection,
    pool: &PgPool,
    name: &str,
    ip: Option<IpAddr>,
    windows: &Windows,
) -> ModelResult<Option<DateTime<Utc>>> {
    let Some(ip) = ip.filter(|ip| {
        !server_runtime_config().test_mode
            && !EXEMPT_NETWORKS.iter().any(|network| network.contains(ip))
    }) else {
        return Ok(None);
    };
    let key = keyed_digest(&format!("limit:{name}"), &fine_prefix(ip));
    let counts = increment(conn, pool, &key, &lengths(windows)).await?;
    Ok(windows
        .iter()
        .zip(counts)
        .filter(|((_, max), window)| window.count > *max)
        .map(|(_, window)| window.ends_at)
        .max())
}

/// Counts a request from `ip` for `name`, refusing it with `TooManyRequests` once it is over any of
/// `windows`. See [`increment`] for `pool`.
pub async fn check_and_count(
    conn: &mut PgConnection,
    pool: &PgPool,
    name: &str,
    ip: Option<IpAddr>,
    windows: &Windows,
) -> Result<(), ControllerError> {
    match count_over_window(conn, pool, name, ip, windows).await? {
        Some(ends_at) => Err(too_many_requests(ends_at)),
        None => Ok(()),
    }
}

/// `TooManyRequests` with a `Retry-After` until `retry_at`, at least one second.
pub fn too_many_requests(retry_at: DateTime<Utc>) -> ControllerError {
    let remaining = (retry_at - Utc::now()).num_seconds().max(1);
    controller_err!(
        TooManyRequests(Some(StdDuration::from_secs(remaining.unsigned_abs()))),
        "Too many requests. Please try again later.".to_string()
    )
}

/// When the last window of `windows` that `key` already reached ends, without counting.
pub async fn full_window(
    conn: &mut PgConnection,
    key: &[u8],
    windows: &Windows,
) -> ModelResult<Option<DateTime<Utc>>> {
    let counts = shared_rate_counts::current(conn, key, &lengths(windows)).await?;
    Ok(windows
        .iter()
        .zip(counts)
        .filter(|((_, max), window)| window.count >= *max)
        .map(|(_, window)| window.ends_at)
        .max())
}

/// Counts one event for `key` in each of `windows`. See [`increment`] for `pool`.
pub async fn count(
    conn: &mut PgConnection,
    pool: &PgPool,
    key: &[u8],
    windows: &Windows,
) -> ModelResult<()> {
    increment(conn, pool, key, &lengths(windows)).await?;
    Ok(())
}

/// Counts one event for `key` in each of `window_lengths` (seconds) and returns the windows after
/// it, in the same order. Every count in `shared_rate_counts` goes through here.
///
/// On a small fraction of calls it also deletes the account forms' expired data in the background,
/// on a connection from `pool` rather than `conn`, so the caller's transaction and response never
/// wait for it.
pub async fn increment(
    conn: &mut PgConnection,
    pool: &PgPool,
    key: &[u8],
    window_lengths: &[i64],
) -> ModelResult<Vec<shared_rate_counts::WindowCount>> {
    let counts = shared_rate_counts::increment(conn, key, window_lengths).await?;
    if rand::rng().random_bool(CLEANUP_PROBABILITY) {
        let pool = pool.clone();
        tokio::spawn(async move {
            if let Err(error) = delete_expired_form_data(&pool).await {
                warn!("Deleting expired account form data failed: {error}");
            }
        });
    }
    Ok(counts)
}

async fn delete_expired_form_data(pool: &PgPool) -> ModelResult<()> {
    let mut conn = pool.acquire().await?;
    let counts = shared_rate_counts::delete_old(&mut conn).await?;
    let decisions = account_form_decisions::delete_older_than(
        &mut conn,
        Utc::now() - Duration::days(account_form_checks::RETENTION_DAYS),
    )
    .await?;
    info!("Deleted {counts} old shared counts and {decisions} logged submissions");
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
