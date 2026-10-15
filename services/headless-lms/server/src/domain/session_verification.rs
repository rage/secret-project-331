//! Whether a session of a user with a role comes from a browser and a network the user has confirmed
//! with an emailed code, and confirming new ones.

use std::net::IpAddr;

use actix_web::cookie::{Cookie, SameSite, time::Duration as CookieDuration};
use chrono::Duration;
use headless_lms_models::{
    email_deliveries,
    email_templates::{self, EmailTemplateType},
    staff_security_verified_browsers as verified_browsers,
    staff_security_verified_networks as verified_networks, user_email_codes,
    user_email_codes::UserEmailCodePurpose,
};
use headless_lms_utils::ip_to_country::IpToCountryMapper;
use secrecy::{ExposeSecret, SecretString};

use crate::config::server_runtime_config;
use crate::domain::email_ownership_verification::{
    FALLBACK_EMAIL_LANGUAGE, MAX_CODE_ATTEMPTS, MIN_RESEND_INTERVAL_MINUTES,
};
use crate::prelude::*;

/// Holds the remembered-browser token.
pub const BROWSER_COOKIE_NAME: &str = "verified_browser";
/// Slightly over the six months the database remembers a browser for.
const BROWSER_COOKIE_MAX_AGE_DAYS: i64 = 184;
const PURPOSE: UserEmailCodePurpose = UserEmailCodePurpose::NetworkVerification;
const MAX_CODES_PER_DAY: i64 = 10;
const EXPIRED_CLEANUP_PROBABILITY: f64 = 0.001;

/// Whether the user is subject to the check at all: any role at any scope counts, as for the login
/// code, since a teacher's account is as worth stealing as an admin's.
pub async fn applies_to(conn: &mut PgConnection, user_id: Uuid) -> ModelResult<bool> {
    Ok(!models::roles::get_roles(conn, user_id).await?.is_empty())
}

/// The client address as the ingress saw it: the rightmost `X-Forwarded-For` entry, which the
/// ingress appends. Earlier entries, like actix's `realip_remote_addr`, are whatever the client
/// sent. Falls back to the peer address for requests that bypassed the ingress.
pub fn client_ip(req: &HttpRequest) -> Option<IpAddr> {
    let forwarded_for = req
        .headers()
        .get_all("x-forwarded-for")
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(','))
        .last();
    match forwarded_for {
        Some(entry) => parse_forwarded_ip(entry),
        None => req.peer_addr().map(|addr| addr.ip().to_canonical()),
    }
}

fn parse_forwarded_ip(entry: &str) -> Option<IpAddr> {
    let entry = entry.trim();
    if let Ok(ip) = entry.parse::<IpAddr>() {
        return Some(ip.to_canonical());
    }
    if let Ok(addr) = entry.parse::<std::net::SocketAddr>() {
        return Some(addr.ip().to_canonical());
    }
    entry
        .strip_prefix('[')
        .and_then(|rest| rest.split_once(']'))
        .and_then(|(ip, _)| ip.parse::<IpAddr>().ok())
        .map(|ip| ip.to_canonical())
}

/// Loopback and private (RFC 1918, ULA) addresses, which in test mode pass without a network.
fn is_local(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => ip.is_loopback() || ip.is_private(),
        IpAddr::V6(ip) => ip.is_loopback() || (ip.segments()[0] & 0xfe00) == 0xfc00,
    }
}

fn browser_token(req: &HttpRequest) -> Option<SecretString> {
    req.cookie(BROWSER_COOKIE_NAME)
        .map(|cookie| SecretString::from(cookie.value().to_string()))
}

/// The remembered-browser cookie, with the same flags as the session cookie.
pub fn browser_cookie(token: &SecretString) -> Cookie<'static> {
    Cookie::build(BROWSER_COOKIE_NAME, token.expose_secret().to_string())
        .path("/api")
        .http_only(true)
        .secure(!server_runtime_config().allow_no_https_for_development)
        .same_site(SameSite::Strict)
        .max_age(CookieDuration::days(BROWSER_COOKIE_MAX_AGE_DAYS))
        .finish()
}

/// A request from a remembered browser on a verified network.
#[derive(Debug)]
pub struct Recognition {
    pub browser_id: Uuid,
    /// The networks the request matched; empty for a local address in test mode.
    pub network_ids: Vec<Uuid>,
    /// Set when the browser's lifetime was extended, so the response must carry it.
    pub renewed_cookie: Option<Cookie<'static>>,
}

