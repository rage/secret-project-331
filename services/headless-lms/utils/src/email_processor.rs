//! Renders email bodies, stored as the Gutenberg blocks the CMS email editor saves, into the HTML and
//! plain-text parts of a message.

use std::borrow::Cow;
use std::collections::{BTreeSet, HashMap, HashSet};

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
static HREFLESS_LINK_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?s)<a>(.*?)</a>").expect("invalid hrefless_link regex"));

/// The inline formatting Gutenberg's rich text produces that email clients render.
const RICH_TEXT_TAGS: [&str; 12] = [
    "a", "strong", "b", "em", "i", "s", "sub", "sup", "code", "kbd", "br", "mark",
];
const LINK_SCHEMES: [&str; 3] = ["https", "http", "mailto"];
const IMAGE_SCHEMES: [&str; 2] = ["https", "http"];

static RICH_TEXT_SANITIZER: Lazy<ammonia::Builder<'static>> =
    Lazy::new(|| rich_text_sanitizer(&[]));
/// For the `value` of quotes saved before quotes held inner blocks, which is a run of `<p>`s.
static QUOTE_VALUE_SANITIZER: Lazy<ammonia::Builder<'static>> =
    Lazy::new(|| rich_text_sanitizer(&["p"]));

static CSS_INLINER: Lazy<css_inline::CSSInliner<'static>> = Lazy::new(|| {
    // The style tags stay for the clients that read them: media queries cannot be inlined, and
    // their `!important` rules still beat the inlined desktop values.
    css_inline::CSSInliner::options()
        .keep_style_tags(true)
        .keep_link_tags(true)
        .load_remote_stylesheets(false)
        .build()
});

/// What the CMS stores as an image's alt text until the author writes one. Must match
/// `ALT_TEXT_NOT_CHANGED_PLACEHOLDER` in `services/cms/src/services/altTextPlaceholder.ts`.
const UNCHANGED_ALT_TEXT: &str = "Add alt";

/// The width of the content column of the shells: 640px minus 40px padding on both sides.
const MAX_IMAGE_WIDTH_PX: f64 = 560.0;

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

/// One block of an email body. Rich-text attributes (see `EmailBlockName::is_rich_text_attribute`)
/// are HTML, sanitized when rendered; every other attribute is plain.
#[derive(Debug, Deserialize, Serialize, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EmailGutenbergBlock {
    pub name: EmailBlockName,
    #[serde(default)]
    pub attributes: Map<String, Value>,
    #[serde(default)]
    pub inner_blocks: Vec<EmailGutenbergBlock>,
}

impl EmailBlockName {
    /// Table sections count as rich text because their cells' `content` is.
    fn is_rich_text_attribute(self, key: &str) -> bool {
        match self {
            Self::Paragraph | Self::Heading | Self::ListItem | Self::Code => key == "content",
            Self::Image => key == "caption",
            Self::Table => matches!(key, "caption" | "head" | "body" | "foot"),
            Self::Button => key == "text",
            Self::Quote => matches!(key, "value" | "citation"),
            Self::Callout => key == "title",
            Self::List | Self::Buttons | Self::Separator | Self::Spacer => false,
        }
    }
}

struct TableCell<'a> {
    tag: &'static str,
    content: &'a str,
    colspan: Option<u32>,
    rowspan: Option<u32>,
}

impl EmailGutenbergBlock {
    fn str_attribute(&self, key: &str) -> &str {
        self.attributes
            .get(key)
            .and_then(Value::as_str)
            .unwrap_or_default()
    }

    fn rich_text(&self, key: &str) -> String {
        sanitize_rich_text(self.str_attribute(key), &RICH_TEXT_SANITIZER)
    }

    fn rich_text_as_text(&self, key: &str) -> String {
        html_to_text(&self.rich_text(key))
    }

    /// Whether the author picked the block style `name`, which Gutenberg records in `className`.
    fn has_style(&self, name: &str) -> bool {
        self.str_attribute("className")
            .split_whitespace()
            .any(|class| class.strip_prefix("is-style-") == Some(name))
    }

