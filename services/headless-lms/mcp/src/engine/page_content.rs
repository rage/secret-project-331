//! `patch_page_content`: block-tree edits on one page, with cross-page `move` and `copy`.

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde::Serialize;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use super::blocks::{self, DISALLOWED_ON_TOP_LEVEL_PAGES, is_exercise, is_exercise_name};
use super::error::{EditError, EditErrorCode, Warning, WarningCode};
use super::labels::{Labels, Reference, parse_reference, parse_uuid};
use super::op::{OpKind, PatchOp, Position};
use super::{CreatedIds, EngineContext, PageDocument, push_created};
use crate::text;

/// The new state after a successful call. Nothing is stored until the caller stages it.
#[derive(Debug, Clone, PartialEq)]
pub struct PageContentResult {
    pub page: PageDocument,
    /// Other pages the call changed through `to_page`.
    pub other_pages: Vec<PageDocument>,
    pub created: Vec<CreatedIds>,
    pub labels: BTreeMap<String, Uuid>,
    pub warnings: Vec<Warning>,
    /// Blocks (with all their descendants) that now live on another page; their feedback and
    /// proposed edits must follow them.
    pub moved_between_pages: Vec<BlockPageMove>,
    /// Exercise blocks a `copy` duplicated; the caller creates the new exercise from the source.
    pub exercise_copies: Vec<ExerciseCopy>,
}

