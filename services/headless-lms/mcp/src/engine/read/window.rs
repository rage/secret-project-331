//! Windows over lists of units that fill a byte budget, shared by the page and structure reads.

use serde_json::{Value, json};
use uuid::Uuid;

use super::{ReadOptions, ReadResult, Selector, StopReason};
use crate::engine::error::{EditError, EditErrorCode};
use crate::engine::path::parse_uuid;
use crate::text::serialized_len;

/// A window over a whole list, which `offset` and `limit` select. `noun` names what a path that
/// `through` and `around` start from points at, e.g. "a block".
pub(crate) fn list_read<T: HasId>(
    selector: &Selector,
    items: &[T],
    parent: Option<String>,
    options: &ReadOptions,
    render: &dyn Fn(&T) -> Value,
    noun: &str,
) -> Result<ReadResult, EditError> {
    if selector.through.is_some() || selector.around.is_some() {
        return Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!("through and around start from {noun} path, not a list"),
        ));
    }
    let start = selector.offset.unwrap_or(0) as usize;
    let end = selector
        .limit
        .map(|l| start + l as usize)
        .unwrap_or(items.len());
    Ok(window(selector, items, start, end, parent, options, render))
}

/// The `[start, end)` window `through`, `around` or `limit` select from the siblings around the
/// one at `index`; `None` when the selector reads that sibling alone.
pub(crate) fn sibling_window(
    selector: &Selector,
    index: usize,
    sibling_ids: &[Uuid],
) -> Result<Option<(usize, usize)>, EditError> {
    if let Some(through) = &selector.through {
        let last = parse_uuid(through.trim_start_matches('/'), through)?;
        let last_index = sibling_ids
            .iter()
            .position(|id| *id == last)
            .filter(|last_index| *last_index >= index);
        return match last_index {
            Some(last_index) => Ok(Some((index, last_index + 1))),
            None => Err(EditError::new(
                EditErrorCode::InvalidRange,
                "through must be a later sibling of path",
            )
            .with_details(json!({
                "siblings_in_order": sibling_ids.iter().map(|id| format!("/{id}")).collect::<Vec<_>>()
            }))),
        };
    }
    if let Some(around) = selector.around {
        return Ok(Some((
            index.saturating_sub(around as usize),
            (index + around as usize + 1).min(sibling_ids.len()),
        )));
    }
    Ok(selector.limit.map(|limit| (index, index + limit as usize)))
}

/// Errors with `InvalidValue` when `selector` has window fields, for reads of `what` that have none.
pub(crate) fn reject_window(selector: &Selector, what: &str) -> Result<(), EditError> {
    if selector.through.is_some()
        || selector.around.is_some()
        || selector.offset.is_some()
        || selector.limit.is_some()
    {
        return Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!("through, around, offset and limit don't apply to {what}"),
        ));
    }
    Ok(())
}

/// A single requested unit; over budget, its children collapse so the agent can descend.
pub(crate) fn single_unit(
    selector: &Selector,
    mut unit: Value,
    options: &ReadOptions,
) -> ReadResult {
    if serialized_len(&unit) > options.budget_bytes {
        collapse_children(&mut unit);
    }
    ReadResult::single(selector, vec![unit])
}

/// Replaces every child list of `unit` (`innerBlocks`, `modules`, `chapters`, `pages`) with a
/// count and the path to read it from.
fn collapse_children(unit: &mut Value) {
    if let Some(object) = unit.as_object_mut() {
        let path = object
            .get("path")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        for key in ["innerBlocks", "modules", "chapters", "pages"] {
            if let Some(Value::Array(children)) = object.get_mut(key) {
                let count = children.len();
                *children = vec![json!({"collapsed": count, "path": format!("{path}/{key}")})];
            }
        }
    }
}

/// Fills a window `[start, end)` of `list` with whole units until the budget runs out.
pub(crate) fn window<T>(
    selector: &Selector,
    list: &[T],
    start: usize,
    end: usize,
    parent: Option<String>,
    options: &ReadOptions,
    render: &dyn Fn(&T) -> Value,
) -> ReadResult
where
    T: HasId,
{
    let end = end.min(list.len());
    let mut items = Vec::new();
    let mut used = 0;
    let mut stopped_by = None;
    let mut next_index = None;
    for (index, item) in list.iter().enumerate().take(end).skip(start) {
        let mut unit = render(item);
        let mut size = serialized_len(&unit);
        if items.is_empty() && size > options.budget_bytes {
            collapse_children(&mut unit);
            size = serialized_len(&unit);
        }
        if !items.is_empty() && used + size > options.budget_bytes {
            stopped_by = Some(StopReason::Budget);
            next_index = Some(index);
            break;
        }
        used += size;
        items.push(unit);
    }
    if stopped_by.is_none()
        && end < list.len()
        && selector.through.is_none()
        && selector.around.is_none()
    {
        stopped_by = Some(StopReason::Limit);
        next_index = Some(end);
    }
    let next = next_index.map(|index| {
        let path = Some(format!("/{}", list[index].id()));
        // A budget stop continues the same window; a limit stop starts the next one.
        let (through, limit) = match (stopped_by, &selector.through, selector.limit) {
            (Some(StopReason::Budget), Some(through), _) => (Some(through.clone()), None),
            (Some(StopReason::Budget), None, Some(limit)) => {
                (None, Some(limit.saturating_sub(items.len() as u32).max(1)))
            }
            (Some(StopReason::Budget), None, None) => {
                (Some(format!("/{}", list[end - 1].id())), None)
            }
            _ => (None, selector.limit),
        };
        Selector {
            path,
            through,
            limit,
            mode: selector.mode,
            state: selector.state,
            ..Selector::default()
        }
    });
    ReadResult {
        selector: selector.clone(),
        total: Some(list.len()),
        parent,
        items,
        value: None,
        has_more: next.is_some(),
        next,
        stopped_by,
    }
}

/// An item with an id that selectors can anchor on.
pub(crate) trait HasId {
    fn id(&self) -> Uuid;
}
