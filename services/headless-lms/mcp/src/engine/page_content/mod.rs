//! `patch_page_content`: block-tree edits on one page, with cross-page `move` and `copy`.

mod address;
mod pointer;
mod replace_list;

use std::collections::{BTreeMap, HashMap, HashSet};

use headless_lms_utils::document_schema_processor::{GutenbergBlock, all_client_ids};
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use self::address::{Address, Anchor, ListRef, Loc, Range};
use self::pointer::{PointerWrite, pointer_remove, pointer_write};
use self::replace_list::{ListEntry, parse_list_entries, parse_list_entry, parse_new_block};
use super::blocks::{self, ExerciseCopy, is_exercise, is_exercise_part};
use super::error::{EditError, EditErrorCode, Warning, WarningCode};
use super::labels::{ItemRef, Labels, parse_item_ref};
use super::op::{Op, Position, Transfer};
use super::{CreatedIdLog, CreatedIds, PageDocument, value_items};
use crate::ids::IdGenerator;
use crate::text;

/// Deeper trees stop loading: JSON nests two levels per block, and decoding stops at 128.
const MAX_BLOCK_DEPTH: usize = 20;

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

/// A block now on another page; a moved block's descendants are listed too.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct BlockPageMove {
    pub block_id: Uuid,
    pub from_page: Uuid,
    pub to_page: Uuid,
}