/// Whether the request comes from one of the user's remembered browsers on one of their verified
/// networks. Widens a freshly verified network to cover the request where allowed, and renews what
/// the request matched.
pub async fn recognize(
    conn: &mut PgConnection,
    ip_to_country: &IpToCountryMapper,
    test_mode: bool,
    user_id: Uuid,
    req: &HttpRequest,
) -> ModelResult<Option<Recognition>> {
    let Some(token) = browser_token(req) else {
        return Ok(None);
    };
    let Some(browser_id) = verified_browsers::get_unexpired_id(conn, user_id, &token).await? else {
        return Ok(None);
    };
    let Some(ip) = client_ip(req) else {
        return Ok(None);
    };

    let network_ids = if test_mode && is_local(ip) {
        Vec::new()
    } else {
        let candidates = verified_networks::get_candidates(conn, user_id, ip, browser_id).await?;
        if candidates.is_empty() {
            return Ok(None);
        }
        // Only now: the lookup is a linear scan over every country's list.
        let country = ip_to_country.map_ip_to_country_quietly(&ip);
        let matched: Vec<Uuid> = candidates
            .iter()
            // The dev and test lists are truncated, so countries there are unreliable.
            .filter(|c| c.contains_ip && (test_mode || c.country.as_deref() == country))
            .map(|c| c.id)
            .collect();
        if !matched.is_empty() {
            matched
        } else if let Some(country) = country {
            let widened =
                verified_networks::widen_to_cover(conn, user_id, browser_id, ip, country).await?;
            if widened.is_empty() {
                return Ok(None);
            }
            widened
        } else {
            return Ok(None);
        }
    };

    verified_networks::renew_if_expiring(conn, &network_ids).await?;
    let renewed_cookie = verified_browsers::renew(conn, browser_id)
        .await?
        .then(|| browser_cookie(&token));
    Ok(Some(Recognition {
        browser_id,
        network_ids,
        renewed_cookie,
    }))
}

/// Remembers the requesting browser and verifies its network for the user, after the user proved
/// they read their email. Returns the cookie the response must set.
///
/// A cookie of another user's browser is replaced, and that browser forgotten: one cookie per
/// browser.
pub async fn record_verification(
    conn: &mut PgConnection,
    ip_to_country: &IpToCountryMapper,
    user_id: Uuid,
    req: &HttpRequest,
) -> ModelResult<Cookie<'static>> {
    let mut tx = conn.begin().await?;
    let existing = match browser_token(req) {
        Some(token) => match verified_browsers::get_unexpired_id(&mut tx, user_id, &token).await? {
            Some(browser_id) => {
                verified_browsers::renew(&mut tx, browser_id).await?;
                Some((browser_id, token))
            }
            None => {
                verified_browsers::delete_by_token(&mut tx, &token).await?;
                None
            }
        },
        None => None,
    };
    let (browser_id, token) = match existing {
        Some(existing) => existing,
        None => {
            let token = verified_browsers::generate_token();
            (
                verified_browsers::insert(&mut tx, user_id, &token).await?,
                token,
            )
        }
    };
    if let Some(ip) = client_ip(req) {
        let country = ip_to_country.map_ip_to_country_quietly(&ip);
        verified_networks::record_verification(&mut tx, user_id, browser_id, ip, country).await?;
    } else {
        warn!("Could not tell the client address; verified the browser of {user_id} only");
    }
    tx.commit().await?;
    Ok(browser_cookie(&token))
}

/// Forgets the user's browsers and networks after a password change, except what `kept` matched.
///
/// Pass a recognition only for a change made with the old password: a reset link proves only
/// access to the mailbox.
pub async fn forget_after_password_change(
    conn: &mut PgConnection,
    user_id: Uuid,
    kept: Option<&Recognition>,
) -> ModelResult<()> {
    verified_networks::delete_all_for_user_except(
        conn,
        user_id,
        kept.map(|r| r.network_ids.as_slice()).unwrap_or_default(),
    )
    .await?;
    verified_browsers::delete_all_for_user_except(conn, user_id, kept.map(|r| r.browser_id))
        .await?;
    Ok(())
}

/// The token test-mode logins give a user's browser. Fixed, and seeded for every seeded user, so
/// that saved Playwright logins keep working across reseeds.
fn test_mode_browser_token(user_id: Uuid) -> SecretString {
    SecretString::from(format!("test-mode-browser-{user_id}"))
}

