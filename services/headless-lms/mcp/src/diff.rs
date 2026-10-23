//! Compares two states of everything a changeset touches, matching blocks and entities by id.
//! Validation, risk rules and audit run on this diff, whatever ops produced it.

use std::collections::HashMap;

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::engine::PageDocument;
use crate::engine::blocks;
use crate::engine::course_settings::CourseSettings;
use crate::engine::course_structure::CourseStructure;
use crate::engine::glossary_references::GlossaryAndReferences;

/// One side of a diff. Leave out what the change didn't touch; pages must appear on both sides
/// when they exist on both.
#[derive(Debug, Clone, Default)]
pub struct Snapshot {
    pub pages: Vec<PageDocument>,
    pub structure: Option<CourseStructure>,
    pub settings: Option<CourseSettings>,
    pub glossary: Option<GlossaryAndReferences>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ChangeKind {
    Added,
    Removed,
    Changed,
    Moved,
}

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EntityType {
    Module,
    Chapter,
    Page,
    GlossaryTerm,
    Reference,
    Course,
    ModuleSettings,
    Audience,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct FieldChange {
    pub field: String,
    pub before: Value,
    pub after: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct EntityChange {
    pub entity_type: EntityType,
    pub entity_id: Uuid,
    pub kind: ChangeKind,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub fields: Vec<FieldChange>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_before: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_after: Option<Uuid>,
    pub is_moved: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
pub struct Diff {
    pub blocks: Vec<BlockChange>,
    pub entities: Vec<EntityChange>,
}

impl Diff {
    pub fn is_empty(&self) -> bool {
        self.blocks.is_empty() && self.entities.is_empty()
    }

    pub fn entity(&self, entity_type: EntityType, id: Uuid) -> Option<&EntityChange> {
        self.entities
            .iter()
            .find(|e| e.entity_type == entity_type && e.entity_id == id)
    }

    /// Pages whose content changed (blocks added, removed, changed or moved in or out).
    pub fn pages_with_block_changes(&self) -> Vec<Uuid> {
        let mut pages: Vec<Uuid> = self
            .blocks
            .iter()
            .flat_map(|b| [b.page_before, b.page_after])
            .flatten()
            .collect();
        pages.sort();
        pages.dedup();
        pages
    }
}

pub fn diff(before: &Snapshot, after: &Snapshot) -> Diff {
    let mut result = Diff {
        blocks: diff_blocks(&before.pages, &after.pages),
        entities: Vec::new(),
    };
    if let (Some(b), Some(a)) = (&before.structure, &after.structure) {
        result.entities.extend(diff_structure(b, a));
    }
    if let (Some(b), Some(a)) = (&before.settings, &after.settings) {
        result.entities.extend(diff_settings(b, a));
    }
    if let (Some(b), Some(a)) = (&before.glossary, &after.glossary) {
        result.entities.extend(diff_glossary(b, a));
    }
    result
}

struct Placed<'a> {
    page: Uuid,
    parent: Option<Uuid>,
    previous_sibling: Option<Uuid>,
    block: &'a GutenbergBlock,
}

fn place_blocks(pages: &[PageDocument]) -> HashMap<Uuid, Placed<'_>> {
    let mut placed = HashMap::new();
    for page in pages {
        blocks::walk(&page.blocks, &mut |block, path| {
            let parent = (path.len() > 1)
                .then(|| blocks::get(&page.blocks, &path[..path.len() - 1]).client_id);
            let index = path[path.len() - 1];
            let previous_sibling = (index > 0)
                .then(|| blocks::list(&page.blocks, &path[..path.len() - 1])[index - 1].client_id);
            placed.insert(
                block.client_id,
                Placed {
                    page: page.page_id,
                    parent,
                    previous_sibling,
                    block,
                },
            );
        });
    }
    placed
}

fn diff_blocks(before: &[PageDocument], after: &[PageDocument]) -> Vec<BlockChange> {
    let old = place_blocks(before);
    let new = place_blocks(after);
    let mut changes = Vec::new();
    let exercise = |block: &GutenbergBlock| {
        blocks::is_exercise(block)
            .then(|| blocks::exercise_id(block))
            .flatten()
    };

    let mut order: Vec<Uuid> = Vec::new();
    for page in before.iter().chain(after) {
        for id in blocks::all_ids(&page.blocks) {
            if !order.contains(&id) {
                order.push(id);
            }
        }
    }
    for id in order {
        match (old.get(&id), new.get(&id)) {
            (Some(o), None) => changes.push(BlockChange {
                block_id: id,
                name: o.block.name.clone(),
                kind: ChangeKind::Removed,
                page_before: Some(o.page),
                page_after: None,
                exercise_id: exercise(o.block),
                changed_fields: Vec::new(),
                is_moved: false,
            }),
            (None, Some(n)) => changes.push(BlockChange {
                block_id: id,
                name: n.block.name.clone(),
                kind: ChangeKind::Added,
                page_before: None,
                page_after: Some(n.page),
                exercise_id: exercise(n.block),
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
                let new_previous_existed = n.previous_sibling.is_none_or(|p| old.contains_key(&p));
                let is_moved = o.page != n.page
                    || o.parent != n.parent
                    || (new_previous_existed
                        && o.previous_sibling != n.previous_sibling
                        && !previous_was_removed(o.previous_sibling, &new));
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
                    exercise_id: exercise(n.block),
                    changed_fields,
                    is_moved,
                });
            }
            (None, None) => {}
        }
    }
    changes
}

/// A block whose previous sibling disappeared hasn't moved just because of that.
fn previous_was_removed(previous: Option<Uuid>, new: &HashMap<Uuid, Placed>) -> bool {
    previous.is_some_and(|p| !new.contains_key(&p))
}

struct EntityState {
    entity_type: EntityType,
    parent: Option<Uuid>,
    previous_sibling: Option<Uuid>,
    fields: Vec<(&'static str, Value)>,
}

fn structure_states(doc: &CourseStructure) -> Vec<(Uuid, EntityState)> {
    let mut states = Vec::new();
    let page_state = |p: &crate::engine::course_structure::StructurePage,
                      parent: Option<Uuid>,
                      previous: Option<Uuid>| EntityState {
        entity_type: EntityType::Page,
        parent,
        previous_sibling: previous,
        fields: vec![
            ("title", json!(p.title)),
            ("url_path", json!(p.url_path)),
            ("hidden", json!(p.hidden)),
        ],
    };
    for (index, page) in doc.course.pages.iter().enumerate() {
        let previous = index.checked_sub(1).map(|i| doc.course.pages[i].id);
        states.push((page.id, page_state(page, None, previous)));
    }
    for (module_index, module) in doc.course.modules.iter().enumerate() {
        states.push((
            module.id,
            EntityState {
                entity_type: EntityType::Module,
                parent: None,
                previous_sibling: module_index
                    .checked_sub(1)
                    .map(|i| doc.course.modules[i].id),
                fields: vec![("name", json!(module.name))],
            },
        ));
        for (chapter_index, chapter) in module.chapters.iter().enumerate() {
            states.push((
                chapter.id,
                EntityState {
                    entity_type: EntityType::Chapter,
                    parent: Some(module.id),
                    previous_sibling: chapter_index.checked_sub(1).map(|i| module.chapters[i].id),
                    fields: vec![
                        ("name", json!(chapter.name)),
                        ("color", json!(chapter.color)),
                        ("opens_at", json!(chapter.opens_at)),
                        ("deadline", json!(chapter.deadline)),
                        ("chapter_number", json!(chapter.chapter_number)),
                    ],
                },
            ));
            for (index, page) in chapter.pages.iter().enumerate() {
                let previous = index.checked_sub(1).map(|i| chapter.pages[i].id);
                states.push((page.id, page_state(page, Some(chapter.id), previous)));
            }
        }
    }
    states
}

fn diff_states(
    before: Vec<(Uuid, EntityState)>,
    after: Vec<(Uuid, EntityState)>,
) -> Vec<EntityChange> {
    let old: HashMap<Uuid, &EntityState> = before.iter().map(|(id, s)| (*id, s)).collect();
    let new: HashMap<Uuid, &EntityState> = after.iter().map(|(id, s)| (*id, s)).collect();
    let mut changes = Vec::new();
    for (id, state) in &before {
        if !new.contains_key(id) {
            changes.push(EntityChange {
                entity_type: state.entity_type,
                entity_id: *id,
                kind: ChangeKind::Removed,
                fields: Vec::new(),
                parent_before: state.parent,
                parent_after: None,
                is_moved: false,
            });
        }
    }
    for (id, state) in &after {
        let Some(previous) = old.get(id) else {
            changes.push(EntityChange {
                entity_type: state.entity_type,
                entity_id: *id,
                kind: ChangeKind::Added,
                fields: state
                    .fields
                    .iter()
                    .map(|(f, v)| FieldChange {
                        field: f.to_string(),
                        before: Value::Null,
                        after: v.clone(),
                    })
                    .collect(),
                parent_before: None,
                parent_after: state.parent,
                is_moved: false,
            });
            continue;
        };
        let fields: Vec<FieldChange> = state
            .fields
            .iter()
            .zip(previous.fields.iter())
            .filter(|((_, a), (_, b))| a != b)
            .map(|((field, a), (_, b))| FieldChange {
                field: field.to_string(),
                before: b.clone(),
                after: a.clone(),
            })
            .collect();
        let sibling_moved = state.previous_sibling != previous.previous_sibling
            && state.previous_sibling.is_none_or(|p| old.contains_key(&p))
            && previous
                .previous_sibling
                .is_none_or(|p| new.contains_key(&p));
        let is_moved = state.parent != previous.parent || sibling_moved;
        let only_renumbered = fields.iter().all(|f| f.field == "chapter_number");
        if fields.is_empty() && !is_moved {
            continue;
        }
        changes.push(EntityChange {
            entity_type: state.entity_type,
            entity_id: *id,
            kind: if fields.is_empty() || (only_renumbered && is_moved) {
                ChangeKind::Moved
            } else {
                ChangeKind::Changed
            },
            fields,
            parent_before: previous.parent,
            parent_after: state.parent,
            is_moved,
        });
    }
    changes
}

fn diff_structure(before: &CourseStructure, after: &CourseStructure) -> Vec<EntityChange> {
    diff_states(structure_states(before), structure_states(after))
}

fn settings_states(doc: &CourseSettings) -> Vec<(Uuid, EntityState)> {
    let course = &doc.course;
    let mut states = vec![(
        course.id,
        EntityState {
            entity_type: EntityType::Course,
            parent: None,
            previous_sibling: None,
            fields: vec![
                ("name", json!(course.name)),
                ("description", json!(course.description)),
                ("is_unlisted", json!(course.is_unlisted)),
                (
                    "chapter_locking_enabled",
                    json!(course.chapter_locking_enabled),
                ),
                (
                    "base_module_completion_requires_n_submodule_completions",
                    json!(course.base_module_completion_requires_n_submodule_completions),
                ),
                ("ai_policy", json!(course.ai_policy)),
            ],
        },
    )];
    for audience in &course.audiences {
        states.push((
            audience.id,
            EntityState {
                entity_type: EntityType::Audience,
                parent: None,
                previous_sibling: None,
                fields: vec![("name", json!(audience.name))],
            },
        ));
    }
    for module in &doc.modules {
        states.push((
            module.id,
            EntityState {
                entity_type: EntityType::ModuleSettings,
                parent: None,
                previous_sibling: None,
                fields: vec![
                    ("completion_policy", json!(module.completion_policy)),
                    ("certification_enabled", json!(module.certification_enabled)),
                ],
            },
        ));
    }
    states
}

fn diff_settings(before: &CourseSettings, after: &CourseSettings) -> Vec<EntityChange> {
    diff_states(settings_states(before), settings_states(after))
}

fn glossary_states(doc: &GlossaryAndReferences) -> Vec<(Uuid, EntityState)> {
    doc.glossary
        .iter()
        .map(|t| {
            (
                t.id,
                EntityState {
                    entity_type: EntityType::GlossaryTerm,
                    parent: None,
                    previous_sibling: None,
                    fields: vec![("term", json!(t.term)), ("definition", json!(t.definition))],
                },
            )
        })
        .chain(doc.references.iter().map(|r| {
            (
                r.id,
                EntityState {
                    entity_type: EntityType::Reference,
                    parent: None,
                    previous_sibling: None,
                    fields: vec![
                        ("citation_key", json!(r.citation_key)),
                        ("bibtex", json!(r.bibtex)),
                    ],
                },
            )
        }))
        .collect()
}

fn diff_glossary(
    before: &GlossaryAndReferences,
    after: &GlossaryAndReferences,
) -> Vec<EntityChange> {
    diff_states(glossary_states(before), glossary_states(after))
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::*;
    use crate::engine::PageType;
    use crate::test_fixtures::{exercise, id, infobox, page, para};

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
        let result = diff(
            &Snapshot {
                pages: before(),
                ..Default::default()
            },
            &Snapshot {
                pages: after,
                ..Default::default()
            },
        );
        let kinds: Vec<(Uuid, ChangeKind)> =
            result.blocks.iter().map(|b| (b.block_id, b.kind)).collect();
        assert_eq!(
            kinds,
            vec![
                (id("p1"), ChangeKind::Removed),
                (id("p2"), ChangeKind::Changed),
                (id("ex1"), ChangeKind::Moved),
                (id("new"), ChangeKind::Added)
            ]
        );
        let exercise_move = &result.blocks[2];
        assert_eq!(
            (exercise_move.page_before, exercise_move.page_after),
            (Some(id("pg1")), Some(id("pg2")))
        );
        assert_eq!(exercise_move.exercise_id, Some(id("e1")));
        assert_eq!(
            result.blocks[1].changed_fields,
            vec!["attributes/content".to_string()]
        );
        assert_eq!(result.pages_with_block_changes().len(), 2);
    }

    #[test]
    fn reordering_siblings_is_a_move() {
        let mut after = before();
        after[0].blocks.swap(0, 1);
        let result = diff(
            &Snapshot {
                pages: before(),
                ..Default::default()
            },
            &Snapshot {
                pages: after,
                ..Default::default()
            },
        );
        assert!(result.blocks.iter().all(|b| b.kind == ChangeKind::Moved));
        assert!(!result.is_empty());
    }

    #[test]
    fn unchanged_is_empty() {
        let result = diff(
            &Snapshot {
                pages: before(),
                ..Default::default()
            },
            &Snapshot {
                pages: before(),
                ..Default::default()
            },
        );
        assert!(result.is_empty());
    }
}