    /// A length in px; Gutenberg stores it as a string like "100px", old content as a number.
    fn px_attribute(&self, key: &str) -> Option<f64> {
        let px = match self.attributes.get(key) {
            Some(Value::Number(number)) => number.as_f64(),
            Some(Value::String(text)) => text.trim().trim_end_matches("px").trim().parse().ok(),
            _ => None,
        };
        px.filter(|px| px.is_finite())
    }

    fn spacer_height_px(&self) -> u32 {
        self.px_attribute("height")
            .map(|height| height.clamp(0.0, MAX_SPACER_HEIGHT_PX).round() as u32)
            .unwrap_or(DEFAULT_SPACER_HEIGHT_PX)
    }

    /// The width an image is shown at: the author's, but never wider than the content column.
    /// Without one the image fills the column.
    fn image_width_px(&self) -> u32 {
        self.px_attribute("width")
            .filter(|width| *width >= 1.0)
            .unwrap_or(MAX_IMAGE_WIDTH_PX)
            .min(MAX_IMAGE_WIDTH_PX)
            .round() as u32
    }

    fn image_alt(&self) -> &str {
        match self.str_attribute("alt").trim() {
            UNCHANGED_ALT_TEXT => "",
            alt => alt,
        }
    }

    fn table_rows(&self, section: &str) -> Vec<Vec<TableCell<'_>>> {
        let Some(Value::Array(rows)) = self.attributes.get(section) else {
            return vec![];
        };
        let span = |cell: &Value, key: &str| {
            let span = match cell.get(key)? {
                Value::Number(number) => number.as_u64(),
                Value::String(text) => text.trim().parse().ok(),
                _ => None,
            }?;
            u32::try_from(span).ok().filter(|span| *span > 1)
        };
        rows.iter()
            .map(|row| {
                row.get("cells")
                    .and_then(Value::as_array)
                    .map(|cells| {
                        cells
                            .iter()
                            .map(|cell| TableCell {
                                tag: match cell.get("tag").and_then(Value::as_str) {
                                    Some("th") => "th",
                                    _ => "td",
                                },
                                content: cell
                                    .get("content")
                                    .and_then(Value::as_str)
                                    .unwrap_or_default(),
                                colspan: span(cell, "colspan"),
                                rowspan: span(cell, "rowspan"),
                            })
                            .collect()
                    })
                    .unwrap_or_default()
            })
            .collect()
    }

    /// Its items' numbers if ordered, honouring `start` and `reversed` like a browser does.
    fn list_item_numbers(&self) -> impl Iterator<Item = i64> + '_ {
        let count = self.inner_blocks.len() as i64;
        let is_reversed = self.is_reversed();
        let start = self
            .attributes
            .get("start")
            .and_then(Value::as_i64)
            .unwrap_or(if is_reversed { count } else { 1 });
        (0..count).map(move |index| {
            if is_reversed {
                start - index
            } else {
                start + index
            }
        })
    }

    fn is_ordered(&self) -> bool {
        self.attributes
            .get("ordered")
            .and_then(Value::as_bool)
            .unwrap_or(false)
    }

    fn is_reversed(&self) -> bool {
        self.attributes
            .get("reversed")
            .and_then(Value::as_bool)
            .unwrap_or(false)
    }
}

fn rich_text_sanitizer(extra_tags: &[&'static str]) -> ammonia::Builder<'static> {
    let mut sanitizer = ammonia::Builder::empty();
    sanitizer
        .tags(RICH_TEXT_TAGS.iter().chain(extra_tags).copied().collect())
        .generic_attributes(HashSet::new())
        .tag_attributes(HashMap::from([("a", HashSet::from(["href"]))]))
        .url_schemes(HashSet::from(LINK_SCHEMES))
        .url_relative(ammonia::UrlRelative::Deny)
        .link_rel(None);
    sanitizer
}

fn sanitize_rich_text(html: &str, sanitizer: &ammonia::Builder) -> String {
    let sanitized = sanitizer.clean(html).to_string();
    // A link whose target was rejected loses only its href; unwrap it so it does not look like one.
    HREFLESS_LINK_REGEX
        .replace_all(&sanitized, "$1")
        .into_owned()
}

/// `url` trimmed, if it is absolute with one of `schemes`.
fn url_with_scheme<'a>(url: &'a str, schemes: &[&str]) -> Option<&'a str> {
    let url = url.trim();
    let (scheme, _) = url.split_once(':')?;
    schemes
        .iter()
        .any(|allowed| scheme.eq_ignore_ascii_case(allowed))
        .then_some(url)
}

