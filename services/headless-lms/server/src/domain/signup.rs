//! Checks of the signup form that the server repeats or adds to the browser's.

use std::net::IpAddr;
use std::sync::LazyLock;

use secrecy::{ExposeSecret, SecretString};

use crate::config::server_runtime_config;
use crate::domain::{
    request_network::{fine_prefix, keyed_digest, prefix},
    shared_limits::{self, windows_from_env},
};
use crate::prelude::*;

/// How often one subscriber address is told that an address has an account, from
/// `SIGNUP_EXISTING_ACCOUNT_LIMITS`.
static EXISTING_ACCOUNT_LIMITS: LazyLock<Vec<(i64, i64)>> = LazyLock::new(|| {
    windows_from_env(
        "SIGNUP_EXISTING_ACCOUNT_LIMITS",
        &[(3600, 10), (86_400, 30)],
    )
});
/// The same per /24 or /48, from `SIGNUP_EXISTING_ACCOUNT_RANGE_LIMITS`. Higher, as one campus or
/// office network can be shared by many people.
static EXISTING_ACCOUNT_RANGE_LIMITS: LazyLock<Vec<(i64, i64)>> = LazyLock::new(|| {
    windows_from_env(
        "SIGNUP_EXISTING_ACCOUNT_RANGE_LIMITS",
        &[(3600, 50), (86_400, 200)],
    )
});
/// Retry-After for a requester without a known address, which is never told.
const UNKNOWN_REQUESTER_RETRY_SECONDS: i64 = 3600;

/// Must match the signup form's check, which counts UTF-16 code units.
const MIN_PASSWORD_LENGTH: usize = 8;

/// Whether `email` passes the signup form's format check: `local@domain` without whitespace or a
/// second `@`, and a dot inside the domain.
fn is_plausible_email(email: &str) -> bool {
    let Some((local, domain)) = email.split_once('@') else {
        return false;
    };
    !local.is_empty()
        && !domain.contains('@')
        && !email.chars().any(char::is_whitespace)
        && domain
            .char_indices()
            .any(|(i, c)| c == '.' && i > 0 && i + 1 < domain.len())
}

/// Repeats the form's checks of the address and the password, as a request need not come from it.
pub fn validate_form(
    email: &str,
    password: &SecretString,
    password_confirmation: &SecretString,
) -> Result<(), ControllerError> {
    if !is_plausible_email(email) {
        return Err(controller_err!(
            BadRequest,
            "Invalid email address.".to_string()
        ));
    }
    let password = password.expose_secret();
    if password.encode_utf16().count() < MIN_PASSWORD_LENGTH
        || password != password_confirmation.expose_secret()
    {
        return Err(controller_err!(
            BadRequest,
            "Invalid password or password confirmation.".to_string()
        ));
    }
    Ok(())
}

fn existing_account_keys(ip: IpAddr) -> (Vec<u8>, Vec<u8>) {
    (
        keyed_digest("existing_account", &fine_prefix(ip)),
        keyed_digest("existing_account_range", &prefix(ip)),
    )
}

/// Refuses the signup with `TooManyRequests` once `client_ip` has been told too often that an
/// address has an account, or when it is unknown. Call it before looking the address up, so that
/// the refusal is the same whether the address has an account or not. Test mode, where the system
/// tests sign up from one address, is never refused.
pub async fn check_may_reveal_existing_account(
    conn: &mut PgConnection,
    client_ip: Option<IpAddr>,
) -> Result<(), ControllerError> {
    if server_runtime_config().test_mode {
        return Ok(());
    }
    let Some(ip) = client_ip else {
        return Err(shared_limits::too_many_requests(
            UNKNOWN_REQUESTER_RETRY_SECONDS,
        ));
    };
    let (address_key, range_key) = existing_account_keys(ip);
    let mut longest_full_window = None;
    for (key, windows) in [
        (&address_key, &*EXISTING_ACCOUNT_LIMITS),
        (&range_key, &*EXISTING_ACCOUNT_RANGE_LIMITS),
    ] {
        let full = shared_limits::full_window(conn, key, windows).await?;
        longest_full_window = longest_full_window.max(full);
    }
    match longest_full_window {
        Some(length) => Err(shared_limits::too_many_requests(length)),
        None => Ok(()),
    }
}

/// Counts that `client_ip` was told an address has an account. See
/// [`check_may_reveal_existing_account`].
pub async fn count_revealed_existing_account(
    conn: &mut PgConnection,
    client_ip: Option<IpAddr>,
) -> ModelResult<()> {
    let Some(ip) = client_ip.filter(|_| !server_runtime_config().test_mode) else {
        return Ok(());
    };
    let (address_key, range_key) = existing_account_keys(ip);
    shared_limits::count(conn, &address_key, &EXISTING_ACCOUNT_LIMITS).await?;
    shared_limits::count(conn, &range_key, &EXISTING_ACCOUNT_RANGE_LIMITS).await
}
