use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use uuid::Uuid;

static DISALLOWED_BLOCKS_IN_TOP_LEVEL_PAGES: &[&str] = &[
    "moocfi/exercise",
    "moocfi/exercise-task",
    "moocfi/exercises-in-chapter",
    "moocfi/pages-in-chapter",
    "moocfi/exercises-in-chapter",
    "moocfi/chapter-progress",
];

pub use crate::attributes;
use crate::error::util_error::UtilError;
#[macro_export]
macro_rules! attributes {
    () => {{
        serde_json::Map::<String, serde_json::Value>::new()
    }};
    ($($name: tt: $value: expr),+ $(,)*) => {{
        let mut map = serde_json::Map::<String, serde_json::Value>::new();
        $(map.insert($name.into(), serde_json::json!($value));)*
        map
    }};
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct GutenbergBlock {
    #[serde(rename = "clientId")]
    pub client_id: Uuid,
    pub name: String,
    #[serde(rename = "isValid")]
    pub is_valid: bool,
    pub attributes: Map<String, Value>,
    #[serde(rename = "innerBlocks")]
    pub inner_blocks: Vec<GutenbergBlock>,
}

impl GutenbergBlock {
    pub fn empty_block_from_name(name: String) -> Self {
        GutenbergBlock {
            client_id: Uuid::new_v4(),
            name,
            is_valid: true,
            attributes: Map::new(),
            inner_blocks: vec![],
        }
    }
    pub fn block_with_name_and_attributes(name: &str, attributes: Map<String, Value>) -> Self {
        GutenbergBlock {
            client_id: Uuid::new_v4(),
            name: name.to_string(),
            is_valid: true,
            attributes,
            inner_blocks: vec![],
        }
    }
    pub fn block_with_name_attributes_and_inner_blocks(
        name: &str,
        attributes: Map<String, Value>,
        inner_blocks: Vec<GutenbergBlock>,
    ) -> Self {
        GutenbergBlock {
            client_id: Uuid::new_v4(),
            name: name.to_string(),
            is_valid: true,
            attributes,
            inner_blocks,
        }
    }
    pub fn hero_section(title: &str, sub_title: &str) -> Self {
        GutenbergBlock::block_with_name_and_attributes(
            "moocfi/hero-section",
            attributes! {
                "title": title,
                "subtitle": sub_title
            },
        )
    }
    pub fn landing_page_hero_section(title: &str, sub_title: &str) -> Self {
        GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "moocfi/landing-page-hero-section",
            attributes! {"title": title},
            vec![GutenbergBlock::block_with_name_and_attributes(
                "core/paragraph",
                attributes! {
                    "align": "center",
                    "content": sub_title,
                    "dropCap": false,
                    "placeholder": "Insert short description of course..."
                },
            )],
        )
    }
    pub fn course_objective_section() -> Self {
        GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "moocfi/course-objective-section",
            attributes! {
                "title": "In this course you'll..."
            },
            vec![GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                "core/columns",
                attributes! {
                    "isStackedOnMobile": true
                },
                vec![
                    GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                        "core/column",
                        attributes! {},
                        vec![
                            GutenbergBlock::block_with_name_and_attributes(
                                "core/heading",
                                attributes! {
                                    "textAlign": "center",
                                    "level": 3,
                                    "content": "Objective #1",
                                    "anchor": "objective-1",
                                },
                            ),
                            GutenbergBlock::block_with_name_and_attributes(
                                "core/paragraph",
                                attributes! {
                                    "align": "center",
                                    "dropCap": false,
                                    "content": "Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit..."
                                },
                            ),
                        ],
                    ),
                    GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                        "core/column",
                        attributes! {},
                        vec![
                            GutenbergBlock::block_with_name_and_attributes(
                                "core/heading",
                                attributes! {
                                    "textAlign": "center",
                                    "level": 3,
                                    "content": "Objective #2",
                                    "anchor": "objective-2",
                                },
                            ),
                            GutenbergBlock::block_with_name_and_attributes(
                                "core/paragraph",
                                attributes! {
                                    "align": "center",
                                    "dropCap": false,
                                    "content": "There is no one who loves pain itself, who seeks after it and wants to have it, simply because it is pain..."
                                },
                            ),
                        ],
                    ),
                    GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                        "core/column",
                        attributes! {},
                        vec![
                            GutenbergBlock::block_with_name_and_attributes(
                                "core/heading",
                                attributes! {
                                    "textAlign": "center",
                                    "level": 3,
                                    "content": "Objective #3",
                                    "anchor": "objective-3",
                                },
                            ),
                            GutenbergBlock::block_with_name_and_attributes(
                                "core/paragraph",
                                attributes! {
                                    "align": "center",
                                    "dropCap": false,
                                    "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas a tempor risus. Morbi at sapien."
                                },
                            ),
                        ],
                    ),
                ],
            )],
        )
    }

    pub fn with_id(self, id: Uuid) -> Self {
        Self {
            client_id: id,
            ..self
        }
    }
}

pub fn contains_blocks_not_allowed_in_top_level_pages(input: &[GutenbergBlock]) -> bool {
    let res = input
        .iter()
        .any(|block| DISALLOWED_BLOCKS_IN_TOP_LEVEL_PAGES.contains(&block.name.as_str()));
    res
}

pub fn remap_ids_in_content(
    content: &serde_json::Value,
    chaged_ids: HashMap<Uuid, Uuid>,
) -> Result<serde_json::Value, UtilError> {
    // naive implementation for now because the structure of the content was not decided at the time of writing this.
    // In the future we could only edit the necessary fields.
    let mut content_str = serde_json::to_string(content)?;
    for (k, v) in chaged_ids.into_iter() {
        content_str = content_str.replace(&k.to_string(), &v.to_string());
    }
    Ok(serde_json::from_str(&content_str)?)
}
