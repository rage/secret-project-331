//! The JSON-Patch-style op shared by every patch tool, and its parsing with teaching errors.

use std::fmt;

use schemars::JsonSchema;
use serde::de::IntoDeserializer;
use serde::de::value::{Error as ValueError, StrDeserializer};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};

use super::error::{EditError, EditErrorCode};

/// What a patch op does, as agents name it in `op`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum OpKind {
    Add,
    Remove,
    Replace,
    Move,
    Copy,
    Wrap,
    Unwrap,
    Split,
    Merge,
    Reorder,
}

/// The op's name on the wire, e.g. `move`.
impl fmt::Display for OpKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.serialize(f)
    }
}

/// Where an op puts items: next to the sibling at `path`, or at an end of the list at `path`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Position {
    Before,
    After,
    Start,
    End,
}

impl Position {
    const ALL: [Position; 4] = [
        Position::Before,
        Position::After,
        Position::Start,
        Position::End,
    ];
}

/// The position's name on the wire, e.g. `before`.
impl fmt::Display for Position {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.serialize(f)
    }
}

/// The unit variant whose wire name is `name`.
fn from_wire_name<'de, T: Deserialize<'de>>(name: &'de str) -> Option<T> {
    let deserializer: StrDeserializer<'de, ValueError> = name.into_deserializer();
    T::deserialize(deserializer).ok()
}

/// One edit. Which fields an op takes depends on `op` and the tool; parsing checks them.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct PatchOp {
    pub op: OpKind,
    /// The target, rooted at an id: `/p1`, `/box1/innerBlocks`, `/p1/attributes/content`; `""` is the page's top level.
    pub path: String,
    /// Source of `move`, `copy` and `merge`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from: Option<String>,
    /// Last sibling (inclusive) of a range starting at `from`, or at `path` for `remove` and `wrap`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub through: Option<String>,
    /// What is written. Untyped: block schemas come from the `guide` tool.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schemars(schema_with = "crate::tools::schema::untyped_value")]
    pub value: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position: Option<Position>,
    /// Target page of a cross-page `move` or `copy`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_page: Option<String>,
    /// `$name` for the item a `copy`, `wrap` or `split` creates; for `add`, put `label` inside `value`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    /// Text a `split` starts the second block with.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub at_text: Option<String>,
}

/// One op after [`parse_ops`]: it has every field its tool requires for it and no field it doesn't
/// take.
#[derive(Debug, Clone, PartialEq)]
pub enum Op {
    Add {
        path: String,
        value: Value,
        position: Option<Position>,
    },
    Remove {
        path: String,
        through: Option<String>,
    },
    Replace {
        path: String,
        value: Value,
    },
    Move(Transfer),
    Copy {
        transfer: Transfer,
        label: Option<String>,
    },
    Wrap {
        path: String,
        through: Option<String>,
        value: Value,
        label: Option<String>,
    },
    Unwrap {
        path: String,
    },
    Split {
        path: String,
        at_text: String,
        label: Option<String>,
    },
    Merge {
        path: String,
        from: String,
    },
    Reorder {
        path: String,
        value: Value,
    },
}

/// What a `move` or `copy` takes and where it puts it.
#[derive(Debug, Clone, PartialEq)]
pub struct Transfer {
    pub from: String,
    pub through: Option<String>,
    pub path: String,
    pub position: Position,
    pub to_page: Option<String>,
}

impl Op {
    /// The op's name.
    pub fn kind(&self) -> OpKind {
        match self {
            Op::Add { .. } => OpKind::Add,
            Op::Remove { .. } => OpKind::Remove,
            Op::Replace { .. } => OpKind::Replace,
            Op::Move(_) => OpKind::Move,
            Op::Copy { .. } => OpKind::Copy,
            Op::Wrap { .. } => OpKind::Wrap,
            Op::Unwrap { .. } => OpKind::Unwrap,
            Op::Split { .. } => OpKind::Split,
            Op::Merge { .. } => OpKind::Merge,
            Op::Reorder { .. } => OpKind::Reorder,
        }
    }

