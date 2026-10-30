//! Compares two states of course content: blocks matched by id, and modules, chapters and pages
//! by the fields models compare.

use std::collections::{HashMap, HashSet};

use headless_lms_models::library::{
    agent_changesets::{StagedEntity, course_state::CourseState},
    entity_snapshots::{ContentEntityType, EntityKey},
};
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde::Serialize;
use uuid::Uuid;

use crate::engine::PageRef;
use crate::snapshots;

/// How a block or an entity differs between two states.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ChangeKind {
    Added,
    Removed,
    Changed,
    /// Only its place differs.
    Moved,
}

/// One block that differs between two states of the same pages.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct BlockChange {
    pub block_id: Uuid,
    pub name: String,
    pub kind: ChangeKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_before: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_after: Option<Uuid>,
    /// Set for exercise blocks.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exercise_id: Option<Uuid>,
    /// `name` and the attribute keys whose values differ, for changed blocks.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub changed_fields: Vec<String>,
    /// Also set on a changed block that moved.
    pub is_moved: bool,
}

struct Placed<'a> {
    page: Uuid,
    parent: Option<Uuid>,
    previous_sibling: Option<Uuid>,
    block: &'a GutenbergBlock,
}

/// Where every block of the pages is, and the block ids in page order.
fn place_blocks<'a>(pages: &[PageRef<'a>]) -> (HashMap<Uuid, Placed<'a>>, Vec<Uuid>) {
    fn place<'a>(
        page: Uuid,
        parent: Option<Uuid>,
        blocks: &'a [GutenbergBlock],
        placed: &mut HashMap<Uuid, Placed<'a>>,
        order: &mut Vec<Uuid>,
    ) {
        let mut previous_sibling = None;
        for block in blocks {
            order.push(block.client_id);
            placed.insert(
                block.client_id,
                Placed {
                    page,
                    parent,
                    previous_sibling,
                    block,
                },
            );
            place(
                page,
                Some(block.client_id),
                &block.inner_blocks,
                placed,
                order,
            );
            previous_sibling = Some(block.client_id);
        }
    }
    let mut placed = HashMap::new();
    let mut order = Vec::new();
    for page in pages {
        place(page.page_id, None, page.blocks, &mut placed, &mut order);
    }
    (placed, order)
}

/// The blocks that differ between the pages of `before` and `after`. A page must be on both sides
/// when it exists on both.
pub fn diff_blocks(before: &[PageRef], after: &[PageRef]) -> Vec<BlockChange> {
    let (old, old_order) = place_blocks(before);
    let (new, new_order) = place_blocks(after);
    let mut changes = Vec::new();

    let mut seen: HashSet<Uuid> = HashSet::new();
    for id in old_order.into_iter().chain(new_order) {
        if !seen.insert(id) {
            continue;
        }
        match (old.get(&id), new.get(&id)) {
            (Some(o), None) => changes.push(BlockChange {
                block_id: id,
                name: o.block.name.clone(),
                kind: ChangeKind::Removed,
                page_before: Some(o.page),
                page_after: None,
                exercise_id: o.block.exercise_id(),
                changed_fields: Vec::new(),
                is_moved: false,
            }),
            (None, Some(n)) => changes.push(BlockChange {
                block_id: id,
                name: n.block.name.clone(),
                kind: ChangeKind::Added,
                page_before: None,
                page_after: Some(n.page),
                exercise_id: n.block.exercise_id(),
                changed_fields: Vec::new(),
                is_moved: false,
            }),
            (Some(o), Some(n)) => {
                let mut changed_fields = Vec::new();
                if o.block.name != n.block.name {
                    changed_fields.push("name".to_string());
                }
                let mut keys: Vec<&String> = o
                    .block
                    .attributes
                    .keys()
                    .chain(n.block.attributes.keys())
                    .collect();
                keys.sort();
                keys.dedup();
                for key in keys {
                    if o.block.attributes.get(key) != n.block.attributes.get(key) {
                        changed_fields.push(format!("attributes/{key}"));
                    }
                }
                // A block next to an added or removed one hasn't moved just because of that.
                let is_moved_among_siblings = o.previous_sibling != n.previous_sibling
                    && n.previous_sibling.is_none_or(|p| old.contains_key(&p))
                    && o.previous_sibling.is_none_or(|p| new.contains_key(&p));
                let is_moved = o.page != n.page || o.parent != n.parent || is_moved_among_siblings;
                if changed_fields.is_empty() && !is_moved {
                    continue;
                }
                changes.push(BlockChange {
                    block_id: id,
                    name: n.block.name.clone(),
                    kind: if changed_fields.is_empty() {
                        ChangeKind::Moved
                    } else {
                        ChangeKind::Changed
                    },
                    page_before: Some(o.page),
                    page_after: Some(n.page),
                    exercise_id: n.block.exercise_id(),
                    changed_fields,
                    is_moved,
                });
            }
            (None, None) => {}
        }
    }
    changes
}

