//! Facts read from the request's headers. The headers themselves are not kept.

use actix_web::HttpRequest;
use serde_json::Value;

use super::signals::Signals;

/// The trimmed value of the header `name`, or `None` when it is absent, empty or not text.
pub fn header<'a>(request: &'a HttpRequest, name: &str) -> Option<&'a str> {
    request
        .headers()
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

/// Adds the `header` namespace.
pub fn add_signals(signals: &mut Signals, request: &HttpRequest, expected_host: &str) {
    let header = |name: &str| header(request, name);
    let user_agent = header("user-agent").unwrap_or_default();
    let client_hints = header("sec-ch-ua");

    signals.set("header", "browser", Value::from(browser_family(user_agent)));
    signals.set(
        "header",
        "user_agent_present",
        Value::from(!user_agent.is_empty()),
    );
    signals.set(
        "header",
        "mobile",
        Value::from(user_agent.contains("Mobile") || user_agent.contains("Android")),
    );
    signals.set(
        "header",
        "accept_language_present",
        Value::from(header("accept-language").is_some()),
    );
    signals.set(
        "header",
        "language",
        header("accept-language")
            .and_then(primary_language)
            .map(Value::from),
    );
    let fetch_metadata = ["sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest"]
        .iter()
        .filter(|name| header(name).is_some())
        .count();
    signals.set(
        "header",
        "fetch_metadata_count",
        Value::from(fetch_metadata),
    );
    signals.set(
        "header",
        "fetch_site",
        header("sec-fetch-site").map(Value::from),
    );
    signals.set(
        "header",
        "client_hints_present",
        Value::from(client_hints.is_some()),
    );
    signals.set(
        "header",
        "client_hints_platform",
        header("sec-ch-ua-platform")
            .map(|platform| platform.trim_matches('"').to_lowercase())
            .map(Value::from),
    );
    signals.set(
        "header",
        "origin_matches",
        header("origin").map(|origin| Value::from(origin_host(origin) == Some(expected_host))),
    );
}

/// A coarse browser family from the user agent: `chrome`, `edge`, `opera`, `firefox`, `safari`,
/// `other` or `none`.
pub fn browser_family(user_agent: &str) -> &'static str {
    if user_agent.is_empty() {
        "none"
    } else if user_agent.contains("Edg/") {
        "edge"
    } else if user_agent.contains("OPR/") {
        "opera"
    } else if user_agent.contains("Firefox/") {
        "firefox"
    } else if user_agent.contains("Chrome/") || user_agent.contains("Chromium/") {
        "chrome"
    } else if user_agent.contains("Safari/") {
        "safari"
    } else {
        "other"
    }
}

/// The primary subtag of the first language in an `Accept-Language` value, lowercased.
pub fn primary_language(accept_language: &str) -> Option<String> {
    let first = accept_language.split(',').next()?.split(';').next()?.trim();
    let primary = first.split(['-', '_']).next()?.to_lowercase();
    (primary.len() >= 2 && primary.len() <= 3 && primary.chars().all(|c| c.is_ascii_alphabetic()))
        .then_some(primary)
}

fn origin_host(origin: &str) -> Option<&str> {
    let without_scheme = origin.split("://").nth(1)?;
    without_scheme.split([':', '/']).next()
}
