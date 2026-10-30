//! Pure edit engines. They take documents and ops as plain data, never touch the database or the
//! network, and either return the whole new state or reject the whole call.

pub mod blocks;
pub mod course_settings;
pub mod course_structure;
pub mod error;
pub mod find_replace;
pub mod glossary_references;
pub(crate) mod labels;
pub mod op;
pub mod page_content;
pub(crate) mod path;
pub mod read;
pub mod structural_replace;

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use uuid::Uuid;

use crate::ids::IdGenerator;
use crate::instruction_lists::{InstructionsList, InstructionsLocation};

pub use error::{EditError, EditErrorCode, Warning, WarningCode};
pub use op::{PatchTarget, parse_ops};

/// The editor (and validator) context a page's blocks are checked against. A chapter's front
/// page takes the same blocks as its other pages.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, utoipa::ToSchema,
)]
#[serde(rename_all = "kebab-case")]
pub enum PageType {
    /// A page inside a chapter.
    CoursePage,
    /// A page outside chapters other than the course front page.
    TopLevelPage,
    /// The course's front page, `/`.
    CourseFrontPage,
}

impl PageType {
    /// The type of a page in a chapter or, outside chapters, at `url_path`.
    pub fn of(in_chapter: bool, url_path: &str) -> Self {
        match (in_chapter, url_path) {
            (true, _) => PageType::CoursePage,
            (false, "/") => PageType::CourseFrontPage,
            (false, _) => PageType::TopLevelPage,
        }
    }
}

/// One page's block tree with what the engines need to know about the page.
#[derive(Debug, Clone, PartialEq)]
pub struct PageDocument {
    pub page_id: Uuid,
    pub page_type: PageType,
    pub blocks: Vec<GutenbergBlock>,
}

impl PageDocument {
    /// The page borrowed, as the course-wide engines take it.
    pub fn as_page_ref(&self) -> PageRef<'_> {
        PageRef {
            page_id: self.page_id,
            page_type: self.page_type,
            blocks: &self.blocks,
        }
    }
}

/// A page borrowed from a course state. Engines that scan many pages take these and copy only
/// the pages they change.
#[derive(Debug, Clone, Copy)]
pub struct PageRef<'a> {
    pub page_id: Uuid,
    pub page_type: PageType,
    pub blocks: &'a [GutenbergBlock],
}

impl PageRef<'_> {
    /// An owned copy of the page, to change.
    pub fn to_document(self) -> PageDocument {
        PageDocument {
            page_id: self.page_id,
            page_type: self.page_type,
            blocks: self.blocks.to_vec(),
        }
    }
}

impl<'a> From<PageRef<'a>> for DocumentRef<'a> {
    fn from(page: PageRef<'a>) -> Self {
        DocumentRef {
            key: DocumentKey::Page(page.page_id),
            page_type: page.page_type,
            blocks: page.blocks,
        }
    }
}

/// Which block document a course-wide engine read: a page or exercise text. Serialized, it is the
/// location reported in results.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DocumentKey {
    Page(Uuid),
    /// `page_id` is the page holding the exercise; `None` for the course default's.
    Instructions {
        list: InstructionsList,
        page_id: Option<Uuid>,
    },
    /// The name, as one paragraph of rich text.
    ExerciseName {
        exercise_id: Uuid,
        page_id: Uuid,
    },
}

impl DocumentKey {
    /// The page the document is or is on; `None` for the course default review instructions.
    pub fn page_id(self) -> Option<Uuid> {
        match self {
            DocumentKey::Page(page_id) | DocumentKey::ExerciseName { page_id, .. } => Some(page_id),
            DocumentKey::Instructions { page_id, .. } => page_id,
        }
    }

    /// A match of `block` at `path` within the document, addressed as the tool that edits the
    /// document takes it.
    pub(crate) fn block_match(
        self,
        block: &GutenbergBlock,
        path: String,
        preview: String,
    ) -> BlockMatch {
        let (block_id, path, block_name) = match self {
            DocumentKey::Page(_) => (Some(block.client_id), path, block.name.clone()),
            DocumentKey::Instructions { list, .. } => (
                Some(block.client_id),
                format!("{}{path}", list.path_prefix()),
                block.name.clone(),
            ),
            DocumentKey::ExerciseName { .. } => {
                (None, "/name".to_string(), "exercise name".to_string())
            }
        };
        BlockMatch {
            document: self,
            block_id,
            path,
            block_name,
            preview,
        }
    }
}

