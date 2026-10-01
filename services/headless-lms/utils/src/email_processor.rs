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
static IMG_TAG_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?is)<img\b[^>]*>").expect("invalid img_tag regex"));
static SRC_ATTRIBUTE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?is)\ssrc\s*=\s*["']?([^"'\s>]*)"#).expect("invalid src_attribute regex")
});

/// The shell used when no `email_layouts` row applies.
pub const DEFAULT_EMAIL_LAYOUT: &str = include_str!("email_layout_default.html");

/// Colours the renderer writes inline, as `#RRGGBB`. Outlook desktop and clients that strip
/// `<style>` read only these, so a shell's CSS alone cannot rebrand them.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EmailTheme<'a> {
    pub button_background_color: &'a str,
    pub button_text_color: &'a str,
}

/// The theme of `DEFAULT_EMAIL_LAYOUT`. Must match the column defaults of `email_layouts`.
pub const DEFAULT_EMAIL_THEME: EmailTheme<'static> = EmailTheme {
    button_background_color: "#1F6964",
    button_text_color: "#FFFFFF",
};

/// Where the images the renderer links to are served from: `services/main-frontend/public/static/email`.
/// Sent emails keep linking to these files, so they must never be renamed or removed.
const EMAIL_ASSET_BASE_URL: &str = "https://courses.mooc.fi/static/email";

const CALLOUT_BACKGROUND_COLOR: &str = "#EDF3F2";
const CALLOUT_BORDER_COLOR: &str = "#DAE6E5";

/// Block types an email body may contain; must match `allowedEmailCoreBlocks` and
/// `blockTypeMapForEmails` in the CMS. Any other type fails deserialization, so a body is never sent
/// with a block silently left out.
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
    #[serde(rename = "core/quote")]
    Quote,
    #[serde(rename = "core/separator")]
    Separator,
    #[serde(rename = "core/spacer")]
    Spacer,
    #[serde(rename = "core/code")]
    Code,
    #[serde(rename = "moocfi/email-callout")]
    Callout,
}