    /// Where the op acts; for `move` and `copy`, where the items go.
    pub fn path(&self) -> &str {
        match self {
            Op::Move(transfer) | Op::Copy { transfer, .. } => &transfer.path,
            Op::Add { path, .. }
            | Op::Remove { path, .. }
            | Op::Replace { path, .. }
            | Op::Wrap { path, .. }
            | Op::Unwrap { path }
            | Op::Split { path, .. }
            | Op::Merge { path, .. }
            | Op::Reorder { path, .. } => path,
        }
    }

    /// What the op writes, for the ops that take a value.
    pub fn value(&self) -> Option<&Value> {
        match self {
            Op::Add { value, .. }
            | Op::Replace { value, .. }
            | Op::Wrap { value, .. }
            | Op::Reorder { value, .. } => Some(value),
            _ => None,
        }
    }

    /// The op-level `$label` for the item the op creates.
    pub fn label(&self) -> Option<&str> {
        match self {
            Op::Copy { label, .. } | Op::Wrap { label, .. } | Op::Split { label, .. } => {
                label.as_deref()
            }
            _ => None,
        }
    }

    /// The page a `move` or `copy` puts items on, when not the edited one.
    pub fn to_page(&self) -> Option<&str> {
        match self {
            Op::Move(transfer) | Op::Copy { transfer, .. } => transfer.to_page.as_deref(),
            _ => None,
        }
    }
}

/// Which patch tool the ops are for; decides the allowed ops and fields.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PatchTarget {
    PageContent,
    CourseStructure,
    CourseSettings,
    GlossaryAndReferences,
}

impl PatchTarget {
    /// The name of the tool that takes these ops.
    pub fn tool_name(self) -> &'static str {
        match self {
            PatchTarget::PageContent => "patch_page_content",
            PatchTarget::CourseStructure => "patch_course_structure",
            PatchTarget::CourseSettings => "patch_course_settings",
            PatchTarget::GlossaryAndReferences => "patch_course_glossary_and_references",
        }
    }

    /// The ops the tool takes.
    pub fn allowed_ops(self) -> &'static [OpKind] {
        match self {
            PatchTarget::PageContent => &[
                OpKind::Add,
                OpKind::Remove,
                OpKind::Replace,
                OpKind::Move,
                OpKind::Copy,
                OpKind::Wrap,
                OpKind::Unwrap,
                OpKind::Split,
                OpKind::Merge,
            ],
            PatchTarget::CourseStructure => &[
                OpKind::Add,
                OpKind::Remove,
                OpKind::Replace,
                OpKind::Move,
                OpKind::Copy,
                OpKind::Reorder,
            ],
            PatchTarget::CourseSettings | PatchTarget::GlossaryAndReferences => {
                &[OpKind::Add, OpKind::Remove, OpKind::Replace]
            }
        }
    }

    /// (required fields, optional fields) besides `op` and `path`.
    fn fields(self, op: OpKind) -> (&'static [&'static str], &'static [&'static str]) {
        use OpKind::*;
        match (self, op) {
            (_, Add) => (&["value"], &["position"]),
            (PatchTarget::PageContent | PatchTarget::CourseStructure, Remove) => {
                (&[], &["through"])
            }
            (_, Remove) => (&[], &[]),
            (_, Replace) => (&["value"], &[]),
            (PatchTarget::PageContent, Move) => (&["from", "position"], &["through", "to_page"]),
            (_, Move) => (&["from", "position"], &["through"]),
            (PatchTarget::PageContent, Copy) => {
                (&["from", "position"], &["through", "to_page", "label"])
            }
            (_, Copy) => (&["from", "position"], &["label"]),
            (_, Wrap) => (&["value"], &["through", "label"]),
            (_, Unwrap) => (&[], &[]),
            (_, Split) => (&["at_text"], &["label"]),
            (_, Merge) => (&["from"], &[]),
            (_, Reorder) => (&["value"], &[]),
        }
    }

    /// The error for an op outside [`PatchTarget::allowed_ops`].
    pub(crate) fn rejected_op(self, op: OpKind) -> EditError {
        let fix = if self == PatchTarget::PageContent && op == OpKind::Reorder {
            REORDER_ON_PAGE_FIX.to_string()
        } else {
            self.allowed_ops_fix()
        };
        EditError::new(
            EditErrorCode::InvalidOp,
            format!("{} doesn't take op \"{op}\"", self.tool_name()),
        )
        .with_fix(fix)
    }

    fn allowed_ops_fix(self) -> String {
        format!(
            "{} takes: {}",
            self.tool_name(),
            self.allowed_ops()
                .iter()
                .map(OpKind::to_string)
                .collect::<Vec<_>>()
                .join(", ")
        )
    }
}

