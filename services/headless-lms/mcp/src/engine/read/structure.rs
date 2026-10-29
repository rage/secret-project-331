//! Read selectors over the course structure.

use serde_json::{Map, Value, json};
use uuid::Uuid;

use super::window::{HasId, list_read, reject_window, sibling_window, single_unit, window};
use super::{ReadMode, ReadOptions, ReadResult, Selector, check_selector, field_result};
use crate::engine::course_structure::{
    CourseStructure, EntityRef, ListRef, Loc, RENDERED_KEYS, parse_structure_path,
};
use crate::engine::error::{EditError, EditErrorCode};
use crate::engine::path::parse_uuid;

impl HasId for EntityRef<'_> {
    fn id(&self) -> Uuid {
        EntityRef::id(*self)
    }
}

struct Renderer<'a> {
    mode: ReadMode,
    options: &'a ReadOptions<'a>,
}

impl Renderer<'_> {
    fn entity(&self, entity: EntityRef) -> Value {
        let mut value = serde_json::to_value(entity).unwrap_or_else(|error| {
            tracing::error!(%error, "a course structure entity didn't serialize");
            Value::Null
        });
        if let Value::Object(object) = &mut value {
            self.add_read_keys(object, entity);
        }
        value
    }

    /// Adds [`RENDERED_KEYS`] to the serialized `entity` and its children; outlines leave out
    /// chapter colours.
    fn add_read_keys(&self, object: &mut Map<String, Value>, entity: EntityRef) {
        let id = entity.id();
        object.insert("path".into(), json!(format!("/{id}")));
        object.insert("kind".into(), json!(entity.kind().noun()));
        if let Some(pending) = self.options.pending.and_then(|p| p.get(&id)) {
            object.insert("pending".into(), json!(pending));
        }
        let (key, children): (&str, Vec<EntityRef>) = match entity {
            EntityRef::Module(module) => (
                "chapters",
                module.chapters.iter().map(EntityRef::Chapter).collect(),
            ),
            EntityRef::Chapter(chapter) => {
                if self.mode == ReadMode::Outline {
                    object.remove("color");
                }
                ("pages", chapter.pages.iter().map(EntityRef::Page).collect())
            }
            EntityRef::Page(_) => return,
        };
        if let Some(Value::Array(rendered)) = object.get_mut(key) {
            for (child, child_entity) in rendered.iter_mut().zip(children) {
                if let Value::Object(child) = child {
                    self.add_read_keys(child, child_entity);
                }
            }
        }
    }

    fn course(&self, doc: &CourseStructure) -> Value {
        json!({
            "id": doc.id,
            "path": "/course",
            "kind": "course",
            "pages": doc.pages.iter().map(|p| self.entity(EntityRef::Page(p))).collect::<Vec<_>>(),
            "modules": doc.modules.iter().map(|m| self.entity(EntityRef::Module(m))).collect::<Vec<_>>(),
        })
    }
}