/// The blocks that differ between two states of the pages. A page a state doesn't have has no
/// blocks there.
pub fn diff_pages(
    before: &CourseState,
    after: &CourseState,
    page_ids: &[Uuid],
) -> Vec<BlockChange> {
    fn blocks<'a>(state: &'a CourseState, page_ids: &[Uuid]) -> Vec<PageRef<'a>> {
        page_ids
            .iter()
            .filter_map(|id| Some(snapshots::page_ref(state.page(*id)?)))
            .collect()
    }
    diff_blocks(&blocks(before, page_ids), &blocks(after, page_ids))
}

/// The modules, chapters and pages that `after` adds or changes of `before`, by id.
pub fn structure_changes(before: &CourseState, after: &CourseState) -> HashMap<Uuid, ChangeKind> {
    let changes = after.changes_since(before);
    let written = changes
        .entities
        .iter()
        .filter(|entity| entity.after().is_some())
        .map(StagedEntity::key)
        .filter(|key| {
            matches!(
                key.entity_type,
                ContentEntityType::Module | ContentEntityType::Chapter
            )
        })
        .chain(
            changes
                .pages
                .iter()
                .filter(|page_id| after.page(**page_id).is_some())
                .map(|page_id| EntityKey::new(ContentEntityType::Page, *page_id)),
        );
    written
        .map(|key| {
            let kind = if !before.has_entity(key) {
                ChangeKind::Added
            } else {
                let is_content_changed = key.entity_type == ContentEntityType::Page
                    && before.page(key.entity_id).map(|page| &page.content)
                        != after.page(key.entity_id).map(|page| &page.content);
                let fields = after.field_changes_since(before, key);
                let is_placed_only = !is_content_changed
                    && !fields.is_empty()
                    && fields.iter().all(|change| change.field.is_placement());
                if is_placed_only {
                    ChangeKind::Moved
                } else {
                    ChangeKind::Changed
                }
            };
            (key.entity_id, kind)
        })
        .collect()
}

