//! Read selectors over the course structure tree.

use serde_json::{Map, Value, json};
use uuid::Uuid;

use super::course_structure::{CourseStructure, StructureChapter, StructureModule, StructurePage};
use super::error::{EditError, EditErrorCode};
use super::labels::parse_uuid;
use super::read::{
    HasId, ReadMode, ReadOptions, ReadResult, Selector, check_selector, reject_window, single_unit,
    window,
};

#[derive(Clone, Copy)]
enum EntityRef<'a> {
    Module(&'a StructureModule),
    Chapter(&'a StructureChapter),
    Page(&'a StructurePage),
}

impl HasId for EntityRef<'_> {
    fn id(&self) -> Uuid {
        match self {
            EntityRef::Module(m) => m.id,
            EntityRef::Chapter(c) => c.id,
            EntityRef::Page(p) => p.id,
        }
    }
}

struct Renderer<'a> {
    mode: ReadMode,
    options: &'a ReadOptions,
}

impl Renderer<'_> {
    fn entity(&self, entity: EntityRef) -> Value {
        match entity {
            EntityRef::Module(m) => self.module(m),
            EntityRef::Chapter(c) => self.chapter(c),
            EntityRef::Page(p) => self.page(p),
        }
    }

    fn base(&self, id: Uuid, kind: &str) -> Map<String, Value> {
        let mut object = Map::new();
        object.insert("id".into(), json!(id));
        object.insert("path".into(), json!(format!("/{id}")));
        object.insert("kind".into(), json!(kind));
        if let Some(pending) = self.options.pending.get(&id) {
            object.insert("pending".into(), json!(pending));
        }
        object
    }

    fn module(&self, module: &StructureModule) -> Value {
        let mut object = self.base(module.id, "module");
        object.insert("default".into(), json!(module.default));
        object.insert("name".into(), json!(module.name));
        object.insert(
            "chapters".into(),
            Value::Array(module.chapters.iter().map(|c| self.chapter(c)).collect()),
        );
        Value::Object(object)
    }

    fn chapter(&self, chapter: &StructureChapter) -> Value {
        let mut object = self.base(chapter.id, "chapter");
        object.insert("chapter_number".into(), json!(chapter.chapter_number));
        object.insert("name".into(), json!(chapter.name));
        if self.mode == ReadMode::Raw {
            object.insert("color".into(), json!(chapter.color));
        }
        object.insert("opens_at".into(), json!(chapter.opens_at));
        object.insert("deadline".into(), json!(chapter.deadline));
        object.insert(
            "pages".into(),
            Value::Array(chapter.pages.iter().map(|p| self.page(p)).collect()),
        );
        Value::Object(object)
    }

    fn page(&self, page: &StructurePage) -> Value {
        let mut object = self.base(page.id, "page");
        object.insert("title".into(), json!(page.title));
        object.insert("url_path".into(), json!(page.url_path));
        object.insert("hidden".into(), json!(page.hidden));
        object.insert("block_count".into(), json!(page.block_count));
        object.insert("exercise_count".into(), json!(page.exercise_count));
        if page.has_submissions {
            object.insert("has_submissions".into(), json!(true));
        }
        Value::Object(object)
    }

    fn course(&self, doc: &CourseStructure) -> Value {
        json!({
            "id": doc.course.id,
            "path": "/course",
            "kind": "course",
            "pages": doc.course.pages.iter().map(|p| self.page(p)).collect::<Vec<_>>(),
            "modules": doc.course.modules.iter().map(|m| self.module(m)).collect::<Vec<_>>(),
        })
    }
}

/// Where an entity sits: its siblings and the list path, when it isn't a module.
fn locate(doc: &CourseStructure, id: Uuid) -> Option<(Vec<EntityRef<'_>>, usize, String)> {
    let course_pages: Vec<EntityRef> = doc.course.pages.iter().map(EntityRef::Page).collect();
    if let Some(index) = doc.course.pages.iter().position(|p| p.id == id) {
        return Some((course_pages, index, "/course/pages".into()));
    }
    if let Some(index) = doc.course.modules.iter().position(|m| m.id == id) {
        return Some((
            doc.course.modules.iter().map(EntityRef::Module).collect(),
            index,
            "/course/modules".into(),
        ));
    }
    for module in &doc.course.modules {
        if let Some(index) = module.chapters.iter().position(|c| c.id == id) {
            return Some((
                module.chapters.iter().map(EntityRef::Chapter).collect(),
                index,
                format!("/{}/chapters", module.id),
            ));
        }
        for chapter in &module.chapters {
            if let Some(index) = chapter.pages.iter().position(|p| p.id == id) {
                return Some((
                    chapter.pages.iter().map(EntityRef::Page).collect(),
                    index,
                    format!("/{}/pages", chapter.id),
                ));
            }
        }
    }
    None
}