const REORDER_ON_PAGE_FIX: &str = "reorder blocks with replace on the children list using stubs: {\"op\":\"replace\",\"path\":\"/box1/innerBlocks\",\"value\":[{\"clientId\":\"c2\"},{\"clientId\":\"c1\"}]}";

const ALL_FIELDS: [&str; 9] = [
    "op", "path", "from", "through", "value", "position", "to_page", "label", "at_text",
];

/// Parses raw op objects, rejecting unknown fields and fields the op doesn't take.
pub fn parse_ops(raw: &[Value], target: PatchTarget) -> Result<Vec<Op>, EditError> {
    if raw.is_empty() {
        return Err(EditError::new(
            EditErrorCode::MissingField,
            "ops is empty; send at least one op",
        ));
    }
    raw.iter()
        .enumerate()
        .map(|(index, value)| parse_op(value, target).map_err(|e| e.at_op(index)))
        .collect()
}

fn parse_op(raw: &Value, target: PatchTarget) -> Result<Op, EditError> {
    let Some(object) = raw.as_object() else {
        return Err(EditError::new(
            EditErrorCode::InvalidOp,
            "each op must be an object like {\"op\":\"remove\",\"path\":\"/p1\"}",
        ));
    };
    let op_name = match object.get("op") {
        Some(Value::String(name)) => name.as_str(),
        _ => {
            return Err(EditError::new(
                EditErrorCode::MissingField,
                "op is missing; every op has \"op\" and \"path\"",
            ));
        }
    };
    let Some(op) = from_wire_name::<OpKind>(op_name) else {
        let message = if op_name == "test" {
            "op \"test\" isn't supported; ops already apply all-or-nothing, and an op whose target is gone fails on its own".to_string()
        } else {
            format!("unknown op \"{op_name}\"")
        };
        return Err(
            EditError::new(EditErrorCode::InvalidOp, message).with_fix(target.allowed_ops_fix())
        );
    };
    if !target.allowed_ops().contains(&op) {
        return Err(target.rejected_op(op));
    }

    check_unknown_fields(object)?;

    let (required, optional) = target.fields(op);
    for field in ALL_FIELDS.iter().skip(2) {
        // `"value": null` is a real value: it clears a nullable field.
        let present = if *field == "value" {
            object.contains_key("value")
        } else {
            object.get(*field).is_some_and(|v| !v.is_null())
        };
        if present && !required.contains(field) && !optional.contains(field) {
            return Err(field_not_allowed(op, field, target));
        }
        if !present && required.contains(field) {
            return Err(missing_field(op, field));
        }
    }

    let path = match object.get("path") {
        Some(Value::String(path)) => path.clone(),
        Some(_) => {
            return Err(EditError::new(
                EditErrorCode::InvalidPath,
                "path must be a string such as \"/p1\" or \"\"",
            ));
        }
        None => {
            return Err(EditError::new(
                EditErrorCode::MissingField,
                format!("{op_name} needs \"path\""),
            ));
        }
    };

    let position = match object.get("position") {
        None | Some(Value::Null) => None,
        Some(Value::String(name)) => {
            Some(from_wire_name::<Position>(name).ok_or_else(|| invalid_position(name))?)
        }
        Some(other) => return Err(invalid_position(&other.to_string())),
    };

    let string = |field| optional_string(object, field);
    let required_string = |field| string(field)?.ok_or_else(|| missing_field(op, field));
    let value = || {
        object
            .get("value")
            .cloned()
            .ok_or_else(|| missing_field(op, "value"))
    };
    let transfer = || -> Result<Transfer, EditError> {
        Ok(Transfer {
            from: required_string("from")?,
            through: string("through")?,
            path: path.clone(),
            position: position.ok_or_else(|| missing_field(op, "position"))?,
            to_page: string("to_page")?,
        })
    };
    Ok(match op {
        OpKind::Add => Op::Add {
            path,
            value: value()?,
            position,
        },
        OpKind::Remove => Op::Remove {
            through: string("through")?,
            path,
        },
        OpKind::Replace => Op::Replace {
            path,
            value: value()?,
        },
        OpKind::Move => Op::Move(transfer()?),
        OpKind::Copy => Op::Copy {
            transfer: transfer()?,
            label: string("label")?,
        },
        OpKind::Wrap => Op::Wrap {
            through: string("through")?,
            label: string("label")?,
            path,
            value: value()?,
        },
        OpKind::Unwrap => Op::Unwrap { path },
        OpKind::Split => Op::Split {
            label: string("label")?,
            at_text: required_string("at_text")?,
            path,
        },
        OpKind::Merge => Op::Merge {
            from: required_string("from")?,
            path,
        },
        OpKind::Reorder => Op::Reorder {
            path,
            value: value()?,
        },
    })
}

