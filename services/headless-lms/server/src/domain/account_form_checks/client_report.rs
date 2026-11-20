//! Facts the form's browser reported about itself in the opaque `client_info` field. All of it is
//! client-controlled, so it is only ever logged next to what the request itself said.

use base64::Engine;
use serde_json::Value;

use super::headers::{browser_family, primary_language};
use super::signals::{Signals, count};

/// Anything longer is treated as malformed.
const MAX_REPORT_BYTES: usize = 16 * 1024;

/// What the request said about itself, for comparing against the report.
pub struct RequestFacts<'a> {
    pub user_agent: &'a str,
    pub accept_language: Option<&'a str>,
    pub client_hints_platform: Option<&'a str>,
}

/// Adds the `client`, `input` and `cross_check` namespaces from `report`.
pub fn add_signals(signals: &mut Signals, report: Option<&str>, request: &RequestFacts<'_>) {
    let report = report.filter(|r| !r.is_empty());
    signals.set("client", "present", Value::from(report.is_some()));
    let Some(report) = report else {
        return;
    };
    let parsed = (report.len() <= MAX_REPORT_BYTES)
        .then(|| {
            base64::engine::general_purpose::STANDARD
                .decode(report)
                .ok()
        })
        .flatten()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .filter(Value::is_object);
    signals.set("client", "valid", Value::from(parsed.is_some()));
    let Some(report) = parsed else {
        return;
    };
    let at = |path: &str| report.pointer(path);
    let boolean = |path: &str| at(path).and_then(Value::as_bool);
    let number = |path: &str| at(path).and_then(Value::as_f64);
    let text = |path: &str| at(path).and_then(Value::as_str);
    let small_integer =
        |path: &str| number(path).map(|n| Value::from(n.clamp(0.0, 10_000.0) as i64));

    let user_agent = text("/environment/userAgent").unwrap_or_default();
    let timezone = text("/environment/timezone");
    signals.set("client", "browser", Value::from(browser_family(user_agent)));
    signals.set(
        "client",
        "timezone",
        timezone.map(|zone| Value::from(zone.chars().take(64).collect::<String>())),
    );
    let languages = at("/environment/languages").and_then(Value::as_array);
    let first_language = languages
        .and_then(|languages| languages.first())
        .and_then(Value::as_str)
        .and_then(primary_language);
    signals.set(
        "client",
        "language",
        first_language.clone().map(Value::from),
    );
    signals.set(
        "client",
        "language_count",
        languages.and_then(|l| count(l.len())),
    );
    signals.set("client", "cores", small_integer("/environment/cores"));
    signals.set(
        "client",
        "memory",
        number("/environment/memory").map(Value::from),
    );
    signals.set(
        "client",
        "touch_points",
        small_integer("/environment/touchPoints"),
    );
    signals.set(
        "client",
        "screen_width",
        small_integer("/environment/screen/0"),
    );
    signals.set(
        "client",
        "screen_height",
        small_integer("/environment/screen/1"),
    );

    for (name, path) in [
        ("key_input", "/input/keyInput"),
        ("pointer_input", "/input/pointerInput"),
        ("touch_input", "/input/touchInput"),
    ] {
        signals.set("input", name, boolean(path).map(Value::from));
    }
    for (name, path) in [
        ("untrusted_events", "/input/untrustedEvents"),
        ("typed_fields", "/input/typedFields"),
        ("pasted_fields", "/input/pastedFields"),
        ("autofilled_fields", "/input/autofilledFields"),
        ("unexplained_fields", "/input/unexplainedFields"),
        ("interaction_seconds", "/input/interactionSeconds"),
    ] {
        signals.set("input", name, small_integer(path));
    }

    signals.set(
        "cross_check",
        "user_agent_matches",
        Value::from(user_agent == request.user_agent),
    );
    signals.set(
        "cross_check",
        "language_matches",
        request
            .accept_language
            .and_then(primary_language)
            .zip(first_language)
            .map(|(header, client)| Value::from(header == client)),
    );
    signals.set(
        "cross_check",
        "platform_matches",
        request
            .client_hints_platform
            .zip(text("/environment/clientHintsPlatform"))
            .map(|(header, client)| {
                Value::from(header.trim_matches('"').eq_ignore_ascii_case(client))
            }),
    );
}