/// Replaces `{{KEY}}` in every attribute, nested blocks included. Values are HTML-escaped in rich
/// text and inserted as is elsewhere. Returns the keys found that `replacements` has no value for;
/// those are left in place.
pub fn fill_placeholders(
    blocks: &mut [EmailGutenbergBlock],
    replacements: &HashMap<String, String>,
) -> BTreeSet<String> {
    let mut unfilled = BTreeSet::new();
    fill_placeholders_in_blocks(blocks, replacements, &mut unfilled);
    unfilled
}

fn fill_placeholders_in_blocks(
    blocks: &mut [EmailGutenbergBlock],
    replacements: &HashMap<String, String>,
    unfilled: &mut BTreeSet<String>,
) {
    for block in blocks {
        for (key, value) in block.attributes.iter_mut() {
            let is_html = block.name.is_rich_text_attribute(key);
            fill_placeholders_in_value(value, replacements, is_html, unfilled);
        }
        fill_placeholders_in_blocks(&mut block.inner_blocks, replacements, unfilled);
    }
}

fn fill_placeholders_in_value(
    value: &mut Value,
    replacements: &HashMap<String, String>,
    is_html: bool,
    unfilled: &mut BTreeSet<String>,
) {
    match value {
        Value::String(text) => {
            if let Cow::Owned(filled) =
                fill_placeholders_in_text(text, replacements, is_html, unfilled)
            {
                *text = filled;
            }
        }
        Value::Array(values) => values
            .iter_mut()
            .for_each(|v| fill_placeholders_in_value(v, replacements, is_html, unfilled)),
        Value::Object(fields) => fields
            .values_mut()
            .for_each(|v| fill_placeholders_in_value(v, replacements, is_html, unfilled)),
        _ => {}
    }
}