impl PageContentResult {
    /// Every page document the call produced, the edited page first.
    pub fn pages(&self) -> impl Iterator<Item = &PageDocument> {
        std::iter::once(&self.page).chain(self.other_pages.iter())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct BlockPageMove {
    pub block_id: Uuid,
    pub from_page: Uuid,
    pub to_page: Uuid,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ExerciseCopy {
    pub source_exercise_id: Uuid,
    pub new_exercise_id: Uuid,
    pub new_block_id: Uuid,
    pub page_id: Uuid,
}

/// Pages named by `to_page`; the caller loads them into [`EngineContext::pages`].
pub fn referenced_pages(ops: &[PatchOp]) -> Result<Vec<Uuid>, EditError> {
    let mut pages = Vec::new();
    for (index, op) in ops.iter().enumerate() {
        if let Some(raw) = &op.to_page {
            match parse_reference(raw).map_err(|e| e.at_op(index))? {
                Reference::Id(id) => {
                    if !pages.contains(&id) {
                        pages.push(id);
                    }
                }
                Reference::Label(_) => {
                    return Err(EditError::new(
                        EditErrorCode::InvalidValue,
                        "to_page takes a page id; pages are created with patch_course_structure",
                    )
                    .at_op(index));
                }
            }
        }
    }
    Ok(pages)
}

/// Applies `ops` in order on a copy of `page`. Invariants are checked once, after the last op.
pub fn apply(
    page: &PageDocument,
    ops: &[PatchOp],
    ctx: &EngineContext,
) -> Result<PageContentResult, EditError> {
    let mut editor = Editor::new(page, ops, ctx)?;
    for (index, op) in ops.iter().enumerate() {
        editor.op_index = index;
        editor.apply_op(op).map_err(|e| e.at_op(index))?;
    }
    editor.check_invariants()?;
    Ok(editor.finish())
}

/// Resolves `$label` path roots in a selector path after a call, for `read_back`.
pub fn resolve_label_path(
    path: &str,
    labels: &BTreeMap<String, Uuid>,
) -> Result<String, EditError> {
    let Some(rest) = path.strip_prefix("/$") else {
        return Ok(path.to_string());
    };
    let (label, tail) = match rest.find('/') {
        Some(slash) => (&rest[..slash], &rest[slash..]),
        None => (rest, ""),
    };
    let label = format!("${label}");
    labels
        .get(&label)
        .map(|id| format!("/{id}{tail}"))
        .ok_or_else(|| {
            EditError::new(
                EditErrorCode::LabelUndefined,
                format!("read_back uses {label}, which no op in this call defines"),
            )
        })
}

#[derive(Debug, Clone)]
enum Address {
    Root(usize),
    Block(Uuid),
    Children(Uuid),
    Name(Uuid),
    Attributes(Uuid, Vec<String>),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct ListRef {
    page: usize,
    parent: Option<Uuid>,
}

#[derive(Debug, Clone, Copy)]
enum Anchor {
    Before(Uuid),
    After(Uuid),
    Start(ListRef),
    End(ListRef),
}

#[derive(Debug, Clone)]
struct Loc {
    page: usize,
    path: Vec<usize>,
}

impl Loc {
    fn parent_path(&self) -> &[usize] {
        &self.path[..self.path.len() - 1]
    }

    fn index(&self) -> usize {
        self.path[self.path.len() - 1]
    }
}

struct Range {
    page: usize,
    parent_path: Vec<usize>,
    start: usize,
    end: usize,
}

/// A parsed item of an array-replace value.
enum Item {
    Stub(Uuid),
    Full {
        id: Uuid,
        name: Option<String>,
        attributes: Option<Map<String, Value>>,
        inner: Option<Vec<Item>>,
    },
    New {
        name: String,
        attributes: Map<String, Value>,
        label: Option<String>,
        inner: Vec<Item>,
    },
}

struct Editor<'c> {
    pages: Vec<PageDocument>,
    touched: BTreeSet<usize>,
    labels: Labels,
    removed: HashMap<Uuid, usize>,
    created: Vec<CreatedIds>,
    warnings: Vec<Warning>,
    moves: Vec<BlockPageMove>,
    exercise_copies: Vec<ExerciseCopy>,
    ctx: &'c EngineContext<'c>,
    op_index: usize,
}

impl<'c> Editor<'c> {
    fn new(
        page: &PageDocument,
        ops: &[PatchOp],
        ctx: &'c EngineContext<'c>,
    ) -> Result<Self, EditError> {
        let mut pages = vec![page.clone()];
        for page_id in referenced_pages(ops)? {
            if page_id == page.page_id {
                continue;
            }
            let other = ctx.page(page_id).ok_or_else(|| {
                EditError::new(
                    EditErrorCode::PageNotLoaded,
                    format!("to_page {page_id} isn't a page of this course"),
                )
                .with_fix("get_course_structure lists the course's page ids")
            })?;
            pages.push(other.clone());
        }
        Ok(Self {
            pages,
            touched: BTreeSet::from([0]),
            labels: Labels::prescan(ops),
            removed: HashMap::new(),
            created: Vec::new(),
            warnings: Vec::new(),
            moves: Vec::new(),
            exercise_copies: Vec::new(),
            ctx,
            op_index: 0,
        })
    }

    fn finish(mut self) -> PageContentResult {
        let page = self.pages.remove(0);
        let other_pages = self
            .pages
            .into_iter()
            .enumerate()
            .filter(|(index, _)| self.touched.contains(&(index + 1)))
            .map(|(_, page)| page)
            .collect();
        PageContentResult {
            page,
            other_pages,
            created: self.created,
            labels: self.labels.into_map(),
            warnings: self.warnings,
            moved_between_pages: self.moves,
            exercise_copies: self.exercise_copies,
        }
    }

    fn apply_op(&mut self, op: &PatchOp) -> Result<(), EditError> {
        match op.op {
            OpKind::Add => self.add(op),
            OpKind::Remove => self.remove(op),
            OpKind::Replace => self.replace(op),
            OpKind::Move => self.move_or_copy(op, false),
            OpKind::Copy => self.move_or_copy(op, true),
            OpKind::Wrap => self.wrap(op),
            OpKind::Unwrap => self.unwrap(op),
            OpKind::Split => self.split(op),
            OpKind::Merge => self.merge(op),
            OpKind::Reorder => Err(EditError::new(
                EditErrorCode::InvalidOp,
                "patch_page_content doesn't take reorder",
            )),
        }
    }

    // ---- lookup -------------------------------------------------------------------------

    fn locate(&self, id: Uuid) -> Option<Loc> {
        self.pages.iter().enumerate().find_map(|(page, doc)| {
            blocks::find_path(&doc.blocks, id).map(|path| Loc { page, path })
        })
    }

    fn require(&self, id: Uuid) -> Result<Loc, EditError> {
        self.locate(id).ok_or_else(|| self.not_found(id))
    }

    fn not_found(&self, id: Uuid) -> EditError {
        match self.removed.get(&id) {
            Some(op) => EditError::new(
                EditErrorCode::NotFound,
                format!("block {id} was removed by op {op} of this call"),
            ),
            None => EditError::new(
                EditErrorCode::NotFound,
                format!("no block {id} on this page"),
            )
            .with_fix("read the page outline with get_page_content to get current ids"),
        }
    }

    fn block(&self, loc: &Loc) -> &GutenbergBlock {
        blocks::get(&self.pages[loc.page].blocks, &loc.path)
    }

    fn block_mut(&mut self, loc: &Loc) -> &mut GutenbergBlock {
        self.touched.insert(loc.page);
        blocks::get_mut(&mut self.pages[loc.page].blocks, &loc.path)
    }

    fn page_id(&self, page: usize) -> Uuid {
        self.pages[page].page_id
    }

    fn resolve_id(&self, segment: &str, whole: &str) -> Result<Uuid, EditError> {
        if segment.starts_with('$') {
            self.labels.resolve(segment, self.op_index)
        } else {
            parse_uuid(segment, whole)
        }
    }

    fn resolve_reference(&self, raw: &str) -> Result<Uuid, EditError> {
        match parse_reference(raw)? {
            Reference::Label(label) => self.labels.resolve(label, self.op_index),
            Reference::Id(id) => Ok(id),
        }
    }

    fn page_index(&self, page_id: Uuid) -> usize {
        self.pages
            .iter()
            .position(|p| p.page_id == page_id)
            .unwrap_or(0)
    }

    /// Parses a page path. `root_page` is what `""` means: the edited page, or `to_page`.
    fn address(&self, path: &str, root_page: usize) -> Result<Address, EditError> {
        if path.is_empty() || path == "/" || path == "/blocks" {
            return Ok(Address::Root(root_page));
        }
        let Some(rest) = path.strip_prefix('/') else {
            return Err(EditError::new(
                EditErrorCode::InvalidPath,
                format!("path \"{path}\" must start with / (or be \"\" for the page's top level)"),
            )
            .with_fix(format!("/{path}")));
        };
        let segments: Vec<String> = rest.split('/').map(unescape_pointer).collect();
        let first = &segments[0];
        if first.parse::<usize>().is_ok() {
            return Err(self.numeric_index_error(path, root_page, None, first));
        }
        let id = self.resolve_id(first, path)?;
        let loc = self.require(id)?;
        match segments.get(1).map(String::as_str) {
            None => Ok(Address::Block(id)),
            Some("innerBlocks") => match segments.get(2) {
                None => Ok(Address::Children(id)),
                Some(index) => Err(self.numeric_index_error(path, loc.page, Some(&loc), index)),
            },
            Some("attributes") => Ok(Address::Attributes(id, segments[2..].to_vec())),
            Some("name") if segments.len() == 2 => Ok(Address::Name(id)),
            Some(field @ ("clientId" | "isValid")) => Err(EditError::new(
                EditErrorCode::ReadOnlyField,
                format!("{field} is managed by the server"),
            )),
            Some(other) => Err(EditError::new(
                EditErrorCode::InvalidPath,
                format!("blocks have no \"{other}\"; a block path continues with /innerBlocks, /attributes/<name> or /name"),
            )
            .with_fix(format!("/{id}/attributes/{other}"))),
        }
    }

    fn numeric_index_error(
        &self,
        path: &str,
        page: usize,
        parent: Option<&Loc>,
        index: &str,
    ) -> EditError {
        let list: &[GutenbergBlock] = match parent {
            Some(loc) => &self.block(loc).inner_blocks,
            None => &self.pages[page].blocks,
        };
        let current = index
            .parse::<usize>()
            .ok()
            .and_then(|i| list.get(i))
            .map(|b| format!("; that position currently holds /{}", b.client_id))
            .unwrap_or_default();
        let append_hint = if index == "-" {
            "; to append, use position \"end\" on the children list"
        } else {
            ""
        };
        EditError::new(
            EditErrorCode::NumericIndex,
            format!("\"{path}\" uses a numeric index; blocks are addressed by id{current}{append_hint}"),
        )
        .with_fix("use /<id> for a block, or the children list with a position, e.g. {\"path\":\"/box1/innerBlocks\",\"position\":\"end\"}")
    }

    fn siblings(&self, page: usize, parent_path: &[usize]) -> Vec<String> {
        blocks::list(&self.pages[page].blocks, parent_path)
            .iter()
            .take(50)
            .map(|b| format!("/{}", b.client_id))
            .collect()
    }

    /// Fails when `loc` is an exercise block's inside, or (with `include_self`) the exercise block.
    fn check_not_in_exercise(
        &self,
        loc: &Loc,
        include_self: bool,
        action: &str,
    ) -> Result<(), EditError> {
        let doc = &self.pages[loc.page].blocks;
        let end = if include_self {
            loc.path.len()
        } else {
            loc.path.len() - 1
        };
        for depth in 1..=end {
            let block = blocks::get(doc, &loc.path[..depth]);
            if is_exercise_name(&block.name) {
                return Err(exercise_read_only(action));
            }
        }
        Ok(())
    }

    fn check_list_not_in_exercise(&self, list: ListRef, action: &str) -> Result<(), EditError> {
        if let Some(parent) = list.parent {
            let loc = self.require(parent)?;
            self.check_not_in_exercise(&loc, true, action)?;
        }
        Ok(())
    }

    // ---- placement ----------------------------------------------------------------------

    fn anchor(&self, address: &Address, position: Option<Position>) -> Result<Anchor, EditError> {
        let Some(position) = position else {
            return Err(EditError::new(
                EditErrorCode::PositionRequired,
                "this op needs \"position\"",
            )
            .with_fix("position is before/after a sibling (\"path\":\"/p2\") or start/end of a children list (\"path\":\"/box1/innerBlocks\" or \"\" for the page)"));
        };
        match (address, position) {
            (Address::Root(page), Position::Start) => Ok(Anchor::Start(ListRef { page: *page, parent: None })),
            (Address::Root(page), Position::End) => Ok(Anchor::End(ListRef { page: *page, parent: None })),
            (Address::Children(id), Position::Start | Position::End) => {
                let loc = self.require(*id)?;
                let list = ListRef { page: loc.page, parent: Some(*id) };
                self.check_list_not_in_exercise(list, "add blocks inside it")?;
                Ok(if position == Position::Start { Anchor::Start(list) } else { Anchor::End(list) })
            }
            (Address::Block(id), Position::Before | Position::After) => {
                let loc = self.require(*id)?;
                self.check_not_in_exercise(&loc, false, "add blocks inside it")?;
                Ok(if position == Position::Before { Anchor::Before(*id) } else { Anchor::After(*id) })
            }
            (Address::Block(id), Position::Start | Position::End) => Err(EditError::new(
                EditErrorCode::PositionNeedsChildren,
                format!("position \"{}\" needs a children list, not a block", position_name(position)),
            )
            .with_fix(format!("\"path\":\"/{id}/innerBlocks\" to place inside the block, or position before/after to place next to it"))),
            (Address::Root(_), Position::Before | Position::After) => Err(EditError::new(
                EditErrorCode::PositionNeedsSibling,
                "\"\" is the page's top-level list; before/after need a sibling block",
            )
            .with_fix("use position \"start\" or \"end\" with path \"\", or before/after with \"path\":\"/<sibling id>\"")),
            (Address::Children(id), Position::Before | Position::After) => Err(EditError::new(
                EditErrorCode::PositionNeedsSibling,
                format!("/{id}/innerBlocks is a children list; before/after need a sibling block"),
            )
            .with_fix(format!("use position \"start\" or \"end\" with \"/{id}/innerBlocks\", or before/after with the sibling's path"))),
            (Address::Name(_) | Address::Attributes(..), _) => Err(EditError::new(
                EditErrorCode::InvalidPath,
                "blocks are placed next to a block or into a children list, not at an attribute",
            )),
        }
    }

    fn anchor_page(&self, anchor: Anchor) -> Result<usize, EditError> {
        match anchor {
            Anchor::Before(id) | Anchor::After(id) => Ok(self.require(id)?.page),
            Anchor::Start(list) | Anchor::End(list) => Ok(list.page),
        }
    }

    /// (page, parent path, insertion index) for an anchor in the current tree.
    fn resolve_anchor(&self, anchor: Anchor) -> Result<(usize, Vec<usize>, usize), EditError> {
        match anchor {
            Anchor::Before(id) | Anchor::After(id) => {
                let loc = self.require(id)?;
                let index = if matches!(anchor, Anchor::Before(_)) {
                    loc.index()
                } else {
                    loc.index() + 1
                };
                Ok((loc.page, loc.parent_path().to_vec(), index))
            }
            Anchor::Start(list) | Anchor::End(list) => {
                let parent_path = match list.parent {
                    Some(parent) => self.require(parent)?.path,
                    None => Vec::new(),
                };
                let len = blocks::list(&self.pages[list.page].blocks, &parent_path).len();
                let index = if matches!(anchor, Anchor::Start(_)) {
                    0
                } else {
                    len
                };
                Ok((list.page, parent_path, index))
            }
        }
    }

    fn insert(&mut self, anchor: Anchor, new_blocks: Vec<GutenbergBlock>) -> Result<(), EditError> {
        let (page, parent_path, index) = self.resolve_anchor(anchor)?;
        self.touched.insert(page);
        let list = blocks::list_mut(&mut self.pages[page].blocks, &parent_path);
        for (offset, block) in new_blocks.into_iter().enumerate() {
            list.insert(index + offset, block);
        }
        Ok(())
    }

    fn range(&self, first: Uuid, through: Option<Uuid>) -> Result<Range, EditError> {
        let start = self.require(first)?;
        let Some(last_id) = through else {
            return Ok(Range {
                page: start.page,
                parent_path: start.parent_path().to_vec(),
                start: start.index(),
                end: start.index(),
            });
        };
        let end = self.require(last_id)?;
        if start.page != end.page || start.parent_path() != end.parent_path() {
            let parent_of = |loc: &Loc| -> String {
                if loc.path.len() == 1 {
                    "the page's top level (\"\")".to_string()
                } else {
                    format!(
                        "/{}/innerBlocks",
                        blocks::get(&self.pages[loc.page].blocks, loc.parent_path()).client_id
                    )
                }
            };
            return Err(EditError::new(
                EditErrorCode::InvalidRange,
                format!(
                    "a range must be siblings under one parent; /{first} is in {} and /{last_id} is in {}",
                    parent_of(&start),
                    parent_of(&end)
                ),
            )
            .with_details(json!({
                "from_siblings": self.siblings(start.page, start.parent_path()),
                "through_siblings": self.siblings(end.page, end.parent_path()),
            })));
        }
        if end.index() < start.index() {
            return Err(EditError::new(
                EditErrorCode::InvalidRange,
                format!("the range is reversed: /{last_id} comes before /{first}"),
            )
            .with_fix(format!("swap the ends: from /{last_id} through /{first}"))
            .with_details(
                json!({"siblings_in_order": self.siblings(start.page, start.parent_path())}),
            ));
        }
        Ok(Range {
            page: start.page,
            parent_path: start.parent_path().to_vec(),
            start: start.index(),
            end: end.index(),
        })
    }

    fn range_blocks(&self, range: &Range) -> &[GutenbergBlock] {
        &blocks::list(&self.pages[range.page].blocks, &range.parent_path)[range.start..=range.end]
    }

    fn detach(&mut self, range: &Range) -> Vec<GutenbergBlock> {
        self.touched.insert(range.page);
        let list = blocks::list_mut(&mut self.pages[range.page].blocks, &range.parent_path);
        list.drain(range.start..=range.end).collect()
    }

    fn mark_removed(&mut self, removed: &[GutenbergBlock]) {
        for id in blocks::all_ids(removed) {
            self.removed.insert(id, self.op_index);
        }
    }

    fn optional_reference(&self, raw: Option<&String>) -> Result<Option<Uuid>, EditError> {
        raw.map(|r| self.resolve_reference(r)).transpose()
    }

    // ---- new blocks ---------------------------------------------------------------------

    fn new_block(&mut self, value: &Value) -> Result<GutenbergBlock, EditError> {
        let object = value.as_object().ok_or_else(|| {
            EditError::new(
                EditErrorCode::InvalidValue,
                "a block is an object like {\"name\":\"core/paragraph\",\"attributes\":{\"content\":\"…\"}}",
            )
        })?;
        check_block_keys(
            object,
            &[
                "name",
                "attributes",
                "innerBlocks",
                "label",
                "clientId",
                "isValid",
            ],
        )?;
        let name = block_name(object)?;
        check_creatable(&name)?;
        let attributes = block_attributes(object)?.unwrap_or_default();
        let id = self.ctx.ids.new_id();
        if let Some(sent) = object.get("clientId") {
            self.warnings.push(Warning {
                code: WarningCode::IgnoredClientId,
                message: format!(
                    "clientId {sent} on a new block was replaced by {id}; the server assigns ids, and existing blocks are relocated with move"
                ),
                op: Some(self.op_index),
            });
        }
        push_created(&mut self.created, self.op_index, id);
        if let Some(label) = label_of(object)? {
            self.labels.define(&label, id)?;
        }
        let inner_blocks = match object.get("innerBlocks") {
            None | Some(Value::Null) => Vec::new(),
            Some(Value::Array(items)) => items
                .iter()
                .map(|item| self.new_block(item))
                .collect::<Result<Vec<_>, _>>()?,
            Some(_) => {
                return Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    "innerBlocks must be an array of blocks",
                ));
            }
        };
        Ok(GutenbergBlock {
            client_id: id,
            name,
            is_valid: true,
            attributes,
            inner_blocks,
        })
    }

    fn new_values(&mut self, value: &Value) -> Result<Vec<GutenbergBlock>, EditError> {
        match value {
            Value::Array(items) => {
                if items.is_empty() {
                    return Err(EditError::new(
                        EditErrorCode::InvalidValue,
                        "add got an empty list",
                    ));
                }
                items.iter().map(|item| self.new_block(item)).collect()
            }
            Value::Object(_) => Ok(vec![self.new_block(value)?]),
            _ => Err(EditError::new(
                EditErrorCode::InvalidValue,
                "add takes a block object or a list of block objects",
            )),
        }
    }

    // ---- ops ----------------------------------------------------------------------------

    fn add(&mut self, op: &PatchOp) -> Result<(), EditError> {
        let address = self.address(&op.path, 0)?;
        let value = op.value.as_ref().ok_or_else(|| missing("value"))?;
        if let Address::Attributes(id, pointer) = &address {
            if op.position.is_some() {
                return Err(EditError::new(
                    EditErrorCode::FieldNotAllowed,
                    "position places blocks; inside attributes, add follows JSON Pointer (an array index or \"-\" to append)",
                ));
            }
            return self.set_attribute(*id, pointer, value.clone(), PointerWrite::Add);
        }
        if matches!(address, Address::Name(_)) {
            return Err(EditError::new(
                EditErrorCode::InvalidPath,
                "a block's name is changed with replace",
            )
            .with_fix(format!(
                "{{\"op\":\"replace\",\"path\":\"{}\",\"value\":\"core/heading\"}}",
                op.path
            )));
        }
        let anchor = self.anchor(&address, op.position)?;
        if let Some(label) = &op.label {
            let is_single = value.is_object() || value.as_array().is_some_and(|a| a.len() == 1);
            if !is_single {
                return Err(EditError::new(
                    EditErrorCode::FieldNotAllowed,
                    "an op-level label can't name several new blocks",
                )
                .with_fix("put \"label\" inside each value item"));
            }
            let mut new_blocks = self.new_values(value)?;
            self.labels.define(label, new_blocks[0].client_id)?;
            self.insert(anchor, std::mem::take(&mut new_blocks))?;
            return Ok(());
        }
        let new_blocks = self.new_values(value)?;
        self.insert(anchor, new_blocks)
    }

    fn remove(&mut self, op: &PatchOp) -> Result<(), EditError> {
        match self.address(&op.path, 0)? {
            Address::Block(id) => {
                let through = self.optional_reference(op.through.as_ref())?;
                let range = self.range(id, through)?;
                let first = Loc {
                    page: range.page,
                    path: [range.parent_path.clone(), vec![range.start]].concat(),
                };
                self.check_not_in_exercise(&first, false, "remove blocks inside it")?;
                let removed = self.detach(&range);
                self.mark_removed(&removed);
                Ok(())
            }
            Address::Attributes(id, pointer) => {
                if op.through.is_some() {
                    return Err(EditError::new(
                        EditErrorCode::FieldNotAllowed,
                        "through names a block range; it doesn't apply to attributes",
                    ));
                }
                if pointer.is_empty() {
                    return Err(EditError::new(
                        EditErrorCode::InvalidPath,
                        "a block always has attributes; remove single attributes, e.g. /<id>/attributes/anchor",
                    ));
                }
                let loc = self.require(id)?;
                self.check_not_in_exercise(&loc, true, "change its attributes")?;
                let block = self.block_mut(&loc);
                pointer_remove(&mut block.attributes, &pointer)
            }
            Address::Name(_) => Err(EditError::new(
                EditErrorCode::InvalidPath,
                "a block's name can't be removed; replace it, or remove the block",
            )),
            address @ (Address::Root(_) | Address::Children(_)) => {
                let (list, description): (&[GutenbergBlock], String) = match address {
                    Address::Children(id) => {
                        let loc = self.require(id)?;
                        (&self.block(&loc).inner_blocks, format!("/{id}/innerBlocks"))
                    }
                    _ => (&self.pages[0].blocks, "the page".to_string()),
                };
                let fix = match (list.first(), list.last()) {
                    (Some(first), Some(last)) => format!(
                        "{{\"op\":\"remove\",\"path\":\"/{}\",\"through\":\"/{}\"}}",
                        first.client_id, last.client_id
                    ),
                    _ => "the list is already empty".to_string(),
                };
                Err(EditError::new(
                    EditErrorCode::InvalidPath,
                    format!(
                        "remove takes a block or a range, not the children list of {description}"
                    ),
                )
                .with_fix(fix))
            }
        }
    }

    fn replace(&mut self, op: &PatchOp) -> Result<(), EditError> {
        let value = op.value.clone().ok_or_else(|| missing("value"))?;
        match self.address(&op.path, 0)? {
            Address::Root(page) => {
                let items = self.parse_items(&value, "the page")?;
                self.replace_list(ListRef { page, parent: None }, items)
            }
            Address::Children(id) => {
                let loc = self.require(id)?;
                self.check_not_in_exercise(&loc, true, "change what is inside it")?;
                let items = self.parse_items(&value, &format!("/{id}/innerBlocks"))?;
                self.replace_list(
                    ListRef {
                        page: loc.page,
                        parent: Some(id),
                    },
                    items,
                )
            }
            Address::Block(id) => self.replace_block(id, &value),
            Address::Name(id) => {
                let loc = self.require(id)?;
                self.check_not_in_exercise(&loc, true, "change its type")?;
                let Value::String(name) = value else {
                    return Err(EditError::new(
                        EditErrorCode::InvalidValue,
                        "a block name is a string such as \"core/heading\"",
                    ));
                };
                check_creatable(&name)?;
                self.block_mut(&loc).name = name;
                Ok(())
            }
            Address::Attributes(id, pointer) => {
                self.set_attribute(id, &pointer, value, PointerWrite::Replace)
            }
        }
    }

    fn set_attribute(
        &mut self,
        id: Uuid,
        pointer: &[String],
        value: Value,
        mode: PointerWrite,
    ) -> Result<(), EditError> {
        let loc = self.require(id)?;
        self.check_not_in_exercise(&loc, true, "change its attributes")?;
        let block = self.block_mut(&loc);
        if pointer.is_empty() {
            let Value::Object(attributes) = value else {
                return Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    "attributes is an object",
                ));
            };
            block.attributes = attributes;
            return Ok(());
        }
        pointer_write(&mut block.attributes, pointer, value, mode)
    }

    fn replace_block(&mut self, id: Uuid, value: &Value) -> Result<(), EditError> {
        let loc = self.require(id)?;
        self.check_not_in_exercise(&loc, true, "replace it")?;
        let object = match value {
            Value::Object(object) => object,
            Value::Array(_) => {
                return Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    "replace on a block takes one block; to replace it with several, add them after it and remove it",
                )
                .with_fix(format!(
                    "[{{\"op\":\"add\",\"path\":\"/{id}\",\"position\":\"after\",\"value\":[…]}},{{\"op\":\"remove\",\"path\":\"/{id}\"}}]"
                )));
            }
            _ => {
                return Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    "replace on a block takes a block object",
                ));
            }
        };
        if let Some(sent) = object.get("clientId") {
            if sent.as_str() != Some(id.to_string().as_str()) {
                return Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    format!("the value's clientId {sent} differs from the path's block {id}"),
                )
                .with_fix("leave clientId out of the value; replace keeps the block's id"));
            }
        }
        let mut with_id = object.clone();
        with_id.insert("clientId".to_string(), Value::String(id.to_string()));
        let replacement = self.parse_item(&Value::Object(with_id))?;
        let parent = if loc.path.len() == 1 {
            None
        } else {
            Some(blocks::get(&self.pages[loc.page].blocks, loc.parent_path()).client_id)
        };
        let mut items: Vec<Item> = blocks::list(&self.pages[loc.page].blocks, loc.parent_path())
            .iter()
            .map(|b| Item::Stub(b.client_id))
            .collect();
        items[loc.index()] = replacement;
        self.replace_list(
            ListRef {
                page: loc.page,
                parent,
            },
            items,
        )
    }

    fn move_or_copy(&mut self, op: &PatchOp, is_copy: bool) -> Result<(), EditError> {
        let from_raw = op.from.as_ref().ok_or_else(|| missing("from"))?;
        let from = match self.address(from_raw, 0)? {
            Address::Block(id) => id,
            _ => {
                return Err(EditError::new(
                    EditErrorCode::InvalidPath,
                    format!("from must name a block, like \"/<id>\"; got \"{from_raw}\""),
                ));
            }
        };
        let through = self.optional_reference(op.through.as_ref())?;
        let range = self.range(from, through)?;
        if range.page != 0 {
            return Err(EditError::new(
                EditErrorCode::InvalidPath,
                "from and through name blocks on the page being edited; edit the other page with its own call",
            ));
        }
        let target_page = match &op.to_page {
            Some(raw) => self.page_index(self.resolve_reference(raw)?),
            None => 0,
        };
        let address = self.address(&op.path, target_page)?;
        let anchor = self.anchor(&address, op.position)?;
        if self.anchor_page(anchor)? != target_page {
            return Err(EditError::new(
                EditErrorCode::InvalidPath,
                format!("path {} is on another page than the target", op.path),
            )
            .with_fix("set to_page to the page that holds path, or use a path on this page"));
        }

        let moved_ids: HashSet<Uuid> = blocks::all_ids(self.range_blocks(&range))
            .into_iter()
            .collect();
        let first = Loc {
            page: range.page,
            path: [range.parent_path.clone(), vec![range.start]].concat(),
        };
        if !is_copy {
            self.check_not_in_exercise(&first, false, "move blocks out of it")?;
            let anchor_id = match anchor {
                Anchor::Before(id) | Anchor::After(id) => Some(id),
                Anchor::Start(list) | Anchor::End(list) => list.parent,
            };
            if let Some(anchor_id) = anchor_id {
                if moved_ids.contains(&anchor_id) {
                    return Err(EditError::new(
                        EditErrorCode::MoveIntoItself,
                        format!("can't move into or next to {anchor_id}: it is part of what is being moved"),
                    )
                    .with_fix("choose a target outside the moved block or range"));
                }
            }
        } else {
            self.check_not_in_exercise(&first, false, "copy blocks out of it")?;
        }

        let target_is_top_level = matches!(
            anchor,
            Anchor::Start(ListRef { parent: None, .. }) | Anchor::End(ListRef { parent: None, .. })
        ) || match anchor {
            Anchor::Before(id) | Anchor::After(id) => self.require(id)?.path.len() == 1,
            _ => false,
        };
        if !target_is_top_level && self.range_blocks(&range).iter().any(is_exercise) {
            return Err(exercise_must_stay_top_level());
        }

        let blocks_to_place = if is_copy {
            let source = self.range_blocks(&range).to_vec();
            let target_page_id = self.page_id(target_page);
            let mut copies = Vec::with_capacity(source.len());
            for block in source {
                copies.push(self.copy_with_new_ids(block, target_page_id));
            }
            if let Some(label) = &op.label {
                self.labels.define(label, copies[0].client_id)?;
            }
            copies
        } else {
            let detached = self.detach(&range);
            if target_page != range.page {
                let (from_page, to_page) = (self.page_id(range.page), self.page_id(target_page));
                for id in blocks::all_ids(&detached) {
                    self.moves.push(BlockPageMove {
                        block_id: id,
                        from_page,
                        to_page,
                    });
                }
            }
            detached
        };
        self.insert(anchor, blocks_to_place)
    }

    fn copy_with_new_ids(&mut self, mut block: GutenbergBlock, page_id: Uuid) -> GutenbergBlock {
        let id = self.ctx.ids.new_id();
        push_created(&mut self.created, self.op_index, id);
        block.client_id = id;
        if is_exercise(&block) {
            let new_exercise_id = self.ctx.ids.new_id();
            if let Some(source) = blocks::exercise_id(&block) {
                self.exercise_copies.push(ExerciseCopy {
                    source_exercise_id: source,
                    new_exercise_id,
                    new_block_id: id,
                    page_id,
                });
                self.warnings.push(Warning {
                    code: WarningCode::ExerciseCopied,
                    message: format!("the copy of exercise {source} is a new exercise {new_exercise_id} with no submissions"),
                    op: Some(self.op_index),
                });
            }
            block
                .attributes
                .insert("id".to_string(), Value::String(new_exercise_id.to_string()));
        }
        let children = std::mem::take(&mut block.inner_blocks);
        block.inner_blocks = children
            .into_iter()
            .map(|c| self.copy_with_new_ids(c, page_id))
            .collect();
        block
    }

    fn wrap(&mut self, op: &PatchOp) -> Result<(), EditError> {
        let first = match self.address(&op.path, 0)? {
            Address::Block(id) => id,
            _ => {
                return Err(EditError::new(
                    EditErrorCode::InvalidPath,
                    "wrap takes a block path (and optionally through) for the blocks to wrap",
                ));
            }
        };
        let through = self.optional_reference(op.through.as_ref())?;
        let range = self.range(first, through)?;
        let first_loc = Loc {
            page: range.page,
            path: [range.parent_path.clone(), vec![range.start]].concat(),
        };
        self.check_not_in_exercise(&first_loc, false, "wrap blocks inside it")?;
        if self.range_blocks(&range).iter().any(is_exercise) {
            return Err(exercise_must_stay_top_level());
        }
        let value = op.value.as_ref().ok_or_else(|| missing("value"))?;
        let object = value.as_object().ok_or_else(|| {
            EditError::new(
                EditErrorCode::InvalidValue,
                "wrap's value is the container block, e.g. {\"name\":\"moocfi/infobox\"}",
            )
        })?;
        if object
            .get("innerBlocks")
            .and_then(Value::as_array)
            .is_some_and(|a| !a.is_empty())
        {
            return Err(EditError::new(
                EditErrorCode::InvalidValue,
                "wrap's container gets the wrapped blocks as its children; leave innerBlocks out",
            ));
        }
        let value_label = label_of(object)?;
        let mut container_value = object.clone();
        container_value.remove("label");
        container_value.remove("innerBlocks");
        let mut container = self.new_block(&Value::Object(container_value))?;
        match (op.label.as_ref(), value_label.as_ref()) {
            (Some(label), None) | (None, Some(label)) => {
                self.labels.define(label, container.client_id)?
            }
            (Some(op_label), Some(value_label)) if op_label == value_label => {
                self.labels.define(op_label, container.client_id)?
            }
            (Some(_), Some(_)) => {
                return Err(EditError::new(
                    EditErrorCode::LabelReused,
                    "wrap got two different labels; give one",
                ));
            }
            (None, None) => {}
        }
        let wrapped = self.detach(&range);
        container.inner_blocks = wrapped;
        self.touched.insert(range.page);
        blocks::list_mut(&mut self.pages[range.page].blocks, &range.parent_path)
            .insert(range.start, container);
        Ok(())
    }

    fn unwrap(&mut self, op: &PatchOp) -> Result<(), EditError> {
        let id = match self.address(&op.path, 0)? {
            Address::Block(id) => id,
            _ => {
                return Err(EditError::new(
                    EditErrorCode::InvalidPath,
                    "unwrap takes a block path",
                ));
            }
        };
        let loc = self.require(id)?;
        self.check_not_in_exercise(&loc, true, "unwrap it")?;
        if self.block(&loc).inner_blocks.is_empty() {
            return Err(EditError::new(
                EditErrorCode::InvalidValue,
                format!("/{id} has no inner blocks to unwrap"),
            )
            .with_fix(format!("{{\"op\":\"remove\",\"path\":\"/{id}\"}}")));
        }
        self.touched.insert(loc.page);
        let list = blocks::list_mut(&mut self.pages[loc.page].blocks, loc.parent_path());
        let container = list.remove(loc.index());
        self.removed.insert(container.client_id, self.op_index);
        for (offset, child) in container.inner_blocks.into_iter().enumerate() {
            list.insert(loc.index() + offset, child);
        }
        Ok(())
    }

    fn split(&mut self, op: &PatchOp) -> Result<(), EditError> {
        let id = match self.address(&op.path, 0)? {
            Address::Block(id) => id,
            _ => {
                return Err(EditError::new(
                    EditErrorCode::InvalidPath,
                    "split takes a block path",
                ));
            }
        };
        let at_text = op.at_text.as_deref().ok_or_else(|| missing("at_text"))?;
        if at_text.is_empty() {
            return Err(EditError::new(
                EditErrorCode::InvalidValue,
                "at_text can't be empty",
            ));
        }
        let loc = self.require(id)?;
        self.check_not_in_exercise(&loc, true, "split it")?;
        let block = self.block(&loc);
        let content = text_content(block)?.to_string();
        if !block.inner_blocks.is_empty() {
            return Err(EditError::new(
                EditErrorCode::NotATextBlock,
                format!("/{id} has inner blocks; split works on blocks without children"),
            ));
        }
        let positions: Vec<usize> = content.match_indices(at_text).map(|(i, _)| i).collect();
        let at = match positions.as_slice() {
            [] => {
                let in_plain_text = text::plain_text(&content).contains(at_text);
                let mut error = EditError::new(
                    EditErrorCode::TextNotFound,
                    format!("\"{at_text}\" doesn't occur in /{id}"),
                )
                .with_details(json!({"content": content}));
                if in_plain_text {
                    error = error.with_fix("at_text matches the stored HTML, markup included; copy it from the content shown in details");
                }
                return Err(error);
            }
            [single] => *single,
            many => {
                return Err(EditError::new(
                    EditErrorCode::TextAmbiguous,
                    format!(
                        "\"{at_text}\" occurs {} times in /{id}; split needs text that occurs once",
                        many.len()
                    ),
                )
                .with_fix("make at_text longer so it matches one place"));
            }
        };
        if at == 0 {
            return Err(EditError::new(
                EditErrorCode::InvalidValue,
                format!("\"{at_text}\" starts the block, so the first part would be empty"),
            ));
        }
        if text::is_inside_tag(&content, at) {
            return Err(EditError::new(
                EditErrorCode::SplitInsideMarkup,
                format!("\"{at_text}\" is inside an HTML tag"),
            ));
        }
        let open = text::open_tags_at(&content, at);
        if !open.is_empty() {
            return Err(EditError::new(
                EditErrorCode::SplitInsideMarkup,
                format!(
                    "\"{at_text}\" is inside <{}>; splitting there would break the formatting",
                    open.join(">, <")
                ),
            )
            .with_fix("split outside the formatted text, or remove the formatting first"));
        }
        let first_part = content[..at].trim_end().to_string();
        let second_part = content[at..].to_string();
        let mut second = block.clone();
        let new_id = self.ctx.ids.new_id();
        push_created(&mut self.created, self.op_index, new_id);
        second.client_id = new_id;
        second
            .attributes
            .insert("content".to_string(), Value::String(second_part));
        if let Some(label) = &op.label {
            self.labels.define(label, new_id)?;
        }
        self.block_mut(&loc)
            .attributes
            .insert("content".to_string(), Value::String(first_part));
        let list = blocks::list_mut(&mut self.pages[loc.page].blocks, loc.parent_path());
        list.insert(loc.index() + 1, second);
        Ok(())
    }

    fn merge(&mut self, op: &PatchOp) -> Result<(), EditError> {
        let target = match self.address(&op.path, 0)? {
            Address::Block(id) => id,
            _ => {
                return Err(EditError::new(
                    EditErrorCode::InvalidPath,
                    "merge's path is the block that stays",
                ));
            }
        };
        let from_raw = op.from.as_ref().ok_or_else(|| missing("from"))?;
        let source = self.resolve_reference(from_raw)?;
        let target_loc = self.require(target)?;
        let source_loc = self.require(source)?;
        self.check_not_in_exercise(&target_loc, true, "merge into it")?;
        self.check_not_in_exercise(&source_loc, true, "merge it")?;
        let adjacent = target_loc.page == source_loc.page
            && target_loc.parent_path() == source_loc.parent_path()
            && source_loc.index() == target_loc.index() + 1;
        if !adjacent {
            return Err(EditError::new(
                EditErrorCode::MergeNotAdjacent,
                format!("merge joins a block (from) into the block right before it (path); /{source} isn't right after /{target}"),
            )
            .with_details(json!({"siblings_of_path": self.siblings(target_loc.page, target_loc.parent_path())})));
        }
        let target_block = self.block(&target_loc);
        let source_block = self.block(&source_loc);
        if target_block.name != source_block.name {
            return Err(EditError::new(
                EditErrorCode::NotATextBlock,
                format!(
                    "merge joins blocks of the same type; /{target} is {} and /{source} is {}",
                    target_block.name, source_block.name
                ),
            ));
        }
        let first = text_content(target_block)?;
        let second = text_content(source_block)?;
        if !source_block.inner_blocks.is_empty() {
            return Err(EditError::new(
                EditErrorCode::NotATextBlock,
                format!("/{source} has inner blocks; merge works on blocks without children"),
            ));
        }
        let separator = if first.ends_with(char::is_whitespace)
            || second.starts_with(char::is_whitespace)
            || first.is_empty()
        {
            ""
        } else {
            " "
        };
        let merged = format!("{first}{separator}{second}");
        self.block_mut(&target_loc)
            .attributes
            .insert("content".to_string(), Value::String(merged));
        let list = blocks::list_mut(
            &mut self.pages[source_loc.page].blocks,
            source_loc.parent_path(),
        );
        let removed = list.remove(source_loc.index());
        self.removed.insert(removed.client_id, self.op_index);
        Ok(())
    }

    // ---- array replace ------------------------------------------------------------------

    fn parse_items(&self, value: &Value, what: &str) -> Result<Vec<Item>, EditError> {
        let Value::Array(items) = value else {
            return Err(EditError::new(
                EditErrorCode::InvalidValue,
                format!(
                    "replacing {what} takes an array of blocks; to replace one block use its own path"
                ),
            ));
        };
        items.iter().map(|item| self.parse_item(item)).collect()
    }

    fn parse_item(&self, value: &Value) -> Result<Item, EditError> {
        let object = value.as_object().ok_or_else(|| {
            EditError::new(
                EditErrorCode::InvalidValue,
                "each item is a block object or a {\"clientId\":\"…\"} stub",
            )
        })?;
        let inner = |object: &Map<String, Value>| -> Result<Option<Vec<Item>>, EditError> {
            match object.get("innerBlocks") {
                None => Ok(None),
                Some(Value::Array(items)) => items
                    .iter()
                    .map(|i| self.parse_item(i))
                    .collect::<Result<Vec<_>, _>>()
                    .map(Some),
                Some(_) => Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    "innerBlocks must be an array",
                )),
            }
        };
        match object.get("clientId") {
            Some(raw) => {
                let id = raw.as_str().ok_or_else(|| {
                    EditError::new(EditErrorCode::InvalidValue, "clientId is a string")
                })?;
                let id = parse_uuid(id, id)?;
                let is_stub = object.keys().all(|k| k == "clientId");
                if is_stub {
                    return Ok(Item::Stub(id));
                }
                check_block_keys(
                    object,
                    &["clientId", "name", "attributes", "innerBlocks", "isValid"],
                )?;
                let name = match object.get("name") {
                    None => None,
                    Some(_) => Some(block_name(object)?),
                };
                Ok(Item::Full {
                    id,
                    name,
                    attributes: block_attributes(object)?,
                    inner: inner(object)?,
                })
            }
            None => {
                check_block_keys(
                    object,
                    &["name", "attributes", "innerBlocks", "label", "isValid"],
                )?;
                let name = block_name(object)?;
                check_creatable(&name)?;
                Ok(Item::New {
                    name,
                    attributes: block_attributes(object)?.unwrap_or_default(),
                    label: label_of(object)?,
                    inner: inner(object)?.unwrap_or_default(),
                })
            }
        }
    }

    fn replace_list(&mut self, list: ListRef, items: Vec<Item>) -> Result<(), EditError> {
        self.check_list_not_in_exercise(list, "change what is inside it")?;
        let page = list.page;
        let parent_path = match list.parent {
            Some(parent) => self.require(parent)?.path,
            None => Vec::new(),
        };

        let mut referenced: Vec<(Uuid, bool)> = Vec::new();
        collect_references(&items, &mut referenced);
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

        let doc = &self.pages[page].blocks;
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

        let mut required: Vec<Uuid> = blocks::list(doc, &parent_path)
            .iter()
            .map(|b| b.client_id)
            .collect();
        collect_required_children(&items, doc, &locations, &mut required)?;
        let referenced_ids: HashSet<Uuid> = locations.keys().copied().collect();
        let missing: Vec<String> = required
            .iter()
            .filter(|id| !referenced_ids.contains(id))
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
            let is_full = !stubs.contains(id);
            if is_full
                && blocks::ancestor_ids(doc, path)
                    .iter()
                    .chain(std::iter::once(id))
                    .any(|a| {
                        blocks::find_path(doc, *a)
                            .is_some_and(|p| is_exercise_name(&blocks::get(doc, &p).name))
                    })
            {
                return Err(exercise_read_only("replace it"));
            }
        }

        let snapshot: HashMap<Uuid, GutenbergBlock> = locations
            .iter()
            .map(|(id, path)| (*id, blocks::get(doc, path).clone()))
            .collect();
        let new_list = self.build_items(items, &snapshot)?;

        let external: Vec<Uuid> = locations
            .iter()
            .filter(|(_, path)| !(path.len() > parent_path.len() && path.starts_with(&parent_path)))
            .map(|(id, _)| *id)
            .collect();
        for id in external {
            if let Some(path) = blocks::find_path(&self.pages[page].blocks, id) {
                let list = blocks::list_mut(&mut self.pages[page].blocks, &path[..path.len() - 1]);
                list.remove(path[path.len() - 1]);
            }
        }
        let parent_path = match list.parent {
            Some(parent) => self.require(parent)?.path,
            None => Vec::new(),
        };
        self.touched.insert(page);
        *blocks::list_mut(&mut self.pages[page].blocks, &parent_path) = new_list;
        Ok(())
    }

    fn build_items(
        &mut self,
        items: Vec<Item>,
        snapshot: &HashMap<Uuid, GutenbergBlock>,
    ) -> Result<Vec<GutenbergBlock>, EditError> {
        items
            .into_iter()
            .map(|item| self.build_item(item, snapshot))
            .collect()
    }

    fn build_item(
        &mut self,
        item: Item,
        snapshot: &HashMap<Uuid, GutenbergBlock>,
    ) -> Result<GutenbergBlock, EditError> {
        match item {
            Item::Stub(id) => Ok(snapshot[&id].clone()),
            Item::Full {
                id,
                name,
                attributes,
                inner,
            } => {
                let existing = &snapshot[&id];
                let name = name.unwrap_or_else(|| existing.name.clone());
                check_creatable(&name)?;
                let attributes = attributes.unwrap_or_else(|| existing.attributes.clone());
                let existing_children = existing.inner_blocks.clone();
                let inner_blocks = match inner {
                    Some(inner) => self.build_items(inner, snapshot)?,
                    None => existing_children,
                };
                Ok(GutenbergBlock {
                    client_id: id,
                    name,
                    is_valid: true,
                    attributes,
                    inner_blocks,
                })
            }
            Item::New {
                name,
                attributes,
                label,
                inner,
            } => {
                let id = self.ctx.ids.new_id();
                push_created(&mut self.created, self.op_index, id);
                if let Some(label) = label {
                    self.labels.define(&label, id)?;
                }
                let inner_blocks = self.build_items(inner, snapshot)?;
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

    // ---- invariants ---------------------------------------------------------------------

    fn check_invariants(&self) -> Result<(), EditError> {
        let mut seen: HashMap<Uuid, Uuid> = HashMap::new();
        for doc in &self.pages {
            for id in blocks::all_ids(&doc.blocks) {
                if let Some(other_page) = seen.insert(id, doc.page_id) {
                    return Err(EditError::new(
                        EditErrorCode::DuplicateIds,
                        format!(
                            "block id {id} would appear twice (pages {other_page} and {})",
                            doc.page_id
                        ),
                    ));
                }
            }
        }
        for (index, doc) in self.pages.iter().enumerate() {
            if !self.touched.contains(&index) {
                continue;
            }
            let mut nested_exercises = Vec::new();
            let mut disallowed = Vec::new();
            blocks::walk(&doc.blocks, &mut |block, path| {
                if is_exercise(block) && path.len() > 1 {
                    nested_exercises.push(block.client_id.to_string());
                }
                if doc.page_type.is_outside_chapters()
                    && DISALLOWED_ON_TOP_LEVEL_PAGES.contains(&block.name.as_str())
                {
                    disallowed.push(format!("/{} ({})", block.client_id, block.name));
                }
            });
            if !nested_exercises.is_empty() {
                return Err(exercise_must_stay_top_level()
                    .with_details(json!({"exercise_blocks": nested_exercises})));
            }
            if !disallowed.is_empty() {
                return Err(EditError::new(
                    EditErrorCode::InvariantViolated,
                    format!(
                        "page {} is outside chapters and can't hold exercises or chapter listings: {}",
                        doc.page_id,
                        disallowed.join(", ")
                    ),
                ));
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PointerWrite {
    Add,
    Replace,
}

fn collect_references(items: &[Item], out: &mut Vec<(Uuid, bool)>) {
    for item in items {
        match item {
            Item::Stub(id) => out.push((*id, true)),
            Item::Full { id, inner, .. } => {
                out.push((*id, false));
                if let Some(inner) = inner {
                    collect_references(inner, out);
                }
            }
            Item::New { inner, .. } => collect_references(inner, out),
        }
    }
}

/// Existing children of fully replaced blocks must be accounted for, like the replaced list's own.
fn collect_required_children(
    items: &[Item],
    doc: &[GutenbergBlock],
    locations: &HashMap<Uuid, Vec<usize>>,
    required: &mut Vec<Uuid>,
) -> Result<(), EditError> {
    for item in items {
        match item {
            Item::Stub(_) => {}
            Item::Full { id, inner, .. } => {
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
            Item::New { inner, .. } => collect_required_children(inner, doc, locations, required)?,
        }
    }
    Ok(())
}

fn check_block_keys(object: &Map<String, Value>, allowed: &[&str]) -> Result<(), EditError> {
    let unknown: Vec<&String> = object
        .keys()
        .filter(|k| !allowed.contains(&k.as_str()))
        .collect();
    if unknown.is_empty() {
        return Ok(());
    }
    Err(EditError::new(
        EditErrorCode::UnknownField,
        format!("unknown block field(s) {}", super::op::quote_list(&unknown)),
    )
    .with_fix(format!(
        "block fields are: {}; block-specific values go inside attributes",
        allowed.join(", ")
    )))
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

fn label_of(object: &Map<String, Value>) -> Result<Option<String>, EditError> {
    match object.get("label") {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(label)) => Ok(Some(label.clone())),
        Some(_) => Err(EditError::new(
            EditErrorCode::LabelInvalid,
            "label is a string like \"$box\"",
        )),
    }
}

/// Raw HTML, synced patterns and the editor's placeholder.
const NOT_WRITABLE_BLOCKS: [&str; 3] = ["core/html", "core/block", "moocfi/unsupported-block-type"];

fn check_creatable(name: &str) -> Result<(), EditError> {
    if is_exercise_name(name) {
        return Err(EditError::new(
            EditErrorCode::ExerciseReadOnly,
            "exercises can't be created or edited with page edits yet; an existing exercise block can be moved, copied or removed",
        ));
    }
    if NOT_WRITABLE_BLOCKS.contains(&name) {
        return Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!("agents can't write {name}; the guide tool lists the blocks a page takes"),
        ));
    }
    Ok(())
}

fn text_content(block: &GutenbergBlock) -> Result<&str, EditError> {
    block.attributes.get("content").and_then(Value::as_str).ok_or_else(|| {
        EditError::new(
            EditErrorCode::NotATextBlock,
            format!("/{} ({}) has no text content attribute; split and merge work on text blocks such as core/paragraph and core/heading", block.client_id, block.name),
        )
    })
}

fn exercise_read_only(action: &str) -> EditError {
    EditError::new(
        EditErrorCode::ExerciseReadOnly,
        format!("exercise blocks can't be edited with page edits, so you can't {action}"),
    )
    .with_fix("an exercise block can only be moved, copied or removed; to change an exercise, remove the block and add new content, or ask the teacher to edit it in the editor")
}

fn exercise_must_stay_top_level() -> EditError {
    EditError::new(
        EditErrorCode::InvariantViolated,
        "exercise blocks stay at the top level of a page; they can't be wrapped or nested",
    )
    .with_fix("place exercise blocks with path \"\" or before/after a top-level block")
}

fn missing(field: &str) -> EditError {
    EditError::new(
        EditErrorCode::MissingField,
        format!("this op needs \"{field}\""),
    )
}

fn position_name(position: Position) -> &'static str {
    match position {
        Position::Before => "before",
        Position::After => "after",
        Position::Start => "start",
        Position::End => "end",
    }
}

pub(crate) fn unescape_pointer(segment: &str) -> String {
    segment.replace("~1", "/").replace("~0", "~")
}

fn pointer_write(
    root: &mut Map<String, Value>,
    pointer: &[String],
    value: Value,
    mode: PointerWrite,
) -> Result<(), EditError> {
    let (last, parents) = pointer.split_last().expect("non-empty pointer");
    let mut holder = Value::Object(std::mem::take(root));
    let result = (|| {
        let mut current = &mut holder;
        for segment in parents {
            current = step_mut(current, segment, &pointer.join("/"))?;
        }
        match current {
            Value::Object(object) => {
                object.insert(last.clone(), value);
                Ok(())
            }
            Value::Array(array) => {
                if last == "-" {
                    if mode == PointerWrite::Add {
                        array.push(value);
                        return Ok(());
                    }
                    return Err(EditError::new(
                        EditErrorCode::InvalidPath,
                        "\"-\" appends, so it only works with add",
                    ));
                }
                let index: usize = last.parse().map_err(|_| {
                    EditError::new(
                        EditErrorCode::InvalidPath,
                        format!("\"{last}\" isn't an array index"),
                    )
                })?;
                match mode {
                    PointerWrite::Replace if index < array.len() => {
                        array[index] = value;
                        Ok(())
                    }
                    PointerWrite::Add if index <= array.len() => {
                        array.insert(index, value);
                        Ok(())
                    }
                    _ => Err(EditError::new(
                        EditErrorCode::NotFound,
                        format!(
                            "index {index} is past the end of an array of {}",
                            array.len()
                        ),
                    )),
                }
            }
            _ => Err(EditError::new(
                EditErrorCode::InvalidPath,
                format!(
                    "attributes/{} goes into a value that isn't an object or array",
                    pointer.join("/")
                ),
            )),
        }
    })();
    if let Value::Object(object) = holder {
        *root = object;
    }
    result
}

fn pointer_remove(root: &mut Map<String, Value>, pointer: &[String]) -> Result<(), EditError> {
    let (last, parents) = pointer.split_last().expect("non-empty pointer");
    let mut holder = Value::Object(std::mem::take(root));
    let result = (|| {
        let mut current = &mut holder;
        for segment in parents {
            current = step_mut(current, segment, &pointer.join("/"))?;
        }
        let removed = match current {
            Value::Object(object) => object.remove(last).is_some(),
            Value::Array(array) => match last.parse::<usize>() {
                Ok(index) if index < array.len() => {
                    array.remove(index);
                    true
                }
                _ => false,
            },
            _ => false,
        };
        if removed {
            Ok(())
        } else {
            Err(EditError::new(
                EditErrorCode::NotFound,
                format!("attributes/{} isn't set", pointer.join("/")),
            ))
        }
    })();
    if let Value::Object(object) = holder {
        *root = object;
    }
    result
}

fn step_mut<'v>(
    current: &'v mut Value,
    segment: &str,
    whole: &str,
) -> Result<&'v mut Value, EditError> {
    let missing_parent = || {
        EditError::new(
            EditErrorCode::NotFound,
            format!("attributes/{whole}: \"{segment}\" isn't set"),
        )
        .with_fix("replace the enclosing attribute with a whole object instead")
    };
    match current {
        Value::Object(object) => object.get_mut(segment).ok_or_else(missing_parent),
        Value::Array(array) => {
            let index: usize = segment.parse().map_err(|_| missing_parent())?;
            array.get_mut(index).ok_or_else(missing_parent)
        }
        _ => Err(missing_parent()),
    }
}

#[cfg(test)]
#[path = "page_content_tests.rs"]
mod tests;
