use headless_lms_utils::document_schema_processor::GutenbergBlock;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use crate::engine::{PageDocument, PageType};

/// A stable id for a short test name, so fixtures can say `id("p1")`.
pub fn id(name: &str) -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_OID, name.as_bytes())
}

/// `/<id of name>`.
pub fn p(name: &str) -> String {
    format!("/{}", id(name))
}

pub fn block(
    name: &str,
    block_name: &str,
    attributes: Value,
    children: Vec<GutenbergBlock>,
) -> GutenbergBlock {
    let attributes: Map<String, Value> = match attributes {
        Value::Object(map) => map,
        _ => Map::new(),
    };
    GutenbergBlock {
        client_id: id(name),
        name: block_name.to_string(),
        is_valid: true,
        attributes,
        inner_blocks: children,
    }
}

pub fn para(name: &str, text: &str) -> GutenbergBlock {
    block(
        name,
        "core/paragraph",
        json!({"content": text, "dropCap": false}),
        vec![],
    )
}

pub fn heading(name: &str, text: &str) -> GutenbergBlock {
    block(
        name,
        "core/heading",
        json!({"content": text, "level": 2}),
        vec![],
    )
}

pub fn infobox(name: &str, children: Vec<GutenbergBlock>) -> GutenbergBlock {
    block(name, "moocfi/infobox", json!({}), children)
}

pub fn exercise(name: &str, exercise_name: &str) -> GutenbergBlock {
    block(
        name,
        "moocfi/exercise",
        json!({"id": id(exercise_name).to_string()}),
        vec![],
    )
}

pub fn page(name: &str, page_type: PageType, blocks: Vec<GutenbergBlock>) -> PageDocument {
    PageDocument {
        page_id: id(name),
        page_type,
        blocks,
    }
}

/// Top-level block ids by fixture name, for order assertions.
pub fn top_level(blocks: &[GutenbergBlock]) -> Vec<Uuid> {
    blocks.iter().map(|b| b.client_id).collect()
}
