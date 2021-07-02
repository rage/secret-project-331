use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
        src: String,
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
    #[serde(rename = "core/quote")]
    Quote {
        value: String,
        citation: String,
        #[serde(flatten)]
        rest: HashMap<String, serde_json::Value>,
    },
    #[serde(rename = "core/pre")]
    PreFormatted {
        content: String,
        #[serde(flatten)]
        rest: HashMap<String, serde_json::Value>,
    },
    #[serde(rename = "core/pullquote")]
    PullQuote {
        citation: String,
        #[serde(flatten)]
        rest: HashMap<String, serde_json::Value>,
    },
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct EmailGutenbergBlock {
    #[serde(rename = "clientId")]
    pub client_id: String,
    pub name: String,
    #[serde(rename = "isValid")]
    pub is_valid: bool,
    pub attributes: BlockAttributes,
    #[serde(rename = "innerBlocks")]
    pub inner_blocks: Vec<EmailGutenbergBlock>,
}

pub fn process_content_to_plaintext(block: EmailGutenbergBlock) -> Result<()> {
    let contents: Vec<String> = block
        .inner_blocks
        .into_iter()
        .map(|block| match block.attributes {
            BlockAttributes::Paragraph { content, .. } => content,
            BlockAttributes::Image { alt, .. } => alt,
            BlockAttributes::Heading { content, .. } => content,
            BlockAttributes::List { values, .. } => values,
            BlockAttributes::Quote { citation, .. } => citation,
            BlockAttributes::PreFormatted { content, .. } => content,
            BlockAttributes::PullQuote { citation, .. } => citation,
        })
        .collect();

    //Save result to email_templates table
    let result = contents.join("");

    Ok(())
}
// need to implemet functions, that construct wanted HTML -tags.
pub fn process_content_to_html(block: EmailGutenbergBlock) -> Result<()> {
    let contents: Vec<String> = block
        .inner_blocks
        .into_iter()
        .map(|block| match block.attributes {
            BlockAttributes::Paragraph { content, .. } => {
                let mut result: String = String::from("<p>");
                result.push_str(&content);
                result.push_str("</p>");
                result
            }
            BlockAttributes::Image { alt, src, .. } => {
                let mut result: String = String::from("<p>");
                result.push_str(&alt);
                result.push_str("</p>");
                result
            }
            BlockAttributes::Heading { content, level, .. } => {
                let mut result: String = String::from("<p>");
                result.push_str(&content);
                result.push_str("</p>");
                result
            }
            BlockAttributes::List {
                values, ordered, ..
            } => {
                let mut result: String = String::from("<p>");
                result.push_str(&values);
                result.push_str("</p>");
                result
            }
            BlockAttributes::Quote { citation, .. } => {
                let mut result: String = String::from("<p>");
                result.push_str(&citation);
                result.push_str("</p>");
                result
            }
            BlockAttributes::PreFormatted { content, .. } => {
                let mut result: String = String::from("<pre>");
                result.push_str(&content);
                result.push_str("</pre>");
                result
            }
            BlockAttributes::PullQuote { citation, .. } => {
                let mut result: String = String::from("<p>");
                result.push_str(&citation);
                result.push_str("</p>");
                result
            }
        })
        .collect();

    //save results to email_templates table
    let result = contents.join("");
    Ok(())
}
