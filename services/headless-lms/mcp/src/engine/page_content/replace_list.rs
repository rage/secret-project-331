//! Replacing a children list with stubs, existing blocks and new blocks, and parsing new blocks.

use std::collections::{HashMap, HashSet};

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use super::address::ListRef;
use super::{Editor, check_creatable, exercise_read_only};
use crate::engine::blocks;
use crate::engine::error::{EditError, EditErrorCode, Warning, WarningCode};
use crate::engine::labels::{label_field, parse_uuid};
use crate::engine::read::RENDERED_BLOCK_KEYS;
use crate::engine::reject_unknown_keys;

/// The stored fields of a block.
const BLOCK_FIELDS: [&str; 5] = ["clientId", "name", "attributes", "innerBlocks", "isValid"];

/// What a new block may have; a `clientId` is replaced by a new one.
const NEW_BLOCK_KEYS: [&str; 6] = [
    "name",
    "attributes",
    "innerBlocks",
    "label",
    "clientId",
    "isValid",
];

/// A parsed entry of a list-replace value, or of a new block's `innerBlocks`.
pub(super) enum ListEntry {
    /// `{"clientId": …}` alone: the existing block as it is.
    Stub(Uuid),
    /// An existing block with the fields given replaced.
    Existing {
        id: Uuid,
        name: Option<String>,
        attributes: Option<Map<String, Value>>,
        inner: Option<Vec<ListEntry>>,
    },
    New {
        name: String,
        attributes: Map<String, Value>,
        label: Option<String>,
        /// The `clientId` an added block was sent with; it gets a new one.
        ignored_client_id: Option<Value>,
        inner: Vec<ListEntry>,
    },
}

impl Editor<'_> {
    /// Replaces the children of `list` with `entries`. Existing blocks they name move into the list;
    /// every block the list held must be named, so nothing is deleted by omission.
    pub(super) fn replace_list(
        &mut self,
        list: ListRef,
        entries: Vec<ListEntry>,
    ) -> Result<(), EditError> {
        let parent_path = self.list_parent_path(list)?;
        let doc = &self.pages[list.page].blocks;
        let locations = check_list_entries(doc, &parent_path, &entries)?;
        let existing: HashMap<Uuid, GutenbergBlock> = locations
            .iter()
            .map(|(id, path)| (*id, blocks::get(doc, path).clone()))
            .collect();
        let new_list = self.build_entries(entries, &existing)?;

        let from_elsewhere: Vec<Uuid> = locations
            .iter()
            .filter(|(_, path)| !(path.len() > parent_path.len() && path.starts_with(&parent_path)))
            .map(|(id, _)| *id)
            .collect();
        let doc = &mut self.pages[list.page].blocks;
        for id in from_elsewhere {
            if let Some(path) = blocks::find_path(doc, id) {
                blocks::list_mut(doc, &path[..path.len() - 1]).remove(path[path.len() - 1]);
            }
        }
        // Taking blocks from before the list shifts its index path.
        let parent_path = self.list_parent_path(list)?;
        *blocks::list_mut(&mut self.pages[list.page].blocks, &parent_path) = new_list;
        Ok(())
    }

    fn build_entries(
        &mut self,
        entries: Vec<ListEntry>,
        existing: &HashMap<Uuid, GutenbergBlock>,
    ) -> Result<Vec<GutenbergBlock>, EditError> {
        entries
            .into_iter()
            .map(|entry| self.build_entry(entry, existing))
            .collect()
    }

    /// The block `entry` describes; `existing` holds the blocks its stubs and ids name.
    pub(super) fn build_entry(
        &mut self,
        entry: ListEntry,
        existing: &HashMap<Uuid, GutenbergBlock>,
    ) -> Result<GutenbergBlock, EditError> {
        match entry {
            ListEntry::Stub(id) => Ok(existing[&id].clone()),
            ListEntry::Existing {
                id,
                name,
                attributes,
                inner,
            } => {
                let block = &existing[&id];
                let name = name.unwrap_or_else(|| block.name.clone());
                check_creatable(&name)?;
                let attributes = attributes.unwrap_or_else(|| block.attributes.clone());
                let inner_blocks = match inner {
                    Some(inner) => self.build_entries(inner, existing)?,
                    None => block.inner_blocks.clone(),
                };
                Ok(GutenbergBlock {
                    client_id: id,
                    name,
                    is_valid: true,
                    attributes,
                    inner_blocks,
                })
            }
            ListEntry::New {
                name,
                attributes,
                label,
                ignored_client_id,
                inner,
            } => {
                let id = self.ids.new_id();
                if let Some(sent) = ignored_client_id {
                    self.warnings.push(Warning::new(
                        WarningCode::IgnoredClientId,
                        format!(
                            "clientId {sent} on a new block was replaced by {id}; the server assigns ids, and existing blocks are relocated with move"
                        ),
                    ));
                }
                if let Some(label) = label {
                    self.labels.define(&label, id)?;
                }
                let inner_blocks = self.build_entries(inner, existing)?;
                Ok(GutenbergBlock {
                    client_id: id,
                    name,
                    is_valid: true,
                    attributes,
                    inner_blocks,
                })
            }
        }
    }
}

