//! What page paths name, and where blocks, lists, anchors and ranges are in the current trees.

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde_json::json;
use uuid::Uuid;

use super::Editor;
use crate::engine::blocks::{self, BlockPart, BlockPath, parse_block_path};
use crate::engine::error::{EditError, EditErrorCode};
use crate::engine::op::Position;

pub(super) type Anchor = crate::engine::Anchor<ListRef>;

#[derive(Debug, Clone)]
pub(super) enum Address {
    /// A page's top level, by index into the editor's pages.
    Root(usize),
    Block(Uuid),
    Children(Uuid),
    Name(Uuid),
    /// The block's attributes and a JSON Pointer into them, `""` for all of them.
    Attribute(Uuid, String),
}

/// A children list: a page's top level, or a block's inner blocks.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct ListRef {
    pub(super) page: usize,
    pub(super) parent: Option<Uuid>,
}

/// Where a block is: the page's index in the editor and the block's index path there.
#[derive(Debug, Clone)]
pub(super) struct Loc {
    pub(super) page: usize,
    pub(super) path: Vec<usize>,
}

impl Loc {
    pub(super) fn parent_path(&self) -> &[usize] {
        &self.path[..self.path.len() - 1]
    }

    pub(super) fn index(&self) -> usize {
        self.path[self.path.len() - 1]
    }
}

/// Siblings `start..=end` of one children list.
pub(super) struct Range {
    pub(super) page: usize,
    pub(super) parent_path: Vec<usize>,
    pub(super) start: usize,
    pub(super) end: usize,
}

impl Range {
    pub(super) fn first(&self) -> Loc {
        Loc {
            page: self.page,
            path: [self.parent_path.as_slice(), &[self.start]].concat(),
        }
    }
}

