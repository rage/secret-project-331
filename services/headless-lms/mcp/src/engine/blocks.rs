//! Block tree navigation by index path (`[2, 0]` = first child of the third top-level block).

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use uuid::Uuid;

pub const EXERCISE_BLOCK: &str = "moocfi/exercise";

/// Blocks that only exist inside an exercise block's editor tree.
const EXERCISE_INTERNAL_BLOCKS: [&str; 4] = [
    "moocfi/exercise-settings",
    "moocfi/exercise-slides",
    "moocfi/exercise-slide",
    "moocfi/exercise-task",
];

/// Blocks a page outside chapters may not hold.
pub const DISALLOWED_ON_TOP_LEVEL_PAGES: [&str; 5] = [
    "moocfi/exercise",
    "moocfi/exercise-task",
    "moocfi/exercises-in-chapter",
    "moocfi/pages-in-chapter",
    "moocfi/chapter-progress",
];

pub fn is_exercise(block: &GutenbergBlock) -> bool {
    block.name == EXERCISE_BLOCK
}

pub fn is_exercise_name(name: &str) -> bool {
    name == EXERCISE_BLOCK || EXERCISE_INTERNAL_BLOCKS.contains(&name)
}

/// The exercise id a stored exercise block points at.
pub fn exercise_id(block: &GutenbergBlock) -> Option<Uuid> {
    block
        .attributes
        .get("id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
}

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

/// Panics on an index path that doesn't exist; paths come from `find_path` on the same tree.
pub fn get<'a>(blocks: &'a [GutenbergBlock], path: &[usize]) -> &'a GutenbergBlock {
    let (first, rest) = path.split_first().expect("non-empty block path");
    let mut block = &blocks[*first];
    for index in rest {
        block = &block.inner_blocks[*index];
    }
    block
}

pub fn get_mut<'a>(blocks: &'a mut [GutenbergBlock], path: &[usize]) -> &'a mut GutenbergBlock {
    let (first, rest) = path.split_first().expect("non-empty block path");
    let mut block = &mut blocks[*first];
    for index in rest {
        block = &mut block.inner_blocks[*index];
    }
    block
}

/// The children list whose parent is at `parent_path`; the top level for an empty path.
pub fn list_mut<'a>(
    blocks: &'a mut Vec<GutenbergBlock>,
    parent_path: &[usize],
) -> &'a mut Vec<GutenbergBlock> {
    if parent_path.is_empty() {
        blocks
    } else {
        &mut get_mut(blocks, parent_path).inner_blocks
    }
}

pub fn list<'a>(blocks: &'a [GutenbergBlock], parent_path: &[usize]) -> &'a [GutenbergBlock] {
    if parent_path.is_empty() {
        blocks
    } else {
        &get(blocks, parent_path).inner_blocks
    }
}

/// Depth-first, pre-order visit of every block with its index path.
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

pub fn walk_mut(blocks: &mut [GutenbergBlock], visit: &mut dyn FnMut(&mut GutenbergBlock)) {
    for block in blocks.iter_mut() {
        visit(block);
        walk_mut(&mut block.inner_blocks, visit);
    }
}

pub fn all_ids(blocks: &[GutenbergBlock]) -> Vec<Uuid> {
    let mut ids = Vec::new();
    walk(blocks, &mut |block, _| ids.push(block.client_id));
    ids
}

pub fn count_blocks(blocks: &[GutenbergBlock]) -> usize {
    let mut count = 0;
    walk(blocks, &mut |_, _| count += 1);
    count
}

/// The parent ids of the block at `path`, outermost first.
pub fn ancestor_ids(blocks: &[GutenbergBlock], path: &[usize]) -> Vec<Uuid> {
    (1..path.len())
        .map(|depth| get(blocks, &path[..depth]).client_id)
        .collect()
}
