//! The editor that applies structure ops one by one to a copy of the course tree.

use std::collections::{BTreeMap, HashMap, HashSet};

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use super::fields::{
    COUNT_FIELDS, DERIVED_FIELDS, check_field, field_error, not_nullable, optional_color,
    optional_date, required_text, unknown_field,
};
use super::model::{
    CourseStructure, Entity, EntityRef, Kind, ListRef, Loc, RENDERED_KEYS, StructureChapter,
    StructureModule, StructurePage, entity_ids, parse_structure_path,
};
use super::paths::{PathRequests, assign_paths, path_changes};
use super::{ChapterRenumber, PageCopy, StructureResult};
use crate::engine::blocks::content_counts;
use crate::engine::error::{EditError, EditErrorCode, Warning, WarningCode};
use crate::engine::labels::{Labels, label_field};
use crate::engine::op::{Op, PatchTarget, Position, Transfer};
use crate::engine::page_content;
use crate::engine::{CreatedIdLog, PageDocument, PageType, non_empty_string, value_items};
use crate::ids::IdGenerator;

#[derive(Debug, Clone)]
enum Address {
    Course,
    List(ListRef),
    Entity(Uuid),
    Field(Uuid, String),
}

type Anchor = crate::engine::Anchor<ListRef>;

pub(super) struct StructureEditor<'c> {
    doc: CourseStructure,
    labels: Labels,
    removed: HashMap<Uuid, usize>,
    pub(super) ids: CreatedIdLog<'c>,
    pub(super) warnings: Vec<Warning>,
    paths: PathRequests,
    new_pages: HashMap<Uuid, Vec<GutenbergBlock>>,
    page_copies: Vec<PageCopy>,
    page_pairings: BTreeMap<Uuid, Uuid>,
    /// The course front page, `/`, which stays first in /course/pages with its path.
    front_page: Option<Uuid>,
    course_is_live: bool,
}

impl<'c> StructureEditor<'c> {
    pub(super) fn new(
        doc: &CourseStructure,
        ops: &[Op],
        course_is_live: bool,
        ids: &'c dyn IdGenerator,
    ) -> Self {
        Self {
            front_page: doc.pages.iter().find(|p| p.url_path == "/").map(|p| p.id),
            doc: doc.clone(),
            labels: Labels::prescan(ops),
            removed: HashMap::new(),
            ids: CreatedIdLog::new(ids),
            warnings: Vec::new(),
            paths: PathRequests::default(),
            new_pages: HashMap::new(),
            page_copies: Vec::new(),
            page_pairings: BTreeMap::new(),
            course_is_live,
        }
    }

    pub(super) fn apply_op(&mut self, op: &Op) -> Result<(), EditError> {
        match op {
            Op::Add {
                path,
                value,
                position,
            } => self.add(path, value, *position),
            Op::Remove { path, through } => self.remove(path, through.as_deref()),
            Op::Replace { path, value } => self.replace(path, value),
            Op::Move(transfer) => self.move_entities(transfer),
            Op::Copy { transfer, label } => self.copy(transfer, label.as_deref()),
            Op::Reorder { path, value } => self.reorder(path, value),
            _ => Err(PatchTarget::CourseStructure.rejected_op(op.kind())),
        }
    }

    fn require(&self, id: Uuid) -> Result<Loc, EditError> {
        self.doc.locate(id).ok_or_else(|| self.not_found(id))
    }

    fn not_found(&self, id: Uuid) -> EditError {
        match self.removed.get(&id) {
            Some(op) => EditError::new(
                EditErrorCode::NotFound,
                format!("{id} was removed by op {op} of this call"),
            ),
            None => EditError::new(
                EditErrorCode::NotFound,
                format!("no module, chapter or page {id} in this course"),
            )
            .with_fix("get_course_structure lists the current ids"),
        }
    }

