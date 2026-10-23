//! Text helpers shared by the engines: markup stripping, previews, slugs and tag balance.

use std::sync::LazyLock;

use regex::Regex;

static TAG: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"<[^>]*>").expect("valid regex"));
static ENTITY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"&(amp|lt|gt|quot|#39|nbsp);").expect("valid regex"));
static WHITESPACE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\s+").expect("valid regex"));

/// The visible text of a rich-text string: tags removed, common entities decoded, whitespace collapsed.
pub fn plain_text(html: &str) -> String {
    let without_tags = TAG.replace_all(html, "");
    let decoded = ENTITY.replace_all(&without_tags, |caps: &regex::Captures| {
        match &caps[1] {
            "amp" => "&",
            "lt" => "<",
            "gt" => ">",
            "quot" => "\"",
            "#39" => "'",
            _ => " ",
        }
        .to_string()
    });
    WHITESPACE.replace_all(decoded.trim(), " ").into_owned()
}

/// Cuts `text` to at most `max_chars` characters at a word boundary, adding an ellipsis when cut.
pub fn preview(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let cut: String = text.chars().take(max_chars).collect();
    let at_word = match cut.rfind(' ') {
        Some(space) if space > max_chars * 2 / 3 => cut[..space].to_string(),
        _ => cut,
    };
    format!("{}…", at_word.trim_end())
}

/// URL slug of a title: lowercase ASCII letters, digits and single dashes; Finnish and Swedish
/// letters folded to their base letter.
pub fn slugify(title: &str) -> String {
    let mut slug = String::new();
    let mut pending_dash = false;
    for c in title.chars().flat_map(char::to_lowercase) {
        let folded = match c {
            'ä' | 'å' | 'á' | 'à' | 'â' => Some('a'),
            'ö' | 'ó' | 'ò' | 'ô' | 'ø' => Some('o'),
            'é' | 'è' | 'ê' | 'ë' => Some('e'),
            'ü' | 'ú' | 'ù' | 'û' => Some('u'),
            'í' | 'ì' | 'î' | 'ï' => Some('i'),
            c if c.is_ascii_alphanumeric() => Some(c),
            _ => None,
        };
        match folded {
            Some(c) => {
                if pending_dash && !slug.is_empty() {
                    slug.push('-');
                }
                pending_dash = false;
                slug.push(c);
            }
            None => pending_dash = true,
        }
    }
    if slug.is_empty() {
        "page".to_string()
    } else {
        slug
    }
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

/// Inline elements still open at byte offset `at`, outermost first.
pub fn open_tags_at(html: &str, at: usize) -> Vec<String> {
    let mut open: Vec<String> = Vec::new();
    for tag in TAG.find_iter(&html[..at]) {
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
    fn slugify_folds_and_dashes() {
        assert_eq!(slugify("Muuttujat ja tyypit!"), "muuttujat-ja-tyypit");
        assert_eq!(slugify("Äidinkieli & Öljy"), "aidinkieli-oljy");
        assert_eq!(slugify("  "), "page");
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
