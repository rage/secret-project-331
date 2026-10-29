//! Block tree navigation by index path (`[2, 0]` = first child of the third top-level block).

pub use headless_lms_utils::document_schema_processor::{EXERCISE_BLOCK, walk};
use headless_lms_utils::document_schema_processor::{GutenbergBlock, walk_mut};
use serde::Serialize;
use serde_json::json;
use uuid::Uuid;

use super::error::{EditError, EditErrorCode};
use super::path::{split_segment, unescape_segment};
use crate::ids::IdGenerator;

/// Keys a page read adds to a block besides its stored fields. Writes ignore them, so a block
/// read back can be written again.
pub(crate) const RENDERED_BLOCK_KEYS: [&str; 5] =
    ["path", "pending", "children", "preview", "exercise_id"];

/// Attributes that hold a block's text, most telling first: bulk edits search them unless told
/// otherwise, and a block's preview is the first one with text.
pub(crate) const TEXT_ATTRIBUTES: [&str; 15] = [
    "content",
    "title",
    "text",
    "caption",
    "alt",
    "name",
    "citation",
    "value",
    "label",
    "subtitle",
    "fileName",
    "downloadButtonText",
    "head",
    "body",
    "foot",
];

/// Blocks that only exist inside an exercise block's editor tree.
const EXERCISE_INTERNAL_BLOCKS: [&str; 4] = [
    "moocfi/exercise-settings",
    "moocfi/exercise-slides",
    "moocfi/exercise-slide",
    "moocfi/exercise-task",
];

/// Whether the block embeds an exercise.
pub fn is_exercise(block: &GutenbergBlock) -> bool {
    block.name == EXERCISE_BLOCK
}

/// An exercise block or a block of an exercise's editor tree.
pub fn is_exercise_part(name: &str) -> bool {
    name == EXERCISE_BLOCK || EXERCISE_INTERNAL_BLOCKS.contains(&name)
}

/// The index path of the block `id`, if the tree has it.
pub fn find_path(blocks: &[GutenbergBlock], id: Uuid) -> Option<Vec<usize>> {
    for (index, block) in blocks.iter().enumerate() {
        if block.client_id == id {
            return Some(vec![index]);
        }
        if let Some(mut rest) = find_path(&block.inner_blocks, id) {
            rest.insert(0, index);
            return Some(rest);
        }
    }
    None
}

/// The block at an index path. Paths come from [`find_path`] on the same tree, so the error, for
/// an empty path or one the tree doesn't have, means the location went stale.
pub fn get<'a>(
    blocks: &'a [GutenbergBlock],
    path: &[usize],
) -> Result<&'a GutenbergBlock, EditError> {
    let (first, rest) = path.split_first().ok_or_else(stale_location)?;
    let mut block = blocks.get(*first).ok_or_else(stale_location)?;
    for index in rest {
        block = block.inner_blocks.get(*index).ok_or_else(stale_location)?;
    }
    Ok(block)
}

/// [`get`], to change the block.
pub fn get_mut<'a>(
    blocks: &'a mut [GutenbergBlock],
    path: &[usize],
) -> Result<&'a mut GutenbergBlock, EditError> {
    let (first, rest) = path.split_first().ok_or_else(stale_location)?;
    let mut block = blocks.get_mut(*first).ok_or_else(stale_location)?;
    for index in rest {
        block = block
            .inner_blocks
            .get_mut(*index)
            .ok_or_else(stale_location)?;
    }
    Ok(block)
}

/// The children list whose parent is at `parent_path`; the top level for an empty path.
pub fn list_mut<'a>(
    blocks: &'a mut Vec<GutenbergBlock>,
    parent_path: &[usize],
) -> Result<&'a mut Vec<GutenbergBlock>, EditError> {
    if parent_path.is_empty() {
        Ok(blocks)
    } else {
        Ok(&mut get_mut(blocks, parent_path)?.inner_blocks)
    }
}

/// [`list_mut`], to read.
pub fn list<'a>(
    blocks: &'a [GutenbergBlock],
    parent_path: &[usize],
) -> Result<&'a [GutenbergBlock], EditError> {
    if parent_path.is_empty() {
        Ok(blocks)
    } else {
        Ok(&get(blocks, parent_path)?.inner_blocks)
    }
}

/// The error for a located block or range the tree no longer has.
pub(crate) fn stale_location() -> EditError {
    EditError::new(
        EditErrorCode::NotFound,
        "a block the call located isn't where it was; read the page again and repeat the call",
    )
}

fn count_blocks(blocks: &[GutenbergBlock]) -> usize {
    let mut count = 0;
    walk(blocks, &mut |_, _| count += 1);
    count
}

/// A page's block count, nested blocks included, and its exercise count, as the course structure
/// shows them.
pub fn content_counts(blocks: &[GutenbergBlock]) -> (u32, u32) {
    let exercise_count = blocks.iter().filter(|b| is_exercise(b)).count();
    (count_blocks(blocks) as u32, exercise_count as u32)
}