fn fill_placeholders_in_text<'a>(
    text: &'a str,
    replacements: &HashMap<String, String>,
    is_html: bool,
    unfilled: &mut BTreeSet<String>,
) -> Cow<'a, str> {
    PLACEHOLDER_REGEX.replace_all(text, |caps: &Captures| match replacements.get(&caps[1]) {
        Some(replacement) if is_html => escape_html(replacement),
        Some(replacement) => replacement.clone(),
        None => {
            unfilled.insert(caps[1].to_string());
            caps[0].to_string()
        }
    })
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
            block.rich_text("content")
        ),
        EmailBlockName::Paragraph => format!("<p>{}</p>", block.rich_text("content")),
        EmailBlockName::Heading => {
            let level = block
                .attributes
                .get("level")
                .and_then(Value::as_u64)
                .filter(|level| (1..=6).contains(level))
                .unwrap_or(2);
            format!("<h{level}>{}</h{level}>", block.rich_text("content"))
        }
        EmailBlockName::Image => {
            // The width attribute is for Outlook desktop, which ignores CSS widths on images.
            let img = match url_with_scheme(block.str_attribute("url"), &IMAGE_SCHEMES) {
                Some(src) => {
                    let width = block.image_width_px();
                    format!(
                        r#"<img src="{}" alt="{}" width="{width}" style="width: 100%; max-width: {width}px; height: auto;">"#,
                        escape_html(src),
                        escape_html(block.image_alt())
                    )
                }
                None => String::new(),
            };
            let img = match url_with_scheme(block.str_attribute("href"), &LINK_SCHEMES) {
                Some(href) if !img.is_empty() => {
                    format!(r#"<a href="{}">{img}</a>"#, escape_html(href))
                }
                _ => img,
            };
            match block.rich_text("caption").as_str() {
                "" => img,
                caption => format!(
                    r#"<div class="email-image">{img}<p class="email-image-caption">{caption}</p></div>"#
                ),
            }
        }
        EmailBlockName::List => {
            let items = process_content_to_html(&block.inner_blocks, theme);
            if !block.is_ordered() {
                return format!("<ul>{items}</ul>");
            }
            let start = match block.attributes.get("start").and_then(Value::as_i64) {
                Some(start) => format!(r#" start="{start}""#),
                None => String::new(),
            };
            let reversed = if block.is_reversed() { " reversed" } else { "" };
            format!("<ol{start}{reversed}>{items}</ol>")
        }
        EmailBlockName::ListItem => format!(
            "<li>{}{}</li>",
            block.rich_text("content"),
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
                            .map(|cell| {
                                let mut spans = String::new();
                                if let Some(colspan) = cell.colspan {
                                    spans.push_str(&format!(r#" colspan="{colspan}""#));
                                }
                                if let Some(rowspan) = cell.rowspan {
                                    spans.push_str(&format!(r#" rowspan="{rowspan}""#));
                                }
                                format!(
                                    "<{tag}{spans}>{}</{tag}>",
                                    sanitize_rich_text(cell.content, &RICH_TEXT_SANITIZER),
                                    tag = cell.tag
                                )
                            })
                            .collect();
                        format!("<tr>{cells}</tr>")
                    })
                    .collect();
                format!("<{tag}>{rows}</{tag}>")
            };
            let caption = match block.rich_text("caption").as_str() {
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
        EmailBlockName::Button => {
            let (open_tag, close_tag) =
                match url_with_scheme(block.str_attribute("url"), &LINK_SCHEMES) {
                    Some(url) => (format!(r#"a href="{}""#, escape_html(url)), "a"),
                    None => ("span".to_string(), "span"),
                };
            format!(
                r#"<table role="presentation" class="email-button" cellpadding="0" cellspacing="0" border="0"><tr><td class="email-button-cell" bgcolor="{background}" style="background-color: {background}; border-radius: 6px;"><{open_tag} class="email-button-link" style="display: inline-block; padding: 14px 26px; font-size: 16px; line-height: 20px; font-weight: 600; color: {text}; text-decoration: none;">{}{}</{close_tag}></td></tr></table>"#,
                block.rich_text("text"),
                if block.has_style("arrow") {
                    "&nbsp;&rarr;"
                } else {
                    ""
                },
                background = escape_html(theme.button_background_color),
                text = escape_html(theme.button_text_color),
            )
        }
        EmailBlockName::Quote => {
            let citation = match block.rich_text("citation").as_str() {
                "" => String::new(),
                citation => format!("<cite>{citation}</cite>"),
            };
            let body = if block.inner_blocks.is_empty() {
                sanitize_rich_text(block.str_attribute("value"), &QUOTE_VALUE_SANITIZER)
            } else {
                process_content_to_html(&block.inner_blocks, theme)
            };
            format!("<blockquote>{body}{citation}</blockquote>")
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
            block.rich_text("content").replace("<br>", "\n")
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
            let title = match block.rich_text("title").as_str() {
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
        EmailBlockName::Paragraph | EmailBlockName::Heading => block.rich_text_as_text("content"),
        EmailBlockName::Image => {
            let image =
                url_with_scheme(block.str_attribute("url"), &IMAGE_SCHEMES).map(|url| match block
                    .image_alt()
                    .replace('"', "")
                    .as_str()
                {
                    "" => format!("<{url}>"),
                    alt => format!("\"{alt}\", <{url}>"),
                });
            let caption = Some(block.rich_text_as_text("caption")).filter(|text| !text.is_empty());
            image
                .into_iter()
                .chain(caption)
                .collect::<Vec<_>>()
                .join("\n")
        }
        EmailBlockName::List | EmailBlockName::ListItem => list_to_plaintext(block, 0),
        EmailBlockName::Table => {
            let mut lines = vec![];
            let caption = block.rich_text_as_text("caption");
            if !caption.is_empty() {
                lines.push(caption);
            }
            for section in ["head", "body", "foot"] {
                for cells in block.table_rows(section) {
                    let cells: Vec<String> = cells
                        .iter()
                        .map(|cell| {
                            html_to_text(&sanitize_rich_text(cell.content, &RICH_TEXT_SANITIZER))
                        })
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
        EmailBlockName::Button => {
            let text = block.rich_text_as_text("text");
            match url_with_scheme(block.str_attribute("url"), &LINK_SCHEMES) {
                Some(url) => format!("{text}: {url}"),
                None => text,
            }
        }
        EmailBlockName::Quote => {
            let body = if block.inner_blocks.is_empty() {
                let value =
                    sanitize_rich_text(block.str_attribute("value"), &QUOTE_VALUE_SANITIZER);
                html_to_text(&value.replace("</p>", "\n"))
            } else {
                process_content_to_plaintext(&block.inner_blocks)
            };
            let mut lines: Vec<String> = body
                .lines()
                .map(|line| format!("> {line}").trim_end().to_string())
                .collect();
            let citation = block.rich_text_as_text("citation");
            if !citation.is_empty() {
                lines.push(format!("— {citation}"));
            }
            lines.join("\n")
        }
        EmailBlockName::Separator => "---".to_string(),
        EmailBlockName::Spacer => String::new(),
        EmailBlockName::Code => block
            .rich_text_as_text("content")
            .lines()
            .map(|line| format!("    {line}").trim_end().to_string())
            .collect::<Vec<_>>()
            .join("\n"),
        EmailBlockName::Callout => [
            block.rich_text_as_text("title"),
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
    let mut numbers = list.list_item_numbers();
    let is_ordered = list.is_ordered();
    let mut lines = vec![];
    for item in &list.inner_blocks {
        let number = numbers.next();
        let marker = match number {
            Some(number) if is_ordered => format!("{number}."),
            _ => "*".to_string(),
        };
        lines.push(format!(
            "{indent}{marker} {}",
            item.rich_text_as_text("content")
        ));
        for nested in &item.inner_blocks {
            lines.push(list_to_plaintext(nested, depth + 1));
        }
    }
    lines.join("\n")
}

/// The inbox preview: the first paragraph as one line of text, or empty when there is none.
pub fn preheader(blocks: &[EmailGutenbergBlock]) -> String {
    blocks
        .iter()
        .find(|block| block.name == EmailBlockName::Paragraph)
        .map(|block| {
            let text = block.rich_text_as_text("content");
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

/// What a message is rendered from: a body and subject with `{{KEY}}` placeholders, and the layout
/// it is wrapped in.
pub struct EmailRenderInput<'a> {
    pub layout_html: &'a str,
    pub theme: EmailTheme<'a>,
    pub subject: &'a str,
    pub body: Vec<EmailGutenbergBlock>,
    /// BCP 47 tag for `lang`; empty when unknown.
    pub language: &'a str,
    pub replacements: &'a HashMap<String, String>,
}

/// A message ready to hand to the mail relay.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderedEmail {
    pub subject: String,
    pub html: String,
    pub plain_text: String,
    /// Placeholders in the subject or body that `replacements` had no value for, left as typed.
    pub unfilled_placeholders: BTreeSet<String>,
}

/// Renders a whole message. The one path both sending and previewing go through, so a preview shows
/// what is sent.
pub fn render_email(input: EmailRenderInput) -> RenderedEmail {
    let EmailRenderInput {
        layout_html,
        theme,
        subject,
        mut body,
        language,
        replacements,
    } = input;
    let mut unfilled_placeholders = fill_placeholders(&mut body, replacements);
    // Not escaped: the subject header is not HTML, and `wrap_in_layout` escapes it for the shell.
    let subject =
        fill_placeholders_in_text(subject, replacements, false, &mut unfilled_placeholders)
            .into_owned();
    let html = wrap_in_layout(
        layout_html,
        &EmailLayoutFields {
            content_html: &process_content_to_html(&body, theme),
            subject: &subject,
            preheader: &preheader(&body),
            language,
        },
    );
    RenderedEmail {
        html: inline_css(html),
        plain_text: process_content_to_plaintext(&body),
        subject,
        unfilled_placeholders,
    }
}

/// Copies the `<style>` rules onto the elements they match, for clients that drop `<style>`.
fn inline_css(html: String) -> String {
    match CSS_INLINER.inline(&html) {
        Ok(inlined) => inlined,
        Err(err) => {
            tracing::warn!("Could not inline the CSS of an email, sending it as is: {err}");
            html
        }
    }
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
            json!([{ "name": "core/image", "attributes": { "alt": r#""Alternative title""#, "url": "https://example.com/a.png" } }]),
        );
        assert_eq!(
            "\"Alternative title\", <https://example.com/a.png>",
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
            r#"<img src="https://example.com/a.png" alt="A &quot;title&quot;" width="560" style="width: 100%; max-width: 560px; height: auto;">"#,
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
