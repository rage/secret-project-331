use std::collections::HashMap;

use once_cell::sync::Lazy;
use regex::{Captures, Regex};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

static LI_START_TAG_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"<li>").expect("invalid li_start regex"));
static LI_END_TAG_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"</li>").expect("invalid li_end regex"));
static ALL_TAG_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"<.+?>").expect("invalid all_tags regex"));
static DOUBLE_QUOTE_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"""#).expect("invalid double_quote regex"));

#[derive(Debug, Deserialize, Serialize, PartialEq, Eq, Clone)]
#[serde(tag = "name", content = "attributes")]
pub enum BlockAttributes {
    #[serde(rename = "core/paragraph")]
    Paragraph {
        content: String,
        drop_cap: bool,
        #[serde(flatten)]
        rest: HashMap<String, serde_json::Value>,
    },
    #[serde(rename = "core/image")]
    Image {
        alt: String,
        url: String,
        #[serde(flatten)]
        rest: HashMap<String, serde_json::Value>,
    },
    #[serde(rename = "core/heading")]
    Heading {
        content: String,
        anchor: String,
        level: i64,
        #[serde(flatten)]
        rest: HashMap<String, serde_json::Value>,
    },
    #[serde(rename = "core/list")]
    List {
        ordered: bool,
        values: String,
        #[serde(flatten)]
        rest: HashMap<String, serde_json::Value>,
    },
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct EmailGutenbergBlock {
    #[serde(rename = "clientId")]
    pub client_id: Uuid,
    #[serde(rename = "isValid")]
    pub is_valid: bool,
    #[serde(flatten)]
    pub attributes: BlockAttributes,
    #[serde(rename = "innerBlocks")]
    pub inner_blocks: Vec<EmailGutenbergBlock>,
}

pub fn process_content_to_plaintext(blocks: &[EmailGutenbergBlock]) -> String {
    let contents: Vec<String> = blocks
        .iter()
        .map(|block| match &block.attributes {
            BlockAttributes::Paragraph { content, .. } => {
                let res = ALL_TAG_REGEX.replace_all(content, "").to_string();
                format!("{}\n\n", res)
            }
            BlockAttributes::Image { alt, url, .. } => {
                let result = DOUBLE_QUOTE_REGEX.replace_all(alt, "").to_string();
                format!("\"{}\", <{}>", result, url)
            }
            BlockAttributes::Heading { content, .. } => format!("{}\n\n\n", content),
            BlockAttributes::List {
                values, ordered, ..
            } => {
                if *ordered {
                    let mut counter = 0;
                    let first_tags = LI_START_TAG_REGEX
                        .replace_all(values, |_caps: &Captures| {
                            counter += 1;
                            format!("{}. ", counter)
                        })
                        .to_string();
                    let snd_tags = LI_END_TAG_REGEX.replace_all(&first_tags, "\n").to_string();
                    ALL_TAG_REGEX.replace_all(&snd_tags, "").to_string()
                } else {
                    let first_tags = LI_START_TAG_REGEX.replace_all(values, "* ").to_string();
                    let snd_tags = LI_END_TAG_REGEX.replace_all(&first_tags, "\n").to_string();
                    ALL_TAG_REGEX.replace_all(&snd_tags, "").to_string()
                }
            }
        })
        .collect();
    contents.join("\n")
}

pub fn process_content_to_html(blocks: &[EmailGutenbergBlock]) -> String {
    let contents: Vec<String> = blocks
        .iter()
        .map(|block| match &block.attributes {
            BlockAttributes::Paragraph {
                content,
                drop_cap: _,
                ..
            } => {
                format!("<p>{}</p>", content)
            }
            BlockAttributes::Image { alt, url, .. } => {
                format!(r#"<img src="{}" alt="{}"></img>"#, url, alt)
            }
            BlockAttributes::Heading { content, level, .. } => {
                format!("<h{}>{}</h{}>", level, content, level)
            }
            BlockAttributes::List {
                values, ordered, ..
            } => {
                if *ordered {
                    format!("<ol>{}</ol>", values)
                } else {
                    format!("<ul>{}</ul>", values)
                }
            }
        })
        .collect();
    contents.join("")
}

#[cfg(test)]
mod email_processor_tests {
    use pretty_assertions::assert_eq;
    use uuid::Uuid;

    use super::*;

    #[test]
    fn it_converts_paragraph_correctly_to_plain_text() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from("testi paragraph."),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_plaintext(&input);

        assert_eq!(String::from("testi paragraph.\n\n"), result);
    }

    #[test]
    fn it_converts_paragraph_wrapped_in_tags_correctly_to_plain_text() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from("<strong><em>testi paragraph.</em></strong>"),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_plaintext(&input);

        assert_eq!(String::from("testi paragraph.\n\n"), result);
    }

    #[test]
    fn it_converts_heading_correctly_to_plain_text() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::Heading {
                content: String::from("Email heading"),
                anchor: String::from("email-heading"),
                level: 2,
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_plaintext(&input);

        assert_eq!(String::from("Email heading\n\n\n"), result);
    }

    #[test]
    fn it_converts_image_correctly_to_plain_text() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::Image {
                alt: String::from("Alternative title"),
                url: String::from("URL -of an image"),
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_plaintext(&input);

        assert_eq!(
            String::from("\"Alternative title\", <URL -of an image>"),
            result
        );
    }
    #[test]
    fn it_converts_image_containing_double_quotes_correctly_to_plain_text() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::Image {
                alt: String::from(r#""Alternative title""#),
                url: String::from("URL -of an image"),
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_plaintext(&input);

        assert_eq!(
            String::from("\"Alternative title\", <URL -of an image>"),
            result
        );
    }

    #[test]
    fn it_converts_unordered_list_correctly_to_plain_text() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::List {
                values: String::from("<li>1</li><li>2</li><li>3</li><li>4</li>"),
                ordered: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_plaintext(&input);

        assert_eq!(String::from("* 1\n* 2\n* 3\n* 4\n"), result);
    }

    #[test]
    fn it_converts_unordered_list_containing_other_tags_correctly_to_plain_text() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::List {
                values: String::from(
                    "<li><code>1</code></li><li><kbd>2</kbd></li><li>3</li><li>4</li>",
                ),
                ordered: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_plaintext(&input);

        assert_eq!(String::from("* 1\n* 2\n* 3\n* 4\n"), result);
    }

    #[test]
    fn it_converts_ordered_list_correctly_to_plain_text() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::List {
                values: String::from("<li>first</li><li>second</li><li>third</li><li>fourth</li>"),
                ordered: true,
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_plaintext(&input);

        assert_eq!(
            String::from("1. first\n2. second\n3. third\n4. fourth\n"),
            result
        );
    }

    #[test]
    fn it_converts_ordered_list_containing_other_tags_correctly_to_plain_text() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::List {
                values: String::from(
                    "<li><code>first</code></li><li><kbd>second</kbd></li><li>third</li><li>fourth</li>",
                ),
                ordered: true,
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_plaintext(&input);

        assert_eq!(
            String::from("1. first\n2. second\n3. third\n4. fourth\n"),
            result
        );
    }

    #[test]
    fn it_converts_paragraph_correctly_to_html() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from("testi paragraph."),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_html(&input);

        assert_eq!(String::from("<p>testi paragraph.</p>"), result);
    }

    #[test]
    fn it_converts_heading_correctly_to_html() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::Heading {
                content: String::from("Email heading"),
                anchor: String::from("email-heading"),
                level: 2,
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_html(&input);

        assert_eq!(String::from("<h2>Email heading</h2>"), result);
    }

    #[test]
    fn it_converts_image_correctly_to_html() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::Image {
                alt: String::from("Alternative title"),
                url: String::from("URL -of an image"),
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_html(&input);

        assert_eq!(
            String::from(r#"<img src="URL -of an image" alt="Alternative title"></img>"#),
            result
        );
    }

    #[test]
    fn it_converts_unordered_list_correctly_to_html() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::List {
                values: String::from("<li>1</li><li>2</li><li>3</li><li>4</li>"),
                ordered: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_html(&input);

        assert_eq!(
            String::from("<ul><li>1</li><li>2</li><li>3</li><li>4</li></ul>"),
            result
        );
    }

    #[test]
    fn it_converts_unordered_list_containing_other_tags_correctly_to_html() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::List {
                values: String::from(
                    "<li><code>1</code></li><li><kbd>2</kbd></li><li>3</li><li>4</li>",
                ),
                ordered: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_html(&input);

        assert_eq!(
            String::from(
                "<ul><li><code>1</code></li><li><kbd>2</kbd></li><li>3</li><li>4</li></ul>"
            ),
            result
        );
    }

    #[test]
    fn it_converts_ordered_list_correctly_to_html() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::List {
                values: String::from("<li>first</li><li>second</li><li>third</li><li>fourth</li>"),
                ordered: true,
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_html(&input);

        assert_eq!(
            String::from("<ol><li>first</li><li>second</li><li>third</li><li>fourth</li></ol>"),
            result
        );
    }

    #[test]
    fn it_converts_ordered_list_containing_other_tags_correctly_to_html() {
        let input = vec![EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            is_valid: true,
            attributes: BlockAttributes::List {
                values: String::from(
                    "<li><code>first</code></li><li><kbd>second</kbd></li><li>third</li><li>fourth</li>",
                ),
                ordered: true,
                rest: HashMap::new(),
            },
            inner_blocks: vec![],
        }];

        let result = process_content_to_html(&input);

        assert_eq!(
            String::from(
                "<ol><li><code>first</code></li><li><kbd>second</kbd></li><li>third</li><li>fourth</li></ol>"
            ),
            result
        );
    }
}