/// Checks a list-replace value against the page and returns where each existing block it names
/// is now. The list is the children of the block at `parent_path`, or the top level.
fn check_list_entries(
    doc: &[GutenbergBlock],
    parent_path: &[usize],
    entries: &[ListEntry],
) -> Result<HashMap<Uuid, Vec<usize>>, EditError> {
    let mut referenced: Vec<(Uuid, bool)> = Vec::new();
    collect_references(entries, &mut referenced);
    let mut seen = HashSet::new();
    let duplicates: Vec<String> = referenced
        .iter()
        .filter(|(id, _)| !seen.insert(*id))
        .map(|(id, _)| id.to_string())
        .collect();
    if !duplicates.is_empty() {
        return Err(EditError::new(
            EditErrorCode::DuplicateIds,
            "each existing block may appear once in the value",
        )
        .with_details(json!({"duplicate_ids": duplicates})));
    }

    let mut locations: HashMap<Uuid, Vec<usize>> = HashMap::new();
    let mut unknown = Vec::new();
    for (id, _) in &referenced {
        match blocks::find_path(doc, *id) {
            Some(path) => {
                locations.insert(*id, path);
            }
            None => unknown.push(id.to_string()),
        }
    }
    if !unknown.is_empty() {
        return Err(EditError::new(
            EditErrorCode::UnknownIds,
            format!("these ids aren't on this page: {}", unknown.join(", ")),
        )
        .with_fix("leave clientId out of new blocks; blocks on other pages are brought over with move and to_page")
        .with_details(json!({"unknown_ids": unknown})));
    }

    for depth in 1..=parent_path.len() {
        let ancestor = blocks::get(doc, &parent_path[..depth]).client_id;
        if locations.contains_key(&ancestor) {
            return Err(EditError::new(
                EditErrorCode::MoveIntoItself,
                format!(
                    "/{ancestor} contains the list being replaced, so it can't be placed inside it"
                ),
            ));
        }
    }

    let stubs: HashSet<Uuid> = referenced
        .iter()
        .filter(|(_, is_stub)| *is_stub)
        .map(|(id, _)| *id)
        .collect();
    for (id, path) in &locations {
        if let Some(holder) = blocks::ancestor_ids(doc, path)
            .into_iter()
            .find(|a| stubs.contains(a))
        {
            return Err(EditError::new(
                EditErrorCode::DuplicateIds,
                format!("/{id} is inside /{holder}, whose stub already keeps it"),
            )
            .with_fix(format!(
                "give /{holder} as a full block with innerBlocks, or drop the separate /{id}"
            )));
        }
    }

    let mut required: Vec<Uuid> = blocks::list(doc, parent_path)
        .iter()
        .map(|b| b.client_id)
        .collect();
    collect_required_children(entries, doc, &locations, &mut required)?;
    let missing: Vec<String> = required
        .iter()
        .filter(|id| !locations.contains_key(id))
        .map(|id| id.to_string())
        .collect();
    if !missing.is_empty() {
        let stubs = missing
            .iter()
            .map(|id| format!("{{\"clientId\":\"{id}\"}}"))
            .collect::<Vec<_>>()
            .join(",");
        return Err(EditError::new(
            EditErrorCode::MissingIds,
            format!(
                "the value leaves out existing blocks: {}; deletions need an explicit remove",
                missing.join(", ")
            ),
        )
        .with_fix(format!(
            "keep them with stubs ({stubs}), or remove them with separate remove ops"
        ))
        .with_details(json!({"missing_ids": missing})));
    }

    for (id, path) in &locations {
        let is_given_in_full = !stubs.contains(id);
        if blocks::is_in_exercise(doc, path, is_given_in_full) {
            return Err(exercise_read_only("replace it"));
        }
    }
    Ok(locations)
}