    fn address(&self, path: &str) -> Result<Address, EditError> {
        let parsed = parse_structure_path(path).ok_or_else(|| {
            EditError::new(
                EditErrorCode::InvalidPath,
                format!(
                    "path \"{path}\" must start with /, e.g. /course/modules, /<chapter id>/pages or /<page id>/title"
                ),
            )
        })?;
        if parsed.is_course(self.doc.id) {
            let Some(child) = parsed.child.as_deref() else {
                return Ok(Address::Course);
            };
            return match ListRef::of_course(child) {
                Some(list) if !parsed.is_deeper => Ok(Address::List(list)),
                Some(_) => Err(EditError::numeric_index(path, "modules and pages").with_fix("use /<id>, or the list with a position, e.g. {\"path\":\"/course/pages\",\"position\":\"end\"}")),
                None => Err(EditError::new(
                    EditErrorCode::WrongTool,
                    format!("course field \"{child}\" is edited with patch_course_settings"),
                )),
            };
        }
        let id = self
            .labels
            .resolve_segment(&parsed.root, path, self.ids.op())?;
        let kind = self.require(id)?.kind();
        let Some(child) = parsed.child.as_deref() else {
            return Ok(Address::Entity(id));
        };
        match (ListRef::of_entity(kind, id, child), parsed.is_deeper) {
            (Some(_), true) => Err(EditError::numeric_index(path, "chapters and pages")),
            (Some(list), false) => Ok(Address::List(list)),
            (None, false) => {
                check_field(kind, child)?;
                Ok(Address::Field(id, child.to_string()))
            }
            (None, true) => Err(EditError::new(
                EditErrorCode::InvalidPath,
                format!("\"{path}\" goes deeper than a {} field", kind.noun()),
            )),
        }
    }

    fn list_ids(&self, list: ListRef) -> Vec<Uuid> {
        self.doc.list(list).into_iter().map(EntityRef::id).collect()
    }

    fn take(&mut self, list: ListRef, start: usize, end: usize) -> Vec<Entity> {
        let range = start..=end;
        match list {
            ListRef::CoursePages => self.doc.pages.drain(range).map(Entity::Page).collect(),
            ListRef::CourseModules => self.doc.modules.drain(range).map(Entity::Module).collect(),
            ListRef::ModuleChapters(id) => self
                .doc
                .module_mut(id)
                .map(|m| m.chapters.drain(range).map(Entity::Chapter).collect())
                .unwrap_or_default(),
            ListRef::ChapterPages(id) => self
                .doc
                .chapter_mut(id)
                .map(|c| c.pages.drain(range).map(Entity::Page).collect())
                .unwrap_or_default(),
        }
    }

    fn put(&mut self, list: ListRef, index: usize, entities: Vec<Entity>) -> Result<(), EditError> {
        for (offset, entity) in entities.into_iter().enumerate() {
            let at = index + offset;
            match (list, entity) {
                (ListRef::CoursePages, Entity::Page(page)) => self.doc.pages.insert(at, page),
                (ListRef::CourseModules, Entity::Module(module)) => {
                    self.doc.modules.insert(at, module)
                }
                (ListRef::ModuleChapters(id), Entity::Chapter(chapter)) => {
                    if let Some(module) = self.doc.module_mut(id) {
                        module.chapters.insert(at, chapter);
                    }
                }
                (ListRef::ChapterPages(id), Entity::Page(page)) => {
                    if let Some(chapter) = self.doc.chapter_mut(id) {
                        chapter.pages.insert(at, page);
                    }
                }
                (list, entity) => return Err(wrong_list(entity.kind(), list)),
            }
        }
        Ok(())
    }

