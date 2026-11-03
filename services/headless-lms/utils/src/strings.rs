use std::borrow::Cow;

use once_cell::sync::Lazy;
use rand::{RngExt, distr::Alphanumeric, rng};
use regex::Regex;

static IETF_LANGUAGE_CODE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$")
        .expect("Invalid IETF language code regex.")
});

/// One HTML tag, `<` to the next `>`.
pub static HTML_TAG_REGEX: Lazy<Regex> =
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

/// Removes all HTML tags from the input, leaving only the text content. Borrows the input when
/// it has no tags.
pub fn strip_html_tags(input: &str) -> Cow<'_, str> {
    HTML_TAG_REGEX.replace_all(input, "")
}

/// Decodes the entities rich text commonly holds: `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;` and
/// `&nbsp;` (as a space). Decodes once, so `&amp;lt;` becomes `&lt;`. Borrows the input when it
/// has no `&`.
pub fn decode_html_entities(text: &str) -> Cow<'_, str> {
    if !text.contains('&') {
        return Cow::Borrowed(text);
    }
    Cow::Owned(
        text.replace("&nbsp;", " ")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace("&amp;", "&"),
    )
}

/// `text` as HTML text content: `&`, `<` and `>` as entities. Leaves quotes as they are, so it
/// isn't safe inside attribute values; see [`escape_html`].
pub fn escape_html_text(text: &str) -> String {
    escape(text, false)
}

/// `text` safe both as HTML text content and inside a quoted attribute value.
pub fn escape_html(text: &str) -> String {
    escape(text, true)
}

fn escape(text: &str, escapes_quotes: bool) -> String {
    let mut escaped = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' if escapes_quotes => escaped.push_str("&quot;"),
            '\'' if escapes_quotes => escaped.push_str("&#39;"),
            _ => escaped.push(c),
        }
    }
    escaped
}

/// A URL path segment made of a title: its letters and digits, of any script, in lowercase, with
/// each run of other characters as one `-` and none at either end. Empty when the title has no
/// letters or digits, so the caller picks a fallback.
pub fn slugify(title: &str) -> String {
    let mut slug = String::with_capacity(title.len());
    let mut is_separator_pending = false;
    for c in title.chars().flat_map(char::to_lowercase) {
        if c.is_alphanumeric() {
            if is_separator_pending && !slug.is_empty() {
                slug.push('-');
            }
            is_separator_pending = false;
            slug.push(c);
        } else {
            is_separator_pending = true;
        }
    }
    slug
}

/// Trims the string and returns `None` if the trimmed result is empty.
pub fn non_empty_trimmed(s: &str) -> Option<&str> {
    let trimmed = s.trim();
    (!trimmed.is_empty()).then_some(trimmed)
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
    fn non_empty_trimmed_trims_and_rejects_blank() {
        assert_eq!(non_empty_trimmed("  hello  "), Some("hello"));
        assert_eq!(non_empty_trimmed(""), None);
        assert_eq!(non_empty_trimmed("   "), None);
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
        assert_eq!(result.len(), 254);
        assert!(result.is_char_boundary(result.len()));
        assert_eq!(result, "a".repeat(254));
    }

    #[test]
    fn truncate_utf8_at_boundary_handles_emoji() {
        let input = format!("{}😀z", "a".repeat(254));
        let result = truncate_utf8_at_boundary(&input, 255);
        assert_eq!(result.len(), 254);
        assert!(result.is_char_boundary(result.len()));
        assert_eq!(result, "a".repeat(254));
    }
}