/// The existing blocks `entries` name, with whether each is named by a stub.
fn collect_references(entries: &[ListEntry], out: &mut Vec<(Uuid, bool)>) {
    for entry in entries {
        match entry {
            ListEntry::Stub(id) => out.push((*id, true)),
            ListEntry::Existing { id, inner, .. } => {
                out.push((*id, false));
                if let Some(inner) = inner {
                    collect_references(inner, out);
                }
            }
            ListEntry::New { inner, .. } => collect_references(inner, out),
        }
    }
}

/// Existing children of fully replaced blocks must be accounted for, like the replaced list's own.
fn collect_required_children(
    entries: &[ListEntry],
    doc: &[GutenbergBlock],
    locations: &HashMap<Uuid, Vec<usize>>,
    required: &mut Vec<Uuid>,
) -> Result<(), EditError> {
    for entry in entries {
        match entry {
            ListEntry::Stub(_) => {}
            ListEntry::Existing { id, inner, .. } => {
                let existing = blocks::get(doc, &locations[id]);
                match inner {
                    Some(inner) => {
                        required.extend(existing.inner_blocks.iter().map(|b| b.client_id));
                        collect_required_children(inner, doc, locations, required)?;
                    }
                    None if !existing.inner_blocks.is_empty() => {
                        let stubs = existing
                            .inner_blocks
                            .iter()
                            .map(|b| format!("{{\"clientId\":\"{}\"}}", b.client_id))
                            .collect::<Vec<_>>()
                            .join(",");
                        return Err(EditError::new(
                            EditErrorCode::MissingField,
                            format!("/{id} has inner blocks, so its replacement needs innerBlocks"),
                        )
                        .with_fix(format!("pass \"innerBlocks\":[{stubs}] to keep them")));
                    }
                    None => {}
                }
            }
            ListEntry::New { inner, .. } => {
                collect_required_children(inner, doc, locations, required)?
            }
        }
    }
    Ok(())
}

pub(super) fn parse_list_entries(value: &Value, what: &str) -> Result<Vec<ListEntry>, EditError> {
    let Value::Array(items) = value else {
        return Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!(
                "replacing {what} takes an array of blocks; to replace one block use its own path"
            ),
        ));
    };
    items.iter().map(parse_list_entry).collect()
}

