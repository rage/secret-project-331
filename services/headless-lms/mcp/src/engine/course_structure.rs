//! `patch_course_structure`: modules, chapters and pages, their order, names, titles, paths and
//! chapter dates. Paths, chapter numbers and redirects are derived once at the end of a call.

use std::collections::{BTreeMap, HashMap, HashSet};

use chrono::{DateTime, Utc};
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use uuid::Uuid;

use super::error::{EditError, EditErrorCode, Warning, WarningCode};
use super::labels::{Labels, Reference, parse_reference, parse_uuid};
use super::op::{OpKind, PatchOp, PatchTarget, Position, parse_ops};
use super::page_content::{self, unescape_pointer};
use super::{CreatedIds, EngineContext, PageDocument, PageType, push_created};
use crate::text::slugify;

/// The course tree as agents read and edit it. Children arrays are in display order.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct CourseStructure {
    pub course: StructureCourse,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct StructureCourse {
    pub id: Uuid,
    /// Pages outside chapters; the course front page (`/`) is always first.
    pub pages: Vec<StructurePage>,
    /// The default module is always first.
    pub modules: Vec<StructureModule>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct StructureModule {
    pub id: Uuid,
    pub default: bool,
    /// Null exactly for the default module.
    pub name: Option<String>,
    pub chapters: Vec<StructureChapter>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct StructureChapter {
    pub id: Uuid,
    /// Derived from order; course-wide, starting at 1.
    pub chapter_number: i32,
    pub name: String,
    pub color: Option<String>,
    pub opens_at: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    /// The first page is the chapter's front page.
    pub pages: Vec<StructurePage>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct StructurePage {
    pub id: Uuid,
    pub title: String,
    pub url_path: String,
    pub hidden: bool,
    pub block_count: u32,
    pub exercise_count: u32,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub has_submissions: bool,
}

impl CourseStructure {
    pub fn modules(&self) -> impl Iterator<Item = &StructureModule> {
        self.course.modules.iter()
    }

    pub fn chapters(&self) -> impl Iterator<Item = &StructureChapter> {
        self.course.modules.iter().flat_map(|m| m.chapters.iter())
    }

    /// Every page with the chapter it belongs to.
    pub fn pages(&self) -> impl Iterator<Item = (Option<&StructureChapter>, &StructurePage)> {
        self.course.pages.iter().map(|p| (None, p)).chain(
            self.chapters()
                .flat_map(|c| c.pages.iter().map(move |p| (Some(c), p))),
        )
    }

    pub fn page(&self, page_id: Uuid) -> Option<&StructurePage> {
        self.pages().map(|(_, p)| p).find(|p| p.id == page_id)
    }

    pub fn chapter_of_page(&self, page_id: Uuid) -> Option<&StructureChapter> {
        self.pages()
            .find(|(_, p)| p.id == page_id)
            .and_then(|(c, _)| c)
    }

    /// The editor context a page's blocks are validated in.
    pub fn page_type(&self, page_id: Uuid) -> Option<PageType> {
        if let Some(page) = self.course.pages.iter().find(|p| p.id == page_id) {
            return Some(if page.url_path == "/" {
                PageType::CourseFrontPage
            } else {
                PageType::TopLevelPage
            });
        }
        self.chapters().find_map(|c| {
            let position = c.pages.iter().position(|p| p.id == page_id)?;
            Some(if position == 0 {
                PageType::ChapterFrontPage
            } else {
                PageType::CoursePage
            })
        })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Redirect {
    pub page_id: Uuid,
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ChapterRenumber {
    pub chapter_id: Uuid,
    pub from: i32,
    pub to: i32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PageCopy {
    pub source_page_id: Uuid,
    pub new_page_id: Uuid,
}

/// A page whose chapter changed; its exercises take the new chapter.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PageChapterMove {
    pub page_id: Uuid,
    pub from_chapter: Option<Uuid>,
    pub to_chapter: Option<Uuid>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct StructureResult {
    pub structure: CourseStructure,
    pub created: Vec<CreatedIds>,
    pub labels: BTreeMap<String, Uuid>,
    pub warnings: Vec<Warning>,
    /// Redirects to create from old paths of pages that still exist. Empty when the course has
    /// never been published.
    pub redirects: Vec<Redirect>,
    pub changed_paths: Vec<Redirect>,
    pub renumbered_chapters: Vec<ChapterRenumber>,
    /// Modules created by the call; they start with manual completion and certification off.
    pub new_modules: Vec<Uuid>,
    /// Content of pages created by `add`, empty when no `blocks` were given.
    pub new_pages: Vec<PageDocument>,
    /// Pages created by `copy`; the caller copies content with new block and exercise ids.
    pub page_copies: Vec<PageCopy>,
    pub moved_pages: Vec<PageChapterMove>,
}

/// Parses raw ops for this tool. See [`parse_ops`].
pub fn parse(raw: &[Value]) -> Result<Vec<PatchOp>, EditError> {
    parse_ops(raw, PatchTarget::CourseStructure)
}

pub fn apply(
    doc: &CourseStructure,
    ops: &[PatchOp],
    ctx: &EngineContext,
) -> Result<StructureResult, EditError> {
    let mut editor = StructureEditor::new(doc, ops, ctx);
    for (index, op) in ops.iter().enumerate() {
        editor.op_index = index;
        editor.apply_op(op).map_err(|e| e.at_op(index))?;
    }
    editor.finish(doc)
}

const MODULE_FIELDS: [&str; 1] = ["name"];
const CHAPTER_FIELDS: [&str; 4] = ["name", "color", "opens_at", "deadline"];
const PAGE_FIELDS: [&str; 3] = ["title", "url_path", "hidden"];
const DERIVED_FIELDS: [&str; 7] = [
    "id",
    "chapter_number",
    "order_number",
    "course_module_id",
    "chapter_id",
    "front_page_id",
    "default",
];
const COUNT_FIELDS: [&str; 3] = ["block_count", "exercise_count", "has_submissions"];
const MODULE_SETTINGS_FIELDS: [&str; 6] = [
    "completion_policy",
    "certification_enabled",
    "automatic_completion",
    "ects_credits",
    "uh_course_code",
    "enable_registering_completion_to_uh_open_university",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    Module,
    Chapter,
    Page,
}

impl Kind {
    fn noun(self) -> &'static str {
        match self {
            Kind::Module => "module",
            Kind::Chapter => "chapter",
            Kind::Page => "page",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ListRef {
    CoursePages,
    CourseModules,
    ModuleChapters(Uuid),
    ChapterPages(Uuid),
}

impl ListRef {
    fn kind(self) -> Kind {
        match self {
            ListRef::CoursePages | ListRef::ChapterPages(_) => Kind::Page,
            ListRef::CourseModules => Kind::Module,
            ListRef::ModuleChapters(_) => Kind::Chapter,
        }
    }

    fn path(self) -> String {
        match self {
            ListRef::CoursePages => "/course/pages".to_string(),
            ListRef::CourseModules => "/course/modules".to_string(),
            ListRef::ModuleChapters(id) => format!("/{id}/chapters"),
            ListRef::ChapterPages(id) => format!("/{id}/pages"),
        }
    }
}

#[derive(Debug, Clone)]
enum Address {
    Course,
    List(ListRef),
    Entity(Uuid),
    Field(Uuid, String),
}

#[derive(Debug, Clone, Copy)]
struct Loc {
    kind: Kind,
    list: ListRef,
    index: usize,
}

enum Anchor {
    Before(Uuid),
    After(Uuid),
    Start(ListRef),
    End(ListRef),
}

enum Entity {
    Module(StructureModule),
    Chapter(StructureChapter),
    Page(StructurePage),
}

struct StructureEditor<'c> {
    doc: CourseStructure,
    labels: Labels,
    removed: HashMap<Uuid, usize>,
    created: Vec<CreatedIds>,
    warnings: Vec<Warning>,
    explicit_paths: HashMap<Uuid, String>,
    new_modules: Vec<Uuid>,
    new_pages: Vec<PageDocument>,
    page_copies: Vec<PageCopy>,
    original_front_page: Option<Uuid>,
    ctx: &'c EngineContext<'c>,
    op_index: usize,
}

impl<'c> StructureEditor<'c> {
    fn new(doc: &CourseStructure, ops: &[PatchOp], ctx: &'c EngineContext<'c>) -> Self {
        Self {
            original_front_page: doc
                .course
                .pages
                .iter()
                .find(|p| p.url_path == "/")
                .map(|p| p.id),
            doc: doc.clone(),
            labels: Labels::prescan(ops),
            removed: HashMap::new(),
            created: Vec::new(),
            warnings: Vec::new(),
            explicit_paths: HashMap::new(),
            new_modules: Vec::new(),
            new_pages: Vec::new(),
            page_copies: Vec::new(),
            ctx,
            op_index: 0,
        }
    }

    fn apply_op(&mut self, op: &PatchOp) -> Result<(), EditError> {
        match op.op {
            OpKind::Add => self.add(op),
            OpKind::Remove => self.remove(op),
            OpKind::Replace => self.replace(op),
            OpKind::Move => self.move_entities(op),
            OpKind::Copy => self.copy(op),
            OpKind::Reorder => self.reorder(op),
            _ => Err(EditError::new(
                EditErrorCode::InvalidOp,
                "patch_course_structure doesn't take this op",
            )),
        }
    }

    // ---- lookup -------------------------------------------------------------------------

    fn locate(&self, id: Uuid) -> Option<Loc> {
        let course = &self.doc.course;
        if let Some(index) = course.pages.iter().position(|p| p.id == id) {
            return Some(Loc {
                kind: Kind::Page,
                list: ListRef::CoursePages,
                index,
            });
        }
        for (module_index, module) in course.modules.iter().enumerate() {
            if module.id == id {
                return Some(Loc {
                    kind: Kind::Module,
                    list: ListRef::CourseModules,
                    index: module_index,
                });
            }
            for (chapter_index, chapter) in module.chapters.iter().enumerate() {
                if chapter.id == id {
                    return Some(Loc {
                        kind: Kind::Chapter,
                        list: ListRef::ModuleChapters(module.id),
                        index: chapter_index,
                    });
                }
                if let Some(index) = chapter.pages.iter().position(|p| p.id == id) {
                    return Some(Loc {
                        kind: Kind::Page,
                        list: ListRef::ChapterPages(chapter.id),
                        index,
                    });
                }
            }
        }
        None
    }

    fn require(&self, id: Uuid) -> Result<Loc, EditError> {
        self.locate(id).ok_or_else(|| match self.removed.get(&id) {
            Some(op) => EditError::new(
                EditErrorCode::NotFound,
                format!("{id} was removed by op {op} of this call"),
            ),
            None => EditError::new(
                EditErrorCode::NotFound,
                format!("no module, chapter or page {id} in this course"),
            )
            .with_fix("get_course_structure lists the current ids"),
        })
    }

    fn resolve_segment(&self, segment: &str, whole: &str) -> Result<Uuid, EditError> {
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

    fn address(&self, path: &str) -> Result<Address, EditError> {
        let Some(rest) = path.strip_prefix('/') else {
            return Err(EditError::new(
                EditErrorCode::InvalidPath,
                format!(
                    "path \"{path}\" must start with /, e.g. /course/modules, /<chapter id>/pages or /<page id>/title"
                ),
            ));
        };
        let segments: Vec<String> = rest.split('/').map(unescape_pointer).collect();
        let first = segments[0].as_str();
        let is_course =
            first == "course" || Uuid::parse_str(first).is_ok_and(|id| id == self.doc.course.id);
        if is_course {
            return match segments.get(1).map(String::as_str) {
                None => Ok(Address::Course),
                Some("pages") if segments.len() == 2 => Ok(Address::List(ListRef::CoursePages)),
                Some("modules") if segments.len() == 2 => Ok(Address::List(ListRef::CourseModules)),
                Some("pages" | "modules") => Err(EditError::new(
                    EditErrorCode::NumericIndex,
                    format!("\"{path}\" uses a numeric index; modules and pages are addressed by id"),
                )
                .with_fix("use /<id>, or the list with a position, e.g. {\"path\":\"/course/pages\",\"position\":\"end\"}")),
                Some(field) => Err(EditError::new(
                    EditErrorCode::WrongTool,
                    format!("course field \"{field}\" is edited with patch_course_settings"),
                )),
            };
        }
        let id = self.resolve_segment(first, path)?;
        let loc = self.require(id)?;
        match (loc.kind, segments.get(1).map(String::as_str)) {
            (_, None) => Ok(Address::Entity(id)),
            (Kind::Module, Some("chapters")) | (Kind::Chapter, Some("pages"))
                if segments.len() > 2 =>
            {
                Err(EditError::new(
                    EditErrorCode::NumericIndex,
                    format!(
                        "\"{path}\" uses a numeric index; chapters and pages are addressed by id"
                    ),
                ))
            }
            (Kind::Module, Some("chapters")) => Ok(Address::List(ListRef::ModuleChapters(id))),
            (Kind::Chapter, Some("pages")) => Ok(Address::List(ListRef::ChapterPages(id))),
            (kind, Some(field)) if segments.len() == 2 => {
                check_field(kind, field)?;
                Ok(Address::Field(id, field.to_string()))
            }
            (kind, Some(_)) => Err(EditError::new(
                EditErrorCode::InvalidPath,
                format!("\"{path}\" goes deeper than a {} field", kind.noun()),
            )),
        }
    }

    fn list_len(&self, list: ListRef) -> usize {
        match list {
            ListRef::CoursePages => self.doc.course.pages.len(),
            ListRef::CourseModules => self.doc.course.modules.len(),
            ListRef::ModuleChapters(id) => self.module(id).map(|m| m.chapters.len()).unwrap_or(0),
            ListRef::ChapterPages(id) => self.chapter(id).map(|c| c.pages.len()).unwrap_or(0),
        }
    }

    fn list_ids(&self, list: ListRef) -> Vec<Uuid> {
        match list {
            ListRef::CoursePages => self.doc.course.pages.iter().map(|p| p.id).collect(),
            ListRef::CourseModules => self.doc.course.modules.iter().map(|m| m.id).collect(),
            ListRef::ModuleChapters(id) => self
                .module(id)
                .map(|m| m.chapters.iter().map(|c| c.id).collect())
                .unwrap_or_default(),
            ListRef::ChapterPages(id) => self
                .chapter(id)
                .map(|c| c.pages.iter().map(|p| p.id).collect())
                .unwrap_or_default(),
        }
    }

    fn module(&self, id: Uuid) -> Option<&StructureModule> {
        self.doc.course.modules.iter().find(|m| m.id == id)
    }

    fn chapter(&self, id: Uuid) -> Option<&StructureChapter> {
        self.doc.chapters().find(|c| c.id == id)
    }

    fn chapter_mut(&mut self, id: Uuid) -> Option<&mut StructureChapter> {
        self.doc
            .course
            .modules
            .iter_mut()
            .flat_map(|m| m.chapters.iter_mut())
            .find(|c| c.id == id)
    }

    fn page_mut(&mut self, id: Uuid) -> Option<&mut StructurePage> {
        let course = &mut self.doc.course;
        course
            .pages
            .iter_mut()
            .chain(
                course
                    .modules
                    .iter_mut()
                    .flat_map(|m| m.chapters.iter_mut())
                    .flat_map(|c| c.pages.iter_mut()),
            )
            .find(|p| p.id == id)
    }

    fn take(&mut self, list: ListRef, start: usize, end: usize) -> Vec<Entity> {
        let range = start..=end;
        match list {
            ListRef::CoursePages => self
                .doc
                .course
                .pages
                .drain(range)
                .map(Entity::Page)
                .collect(),
            ListRef::CourseModules => self
                .doc
                .course
                .modules
                .drain(range)
                .map(Entity::Module)
                .collect(),
            ListRef::ModuleChapters(id) => self
                .doc
                .course
                .modules
                .iter_mut()
                .find(|m| m.id == id)
                .map(|m| m.chapters.drain(range).map(Entity::Chapter).collect())
                .unwrap_or_default(),
            ListRef::ChapterPages(id) => self
                .chapter_mut(id)
                .map(|c| c.pages.drain(range).map(Entity::Page).collect())
                .unwrap_or_default(),
        }
    }

    fn put(&mut self, list: ListRef, index: usize, entities: Vec<Entity>) -> Result<(), EditError> {
        for (offset, entity) in entities.into_iter().enumerate() {
            let at = index + offset;
            match (list, entity) {
                (ListRef::CoursePages, Entity::Page(page)) => {
                    self.doc.course.pages.insert(at, page)
                }
                (ListRef::CourseModules, Entity::Module(module)) => {
                    self.doc.course.modules.insert(at, module)
                }
                (ListRef::ModuleChapters(id), Entity::Chapter(chapter)) => {
                    if let Some(module) = self.doc.course.modules.iter_mut().find(|m| m.id == id) {
                        module.chapters.insert(at, chapter);
                    }
                }
                (ListRef::ChapterPages(id), Entity::Page(page)) => {
                    if let Some(chapter) = self.chapter_mut(id) {
                        chapter.pages.insert(at, page);
                    }
                }
                (list, entity) => {
                    let noun = match entity {
                        Entity::Module(_) => "module",
                        Entity::Chapter(_) => "chapter",
                        Entity::Page(_) => "page",
                    };
                    return Err(wrong_list(noun, list));
                }
            }
        }
        Ok(())
    }

    // ---- placement ----------------------------------------------------------------------

    fn anchor(&self, address: &Address, position: Option<Position>) -> Result<Anchor, EditError> {
        let Some(position) = position else {
            return Err(EditError::new(EditErrorCode::PositionRequired, "this op needs \"position\"")
                .with_fix("position is before/after a sibling (\"path\":\"/<id>\") or start/end of a list (\"path\":\"/<chapter id>/pages\")"));
        };
        match (address, position) {
            (Address::List(list), Position::Start) => Ok(Anchor::Start(*list)),
            (Address::List(list), Position::End) => Ok(Anchor::End(*list)),
            (Address::Entity(id), Position::Before) => Ok(Anchor::Before(*id)),
            (Address::Entity(id), Position::After) => Ok(Anchor::After(*id)),
            (Address::Entity(id), Position::Start | Position::End) => {
                let loc = self.require(*id)?;
                let fix = match loc.kind {
                    Kind::Module => format!("\"path\":\"/{id}/chapters\""),
                    Kind::Chapter => format!("\"path\":\"/{id}/pages\""),
                    Kind::Page => {
                        "before/after this page, or start/end of its chapter's pages".to_string()
                    }
                };
                Err(EditError::new(
                    EditErrorCode::PositionNeedsChildren,
                    "start/end need a list, not an entity",
                )
                .with_fix(fix))
            }
            (Address::List(list), Position::Before | Position::After) => Err(EditError::new(
                EditErrorCode::PositionNeedsSibling,
                format!("{} is a list; before/after need a sibling", list.path()),
            )
            .with_fix(format!(
                "use position start/end with {}, or before/after with a sibling's path",
                list.path()
            ))),
            (Address::Course, _) => Err(EditError::new(
                EditErrorCode::PositionNeedsChildren,
                "/course holds two lists",
            )
            .with_fix("use /course/pages or /course/modules")),
            (Address::Field(..), _) => Err(EditError::new(
                EditErrorCode::InvalidPath,
                "items are placed next to an entity or into a list, not at a field",
            )),
        }
    }

    /// (list, index) for an anchor in the current tree, checking the pinned positions.
    fn resolve_anchor(&self, anchor: &Anchor, kind: Kind) -> Result<(ListRef, usize), EditError> {
        let (list, index) = match anchor {
            Anchor::Before(id) | Anchor::After(id) => {
                let loc = self.require(*id)?;
                let index = if matches!(anchor, Anchor::Before(_)) {
                    loc.index
                } else {
                    loc.index + 1
                };
                (loc.list, index)
            }
            Anchor::Start(list) => (*list, 0),
            Anchor::End(list) => (*list, self.list_len(*list)),
        };
        if list.kind() != kind {
            return Err(wrong_list(kind.noun(), list));
        }
        if index == 0 && list == ListRef::CoursePages && self.front_page_id().is_some() {
            let front = self.front_page_id().unwrap_or_default();
            return Err(EditError::new(
                EditErrorCode::PinnedFrontPage,
                "the course front page (/) stays first in /course/pages",
            )
            .with_fix(format!("{{\"path\":\"/{front}\",\"position\":\"after\"}}")));
        }
        if index == 0 && list == ListRef::CourseModules {
            return Err(EditError::new(
                EditErrorCode::DefaultModule,
                "the default module stays first",
            )
            .with_fix(format!(
                "{{\"path\":\"/{}\",\"position\":\"after\"}}",
                self.doc.course.modules[0].id
            )));
        }
        Ok((list, index))
    }

    fn front_page_id(&self) -> Option<Uuid> {
        self.doc
            .course
            .pages
            .first()
            .filter(|p| p.url_path == "/")
            .map(|p| p.id)
    }

    fn range(&self, from: Uuid, through: Option<Uuid>) -> Result<(Loc, usize), EditError> {
        let start = self.require(from)?;
        let Some(last) = through else {
            return Ok((start, start.index));
        };
        let end = self.require(last)?;
        if end.list != start.list {
            return Err(EditError::new(
                EditErrorCode::InvalidRange,
                format!("a range must be siblings in one list; /{from} is in {} and /{last} in {}", start.list.path(), end.list.path()),
            )
            .with_details(json!({"from_siblings": self.sibling_paths(start.list), "through_siblings": self.sibling_paths(end.list)})));
        }
        if end.index < start.index {
            return Err(EditError::new(
                EditErrorCode::InvalidRange,
                format!("the range is reversed: /{last} comes before /{from}"),
            )
            .with_fix(format!("from /{last} through /{from}"))
            .with_details(json!({"siblings_in_order": self.sibling_paths(start.list)})));
        }
        Ok((start, end.index))
    }

    fn sibling_paths(&self, list: ListRef) -> Vec<String> {
        self.list_ids(list)
            .into_iter()
            .map(|id| format!("/{id}"))
            .collect()
    }

    fn check_not_pinned(
        &self,
        list: ListRef,
        start: usize,
        end: usize,
        action: &str,
    ) -> Result<(), EditError> {
        if list == ListRef::CoursePages && start == 0 && self.front_page_id().is_some() {
            return Err(EditError::new(
                EditErrorCode::PinnedFrontPage,
                format!("the course front page (/) can't be {action}; only its fields can change"),
            ));
        }
        if list == ListRef::CourseModules && start == 0 {
            return Err(EditError::new(
                EditErrorCode::DefaultModule,
                format!("the default module can't be {action}"),
            ));
        }
        let _ = end;
        Ok(())
    }

    // ---- new entities -------------------------------------------------------------------

    fn new_entities(&mut self, kind: Kind, value: &Value) -> Result<Vec<Entity>, EditError> {
        let items: Vec<&Value> = match value {
            Value::Array(items) if !items.is_empty() => items.iter().collect(),
            Value::Object(_) => vec![value],
            _ => {
                return Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    format!("add takes a {} object or a list of them", kind.noun()),
                ));
            }
        };
        items
            .into_iter()
            .map(|item| self.new_entity(kind, item))
            .collect()
    }

    fn new_entity(&mut self, kind: Kind, value: &Value) -> Result<Entity, EditError> {
        let object = value.as_object().ok_or_else(|| {
            EditError::new(
                EditErrorCode::InvalidValue,
                format!("a new {} is an object", kind.noun()),
            )
        })?;
        let allowed: &[&str] = match kind {
            Kind::Module => &["name", "label"],
            Kind::Chapter => &["name", "color", "opens_at", "deadline", "pages", "label"],
            Kind::Page => &["title", "url_path", "hidden", "blocks", "label"],
        };
        for key in object.keys() {
            if !allowed.contains(&key.as_str()) {
                check_field(kind, key)?;
                if key == "chapters" {
                    return Err(EditError::new(
                        EditErrorCode::FieldNotAllowed,
                        "add the module first, then its chapters with a label path: /$m/chapters",
                    ));
                }
                return Err(EditError::new(
                    EditErrorCode::UnknownField,
                    format!("a new {} doesn't take \"{key}\"", kind.noun()),
                )
                .with_fix(format!("fields: {}", allowed.join(", "))));
            }
        }
        let label = match object.get("label") {
            None | Some(Value::Null) => None,
            Some(Value::String(label)) => Some(label.clone()),
            Some(_) => {
                return Err(EditError::new(
                    EditErrorCode::LabelInvalid,
                    "label is a string like \"$ch\"",
                ));
            }
        };
        if kind == Kind::Page {
            let page = self.new_page(object)?;
            if let Some(label) = &label {
                self.labels.define(label, page.id)?;
            }
            return Ok(Entity::Page(page));
        }
        let id = self.ctx.ids.new_id();
        push_created(&mut self.created, self.op_index, id);
        if let Some(label) = &label {
            self.labels.define(label, id)?;
        }
        match kind {
            Kind::Module => {
                let name = required_string(object, "name", "a new module needs a name")?;
                self.new_modules.push(id);
                Ok(Entity::Module(StructureModule {
                    id,
                    default: false,
                    name: Some(name),
                    chapters: Vec::new(),
                }))
            }
            Kind::Chapter => {
                let name = required_string(object, "name", "a new chapter needs a name")?;
                let mut chapter = StructureChapter {
                    id,
                    chapter_number: 0,
                    name: name.clone(),
                    color: optional_color(object.get("color"))?,
                    opens_at: optional_date(object.get("opens_at"), "opens_at")?,
                    deadline: optional_date(object.get("deadline"), "deadline")?,
                    pages: Vec::new(),
                };
                match object.get("pages") {
                    Some(Value::Array(pages)) if !pages.is_empty() => {
                        for page in pages {
                            if let Entity::Page(page) = self.new_entity(Kind::Page, page)? {
                                chapter.pages.push(page);
                            }
                        }
                    }
                    Some(Value::Array(_)) | None | Some(Value::Null) => {
                        let front = self.new_page(&Map::from_iter([(
                            "title".to_string(),
                            Value::String(name),
                        )]))?;
                        chapter.pages.push(front);
                    }
                    Some(_) => {
                        return Err(EditError::new(
                            EditErrorCode::InvalidValue,
                            "pages is a list of page objects",
                        ));
                    }
                }
                Ok(Entity::Chapter(chapter))
            }
            Kind::Page => unreachable!("pages return early"),
        }
    }

    fn new_page(&mut self, object: &Map<String, Value>) -> Result<StructurePage, EditError> {
        let id = self.ctx.ids.new_id();
        self.new_page_with_id(object, id)
    }

    fn new_page_with_id(
        &mut self,
        object: &Map<String, Value>,
        id: Uuid,
    ) -> Result<StructurePage, EditError> {
        push_created(&mut self.created, self.op_index, id);
        let title = required_string(object, "title", "a new page needs a title")?;
        if let Some(url_path) = object.get("url_path") {
            let url_path = url_path.as_str().ok_or_else(|| {
                EditError::new(EditErrorCode::InvalidValue, "url_path is a string")
            })?;
            self.explicit_paths.insert(id, url_path.to_string());
        }
        let blocks_value = object.get("blocks").filter(|v| !v.is_null());
        let hidden = match object.get("hidden") {
            Some(Value::Bool(hidden)) => *hidden,
            Some(_) => {
                return Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    "hidden is true or false",
                ));
            }
            None if self.ctx.course_is_live && blocks_value.is_none() => {
                self.warnings.push(Warning {
                    code: WarningCode::NewPageHidden,
                    message: format!("page {id} has no content yet, so it starts hidden; set hidden to false when it is ready"),
                    op: Some(self.op_index),
                });
                true
            }
            None => false,
        };
        let blocks = match blocks_value {
            Some(value @ Value::Array(items)) if !items.is_empty() => {
                self.materialize_blocks(id, value)?
            }
            Some(Value::Array(_)) | None => Vec::new(),
            Some(_) => {
                return Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    "blocks is a list of blocks",
                ));
            }
        };
        let exercise_count = blocks
            .iter()
            .filter(|b| super::blocks::is_exercise(b))
            .count() as u32;
        let block_count = super::blocks::count_blocks(&blocks) as u32;
        self.new_pages.push(PageDocument {
            page_id: id,
            page_type: PageType::CoursePage,
            blocks,
        });
        Ok(StructurePage {
            id,
            title,
            url_path: String::new(),
            hidden,
            block_count,
            exercise_count,
            has_submissions: false,
        })
    }

    /// Builds a new page's blocks with the page tool's rules.
    fn materialize_blocks(
        &mut self,
        page_id: Uuid,
        value: &Value,
    ) -> Result<Vec<GutenbergBlock>, EditError> {
        let empty = PageDocument {
            page_id,
            page_type: PageType::CoursePage,
            blocks: Vec::new(),
        };
        let op = PatchOp {
            op: OpKind::Add,
            path: String::new(),
            from: None,
            through: None,
            value: Some(value.clone()),
            position: Some(Position::End),
            to_page: None,
            label: None,
            at_text: None,
        };
        let ctx = EngineContext {
            ids: self.ctx.ids,
            pages: &[],
            course_is_live: self.ctx.course_is_live,
            creates_redirects: self.ctx.creates_redirects,
        };
        let result =
            page_content::apply(&empty, std::slice::from_ref(&op), &ctx).map_err(|mut e| {
                e.message = format!("in the blocks of new page {page_id}: {}", e.message);
                e.op = None;
                e
            })?;
        for created in result.created {
            for id in created.ids {
                push_created(&mut self.created, self.op_index, id);
            }
        }
        self.warnings
            .extend(result.warnings.into_iter().map(|mut w| {
                w.op = Some(self.op_index);
                w
            }));
        Ok(result.page.blocks)
    }

    // ---- ops ----------------------------------------------------------------------------

    fn add(&mut self, op: &PatchOp) -> Result<(), EditError> {
        let address = self.address(&op.path)?;
        let value = op.value.as_ref().ok_or_else(|| missing("value"))?;
        let anchor = self.anchor(&address, op.position)?;
        let kind = match &anchor {
            Anchor::Start(list) | Anchor::End(list) => list.kind(),
            Anchor::Before(id) | Anchor::After(id) => self.require(*id)?.kind,
        };
        let (list, index) = self.resolve_anchor(&anchor, kind)?;
        let entities = self.new_entities(kind, value)?;
        if let Some(label) = &op.label {
            if entities.len() != 1 {
                return Err(EditError::new(
                    EditErrorCode::FieldNotAllowed,
                    "an op-level label can't name several new items",
                )
                .with_fix("put \"label\" inside each value item"));
            }
            let id = match &entities[0] {
                Entity::Module(m) => m.id,
                Entity::Chapter(c) => c.id,
                Entity::Page(p) => p.id,
            };
            self.labels.define(label, id)?;
        }
        self.put(list, index, entities)
    }

    fn remove(&mut self, op: &PatchOp) -> Result<(), EditError> {
        match self.address(&op.path)? {
            Address::Entity(id) => {
                let through = op
                    .through
                    .as_deref()
                    .map(|r| self.resolve_reference(r))
                    .transpose()?;
                let (start, end) = self.range(id, through)?;
                self.check_not_pinned(start.list, start.index, end, "removed")?;
                if start.kind == Kind::Module {
                    let module = &self.doc.course.modules[start.index];
                    if !module.chapters.is_empty() {
                        let chapters: Vec<String> = module
                            .chapters
                            .iter()
                            .map(|c| format!("/{} ({})", c.id, c.name))
                            .collect();
                        return Err(EditError::new(
                            EditErrorCode::ModuleNotEmpty,
                            format!(
                                "module {} still has chapters: {}",
                                module.id,
                                chapters.join(", ")
                            ),
                        )
                        .with_fix(
                            "move or remove its chapters first, in the same call if you like",
                        ));
                    }
                }
                let removed = self.take(start.list, start.index, end);
                for entity in &removed {
                    for id in entity_ids(entity) {
                        self.removed.insert(id, self.op_index);
                    }
                }
                Ok(())
            }
            Address::Field(id, field) => self.set_field(id, &field, Value::Null, true),
            Address::Course | Address::List(_) => Err(EditError::new(
                EditErrorCode::InvalidPath,
                "remove takes a module, chapter or page (or a range of them), not a list",
            )),
        }
    }

    fn replace(&mut self, op: &PatchOp) -> Result<(), EditError> {
        let value = op.value.clone().ok_or_else(|| missing("value"))?;
        match self.address(&op.path)? {
            Address::Field(id, field) => self.set_field(id, &field, value, false),
            Address::Entity(id) => {
                let Value::Object(fields) = value else {
                    return Err(EditError::new(
                        EditErrorCode::InvalidValue,
                        "replace on an entity takes an object of the fields to set",
                    ));
                };
                let kind = self.require(id)?.kind;
                for (field, value) in fields {
                    if field == "id" && value.as_str() == Some(id.to_string().as_str()) {
                        continue;
                    }
                    if matches!(field.as_str(), "pages" | "chapters") {
                        return Err(EditError::new(
                            EditErrorCode::FieldNotAllowed,
                            format!("{field} changes through move, copy, remove and reorder"),
                        ));
                    }
                    if COUNT_FIELDS.contains(&field.as_str())
                        || (DERIVED_FIELDS.contains(&field.as_str())
                            && self.field_value(id, kind, &field) == Some(value.clone()))
                    {
                        continue;
                    }
                    check_field(kind, &field)?;
                    self.set_field(id, &field, value, false)?;
                }
                Ok(())
            }
            Address::List(list) => Err(EditError::new(
                EditErrorCode::InvalidPath,
                format!(
                    "{} changes through add, move, remove and reorder",
                    list.path()
                ),
            )
            .with_fix(format!(
                "{{\"op\":\"reorder\",\"path\":\"{}\",\"value\":[ids in the new order]}}",
                list.path()
            ))),
            Address::Course => Err(EditError::new(
                EditErrorCode::WrongTool,
                "course fields are edited with patch_course_settings",
            )),
        }
    }

    fn field_value(&self, id: Uuid, kind: Kind, field: &str) -> Option<Value> {
        match (kind, field) {
            (Kind::Chapter, "chapter_number") => self.chapter(id).map(|c| json!(c.chapter_number)),
            (Kind::Module, "default") => self.module(id).map(|m| json!(m.default)),
            _ => None,
        }
    }

    fn set_field(
        &mut self,
        id: Uuid,
        field: &str,
        value: Value,
        is_remove: bool,
    ) -> Result<(), EditError> {
        let loc = self.require(id)?;
        let not_nullable = |field: &str| {
            EditError::new(
                EditErrorCode::InvalidValue,
                format!("{field} can't be empty"),
            )
            .with_fix(format!("replace {field} with a new value instead"))
        };
        match loc.kind {
            Kind::Module => {
                let module = &mut self.doc.course.modules[loc.index];
                if module.default {
                    return Err(EditError::new(
                        EditErrorCode::DefaultModule,
                        "the default module has no name and can't be renamed",
                    ));
                }
                match value {
                    Value::String(name) if !name.trim().is_empty() => module.name = Some(name),
                    Value::Null if is_remove => {
                        return Err(EditError::new(
                            EditErrorCode::InvalidValue,
                            "modules other than the default one need a name",
                        ));
                    }
                    _ => {
                        return Err(EditError::new(
                            EditErrorCode::InvalidValue,
                            "a module name is a non-empty string",
                        ));
                    }
                }
            }
            Kind::Chapter => {
                let chapter = self.chapter_mut(id).ok_or_else(|| {
                    EditError::new(EditErrorCode::NotFound, "chapter disappeared")
                })?;
                match field {
                    "name" => match value {
                        Value::String(name) if !name.trim().is_empty() => chapter.name = name,
                        Value::Null => return Err(not_nullable("name")),
                        _ => {
                            return Err(EditError::new(
                                EditErrorCode::InvalidValue,
                                "a chapter name is a non-empty string",
                            ));
                        }
                    },
                    "color" => chapter.color = optional_color(Some(&value))?,
                    "opens_at" => chapter.opens_at = optional_date(Some(&value), "opens_at")?,
                    "deadline" => chapter.deadline = optional_date(Some(&value), "deadline")?,
                    _ => {
                        return Err(check_field(Kind::Chapter, field)
                            .err()
                            .unwrap_or_else(|| unknown_field(Kind::Chapter, field)));
                    }
                }
            }
            Kind::Page => {
                let page = self
                    .page_mut(id)
                    .ok_or_else(|| EditError::new(EditErrorCode::NotFound, "page disappeared"))?;
                match (field, value) {
                    ("title", Value::String(title)) if !title.trim().is_empty() => {
                        page.title = title
                    }
                    ("hidden", Value::Bool(hidden)) => page.hidden = hidden,
                    ("url_path", Value::String(path)) => {
                        if page.url_path == "/" {
                            return Err(EditError::new(
                                EditErrorCode::PinnedFrontPage,
                                "the course front page's path is always /",
                            ));
                        }
                        self.explicit_paths.insert(id, path);
                    }
                    (field, Value::Null) => return Err(not_nullable(field)),
                    ("title", _) => {
                        return Err(EditError::new(
                            EditErrorCode::InvalidValue,
                            "a title is a non-empty string",
                        ));
                    }
                    ("hidden", _) => {
                        return Err(EditError::new(
                            EditErrorCode::InvalidValue,
                            "hidden is true or false",
                        ));
                    }
                    ("url_path", _) => {
                        return Err(EditError::new(
                            EditErrorCode::InvalidValue,
                            "url_path is a string such as \"/faq\"",
                        ));
                    }
                    (field, _) => return Err(unknown_field(Kind::Page, field)),
                }
            }
        }
        Ok(())
    }

    fn move_entities(&mut self, op: &PatchOp) -> Result<(), EditError> {
        let from_raw = op.from.as_deref().ok_or_else(|| missing("from"))?;
        let from = match self.address(from_raw)? {
            Address::Entity(id) => id,
            _ => {
                return Err(EditError::new(
                    EditErrorCode::InvalidPath,
                    format!("from must name a module, chapter or page; got \"{from_raw}\""),
                ));
            }
        };
        let through = op
            .through
            .as_deref()
            .map(|r| self.resolve_reference(r))
            .transpose()?;
        let (start, end) = self.range(from, through)?;
        self.check_not_pinned(start.list, start.index, end, "moved")?;
        let address = self.address(&op.path)?;
        let anchor = self.anchor(&address, op.position)?;

        let moved_ids: HashSet<Uuid> = self.list_ids(start.list)[start.index..=end]
            .iter()
            .copied()
            .collect();
        let anchor_id = match &anchor {
            Anchor::Before(id) | Anchor::After(id) => Some(*id),
            Anchor::Start(ListRef::ModuleChapters(id) | ListRef::ChapterPages(id))
            | Anchor::End(ListRef::ModuleChapters(id) | ListRef::ChapterPages(id)) => Some(*id),
            _ => None,
        };
        if let Some(anchor_id) = anchor_id {
            if moved_ids.contains(&anchor_id) {
                return Err(EditError::new(
                    EditErrorCode::MoveIntoItself,
                    format!("{anchor_id} is part of what is being moved"),
                )
                .with_fix("choose a target outside the moved range"));
            }
        }
        if start.kind == Kind::Page {
            let target_list = match &anchor {
                Anchor::Before(id) | Anchor::After(id) => self.require(*id)?.list,
                Anchor::Start(list) | Anchor::End(list) => *list,
            };
            if target_list == ListRef::CoursePages {
                let ids = self.list_ids(start.list);
                let with_exercises: Vec<String> = ids[start.index..=end]
                    .iter()
                    .filter_map(|id| self.doc.page(*id))
                    .filter(|p| p.exercise_count > 0)
                    .map(|p| format!("/{} ({})", p.id, p.title))
                    .collect();
                if !with_exercises.is_empty() {
                    return Err(EditError::new(
                        EditErrorCode::InvariantViolated,
                        format!(
                            "pages with exercises can't move outside chapters: {}",
                            with_exercises.join(", ")
                        ),
                    ));
                }
            }
        }
        let entities = self.take(start.list, start.index, end);
        let (list, index) = match self.resolve_anchor(&anchor, start.kind) {
            Ok(target) => target,
            Err(error) => return Err(error),
        };
        self.put(list, index, entities)
    }

    fn copy(&mut self, op: &PatchOp) -> Result<(), EditError> {
        let from_raw = op.from.as_deref().ok_or_else(|| missing("from"))?;
        let from = match self.address(from_raw)? {
            Address::Entity(id) => id,
            _ => {
                return Err(EditError::new(
                    EditErrorCode::InvalidPath,
                    "from must name a chapter or a page",
                ));
            }
        };
        let loc = self.require(from)?;
        let address = self.address(&op.path)?;
        let anchor = self.anchor(&address, op.position)?;
        let (list, index) = self.resolve_anchor(&anchor, loc.kind)?;
        let copy = match loc.kind {
            Kind::Module => {
                return Err(EditError::new(
                    EditErrorCode::InvalidOp,
                    "modules can't be copied; copy their chapters into a new module",
                ));
            }
            Kind::Page => {
                let source =
                    self.doc.page(from).cloned().ok_or_else(|| {
                        EditError::new(EditErrorCode::NotFound, "page disappeared")
                    })?;
                Entity::Page(self.copy_page(&source))
            }
            Kind::Chapter => {
                let source = self.chapter(from).cloned().ok_or_else(|| {
                    EditError::new(EditErrorCode::NotFound, "chapter disappeared")
                })?;
                let id = self.ctx.ids.new_id();
                push_created(&mut self.created, self.op_index, id);
                let pages = source.pages.iter().map(|p| self.copy_page(p)).collect();
                Entity::Chapter(StructureChapter {
                    id,
                    name: format!("{}-copy", source.name),
                    pages,
                    chapter_number: 0,
                    ..source
                })
            }
        };
        if let Some(label) = &op.label {
            let id = match &copy {
                Entity::Chapter(c) => c.id,
                Entity::Page(p) => p.id,
                Entity::Module(m) => m.id,
            };
            self.labels.define(label, id)?;
        }
        self.put(list, index, vec![copy])
    }

    fn copy_page(&mut self, source: &StructurePage) -> StructurePage {
        let id = self.ctx.ids.new_id();
        push_created(&mut self.created, self.op_index, id);
        self.page_copies.push(PageCopy {
            source_page_id: source.id,
            new_page_id: id,
        });
        let last_segment = source
            .url_path
            .rsplit('/')
            .next()
            .filter(|s| !s.is_empty() && !is_chapter_segment(s))
            .map(str::to_string)
            .unwrap_or_else(|| slugify(&source.title));
        self.explicit_paths
            .insert(id, format!("{last_segment}-copy"));
        StructurePage {
            id,
            title: format!("{}-copy", source.title),
            url_path: String::new(),
            hidden: source.hidden,
            block_count: source.block_count,
            exercise_count: source.exercise_count,
            has_submissions: false,
        }
    }

    fn reorder(&mut self, op: &PatchOp) -> Result<(), EditError> {
        let list = match self.address(&op.path)? {
            Address::List(list) => list,
            Address::Entity(id) => {
                return Err(EditError::new(
                    EditErrorCode::InvalidPath,
                    "reorder takes a list path",
                )
                .with_fix(format!(
                    "/{id}/pages, /{id}/chapters, /course/pages or /course/modules"
                )));
            }
            _ => {
                return Err(EditError::new(
                    EditErrorCode::InvalidPath,
                    "reorder takes a list path such as /<chapter id>/pages",
                ));
            }
        };
        let Some(Value::Array(values)) = &op.value else {
            return Err(EditError::new(
                EditErrorCode::InvalidValue,
                "reorder's value is the list's ids in the new order",
            ));
        };
        let mut order = Vec::with_capacity(values.len());
        for value in values {
            let raw = value.as_str().ok_or_else(|| {
                EditError::new(
                    EditErrorCode::InvalidValue,
                    "reorder's value is a list of id strings",
                )
            })?;
            order.push(self.resolve_reference(raw)?);
        }
        let current = self.list_ids(list);
        let current_set: HashSet<Uuid> = current.iter().copied().collect();
        let given: HashSet<Uuid> = order.iter().copied().collect();
        if given != current_set || order.len() != current.len() {
            return Err(EditError::new(
                EditErrorCode::ReorderMismatch,
                format!(
                    "reorder's value must list exactly the current children of {}",
                    list.path()
                ),
            )
            .with_details(
                json!({"current_ids": current.iter().map(Uuid::to_string).collect::<Vec<_>>()}),
            ));
        }
        let entities = self.take(list, 0, current.len() - 1);
        let mut by_id: HashMap<Uuid, Entity> = entities
            .into_iter()
            .map(|e| (entity_ids(&e)[0], e))
            .collect();
        let reordered: Vec<Entity> = order.iter().filter_map(|id| by_id.remove(id)).collect();
        let first_is_pinned = match list {
            ListRef::CoursePages => self
                .original_front_page
                .is_some_and(|front| order[0] != front),
            ListRef::CourseModules => order[0] != current[0],
            _ => false,
        };
        self.put(list, 0, reordered)?;
        if first_is_pinned {
            return Err(EditError::new(
                if list == ListRef::CourseModules {
                    EditErrorCode::DefaultModule
                } else {
                    EditErrorCode::PinnedFrontPage
                },
                format!(
                    "the first item of {} is pinned and must stay first",
                    list.path()
                ),
            ));
        }
        Ok(())
    }

    // ---- end of call --------------------------------------------------------------------

    fn finish(mut self, before: &CourseStructure) -> Result<StructureResult, EditError> {
        let modules = &self.doc.course.modules;
        match modules.first() {
            Some(first) if first.default => {}
            _ => {
                return Err(EditError::new(
                    EditErrorCode::DefaultModule,
                    "the default module must stay first",
                ));
            }
        }
        if let Some(unnamed) = modules
            .iter()
            .skip(1)
            .find(|m| m.name.as_deref().is_none_or(|n| n.trim().is_empty()))
        {
            return Err(EditError::new(
                EditErrorCode::InvalidValue,
                format!("module {} needs a name", unnamed.id),
            ));
        }
        if let Some(empty) = self.doc.chapters().find(|c| c.pages.is_empty()) {
            return Err(EditError::new(
                EditErrorCode::ChapterNeedsPage,
                format!(
                    "chapter {} ({}) would have no pages; a chapter always has a front page",
                    empty.id, empty.name
                ),
            )
            .with_fix(format!(
                "remove the chapter instead: {{\"op\":\"remove\",\"path\":\"/{}\"}}",
                empty.id
            )));
        }
        if let Some(front) = self.original_front_page {
            if self.doc.course.pages.first().map(|p| p.id) != Some(front) {
                return Err(EditError::new(
                    EditErrorCode::PinnedFrontPage,
                    "the course front page (/) must stay first in /course/pages",
                ));
            }
        }

        let mut renumbered = Vec::new();
        let mut number = 0;
        for module in self.doc.course.modules.iter_mut() {
            for chapter in module.chapters.iter_mut() {
                number += 1;
                let previous = before
                    .chapters()
                    .find(|c| c.id == chapter.id)
                    .map(|c| c.chapter_number);
                if let Some(previous) = previous {
                    if previous != number {
                        renumbered.push(ChapterRenumber {
                            chapter_id: chapter.id,
                            from: previous,
                            to: number,
                        });
                    }
                }
                chapter.chapter_number = number;
            }
        }

        self.assign_paths(before)?;

        let before_paths: HashMap<Uuid, String> = before
            .pages()
            .map(|(_, p)| (p.id, p.url_path.clone()))
            .collect();
        let mut changed_paths = Vec::new();
        for (_, page) in self.doc.pages() {
            if let Some(old) = before_paths.get(&page.id) {
                if *old != page.url_path {
                    changed_paths.push(Redirect {
                        page_id: page.id,
                        from: old.clone(),
                        to: page.url_path.clone(),
                    });
                }
            }
        }
        let redirects = if self.ctx.creates_redirects {
            changed_paths.clone()
        } else {
            Vec::new()
        };

        let before_chapters: HashMap<Uuid, Option<Uuid>> = before
            .pages()
            .map(|(c, p)| (p.id, c.map(|c| c.id)))
            .collect();
        let moved_pages = self
            .doc
            .pages()
            .filter_map(|(chapter, page)| {
                let previous = before_chapters.get(&page.id)?;
                let current = chapter.map(|c| c.id);
                (*previous != current).then_some(PageChapterMove {
                    page_id: page.id,
                    from_chapter: *previous,
                    to_chapter: current,
                })
            })
            .collect();

        for new_page in self.new_pages.iter_mut() {
            new_page.page_type = self
                .doc
                .page_type(new_page.page_id)
                .unwrap_or(PageType::CoursePage);
        }
        let new_pages: Vec<PageDocument> = self
            .new_pages
            .into_iter()
            .filter(|p| self.doc.page(p.page_id).is_some())
            .collect();
        for new_page in &new_pages {
            if new_page.page_type.is_outside_chapters() {
                let disallowed: Vec<&str> = new_page
                    .blocks
                    .iter()
                    .map(|b| b.name.as_str())
                    .filter(|n| super::blocks::DISALLOWED_ON_TOP_LEVEL_PAGES.contains(n))
                    .collect();
                if !disallowed.is_empty() {
                    return Err(EditError::new(
                        EditErrorCode::InvariantViolated,
                        format!(
                            "pages outside chapters can't hold {}",
                            disallowed.join(", ")
                        ),
                    ));
                }
            }
        }

        Ok(StructureResult {
            new_modules: self
                .new_modules
                .into_iter()
                .filter(|id| self.doc.course.modules.iter().any(|m| m.id == *id))
                .collect(),
            page_copies: self
                .page_copies
                .into_iter()
                .filter(|c| self.doc.page(c.new_page_id).is_some())
                .collect(),
            structure: self.doc,
            created: self.created,
            labels: self.labels.into_map(),
            warnings: self.warnings,
            redirects,
            changed_paths,
            renumbered_chapters: renumbered,
            new_pages,
            moved_pages,
        })
    }

    /// Gives every page its final path: chapter front pages `/chapter-N`, other chapter pages
    /// `/chapter-N/<segment>`, top-level pages their own path; derived paths get a suffix on
    /// collision, explicit duplicates are errors.
    fn assign_paths(&mut self, before: &CourseStructure) -> Result<(), EditError> {
        let before_paths: HashMap<Uuid, String> = before
            .pages()
            .map(|(_, p)| (p.id, p.url_path.clone()))
            .collect();
        let mut planned: Vec<(Uuid, String, bool)> = Vec::new();
        for page in &self.doc.course.pages {
            if page.url_path == "/" && Some(page.id) == self.original_front_page {
                planned.push((page.id, "/".to_string(), true));
                continue;
            }
            let (path, explicit) = match self.explicit_paths.get(&page.id) {
                Some(raw) => (normalize_top_level_path(raw)?, true),
                None => {
                    let segment = before_paths
                        .get(&page.id)
                        .and_then(|old| last_segment(old))
                        .unwrap_or_else(|| slugify(&page.title));
                    let path = match before_paths.get(&page.id) {
                        Some(old) if !old.starts_with("/chapter-") && !old.is_empty() => {
                            old.clone()
                        }
                        _ => format!("/{segment}"),
                    };
                    (path, false)
                }
            };
            planned.push((page.id, path, explicit));
        }
        for chapter in self.doc.chapters() {
            let prefix = format!("/chapter-{}", chapter.chapter_number);
            for (index, page) in chapter.pages.iter().enumerate() {
                if index == 0 {
                    if let Some(raw) = self.explicit_paths.get(&page.id) {
                        let accepted = raw.trim_end_matches('/') == prefix || raw.trim().is_empty();
                        if !accepted && !self.page_copies.iter().any(|c| c.new_page_id == page.id) {
                            return Err(EditError::new(
                                EditErrorCode::InvalidUrlPath,
                                format!(
                                    "page {} is the first page of chapter {}, so its path is always {prefix}",
                                    page.id, chapter.chapter_number
                                ),
                            ));
                        }
                    }
                    planned.push((page.id, prefix.clone(), true));
                    continue;
                }
                let (segment, explicit) = match self.explicit_paths.get(&page.id) {
                    Some(raw) => (chapter_page_segment(raw, &prefix)?, true),
                    None => {
                        let segment = before_paths
                            .get(&page.id)
                            .filter(|old| !is_chapter_front_path(old))
                            .and_then(|old| last_segment(old))
                            .unwrap_or_else(|| slugify(&page.title));
                        (segment, false)
                    }
                };
                planned.push((page.id, format!("{prefix}/{segment}"), explicit));
            }
        }

        let mut taken: HashMap<String, Uuid> = HashMap::new();
        // Paths that stay as they were count as taken too, so an explicit path never silently
        // renames another page.
        for (id, path, explicit) in &planned {
            let is_kept = before_paths.get(id).is_some_and(|old| old == path);
            if *explicit || is_kept {
                if let Some(other) = taken.insert(path.clone(), *id) {
                    return Err(EditError::new(
                        EditErrorCode::DuplicatePath,
                        format!("pages {other} and {id} would both have the path {path}"),
                    )
                    .with_fix("give one of them another url_path"));
                }
            }
        }
        let mut final_paths: HashMap<Uuid, String> = HashMap::new();
        for (id, path, explicit) in planned {
            if explicit || taken.get(&path) == Some(&id) {
                final_paths.insert(id, path);
                continue;
            }
            let mut candidate = path.clone();
            let mut suffix = 2;
            while taken.get(&candidate).is_some_and(|holder| *holder != id) {
                candidate = format!("{path}-{suffix}");
                suffix += 1;
            }
            if candidate != path && before_paths.get(&id).is_none_or(|old| *old != candidate) {
                self.warnings.push(Warning {
                    code: WarningCode::UrlPathAdjusted,
                    message: format!("page {id} got the path {candidate} because {path} was taken"),
                    op: None,
                });
            }
            taken.insert(candidate.clone(), id);
            final_paths.insert(id, candidate);
        }
        let course = &mut self.doc.course;
        for page in course.pages.iter_mut().chain(
            course
                .modules
                .iter_mut()
                .flat_map(|m| m.chapters.iter_mut())
                .flat_map(|c| c.pages.iter_mut()),
        ) {
            if let Some(path) = final_paths.remove(&page.id) {
                page.url_path = path;
            }
        }
        Ok(())
    }
}

fn entity_ids(entity: &Entity) -> Vec<Uuid> {
    match entity {
        Entity::Module(m) => std::iter::once(m.id)
            .chain(
                m.chapters
                    .iter()
                    .flat_map(|c| std::iter::once(c.id).chain(c.pages.iter().map(|p| p.id))),
            )
            .collect(),
        Entity::Chapter(c) => std::iter::once(c.id)
            .chain(c.pages.iter().map(|p| p.id))
            .collect(),
        Entity::Page(p) => vec![p.id],
    }
}

fn check_field(kind: Kind, field: &str) -> Result<(), EditError> {
    let allowed: &[&str] = match kind {
        Kind::Module => &MODULE_FIELDS,
        Kind::Chapter => &CHAPTER_FIELDS,
        Kind::Page => &PAGE_FIELDS,
    };
    if allowed.contains(&field) {
        return Ok(());
    }
    if DERIVED_FIELDS.contains(&field) {
        let fix = match field {
            "chapter_number" | "order_number" => {
                "change the order with move or reorder; numbers follow the order"
            }
            "course_module_id" => "move the chapter into another module's chapters list",
            "chapter_id" => "move the page into another chapter's pages list",
            "front_page_id" => {
                "move a page to the start of the chapter's pages to make it the front page"
            }
            _ => "ids and derived values are set by the server",
        };
        return Err(EditError::new(
            EditErrorCode::DerivedField,
            format!("{field} is derived and can't be set"),
        )
        .with_fix(fix));
    }
    if COUNT_FIELDS.contains(&field) {
        return Err(EditError::new(
            EditErrorCode::ReadOnlyField,
            format!("{field} is computed from the page's content"),
        ));
    }
    if kind == Kind::Module && MODULE_SETTINGS_FIELDS.contains(&field) {
        return Err(EditError::new(
            EditErrorCode::WrongTool,
            format!("module {field} is a setting; change it with patch_course_settings"),
        ));
    }
    if matches!(field, "content" | "blocks") && kind == Kind::Page {
        return Err(EditError::new(
            EditErrorCode::WrongTool,
            "page content is edited with patch_page_content",
        ));
    }
    Err(unknown_field(kind, field))
}

fn unknown_field(kind: Kind, field: &str) -> EditError {
    let allowed: &[&str] = match kind {
        Kind::Module => &MODULE_FIELDS,
        Kind::Chapter => &CHAPTER_FIELDS,
        Kind::Page => &PAGE_FIELDS,
    };
    EditError::new(
        EditErrorCode::UnknownField,
        format!("a {} has no editable field \"{field}\"", kind.noun()),
    )
    .with_fix(format!("{} fields: {}", kind.noun(), allowed.join(", ")))
}

fn wrong_list(noun: &str, list: ListRef) -> EditError {
    EditError::new(
        EditErrorCode::InvalidPath,
        format!("a {noun} can't go into {}", list.path()),
    )
    .with_fix(match noun {
        "page" => "pages go into /<chapter id>/pages or /course/pages",
        "chapter" => "chapters go into /<module id>/chapters",
        _ => "modules go into /course/modules",
    })
}

fn required_string(
    object: &Map<String, Value>,
    field: &str,
    message: &str,
) -> Result<String, EditError> {
    match object.get(field) {
        Some(Value::String(s)) if !s.trim().is_empty() => Ok(s.clone()),
        _ => Err(EditError::new(EditErrorCode::MissingField, message)),
    }
}

fn optional_color(value: Option<&Value>) -> Result<Option<String>, EditError> {
    match value {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(color)) if is_hex_color(color) => Ok(Some(color.to_uppercase())),
        Some(_) => Err(EditError::new(
            EditErrorCode::InvalidValue,
            "color is a hex colour like \"#1F6964\", or null",
        )),
    }
}

fn is_hex_color(color: &str) -> bool {
    color.len() == 7 && color.starts_with('#') && color[1..].chars().all(|c| c.is_ascii_hexdigit())
}

fn optional_date(value: Option<&Value>, field: &str) -> Result<Option<DateTime<Utc>>, EditError> {
    match value {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(raw)) => DateTime::parse_from_rfc3339(raw)
            .map(|d| Some(d.with_timezone(&Utc)))
            .map_err(|_| {
                EditError::new(
                    EditErrorCode::InvalidValue,
                    format!("{field} is an RFC 3339 time like \"2027-02-01T08:00:00Z\", or null"),
                )
            }),
        Some(_) => Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!("{field} is a time string or null"),
        )),
    }
}