const DEFAULT_SPACER_HEIGHT_PX: u32 = 32;
const MAX_SPACER_HEIGHT_PX: f64 = 160.0;

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

    /// Whether the author picked the block style `name`, which Gutenberg records in `className`.
    fn has_style(&self, name: &str) -> bool {
        self.str_attribute("className")
            .split_whitespace()
            .any(|class| class.strip_prefix("is-style-") == Some(name))
    }

    /// Spacer height in px; Gutenberg stores it as a string like "100px", old content as a number.
    fn spacer_height_px(&self) -> u32 {
        let height = match self.attributes.get("height") {
            Some(Value::Number(number)) => number.as_f64(),
            Some(Value::String(text)) => text.trim().trim_end_matches("px").trim().parse().ok(),
            _ => None,
        };
        height
            .filter(|height| height.is_finite())
            .map(|height| height.clamp(0.0, MAX_SPACER_HEIGHT_PX).round() as u32)
            .unwrap_or(DEFAULT_SPACER_HEIGHT_PX)
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

/// Renders a body into the HTML a shell's `{{CONTENT}}` is replaced with.
pub fn process_content_to_html(blocks: &[EmailGutenbergBlock], theme: EmailTheme) -> String {
    blocks
        .iter()
        .map(|block| block_to_html(block, theme))
        .collect()
}

fn block_to_html(block: &EmailGutenbergBlock, theme: EmailTheme) -> String {
    match block.name {
        // Inline, not `h1 + p` in the shell: Gmail and Outlook ignore sibling selectors.
        EmailBlockName::Paragraph if block.has_style("lead") => format!(
            r#"<p class="email-lead" style="font-size: 18px; line-height: 28px;">{}</p>"#,
            block.str_attribute("content")
        ),
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
            let img = match block.str_attribute("href") {
                "" => img,
                href => format!(r#"<a href="{}">{img}</a>"#, escape_html(href)),
            };
            match block.str_attribute("caption") {
                "" => img,
                caption => format!(
                    r#"<div class="email-image">{img}<p class="email-image-caption">{caption}</p></div>"#
                ),
            }
        }
        EmailBlockName::List => {
            let tag = if is_ordered(block) { "ol" } else { "ul" };
            format!(
                "<{tag}>{}</{tag}>",
                process_content_to_html(&block.inner_blocks, theme)
            )
        }
        EmailBlockName::ListItem => format!(
            "<li>{}{}</li>",
            block.str_attribute("content"),
            process_content_to_html(&block.inner_blocks, theme)
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
            process_content_to_html(&block.inner_blocks, theme)
        ),
        // A table cell with bgcolor, not a styled link alone: Outlook desktop drops padding and
        // background on <a>. The arrow is text because Gmail and Outlook drop CSS `::after`.
        EmailBlockName::Button => format!(
            r#"<table role="presentation" class="email-button" cellpadding="0" cellspacing="0" border="0"><tr><td class="email-button-cell" bgcolor="{background}" style="background-color: {background}; border-radius: 6px;"><a class="email-button-link" href="{}" style="display: inline-block; padding: 14px 26px; font-size: 16px; line-height: 20px; font-weight: 600; color: {text}; text-decoration: none;">{}{}</a></td></tr></table>"#,
            escape_html(block.str_attribute("url")),
            block.str_attribute("text"),
            if block.has_style("arrow") {
                "&nbsp;&rarr;"
            } else {
                ""
            },
            background = escape_html(theme.button_background_color),
            text = escape_html(theme.button_text_color),
        ),
        EmailBlockName::Quote => {
            let citation = match block.str_attribute("citation") {
                "" => String::new(),
                citation => format!("<cite>{citation}</cite>"),
            };
            format!(
                "<blockquote>{}{}{citation}</blockquote>",
                process_content_to_html(&block.inner_blocks, theme),
                if block.inner_blocks.is_empty() {
                    block.str_attribute("value")
                } else {
                    ""
                }
            )
        }
        // Tables, not <hr> or a sized <div>: Outlook desktop ignores their borders, heights and margins.
        EmailBlockName::Separator => r##"<table role="presentation" class="email-separator" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" style="height: 1px; font-size: 1px; line-height: 1px; mso-line-height-rule: exactly; border-top: 1px solid #DDDEE0;">&nbsp;</td></tr></table>"##.to_string(),
        EmailBlockName::Spacer => {
            let height = block.spacer_height_px();
            format!(
                r#"<table role="presentation" class="email-spacer" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="{height}" style="height: {height}px; font-size: {height}px; line-height: {height}px; mso-line-height-rule: exactly; padding: 0; border: 0;">&nbsp;</td></tr></table>"#
            )
        }
        EmailBlockName::Code => format!(
            "<pre class=\"email-code\"><code>{}</code></pre>",
            block.str_attribute("content").replace("<br>", "\n")
        ),
        EmailBlockName::Callout => {
            let icon_cell = match callout_icon_file(block.str_attribute("icon")) {
                Some(file) => format!(
                    r#"<td class="email-callout-icon" width="24" valign="top" style="width: 24px; padding: 20px 0 20px 20px; border: 0;"><img src="{EMAIL_ASSET_BASE_URL}/{file}" width="24" height="24" alt="" style="display: block; width: 24px; height: 24px; margin: 1px 0 0; border: 0; border-radius: 0;"></td>"#
                ),
                None => String::new(),
            };
            let body_padding = if icon_cell.is_empty() {
                "20px"
            } else {
                "20px 20px 20px 14px"
            };
            let title = match block.str_attribute("title") {
                "" => String::new(),
                title => format!(
                    r#"<p class="email-callout-title" style="margin: 0 0 6px;"><strong>{title}</strong></p>"#
                ),
            };
            format!(
                r#"<table role="presentation" class="email-callout" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{CALLOUT_BACKGROUND_COLOR}" style="width: 100%; background-color: {CALLOUT_BACKGROUND_COLOR}; border: 1px solid {CALLOUT_BORDER_COLOR}; border-radius: 8px; border-collapse: separate;"><tr>{icon_cell}<td class="email-callout-body" valign="top" style="padding: {body_padding}; border: 0;">{title}{}</td></tr></table>"#,
                process_content_to_html(&block.inner_blocks, theme)
            )
        }
    }
}

/// The hosted PNG for a callout's `icon` attribute; `None` for "none" and unknown values.
fn callout_icon_file(icon: &str) -> Option<&'static str> {
    match icon {
        "info" => Some("icon-info.png"),
        "calendar" => Some("icon-calendar.png"),
        "warning" => Some("icon-warning.png"),
        "check" => Some("icon-check.png"),
        _ => None,
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
            let image = format!("\"{}\", <{}>", alt, block.str_attribute("url"));
            match html_to_text(block.str_attribute("caption")).as_str() {
                "" => image,
                caption => format!("{image}\n{caption}"),
            }
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
        EmailBlockName::Quote => {
            let body = if block.inner_blocks.is_empty() {
                html_to_text(&block.str_attribute("value").replace("</p>", "\n"))
            } else {
                process_content_to_plaintext(&block.inner_blocks)
            };
            let mut lines: Vec<String> = body
                .lines()
                .map(|line| format!("> {line}").trim_end().to_string())
                .collect();
            let citation = html_to_text(block.str_attribute("citation"));
            if !citation.is_empty() {
                lines.push(format!("— {citation}"));
            }
            lines.join("\n")
        }
        EmailBlockName::Separator => "---".to_string(),
        EmailBlockName::Spacer => String::new(),
        EmailBlockName::Code => html_to_text(block.str_attribute("content"))
            .lines()
            .map(|line| format!("    {line}").trim_end().to_string())
            .collect::<Vec<_>>()
            .join("\n"),
        EmailBlockName::Callout => [
            html_to_text(block.str_attribute("title")),
            process_content_to_plaintext(&block.inner_blocks),
        ]
        .into_iter()
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>()
        .join("\n"),
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

/// Problems that make a shell render badly: a missing `{{SUBJECT}}`, `{{PREHEADER}}` or
/// `{{LANGUAGE}}`, or an image not loaded over https, which clients block or warn about. Empty when
/// none is found; a heuristic, not validation.
pub fn layout_warnings(layout_html: &str) -> Vec<String> {
    let mut warnings: Vec<String> = ["{{SUBJECT}}", "{{PREHEADER}}", "{{LANGUAGE}}"]
        .into_iter()
        .filter(|placeholder| !layout_html.contains(placeholder))
        .map(|placeholder| format!("missing {placeholder}"))
        .collect();
    for img in IMG_TAG_REGEX.find_iter(layout_html) {
        let src = SRC_ATTRIBUTE_REGEX
            .captures(img.as_str())
            .map(|caps| caps[1].to_string())
            .unwrap_or_default();
        if !src.to_ascii_lowercase().starts_with("https://") {
            warnings.push(format!("image source is not https: {src:?}"));
        }
    }
    warnings
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
        assert_eq!(
            "<p>testi paragraph.</p>",
            process_content_to_html(&input, DEFAULT_EMAIL_THEME)
        );
    }

    #[test]
    fn it_converts_heading_correctly_to_html() {
        let input = blocks(
            json!([{ "name": "core/heading", "attributes": { "content": "Email heading", "level": 3 } }]),
        );
        assert_eq!(
            "<h3>Email heading</h3>",
            process_content_to_html(&input, DEFAULT_EMAIL_THEME)
        );
    }

    #[test]
    fn it_converts_image_correctly_to_html() {
        let input = blocks(
            json!([{ "name": "core/image", "attributes": { "alt": "A \"title\"", "url": "https://example.com/a.png" } }]),
        );
        assert_eq!(
            r#"<img src="https://example.com/a.png" alt="A &quot;title&quot;">"#,
            process_content_to_html(&input, DEFAULT_EMAIL_THEME)
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
            process_content_to_html(&input, DEFAULT_EMAIL_THEME)
        );
    }
}
