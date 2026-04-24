use std::sync::LazyLock;

use regex::Regex;

static UUID_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
        .expect("valid regex")
});
static HEX_ADDR_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"0x[0-9a-fA-F]{6,}").expect("valid regex"));
static TIMESTAMP_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}").expect("valid regex"));
static LONG_NUMBER_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b\d{5,}\b").expect("valid regex"));
static BUNDLER_HASH_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\.[0-9a-f]{8,}\.(js|css|wasm|map)").expect("valid regex"));

/// Normalizes dynamic values out of an error message so that errors with
/// different UUIDs, addresses, or IDs still hash to the same identifier.
pub fn normalize_message(message: &str) -> String {
    // Order matters: UUIDs before long numbers (UUID contains long numeric runs).
    let s = UUID_RE.replace_all(message, "{uuid}");
    let s = HEX_ADDR_RE.replace_all(&s, "{addr}");
    let s = TIMESTAMP_RE.replace_all(&s, "{timestamp}");
    let s = LONG_NUMBER_RE.replace_all(&s, "{N}");
    s.into_owned()
}

/// Normalizes a stack trace: strips dynamic addresses and bundler hashes,
/// and trims each line.
pub fn normalize_stack_trace(stack_trace: &str) -> String {
    let s = UUID_RE.replace_all(stack_trace, "{uuid}");
    let s = HEX_ADDR_RE.replace_all(&s, "{addr}");
    let s = TIMESTAMP_RE.replace_all(&s, "{timestamp}");
    // Strip webpack/vite/esbuild content hashes from filenames.
    let s = BUNDLER_HASH_RE.replace_all(&s, ".{hash}.$1");
    let s = LONG_NUMBER_RE.replace_all(&s, "{N}");
    // Trim each line.
    s.lines().map(str::trim).collect::<Vec<_>>().join("\n")
}

