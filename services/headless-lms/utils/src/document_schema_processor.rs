use std::{
    cell::RefCell,
    collections::{HashMap, HashSet},
    rc::Rc,
};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use utoipa::ToSchema;
use uuid::Uuid;

use crate::strings::strip_html_tags;

/// The name of the block that embeds an exercise; its `id` attribute is the exercise id.
pub const EXERCISE_BLOCK: &str = "moocfi/exercise";

/// Blocks that are not allowed in top-level pages (pages without chapter_id).
/// Note: This is NOT for chapter front pages. Chapter front pages can contain these blocks.
const DISALLOWED_BLOCKS_IN_TOP_LEVEL_PAGES: &[&str] = &[
    EXERCISE_BLOCK,
    "moocfi/exercise-task",
    "moocfi/exercises-in-chapter",
    "moocfi/pages-in-chapter",
    "moocfi/chapter-progress",
];

/// The heading and description of each objective in [`GutenbergBlock::course_objective_section`],
/// placeholder text for the teacher to replace.
pub const COURSE_OBJECTIVE_PLACEHOLDERS: [(&str, &str); 3] = [
    (
        "Objective #1",
        "Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit...",
    ),
    (
        "Objective #2",
        "There is no one who loves pain itself, who seeks after it and wants to have it, simply because it is pain...",
    ),
    (
        "Objective #3",
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas a tempor risus. Morbi at sapien.",
    ),
];

/// The `style` attribute Gutenberg stores for centred text in blocks with the text-align support.
fn centred_text_style() -> Value {
    serde_json::json!({"typography": {"textAlign": "center"}})
}

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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, ToSchema)]

pub struct GutenbergBlock {
    #[serde(rename = "clientId")]
    pub client_id: Uuid,
    pub name: String,
    #[serde(rename = "isValid")]
    pub is_valid: bool,
    pub attributes: Map<String, Value>,
    #[serde(rename = "innerBlocks")]
    #[schema(no_recursion)]
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
                    "content": sub_title,
                    "dropCap": false,
                    "placeholder": "Insert short description of course...",
                    "style": centred_text_style()
                },
            )],
        )
    }

    /// The course objectives section with [`COURSE_OBJECTIVE_PLACEHOLDERS`] for the teacher to
    /// replace.
    pub fn course_objective_section() -> Self {
        let columns = COURSE_OBJECTIVE_PLACEHOLDERS
            .iter()
            .enumerate()
            .map(|(index, (heading, description))| {
                GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                    "core/column",
                    attributes! {},
                    vec![
                        GutenbergBlock::block_with_name_and_attributes(
                            "core/heading",
                            attributes! {
                                "level": 3,
                                "content": heading,
                                "anchor": format!("objective-{}", index + 1),
                                "style": centred_text_style(),
                            },
                        ),
                        GutenbergBlock::block_with_name_and_attributes(
                            "core/paragraph",
                            attributes! {
                                "dropCap": false,
                                "content": description,
                                "style": centred_text_style(),
                            },
                        ),
                    ],
                )
            })
            .collect();
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
                columns,
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

    /// The exercise an exercise block embeds; `None` for other blocks and for an exercise block
    /// whose `id` attribute names none.
    pub fn exercise_id(&self) -> Option<Uuid> {
        if self.name != EXERCISE_BLOCK {
            return None;
        }
        self.attributes
            .get("id")
            .and_then(Value::as_str)
            .and_then(|id| Uuid::parse_str(id).ok())
    }
}

/// Depth-first, pre-order visit of every block with its index path (`[2, 0]` is the first child of
/// the third top-level block).
pub fn walk<'a>(blocks: &'a [GutenbergBlock], visit: &mut dyn FnMut(&'a GutenbergBlock, &[usize])) {
    fn go<'a>(
        blocks: &'a [GutenbergBlock],
        prefix: &mut Vec<usize>,
        visit: &mut dyn FnMut(&'a GutenbergBlock, &[usize]),
    ) {
        for (index, block) in blocks.iter().enumerate() {
            prefix.push(index);
            visit(block, prefix);
            go(&block.inner_blocks, prefix, visit);
            prefix.pop();
        }
    }
    go(blocks, &mut Vec::new(), visit);
}

/// Depth-first, pre-order visit of every block.
pub fn walk_mut(blocks: &mut [GutenbergBlock], visit: &mut dyn FnMut(&mut GutenbergBlock)) {
    for block in blocks.iter_mut() {
        visit(block);
        walk_mut(&mut block.inner_blocks, visit);
    }
}

