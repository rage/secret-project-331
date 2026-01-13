use std::{
    cell::RefCell,
    collections::{HashMap, HashSet},
    rc::Rc,
};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
#[cfg(feature = "ts_rs")]
use ts_rs::TS;
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
use crate::prelude::*;

#[macro_export]
macro_rules! attributes {
    () => {{
        serde_json::Map::<String, serde_json::Value>::new()
    }};
    ($($name: tt: $value: expr_2021),+ $(,)*) => {{
        let mut map = serde_json::Map::<String, serde_json::Value>::new();
        $(map.insert($name.into(), serde_json::json!($value));)*
        map
    }};
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct GutenbergBlock {
    #[serde(rename = "clientId")]
    pub client_id: Uuid,
    pub name: String,
    #[serde(rename = "isValid")]
    pub is_valid: bool,
    #[cfg_attr(feature = "ts_rs", ts(type = "Record<string, unknown>"))]
    pub attributes: Map<String, Value>,
    #[serde(rename = "innerBlocks")]
    pub inner_blocks: Vec<GutenbergBlock>,
}

impl GutenbergBlock {
    pub fn paragraph(paragraph: &str) -> Self {
        Self::block_with_name_and_attributes(
            "core/paragraph",
            attributes! {
              "content": paragraph.to_string(),
              "dropCap": false
            },
        )
    }

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

    pub fn landing_page_copy_text(heading: &str, content: &str) -> Self {
        GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "moocfi/landing-page-copy-text",
            attributes! {},
            vec![GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                "core/columns",
                attributes! {
                    "isStackedOnMobile": true
                },
                vec![GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                    "core/column",
                    attributes! {},
                    vec![
                        GutenbergBlock::block_with_name_and_attributes(
                            "core/heading",
                            attributes! {
                                "content": heading,
                                "level": 2,
                                "placeholder": heading,
                                "anchor": heading,
                                "textAlign": "left"
                            },
                        ),
                        GutenbergBlock::block_with_name_and_attributes(
                            "core/paragraph",
                            attributes! {
                                "content": content,
                                "dropCap": false
                            },
                        ),
                    ],
                )],
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
    input
        .iter()
        .any(|block| DISALLOWED_BLOCKS_IN_TOP_LEVEL_PAGES.contains(&block.name.as_str()))
}

pub fn remap_ids_in_content(
    content: &serde_json::Value,
    chaged_ids: HashMap<Uuid, Uuid>,
) -> UtilResult<serde_json::Value> {
    // naive implementation for now because the structure of the content was not decided at the time of writing this.
    // In the future we could only edit the necessary fields.
    let mut content_str = serde_json::to_string(content)?;
    for (k, v) in chaged_ids.into_iter() {
        content_str = content_str.replace(&k.to_string(), &v.to_string());
    }
    Ok(serde_json::from_str(&content_str)?)
}

/** Removes the private spec from exercise tasks. */
pub fn remove_sensitive_attributes(input: Vec<GutenbergBlock>) -> Vec<GutenbergBlock> {
    input
        .into_iter()
        .map(|mut block| {
            if block.name == "moocfi/exercise-task" {
                block.attributes = Map::new();
            }
            block.inner_blocks = remove_sensitive_attributes(block.inner_blocks);
            block
        })
        .collect()
}

/// Filters lock-chapter blocks' inner blocks based on whether the chapter is locked.
/// If the chapter is not locked, inner blocks are removed to prevent unauthorized access.
/// This function recursively processes all blocks to handle nested structures.
pub fn filter_lock_chapter_blocks(
    input: Vec<GutenbergBlock>,
    is_locked: bool,
) -> Vec<GutenbergBlock> {
    input
        .into_iter()
        .map(|mut block| {
            if block.name == "moocfi/lock-chapter" {
                if !is_locked {
                    // Remove inner blocks if chapter is not locked
                    block.inner_blocks = vec![];
                } else {
                    // Recursively process inner blocks if locked
                    block.inner_blocks = filter_lock_chapter_blocks(block.inner_blocks, is_locked);
                }
            } else {
                // Recursively process all blocks
                block.inner_blocks = filter_lock_chapter_blocks(block.inner_blocks, is_locked);
            }
            block
        })
        .collect()
}

/// Replaces duplicate client IDs with new unique IDs in Gutenberg blocks.
pub fn replace_duplicate_client_ids(input: Vec<GutenbergBlock>) -> Vec<GutenbergBlock> {
    let seen_ids = Rc::new(RefCell::new(HashSet::new()));

    replace_duplicate_client_ids_inner(input, seen_ids)
}

fn replace_duplicate_client_ids_inner(
    mut input: Vec<GutenbergBlock>,
    seen_ids: Rc<RefCell<HashSet<Uuid>>>,
) -> Vec<GutenbergBlock> {
    for block in input.iter_mut() {
        let mut seen_ids_borrow = seen_ids.borrow_mut();
        if seen_ids_borrow.contains(&block.client_id) {
            block.client_id = Uuid::new_v4();
        } else {
            seen_ids_borrow.insert(block.client_id);
        }
        drop(seen_ids_borrow); // Release the borrow before recursive call

        block.inner_blocks =
            replace_duplicate_client_ids_inner(block.inner_blocks.clone(), seen_ids.clone());
    }
    input
}

/// Validates that all client IDs in the Gutenberg blocks are unique.
/// Returns an error if duplicate client IDs are found.
pub fn validate_unique_client_ids(input: Vec<GutenbergBlock>) -> UtilResult<Vec<GutenbergBlock>> {
    let seen_ids = Rc::new(RefCell::new(HashSet::new()));

    validate_unique_client_ids_inner(input, seen_ids)
}

fn validate_unique_client_ids_inner(
    input: Vec<GutenbergBlock>,
    seen_ids: Rc<RefCell<HashSet<Uuid>>>,
) -> UtilResult<Vec<GutenbergBlock>> {
    for block in input.iter() {
        let mut seen_ids_borrow = seen_ids.borrow_mut();
        if seen_ids_borrow.contains(&block.client_id) {
            return Err(UtilError::new(
                UtilErrorType::Other,
                format!("Duplicate client ID found: {}", block.client_id),
                None,
            ));
        } else {
            seen_ids_borrow.insert(block.client_id);
        }
        drop(seen_ids_borrow); // Release the borrow before recursive call

        validate_unique_client_ids_inner(block.inner_blocks.clone(), seen_ids.clone())?;
    }
    Ok(input)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn collect_ids(blocks: &Vec<GutenbergBlock>, ids: &mut Vec<Uuid>) {
        for block in blocks {
            ids.push(block.client_id);
            collect_ids(&block.inner_blocks, ids);
        }
    }

    #[test]
    fn replace_duplicate_client_ids_makes_all_ids_unique_flat_and_nested() {
        let dup_id = Uuid::new_v4();
        let nested_dup_id = Uuid::new_v4();

        let block_a = GutenbergBlock::empty_block_from_name("a".into()).with_id(dup_id);
        let block_b_child_1 =
            GutenbergBlock::empty_block_from_name("b1".into()).with_id(nested_dup_id);
        let block_b_child_2 =
            GutenbergBlock::empty_block_from_name("b2".into()).with_id(nested_dup_id);
        let block_b = GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "b",
            attributes! {},
            vec![block_b_child_1, block_b_child_2],
        )
        .with_id(dup_id);

        let input = vec![block_a, block_b];
        let output = replace_duplicate_client_ids(input);

        let mut ids: Vec<Uuid> = Vec::new();
        collect_ids(&output, &mut ids);
        let unique: HashSet<Uuid> = ids.iter().cloned().collect();
        assert_eq!(
            unique.len(),
            ids.len(),
            "all ids should be unique after replacement"
        );
    }

    #[test]
    fn validate_unique_client_ids_ok_on_unique() {
        let a = GutenbergBlock::empty_block_from_name("a".into());
        let b = GutenbergBlock::empty_block_from_name("b".into());
        let c = GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "c",
            attributes! {},
            vec![GutenbergBlock::empty_block_from_name("c1".into())],
        );
        let input = vec![a, b, c];
        let result = validate_unique_client_ids(input);
        assert!(result.is_ok());
    }

    #[test]
    fn validate_unique_client_ids_err_on_duplicate_nested() {
        let dup_id = Uuid::new_v4();
        let a = GutenbergBlock::empty_block_from_name("a".into()).with_id(dup_id);
        let b_child = GutenbergBlock::empty_block_from_name("b1".into()).with_id(dup_id);
        let b = GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "b",
            attributes! {},
            vec![b_child],
        );
        let input = vec![a, b];
        let result = validate_unique_client_ids(input);
        assert!(result.is_err());
    }

    #[test]
    fn filter_lock_chapter_blocks_removes_inner_blocks_when_not_locked() {
        let inner_block = GutenbergBlock::block_with_name_and_attributes(
            "core/paragraph",
            attributes! {
                "content": "This should be hidden"
            },
        );
        let lock_block = GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "moocfi/lock-chapter",
            attributes! {},
            vec![inner_block.clone()],
        );
        let regular_block = GutenbergBlock::block_with_name_and_attributes(
            "core/heading",
            attributes! {
                "content": "Regular heading"
            },
        );

        let input = vec![lock_block, regular_block];
        let result = filter_lock_chapter_blocks(input, false);

        // Lock-chapter block should have no inner blocks
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].name, "moocfi/lock-chapter");
        assert_eq!(result[0].inner_blocks.len(), 0);
        // Regular block should be unaffected
        assert_eq!(result[1].name, "core/heading");
    }

    #[test]
    fn filter_lock_chapter_blocks_preserves_inner_blocks_when_locked() {
        let inner_block = GutenbergBlock::block_with_name_and_attributes(
            "core/paragraph",
            attributes! {
                "content": "This should be visible"
            },
        );
        let lock_block = GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "moocfi/lock-chapter",
            attributes! {},
            vec![inner_block.clone()],
        );

        let input = vec![lock_block];
        let result = filter_lock_chapter_blocks(input, true);

        // Lock-chapter block should preserve inner blocks
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "moocfi/lock-chapter");
        assert_eq!(result[0].inner_blocks.len(), 1);
        assert_eq!(result[0].inner_blocks[0].name, "core/paragraph");
    }

    #[test]
    fn filter_lock_chapter_blocks_handles_nested_blocks() {
        let nested_inner = GutenbergBlock::block_with_name_and_attributes(
            "core/paragraph",
            attributes! {
                "content": "Nested content"
            },
        );
        let nested_lock = GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "moocfi/lock-chapter",
            attributes! {},
            vec![nested_inner],
        );
        let outer_lock = GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "moocfi/lock-chapter",
            attributes! {},
            vec![nested_lock],
        );

        let input = vec![outer_lock];
        let result = filter_lock_chapter_blocks(input, false);

        // All lock-chapter blocks should have inner blocks removed
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "moocfi/lock-chapter");
        assert_eq!(result[0].inner_blocks.len(), 0);
    }

    #[test]
    fn filter_lock_chapter_blocks_handles_nested_blocks_when_locked() {
        let nested_inner = GutenbergBlock::block_with_name_and_attributes(
            "core/paragraph",
            attributes! {
                "content": "Nested content"
            },
        );
        let nested_lock = GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "moocfi/lock-chapter",
            attributes! {},
            vec![nested_inner.clone()],
        );
        let outer_lock = GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "moocfi/lock-chapter",
            attributes! {},
            vec![nested_lock],
        );

        let input = vec![outer_lock];
        let result = filter_lock_chapter_blocks(input, true);

        // All lock-chapter blocks should preserve inner blocks
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "moocfi/lock-chapter");
        assert_eq!(result[0].inner_blocks.len(), 1);
        assert_eq!(result[0].inner_blocks[0].name, "moocfi/lock-chapter");
        assert_eq!(result[0].inner_blocks[0].inner_blocks.len(), 1);
        assert_eq!(
            result[0].inner_blocks[0].inner_blocks[0].name,
            "core/paragraph"
        );
    }

    #[test]
    fn filter_lock_chapter_blocks_does_not_affect_non_lock_blocks() {
        let paragraph = GutenbergBlock::block_with_name_and_attributes(
            "core/paragraph",
            attributes! {
                "content": "Regular paragraph"
            },
        );
        let heading = GutenbergBlock::block_with_name_and_attributes(
            "core/heading",
            attributes! {
                "content": "Regular heading"
            },
        );
        let list_item = GutenbergBlock::block_with_name_and_attributes(
            "core/list-item",
            attributes! {
                "content": "List item"
            },
        );
        let list = GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "core/list",
            attributes! {},
            vec![list_item],
        );

        let input = vec![paragraph, heading, list];
        let result = filter_lock_chapter_blocks(input, false);

        // All blocks should be preserved
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].name, "core/paragraph");
        assert_eq!(result[1].name, "core/heading");
        assert_eq!(result[2].name, "core/list");
        assert_eq!(result[2].inner_blocks.len(), 1);
    }
}