fn check_unknown_fields(object: &Map<String, Value>) -> Result<(), EditError> {
    let unknown: Vec<&String> = object
        .keys()
        .filter(|k| !ALL_FIELDS.contains(&k.as_str()))
        .collect();
    if unknown.is_empty() {
        return Ok(());
    }
    let reads_only = unknown
        .iter()
        .any(|k| matches!(k.as_str(), "offset" | "limit" | "index" | "around"));
    let message = if reads_only {
        format!(
            "unknown field(s) {}: offsets and windows exist only in reads; writes address things by id",
            quote_list(&unknown)
        )
    } else {
        format!("unknown field(s) {}", quote_list(&unknown))
    };
    Err(EditError::new(EditErrorCode::UnknownField, message)
        .with_fix(format!("op fields are: {}", ALL_FIELDS.join(", "))))
}

fn field_not_allowed(op: OpKind, field: &str, target: PatchTarget) -> EditError {
    let (required, optional) = target.fields(op);
    let hint = match (op, field) {
        (OpKind::Add, "from") => {
            Some("add creates new items from value; to relocate existing ones use move")
        }
        (OpKind::Add, "through") => {
            Some("add inserts the values given; ranges belong to move, copy, remove and wrap")
        }
        (OpKind::Replace, "position") => {
            Some("replace edits the thing at path in place; use move to relocate it")
        }
        (OpKind::Remove, "value") => Some("remove takes no value"),
        (OpKind::Merge, "through") => {
            Some("merge joins one block (from) into the block before it (path)")
        }
        _ => None,
    };
    let fix = if (op, field) == (OpKind::Add, "label") {
        "put \"label\" inside each value item: {\"op\":\"add\",...,\"value\":{\"label\":\"$x\",...}}".to_string()
    } else {
        let accepted = [["op", "path"].as_slice(), required, optional].concat();
        format!("{op} takes: {}", accepted.join(", "))
    };
    EditError::new(
        EditErrorCode::FieldNotAllowed,
        format!(
            "{} doesn't take \"{field}\"{}",
            op,
            hint.map(|h| format!("; {h}")).unwrap_or_default()
        ),
    )
    .with_fix(fix)
}

fn missing_field(op: OpKind, field: &str) -> EditError {
    let fix = match (op, field) {
        (OpKind::Move | OpKind::Copy, "position") => {
            "position is before/after a sibling at path, or start/end of the children list at path".to_string()
        }
        (OpKind::Move | OpKind::Copy, "from") => {
            "from is the item being moved or copied, path is where it goes: {\"op\":\"move\",\"from\":\"/p4\",\"path\":\"/h2\",\"position\":\"after\"}".to_string()
        }
        (OpKind::Merge, "from") => {
            "{\"op\":\"merge\",\"from\":\"/p8\",\"path\":\"/p7\"} merges p8 into p7".to_string()
        }
        (OpKind::Split, "at_text") => {
            "{\"op\":\"split\",\"path\":\"/p7\",\"at_text\":\"However,\"} starts a new block at \"However,\"".to_string()
        }
        _ => format!("add \"{field}\""),
    };
    EditError::new(
        EditErrorCode::MissingField,
        format!("{op} needs \"{field}\""),
    )
    .with_fix(fix)
}

