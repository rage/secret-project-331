use once_cell::sync::Lazy;
use rand::{RngExt, distr::Alphanumeric, rng};
use regex::Regex;

static IETF_LANGUAGE_CODE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$")
        .expect("Invalid IETF language code regex.")
});

static HTML_TAG_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"<[^>]*>").expect("Invalid HTML tag regex."));

pub fn generate_random_string(length: usize) -> String {
    rng()
        .sample_iter(Alphanumeric)
        .take(length)
        .map(char::from)
        .collect()
}

pub fn generate_easily_writable_random_string(length: usize) -> String {
    rng()
        .sample_iter(Alphanumeric)
        .filter(|c: &u8| c.is_ascii_lowercase() || c.is_ascii_digit())
        // Filter out characters that might be confused with each other
        .filter(|c| c != &b'l' && c != &b'1' && c != &b'o' && c != &b'0')
        .take(length)
        .map(char::from)
        .collect()
}

/// Checks whether the string is IETF language code where subtags are separated with underscore.
pub fn is_ietf_language_code_like(string: &str) -> bool {
    IETF_LANGUAGE_CODE_REGEX.is_match(string)
}

/// Removes all HTML tags from the input, leaving only the text content.
pub fn strip_html_tags(input: &str) -> String {
    HTML_TAG_REGEX.replace_all(input, "").into_owned()
}

/// Truncates UTF-8 text to a max byte length at a valid char boundary.
pub fn truncate_utf8_at_boundary(s: &str, max_bytes: usize) -> &str {
    if s.len() <= max_bytes {
        return s;
    }
    let mut idx = max_bytes;
    while idx > 0 && !s.is_char_boundary(idx) {
        idx -= 1;
    }
    &s[..idx]
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn ietf_language_code_validation_works() {
        // Invalid scenarios
        assert!(!is_ietf_language_code_like(""));
        assert!(!is_ietf_language_code_like("en_us"));
        assert!(!is_ietf_language_code_like("en_US"));
        assert!(!is_ietf_language_code_like("in-cans"));
        assert!(!is_ietf_language_code_like("in-cans-ca"));

        // Valid scenarios
        assert!(is_ietf_language_code_like("en"));
        assert!(is_ietf_language_code_like("eng"));
        assert!(is_ietf_language_code_like("en-US"));
        assert!(is_ietf_language_code_like("in-Cans-CA"));
    }

    #[test]
    fn strip_html_tags_removes_all_tags() {
        assert_eq!(
            strip_html_tags("<em>Intro</em> to <strong>X</strong>"),
            "Intro to X"
        );
        assert_eq!(strip_html_tags(r#"<a href="/x">link</a>"#), "link");
        assert_eq!(strip_html_tags("plain text"), "plain text");
        assert_eq!(strip_html_tags("<br>"), "");
    }

    #[test]
    fn truncate_utf8_at_boundary_returns_original_when_short() {
        let input = "heillä";
        let result = truncate_utf8_at_boundary(input, 255);
        assert_eq!(result, input);
    }

    #[test]
    fn truncate_utf8_at_boundary_handles_finnish_characters() {
        let input = format!("{}äz", "a".repeat(254));
        let result = truncate_utf8_at_boundary(&input, 255);
        assert_eq!(result.as_bytes().len(), 254);
        assert!(result.is_char_boundary(result.len()));
        assert_eq!(result, "a".repeat(254));
    }

    #[test]
    fn truncate_utf8_at_boundary_handles_emoji() {
        let input = format!("{}😀z", "a".repeat(254));
        let result = truncate_utf8_at_boundary(&input, 255);
        assert_eq!(result.as_bytes().len(), 254);
        assert!(result.is_char_boundary(result.len()));
        assert_eq!(result, "a".repeat(254));
    }
}
