//! Path lookup, id filling and comparison over the JSON form of a stage workspace, for applying
//! the model's field-level edits.

use std::collections::HashSet;

use serde_json::{Map, Value};
use uuid::Uuid;

/// Lists whose items are objects with a client-generated `id`, keyed by the field holding them.
const LISTS_WITH_IDS: [&str; 3] = ["chapters", "topics", "workload_activities"];

/// The value at `segments`, where a segment names an object key or, inside a list with ids, the
/// `id` of an item.
pub(super) fn resolve_field<'a>(
    root: &'a mut Value,
    segments: &[&str],
) -> Result<&'a mut Value, String> {
    let mut current = root;
    for segment in segments {
        current = match current {
            Value::Object(map) => map
                .get_mut(*segment)
                .ok_or_else(|| format!("there is no field {segment}"))?,
            Value::Array(items) => items
                .iter_mut()
                .find(|item| item.get("id").and_then(Value::as_str) == Some(*segment))
                .ok_or_else(|| format!("there is no item with id {segment}"))?,
            _ => return Err(format!("{segment} goes inside a value that has no fields")),
        };
    }
    Ok(current)
}

/// Gives proposed list items the ids of the current items they replace, matched by title, and new
/// ids to the rest, so the model never has to invent or copy ids correctly.
pub(super) fn fill_ids(key: Option<&str>, proposed: &mut Value, current: &Value) {
    match proposed {
        Value::Array(items) if key.is_some_and(|key| LISTS_WITH_IDS.contains(&key)) => {
            let current_items = current.as_array().cloned().unwrap_or_default();
            let mut used_ids = HashSet::new();
            for item in items.iter_mut() {
                if let Value::String(title) = item {
                    let mut object = Map::new();
                    object.insert("title".to_string(), Value::String(title.clone()));
                    *item = Value::Object(object);
                }
                let Value::Object(object) = item else {
                    continue;
                };
                let supplied_id = object
                    .get("id")
                    .and_then(Value::as_str)
                    .and_then(|id| Uuid::parse_str(id).ok())
                    .filter(|id| !id.is_nil());
                let matched = match supplied_id {
                    Some(id) => current_items
                        .iter()
                        .find(|candidate| id_of(candidate) == Some(id)),
                    None => {
                        let title = object
                            .get("title")
                            .and_then(Value::as_str)
                            .map(normalized_title);
                        current_items.iter().find(|candidate| {
                            id_of(candidate).is_some_and(|id| !used_ids.contains(&id))
                                && title.is_some()
                                && candidate
                                    .get("title")
                                    .and_then(Value::as_str)
                                    .map(normalized_title)
                                    == title
                        })
                    }
                };
                let id = supplied_id
                    .or_else(|| matched.and_then(id_of))
                    .unwrap_or_else(Uuid::new_v4);
                used_ids.insert(id);
                object.insert("id".to_string(), Value::String(id.to_string()));
                let matched = matched.cloned().unwrap_or(Value::Null);
                fill_nested(object, &matched);
            }
        }
        Value::Object(object) => {
            if let Some(id) = id_of(current) {
                object.insert("id".to_string(), Value::String(id.to_string()));
            }
            fill_nested(object, current);
        }
        _ => {}
    }
}

fn fill_nested(object: &mut Map<String, Value>, current: &Value) {
    for (key, value) in object.iter_mut() {
        if key != "id" {
            fill_ids(Some(key), value, current.get(key).unwrap_or(&Value::Null));
        }
    }
}

fn id_of(value: &Value) -> Option<Uuid> {
    value
        .get("id")
        .and_then(Value::as_str)
        .and_then(|id| Uuid::parse_str(id).ok())
}

fn normalized_title(title: &str) -> String {
    title.trim().to_lowercase()
}

/// Whether the model's copy of a current value describes `actual`: ids and surrounding whitespace
/// are ignored, and every empty value (null, "", [], false, 0) counts as the same.
pub(super) fn same_content(actual: &Value, supplied: &Value) -> bool {
    if is_empty(actual) && is_empty(supplied) {
        return true;
    }
    match (actual, supplied) {
        (Value::String(a), Value::String(b)) => a.trim() == b.trim(),
        (Value::Number(a), Value::Number(b)) => a.as_f64() == b.as_f64(),
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(a, b)| same_content(a, b))
        }
        // A list item the model wrote as its title alone.
        (Value::Object(a), Value::String(_)) => a
            .get("title")
            .is_some_and(|title| same_content(title, supplied)),
        (Value::Object(a), Value::Object(b)) => a
            .iter()
            .filter(|(key, _)| key.as_str() != "id")
            .all(|(key, value)| same_content(value, b.get(key).unwrap_or(&Value::Null))),
        (a, b) => a == b,
    }
}

/// Whether `saved` holds everything `proposed` set. Fields `proposed` left out may have been
/// filled with defaults; numbers compare by value (`5` and `5.0`).
pub(super) fn keeps_proposed(saved: &Value, proposed: &Value) -> bool {
    match (saved, proposed) {
        (Value::Number(a), Value::Number(b)) => a.as_f64() == b.as_f64(),
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(a, b)| keeps_proposed(a, b))
        }
        (Value::Object(a), Value::Object(b)) => b
            .iter()
            .all(|(key, value)| a.get(key).is_some_and(|saved| keeps_proposed(saved, value))),
        (a, b) => a == b,
    }
}

fn is_empty(value: &Value) -> bool {
    match value {
        Value::Null => true,
        Value::Bool(b) => !b,
        Value::Number(n) => n.as_f64() == Some(0.0),
        Value::String(s) => s.trim().is_empty(),
        Value::Array(items) => items.is_empty(),
        Value::Object(map) => map
            .iter()
            .all(|(key, value)| key == "id" || is_empty(value)),
    }
}
