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
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

/// Frames the parts of an identifier. The stored `error_variants.exact_error_identifier` values were
/// computed with it and its meaning is documented in that column's comment, so it cannot change
/// without orphaning every row.
const PART_SEPARATOR: u8 = 0;

/// Digests `parts` framed by [`PART_SEPARATOR`], dropping the separator wherever a part contains it
/// itself.
///
/// Without that the framing is forgeable: the service name, message and stack trace of an error
/// report are whatever the reporter sent, and a separator placed where one part ends lets a crafted
/// report claim another error's identity and merge into its aggregate. Dropping rather than
/// escaping keeps every identifier already stored valid, and loses nothing real, since Postgres
/// cannot hold a null byte in a text column anyway.
fn hash_identifier(parts: &[&str]) -> String {
    let mut hasher = blake3::Hasher::new();
    for (idx, part) in parts.iter().enumerate() {
        if idx > 0 {
            hasher.update(&[PART_SEPARATOR]);
        }
        for run in part.as_bytes().split(|byte| *byte == PART_SEPARATOR) {
            hasher.update(run);
        }
    }
    hasher.finalize().to_hex().to_string()
}

/// Computes a stable BLAKE3 identifier for an exact error variant.
///
/// Framed by [`hash_identifier`], so ("foo", "") and ("", "foo") are different variants.
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

    /// One error's message ending where the next field begins must not make it that other error, or
    /// the two are aggregated as one and the counts of both are wrong.
    #[test]
    fn fields_that_only_differ_in_where_they_are_split_get_different_identifiers() {
        assert_ne!(
            calculate_exact_error_identifier("main-frontend", "frontend", "foobar", None),
            calculate_exact_error_identifier("main-frontend", "frontend", "foo", Some("bar")),
        );
    }

    /// The reporter chooses the message and the stack trace, so a separator byte inside one of them
    /// would let a crafted report land on an existing error's identifier and poison its aggregate.
    #[test]
    fn a_separator_byte_inside_a_field_cannot_forge_another_errors_identifier() {
        assert_ne!(
            calculate_exact_error_identifier("main-frontend", "frontend", "x\0y", None),
            calculate_exact_error_identifier("main-frontend", "frontend", "x", Some("y\0")),
        );
    }

    /// `exact_error_identifier` is half of a unique constraint and years of occurrence counts hang
    /// off it, so an identifier that was computed before must still come out the same: a changed
    /// digest orphans every stored variant and silently restarts its statistics.
    #[test]
    fn an_identifier_computed_by_an_earlier_release_still_matches() {
        assert_eq!(
            calculate_exact_error_identifier(
                "main-frontend",
                "frontend",
                "Record 123456 not found",
                Some("at fn (app.abc12345def0.js:10:5)"),
            ),
            "52bb48c4ba91e36118ee65ac89da79c2ff6b6a16ccf0b405548628f495c8a80d",
        );
        assert_eq!(
            calculate_error_grouping_identifier(
                "main-frontend",
                "frontend",
                "Record 123456 not found",
            ),
            "17cb38f2ae609f927849a7591c4926b4c165e2cc7858810abb04a0607c38e52a",
        );
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
