//! Renders email bodies, stored as the Gutenberg blocks the CMS email editor saves, into the HTML and
//! plain-text parts of a message.

use std::collections::HashMap;

use once_cell::sync::Lazy;
use regex::{Captures, Regex};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

static ALL_TAG_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"<.+?>").expect("invalid all_tags regex"));
static LINK_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?s)<a\s[^>]*?href="([^"]*)"[^>]*>(.*?)</a>"#).expect("invalid link regex")
});
static WHITESPACE_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\s+").expect("invalid whitespace regex"));
static PLACEHOLDER_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\{\{(\w+)\}\}").expect("invalid placeholder regex"));
static LAYOUT_PLACEHOLDER_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\{\{(CONTENT|SUBJECT|PREHEADER|LANGUAGE)\}\}")
        .expect("invalid layout_placeholder regex")
});

/// The shell used when no `email_layouts` row is live.
pub const DEFAULT_EMAIL_LAYOUT: &str = include_str!("email_layout_default.html");

/// Block types an email body may contain; must match `allowedEmailCoreBlocks` in the CMS. Any other
/// type fails deserialization, so a body is never sent with a block silently left out.
#[derive(Debug, Deserialize, Serialize, PartialEq, Eq, Clone, Copy)]
pub enum EmailBlockName {
    #[serde(rename = "core/paragraph")]
    Paragraph,
    #[serde(rename = "core/heading")]
    Heading,
    #[serde(rename = "core/image")]
    Image,
    #[serde(rename = "core/list")]
    List,
    #[serde(rename = "core/list-item")]
    ListItem,
    #[serde(rename = "core/table")]
    Table,
    #[serde(rename = "core/buttons")]
    Buttons,
    #[serde(rename = "core/button")]
    Button,
}

/// One block of an email body. String attributes holding rich text (`content`, `text`, `caption`,
/// table cells) are HTML; `url` and `href` are plain.
#[derive(Debug, Deserialize, Serialize, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EmailGutenbergBlock {
    pub name: EmailBlockName,
    #[serde(default)]
    pub attributes: Map<String, Value>,
    #[serde(default)]
    pub inner_blocks: Vec<EmailGutenbergBlock>,
}

impl EmailGutenbergBlock {
    fn str_attribute(&self, key: &str) -> &str {
        self.attributes
            .get(key)
            .and_then(Value::as_str)
            .unwrap_or_default()
    }

    fn table_rows(&self, section: &str) -> Vec<Vec<(&str, &str)>> {
        let Some(Value::Array(rows)) = self.attributes.get(section) else {
            return vec![];
        };
        rows.iter()
            .map(|row| {
                row.get("cells")
                    .and_then(Value::as_array)
                    .map(|cells| {
                        cells
                            .iter()
                            .map(|cell| {
                                let content = cell
                                    .get("content")
                                    .and_then(Value::as_str)
                                    .unwrap_or_default();
                                let tag = match cell.get("tag").and_then(Value::as_str) {
                                    Some("th") => "th",
                                    _ => "td",
                                };
                                (tag, content)
                            })
                            .collect()
                    })
                    .unwrap_or_default()
            })
            .collect()
    }
}

/// Replaces `{{KEY}}` in every string attribute, nested blocks included. Values are HTML-escaped
/// except in `url` and `href`, which are plain text.
pub fn fill_placeholders(
    blocks: &mut [EmailGutenbergBlock],
    replacements: &HashMap<String, String>,
) {
    for block in blocks {
        for (key, value) in block.attributes.iter_mut() {
            let is_plain = key == "url" || key == "href";
            fill_placeholders_in_value(value, replacements, is_plain);
        }
        fill_placeholders(&mut block.inner_blocks, replacements);
    }
}

