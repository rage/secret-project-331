//! Read selectors over a page's blocks.

use std::collections::HashMap;

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use super::window::{HasId, list_read, reject_window, sibling_window, single_unit, window};
use super::{ReadMode, ReadOptions, ReadResult, Selector, check_selector, field_result};
use crate::diff::ChangeKind;
use crate::engine::PageDocument;
use crate::engine::blocks;
use crate::engine::error::{EditError, EditErrorCode};
use crate::engine::path::{BlockPart, BlockPath, parse_block_path, parse_uuid};
use crate::text::{plain_text, preview};

/// What a read path names, with the index path of the block it starts from.
enum PageAddress {
    /// The top level, or the children of the block.
    List(Option<(Uuid, Vec<usize>)>),
    Block(Uuid, Vec<usize>),
    Name(Vec<usize>),
    /// The block's attributes and a JSON Pointer into them, `""` for all of them.
    Attribute(Vec<usize>, String),
}

fn page_address(page: &PageDocument, path: &str) -> Result<PageAddress, EditError> {
    let parsed = parse_block_path(path).ok_or_else(|| {
        EditError::new(
            EditErrorCode::InvalidPath,
            format!("path \"{path}\" must start with /"),
        )
    })?;
    let (root, part) = match parsed {
        BlockPath::TopLevel => return Ok(PageAddress::List(None)),
        BlockPath::Block { root, part } => (root, part),
    };
    if root.starts_with('$') {
        return Err(EditError::new(
            EditErrorCode::LabelUndefined,
            "labels only exist inside the call that created them; use the returned ids",
        ));
    }
    let id = parse_uuid(&root, path)?;
    let location = blocks::find_path(&page.blocks, id).ok_or_else(|| {
        EditError::new(
            EditErrorCode::NotFound,
            format!("no block {id} on this page"),
        )
        .with_fix("read the outline (no path) to get current ids")
    })?;
    match part {
        BlockPart::Whole => Ok(PageAddress::Block(id, location)),
        BlockPart::Children => Ok(PageAddress::List(Some((id, location)))),
        BlockPart::ChildIndex(_) => Err(EditError::new(
            EditErrorCode::NumericIndex,
            "children are addressed by id; use offset and limit for windows",
        )),
        BlockPart::Attributes(pointer) => Ok(PageAddress::Attribute(location, pointer.to_string())),
        BlockPart::Name => Ok(PageAddress::Name(location)),
        BlockPart::Other {
            field,
            is_deeper: true,
        } if field == "name" => Err(EditError::new(
            EditErrorCode::InvalidPath,
            format!("a block's name is a string; read /{id}/name"),
        )),
        BlockPart::Other { field, .. } => Err(EditError::new(
            EditErrorCode::InvalidPath,
            format!("blocks have no \"{field}\""),
        )
        .with_fix(format!("/{id}/attributes/{field}"))),
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
    let render = |block: &GutenbergBlock| render_block(block, mode, options.pending);
    match page_address(page, path)? {
        PageAddress::Name(location) => {
            reject_window(selector, "a field")?;
            let name = blocks::get(&page.blocks, &location)?.name.clone();
            Ok(field_result(selector, Value::String(name)))
        }
        PageAddress::Attribute(location, pointer) => {
            reject_window(selector, "a field")?;
            let attributes = &blocks::get(&page.blocks, &location)?.attributes;
            let value = if pointer.is_empty() {
                Value::Object(attributes.clone())
            } else {
                blocks::attribute(attributes, &pointer)
                    .cloned()
                    .ok_or_else(|| {
                        EditError::new(EditErrorCode::NotFound, format!("{path} isn't set"))
                    })?
            };
            Ok(field_result(selector, value))
        }
        PageAddress::List(parent) => {
            let parent_path = parent
                .as_ref()
                .map(|(_, path)| path.as_slice())
                .unwrap_or(&[]);
            list_read(
                selector,
                blocks::list(&page.blocks, parent_path)?,
                parent.map(|(id, _)| format!("/{id}/innerBlocks")),
                options,
                &render,
                "a block",
            )
        }
        PageAddress::Block(id, location) => {
            if selector.offset.is_some() {
                return Err(EditError::new(EditErrorCode::InvalidValue, "offset works on a children list; with a block path use limit to read on from that block")
                    .with_fix(format!("{{\"path\":\"/{id}\",\"limit\":20}}")));
            }
            let (&index, parent_path) = location.split_last().ok_or_else(blocks::stale_location)?;
            let list = blocks::list(&page.blocks, parent_path)?;
            let parent = if parent_path.is_empty() {
                None
            } else {
                Some(format!(
                    "/{}/innerBlocks",
                    blocks::get(&page.blocks, parent_path)?.client_id
                ))
            };
            let sibling_ids: Vec<Uuid> = list.iter().map(|b| b.client_id).collect();
            match sibling_window(selector, index, &sibling_ids)? {
                Some((start, end)) => {
                    Ok(window(selector, list, start, end, parent, options, &render))
                }
                None => Ok(single_unit(
                    selector,
                    render(blocks::get(&page.blocks, &location)?),
                    options,
                )),
            }
        }
    }
}

impl HasId for GutenbergBlock {
    fn id(&self) -> Uuid {
        self.client_id
    }
}

/// The 40-60 character preview of a block's visible text.
pub(crate) fn block_preview(block: &GutenbergBlock) -> Option<String> {
    blocks::TEXT_ATTRIBUTES
        .iter()
        .filter_map(|key| block.attributes.get(*key).and_then(Value::as_str))
        .map(plain_text)
        .find(|text| !text.is_empty())
        .map(|text| preview(&text, 60))
}

fn render_block(
    block: &GutenbergBlock,
    mode: ReadMode,
    pending: Option<&HashMap<Uuid, ChangeKind>>,
) -> Value {
    let mut object = Map::new();
    object.insert("clientId".into(), json!(block.client_id));
    object.insert("path".into(), json!(format!("/{}", block.client_id)));
    object.insert("name".into(), json!(block.name));
    let children: Vec<Value> = block
        .inner_blocks
        .iter()
        .map(|b| render_block(b, mode, pending))
        .collect();
    match mode {
        ReadMode::Outline => {
            if let Some(preview) = block_preview(block) {
                object.insert("preview".into(), json!(preview));
            }
            if let Some(exercise_id) = block.exercise_id() {
                object.insert("exercise_id".into(), json!(exercise_id));
            }
            if !children.is_empty() {
                object.insert("children".into(), json!(children.len()));
                object.insert("innerBlocks".into(), Value::Array(children));
            }
        }
        ReadMode::Raw => {
            object.insert("isValid".into(), json!(block.is_valid));
            object.insert("attributes".into(), Value::Object(block.attributes.clone()));
            object.insert("innerBlocks".into(), Value::Array(children));
        }
    }
    if let Some(kind) = pending.and_then(|p| p.get(&block.client_id)) {
        object.insert("pending".into(), json!(kind));
    }
    Value::Object(object)
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::*;
    use crate::engine::PageType;
    use crate::engine::read::StopReason;
    use crate::test_fixtures::{exercise, heading, id, infobox, p, page, para, read_options};

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
        read_page(&sample(), &selector, &read_options(24_000))
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
        let options = read_options(600);
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

    /// Follows `next` from `first` to the end and returns every item's path in order.
    fn read_to_end(first: Selector, options: &ReadOptions) -> Vec<String> {
        let mut paths = Vec::new();
        let mut selector = Some(first);
        while let Some(current) = selector {
            let result = read_page(&sample(), &current, options).unwrap();
            paths.extend(
                result
                    .items
                    .iter()
                    .map(|item| item["path"].as_str().unwrap().to_string()),
            );
            assert_eq!(result.has_more, result.next.is_some());
            selector = result.next;
        }
        paths
    }

    #[test]
    fn budget_stopped_reads_continue_to_the_end_of_their_window() {
        let options = read_options(600);
        let all: Vec<String> = sample()
            .blocks
            .iter()
            .map(|b| format!("/{}", b.client_id))
            .collect();
        let raw = |selector: Selector| Selector {
            mode: Some(ReadMode::Raw),
            ..selector
        };
        assert_eq!(read_to_end(raw(Selector::default()), &options), all);
        assert_eq!(
            read_to_end(
                raw(Selector {
                    offset: Some(5),
                    ..Default::default()
                }),
                &options
            ),
            all[5..].to_vec()
        );
        assert_eq!(
            read_to_end(
                raw(Selector {
                    path: Some(p("p10")),
                    around: Some(8),
                    ..Default::default()
                }),
                &options
            ),
            all[4..21].to_vec()
        );
    }

    #[test]
    fn an_oversized_first_unit_of_a_window_collapses_children() {
        let options = read_options(50);
        let result = read_page(
            &sample(),
            &Selector {
                offset: Some(1),
                mode: Some(ReadMode::Raw),
                ..Default::default()
            },
            &options,
        )
        .unwrap();
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0]["innerBlocks"][0]["collapsed"], json!(2));
    }

    #[test]
    fn a_block_name_has_no_fields() {
        assert!(
            read(Selector {
                path: Some(format!("{}/name/foo", p("h1"))),
                ..Default::default()
            })
            .is_err()
        );
        let name = read(Selector {
            path: Some(format!("{}/name", p("h1"))),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(name.value, Some(json!("core/heading")));
    }

    #[test]
    fn oversized_single_block_collapses_children() {
        let options = read_options(50);
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
        let pending = HashMap::from([(id("h1"), ChangeKind::Changed)]);
        let options = ReadOptions {
            pending: Some(&pending),
            ..read_options(24_000)
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