/// The top-level trees of `page` that hold a block added, changed or moved there since `before`,
/// or that lost a child: a container's template can require the child. `before` is the page as it
/// was, if it existed.
pub fn changed_roots(before: Option<PageRef>, page: PageRef) -> Vec<GutenbergBlock> {
    let mut parent_before: HashMap<Uuid, Uuid> = HashMap::new();
    if let Some(before) = before {
        crate::engine::blocks::walk(before.blocks, &mut |block, _| {
            for child in &block.inner_blocks {
                parent_before.insert(child.client_id, block.client_id);
            }
        });
    }
    let mut touched: HashSet<Uuid> = HashSet::new();
    let before_pages: Vec<PageRef> = before.into_iter().collect();
    for change in diff_blocks(&before_pages, &[page]) {
        if change.kind != ChangeKind::Removed {
            touched.insert(change.block_id);
        }
        let left_its_parent = change.kind == ChangeKind::Removed || change.is_moved;
        if left_its_parent && let Some(parent) = parent_before.get(&change.block_id) {
            touched.insert(*parent);
        }
    }
    fn holds_touched(block: &GutenbergBlock, touched: &HashSet<Uuid>) -> bool {
        touched.contains(&block.client_id)
            || block
                .inner_blocks
                .iter()
                .any(|child| holds_touched(child, touched))
    }
    page.blocks
        .iter()
        .filter(|root| holds_touched(root, &touched))
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use serde_json::json;

    use super::*;
    use crate::engine::{PageDocument, PageType};
    use crate::test_fixtures::{exercise, id, infobox, page, para};

    fn blocks(documents: &[PageDocument]) -> Vec<PageRef<'_>> {
        documents.iter().map(PageDocument::as_page_ref).collect()
    }

    fn diff(before: &[PageDocument], after: &[PageDocument]) -> Vec<BlockChange> {
        diff_blocks(&blocks(before), &blocks(after))
    }

    fn before() -> Vec<PageDocument> {
        vec![
            page(
                "pg1",
                PageType::CoursePage,
                vec![
                    para("p1", "a"),
                    para("p2", "b"),
                    infobox("box", vec![para("c1", "c")]),
                    exercise("ex1", "e1"),
                ],
            ),
            page("pg2", PageType::CoursePage, vec![para("q1", "x")]),
        ]
    }

    #[test]
    fn block_changes_by_id() {
        let mut after = before();
        after[0].blocks.remove(0);
        after[0].blocks[0]
            .attributes
            .insert("content".into(), json!("B"));
        let moved = after[0].blocks.remove(2);
        after[1].blocks.push(moved);
        after[0].blocks[1].inner_blocks.push(para("new", "n"));
        let result = diff(&before(), &after);
        let kinds: Vec<(Uuid, ChangeKind)> = result.iter().map(|b| (b.block_id, b.kind)).collect();
        assert_eq!(
            kinds,
            vec![
                (id("p1"), ChangeKind::Removed),
                (id("p2"), ChangeKind::Changed),
                (id("ex1"), ChangeKind::Moved),
                (id("new"), ChangeKind::Added)
            ]
        );
        let exercise_move = &result[2];
        assert_eq!(
            (exercise_move.page_before, exercise_move.page_after),
            (Some(id("pg1")), Some(id("pg2")))
        );
        assert_eq!(exercise_move.exercise_id, Some(id("e1")));
        assert_eq!(
            result[1].changed_fields,
            vec!["attributes/content".to_string()]
        );
    }

    #[test]
    fn reordering_siblings_is_a_move() {
        let mut after = before();
        after[0].blocks.swap(0, 1);
        let result = diff(&before(), &after);
        assert!(result.iter().all(|b| b.kind == ChangeKind::Moved));
        assert!(!result.is_empty());
    }

    #[test]
    fn unchanged_is_empty() {
        let result = diff(&before(), &before());
        assert!(result.is_empty());
    }

    #[test]
    fn changed_roots_are_top_level_ancestors() {
        let before = page(
            "pg1",
            PageType::CoursePage,
            vec![para("p1", "a"), infobox("box", vec![para("c1", "b")])],
        );
        let mut after = before.clone();
        after.blocks[1].inner_blocks[0]
            .attributes
            .insert("content".into(), json!("B"));
        let roots = changed_roots(Some(before.as_page_ref()), after.as_page_ref());
        assert_eq!(roots.len(), 1);
        assert_eq!(roots[0].client_id, id("box"));
    }

    #[test]
    fn a_container_that_lost_a_child_is_a_changed_root() {
        let before = page(
            "pg1",
            PageType::CoursePage,
            vec![
                para("p1", "a"),
                infobox("box", vec![para("c1", "b"), para("c2", "c")]),
            ],
        );
        let mut after = before.clone();
        after.blocks[1].inner_blocks.remove(0);
        let roots = changed_roots(Some(before.as_page_ref()), after.as_page_ref());
        assert_eq!(roots.len(), 1);
        assert_eq!(roots[0].client_id, id("box"));

        let mut moved_out = before.clone();
        let child = moved_out.blocks[1].inner_blocks.remove(1);
        moved_out.blocks.insert(0, child);
        let ids: Vec<Uuid> = changed_roots(Some(before.as_page_ref()), moved_out.as_page_ref())
            .iter()
            .map(|root| root.client_id)
            .collect();
        assert!(ids.contains(&id("box")), "{ids:?}");
    }
}
