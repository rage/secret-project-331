use regex::{Captures, Regex};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct EmailGutenbergBlock {
    #[serde(rename = "clientId")]
    pub client_id: Uuid,
    pub name: String,
    #[serde(rename = "isValid")]
    pub is_valid: bool,
    pub attributes: BlockAttributes,
    #[serde(rename = "innerBlocks")]
    pub inner_blocks: Vec<EmailGutenbergBlock>,
}

pub fn process_content_to_plaintext(block: EmailGutenbergBlock) -> String {
    let html_li_start_re = Regex::new(r#"<li>"#).unwrap();
    let html_li_end_re = Regex::new(r#"</li>"#).unwrap();
    let html_all_tags = Regex::new("<.+?>").unwrap();

    let contents: Vec<String> = block
        .inner_blocks
        .into_iter()
        .map(|block| match block.attributes {
            BlockAttributes::Paragraph {
                content,
                drop_cap: _,
                ..
            } => content,
            BlockAttributes::Image { alt, url, .. } => format!("{}, {}", alt, url),
            BlockAttributes::Heading { content, .. } => content,
            BlockAttributes::List {
                values, ordered, ..
            } => {
                if ordered {
                    let mut counter = 0;
                    let first_tags: String = html_li_start_re
                        .replace_all(&values, |_caps: &Captures| {
                            counter += 1;
                            format!("{}. ", counter)
                        })
                        .to_string();

                    let snd_tags: String =
                        html_li_end_re.replace_all(&first_tags, "\n").to_string();
                    let final_res: String = html_all_tags.replace_all(&snd_tags, "").to_string();
                    final_res
                } else {
                    let first_tags: String =
                        html_li_start_re.replace_all(&values, "* ").to_string();
                    let snd_tags: String =
                        html_li_end_re.replace_all(&first_tags, "\n").to_string();
                    let final_res: String = html_all_tags.replace_all(&snd_tags, "").to_string();
                    final_res
                }
            }
        })
        .collect();

    // TODO: Save result to email_templates table
    let result = contents.join("\n");
    result
}
// need to implemet functions, that construct wanted HTML -tags.
pub fn process_content_to_html(block: EmailGutenbergBlock) -> String {
    let contents: Vec<String> = block
        .inner_blocks
        .into_iter()
        .map(|block| match block.attributes {
            BlockAttributes::Paragraph {
                content,
                drop_cap: _,
                ..
            } => {
                let result = format!("<p>{}</p>", content);
                result
            }
            BlockAttributes::Image { alt, url, .. } => {
                let result = format!(r#"<img src="{}" alt="{}"></img>"#, url, alt);
                result
            }
            BlockAttributes::Heading { content, level, .. } => {
                let result: String = format!("<h{}>{}</h{}>", level, content, level);
                result
            }
            BlockAttributes::List {
                values, ordered, ..
            } => {
                let result = if ordered {
                    format!("<ol>{}</ol>", values)
                } else {
                    format!("<ul>{}</ul>", values)
                };
                result
            }
        })
        .collect();

    // TODO: save results to email_templates table
    let result = contents.join("");
    result
}

#[cfg(test)]
mod email_processor_tests {
    use super::*;
    use pretty_assertions::assert_eq;
    use uuid::Uuid;

    #[test]
    fn it_converts_paragraph_correctly_to_plain_text() {
        let input = EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            name: String::from("parent"),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from(""),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![EmailGutenbergBlock {
                client_id: Uuid::new_v4(),
                is_valid: true,
                name: String::from("test"),
                inner_blocks: vec![],
                attributes: BlockAttributes::Paragraph {
                    content: String::from("testi paragraph."),
                    drop_cap: false,
                    rest: HashMap::new(),
                },
            }],
        };

        let result = process_content_to_plaintext(input);

        assert_eq!(String::from("testi paragraph."), result);
    }

    #[test]
    fn it_converts_heading_correctly_to_plain_text() {
        let input = EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            name: String::from("parent"),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from(""),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![EmailGutenbergBlock {
                client_id: Uuid::new_v4(),
                is_valid: true,
                name: String::from("test"),
                inner_blocks: vec![],
                attributes: BlockAttributes::Heading {
                    content: String::from("Email heading"),
                    level: 2,
                    rest: HashMap::new(),
                },
            }],
        };

        let result = process_content_to_plaintext(input);

        assert_eq!(String::from("Email heading"), result);
    }

    #[test]
    fn it_converts_image_correctly_to_plain_text() {
        let input = EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            name: String::from("parent"),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from(""),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![EmailGutenbergBlock {
                client_id: Uuid::new_v4(),
                is_valid: true,
                name: String::from("test"),
                inner_blocks: vec![],
                attributes: BlockAttributes::Image {
                    alt: String::from("Alternative title"),
                    url: String::from("URL -of an image"),
                    rest: HashMap::new(),
                },
            }],
        };

        let result = process_content_to_plaintext(input);

        assert_eq!(String::from("Alternative title, URL -of an image"), result);
    }

    #[test]
    fn it_converts_unordered_list_correctly_to_plain_text() {
        let input = EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            name: String::from("parent"),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from(""),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![EmailGutenbergBlock {
                client_id: Uuid::new_v4(),
                is_valid: true,
                name: String::from("test"),
                inner_blocks: vec![],
                attributes: BlockAttributes::List {
                    values: String::from("<li>1</li><li>2</li><li>3</li><li>4</li>"),
                    ordered: false,
                    rest: HashMap::new(),
                },
            }],
        };

        let result = process_content_to_plaintext(input);

        assert_eq!(String::from("* 1\n* 2\n* 3\n* 4\n"), result);
    }

    #[test]
    fn it_converts_unordered_list_containing_other_tags_correctly_to_plain_text() {
        let input = EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            name: String::from("parent"),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from(""),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![EmailGutenbergBlock {
                client_id: Uuid::new_v4(),
                is_valid: true,
                name: String::from("test"),
                inner_blocks: vec![],
                attributes: BlockAttributes::List {
                    values: String::from(
                        "<li><code>1</code></li><li><kbd>2</kbd></li><li>3</li><li>4</li>",
                    ),
                    ordered: false,
                    rest: HashMap::new(),
                },
            }],
        };

        let result = process_content_to_plaintext(input);

        assert_eq!(String::from("* 1\n* 2\n* 3\n* 4\n"), result);
    }

    #[test]
    fn it_converts_ordered_list_correctly_to_plain_text() {
        let input = EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            name: String::from("parent"),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from(""),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![EmailGutenbergBlock {
                client_id: Uuid::new_v4(),
                is_valid: true,
                name: String::from("test"),
                inner_blocks: vec![],
                attributes: BlockAttributes::List {
                    values: String::from(
                        "<li>first</li><li>second</li><li>third</li><li>fourth</li>",
                    ),
                    ordered: true,
                    rest: HashMap::new(),
                },
            }],
        };

        let result = process_content_to_plaintext(input);

        assert_eq!(
            String::from("1. first\n2. second\n3. third\n4. fourth\n"),
            result
        );
    }

    #[test]
    fn it_converts_ordered_list_containing_other_tags_correctly_to_plain_text() {
        let input = EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            name: String::from("parent"),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from(""),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![EmailGutenbergBlock {
                client_id: Uuid::new_v4(),
                is_valid: true,
                name: String::from("test"),
                inner_blocks: vec![],
                attributes: BlockAttributes::List {
                    values: String::from(
                        "<li><code>first</code></li><li><kbd>second</kbd></li><li>third</li><li>fourth</li>",
                    ),
                    ordered: true,
                    rest: HashMap::new(),
                },
            }],
        };

        let result = process_content_to_plaintext(input);

        assert_eq!(
            String::from("1. first\n2. second\n3. third\n4. fourth\n"),
            result
        );
    }

    #[test]
    fn it_converts_paragraph_correctly_to_html() {
        let input = EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            name: String::from("parent"),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from(""),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![EmailGutenbergBlock {
                client_id: Uuid::new_v4(),
                is_valid: true,
                name: String::from("test"),
                inner_blocks: vec![],
                attributes: BlockAttributes::Paragraph {
                    content: String::from("testi paragraph."),
                    drop_cap: false,
                    rest: HashMap::new(),
                },
            }],
        };

        let result = process_content_to_html(input);

        assert_eq!(String::from("<p>testi paragraph.</p>"), result);
    }

    #[test]
    fn it_converts_heading_correctly_to_html() {
        let input = EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            name: String::from("parent"),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from(""),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![EmailGutenbergBlock {
                client_id: Uuid::new_v4(),
                is_valid: true,
                name: String::from("test"),
                inner_blocks: vec![],
                attributes: BlockAttributes::Heading {
                    content: String::from("Email heading"),
                    level: 2,
                    rest: HashMap::new(),
                },
            }],
        };

        let result = process_content_to_html(input);

        assert_eq!(String::from("<h2>Email heading</h2>"), result);
    }

    #[test]
    fn it_converts_image_correctly_to_html() {
        let input = EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            name: String::from("parent"),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from(""),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![EmailGutenbergBlock {
                client_id: Uuid::new_v4(),
                is_valid: true,
                name: String::from("test"),
                inner_blocks: vec![],
                attributes: BlockAttributes::Image {
                    alt: String::from("Alternative title"),
                    url: String::from("URL -of an image"),
                    rest: HashMap::new(),
                },
            }],
        };

        let result = process_content_to_html(input);

        assert_eq!(
            String::from(r#"<img src="URL -of an image" alt="Alternative title"></img>"#),
            result
        );
    }

    #[test]
    fn it_converts_unordered_list_correctly_to_html() {
        let input = EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            name: String::from("parent"),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from(""),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![EmailGutenbergBlock {
                client_id: Uuid::new_v4(),
                is_valid: true,
                name: String::from("test"),
                inner_blocks: vec![],
                attributes: BlockAttributes::List {
                    values: String::from("<li>1</li><li>2</li><li>3</li><li>4</li>"),
                    ordered: false,
                    rest: HashMap::new(),
                },
            }],
        };

        let result = process_content_to_html(input);

        assert_eq!(
            String::from("<ul><li>1</li><li>2</li><li>3</li><li>4</li></ul>"),
            result
        );
    }

    #[test]
    fn it_converts_unordered_list_containing_other_tags_correctly_to_html() {
        let input = EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            name: String::from("parent"),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from(""),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![EmailGutenbergBlock {
                client_id: Uuid::new_v4(),
                is_valid: true,
                name: String::from("test"),
                inner_blocks: vec![],
                attributes: BlockAttributes::List {
                    values: String::from(
                        "<li><code>1</code></li><li><kbd>2</kbd></li><li>3</li><li>4</li>",
                    ),
                    ordered: false,
                    rest: HashMap::new(),
                },
            }],
        };

        let result = process_content_to_html(input);

        assert_eq!(
            String::from(
                "<ul><li><code>1</code></li><li><kbd>2</kbd></li><li>3</li><li>4</li></ul>"
            ),
            result
        );
    }

    #[test]
    fn it_converts_ordered_list_correctly_to_html() {
        let input = EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            name: String::from("parent"),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from(""),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![EmailGutenbergBlock {
                client_id: Uuid::new_v4(),
                is_valid: true,
                name: String::from("test"),
                inner_blocks: vec![],
                attributes: BlockAttributes::List {
                    values: String::from(
                        "<li>first</li><li>second</li><li>third</li><li>fourth</li>",
                    ),
                    ordered: true,
                    rest: HashMap::new(),
                },
            }],
        };

        let result = process_content_to_html(input);

        assert_eq!(
            String::from("<ol><li>first</li><li>second</li><li>third</li><li>fourth</li></ol>"),
            result
        );
    }

    #[test]
    fn it_converts_ordered_list_containing_other_tags_correctly_to_html() {
        let input = EmailGutenbergBlock {
            client_id: Uuid::new_v4(),
            name: String::from("parent"),
            is_valid: true,
            attributes: BlockAttributes::Paragraph {
                content: String::from(""),
                drop_cap: false,
                rest: HashMap::new(),
            },
            inner_blocks: vec![EmailGutenbergBlock {
                client_id: Uuid::new_v4(),
                is_valid: true,
                name: String::from("test"),
                inner_blocks: vec![],
                attributes: BlockAttributes::List {
                    values: String::from(
                        "<li><code>first</code></li><li><kbd>second</kbd></li><li>third</li><li>fourth</li>",
                    ),
                    ordered: true,
                    rest: HashMap::new(),
                },
            }],
        };

        let result = process_content_to_html(input);

        assert_eq!(
            String::from("<ol><li><code>first</code></li><li><kbd>second</kbd></li><li>third</li><li>fourth</li></ol>"),
            result
        );
    }
}