    fn anchor(&self, address: &Address, position: Option<Position>) -> Result<Anchor, EditError> {
        let Some(position) = position else {
            return Err(EditError::position_required(
                "position is before/after a sibling (\"path\":\"/<id>\") or start/end of a list (\"path\":\"/<chapter id>/pages\")",
            ));
        };
        match (address, position) {
            (Address::List(list), Position::Start) => Ok(Anchor::Start(*list)),
            (Address::List(list), Position::End) => Ok(Anchor::End(*list)),
            (Address::Entity(id), Position::Before) => Ok(Anchor::Before(*id)),
            (Address::Entity(id), Position::After) => Ok(Anchor::After(*id)),
            (Address::Entity(id), Position::Start | Position::End) => {
                let loc = self.require(*id)?;
                let fix = match loc.kind() {
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
    fn resolve_anchor(&self, anchor: Anchor, kind: Kind) -> Result<(ListRef, usize), EditError> {
        let (list, index) = anchor.insertion_point(
            |id| self.require(id).map(|loc| (loc.list, loc.index)),
            |list| Ok((list, self.doc.list(list).len())),
        )?;
        if list.kind() != kind {
            return Err(wrong_list(kind, list));
        }
        if index == 0
            && let Some((code, pinned)) = self.pinned_first(list)
        {
            return Err(
                pinned_error(code, &format!("stays first in {}", list.path()))
                    .with_fix(format!("{{\"path\":\"/{pinned}\",\"position\":\"after\"}}")),
            );
        }
        Ok((list, index))
    }

    /// What `list` keeps first, with the error code for disturbing it: the course front page in
    /// /course/pages and the default module in /course/modules.
    fn pinned_first(&self, list: ListRef) -> Option<(EditErrorCode, Uuid)> {
        match list {
            ListRef::CoursePages => self
                .front_page
                .map(|id| (EditErrorCode::PinnedFrontPage, id)),
            ListRef::CourseModules => self
                .doc
                .modules
                .first()
                .map(|m| (EditErrorCode::DefaultModule, m.id)),
            ListRef::ModuleChapters(_) | ListRef::ChapterPages(_) => None,
        }
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
            return Err(EditError::reversed_range(
                from,
                last,
                self.sibling_paths(start.list),
            ));
        }
        Ok((start, end.index))
    }

    fn sibling_paths(&self, list: ListRef) -> Vec<String> {
        self.list_ids(list)
            .into_iter()
            .map(|id| format!("/{id}"))
            .collect()
    }

    fn check_not_pinned(&self, list: ListRef, start: usize, action: &str) -> Result<(), EditError> {
        match self.pinned_first(list) {
            Some((code, _)) if start == 0 => Err(pinned_error(code, &format!("can't be {action}"))),
            _ => Ok(()),
        }
    }

    fn new_entities(&mut self, kind: Kind, value: &Value) -> Result<Vec<Entity>, EditError> {
        value_items(value, &format!("a {}", kind.noun()))?
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
        let contents: &[&str] = match kind {
            Kind::Module => &[],
            Kind::Chapter => &["pages"],
            Kind::Page => &["blocks", "pair_with"],
        };
        if let Some(key) = object.keys().find(|key| {
            key.as_str() != "label"
                && !kind.editable_fields().contains(&key.as_str())
                && !contents.contains(&key.as_str())
        }) {
            return Err(field_error(kind, key));
        }
        let label = label_field(object, "$ch")?;
        let entity = match kind {
            Kind::Page => Entity::Page(self.new_page(object)?),
            Kind::Module => Entity::Module(StructureModule {
                id: self.ids.new_id(),
                default: false,
                name: Some(non_empty_string(object.get("name"), "a new module's name")?),
                chapters: Vec::new(),
            }),
            Kind::Chapter => {
                let id = self.ids.new_id();
                let name = non_empty_string(object.get("name"), "a new chapter's name")?;
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
                Entity::Chapter(chapter)
            }
        };
        if let Some(label) = &label {
            self.labels.define(label, entity.id())?;
        }
        Ok(entity)
    }

    fn new_page(&mut self, object: &Map<String, Value>) -> Result<StructurePage, EditError> {
        let id = self.ids.new_id();
        let title = non_empty_string(object.get("title"), "a new page's title")?;
        if let Some(url_path) = object.get("url_path") {
            let url_path = url_path.as_str().ok_or_else(|| {
                EditError::new(EditErrorCode::InvalidValue, "url_path is a string")
            })?;
            self.paths.set_explicit(id, url_path.to_string());
        }
        let blocks_value = object.get("blocks").filter(|v| !v.is_null());
        let has_content = blocks_value
            .and_then(Value::as_array)
            .is_some_and(|blocks| !blocks.is_empty());
        let hidden = match object.get("hidden") {
            Some(Value::Bool(hidden)) => *hidden,
            Some(_) => {
                return Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    "hidden is true or false",
                ));
            }
            None if self.course_is_live && !has_content => {
                self.warnings.push(Warning::new(
                    WarningCode::NewPageHidden,
                    format!("page {id} has no content yet, so it starts hidden; set hidden to false when it is ready"),
                ));
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
        if let Some(source) = object.get("pair_with") {
            let source = source
                .as_str()
                .and_then(|source| Uuid::parse_str(source.trim_start_matches('/')).ok())
                .ok_or_else(|| {
                    EditError::new(
                        EditErrorCode::InvalidValue,
                        "pair_with is the id of the page in another language version of the course that this page translates",
                    )
                })?;
            self.page_pairings.insert(id, source);
        }
        let (block_count, exercise_count) = content_counts(&blocks);
        self.new_pages.insert(id, blocks);
        Ok(StructurePage {
            id,
            title,
            url_path: String::new(),
            hidden,
            block_count,
            exercise_count,
            has_submissions: false,
            page_language_group_id: None,
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
        let add = Op::Add {
            path: String::new(),
            value: value.clone(),
            position: Some(Position::End),
        };
        let result = page_content::apply(
            empty,
            &|_| None,
            std::slice::from_ref(&add),
            self.ids.generator(),
        )
        .map_err(|mut e| {
            e.message = format!("in the blocks of new page {page_id}: {}", e.message);
            e.op = None;
            e
        })?;
        for id in result.created.into_iter().flat_map(|created| created.ids) {
            self.ids.record(id);
        }
        for (label, id) in &result.labels {
            self.labels.define(label, *id)?;
        }
        self.warnings.extend(result.warnings);
        Ok(result.page.blocks)
    }

    fn add(
        &mut self,
        path: &str,
        value: &Value,
        position: Option<Position>,
    ) -> Result<(), EditError> {
        let address = self.address(path)?;
        let anchor = self.anchor(&address, position)?;
        let kind = match anchor {
            Anchor::Start(list) | Anchor::End(list) => list.kind(),
            Anchor::Before(id) | Anchor::After(id) => self.require(id)?.kind(),
        };
        let (list, index) = self.resolve_anchor(anchor, kind)?;
        let entities = self.new_entities(kind, value)?;
        self.put(list, index, entities)?;
        Ok(())
    }

    /// The entity `path` names; any other address fails with `message`.
    fn entity_at(&self, path: &str, message: &str) -> Result<Uuid, EditError> {
        match self.address(path)? {
            Address::Entity(id) => Ok(id),
            _ => Err(EditError::new(EditErrorCode::InvalidPath, message)),
        }
    }

    fn remove(&mut self, path: &str, through: Option<&str>) -> Result<(), EditError> {
        match self.address(path)? {
            Address::Entity(id) => {
                let through = self
                    .labels
                    .resolve_optional_item_ref(through, self.ids.op())?;
                let (start, end) = self.range(id, through)?;
                self.check_not_pinned(start.list, start.index, "removed")?;
                if start.kind() == Kind::Module {
                    let not_empty: Vec<String> = self.doc.modules[start.index..=end]
                        .iter()
                        .filter(|module| !module.chapters.is_empty())
                        .map(|module| {
                            let chapters: Vec<String> = module
                                .chapters
                                .iter()
                                .map(|c| format!("/{} ({})", c.id, c.name))
                                .collect();
                            format!("module {} has {}", module.id, chapters.join(", "))
                        })
                        .collect();
                    if !not_empty.is_empty() {
                        return Err(EditError::new(
                            EditErrorCode::ModuleNotEmpty,
                            format!("modules still have chapters: {}", not_empty.join("; ")),
                        )
                        .with_fix(
                            "move or remove their chapters first, in the same call if you like",
                        ));
                    }
                }
                let removed = self.take(start.list, start.index, end);
                for entity in &removed {
                    for id in entity_ids(entity) {
                        self.removed.insert(id, self.ids.op());
                    }
                }
                Ok(())
            }
            Address::Field(id, field) => self.set_field(id, &field, Value::Null),
            Address::Course | Address::List(_) => Err(EditError::new(
                EditErrorCode::InvalidPath,
                "remove takes a module, chapter or page (or a range of them), not a list",
            )),
        }
    }

    fn replace(&mut self, path: &str, value: &Value) -> Result<(), EditError> {
        match self.address(path)? {
            Address::Field(id, field) => self.set_field(id, &field, value.clone()),
            Address::Entity(id) => {
                let Value::Object(fields) = value else {
                    return Err(EditError::new(
                        EditErrorCode::InvalidValue,
                        "replace on an entity takes an object of the fields to set",
                    ));
                };
                let kind = self.require(id)?.kind();
                for (field, value) in fields {
                    if RENDERED_KEYS.contains(&field.as_str()) {
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
                            && self.field_value(id, kind, field).as_ref() == Some(value))
                    {
                        continue;
                    }
                    check_field(kind, field)?;
                    self.set_field(id, field, value.clone())?;
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
            (_, "id") => Some(json!(id)),
            (Kind::Chapter, "chapter_number") => {
                self.doc.chapter(id).map(|c| json!(c.chapter_number))
            }
            (Kind::Module, "default") => self.doc.module(id).map(|m| json!(m.default)),
            _ => None,
        }
    }

    /// Sets one editable field; `Value::Null` clears it. `field` passed [`check_field`].
    fn set_field(&mut self, id: Uuid, field: &str, value: Value) -> Result<(), EditError> {
        let loc = self.require(id)?;
        match loc.kind() {
            Kind::Module => {
                let Some(module) = self.doc.modules.get_mut(loc.index) else {
                    return Err(self.not_found(id));
                };
                if module.default {
                    return Err(EditError::new(
                        EditErrorCode::DefaultModule,
                        "the default module has no name and can't be renamed",
                    ));
                }
                module.name = Some(required_text(value, "name", "a module name")?);
            }
            Kind::Chapter => {
                let Some(chapter) = self.doc.chapter_mut(id) else {
                    return Err(self.not_found(id));
                };
                match field {
                    "name" => chapter.name = required_text(value, "name", "a chapter name")?,
                    "color" => chapter.color = optional_color(Some(&value))?,
                    "opens_at" => chapter.opens_at = optional_date(Some(&value), "opens_at")?,
                    "deadline" => chapter.deadline = optional_date(Some(&value), "deadline")?,
                    _ => return Err(unknown_field(Kind::Chapter, field)),
                }
            }
            Kind::Page => {
                let Some(page) = self.doc.page_mut(id) else {
                    return Err(self.not_found(id));
                };
                match (field, value) {
                    ("title", value) => page.title = required_text(value, "title", "a title")?,
                    ("hidden", Value::Bool(hidden)) => page.hidden = hidden,
                    ("url_path", Value::String(path)) => {
                        if page.url_path == "/" {
                            return Err(EditError::new(
                                EditErrorCode::PinnedFrontPage,
                                "the course front page's path is always /",
                            ));
                        }
                        self.paths.set_explicit(id, path);
                    }
                    (field, Value::Null) => return Err(not_nullable(field)),
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

    fn move_entities(&mut self, transfer: &Transfer) -> Result<(), EditError> {
        let from = self.entity_at(
            &transfer.from,
            &format!(
                "from must name a module, chapter or page; got \"{}\"",
                transfer.from
            ),
        )?;
        let through = self
            .labels
            .resolve_optional_item_ref(transfer.through.as_deref(), self.ids.op())?;
        let (start, end) = self.range(from, through)?;
        self.check_not_pinned(start.list, start.index, "moved")?;
        let address = self.address(&transfer.path)?;
        let anchor = self.anchor(&address, Some(transfer.position))?;

        let moved_ids: HashSet<Uuid> = self.list_ids(start.list)[start.index..=end]
            .iter()
            .copied()
            .collect();
        if let Some(anchor_id) = anchor.target_id(ListRef::owner)
            && moved_ids.contains(&anchor_id)
        {
            return Err(EditError::new(
                EditErrorCode::MoveIntoItself,
                format!("{anchor_id} is part of what is being moved"),
            )
            .with_fix("choose a target outside the moved range"));
        }
        let entities = self.take(start.list, start.index, end);
        let (list, index) = self.resolve_anchor(anchor, start.kind())?;
        self.put(list, index, entities)?;
        Ok(())
    }

    fn copy(&mut self, transfer: &Transfer, label: Option<&str>) -> Result<(), EditError> {
        let from = self.entity_at(&transfer.from, "from must name a chapter or a page")?;
        let loc = self.require(from)?;
        let address = self.address(&transfer.path)?;
        let anchor = self.anchor(&address, Some(transfer.position))?;
        let (list, index) = self.resolve_anchor(anchor, loc.kind())?;
        let copy = match loc.kind() {
            Kind::Module => {
                return Err(EditError::new(
                    EditErrorCode::InvalidOp,
                    "modules can't be copied; copy their chapters into a new module",
                ));
            }
            Kind::Page => {
                let Some(source) = self.doc.page(from).cloned() else {
                    return Err(self.not_found(from));
                };
                Entity::Page(self.copy_page(&source))
            }
            Kind::Chapter => {
                let Some(source) = self.doc.chapter(from).cloned() else {
                    return Err(self.not_found(from));
                };
                let id = self.ids.new_id();
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
        if let Some(label) = label {
            self.labels.define(label, copy.id())?;
        }
        self.put(list, index, vec![copy])?;
        Ok(())
    }

    fn copy_page(&mut self, source: &StructurePage) -> StructurePage {
        let id = self.ids.new_id();
        self.page_copies.push(PageCopy {
            source_page_id: source.id,
            new_page_id: id,
        });
        self.paths.add_copy(id, source);
        StructurePage {
            id,
            title: format!("{}-copy", source.title),
            url_path: String::new(),
            hidden: source.hidden,
            block_count: source.block_count,
            exercise_count: source.exercise_count,
            has_submissions: false,
            page_language_group_id: None,
        }
    }

    fn reorder(&mut self, path: &str, value: &Value) -> Result<(), EditError> {
        let list = match self.address(path)? {
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
        let Value::Array(values) = value else {
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
            order.push(self.labels.resolve_item_ref(raw, self.ids.op())?);
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
        if let Some((code, pinned)) = self.pinned_first(list)
            && order.first() != Some(&pinned)
        {
            return Err(pinned_error(
                code,
                &format!("stays first in {}", list.path()),
            ));
        }
        if current.is_empty() {
            return Ok(());
        }
        let mut by_id: HashMap<Uuid, Entity> = self
            .take(list, 0, current.len() - 1)
            .into_iter()
            .map(|e| (e.id(), e))
            .collect();
        let reordered: Vec<Entity> = order.iter().filter_map(|id| by_id.remove(id)).collect();
        self.put(list, 0, reordered)?;
        Ok(())
    }

    pub(super) fn finish(mut self, before: &CourseStructure) -> Result<StructureResult, EditError> {
        self.check_final_invariants()?;
        let renumbered_chapters = self.renumber_chapters(before);
        let before_paths: HashMap<Uuid, String> = before
            .pages()
            .map(|(_, p)| (p.id, p.url_path.clone()))
            .collect();
        let path_warnings =
            assign_paths(&mut self.doc, &self.paths, &before_paths, self.front_page)?;
        self.warnings.extend(path_warnings);
        let changed_paths = path_changes(&self.doc, &before_paths);
        self.new_pages
            .retain(|page_id, _| self.doc.page(*page_id).is_some());
        self.page_pairings
            .retain(|page_id, _| self.doc.page(*page_id).is_some());
        Ok(StructureResult {
            new_pages: self.new_pages,
            page_pairings: self.page_pairings,
            page_copies: self
                .page_copies
                .into_iter()
                .filter(|c| self.doc.page(c.new_page_id).is_some())
                .collect(),
            structure: self.doc,
            created: self.ids.into_created(),
            labels: self.labels.into_map(),
            warnings: self.warnings,
            changed_paths,
            renumbered_chapters,
        })
    }

    /// What every op keeps, checked once more on the result: the pinned first items, module
    /// names and chapter front pages.
    fn check_final_invariants(&self) -> Result<(), EditError> {
        let modules = &self.doc.modules;
        if !modules.first().is_some_and(|first| first.default) {
            return Err(pinned_error(
                EditErrorCode::DefaultModule,
                "must stay first",
            ));
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
        if let Some(front) = self.front_page
            && self.doc.pages.first().map(|p| p.id) != Some(front)
        {
            return Err(pinned_error(
                EditErrorCode::PinnedFrontPage,
                "must stay first in /course/pages",
            ));
        }
        Ok(())
    }

    /// Numbers the chapters 1, 2, … in order and lists the ones whose number changed from `before`.
    fn renumber_chapters(&mut self, before: &CourseStructure) -> Vec<ChapterRenumber> {
        let mut renumbered = Vec::new();
        for (number, chapter) in (1..).zip(self.doc.chapters_mut()) {
            let previous = before
                .chapters()
                .find(|c| c.id == chapter.id)
                .map(|c| c.chapter_number);
            if let Some(previous) = previous
                && previous != number
            {
                renumbered.push(ChapterRenumber {
                    chapter_id: chapter.id,
                    from: previous,
                    to: number,
                });
            }
            chapter.chapter_number = number;
        }
        renumbered
    }
}

pub(super) fn wrong_list(kind: Kind, list: ListRef) -> EditError {
    EditError::new(
        EditErrorCode::InvalidPath,
        format!("a {} can't go into {}", kind.noun(), list.path()),
    )
    .with_fix(match kind {
        Kind::Page => "pages go into /<chapter id>/pages or /course/pages",
        Kind::Chapter => "chapters go into /<module id>/chapters",
        Kind::Module => "modules go into /course/modules",
    })
}

/// An op disturbs the item a list keeps first; `problem` says how, e.g. "can't be moved".
pub(super) fn pinned_error(code: EditErrorCode, problem: &str) -> EditError {
    let item = match code {
        EditErrorCode::DefaultModule => "the default module",
        _ => "the course front page (/)",
    };
    EditError::new(code, format!("{item} {problem}"))
}