fn missing(field: &str) -> EditError {
    EditError::new(
        EditErrorCode::MissingField,
        format!("this op needs \"{field}\""),
    )
}

fn is_chapter_segment(segment: &str) -> bool {
    segment
        .strip_prefix("chapter-")
        .is_some_and(|n| n.parse::<u32>().is_ok())
}

fn is_chapter_front_path(path: &str) -> bool {
    path.strip_prefix('/').is_some_and(is_chapter_segment)
}

fn last_segment(path: &str) -> Option<String> {
    path.rsplit('/')
        .next()
        .filter(|s| !s.is_empty() && !is_chapter_segment(s))
        .map(str::to_string)
}

fn normalize_segment(raw: &str) -> Result<String, EditError> {
    let segment = raw.trim().to_lowercase().replace(' ', "-");
    if segment.is_empty()
        || !segment
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(EditError::new(
            EditErrorCode::InvalidUrlPath,
            format!(
                "\"{raw}\" isn't a valid path segment; use lowercase letters, digits and dashes"
            ),
        )
        .with_fix(slugify(raw)));
    }
    Ok(segment)
}

fn normalize_top_level_path(raw: &str) -> Result<String, EditError> {
    let trimmed = raw.trim().trim_end_matches('/');
    let Some(rest) = trimmed.strip_prefix('/') else {
        return Err(EditError::new(
            EditErrorCode::InvalidUrlPath,
            format!("\"{raw}\" must start with /"),
        )
        .with_fix(format!("/{}", raw.trim())));
    };
    if rest.split('/').next().is_some_and(is_chapter_segment) {
        return Err(EditError::new(
            EditErrorCode::InvalidUrlPath,
            "paths starting with /chapter-N belong to chapter pages",
        ));
    }
    let segments = rest
        .split('/')
        .map(normalize_segment)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(format!("/{}", segments.join("/")))
}

/// A chapter page's explicit path: its last segment alone, or the whole path under some `/chapter-N`.
fn chapter_page_segment(raw: &str, prefix: &str) -> Result<String, EditError> {
    let trimmed = raw.trim().trim_end_matches('/');
    let candidate = match trimmed.strip_prefix('/') {
        None => trimmed,
        Some(rest) => match rest.split_once('/') {
            Some((first, last)) if is_chapter_segment(first) && !last.contains('/') => last,
            _ => {
                return Err(EditError::new(
                    EditErrorCode::InvalidUrlPath,
                    format!("chapter pages live under {prefix}/; \"{raw}\" doesn't fit"),
                )
                .with_fix(format!(
                    "give only the last part, e.g. \"{}\", which becomes {prefix}/{}",
                    slugify(trimmed),
                    slugify(trimmed)
                )));
            }
        },
    };
    normalize_segment(candidate)
}

#[cfg(test)]
#[path = "course_structure_tests.rs"]
mod tests;
