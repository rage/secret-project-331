//! The JSON-Patch-style op shared by every patch tool, and its parsing with teaching errors.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};

use super::error::{EditError, EditErrorCode};

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

impl OpKind {
    pub const ALL: [OpKind; 10] = [
        OpKind::Add,
        OpKind::Remove,
        OpKind::Replace,
        OpKind::Move,
        OpKind::Copy,
        OpKind::Wrap,
        OpKind::Unwrap,
        OpKind::Split,
        OpKind::Merge,
        OpKind::Reorder,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            OpKind::Add => "add",
            OpKind::Remove => "remove",
            OpKind::Replace => "replace",
            OpKind::Move => "move",
            OpKind::Copy => "copy",
            OpKind::Wrap => "wrap",
            OpKind::Unwrap => "unwrap",
            OpKind::Split => "split",
            OpKind::Merge => "merge",
            OpKind::Reorder => "reorder",
        }
    }

    fn parse(s: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|kind| kind.as_str() == s)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Position {
    Before,
    After,
    Start,
    End,
}

impl Position {
    fn parse(s: &str) -> Option<Self> {
        match s {
            "before" => Some(Position::Before),
            "after" => Some(Position::After),
            "start" => Some(Position::Start),
            "end" => Some(Position::End),
            _ => None,
        }
    }

    pub fn is_sibling_relative(self) -> bool {
        matches!(self, Position::Before | Position::After)
    }
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

/// Which patch tool the ops are for; decides the allowed ops and fields.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PatchTarget {
    PageContent,
    CourseStructure,
    CourseSettings,
    GlossaryAndReferences,
}

impl PatchTarget {
    fn tool_name(self) -> &'static str {
        match self {
            PatchTarget::PageContent => "patch_page_content",
            PatchTarget::CourseStructure => "patch_course_structure",
            PatchTarget::CourseSettings => "patch_course_settings",
            PatchTarget::GlossaryAndReferences => "patch_course_glossary_and_references",
        }
    }

    fn allowed_ops(self) -> &'static [OpKind] {
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
            (PatchTarget::PageContent, Add) => (&["value"], &["position", "label"]),
            (PatchTarget::CourseStructure, Add) => (&["value"], &["position", "label"]),
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

    fn unsupported_op_fix(self, op: OpKind) -> String {
        match (self, op) {
            (PatchTarget::PageContent, OpKind::Reorder) => {
                "reorder blocks with replace on the children list using stubs: {\"op\":\"replace\",\"path\":\"/box1/innerBlocks\",\"value\":[{\"clientId\":\"c2\"},{\"clientId\":\"c1\"}]}".to_string()
            }
            _ => format!(
                "{} takes: {}",
                self.tool_name(),
                self.allowed_ops()
                    .iter()
                    .map(|op| op.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
        }
    }
}

const ALL_FIELDS: [&str; 9] = [
    "op", "path", "from", "through", "value", "position", "to_page", "label", "at_text",
];

/// Parses raw op objects, rejecting unknown fields and fields the op doesn't take.
pub fn parse_ops(raw: &[Value], target: PatchTarget) -> Result<Vec<PatchOp>, EditError> {
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

fn parse_op(raw: &Value, target: PatchTarget) -> Result<PatchOp, EditError> {
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
    let Some(op) = OpKind::parse(op_name) else {
        let message = if op_name == "test" {
            "op \"test\" isn't supported; ops already apply all-or-nothing, and an op whose target is gone fails on its own".to_string()
        } else {
            format!("unknown op \"{op_name}\"")
        };
        return Err(EditError::new(EditErrorCode::InvalidOp, message)
            .with_fix(target.unsupported_op_fix(OpKind::Add)));
    };
    if !target.allowed_ops().contains(&op) {
        return Err(EditError::new(
            EditErrorCode::InvalidOp,
            format!("{} doesn't take op \"{op_name}\"", target.tool_name()),
        )
        .with_fix(target.unsupported_op_fix(op)));
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
            return Err(missing_field(op, field, target));
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
        Some(Value::String(s)) => Some(Position::parse(s).ok_or_else(|| invalid_position(s))?),
        Some(other) => return Err(invalid_position(&other.to_string())),
    };

    Ok(PatchOp {
        op,
        path,
        from: optional_string(object, "from")?,
        through: optional_string(object, "through")?,
        value: object.get("value").cloned(),
        position,
        to_page: optional_string(object, "to_page")?,
        label: optional_string(object, "label")?,
        at_text: optional_string(object, "at_text")?,
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
        (OpKind::Add, "label") if target == PatchTarget::CourseSettings => None,
        (OpKind::Replace, "position") => {
            Some("replace edits the thing at path in place; use move to relocate it")
        }
        (OpKind::Remove, "value") => Some("remove takes no value"),
        (OpKind::Merge, "through") => {
            Some("merge joins one block (from) into the block before it (path)")
        }
        _ => None,
    };
    let mut accepted: Vec<&str> = vec!["op", "path"];
    accepted.extend_from_slice(required);
    accepted.extend_from_slice(optional);
    let mut error = EditError::new(
        EditErrorCode::FieldNotAllowed,
        format!(
            "{} doesn't take \"{field}\"{}",
            op.as_str(),
            hint.map(|h| format!("; {h}")).unwrap_or_default()
        ),
    )
    .with_fix(format!("{} takes: {}", op.as_str(), accepted.join(", ")));
    if field == "label" && op == OpKind::Add {
        error = error.with_fix("put \"label\" inside each value item: {\"op\":\"add\",...,\"value\":{\"label\":\"$x\",...}}");
    }
    error
}

fn missing_field(op: OpKind, field: &str, target: PatchTarget) -> EditError {
    let fix = match (op, field) {
        (OpKind::Add, "position") if target == PatchTarget::PageContent => {
            "position is before/after a sibling (\"path\":\"/p2\") or start/end of a children list (\"path\":\"/box1/innerBlocks\" or \"\" for the page)".to_string()
        }
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
        format!("{} needs \"{field}\"", op.as_str()),
    )
    .with_fix(fix)
}

fn invalid_position(given: &str) -> EditError {
    EditError::new(
        EditErrorCode::NumericIndex,
        format!("position {given} isn't supported; numeric indexes and \"-\" are rejected"),
    )
    .with_fix("position is \"before\" or \"after\" a sibling at path, or \"start\" or \"end\" of the children list at path, e.g. {\"path\":\"/box1/innerBlocks\",\"position\":\"end\"}")
    .with_details(json!({"positions": ["before", "after", "start", "end"]}))
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

    fn parse_one(op: Value, target: PatchTarget) -> Result<PatchOp, EditError> {
        parse_ops(&[op], target).map(|mut ops| ops.remove(0))
    }

    #[test]
    fn parses_a_full_move() {
        let op = parse_one(
            json!({"op":"move","from":"/p5","through":"/p9","to_page":"pg2","path":"/h1","position":"after"}),
            PatchTarget::PageContent,
        )
        .unwrap();
        assert_eq!(op.op, OpKind::Move);
        assert_eq!(op.position, Some(Position::After));
        assert_eq!(op.through.as_deref(), Some("/p9"));
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
        assert_eq!(op.value, Some(Value::Null));
    }
}