impl std::fmt::Display for DocumentKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DocumentKey::Page(page_id) => write!(f, "page {page_id}"),
            DocumentKey::Instructions { list, .. } => match list {
                InstructionsList::Task {
                    exercise_id,
                    task_id,
                } => write!(f, "exercise {exercise_id} task {task_id} instructions"),
                InstructionsList::Review { exercise_id } => {
                    write!(f, "exercise {exercise_id} review instructions")
                }
                InstructionsList::CourseDefaultReview { .. } => {
                    write!(f, "the course default review instructions")
                }
            },
            DocumentKey::ExerciseName { exercise_id, .. } => {
                write!(f, "exercise {exercise_id} name")
            }
        }
    }
}

impl Serialize for DocumentKey {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        #[derive(Serialize)]
        struct Location {
            #[serde(skip_serializing_if = "Option::is_none")]
            page_id: Option<Uuid>,
            #[serde(flatten)]
            instructions: Option<InstructionsLocation>,
            #[serde(skip_serializing_if = "Option::is_none")]
            exercise: Option<Uuid>,
        }
        let (instructions, exercise) = match self {
            DocumentKey::Page(_) => (None, None),
            DocumentKey::Instructions { list, .. } => (Some(list.location()), None),
            DocumentKey::ExerciseName { exercise_id, .. } => (None, Some(*exercise_id)),
        };
        Location {
            page_id: self.page_id(),
            instructions,
            exercise,
        }
        .serialize(serializer)
    }
}

/// A block document the course-wide engines read, borrowed.
#[derive(Debug, Clone, Copy)]
pub struct DocumentRef<'a> {
    pub key: DocumentKey,
    pub page_type: PageType,
    pub blocks: &'a [GutenbergBlock],
}

impl DocumentRef<'_> {
    /// An owned copy of the document, to change.
    pub fn to_document(self) -> Document {
        Document {
            key: self.key,
            page_type: self.page_type,
            blocks: self.blocks.to_vec(),
        }
    }
}

/// A block document the course-wide engines read or changed.
#[derive(Debug, Clone, PartialEq)]
pub struct Document {
    pub key: DocumentKey,
    pub page_type: PageType,
    pub blocks: Vec<GutenbergBlock>,
}

impl Document {
    /// The document as a borrowed [`DocumentRef`].
    pub fn as_document_ref(&self) -> DocumentRef<'_> {
        DocumentRef {
            key: self.key,
            page_type: self.page_type,
            blocks: &self.blocks,
        }
    }
}

/// A block a bulk edit matched.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct BlockMatch {
    #[serde(flatten)]
    pub document: DocumentKey,
    /// `None` for an exercise name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_id: Option<Uuid>,
    /// Ready to read or patch: the block's path, or `/<block id>/attributes/<attribute>`, under
    /// the tool that edits the document.
    pub path: String,
    pub block_name: String,
    pub preview: String,
}

impl BlockMatch {
    /// Where the match is, as an error lists it, with its number of matches when counted.
    pub(crate) fn location(&self, count: Option<usize>) -> Value {
        #[derive(Serialize)]
        struct Location<'a> {
            #[serde(flatten)]
            document: DocumentKey,
            path: &'a str,
            #[serde(skip_serializing_if = "Option::is_none")]
            count: Option<usize>,
        }
        serde_json::to_value(Location {
            document: self.document,
            path: &self.path,
            count,
        })
        .unwrap_or_default()
    }
}

/// Where an op puts items: next to a sibling, or at the start or end of a list `L`.
#[derive(Debug, Clone, Copy)]
pub(crate) enum Anchor<L> {
    Before(Uuid),
    After(Uuid),
    Start(L),
    End(L),
}

impl<L: Copy> Anchor<L> {
    /// The sibling, or the list's owner as `owner` gives it, which a move mustn't take along.
    pub(crate) fn target_id(self, owner: impl FnOnce(L) -> Option<Uuid>) -> Option<Uuid> {
        match self {
            Anchor::Before(id) | Anchor::After(id) => Some(id),
            Anchor::Start(list) | Anchor::End(list) => owner(list),
        }
    }

    /// The list `P` to insert into and the index there. `sibling` gives a sibling's list and
    /// index, `list_len` a list and its length.
    pub(crate) fn insertion_point<P>(
        self,
        sibling: impl FnOnce(Uuid) -> Result<(P, usize), EditError>,
        list_len: impl FnOnce(L) -> Result<(P, usize), EditError>,
    ) -> Result<(P, usize), EditError> {
        match self {
            Anchor::Before(id) => sibling(id),
            Anchor::After(id) => sibling(id).map(|(list, index)| (list, index + 1)),
            Anchor::Start(list) => list_len(list).map(|(list, _)| (list, 0)),
            Anchor::End(list) => list_len(list),
        }
    }
}

