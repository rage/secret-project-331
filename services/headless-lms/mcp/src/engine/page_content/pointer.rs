//! Writes into a block's attributes at a JSON Pointer.

use serde_json::{Map, Value};

use crate::engine::error::{EditError, EditErrorCode};
use crate::engine::path::unescape_segment;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum PointerWrite {
    Add,
    Replace,
}

/// Runs `edit` on the value holding the last segment of `pointer` (non-empty) inside
/// `attributes`, with that segment unescaped.
fn with_parent<T>(
    attributes: &mut Map<String, Value>,
    pointer: &str,
    edit: impl FnOnce(&mut Value, &str) -> Result<T, EditError>,
) -> Result<T, EditError> {
    let (parent, last) = pointer.rsplit_once('/').ok_or_else(|| {
        EditError::new(
            EditErrorCode::InvalidPath,
            format!("attribute path {pointer:?} doesn't start with /"),
        )
    })?;
    let mut holder = Value::Object(std::mem::take(attributes));
    let result = match holder.pointer_mut(parent) {
        Some(value) => edit(value, &unescape_segment(last)),
        None => Err(EditError::new(
            EditErrorCode::NotFound,
            format!("attributes{parent} isn't set"),
        )
        .with_fix("replace the enclosing attribute with a whole object instead")),
    };
    if let Value::Object(object) = holder {
        *attributes = object;
    }
    result
}

pub(super) fn pointer_write(
    attributes: &mut Map<String, Value>,
    pointer: &str,
    value: Value,
    mode: PointerWrite,
) -> Result<(), EditError> {
    with_parent(attributes, pointer, |parent, last| match parent {
        Value::Object(object) => {
            object.insert(last.to_string(), value);
            Ok(())
        }
        Value::Array(array) => {
            if last == "-" {
                if mode == PointerWrite::Add {
                    array.push(value);
                    return Ok(());
                }
                return Err(EditError::new(
                    EditErrorCode::InvalidPath,
                    "\"-\" appends, so it only works with add",
                ));
            }
            let index: usize = last.parse().map_err(|_| {
                EditError::new(
                    EditErrorCode::InvalidPath,
                    format!("\"{last}\" isn't an array index"),
                )
            })?;
            match mode {
                PointerWrite::Replace if index < array.len() => {
                    array[index] = value;
                    Ok(())
                }
                PointerWrite::Add if index <= array.len() => {
                    array.insert(index, value);
                    Ok(())
                }
                _ => Err(EditError::new(
                    EditErrorCode::NotFound,
                    format!(
                        "index {index} is past the end of an array of {}",
                        array.len()
                    ),
                )),
            }
        }
        _ => Err(EditError::new(
            EditErrorCode::InvalidPath,
            format!("attributes{pointer} goes into a value that isn't an object or array"),
        )),
    })
}

pub(super) fn pointer_remove(
    attributes: &mut Map<String, Value>,
    pointer: &str,
) -> Result<(), EditError> {
    with_parent(attributes, pointer, |parent, last| {
        let removed = match parent {
            Value::Object(object) => object.remove(last).is_some(),
            Value::Array(array) => match last.parse::<usize>() {
                Ok(index) if index < array.len() => {
                    array.remove(index);
                    true
                }
                _ => false,
            },
            _ => false,
        };
        if removed {
            Ok(())
        } else {
            Err(EditError::new(
                EditErrorCode::NotFound,
                format!("attributes{pointer} isn't set"),
            ))
        }
    })
}