/// Runs one selector against the course structure.
pub fn read_structure(
    doc: &CourseStructure,
    selector: &Selector,
    options: &ReadOptions,
) -> Result<ReadResult, EditError> {
    check_selector(selector)?;
    let mode = selector.mode.unwrap_or_default();
    let renderer = Renderer { mode, options };
    let render = |entity: &EntityRef| renderer.entity(*entity);
    let whole_course = || -> Result<ReadResult, EditError> {
        reject_window(selector, "the whole course")?;
        Ok(single_unit(selector, renderer.course(doc), options))
    };
    let path = selector.path.as_deref().unwrap_or("");
    if path.is_empty() || path == "/" {
        return whole_course();
    }
    let parsed = parse_structure_path(path).ok_or_else(|| {
        EditError::new(
            EditErrorCode::InvalidPath,
            format!("path \"{path}\" must start with /"),
        )
    })?;
    if parsed.is_course(doc.id) {
        let Some(child) = parsed.child.as_deref() else {
            return whole_course();
        };
        let list = ListRef::of_course(child)
            .filter(|_| !parsed.is_deeper)
            .ok_or_else(|| {
                EditError::new(
                    EditErrorCode::InvalidPath,
                    "the course's lists are /course/pages and /course/modules",
                )
            })?;
        return read_list(doc, selector, list, options, &render);
    }
    let id = parse_uuid(&parsed.root, path)?;
    let Loc { list, index } = doc.locate(id).ok_or_else(|| {
        EditError::new(
            EditErrorCode::NotFound,
            format!("no module, chapter or page {id}"),
        )
    })?;
    let siblings = doc.list(list);
    match (parsed.child.as_deref(), parsed.is_deeper) {
        (None, _) => {
            if selector.offset.is_some() {
                return Err(EditError::new(
                    EditErrorCode::InvalidValue,
                    "offset works on a list path such as /<chapter id>/pages",
                ));
            }
            let sibling_ids: Vec<Uuid> = siblings.iter().map(|e| e.id()).collect();
            let Some((start, end)) = sibling_window(selector, index, &sibling_ids)? else {
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
                Some(list.path()),
                options,
                &render,
            ))
        }
        (Some(key @ ("pages" | "modules" | "chapters")), false) => {
            let child_list = ListRef::of_entity(list.kind(), id, key).ok_or_else(|| {
                EditError::new(
                    EditErrorCode::InvalidPath,
                    format!(
                        "/{id}/{key} isn't a list; lists are /<module id>/chapters and /<chapter id>/pages"
                    ),
                )
            })?;
            read_list(doc, selector, child_list, options, &render)
        }
        (Some(field), false) => {
            reject_window(selector, "a field")?;
            let full = Renderer {
                mode: ReadMode::Raw,
                options,
            }
            .entity(siblings[index]);
            let value = full
                .get(field)
                .filter(|_| field != "id" && !RENDERED_KEYS.contains(&field))
                .cloned()
                .ok_or_else(|| {
                    EditError::new(EditErrorCode::NotFound, format!("{path} isn't a field"))
                })?;
            Ok(field_result(selector, value))
        }
        (Some(_), true) => Err(EditError::new(
            EditErrorCode::InvalidPath,
            format!("\"{path}\" goes deeper than an entity field"),
        )),
    }
}

/// A window over one of the structure's lists.
fn read_list(
    doc: &CourseStructure,
    selector: &Selector,
    list: ListRef,
    options: &ReadOptions,
    render: &dyn Fn(&EntityRef) -> Value,
) -> Result<ReadResult, EditError> {
    list_read(
        selector,
        &doc.list(list),
        Some(list.path()),
        options,
        render,
        "an entity",
    )
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::*;
    use crate::engine::course_structure::StructureModule;
    use crate::engine::read::StopReason;
    use crate::test_fixtures::{id, p, read_options, structure_chapter, structure_page};

    fn sample() -> CourseStructure {
        let page = |name: &str, path: &str| structure_page(name, &name.to_uppercase(), path);
        let chapters = (1..=15)
            .map(|n| {
                structure_chapter(
                    &format!("ch{n}"),
                    n,
                    &format!("Chapter {n}"),
                    (0..10)
                        .map(|k| page(&format!("ch{n}pg{k}"), &format!("/chapter-{n}/p{k}")))
                        .collect(),
                )
            })
            .collect();
        CourseStructure {
            id: id("c1"),
            pages: vec![page("pg0", "/")],
            modules: vec![StructureModule {
                id: id("m1"),
                default: true,
                name: None,
                chapters,
            }],
        }
    }

    #[test]
    fn whole_course_collapses_when_over_budget() {
        let options = read_options(2_000);
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
        let result = read_structure(&sample(), &selector, &read_options(24_000)).unwrap();
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
        let result = read_structure(&sample(), &range, &read_options(24_000)).unwrap();
        assert_eq!(result.items.len(), 3);
        assert_eq!(result.items[0]["kind"], json!("page"));
        let field = Selector {
            path: Some(format!("{}/deadline", p("ch3"))),
            ..Default::default()
        };
        assert_eq!(
            read_structure(&sample(), &field, &read_options(24_000))
                .unwrap()
                .value,
            Some(Value::Null)
        );
        let chapter = Selector {
            path: Some(p("ch3")),
            ..Default::default()
        };
        let result = read_structure(&sample(), &chapter, &read_options(24_000)).unwrap();
        assert_eq!(result.items[0]["pages"].as_array().unwrap().len(), 10);
        for rendered_only in ["kind", "path", "pending"] {
            let selector = Selector {
                path: Some(format!("{}/{rendered_only}", p("ch3"))),
                ..Default::default()
            };
            assert!(read_structure(&sample(), &selector, &read_options(24_000)).is_err());
        }
    }

    #[test]
    fn a_large_only_module_collapses_when_its_list_is_read() {
        let options = read_options(2_000);
        let selector = Selector {
            path: Some("/course/modules".into()),
            ..Default::default()
        };
        let result = read_structure(&sample(), &selector, &options).unwrap();
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0]["chapters"][0]["collapsed"], json!(15));
    }
}
