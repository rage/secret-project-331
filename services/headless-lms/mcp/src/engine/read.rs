//! Read selectors shared by `get_page_content`, `get_course_structure` and `read_back`.
//!
//! Results carry ids and ready-made paths only; offsets exist in requests, and a paged read
//! continues from an id-anchored `next` selector.

use std::collections::HashMap;

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use uuid::Uuid;

use super::PageDocument;
use super::blocks;
use super::error::{EditError, EditErrorCode};
use super::labels::parse_uuid;
use super::page_content::unescape_pointer;
use crate::text::{plain_text, preview};

/// What to read. All fields are optional; an empty selector is an outline of the whole page or course.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Selector {
    /// A block or entity (`/p1`), a field (`/p1/attributes/content`, `/ch3/deadline`) or a children list (`/box1/innerBlocks`, `/ch3/pages`); `""` is the page's top level.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// Last sibling (inclusive) of a range starting at `path`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub through: Option<String>,
    /// Siblings to include on each side of `path`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub around: Option<u32>,
    /// Start of a window over a children list.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offset: Option<u32>,
    /// Most items to return, from `offset` or from the block at `path`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<ReadMode>,
    /// `staged` (default) includes changes waiting to be published; `published` is what students see.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<ReadState>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReadMode {
    /// Ids, types and short previews.
    #[default]
    Outline,
    /// The stored JSON.
    Raw,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReadState {
    #[default]
    Staged,
    Published,
}

/// How a staged block or entity differs from the published version.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PendingKind {
    Added,
    Changed,
    Moved,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StopReason {
    Limit,
    Budget,
}

/// Read settings the caller derives from the client and the staged changeset.
#[derive(Debug, Clone)]
pub struct ReadOptions {
    /// Serialized size the returned units may use; whole units only.
    pub budget_bytes: usize,
    pub pending: HashMap<Uuid, PendingKind>,
}

impl Default for ReadOptions {
    fn default() -> Self {
        Self {
            budget_bytes: 24_000,
            pending: HashMap::new(),
        }
    }
}

/// One selector's result.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ReadResult {
    pub selector: Selector,
    /// Length of the children list a window or range was taken from.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<usize>,
    /// The children list holding the returned items, when it isn't the top level.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<Value>,
    /// A single field's value, for field paths.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<Value>,
    pub has_more: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next: Option<Selector>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stopped_by: Option<StopReason>,
}

impl ReadResult {
    pub(crate) fn single(selector: &Selector, items: Vec<Value>) -> Self {
        Self {
            selector: selector.clone(),
            total: None,
            parent: None,
            items,
            value: None,
            has_more: false,
            next: None,
            stopped_by: None,
        }
    }
}

/// Rejects selector field combinations that have no meaning.
pub(crate) fn check_selector(selector: &Selector) -> Result<(), EditError> {
    let ranged = [
        selector.through.is_some(),
        selector.around.is_some(),
        selector.offset.is_some(),
    ];
    if ranged.iter().filter(|b| **b).count() > 1 {
        return Err(EditError::new(
            EditErrorCode::InvalidValue,
            "use one of through, around and offset per selector",
        ));
    }
    if selector.limit == Some(0) {
        return Err(EditError::new(
            EditErrorCode::InvalidValue,
            "limit must be at least 1",
        ));
    }
    Ok(())
}

enum PageAddress {
    List(Option<Uuid>),
    Block(Uuid),
    Field(Uuid, Vec<String>),
}