/// The `clientId` of every block in the tree, in [`walk`] order.
pub fn all_client_ids(blocks: &[GutenbergBlock]) -> Vec<Uuid> {
    let mut ids = Vec::new();
    walk(blocks, &mut |block, _| ids.push(block.client_id));
    ids
}

/// The blocks, at any depth, that aren't allowed in top-level pages (pages without chapter_id).
/// Note: This is NOT for chapter front pages. Chapter front pages can contain these blocks.
pub fn blocks_not_allowed_in_top_level_pages(input: &[GutenbergBlock]) -> Vec<&GutenbergBlock> {
    let mut found = Vec::new();
    walk(input, &mut |block, _| {
        if DISALLOWED_BLOCKS_IN_TOP_LEVEL_PAGES.contains(&block.name.as_str()) {
            found.push(block);
        }
    });
    found
}

/// Checks if blocks, at any depth, contain any that are not allowed in top-level pages (pages
/// without chapter_id). See [`blocks_not_allowed_in_top_level_pages`].
pub fn contains_blocks_not_allowed_in_top_level_pages(input: &[GutenbergBlock]) -> bool {
    !blocks_not_allowed_in_top_level_pages(input).is_empty()
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

/// The text a block and everything nested inside it carries, one entry per block that has any.
///
/// Blocks hold their text as HTML in a `content` attribute, which is stripped here: callers render
/// this as plain text, and the markup is several times the size of the words in it. A block with
/// no text of its own (a layout wrapper, an image) contributes only what its children do.
fn blocks_text_content(blocks: &[GutenbergBlock], texts: &mut Vec<String>) {
    for block in blocks {
        if let Some(content) = block.attributes.get("content").and_then(Value::as_str) {
            let text = strip_html_tags(content);
            let text = text.trim();
            if !text.is_empty() {
                texts.push(text.to_string());
            }
        }
        blocks_text_content(&block.inner_blocks, texts);
    }
}

/// The learning objectives declared anywhere in `blocks`, one per line, or `None` when the page
/// declares none.
///
/// Objectives are authored as list items inside a learning-objectives block, so the lines are the
/// objectives themselves. Whether they cover the page, the chapter or the course depends on which
/// page the blocks came from, which is the caller's to know.
pub fn get_learning_objectives(blocks: &[GutenbergBlock]) -> Option<String> {
    let mut objectives = Vec::new();
    collect_learning_objectives(blocks, &mut objectives);
    (!objectives.is_empty()).then(|| objectives.join("\n"))
}

fn collect_learning_objectives(blocks: &[GutenbergBlock], objectives: &mut Vec<String>) {
    for block in blocks {
        if block.name == "moocfi/learning-objectives"
            || block.name == "moocfi/course-objective-section"
        {
            blocks_text_content(std::slice::from_ref(block), objectives);
        } else {
            collect_learning_objectives(&block.inner_blocks, objectives);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A learning-objectives block whose items are the list items authors actually write.
    fn objectives_block(items: &[&str]) -> GutenbergBlock {
        GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "moocfi/learning-objectives",
            attributes! {"title": "Learning objectives"},
            vec![GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                "core/list",
                attributes! {},
                items
                    .iter()
                    .map(|item| {
                        GutenbergBlock::block_with_name_and_attributes(
                            "core/list-item",
                            attributes! {"content": *item},
                        )
                    })
                    .collect(),
            )],
        )
    }

    /// Objectives are authored as HTML and shown to a reader as text, and the block sits several
    /// levels down from the page's top-level blocks.
    #[test]
    fn learning_objectives_come_back_as_one_plain_text_line_each() {
        let page = vec![
            GutenbergBlock::paragraph("Intro"),
            GutenbergBlock::block_with_name_attributes_and_inner_blocks(
                "core/columns",
                attributes! {},
                vec![objectives_block(&[
                    "Ymmärrät mitä <strong>muuttuja</strong> tarkoittaa",
                    "Osaat <em>tulostaa</em> tekstiä",
                ])],
            ),
        ];

        assert_eq!(
            get_learning_objectives(&page).as_deref(),
            Some("Ymmärrät mitä muuttuja tarkoittaa\nOsaat tulostaa tekstiä")
        );
    }

    /// A block that declares no objectives counts as no objectives, the same as no block at all:
    /// the caller omits the field either way rather than printing an empty one.
    #[test]
    fn a_page_without_objectives_has_none_whether_or_not_the_block_is_there() {
        assert_eq!(
            get_learning_objectives(&[GutenbergBlock::paragraph("Just prose")]),
            None
        );
        assert_eq!(get_learning_objectives(&[objectives_block(&[])]), None);
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

        let ids = all_client_ids(&output);
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
