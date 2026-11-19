//! Read selectors shared by `get_page_content`, `get_course_structure` and `read_back`.
//!
//! Results carry ids and ready-made paths only; offsets exist in requests, and a paged read
//! continues from an id-anchored `next` selector.

use std::collections::HashMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use super::error::{EditError, EditErrorCode};
use crate::diff::ChangeKind;

mod page;
mod structure;
mod window;

pub(crate) use page::block_preview;
pub use page::read_page;
pub use structure::read_structure;

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

/// How much of each item a read returns.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReadMode {
    /// Ids, types and short previews.
    #[default]
    Outline,
    /// The stored JSON.
    Raw,
}

/// Which state of the course a read sees.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReadState {
    #[default]
    Staged,
    Published,
}

/// Why a read returned fewer items than its selector covers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StopReason {
    Limit,
    Budget,
}

/// Read settings the caller derives from the client and the staged changeset.
#[derive(Debug, Clone, Copy)]
pub struct ReadOptions<'a> {
    /// Serialized size the returned units may use; whole units only.
    pub budget_bytes: usize,
    /// How staged blocks or entities differ from the published ones, to mark them; `None` marks
    /// nothing.
    pub pending: Option<&'a HashMap<Uuid, ChangeKind>>,
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
    /// The result of reading one item or field at `selector`, with no paging.
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

/// The result of reading one field.
pub(crate) fn field_result(selector: &Selector, value: Value) -> ReadResult {
    ReadResult {
        value: Some(value),
        ..ReadResult::single(selector, Vec::new())
    }
}