fn page_address(page: &PageDocument, path: &str) -> Result<PageAddress, EditError> {
    if path.is_empty() || path == "/" {
        return Ok(PageAddress::List(None));
    }
    let rest = path.strip_prefix('/').ok_or_else(|| {
        EditError::new(
            EditErrorCode::InvalidPath,
            format!("path \"{path}\" must start with /"),
        )
    })?;
    let segments: Vec<String> = rest.split('/').map(unescape_pointer).collect();
    if segments[0].starts_with('$') {
        return Err(EditError::new(
            EditErrorCode::LabelUndefined,
            "labels only exist inside the call that created them; use the returned ids",
        ));
    }
    let id = parse_uuid(&segments[0], path)?;
    if blocks::find_path(&page.blocks, id).is_none() {
        return Err(EditError::new(
            EditErrorCode::NotFound,
            format!("no block {id} on this page"),
        )
        .with_fix("read the outline (no path) to get current ids"));
    }
    match segments.get(1).map(String::as_str) {
        None => Ok(PageAddress::Block(id)),
        Some("innerBlocks") if segments.len() == 2 => Ok(PageAddress::List(Some(id))),
        Some("innerBlocks") => Err(EditError::new(
            EditErrorCode::NumericIndex,
            "children are addressed by id; use offset and limit for windows",
        )),
        Some("attributes" | "name") => Ok(PageAddress::Field(id, segments[1..].to_vec())),
        Some(other) => Err(EditError::new(
            EditErrorCode::InvalidPath,
            format!("blocks have no \"{other}\""),
        )
        .with_fix(format!("/{id}/attributes/{other}"))),
    }
}

/// Runs one selector against a page.
pub fn read_page(
    page: &PageDocument,
    selector: &Selector,
    options: &ReadOptions,
) -> Result<ReadResult, EditError> {
    check_selector(selector)?;
    let mode = selector.mode.unwrap_or_default();
    let path = selector.path.as_deref().unwrap_or("");
    let render = |block: &GutenbergBlock| render_block(block, mode, &options.pending);
    match page_address(page, path)? {
        PageAddress::Field(id, segments) => {
            reject_window(selector, "a field")?;
            let location = blocks::find_path(&page.blocks, id).unwrap_or_default();
            let block = blocks::get(&page.blocks, &location);
            let value = if segments[0] == "name" {
                Some(Value::String(block.name.clone()))
            } else {
                let mut current = Value::Object(block.attributes.clone());
                for segment in &segments[1..] {
                    current = match &current {
                        Value::Object(map) => map.get(segment).cloned(),
                        Value::Array(items) => segment
                            .parse::<usize>()
                            .ok()
                            .and_then(|i| items.get(i).cloned()),
                        _ => None,
                    }
                    .ok_or_else(|| {
                        EditError::new(EditErrorCode::NotFound, format!("{path} isn't set"))
                    })?;
                }
                Some(current)
            };
            Ok(ReadResult {
                value,
                ..ReadResult::single(selector, Vec::new())
            })
        }
        PageAddress::List(parent) => {
            if selector.through.is_some() || selector.around.is_some() {
                return Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    "through and around start from a block path, not a list",
                ));
            }
            let parent_path = parent
                .and_then(|id| blocks::find_path(&page.blocks, id))
                .unwrap_or_default();
            let list = blocks::list(&page.blocks, &parent_path);
            let start = selector.offset.unwrap_or(0) as usize;
            let end = selector
                .limit
                .map(|l| start + l as usize)
                .unwrap_or(list.len());
            Ok(window(
                selector,
                list,
                start,
                end,
                parent.map(|id| format!("/{id}/innerBlocks")),
                options,
                &render,
            ))
        }
        PageAddress::Block(id) => {
            if selector.offset.is_some() {
                return Err(EditError::new(EditErrorCode::InvalidValue, "offset works on a children list; with a block path use limit to read on from that block")
                    .with_fix(format!("{{\"path\":\"/{id}\",\"limit\":20}}")));
            }
            let location = blocks::find_path(&page.blocks, id).unwrap_or_default();
            let parent_path = &location[..location.len() - 1];
            let list = blocks::list(&page.blocks, parent_path);
            let index = location[location.len() - 1];
            let parent = (!parent_path.is_empty()).then(|| {
                format!(
                    "/{}/innerBlocks",
                    blocks::get(&page.blocks, parent_path).client_id
                )
            });
            let (start, end) = if let Some(through) = &selector.through {
                let last = parse_uuid(through.trim_start_matches('/'), through)?;
                let last_location = blocks::find_path(&page.blocks, last).ok_or_else(|| {
                    EditError::new(
                        EditErrorCode::NotFound,
                        format!("no block {last} on this page"),
                    )
                })?;
                if last_location[..last_location.len() - 1] != *parent_path
                    || last_location[last_location.len() - 1] < index
                {
                    return Err(EditError::new(EditErrorCode::InvalidRange, "through must be a later sibling of path")
                        .with_details(json!({"siblings_in_order": list.iter().map(|b| format!("/{}", b.client_id)).collect::<Vec<_>>()})));
                }
                (index, last_location[last_location.len() - 1] + 1)
            } else if let Some(around) = selector.around {
                (
                    index.saturating_sub(around as usize),
                    (index + around as usize + 1).min(list.len()),
                )
            } else if let Some(limit) = selector.limit {
                (index, index + limit as usize)
            } else {
                return Ok(single_unit(
                    selector,
                    render(blocks::get(&page.blocks, &location)),
                    options,
                ));
            };
            Ok(window(selector, list, start, end, parent, options, &render))
        }
    }
}