impl Editor<'_> {
    /// Where the block is: on the page being edited, or for `move` and `copy` also on a `to_page`.
    pub(super) fn locate(&self, id: Uuid) -> Option<Loc> {
        let reachable = if self.can_reach_other_pages {
            self.pages.len()
        } else {
            1
        };
        self.pages
            .iter()
            .take(reachable)
            .enumerate()
            .find_map(|(page, doc)| {
                blocks::find_path(&doc.blocks, id).map(|path| Loc { page, path })
            })
    }

    pub(super) fn require(&self, id: Uuid) -> Result<Loc, EditError> {
        self.locate(id).ok_or_else(|| self.not_found(id))
    }

    pub(super) fn not_found(&self, id: Uuid) -> EditError {
        let other_page = self
            .pages
            .iter()
            .skip(1)
            .find(|doc| blocks::find_path(&doc.blocks, id).is_some());
        match (self.removed.get(&id), other_page) {
            (Some(op), _) => EditError::new(
                EditErrorCode::NotFound,
                format!("block {id} was removed by op {op} of this call"),
            ),
            (None, Some(doc)) => EditError::new(
                EditErrorCode::NotFound,
                format!(
                    "block {id} is on page {}; this call edits only its own page, which move and copy can reach other pages from",
                    doc.page_id
                ),
            )
            .with_fix("edit the other page with its own call"),
            (None, None) => EditError::new(
                EditErrorCode::NotFound,
                format!("no block {id} on this page"),
            )
            .with_fix("read the page outline with get_page_content to get current ids"),
        }
    }

    /// Parses a page path. `root_page` is what `""` means: the edited page, or `to_page`.
    pub(super) fn address(&self, path: &str, root_page: usize) -> Result<Address, EditError> {
        let parsed = parse_block_path(path).ok_or_else(|| {
            EditError::new(
                EditErrorCode::InvalidPath,
                format!("path \"{path}\" must start with / (or be \"\" for the page's top level)"),
            )
            .with_fix(format!("/{path}"))
        })?;
        let (root, part) = match parsed {
            BlockPath::TopLevel => return Ok(Address::Root(root_page)),
            BlockPath::Block { root, part } => (root, part),
        };
        if root.parse::<usize>().is_ok() {
            return Err(numeric_index_error(
                path,
                &self.pages[root_page].blocks,
                &root,
            ));
        }
        let id = self.labels.resolve_segment(&root, path, self.ids.op())?;
        let loc = self.require(id)?;
        match part {
            BlockPart::Whole => Ok(Address::Block(id)),
            BlockPart::Children => Ok(Address::Children(id)),
            BlockPart::ChildIndex(index) => Err(numeric_index_error(
                path,
                &self.block(&loc).inner_blocks,
                &index,
            )),
            BlockPart::Attributes(pointer) => Ok(Address::Attribute(id, pointer.to_string())),
            BlockPart::Name => Ok(Address::Name(id)),
            BlockPart::Other { field, .. } if matches!(field.as_str(), "clientId" | "isValid") => {
                Err(EditError::new(
                    EditErrorCode::ReadOnlyField,
                    format!("{field} is managed by the server"),
                ))
            }
            BlockPart::Other { field, .. } => Err(EditError::new(
                EditErrorCode::InvalidPath,
                format!("blocks have no \"{field}\"; a block path continues with /innerBlocks, /attributes/<name> or /name"),
            )
            .with_fix(format!("/{id}/attributes/{field}"))),
        }
    }

    pub(super) fn anchor(
        &self,
        address: &Address,
        position: Option<Position>,
    ) -> Result<Anchor, EditError> {
        let Some(position) = position else {
            return Err(EditError::position_required(
                "position is before/after a sibling (\"path\":\"/p2\") or start/end of a children list (\"path\":\"/box1/innerBlocks\" or \"\" for the page)",
            ));
        };
        match (address, position) {
            (Address::Root(page), Position::Start) => Ok(Anchor::Start(ListRef { page: *page, parent: None })),
            (Address::Root(page), Position::End) => Ok(Anchor::End(ListRef { page: *page, parent: None })),
            (Address::Children(id), Position::Start | Position::End) => {
                let loc = self.require(*id)?;
                let list = ListRef { page: loc.page, parent: Some(*id) };
                self.check_not_in_exercise(&loc, true, "add blocks inside it")?;
                Ok(if position == Position::Start { Anchor::Start(list) } else { Anchor::End(list) })
            }
            (Address::Block(id), Position::Before | Position::After) => {
                let loc = self.require(*id)?;
                self.check_not_in_exercise(&loc, false, "add blocks inside it")?;
                Ok(if position == Position::Before { Anchor::Before(*id) } else { Anchor::After(*id) })
            }
            (Address::Block(id), Position::Start | Position::End) => Err(EditError::new(
                EditErrorCode::PositionNeedsChildren,
                format!("position \"{position}\" needs a children list, not a block"),
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
            (Address::Name(_) | Address::Attribute(..), _) => Err(EditError::new(
                EditErrorCode::InvalidPath,
                "blocks are placed next to a block or into a children list, not at an attribute",
            )),
        }
    }

    pub(super) fn anchor_page(&self, anchor: Anchor) -> Result<usize, EditError> {
        match anchor {
            Anchor::Before(id) | Anchor::After(id) => Ok(self.require(id)?.page),
            Anchor::Start(list) | Anchor::End(list) => Ok(list.page),
        }
    }

    /// (page, parent path, insertion index) for an anchor in the current tree.
    pub(super) fn resolve_anchor(
        &self,
        anchor: Anchor,
    ) -> Result<(usize, Vec<usize>, usize), EditError> {
        let ((page, parent_path), index) = anchor.insertion_point(
            |id| {
                let loc = self.require(id)?;
                Ok(((loc.page, loc.parent_path().to_vec()), loc.index()))
            },
            |list| {
                let parent_path = self.list_parent_path(list)?;
                let len = blocks::list(&self.pages[list.page].blocks, &parent_path).len();
                Ok(((list.page, parent_path), len))
            },
        )?;
        Ok((page, parent_path, index))
    }

    /// The index path of the block whose children `list` is; empty for a page's top level.
    pub(super) fn list_parent_path(&self, list: ListRef) -> Result<Vec<usize>, EditError> {
        Ok(match list.parent {
            Some(parent) => self.require(parent)?.path,
            None => Vec::new(),
        })
    }

    pub(super) fn range(&self, first: Uuid, through: Option<Uuid>) -> Result<Range, EditError> {
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
            return Err(EditError::reversed_range(
                first,
                last_id,
                self.siblings(start.page, start.parent_path()),
            ));
        }
        Ok(Range {
            page: start.page,
            parent_path: start.parent_path().to_vec(),
            start: start.index(),
            end: end.index(),
        })
    }

    pub(super) fn range_blocks(&self, range: &Range) -> &[GutenbergBlock] {
        &blocks::list(&self.pages[range.page].blocks, &range.parent_path)[range.start..=range.end]
    }
}

fn numeric_index_error(path: &str, list: &[GutenbergBlock], index: &str) -> EditError {
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