fn fill_placeholders_in_value(
    value: &mut Value,
    replacements: &HashMap<String, String>,
    is_plain: bool,
) {
    match value {
        Value::String(text) => {
            let filled = PLACEHOLDER_REGEX.replace_all(text, |caps: &Captures| match replacements
                .get(&caps[1])
            {
                Some(replacement) if is_plain => replacement.clone(),
                Some(replacement) => escape_html(replacement),
                None => caps[0].to_string(),
            });
            if let std::borrow::Cow::Owned(filled) = filled {
                *text = filled;
            }
        }
        Value::Array(values) => values
            .iter_mut()
            .for_each(|v| fill_placeholders_in_value(v, replacements, is_plain)),
        Value::Object(fields) => fields
            .values_mut()
            .for_each(|v| fill_placeholders_in_value(v, replacements, is_plain)),
        _ => {}
    }
}

pub fn process_content_to_html(blocks: &[EmailGutenbergBlock]) -> String {
    blocks.iter().map(block_to_html).collect()
}

fn block_to_html(block: &EmailGutenbergBlock) -> String {
    match block.name {
        EmailBlockName::Paragraph => format!("<p>{}</p>", block.str_attribute("content")),
        EmailBlockName::Heading => {
            let level = block
                .attributes
                .get("level")
                .and_then(Value::as_u64)
                .filter(|level| (1..=6).contains(level))
                .unwrap_or(2);
            format!("<h{level}>{}</h{level}>", block.str_attribute("content"))
        }
        EmailBlockName::Image => {
            let img = format!(
                r#"<img src="{}" alt="{}">"#,
                escape_html(block.str_attribute("url")),
                escape_html(block.str_attribute("alt"))
            );
            match block.str_attribute("href") {
                "" => img,
                href => format!(r#"<a href="{}">{img}</a>"#, escape_html(href)),
            }
        }
        EmailBlockName::List => {
            let tag = if is_ordered(block) { "ol" } else { "ul" };
            format!(
                "<{tag}>{}</{tag}>",
                process_content_to_html(&block.inner_blocks)
            )
        }
        EmailBlockName::ListItem => format!(
            "<li>{}{}</li>",
            block.str_attribute("content"),
            process_content_to_html(&block.inner_blocks)
        ),
        EmailBlockName::Table => {
            let section = |name: &str, tag: &str| {
                let rows = block.table_rows(name);
                if rows.is_empty() {
                    return String::new();
                }
                let rows: String = rows
                    .iter()
                    .map(|cells| {
                        let cells: String = cells
                            .iter()
                            .map(|(cell_tag, content)| {
                                format!("<{cell_tag}>{content}</{cell_tag}>")
                            })
                            .collect();
                        format!("<tr>{cells}</tr>")
                    })
                    .collect();
                format!("<{tag}>{rows}</{tag}>")
            };
            let caption = match block.str_attribute("caption") {
                "" => String::new(),
                caption => format!("<caption>{caption}</caption>"),
            };
            format!(
                "<table>{caption}{}{}{}</table>",
                section("head", "thead"),
                section("body", "tbody"),
                section("foot", "tfoot")
            )
        }
        EmailBlockName::Buttons => format!(
            r#"<div class="email-buttons">{}</div>"#,
            process_content_to_html(&block.inner_blocks)
        ),
        // A table cell with bgcolor, not a styled link alone: Outlook desktop drops padding and
        // background on <a>. The inline colours are the fallback for clients that strip <style>; a
        // shell restyles the button by targeting these classes with !important.
        EmailBlockName::Button => format!(
            r##"<table role="presentation" class="email-button" cellpadding="0" cellspacing="0" border="0"><tr><td class="email-button-cell" bgcolor="#1d4ed8" style="border-radius: 6px;"><a class="email-button-link" href="{}" style="display: inline-block; padding: 12px 24px; font-weight: 600; color: #ffffff; text-decoration: none;">{}</a></td></tr></table>"##,
            escape_html(block.str_attribute("url")),
            block.str_attribute("text")
        ),
    }
}

pub fn process_content_to_plaintext(blocks: &[EmailGutenbergBlock]) -> String {
    blocks
        .iter()
        .map(block_to_plaintext)
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn block_to_plaintext(block: &EmailGutenbergBlock) -> String {
    match block.name {
        EmailBlockName::Paragraph | EmailBlockName::Heading => {
            html_to_text(block.str_attribute("content"))
        }
        EmailBlockName::Image => {
            let alt = block.str_attribute("alt").replace('"', "");
            format!("\"{}\", <{}>", alt, block.str_attribute("url"))
        }
        EmailBlockName::List | EmailBlockName::ListItem => list_to_plaintext(block, 0),
        EmailBlockName::Table => {
            let mut lines = vec![];
            let caption = html_to_text(block.str_attribute("caption"));
            if !caption.is_empty() {
                lines.push(caption);
            }
            for section in ["head", "body", "foot"] {
                for cells in block.table_rows(section) {
                    let cells: Vec<String> = cells
                        .iter()
                        .map(|(_, content)| html_to_text(content))
                        .collect();
                    lines.push(cells.join(" | "));
                }
            }
            lines.join("\n")
        }
        EmailBlockName::Buttons => block
            .inner_blocks
            .iter()
            .map(block_to_plaintext)
            .collect::<Vec<_>>()
            .join("\n"),
        EmailBlockName::Button => format!(
            "{}: {}",
            html_to_text(block.str_attribute("text")),
            block.str_attribute("url")
        ),
    }
}

fn list_to_plaintext(list: &EmailGutenbergBlock, depth: usize) -> String {
    let indent = "  ".repeat(depth);
    let is_ordered = is_ordered(list);
    let mut lines = vec![];
    for (index, item) in list.inner_blocks.iter().enumerate() {
        let marker = if is_ordered {
            format!("{}.", index + 1)
        } else {
            "*".to_string()
        };
        lines.push(format!(
            "{indent}{marker} {}",
            html_to_text(item.str_attribute("content"))
        ));
        for nested in &item.inner_blocks {
            lines.push(list_to_plaintext(nested, depth + 1));
        }
    }
    lines.join("\n")
}

fn is_ordered(list: &EmailGutenbergBlock) -> bool {
    list.attributes
        .get("ordered")
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

/// The inbox preview: the first paragraph as one line of text, or empty when there is none.
pub fn preheader(blocks: &[EmailGutenbergBlock]) -> String {
    blocks
        .iter()
        .find(|block| block.name == EmailBlockName::Paragraph)
        .map(|block| {
            let text = html_to_text(block.str_attribute("content"));
            WHITESPACE_REGEX.replace_all(&text, " ").into_owned()
        })
        .unwrap_or_default()
}

/// Rich text to plain text. A link keeps its target, since the plain-text part has no other way to
/// show it.
fn html_to_text(html: &str) -> String {
    let with_links = LINK_REGEX.replace_all(html, |caps: &Captures| {
        let href = &caps[1];
        let text = ALL_TAG_REGEX.replace_all(&caps[2], "");
        if text.trim() == href || text.trim().is_empty() {
            href.to_string()
        } else {
            format!("{text} ({href})")
        }
    });
    let with_breaks = with_links.replace("<br>", "\n");
    let text = ALL_TAG_REGEX.replace_all(&with_breaks, "");
    decode_html_entities(&text).trim().to_string()
}

fn decode_html_entities(text: &str) -> String {
    text.replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
}

/// What a shell's placeholders are filled with.
pub struct EmailLayoutFields<'a> {
    /// Rendered body HTML, inserted as is.
    pub content_html: &'a str,
    pub subject: &'a str,
    pub preheader: &'a str,
    /// BCP 47 tag for `lang`; empty when unknown.
    pub language: &'a str,
}

/// Wraps a rendered body in an email shell: `{{CONTENT}}` gets the body as is, `{{SUBJECT}}`,
/// `{{PREHEADER}}` and `{{LANGUAGE}}` their escaped values. One pass, so placeholders inside the body
/// are never expanded.
pub fn wrap_in_layout(layout_html: &str, fields: &EmailLayoutFields) -> String {
    LAYOUT_PLACEHOLDER_REGEX
        .replace_all(layout_html, |caps: &Captures| match &caps[1] {
            "CONTENT" => fields.content_html.to_string(),
            "SUBJECT" => escape_html(fields.subject),
            "PREHEADER" => escape_html(fields.preheader),
            _ => escape_html(fields.language),
        })
        .into_owned()
}

fn escape_html(text: &str) -> String {
    let mut escaped = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&#39;"),
            _ => escaped.push(c),
        }
    }
    escaped
}

