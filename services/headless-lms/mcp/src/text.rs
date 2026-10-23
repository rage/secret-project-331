//! Text helpers shared by the engines: markup stripping, previews, whole-word matching, tag
//! balance and serialized sizes.

use std::borrow::Cow;
use std::sync::LazyLock;

use headless_lms_utils::strings::{HTML_TAG_REGEX, decode_html_entities, strip_html_tags};
use regex::Regex;
use serde::Serialize;

/// Whitespace that isn't a single space; collapsing only these leaves most text borrowed.
static WHITESPACE_TO_COLLAPSE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\s{2,}|[^\S ]").expect("valid regex"));

/// The visible text of a rich-text string: tags removed, common entities decoded, whitespace
/// collapsed to single spaces.
pub fn plain_text(html: &str) -> Cow<'_, str> {
    if !html.contains(['<', '&']) {
        return collapse_whitespace(html.trim());
    }
    let stripped = strip_html_tags(html);
    let decoded = decode_html_entities(&stripped);
    Cow::Owned(collapse_whitespace(decoded.trim()).into_owned())
}

fn collapse_whitespace(text: &str) -> Cow<'_, str> {
    WHITESPACE_TO_COLLAPSE.replace_all(text, " ")
}

/// The size of `value` as JSON, in bytes, without building the JSON.
pub fn serialized_len<T: Serialize + ?Sized>(value: &T) -> usize {
    struct ByteCount(usize);
    impl std::io::Write for ByteCount {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            self.0 += bytes.len();
            Ok(bytes.len())
        }

        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut count = ByteCount(0);
    serde_json::to_writer(&mut count, value).map_or(0, |()| count.0)
}

/// Cuts `text` to at most `max_chars` characters at a word boundary, adding an ellipsis when cut.
pub fn preview(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let cut: String = text.chars().take(max_chars).collect();
    let at_word = match cut.rfind(' ') {
        Some(space) if cut[..space].chars().count() > max_chars * 2 / 3 => &cut[..space],
        _ => cut.as_str(),
    };
    format!("{}…", at_word.trim_end())
}

/// Letters, digits and `_`, non-ASCII ones included. main-frontend's glossary highlighting
/// (textParsing.tsx) uses the same set; change both together.
fn is_word_char(c: char) -> bool {
    c.is_alphanumeric() || c == '_'
}

/// Byte ranges of the occurrences of `needle` in `text` that don't start or end inside a word. An
/// end of `needle` that isn't a word character (as in "C++") needs no word boundary.
pub fn whole_word_matches<'a>(
    text: &'a str,
    needle: &'a str,
) -> impl Iterator<Item = (usize, usize)> + 'a {
    let starts_word = needle.chars().next().is_some_and(is_word_char);
    let ends_word = needle.chars().next_back().is_some_and(is_word_char);
    text.match_indices(needle)
        .map(|(start, found)| (start, start + found.len()))
        .filter(move |&(start, end)| {
            (!starts_word || !text[..start].chars().next_back().is_some_and(is_word_char))
                && (!ends_word || !text[end..].chars().next().is_some_and(is_word_char))
        })
}

/// Whether byte offset `at` of `html` falls inside a tag (`<a href="…">`).
pub fn is_inside_tag(html: &str, at: usize) -> bool {
    let before = &html[..at];
    match (before.rfind('<'), before.rfind('>')) {
        (Some(open), Some(close)) => open > close,
        (Some(_), None) => true,
        _ => false,
    }
}

/// Whether byte offset `at` falls after the `&` of a character reference such as `&amp;` and at or
/// before its `;`.
pub fn is_inside_character_reference(html: &str, at: usize) -> bool {
    let Some(ampersand) = html[..at].rfind('&') else {
        return false;
    };
    let reference = &html[ampersand + 1..];
    reference.find(';').is_some_and(|end| {
        ampersand + 1 + end >= at
            && !reference[..end].is_empty()
            && reference[..end]
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '#')
    })
}

/// Inline elements still open at byte offset `at`, outermost first.
pub fn open_tags_at(html: &str, at: usize) -> Vec<String> {
    let mut open: Vec<String> = Vec::new();
    for tag in HTML_TAG_REGEX.find_iter(&html[..at]) {
        let inner = tag.as_str().trim_start_matches('<').trim_end_matches('>');
        if inner.ends_with('/') {
            continue;
        }
        let name: String = inner
            .trim_start_matches('/')
            .chars()
            .take_while(|c| c.is_ascii_alphanumeric())
            .collect::<String>()
            .to_lowercase();
        if name.is_empty() || name == "br" || name == "img" {
            continue;
        }
        if inner.starts_with('/') {
            if let Some(pos) = open.iter().rposition(|t| *t == name) {
                open.truncate(pos);
            }
        } else {
            open.push(name);
        }
    }
    open
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_text_strips_markup_and_entities() {
        assert_eq!(
            plain_text("Use <code>for</code> &amp;  <em>iterate</em>."),
            "Use for & iterate."
        );
        assert_eq!(
            plain_text(" One\ttwo\n\nthree  four "),
            "One two three four"
        );
        assert!(matches!(plain_text("One two"), Cow::Borrowed(_)));
    }

    #[test]
    fn preview_cuts_at_word_boundary() {
        let text = "A function that calls itself is called recursive, and recursion is everywhere";
        let cut = preview(text, 50);
        assert!(cut.ends_with('…'));
        assert!(cut.chars().count() <= 51);
        assert!(!cut.contains("recursion is"));
    }

    #[test]
    fn preview_counts_characters_in_finnish_text() {
        let text = "Äänestäjät äänestävät pääministeriehdokkaasta";
        assert_eq!(preview(text, 20), "Äänestäjät äänestävä…");
        assert_eq!(preview(text, 30), "Äänestäjät äänestävät…");
    }

    #[test]
    fn tag_balance() {
        let html = "One <em>two three</em> four <a href=\"x\">five</a>";
        assert_eq!(
            open_tags_at(html, html.find("three").unwrap_or(0)),
            vec!["em"]
        );
        assert!(open_tags_at(html, html.find("four").unwrap_or(0)).is_empty());
        assert!(is_inside_tag(html, html.find("href").unwrap_or(0)));
        assert!(!is_inside_tag(html, html.find("five").unwrap_or(0)));
    }
}