pub(crate) fn reject_window(selector: &Selector, what: &str) -> Result<(), EditError> {
    if selector.through.is_some()
        || selector.around.is_some()
        || selector.offset.is_some()
        || selector.limit.is_some()
    {
        return Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!("through, around, offset and limit don't apply to {what}"),
        ));
    }
    Ok(())
}

/// A single requested unit; over budget, its children collapse so the agent can descend.
pub(crate) fn single_unit(
    selector: &Selector,
    mut unit: Value,
    options: &ReadOptions,
) -> ReadResult {
    if serialized_len(&unit) > options.budget_bytes {
        collapse_children(&mut unit);
    }
    ReadResult::single(selector, vec![unit])
}

/// Replaces every child list of `unit` (`innerBlocks`, `modules`, `chapters`, `pages`) with a
/// count and the path to read it from.
pub(crate) fn collapse_children(unit: &mut Value) {
    if let Some(object) = unit.as_object_mut() {
        let path = object
            .get("path")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        for key in ["innerBlocks", "modules", "chapters", "pages"] {
            if let Some(Value::Array(children)) = object.get_mut(key) {
                let count = children.len();
                let list_path = if path == "/course" {
                    format!("/course/{key}")
                } else {
                    format!("{path}/{key}")
                };
                *children = vec![json!({"collapsed": count, "path": list_path})];
            }
        }
    }
}

/// Fills a window `[start, end)` of `list` with whole units until the budget runs out.
pub(crate) fn window<T>(
    selector: &Selector,
    list: &[T],
    start: usize,
    end: usize,
    parent: Option<String>,
    options: &ReadOptions,
    render: &dyn Fn(&T) -> Value,
) -> ReadResult
where
    T: HasId,
{
    let end = end.min(list.len());
    let mut items = Vec::new();
    let mut used = 0;
    let mut stopped_by = None;
    let mut next_index = None;
    for (index, item) in list.iter().enumerate().take(end).skip(start) {
        let unit = render(item);
        let size = serialized_len(&unit);
        if !items.is_empty() && used + size > options.budget_bytes {
            stopped_by = Some(StopReason::Budget);
            next_index = Some(index);
            break;
        }
        used += size;
        items.push(unit);
    }
    if stopped_by.is_none()
        && end < list.len()
        && selector.through.is_none()
        && selector.around.is_none()
    {
        stopped_by = Some(StopReason::Limit);
        next_index = Some(end);
    }
    let next = next_index.map(|index| {
        let remaining = selector.limit.map(|limit| {
            let returned = items.len() as u32;
            if stopped_by == Some(StopReason::Budget) {
                limit.saturating_sub(returned).max(1)
            } else {
                limit
            }
        });
        Selector {
            path: Some(format!("/{}", list[index].id())),
            through: if stopped_by == Some(StopReason::Budget) {
                selector.through.clone()
            } else {
                None
            },
            limit: if selector.through.is_some() && stopped_by == Some(StopReason::Budget) {
                None
            } else {
                remaining
            },
            mode: selector.mode,
            state: selector.state,
            ..Selector::default()
        }
    });
    ReadResult {
        selector: selector.clone(),
        total: Some(list.len()),
        parent,
        items,
        value: None,
        has_more: next.is_some(),
        next,
        stopped_by,
    }
}