/// Whether the block at `path` is inside an exercise's editor tree; with `include_self`, also
/// whether it is part of one itself. Errors with [`stale_location`] if the tree lacks `path`.
pub fn is_in_exercise(
    blocks: &[GutenbergBlock],
    path: &[usize],
    include_self: bool,
) -> Result<bool, EditError> {
    let end = if include_self {
        path.len()
    } else {
        path.len().saturating_sub(1)
    };
    for depth in 1..=end {
        if is_exercise_part(&get(blocks, &path[..depth])?.name) {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Like [`walk`], but never enters an exercise, whose blocks page edits don't touch.
pub fn walk_outside_exercises<'a>(
    blocks: &'a [GutenbergBlock],
    visit: &mut dyn FnMut(&'a GutenbergBlock, &[usize]),
) {
    fn go<'a>(
        blocks: &'a [GutenbergBlock],
        prefix: &mut Vec<usize>,
        visit: &mut dyn FnMut(&'a GutenbergBlock, &[usize]),
    ) {
        for (index, block) in blocks.iter().enumerate() {
            if is_exercise_part(&block.name) {
                continue;
            }
            prefix.push(index);
            visit(block, prefix);
            go(&block.inner_blocks, prefix, visit);
            prefix.pop();
        }
    }
    go(blocks, &mut Vec::new(), visit);
}

/// Like [`walk_mut`], but never enters an exercise, whose blocks page edits don't touch.
pub fn walk_mut_outside_exercises(
    blocks: &mut [GutenbergBlock],
    visit: &mut dyn FnMut(&mut GutenbergBlock),
) {
    for block in blocks {
        if is_exercise_part(&block.name) {
            continue;
        }
        visit(block);
        walk_mut_outside_exercises(&mut block.inner_blocks, visit);
    }
}

/// The parent ids of the block at `path`, outermost first.
pub fn ancestor_ids(blocks: &[GutenbergBlock], path: &[usize]) -> Vec<Uuid> {
    (1..path.len())
        .filter_map(|depth| get(blocks, &path[..depth]).ok())
        .map(|block| block.client_id)
        .collect()
}

/// The value at JSON Pointer `pointer` (non-empty, escaped) inside `attributes`.
pub(crate) fn attribute<'a>(
    attributes: &'a serde_json::Map<String, serde_json::Value>,
    pointer: &str,
) -> Option<&'a serde_json::Value> {
    let (name, rest) = split_segment(pointer.strip_prefix('/')?);
    attributes.get(&unescape_segment(name))?.pointer(rest)
}

/// An exercise block a copy duplicated. The caller creates the new exercise from the source's
/// settings.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ExerciseCopy {
    pub source_exercise_id: Uuid,
    pub new_exercise_id: Uuid,
    pub new_block_id: Uuid,
    /// The page the copy is on.
    pub page_id: Uuid,
}

/// Copies `source` for `page_id` with new block ids. Exercise blocks get new exercise ids, listed
/// in the result.
pub fn copy_blocks(
    source: &[GutenbergBlock],
    ids: &dyn IdGenerator,
    page_id: Uuid,
) -> (Vec<GutenbergBlock>, Vec<ExerciseCopy>) {
    let mut copies = Vec::new();
    let mut blocks = source.to_vec();
    walk_mut(&mut blocks, &mut |block| {
        block.client_id = ids.new_id();
        if let Some(source_exercise_id) = block.exercise_id() {
            let new_exercise_id = ids.new_id();
            block.attributes.insert("id".into(), json!(new_exercise_id));
            copies.push(ExerciseCopy {
                source_exercise_id,
                new_exercise_id,
                new_block_id: block.client_id,
                page_id,
            });
        }
    });
    (blocks, copies)
}

/// Visits every string value inside `attributes`.
pub fn for_each_string(
    attributes: &serde_json::Map<String, serde_json::Value>,
    visit: &mut dyn FnMut(&str),
) {
    fn go(value: &serde_json::Value, visit: &mut dyn FnMut(&str)) {
        match value {
            serde_json::Value::String(s) => visit(s),
            serde_json::Value::Array(items) => items.iter().for_each(|v| go(v, visit)),
            serde_json::Value::Object(map) => map.values().for_each(|v| go(v, visit)),
            _ => {}
        }
    }
    attributes.values().for_each(|value| go(value, visit));
}

/// Visits every string value inside `attributes`, to change it in place.
pub fn for_each_string_mut(
    attributes: &mut serde_json::Map<String, serde_json::Value>,
    visit: &mut dyn FnMut(&mut String),
) {
    fn go(value: &mut serde_json::Value, visit: &mut dyn FnMut(&mut String)) {
        match value {
            serde_json::Value::String(s) => visit(s),
            serde_json::Value::Array(items) => items.iter_mut().for_each(|v| go(v, visit)),
            serde_json::Value::Object(map) => map.values_mut().for_each(|v| go(v, visit)),
            _ => {}
        }
    }
    attributes.values_mut().for_each(|value| go(value, visit));
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use headless_lms_utils::document_schema_processor::all_client_ids;
    use pretty_assertions::assert_eq;

    use super::*;
    use crate::ids::SequentialIds;
    use crate::test_fixtures::{exercise, id, infobox, para};

    #[test]
    fn copied_blocks_get_new_ids_and_new_exercises() {
        let source = vec![infobox("box", vec![para("c", "x")]), exercise("exb", "ex")];
        let ids = SequentialIds::default();
        let (copied, copies) = copy_blocks(&source, &ids, id("page"));
        let source_ids: HashSet<Uuid> = all_client_ids(&source).into_iter().collect();
        assert!(
            all_client_ids(&copied)
                .iter()
                .all(|id| !source_ids.contains(id))
        );
        assert_eq!(copies.len(), 1);
        assert_eq!(copies[0].source_exercise_id, id("ex"));
        assert_eq!(copied[1].exercise_id(), Some(copies[0].new_exercise_id));
        assert_eq!(copied[0].inner_blocks[0].attributes["content"], json!("x"));
    }
}