/// Pages named by `to_page`.
fn referenced_pages(ops: &[Op]) -> Result<Vec<Uuid>, EditError> {
    let mut pages = Vec::new();
    for (index, op) in ops.iter().enumerate() {
        if let Some(raw) = op.to_page() {
            match parse_item_ref(raw).map_err(|e| e.at_op(index))? {
                ItemRef::Id(id) => {
                    if !pages.contains(&id) {
                        pages.push(id);
                    }
                }
                ItemRef::Label(_) => {
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

/// Applies `ops` in order to `page`. `load_page` gives the page a `to_page` names, `None` when the
/// course has no such page. Invariants are checked once, after the last op.
pub fn apply(
    page: PageDocument,
    load_page: &dyn Fn(Uuid) -> Option<PageDocument>,
    ops: &[Op],
    ids: &dyn IdGenerator,
) -> Result<PageContentResult, EditError> {
    let mut editor = Editor::new(page, load_page, ops, ids)?;
    for (index, op) in ops.iter().enumerate() {
        editor.ids.set_op(index);
        let first_warning = editor.warnings.len();
        editor.apply_op(op).map_err(|e| e.at_op(index))?;
        for warning in &mut editor.warnings[first_warning..] {
            warning.op = Some(index);
        }
    }
    editor.check_invariants()?;
    Ok(editor.finish())
}

/// Resolves `$label` path roots in a selector path after a call, for `read_back`.
pub fn resolve_label_path(
    path: &str,
    labels: &BTreeMap<String, Uuid>,
) -> Result<String, EditError> {
    let Some(rest) = path.strip_prefix("/$").or_else(|| path.strip_prefix('$')) else {
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

struct Editor<'c> {
    /// The edited page first, then the `to_page`s.
    pages: Vec<PageDocument>,
    labels: Labels,
    removed: HashMap<Uuid, usize>,
    ids: CreatedIdLog<'c>,
    warnings: Vec<Warning>,
    moves: Vec<BlockPageMove>,
    exercise_copies: Vec<ExerciseCopy>,
    /// Whether the current op may find blocks on the `to_page`s besides the edited page.
    can_reach_other_pages: bool,
}

impl<'c> Editor<'c> {
    fn new(
        page: PageDocument,
        load_page: &dyn Fn(Uuid) -> Option<PageDocument>,
        ops: &[Op],
        ids: &'c dyn IdGenerator,
    ) -> Result<Self, EditError> {
        let mut pages = vec![page];
        for page_id in referenced_pages(ops)? {
            if page_id == pages[0].page_id {
                continue;
            }
            let to_page = load_page(page_id).ok_or_else(|| {
                EditError::new(
                    EditErrorCode::NotFound,
                    format!("to_page {page_id} isn't a page of this course"),
                )
                .with_fix("get_course_structure lists the course's page ids")
            })?;
            pages.push(to_page);
        }
        Ok(Self {
            pages,
            labels: Labels::prescan(ops),
            removed: HashMap::new(),
            ids: CreatedIdLog::new(ids),
            warnings: Vec::new(),
            moves: Vec::new(),
            exercise_copies: Vec::new(),
            can_reach_other_pages: false,
        })
    }

    fn finish(mut self) -> PageContentResult {
        let pages = &self.pages;
        self.moves.retain(|moved| {
            pages.iter().any(|doc| {
                doc.page_id == moved.to_page
                    && blocks::find_path(&doc.blocks, moved.block_id).is_some()
            })
        });
        let page = self.pages.remove(0);
        PageContentResult {
            page,
            // Each to_page got blocks from a move or copy, so all of them changed.
            other_pages: self.pages,
            created: self.ids.into_created(),
            labels: self.labels.into_map(),
            warnings: self.warnings,
            moved_between_pages: self.moves,
            exercise_copies: self.exercise_copies,
        }
    }

    fn apply_op(&mut self, op: &Op) -> Result<(), EditError> {
        self.can_reach_other_pages = matches!(op, Op::Move(_) | Op::Copy { .. });
        match op {
            Op::Add {
                path,
                value,
                position,
            } => self.add(path, value, *position),
            Op::Remove { path, through } => self.remove(path, through.as_deref()),
            Op::Replace { path, value } => self.replace(path, value),
            Op::Move(transfer) => self.move_range(transfer),
            Op::Copy { transfer, label } => self.copy_range(transfer, label.as_deref()),
            Op::Wrap {
                path,
                through,
                value,
                label,
            } => self.wrap(path, through.as_deref(), value, label.as_deref()),
            Op::Unwrap { path } => self.unwrap(path),
            Op::Split {
                path,
                at_text,
                label,
            } => self.split(path, at_text, label.as_deref()),
            Op::Merge { path, from } => self.merge(path, from),
            Op::Reorder { .. } => unreachable!("parse_ops rejects {} for this tool", op.kind()),
        }
    }

    fn block(&self, loc: &Loc) -> &GutenbergBlock {
        blocks::get(&self.pages[loc.page].blocks, &loc.path)
    }

    fn block_mut(&mut self, loc: &Loc) -> &mut GutenbergBlock {
        blocks::get_mut(&mut self.pages[loc.page].blocks, &loc.path)
    }

    fn page_id(&self, page: usize) -> Uuid {
        self.pages[page].page_id
    }

    fn page_index(&self, page_id: Uuid) -> usize {
        self.pages
            .iter()
            .position(|p| p.page_id == page_id)
            .unwrap_or(0)
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
        if blocks::is_in_exercise(&self.pages[loc.page].blocks, &loc.path, include_self) {
            return Err(exercise_read_only(action));
        }
        Ok(())
    }

    fn insert(&mut self, anchor: Anchor, new_blocks: Vec<GutenbergBlock>) -> Result<(), EditError> {
        let (page, parent_path, index) = self.resolve_anchor(anchor)?;
        let list = blocks::list_mut(&mut self.pages[page].blocks, &parent_path);
        for (offset, block) in new_blocks.into_iter().enumerate() {
            list.insert(index + offset, block);
        }
        Ok(())
    }

    fn detach(&mut self, range: &Range) -> Vec<GutenbergBlock> {
        let list = blocks::list_mut(&mut self.pages[range.page].blocks, &range.parent_path);
        list.drain(range.start..=range.end).collect()
    }

    fn mark_removed(&mut self, removed: &[GutenbergBlock]) {
        for id in all_client_ids(removed) {
            self.removed.insert(id, self.ids.op());
        }
    }

    /// The block `path` names; any other address fails with `message`.
    fn block_at(&self, path: &str, root_page: usize, message: &str) -> Result<Uuid, EditError> {
        match self.address(path, root_page)? {
            Address::Block(id) => Ok(id),
            _ => Err(EditError::new(EditErrorCode::InvalidPath, message)),
        }
    }

    fn through(&self, through: Option<&str>) -> Result<Option<Uuid>, EditError> {
        self.labels
            .resolve_optional_item_ref(through, self.ids.op())
    }

    /// A new block from an `add` or `wrap` value.
    fn new_block(&mut self, value: &Value) -> Result<GutenbergBlock, EditError> {
        let entry = parse_new_block(value)?;
        self.build_entry(entry, &HashMap::new())
    }

    fn add(
        &mut self,
        path: &str,
        value: &Value,
        position: Option<Position>,
    ) -> Result<(), EditError> {
        let address = self.address(path, 0)?;
        if let Address::Attribute(id, pointer) = &address {
            if position.is_some() {
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
                "{{\"op\":\"replace\",\"path\":\"{path}\",\"value\":\"core/heading\"}}"
            )));
        }
        let anchor = self.anchor(&address, position)?;
        let new_blocks = value_items(value, "a block")?
            .into_iter()
            .map(|item| self.new_block(item))
            .collect::<Result<Vec<_>, _>>()?;
        self.insert(anchor, new_blocks)
    }

    fn remove(&mut self, path: &str, through: Option<&str>) -> Result<(), EditError> {
        match self.address(path, 0)? {
            Address::Block(id) => {
                let through = self.through(through)?;
                let range = self.range(id, through)?;
                self.check_not_in_exercise(&range.first(), false, "remove blocks inside it")?;
                let removed = self.detach(&range);
                self.mark_removed(&removed);
                Ok(())
            }
            Address::Attribute(id, pointer) => {
                if through.is_some() {
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

    fn replace(&mut self, path: &str, value: &Value) -> Result<(), EditError> {
        match self.address(path, 0)? {
            Address::Root(page) => {
                let entries = parse_list_entries(value, "the page")?;
                self.replace_list(ListRef { page, parent: None }, entries)
            }
            Address::Children(id) => {
                let loc = self.require(id)?;
                self.check_not_in_exercise(&loc, true, "change what is inside it")?;
                let entries = parse_list_entries(value, &format!("/{id}/innerBlocks"))?;
                self.replace_list(
                    ListRef {
                        page: loc.page,
                        parent: Some(id),
                    },
                    entries,
                )
            }
            Address::Block(id) => self.replace_block(id, value),
            Address::Name(id) => {
                let loc = self.require(id)?;
                self.check_not_in_exercise(&loc, true, "change its type")?;
                let Value::String(name) = value else {
                    return Err(EditError::new(
                        EditErrorCode::InvalidValue,
                        "a block name is a string such as \"core/heading\"",
                    ));
                };
                check_creatable(name)?;
                self.block_mut(&loc).name = name.clone();
                Ok(())
            }
            Address::Attribute(id, pointer) => {
                self.set_attribute(id, &pointer, value.clone(), PointerWrite::Replace)
            }
        }
    }

    fn set_attribute(
        &mut self,
        id: Uuid,
        pointer: &str,
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
        if let Some(sent) = object.get("clientId")
            && sent.as_str() != Some(id.to_string().as_str())
        {
            return Err(EditError::new(
                EditErrorCode::InvalidValue,
                format!("the value's clientId {sent} differs from the path's block {id}"),
            )
            .with_fix("leave clientId out of the value; replace keeps the block's id"));
        }
        let mut with_id = object.clone();
        with_id.insert("clientId".to_string(), Value::String(id.to_string()));
        let replacement = parse_list_entry(&Value::Object(with_id))?;
        let parent = if loc.path.len() == 1 {
            None
        } else {
            Some(blocks::get(&self.pages[loc.page].blocks, loc.parent_path()).client_id)
        };
        let mut entries: Vec<ListEntry> =
            blocks::list(&self.pages[loc.page].blocks, loc.parent_path())
                .iter()
                .map(|b| ListEntry::Stub(b.client_id))
                .collect();
        entries[loc.index()] = replacement;
        self.replace_list(
            ListRef {
                page: loc.page,
                parent,
            },
            entries,
        )
    }

    /// The range a `move` or `copy` takes from the edited page, the index of the page it goes to,
    /// and where there. `verb` names the op in errors.
    fn resolve_transfer(
        &self,
        transfer: &Transfer,
        verb: &str,
    ) -> Result<(Range, usize, Anchor), EditError> {
        let from = self.block_at(
            &transfer.from,
            0,
            &format!(
                "from must name a block, like \"/<id>\"; got \"{}\"",
                transfer.from
            ),
        )?;
        let through = self.through(transfer.through.as_deref())?;
        let range = self.range(from, through)?;
        if range.page != 0 {
            return Err(EditError::new(
                EditErrorCode::InvalidPath,
                "from and through name blocks on the page being edited; edit the other page with its own call",
            ));
        }
        let target_page = match &transfer.to_page {
            Some(raw) => self.page_index(self.labels.resolve_item_ref(raw, self.ids.op())?),
            None => 0,
        };
        let address = self.address(&transfer.path, target_page)?;
        let anchor = self.anchor(&address, Some(transfer.position))?;
        if self.anchor_page(anchor)? != target_page {
            return Err(EditError::new(
                EditErrorCode::InvalidPath,
                format!("path {} is on another page than the target", transfer.path),
            )
            .with_fix("set to_page to the page that holds path, or use a path on this page"));
        }
        self.check_not_in_exercise(&range.first(), false, &format!("{verb} blocks out of it"))?;
        Ok((range, target_page, anchor))
    }

    /// Fails when `anchor` would put an exercise block of `range` below the top level.
    fn check_exercises_stay_top_level(
        &self,
        range: &Range,
        anchor: Anchor,
    ) -> Result<(), EditError> {
        let (_, target_parent_path, _) = self.resolve_anchor(anchor)?;
        if !target_parent_path.is_empty() && self.range_blocks(range).iter().any(is_exercise) {
            return Err(exercise_must_stay_top_level());
        }
        Ok(())
    }

    fn move_range(&mut self, transfer: &Transfer) -> Result<(), EditError> {
        let (range, target_page, anchor) = self.resolve_transfer(transfer, "move")?;
        let moved_ids: HashSet<Uuid> = all_client_ids(self.range_blocks(&range))
            .into_iter()
            .collect();
        if let Some(anchor_id) = anchor.target_id(|list| list.parent)
            && moved_ids.contains(&anchor_id)
        {
            return Err(EditError::new(
                EditErrorCode::MoveIntoItself,
                format!(
                    "can't move into or next to {anchor_id}: it is part of what is being moved"
                ),
            )
            .with_fix("choose a target outside the moved block or range"));
        }
        self.check_exercises_stay_top_level(&range, anchor)?;
        let detached = self.detach(&range);
        if target_page != range.page {
            let (from_page, to_page) = (self.page_id(range.page), self.page_id(target_page));
            for id in all_client_ids(&detached) {
                self.moves.push(BlockPageMove {
                    block_id: id,
                    from_page,
                    to_page,
                });
            }
        }
        self.insert(anchor, detached)
    }

    fn copy_range(&mut self, transfer: &Transfer, label: Option<&str>) -> Result<(), EditError> {
        let (range, target_page, anchor) = self.resolve_transfer(transfer, "copy")?;
        self.check_exercises_stay_top_level(&range, anchor)?;
        let (copies, exercise_copies) = blocks::copy_blocks(
            self.range_blocks(&range),
            self.ids.generator(),
            self.page_id(target_page),
        );
        for id in all_client_ids(&copies) {
            self.ids.record(id);
        }
        for copy in &exercise_copies {
            self.warnings.push(Warning::new(
                WarningCode::ExerciseCopied,
                format!(
                    "the copy of exercise {} is a new exercise {} with no submissions",
                    copy.source_exercise_id, copy.new_exercise_id
                ),
            ));
        }
        self.exercise_copies.extend(exercise_copies);
        if let Some(label) = label {
            self.labels.define(label, copies[0].client_id)?;
        }
        self.insert(anchor, copies)
    }

    fn wrap(
        &mut self,
        path: &str,
        through: Option<&str>,
        value: &Value,
        label: Option<&str>,
    ) -> Result<(), EditError> {
        let first = self.block_at(
            path,
            0,
            "wrap takes a block path (and optionally through) for the blocks to wrap",
        )?;
        let through = self.through(through)?;
        let range = self.range(first, through)?;
        self.check_not_in_exercise(&range.first(), false, "wrap blocks inside it")?;
        if self.range_blocks(&range).iter().any(is_exercise) {
            return Err(exercise_must_stay_top_level());
        }
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
        if object.contains_key("label") {
            return Err(EditError::new(
                EditErrorCode::FieldNotAllowed,
                "wrap names its container with the op's label, not one inside value",
            )
            .with_fix("{\"op\":\"wrap\",\"path\":\"/p1\",\"value\":{\"name\":\"moocfi/infobox\"},\"label\":\"$box\"}"));
        }
        let mut container_value = object.clone();
        container_value.remove("innerBlocks");
        let mut container = self.new_block(&Value::Object(container_value))?;
        if let Some(label) = label {
            self.labels.define(label, container.client_id)?;
        }
        container.inner_blocks = self.detach(&range);
        blocks::list_mut(&mut self.pages[range.page].blocks, &range.parent_path)
            .insert(range.start, container);
        Ok(())
    }

    fn unwrap(&mut self, path: &str) -> Result<(), EditError> {
        let id = self.block_at(path, 0, "unwrap takes a block path")?;
        let loc = self.require(id)?;
        self.check_not_in_exercise(&loc, true, "unwrap it")?;
        if self.block(&loc).inner_blocks.is_empty() {
            return Err(EditError::new(
                EditErrorCode::InvalidValue,
                format!("/{id} has no inner blocks to unwrap"),
            )
            .with_fix(format!("{{\"op\":\"remove\",\"path\":\"/{id}\"}}")));
        }
        let list = blocks::list_mut(&mut self.pages[loc.page].blocks, loc.parent_path());
        let container = list.remove(loc.index());
        self.removed.insert(container.client_id, self.ids.op());
        for (offset, child) in container.inner_blocks.into_iter().enumerate() {
            list.insert(loc.index() + offset, child);
        }
        Ok(())
    }

    fn split(&mut self, path: &str, at_text: &str, label: Option<&str>) -> Result<(), EditError> {
        let id = self.block_at(path, 0, "split takes a block path")?;
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
        let positions: Vec<usize> = content
            .char_indices()
            .map(|(i, _)| i)
            .filter(|i| content[*i..].starts_with(at_text))
            .collect();
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
        if text::is_inside_character_reference(&content, at) {
            return Err(EditError::new(
                EditErrorCode::SplitInsideMarkup,
                format!("\"{at_text}\" starts inside a character reference such as &amp;"),
            )
            .with_fix("start at_text at the & or after the ;"));
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
        let new_id = self.ids.new_id();
        second.client_id = new_id;
        // An anchor is the block's HTML id, which must stay unique on the page.
        second.attributes.remove("anchor");
        second
            .attributes
            .insert("content".to_string(), Value::String(second_part));
        if let Some(label) = label {
            self.labels.define(label, new_id)?;
        }
        self.block_mut(&loc)
            .attributes
            .insert("content".to_string(), Value::String(first_part));
        let list = blocks::list_mut(&mut self.pages[loc.page].blocks, loc.parent_path());
        list.insert(loc.index() + 1, second);
        Ok(())
    }

    fn merge(&mut self, path: &str, from: &str) -> Result<(), EditError> {
        let target = self.block_at(path, 0, "merge's path is the block that stays")?;
        let source = self.labels.resolve_item_ref(from, self.ids.op())?;
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
        self.removed.insert(removed.client_id, self.ids.op());
        Ok(())
    }

    fn check_invariants(&self) -> Result<(), EditError> {
        let mut seen: HashMap<Uuid, Uuid> = HashMap::new();
        for doc in &self.pages {
            for id in all_client_ids(&doc.blocks) {
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
        for doc in &self.pages {
            let mut nested_exercises = Vec::new();
            let mut too_deep = None;
            blocks::walk(&doc.blocks, &mut |block, path| {
                if path.len() > MAX_BLOCK_DEPTH && too_deep.is_none() {
                    too_deep = Some(block.client_id);
                }
                if is_exercise(block) && path.len() > 1 {
                    nested_exercises.push(block.client_id.to_string());
                }
            });
            if let Some(block) = too_deep {
                return Err(EditError::new(
                    EditErrorCode::InvariantViolated,
                    format!(
                        "block {block} would be nested more than {MAX_BLOCK_DEPTH} levels deep"
                    ),
                )
                .with_fix("unwrap some of the containers around it"));
            }
            if !nested_exercises.is_empty() {
                return Err(exercise_must_stay_top_level()
                    .with_details(json!({"exercise_blocks": nested_exercises})));
            }
        }
        Ok(())
    }
}

/// Raw HTML, synced patterns and the editor's placeholder.
const NOT_WRITABLE_BLOCKS: [&str; 3] = ["core/html", "core/block", "moocfi/unsupported-block-type"];

fn check_creatable(name: &str) -> Result<(), EditError> {
    if is_exercise_part(name) {
        return Err(EditError::new(
            EditErrorCode::ExerciseReadOnly,
            "exercises can't be created with page edits, and exercise blocks can't be written into instructions; an existing exercise block can be moved, copied or removed",
        )
        .with_fix("patch_exercise edits an existing exercise's name and instructions; the teacher creates exercises in the editor"));
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
    .with_fix("an exercise block can only be moved, copied or removed here; patch_exercise edits the exercise's name, task instructions and review instructions, and the teacher edits its other settings in the editor")
}

fn exercise_must_stay_top_level() -> EditError {
    EditError::new(
        EditErrorCode::InvariantViolated,
        "exercise blocks stay at the top level of a page; they can't be wrapped or nested",
    )
    .with_fix("place exercise blocks with path \"\" or before/after a top-level block")
}

#[cfg(test)]
mod tests;