pub fn canonicalize_grouping_message(normalized_message: &str) -> String {
    normalized_message
        .trim()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn hash_identifier(parts: &[&str]) -> String {
    let mut hasher = blake3::Hasher::new();
    for (idx, part) in parts.iter().enumerate() {
        if idx > 0 {
            hasher.update(b"\x00");
        }
        hasher.update(part.as_bytes());
    }
    hasher.finalize().to_hex().to_string()
}

/// Computes a stable BLAKE3 identifier for an exact error variant.
///
/// Components are separated by null bytes so that ("foo", "") and ("", "foo")
/// never collide.
pub fn calculate_exact_error_identifier(
    service: &str,
    error_source: &str,
    message: &str,
    stack_trace: Option<&str>,
) -> String {
    let normalized_message = normalize_message(message);
    let normalized_stack = stack_trace.map(normalize_stack_trace);

    hash_identifier(&[
        service,
        error_source,
        normalized_message.as_str(),
        normalized_stack.as_deref().unwrap_or(""),
    ])
}

/// Computes a stable BLAKE3 identifier for broadly grouping related errors.
pub fn calculate_error_grouping_identifier(
    service: &str,
    error_source: &str,
    message: &str,
) -> String {
    let normalized_message = normalize_message(message);
    let grouping_message = canonicalize_grouping_message(&normalized_message);

    hash_identifier(&[service, error_source, grouping_message.as_str()])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_message_uuid() {
        let msg = "User 550e8400-e29b-41d4-a716-446655440000 not found";
        assert_eq!(normalize_message(msg), "User {uuid} not found");
    }

    #[test]
    fn test_normalize_message_hex_addr() {
        let msg = "Segfault at 0x7f2a3b4c5d6e in thread";
        assert_eq!(normalize_message(msg), "Segfault at {addr} in thread");
    }

    #[test]
    fn test_normalize_message_timestamp() {
        let msg = "Request failed at 2024-01-15T10:30:00 with status 503";
        assert_eq!(
            normalize_message(msg),
            "Request failed at {timestamp} with status 503"
        );
    }

    #[test]
    fn test_normalize_message_long_number() {
        let msg = "Record 123456 not found";
        assert_eq!(normalize_message(msg), "Record {N} not found");
    }

    #[test]
    fn test_normalize_message_short_number_unchanged() {
        let msg = "HTTP 500 error on route /api";
        assert_eq!(normalize_message(msg), "HTTP 500 error on route /api");
    }

    #[test]
    fn test_normalize_message_multiple_patterns() {
        let msg = "User 550e8400-e29b-41d4-a716-446655440000 (id=987654) at 0x7f2a3b4c5d6e";
        assert_eq!(normalize_message(msg), "User {uuid} (id={N}) at {addr}");
    }

    #[test]
    fn test_normalize_stack_trace_hex_addr() {
        let trace = "at process (0x00007f0a1234abcd)";
        assert_eq!(normalize_stack_trace(trace), "at process ({addr})");
    }

    #[test]
    fn test_normalize_stack_trace_bundler_hash_js() {
        let trace = "at fn (app.abc12345def0.js:10:5)";
        assert_eq!(normalize_stack_trace(trace), "at fn (app.{hash}.js:10:5)");
    }

    #[test]
    fn test_normalize_stack_trace_bundler_hash_css() {
        let trace = "loaded styles.abc98765def0.css";
        assert_eq!(normalize_stack_trace(trace), "loaded styles.{hash}.css");
    }

    #[test]
    fn test_normalize_stack_trace_bundler_hash_digits_only() {
        let trace = "at fn (app.12345678.js:10:5)";
        assert_eq!(normalize_stack_trace(trace), "at fn (app.{hash}.js:10:5)");
    }

    #[test]
    fn test_normalize_stack_trace_line_trimming() {
        let trace = "   at foo (bar.js:1:1)   \n   at baz (qux.js:2:2)   ";
        assert_eq!(
            normalize_stack_trace(trace),
            "at foo (bar.js:1:1)\nat baz (qux.js:2:2)"
        );
    }

    #[test]
    fn test_same_error_different_uuids_same_exact_identifier() {
        let fp1 = calculate_exact_error_identifier(
            "main-frontend",
            "frontend",
            "User 550e8400-e29b-41d4-a716-446655440000 not found",
            None,
        );
        let fp2 = calculate_exact_error_identifier(
            "main-frontend",
            "frontend",
            "User 660f9511-f3ac-52e5-b827-557766551111 not found",
            None,
        );
        assert_eq!(fp1, fp2);
    }

    #[test]
    fn test_same_error_different_hex_addr_in_stack_same_exact_identifier() {
        let fp1 = calculate_exact_error_identifier(
            "headless-lms",
            "backend",
            "null pointer dereference",
            Some("at 0x7f0a1234abcd"),
        );
        let fp2 = calculate_exact_error_identifier(
            "headless-lms",
            "backend",
            "null pointer dereference",
            Some("at 0x7f9b5678efab"),
        );
        assert_eq!(fp1, fp2);
    }

    #[test]
    fn test_same_stack_different_bundler_hash_same_exact_identifier() {
        let fp1 = calculate_exact_error_identifier(
            "main-frontend",
            "frontend",
            "Cannot read property",
            Some("at fn (app.abc12345def0.js:10:5)"),
        );
        let fp2 = calculate_exact_error_identifier(
            "main-frontend",
            "frontend",
            "Cannot read property",
            Some("at fn (app.fed09876543.js:10:5)"),
        );
        assert_eq!(fp1, fp2);
    }

    #[test]
    fn test_different_errors_different_exact_identifiers() {
        let fp1 = calculate_exact_error_identifier(
            "main-frontend",
            "frontend",
            "Cannot read property 'foo' of undefined",
            None,
        );
        let fp2 = calculate_exact_error_identifier(
            "main-frontend",
            "frontend",
            "Cannot read property 'bar' of undefined",
            None,
        );
        assert_ne!(fp1, fp2);
    }

    #[test]
    fn test_source_affects_exact_identifier() {
        let fp1 = calculate_exact_error_identifier(
            "main-frontend",
            "frontend",
            "an error occurred",
            None,
        );
        let fp2 =
            calculate_exact_error_identifier("main-frontend", "backend", "an error occurred", None);
        assert_ne!(fp1, fp2);
    }

    #[test]
    fn test_stack_presence_affects_exact_identifier() {
        let fp1 = calculate_exact_error_identifier(
            "main-frontend",
            "frontend",
            "an error",
            Some("at foo (a.js:1:1)"),
        );
        let fp2 = calculate_exact_error_identifier("main-frontend", "frontend", "an error", None);
        assert_ne!(fp1, fp2);
    }

    #[test]
    fn test_separator_prevents_collision() {
        let fp1 = calculate_exact_error_identifier("main-frontend", "frontend", "foobar", None);
        let fp2 = calculate_exact_error_identifier("main-frontend", "frontend", "foo", Some("bar"));
        assert_ne!(fp1, fp2);
    }

    #[test]
    fn test_exact_identifier_is_deterministic() {
        let fp1 = calculate_exact_error_identifier(
            "headless-lms",
            "backend",
            "test error",
            Some("stack trace"),
        );
        let fp2 = calculate_exact_error_identifier(
            "headless-lms",
            "backend",
            "test error",
            Some("stack trace"),
        );
        assert_eq!(fp1, fp2);
    }

    #[test]
    fn test_exact_identifier_length() {
        // BLAKE3 produces 32 bytes = 64 hex chars by default
        let fp = calculate_exact_error_identifier("main-frontend", "frontend", "error", None);
        assert_eq!(fp.len(), 64);
    }

    #[test]
    fn test_grouping_message_collapses_whitespace_and_case() {
        let msg = "  Cannot READ   property   {uuid}   ";
        assert_eq!(
            canonicalize_grouping_message(msg),
            "cannot read property {uuid}"
        );
    }

    #[test]
    fn test_grouping_identifier_is_case_and_whitespace_insensitive() {
        let fp1 = calculate_error_grouping_identifier(
            "main-frontend",
            "frontend",
            "Cannot read properties of undefined (reading 'foo')",
        );
        let fp2 = calculate_error_grouping_identifier(
            "main-frontend",
            "frontend",
            "  cannot read   properties of undefined (reading 'foo')  ",
        );
        assert_eq!(fp1, fp2);
    }

    #[test]
    fn test_grouping_identifier_normalizes_dynamic_message_values() {
        let fp1 = calculate_error_grouping_identifier(
            "main-frontend",
            "frontend",
            "Request 123456 failed for user 550e8400-e29b-41d4-a716-446655440000",
        );
        let fp2 = calculate_error_grouping_identifier(
            "main-frontend",
            "frontend",
            "Request 987654 failed for user 660f9511-f3ac-52e5-b827-557766551111",
        );
        assert_eq!(fp1, fp2);
    }

    #[test]
    fn test_grouping_identifier_differs_for_different_messages() {
        let fp1 = calculate_error_grouping_identifier(
            "main-frontend",
            "frontend",
            "Cannot read properties of undefined",
        );
        let fp2 = calculate_error_grouping_identifier(
            "main-frontend",
            "frontend",
            "Network request failed",
        );
        assert_ne!(fp1, fp2);
    }
}
