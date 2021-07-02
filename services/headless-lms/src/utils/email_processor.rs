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
                let result = format!("<p>{}</p>", content);
                result
            }
            BlockAttributes::Image { alt, src, .. } => {
                let result = format!(r#"<img src="{}" alt="{}"></img>"#, src, alt);
                result
            }
            BlockAttributes::Heading { content, level, .. } => {
                let result: String = format!("<h{}>{}</h{}>", level, content, level);
                result
            }
            BlockAttributes::List {
                values, ordered, ..
            } => {
                let result = construct_list(values, ordered);
                result
            }
        })
        .collect();

    //save results to email_templates table
    let result = contents.join("");
    Ok(())
}

//implement this in the future
pub fn construct_list(values: String, ordered: bool) -> String {
    String::from("list")
}