#[cfg(test)]
mod email_processor_tests {
    use pretty_assertions::assert_eq;
    use serde_json::json;

    use super::*;

    fn blocks(value: Value) -> Vec<EmailGutenbergBlock> {
        serde_json::from_value(value).unwrap()
    }

    fn paragraph(content: &str) -> Value {
        json!({ "name": "core/paragraph", "attributes": { "content": content, "dropCap": false }, "innerBlocks": [] })
    }

    fn list(ordered: bool, items: &[&str]) -> Value {
        let items: Vec<Value> = items
            .iter()
            .map(|item| json!({ "name": "core/list-item", "attributes": { "content": item }, "innerBlocks": [] }))
            .collect();
        json!({ "name": "core/list", "attributes": { "ordered": ordered }, "innerBlocks": items })
    }

    #[test]
    fn it_converts_paragraph_correctly_to_plain_text() {
        let input = blocks(json!([paragraph("testi paragraph.")]));
        assert_eq!("testi paragraph.", process_content_to_plaintext(&input));
    }

    #[test]
    fn it_converts_paragraph_wrapped_in_tags_correctly_to_plain_text() {
        let input = blocks(json!([paragraph(
            "<strong><em>testi paragraph.</em></strong>"
        )]));
        assert_eq!("testi paragraph.", process_content_to_plaintext(&input));
    }

