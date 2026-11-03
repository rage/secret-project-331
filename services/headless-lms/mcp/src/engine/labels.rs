//! `$name` labels: call-local names for items the call creates.

use std::collections::{BTreeMap, HashMap};

use serde_json::{Map, Value};
use uuid::Uuid;

use super::error::{EditError, EditErrorCode};
use super::op::Op;
use super::path::{ItemRef, parse_item_ref, parse_uuid};

/// The `$label`s of one call and the ids they name.
#[derive(Debug, Default)]
pub(crate) struct Labels {
    assigned: BTreeMap<String, Uuid>,
    /// Labels some later op defines, for "used before defined" errors.
    defined_by_op: HashMap<String, usize>,
}

impl Labels {
    /// Scans every op for the labels it defines so out-of-order use gets a precise error.
    pub(crate) fn prescan(ops: &[Op]) -> Self {
        let mut defined_by_op = HashMap::new();
        for (index, op) in ops.iter().enumerate() {
            if let Some(label) = op.label() {
                defined_by_op.entry(label.to_string()).or_insert(index);
            }
            if let Some(value) = op.value() {
                collect_value_labels(value, index, &mut defined_by_op);
            }
        }
        Self {
            assigned: BTreeMap::new(),
            defined_by_op,
        }
    }

    /// Binds `label` to the new item `id`. Errors if the label is malformed or already bound.
    pub(crate) fn define(&mut self, label: &str, id: Uuid) -> Result<(), EditError> {
        check_label_syntax(label)?;
        if self.assigned.contains_key(label) {
            return Err(EditError::new(
                EditErrorCode::LabelReused,
                format!("label {label} is already used in this call; each label names one item"),
            )
            .with_fix(format!("rename one of them, e.g. {label}2")));
        }
        self.assigned.insert(label.to_string(), id);
        Ok(())
    }

    fn resolve(&self, label: &str, current_op: usize) -> Result<Uuid, EditError> {
        if let Some(id) = self.assigned.get(label) {
            return Ok(*id);
        }
        match self.defined_by_op.get(label) {
            Some(defining) if *defining >= current_op => Err(EditError::new(
                EditErrorCode::LabelUndefined,
                format!("label {label} is created by op {defining}, which comes later in ops"),
            )
            .with_fix("move the op that creates the label before the ops that use it")),
            _ => Err(EditError::new(
                EditErrorCode::LabelUndefined,
                format!("label {label} isn't defined in this call"),
            )
            .with_fix(
                "labels last for one call only; use the id returned by the call that created the item, or re-read",
            )),
        }
    }

    /// The id a path segment names: a `$label` or a UUID. `whole` is the path, for errors.
    pub(crate) fn resolve_segment(
        &self,
        segment: &str,
        whole: &str,
        current_op: usize,
    ) -> Result<Uuid, EditError> {
        if segment.starts_with('$') {
            self.resolve(segment, current_op)
        } else {
            parse_uuid(segment, whole)
        }
    }

    /// The id an item reference such as `through` names: a `$label` or an id path.
    pub(crate) fn resolve_item_ref(&self, raw: &str, current_op: usize) -> Result<Uuid, EditError> {
        match parse_item_ref(raw)? {
            ItemRef::Label(label) => self.resolve(label, current_op),
            ItemRef::Id(id) => Ok(id),
        }
    }

    /// [`Self::resolve_item_ref`] for an optional field.
    pub(crate) fn resolve_optional_item_ref(
        &self,
        raw: Option<&str>,
        current_op: usize,
    ) -> Result<Option<Uuid>, EditError> {
        raw.map(|raw| self.resolve_item_ref(raw, current_op))
            .transpose()
    }

    /// The labels bound by the call.
    pub(crate) fn into_map(self) -> BTreeMap<String, Uuid> {
        self.assigned
    }
}

fn check_label_syntax(label: &str) -> Result<(), EditError> {
    let valid = label.len() > 1
        && label.starts_with('$')
        && label[1..]
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    if valid {
        Ok(())
    } else {
        Err(EditError::new(
            EditErrorCode::LabelInvalid,
            format!("label \"{label}\" is invalid; labels start with $ followed by letters, digits, _ or -"),
        )
        .with_fix(format!("${}", label.trim_start_matches('$').replace(|c: char| !c.is_ascii_alphanumeric(), "_"))))
    }
}

fn collect_value_labels(value: &Value, op: usize, out: &mut HashMap<String, usize>) {
    match value {
        Value::Object(object) => {
            if let Some(Value::String(label)) = object.get("label") {
                out.entry(label.clone()).or_insert(op);
            }
            for key in ["innerBlocks", "pages", "blocks"] {
                if let Some(child) = object.get(key) {
                    collect_value_labels(child, op, out);
                }
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_value_labels(item, op, out);
            }
        }
        _ => {}
    }
}

/// The `label` field of a new item, if it has one. `example` shows a label in the error.
pub(crate) fn label_field(
    object: &Map<String, Value>,
    example: &str,
) -> Result<Option<String>, EditError> {
    match object.get("label") {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(label)) => Ok(Some(label.clone())),
        Some(_) => Err(EditError::new(
            EditErrorCode::LabelInvalid,
            format!("label is a string like \"{example}\""),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::op::{PatchTarget, parse_ops};
    use serde_json::json;

    #[test]
    fn label_used_before_definition() {
        let ops = parse_ops(
            &[
                json!({"op":"remove","path":"/$box"}),
                json!({"op":"add","path":"","position":"end","value":{"label":"$box","name":"moocfi/infobox"}}),
            ],
            PatchTarget::PageContent,
        )
        .unwrap();
        let labels = Labels::prescan(&ops);
        let error = labels.resolve("$box", 0).unwrap_err();
        assert_eq!(error.code, EditErrorCode::LabelUndefined);
        assert!(error.message.contains("op 1"));
    }

    #[test]
    fn label_reuse_and_syntax() {
        let mut labels = Labels::default();
        labels.define("$a", Uuid::nil()).unwrap();
        assert_eq!(
            labels.define("$a", Uuid::nil()).unwrap_err().code,
            EditErrorCode::LabelReused
        );
        assert_eq!(
            labels.define("box", Uuid::nil()).unwrap_err().code,
            EditErrorCode::LabelInvalid
        );
    }
}