/// One entry of a list-replace value: a stub, an existing block by `clientId`, or a new block.
pub(super) fn parse_list_entry(value: &Value) -> Result<ListEntry, EditError> {
    let object = value.as_object().ok_or_else(|| {
        EditError::new(
            EditErrorCode::InvalidValue,
            "each item is a block object or a {\"clientId\":\"…\"} stub",
        )
    })?;
    let Some(raw) = object.get("clientId") else {
        return parse_new_entry(object, &parse_list_entry);
    };
    let id = raw
        .as_str()
        .ok_or_else(|| EditError::new(EditErrorCode::InvalidValue, "clientId is a string"))?;
    let id = parse_uuid(id, id)?;
    let is_stub = object
        .keys()
        .all(|k| k == "clientId" || RENDERED_BLOCK_KEYS.contains(&k.as_str()));
    if is_stub {
        return Ok(ListEntry::Stub(id));
    }
    let allowed: Vec<&str> = BLOCK_FIELDS
        .iter()
        .chain(&RENDERED_BLOCK_KEYS)
        .copied()
        .collect();
    check_block_keys(object, &allowed)?;
    let name = match object.get("name") {
        None => None,
        Some(_) => Some(block_name(object)?),
    };
    Ok(ListEntry::Existing {
        id,
        name,
        attributes: block_attributes(object)?,
        inner: parse_inner_blocks(object, &parse_list_entry)?,
    })
}

/// A block an `add` or `wrap` creates. Its inner blocks are new too, whatever ids they carry.
pub(super) fn parse_new_block(value: &Value) -> Result<ListEntry, EditError> {
    let object = value.as_object().ok_or_else(|| {
        EditError::new(
            EditErrorCode::InvalidValue,
            "a block is an object like {\"name\":\"core/paragraph\",\"attributes\":{\"content\":\"…\"}}",
        )
    })?;
    parse_new_entry(object, &parse_new_block)
}

/// A new block; `parse_child` parses each of its inner blocks.
fn parse_new_entry(
    object: &Map<String, Value>,
    parse_child: &dyn Fn(&Value) -> Result<ListEntry, EditError>,
) -> Result<ListEntry, EditError> {
    check_block_keys(object, &NEW_BLOCK_KEYS)?;
    let name = block_name(object)?;
    check_creatable(&name)?;
    Ok(ListEntry::New {
        name,
        attributes: block_attributes(object)?.unwrap_or_default(),
        label: label_field(object, "$box")?,
        ignored_client_id: object.get("clientId").cloned(),
        inner: parse_inner_blocks(object, parse_child)?.unwrap_or_default(),
    })
}

/// The block's `innerBlocks`, `None` when it has none.
fn parse_inner_blocks(
    object: &Map<String, Value>,
    parse_child: &dyn Fn(&Value) -> Result<ListEntry, EditError>,
) -> Result<Option<Vec<ListEntry>>, EditError> {
    match object.get("innerBlocks") {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Array(items)) => items
            .iter()
            .map(parse_child)
            .collect::<Result<_, _>>()
            .map(Some),
        Some(_) => Err(EditError::new(
            EditErrorCode::InvalidValue,
            "innerBlocks must be an array of blocks",
        )),
    }
}

fn check_block_keys(object: &Map<String, Value>, allowed: &[&str]) -> Result<(), EditError> {
    reject_unknown_keys(object, allowed, "a block").map_err(|error| {
        error.with_fix(format!(
            "block fields are: {}; block-specific values go inside attributes",
            allowed.join(", ")
        ))
    })
}

fn block_name(object: &Map<String, Value>) -> Result<String, EditError> {
    match object.get("name") {
        Some(Value::String(name)) if name.contains('/') => Ok(name.clone()),
        Some(Value::String(name)) => Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!("block name \"{name}\" needs its namespace"),
        )
        .with_fix(format!("core/{name} or moocfi/{name}"))),
        Some(_) => Err(EditError::new(
            EditErrorCode::InvalidValue,
            "name is a string",
        )),
        None => Err(EditError::new(
            EditErrorCode::MissingField,
            "a new block needs \"name\", e.g. \"core/paragraph\"",
        )),
    }
}

fn block_attributes(object: &Map<String, Value>) -> Result<Option<Map<String, Value>>, EditError> {
    match object.get("attributes") {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Object(attributes)) => Ok(Some(attributes.clone())),
        Some(_) => Err(EditError::new(
            EditErrorCode::InvalidValue,
            "attributes is an object",
        )),
    }
}