    #[test]
    fn it_converts_heading_correctly_to_plain_text() {
        let input = blocks(
            json!([{ "name": "core/heading", "attributes": { "content": "Email heading", "level": 2 } }]),
        );
        assert_eq!("Email heading", process_content_to_plaintext(&input));
    }

    #[test]
    fn it_converts_image_containing_double_quotes_correctly_to_plain_text() {
        let input = blocks(
            json!([{ "name": "core/image", "attributes": { "alt": r#""Alternative title""#, "url": "URL -of an image" } }]),
        );
        assert_eq!(
            "\"Alternative title\", <URL -of an image>",
            process_content_to_plaintext(&input)
        );
    }

    #[test]
    fn it_converts_unordered_list_containing_other_tags_correctly_to_plain_text() {
        let input = blocks(json!([list(
            false,
            &["<code>1</code>", "<kbd>2</kbd>", "3"]
        )]));
        assert_eq!("* 1\n* 2\n* 3", process_content_to_plaintext(&input));
    }

    #[test]
    fn it_converts_ordered_list_correctly_to_plain_text() {
        let input = blocks(json!([list(true, &["first", "second", "third"])]));
        assert_eq!(
            "1. first\n2. second\n3. third",
            process_content_to_plaintext(&input)
        );
    }

    #[test]
    fn it_converts_paragraph_correctly_to_html() {
        let input = blocks(json!([paragraph("testi paragraph.")]));
        assert_eq!("<p>testi paragraph.</p>", process_content_to_html(&input));
    }

    #[test]
    fn it_converts_heading_correctly_to_html() {
        let input = blocks(
            json!([{ "name": "core/heading", "attributes": { "content": "Email heading", "level": 3 } }]),
        );
        assert_eq!("<h3>Email heading</h3>", process_content_to_html(&input));
    }

    #[test]
    fn it_converts_image_correctly_to_html() {
        let input = blocks(
            json!([{ "name": "core/image", "attributes": { "alt": "A \"title\"", "url": "https://example.com/a.png" } }]),
        );
        assert_eq!(
            r#"<img src="https://example.com/a.png" alt="A &quot;title&quot;">"#,
            process_content_to_html(&input)
        );
    }

    #[test]
    fn it_converts_lists_correctly_to_html() {
        let input = blocks(json!([
            list(false, &["<code>1</code>", "2"]),
            list(true, &["first", "second"])
        ]));
        assert_eq!(
            "<ul><li><code>1</code></li><li>2</li></ul><ol><li>first</li><li>second</li></ol>",
            process_content_to_html(&input)
        );
    }
}