pub(crate) trait HasId {
    fn id(&self) -> Uuid;
}

impl HasId for GutenbergBlock {
    fn id(&self) -> Uuid {
        self.client_id
    }
}

pub(crate) fn serialized_len(value: &Value) -> usize {
    serde_json::to_vec(value).map(|v| v.len()).unwrap_or(0)
}

const PREVIEW_ATTRIBUTES: [&str; 9] = [
    "content", "title", "text", "caption", "alt", "name", "citation", "value", "label",
];

/// The 40-60 character preview of a block's visible text.
pub fn block_preview(block: &GutenbergBlock) -> Option<String> {
    PREVIEW_ATTRIBUTES
        .iter()
        .filter_map(|key| block.attributes.get(*key).and_then(Value::as_str))
        .map(plain_text)
        .find(|text| !text.is_empty())
        .map(|text| preview(&text, 60))
}

fn render_block(
    block: &GutenbergBlock,
    mode: ReadMode,
    pending: &HashMap<Uuid, PendingKind>,
) -> Value {
    let mut object = Map::new();
    object.insert("clientId".into(), json!(block.client_id));
    object.insert("path".into(), json!(format!("/{}", block.client_id)));
    object.insert("name".into(), json!(block.name));
    match mode {
        ReadMode::Outline => {
            if let Some(preview) = block_preview(block) {
                object.insert("preview".into(), json!(preview));
            }
            if blocks::is_exercise(block)
                && let Some(exercise_id) = blocks::exercise_id(block)
            {
                object.insert("exercise_id".into(), json!(exercise_id));
            }
            if !block.inner_blocks.is_empty() {
                object.insert("children".into(), json!(block.inner_blocks.len()));
                object.insert(
                    "innerBlocks".into(),
                    Value::Array(
                        block
                            .inner_blocks
                            .iter()
                            .map(|b| render_block(b, mode, pending))
                            .collect(),
                    ),
                );
            }
        }
        ReadMode::Raw => {
            object.insert("isValid".into(), json!(block.is_valid));
            object.insert("attributes".into(), Value::Object(block.attributes.clone()));
            object.insert(
                "innerBlocks".into(),
                Value::Array(
                    block
                        .inner_blocks
                        .iter()
                        .map(|b| render_block(b, mode, pending))
                        .collect(),
                ),
            );
        }
    }
    if let Some(kind) = pending.get(&block.client_id) {
        object.insert("pending".into(), json!(kind));
    }
    Value::Object(object)
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::*;
    use crate::engine::PageType;
    use crate::test_fixtures::{exercise, heading, id, infobox, p, page, para};

    fn sample() -> PageDocument {
        let mut blocks = vec![
            heading("h1", "Recursion"),
            infobox(
                "box1",
                vec![
                    para(
                        "c1",
                        "A function that calls itself is called recursive and this text goes on",
                    ),
                    para("c2", "Two"),
                ],
            ),
        ];
        for n in 0..30 {
            blocks.push(para(&format!("p{n}"), &format!("Paragraph number {n}")));
        }
        blocks.push(exercise("ex1", "e1"));
        page("pg1", PageType::CoursePage, blocks)
    }

    fn read(selector: Selector) -> Result<ReadResult, EditError> {
        read_page(&sample(), &selector, &ReadOptions::default())
    }

    #[test]
    fn outline_of_whole_page() {
        let result = read(Selector::default()).unwrap();
        assert_eq!(result.total, Some(33));
        assert!(!result.has_more);
        let boxed = &result.items[1];
        assert_eq!(boxed["children"], json!(2));
        let preview = boxed["innerBlocks"][0]["preview"].as_str().unwrap();
        assert!(preview.chars().count() <= 61 && preview.ends_with('…'));
        assert_eq!(result.items[32]["exercise_id"], json!(id("e1")));
        assert_eq!(result.items[0]["path"], json!(p("h1")));
    }

    #[test]
    fn raw_block_and_attribute() {
        let block = read(Selector {
            path: Some(p("box1")),
            mode: Some(ReadMode::Raw),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(
            block.items[0]["innerBlocks"][1]["attributes"]["content"],
            json!("Two")
        );
        assert_eq!(block.items[0]["innerBlocks"][1]["path"], json!(p("c2")));
        let attribute = read(Selector {
            path: Some(format!("{}/attributes/content", p("h1"))),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(attribute.value, Some(json!("Recursion")));
    }

    #[test]
    fn children_list_range_and_around() {
        let children = read(Selector {
            path: Some(format!("{}/innerBlocks", p("box1"))),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(children.items.len(), 2);
        assert_eq!(children.parent, Some(format!("{}/innerBlocks", p("box1"))));
        let range = read(Selector {
            path: Some(p("p2")),
            through: Some(p("p4")),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(range.items.len(), 3);
        let around = read(Selector {
            path: Some(p("p0")),
            around: Some(1),
            ..Default::default()
        })
        .unwrap();
        let ids: Vec<_> = around.items.iter().map(|i| i["clientId"].clone()).collect();
        assert_eq!(
            ids,
            vec![json!(id("box1")), json!(id("p0")), json!(id("p1"))]
        );
        let reversed = read(Selector {
            path: Some(p("p4")),
            through: Some(p("p2")),
            ..Default::default()
        })
        .unwrap_err();
        assert_eq!(reversed.code, EditErrorCode::InvalidRange);
    }

    #[test]
    fn offset_window_continues_by_id() {
        let first = read(Selector {
            path: Some(String::new()),
            offset: Some(5),
            limit: Some(10),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(first.items.len(), 10);
        assert_eq!(first.stopped_by, Some(StopReason::Limit));
        let next = first.next.clone().unwrap();
        assert_eq!(next.path, Some(p("p13")));
        assert_eq!(next.offset, None);
        let second = read(next).unwrap();
        assert_eq!(second.items[0]["clientId"], json!(id("p13")));
        assert!(
            serde_json::to_string(&first)
                .unwrap()
                .find("\"offset\":5")
                .is_some(),
            "only the echoed request has offsets"
        );
    }

    #[test]
    fn budget_stops_at_whole_units() {
        let options = ReadOptions {
            budget_bytes: 600,
            ..Default::default()
        };
        let result = read_page(
            &sample(),
            &Selector {
                mode: Some(ReadMode::Raw),
                ..Default::default()
            },
            &options,
        )
        .unwrap();
        assert!(result.has_more);
        assert_eq!(result.stopped_by, Some(StopReason::Budget));
        let next = result.next.unwrap();
        let continued = read_page(&sample(), &next, &options).unwrap();
        assert_eq!(continued.items[0]["path"], json!(next.path.unwrap()));
    }

    #[test]
    fn oversized_single_block_collapses_children() {
        let options = ReadOptions {
            budget_bytes: 50,
            ..Default::default()
        };
        let result = read_page(
            &sample(),
            &Selector {
                path: Some(p("box1")),
                mode: Some(ReadMode::Raw),
                ..Default::default()
            },
            &options,
        )
        .unwrap();
        assert_eq!(result.items[0]["innerBlocks"][0]["collapsed"], json!(2));
    }

    #[test]
    fn pending_marks_and_bad_selectors() {
        let options = ReadOptions {
            pending: HashMap::from([(id("h1"), PendingKind::Changed)]),
            ..Default::default()
        };
        let result = read_page(&sample(), &Selector::default(), &options).unwrap();
        assert_eq!(result.items[0]["pending"], json!("changed"));
        assert!(
            read(Selector {
                path: Some(p("h1")),
                offset: Some(2),
                ..Default::default()
            })
            .is_err()
        );
        assert!(
            read(Selector {
                path: Some("/$box".into()),
                ..Default::default()
            })
            .is_err()
        );
        assert!(
            read(Selector {
                through: Some(p("p1")),
                around: Some(1),
                ..Default::default()
            })
            .is_err()
        );
    }
}