/// Ids one op created, in payload order (pre-order for nested items).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CreatedIds {
    pub op: usize,
    pub ids: Vec<Uuid>,
}

/// Mints the ids a call's ops create and lists each under the op that created it.
pub(crate) struct CreatedIdLog<'a> {
    generator: &'a dyn IdGenerator,
    op: usize,
    created: Vec<CreatedIds>,
}

impl<'a> CreatedIdLog<'a> {
    /// A log that mints ids with `generator`.
    pub(crate) fn new(generator: &'a dyn IdGenerator) -> Self {
        Self {
            generator,
            op: 0,
            created: Vec::new(),
        }
    }

    /// Lists the ids minted or recorded from now on under op `index`.
    pub(crate) fn set_op(&mut self, index: usize) {
        self.op = index;
    }

    /// The op being applied.
    pub(crate) fn op(&self) -> usize {
        self.op
    }

    /// A new id, listed as created by the current op.
    pub(crate) fn new_id(&mut self) -> Uuid {
        let id = self.generator.new_id();
        self.record(id);
        id
    }

    /// Lists `id`, minted with [`Self::generator`], as created by the current op.
    pub(crate) fn record(&mut self, id: Uuid) {
        match self.created.last_mut() {
            Some(last) if last.op == self.op => last.ids.push(id),
            _ => self.created.push(CreatedIds {
                op: self.op,
                ids: vec![id],
            }),
        }
    }

    /// The generator, for ids that aren't listed (exercise ids) or are listed afterwards.
    pub(crate) fn generator(&self) -> &'a dyn IdGenerator {
        self.generator
    }

    /// The ids the call created, listed by op.
    pub(crate) fn into_created(self) -> Vec<CreatedIds> {
        self.created
    }
}

/// The value as a string with more than whitespace in it. Errors with `InvalidValue` saying that
/// `what` is one.
pub(crate) fn non_empty_string(value: Option<&Value>, what: &str) -> Result<String, EditError> {
    match value {
        Some(Value::String(s)) if !s.trim().is_empty() => Ok(s.clone()),
        _ => Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!("{what} is a non-empty string"),
        )),
    }
}

/// The items an `add` value creates: each item of a non-empty list, or the one object. `noun`
/// names an item in the error, e.g. "a block".
pub(crate) fn value_items<'v>(value: &'v Value, noun: &str) -> Result<Vec<&'v Value>, EditError> {
    match value {
        Value::Array(items) if !items.is_empty() => Ok(items.iter().collect()),
        Value::Object(_) => Ok(vec![value]),
        Value::Array(_) => Err(EditError::new(
            EditErrorCode::InvalidValue,
            "add got an empty list",
        )),
        _ => Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!("add takes {noun} object or a list of them"),
        )),
    }
}

/// The objects an `add` value creates, each checked to have only `fields`. `noun` names an item
/// in errors, e.g. "an audience", and `shape` is the error for an item that isn't an object.
pub(crate) fn new_item_objects<'v>(
    value: &'v Value,
    noun: &str,
    shape: &str,
    fields: &[&str],
) -> Result<Vec<&'v Map<String, Value>>, EditError> {
    value_items(value, noun)?
        .into_iter()
        .map(|item| {
            let object = item
                .as_object()
                .ok_or_else(|| EditError::new(EditErrorCode::InvalidValue, shape))?;
            reject_unknown_keys(object, fields, noun)?;
            Ok(object)
        })
        .collect()
}

/// Fails with `UnknownField` naming every key of `object` outside `allowed`. `noun` names the
/// object in the message, e.g. "a block".
pub(crate) fn reject_unknown_keys(
    object: &Map<String, Value>,
    allowed: &[&str],
    noun: &str,
) -> Result<(), EditError> {
    let unknown: Vec<&String> = object
        .keys()
        .filter(|key| !allowed.contains(&key.as_str()))
        .collect();
    if unknown.is_empty() {
        return Ok(());
    }
    Err(EditError::new(
        EditErrorCode::UnknownField,
        format!("{noun} has no field {}", op::quote_list(&unknown)),
    )
    .with_fix(format!("fields: {}", allowed.join(", "))))
}