fn list<'a>(
    doc: &'a CourseStructure,
    owner: &str,
    key: &str,
) -> Result<Vec<EntityRef<'a>>, EditError> {
    if owner == "course" {
        return match key {
            "pages" => Ok(doc.course.pages.iter().map(EntityRef::Page).collect()),
            "modules" => Ok(doc.course.modules.iter().map(EntityRef::Module).collect()),
            _ => Err(EditError::new(
                EditErrorCode::InvalidPath,
                "the course's lists are /course/pages and /course/modules",
            )),
        };
    }
    let id = parse_uuid(owner, owner)?;
    if let (Some(module), "chapters") = (doc.course.modules.iter().find(|m| m.id == id), key) {
        return Ok(module.chapters.iter().map(EntityRef::Chapter).collect());
    }
    if let (Some(chapter), "pages") = (doc.chapters().find(|c| c.id == id), key) {
        return Ok(chapter.pages.iter().map(EntityRef::Page).collect());
    }
    Err(EditError::new(
        EditErrorCode::InvalidPath,
        format!(
            "/{owner}/{key} isn't a list; lists are /<module id>/chapters and /<chapter id>/pages"
        ),
    ))
}

pub fn read_structure(
    doc: &CourseStructure,
    selector: &Selector,
    options: &ReadOptions,
) -> Result<ReadResult, EditError> {
    check_selector(selector)?;
    let mode = selector.mode.unwrap_or_default();
    let renderer = Renderer { mode, options };
    let path = selector.path.as_deref().unwrap_or("");
    if path.is_empty() || path == "/" || path == "/course" {
        reject_window(selector, "the whole course")?;
        return Ok(single_unit(selector, renderer.course(doc), options));
    }
    let rest = path.strip_prefix('/').ok_or_else(|| {
        EditError::new(
            EditErrorCode::InvalidPath,
            format!("path \"{path}\" must start with /"),
        )
    })?;
    let segments: Vec<&str> = rest.split('/').collect();
    let render = |entity: &EntityRef| renderer.entity(*entity);
    match segments.as_slice() {
        [owner, key @ ("pages" | "modules" | "chapters")] => {
            if selector.through.is_some() || selector.around.is_some() {
                return Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    "through and around start from an entity path, not a list",
                ));
            }
            let items = list(doc, owner, key)?;
            let start = selector.offset.unwrap_or(0) as usize;
            let end = selector
                .limit
                .map(|l| start + l as usize)
                .unwrap_or(items.len());
            let parent = format!("/{owner}/{key}");
            Ok(window(
                selector,
                &items,
                start,
                end,
                Some(parent),
                options,
                &render,
            ))
        }
        [raw_id] => {
            let id = parse_uuid(raw_id, path)?;
            let (siblings, index, parent) = locate(doc, id).ok_or_else(|| {
                EditError::new(
                    EditErrorCode::NotFound,
                    format!("no module, chapter or page {id}"),
                )
            })?;
            if selector.offset.is_some() {
                return Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    "offset works on a list path such as /<chapter id>/pages",
                ));
            }
            let (start, end) = if let Some(through) = &selector.through {
                let last = parse_uuid(through.trim_start_matches('/'), through)?;
                let last_index = siblings.iter().position(|e| e.id() == last).filter(|i| *i >= index).ok_or_else(|| {
                    EditError::new(EditErrorCode::InvalidRange, "through must be a later sibling of path")
                        .with_details(json!({"siblings_in_order": siblings.iter().map(|e| format!("/{}", e.id())).collect::<Vec<_>>()}))
                })?;
                (index, last_index + 1)
            } else if let Some(around) = selector.around {
                (
                    index.saturating_sub(around as usize),
                    (index + around as usize + 1).min(siblings.len()),
                )
            } else if let Some(limit) = selector.limit {
                (index, index + limit as usize)
            } else {
                return Ok(single_unit(
                    selector,
                    renderer.entity(siblings[index]),
                    options,
                ));
            };
            Ok(window(
                selector,
                &siblings,
                start,
                end,
                Some(parent),
                options,
                &render,
            ))
        }
        [raw_id, field] => {
            reject_window(selector, "a field")?;
            let id = parse_uuid(raw_id, path)?;
            let (siblings, index, _) = locate(doc, id).ok_or_else(|| {
                EditError::new(
                    EditErrorCode::NotFound,
                    format!("no module, chapter or page {id}"),
                )
            })?;
            let full = Renderer {
                mode: ReadMode::Raw,
                options,
            }
            .entity(siblings[index]);
            let value = full.get(*field).cloned().ok_or_else(|| {
                EditError::new(EditErrorCode::NotFound, format!("{path} isn't a field"))
            })?;
            Ok(ReadResult {
                value: Some(value),
                ..ReadResult::single(selector, Vec::new())
            })
        }
        _ => Err(EditError::new(
            EditErrorCode::InvalidPath,
            format!("\"{path}\" goes deeper than an entity field"),
        )),
    }
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::*;
    use crate::engine::read::StopReason;
    use crate::test_fixtures::{id, p};

    fn sample() -> CourseStructure {
        let page = |name: &str, path: &str| StructurePage {
            id: id(name),
            title: name.to_uppercase(),
            url_path: path.into(),
            hidden: false,
            block_count: 2,
            exercise_count: 0,
            has_submissions: false,
        };
        let chapters = (1..=15)
            .map(|n| StructureChapter {
                id: id(&format!("ch{n}")),
                chapter_number: n,
                name: format!("Chapter {n}"),
                color: None,
                opens_at: None,
                deadline: None,
                pages: (0..10)
                    .map(|k| page(&format!("ch{n}pg{k}"), &format!("/chapter-{n}/p{k}")))
                    .collect(),
            })
            .collect();
        CourseStructure {
            course: super::super::course_structure::StructureCourse {
                id: id("c1"),
                pages: vec![page("pg0", "/")],
                modules: vec![StructureModule {
                    id: id("m1"),
                    default: true,
                    name: None,
                    chapters,
                }],
            },
        }
    }

    #[test]
    fn whole_course_collapses_when_over_budget() {
        let options = ReadOptions {
            budget_bytes: 2_000,
            ..Default::default()
        };
        let result = read_structure(&sample(), &Selector::default(), &options).unwrap();
        assert_eq!(result.items[0]["modules"][0]["collapsed"], json!(1));
        assert_eq!(
            result.items[0]["modules"][0]["path"],
            json!("/course/modules")
        );
    }

    #[test]
    fn chapter_list_window_and_continuation() {
        let selector = Selector {
            path: Some(format!("{}/chapters", p("m1"))),
            limit: Some(4),
            ..Default::default()
        };
        let result = read_structure(&sample(), &selector, &ReadOptions::default()).unwrap();
        assert_eq!(result.items.len(), 4);
        assert_eq!(result.total, Some(15));
        assert_eq!(result.stopped_by, Some(StopReason::Limit));
        assert_eq!(result.next.unwrap().path, Some(p("ch5")));
    }

    #[test]
    fn entity_range_and_field() {
        let range = Selector {
            path: Some(p("ch2pg3")),
            through: Some(p("ch2pg5")),
            ..Default::default()
        };
        let result = read_structure(&sample(), &range, &ReadOptions::default()).unwrap();
        assert_eq!(result.items.len(), 3);
        assert_eq!(result.items[0]["kind"], json!("page"));
        let field = Selector {
            path: Some(format!("{}/deadline", p("ch3"))),
            ..Default::default()
        };
        assert_eq!(
            read_structure(&sample(), &field, &ReadOptions::default())
                .unwrap()
                .value,
            Some(Value::Null)
        );
        let chapter = Selector {
            path: Some(p("ch3")),
            ..Default::default()
        };
        let result = read_structure(&sample(), &chapter, &ReadOptions::default()).unwrap();
        assert_eq!(result.items[0]["pages"].as_array().unwrap().len(), 10);
    }
}