fn invalid_position(given: &str) -> EditError {
    EditError::new(
        EditErrorCode::NumericIndex,
        format!("position {given} isn't supported; numeric indexes and \"-\" are rejected"),
    )
    .with_fix("position is \"before\" or \"after\" a sibling at path, or \"start\" or \"end\" of the children list at path, e.g. {\"path\":\"/box1/innerBlocks\",\"position\":\"end\"}")
    .with_details(json!({"positions": Position::ALL}))
}

fn optional_string(object: &Map<String, Value>, field: &str) -> Result<Option<String>, EditError> {
    match object.get(field) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(s)) => Ok(Some(s.clone())),
        Some(_) => Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!("{field} must be a string"),
        )),
    }
}

/// `items` double-quoted and comma-separated, for error messages.
pub(crate) fn quote_list<S: AsRef<str>>(items: &[S]) -> String {
    items
        .iter()
        .map(|s| format!("\"{}\"", s.as_ref()))
        .collect::<Vec<_>>()
        .join(", ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_one(op: Value, target: PatchTarget) -> Result<Op, EditError> {
        parse_ops(&[op], target).map(|mut ops| ops.remove(0))
    }

    #[test]
    fn parses_a_full_move() {
        let op = parse_one(
            json!({"op":"move","from":"/p5","through":"/p9","to_page":"pg2","path":"/h1","position":"after"}),
            PatchTarget::PageContent,
        )
        .unwrap();
        let Op::Move(transfer) = op else {
            panic!("expected a move, got {op:?}");
        };
        assert_eq!(transfer.position, Position::After);
        assert_eq!(transfer.through.as_deref(), Some("/p9"));
    }

    #[test]
    fn rejects_test_op() {
        let error = parse_one(
            json!({"op":"test","path":"/p1","value":1}),
            PatchTarget::PageContent,
        )
        .unwrap_err();
        assert_eq!(error.code, EditErrorCode::InvalidOp);
        assert!(error.message.contains("test"));
        assert_eq!(error.op, Some(0));
    }

    #[test]
    fn rejects_offset_in_writes() {
        let error = parse_one(
            json!({"op":"remove","path":"/p1","offset":3}),
            PatchTarget::PageContent,
        )
        .unwrap_err();
        assert_eq!(error.code, EditErrorCode::UnknownField);
        assert!(error.message.contains("only in reads"));
    }

    #[test]
    fn rejects_numeric_position() {
        let error = parse_one(
            json!({"op":"add","path":"","position":3,"value":{}}),
            PatchTarget::PageContent,
        )
        .unwrap_err();
        assert_eq!(error.code, EditErrorCode::NumericIndex);
    }

    #[test]
    fn add_position_optional_in_settings() {
        parse_one(
            json!({"op":"add","path":"/course/audiences","value":{"name":"x"}}),
            PatchTarget::CourseSettings,
        )
        .unwrap();
    }

    #[test]
    fn reorder_on_page_points_to_stubs() {
        let error = parse_one(
            json!({"op":"reorder","path":"","value":["a"]}),
            PatchTarget::PageContent,
        )
        .unwrap_err();
        assert!(error.fix.unwrap().contains("stubs"));
    }

    #[test]
    fn rejects_fields_an_op_does_not_take() {
        let error = parse_one(
            json!({"op":"replace","path":"/p1","value":{},"position":"after"}),
            PatchTarget::PageContent,
        )
        .unwrap_err();
        assert_eq!(error.code, EditErrorCode::FieldNotAllowed);
    }

    #[test]
    fn replace_keeps_explicit_null() {
        let op = parse_one(
            json!({"op":"replace","path":"/ch1/deadline","value":null}),
            PatchTarget::CourseStructure,
        )
        .unwrap();
        assert_eq!(op.value(), Some(&Value::Null));
    }
}