/// Remembers the user's [`test_mode_browser_token`] and returns it. Never removes another user's
/// row: a saved login of the previous user of the same browser context must stay valid.
pub async fn remember_test_mode_browser(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<SecretString> {
    let token = test_mode_browser_token(user_id);
    verified_browsers::insert_if_absent(conn, user_id, &token).await?;
    Ok(token)
}

/// Hard-deletes expired browsers and networks on a small fraction of calls.
pub async fn delete_expired_occasionally(conn: &mut PgConnection) -> ModelResult<()> {
    if !rand::rng().random_bool(EXPIRED_CLEANUP_PROBABILITY) {
        return Ok(());
    }
    let networks = verified_networks::delete_expired(conn).await?;
    let browsers = verified_browsers::delete_expired(conn).await?;
    info!("Deleted {networks} expired verified networks and {browsers} expired verified browsers");
    Ok(())
}

/// `t***@helsinki.fi` for `tester@helsinki.fi`: enough to recognize one's own address.
pub fn mask_email(email: &str) -> String {
    match email.split_once('@') {
        Some((local, domain)) => {
            let first: String = local.chars().take(1).collect();
            format!("{first}***@{domain}")
        }
        None => "***".to_string(),
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum EmailCodeOutcome {
    Sent,
    /// A usable code is already out; nothing was sent.
    AlreadySent,
    RecentlySent {
        retry_after_seconds: i64,
    },
    DailyLimitReached,
}

/// Mails the user a code, unless one is out already.
///
/// Without `resend` a usable code is never replaced, so opening the dialog again in a reload or a
/// new tab does not invalidate the mail the user is reading. With it, a code is replaced once it is
/// [`MIN_RESEND_INTERVAL_MINUTES`] old.
pub async fn send_email_code(
    conn: &mut PgConnection,
    user_id: Uuid,
    resend: bool,
) -> anyhow::Result<EmailCodeOutcome> {
    let mut tx = conn.begin().await?;
    user_email_codes::lock_for_user_and_purpose(&mut tx, user_id, PURPOSE).await?;

    let live_code =
        user_email_codes::get_unused_user_email_code_with_user_id(&mut tx, user_id, PURPOSE)
            .await?
            .filter(|code| code.attempt_count < MAX_CODE_ATTEMPTS);
    if let Some(live_code) = live_code {
        if !resend {
            return Ok(EmailCodeOutcome::AlreadySent);
        }
        let retry_after_seconds =
            (live_code.created_at + Duration::minutes(MIN_RESEND_INTERVAL_MINUTES) - Utc::now())
                .num_seconds();
        if retry_after_seconds > 0 {
            return Ok(EmailCodeOutcome::RecentlySent {
                retry_after_seconds,
            });
        }
    }

    let sent_today = user_email_codes::count_created_since(
        &mut tx,
        user_id,
        PURPOSE,
        Utc::now() - Duration::days(1),
    )
    .await?;
    if sent_today >= MAX_CODES_PER_DAY {
        return Ok(EmailCodeOutcome::DailyLimitReached);
    }

    let template = email_templates::get_generic_email_template_by_type_and_language(
        &mut tx,
        EmailTemplateType::VerifyNetwork,
        FALLBACK_EMAIL_LANGUAGE,
    )
    .await
    .map_err(|e| {
        anyhow::anyhow!(
            "The verify_network email template is missing: {}",
            e.message()
        )
    })?;
    let code = user_email_codes::generate_code();
    user_email_codes::insert_user_email_code(&mut tx, user_id, PURPOSE, &code).await?;
    email_deliveries::insert_email_delivery(&mut tx, user_id, template.id).await?;
    tx.commit().await?;
    Ok(EmailCodeOutcome::Sent)
}

#[derive(Debug)]
pub enum CodeCheck {
    Valid,
    Invalid,
    Expired,
    TooManyAttempts,
}

/// Checks `code` against the user's outstanding code, counting a wrong one against it.
///
/// On [`CodeCheck::Valid`] the code is spent, in the caller's transaction.
pub async fn check_email_code(
    conn: &mut PgConnection,
    user_id: Uuid,
    code: &DbSecret,
) -> ModelResult<CodeCheck> {
    let Some(outstanding) =
        user_email_codes::get_outstanding_user_email_code(conn, user_id, PURPOSE).await?
    else {
        return Ok(CodeCheck::Invalid);
    };
    // Before counting the guess: attempts against a code that can no longer be spent would only
    // strand the user on "too many attempts" for a code they have to replace anyway.
    if outstanding.expires_at <= Utc::now() {
        return Ok(CodeCheck::Expired);
    }
    if outstanding.attempt_count >= MAX_CODE_ATTEMPTS {
        return Ok(CodeCheck::TooManyAttempts);
    }
    if user_email_codes::is_reset_user_email_code_valid(conn, user_id, PURPOSE, code).await?
        && user_email_codes::mark_user_email_code_used(conn, user_id, PURPOSE, code).await?
    {
        return Ok(CodeCheck::Valid);
    }
    let retired =
        user_email_codes::record_failed_attempt(conn, user_id, PURPOSE, MAX_CODE_ATTEMPTS).await?;
    Ok(if retired {
        CodeCheck::TooManyAttempts
    } else {
        CodeCheck::Invalid
    })
}
