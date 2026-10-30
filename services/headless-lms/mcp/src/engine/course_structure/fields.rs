//! The fields ops may set on modules, chapters and pages, and their value checks.

use chrono::{DateTime, Utc};
use serde_json::Value;

use super::model::Kind;
use crate::engine::course_settings::EDITABLE_MODULE_FIELDS;
use crate::engine::error::{EditError, EditErrorCode};
use crate::engine::non_empty_string;

/// Module fields ops may set.
pub(crate) const MODULE_FIELDS: [&str; 1] = ["name"];
/// Chapter fields ops may set.
pub(crate) const CHAPTER_FIELDS: [&str; 4] = ["name", "color", "opens_at", "deadline"];
/// Page fields ops may set.
pub(crate) const PAGE_FIELDS: [&str; 3] = ["title", "url_path", "hidden"];
/// Ids and fields the server sets from the order and nesting of the tree.
pub(crate) const DERIVED_FIELDS: [&str; 7] = [
    "id",
    "chapter_number",
    "order_number",
    "course_module_id",
    "chapter_id",
    "front_page_id",
    "default",
];
/// Page fields computed from the page's content and its students' activity.
pub(crate) const COUNT_FIELDS: [&str; 3] = ["block_count", "exercise_count", "has_submissions"];

impl Kind {
    /// The fields ops may set.
    pub(super) fn editable_fields(self) -> &'static [&'static str] {
        match self {
            Kind::Module => &MODULE_FIELDS,
            Kind::Chapter => &CHAPTER_FIELDS,
            Kind::Page => &PAGE_FIELDS,
        }
    }
}

pub(super) fn check_field(kind: Kind, field: &str) -> Result<(), EditError> {
    if kind.editable_fields().contains(&field) {
        Ok(())
    } else {
        Err(field_error(kind, field))
    }
}

/// Why `field` can't be set on a `kind`, teaching where it changes instead.
pub(super) fn field_error(kind: Kind, field: &str) -> EditError {
    if DERIVED_FIELDS.contains(&field) {
        let fix = match field {
            "chapter_number" | "order_number" => {
                "change the order with move or reorder; numbers follow the order"
            }
            "course_module_id" => "move the chapter into another module's chapters list",
            "chapter_id" => "move the page into another chapter's pages list",
            "front_page_id" => {
                "move a page to the start of the chapter's pages to make it the front page"
            }
            _ => "ids and derived values are set by the server",
        };
        return EditError::new(
            EditErrorCode::DerivedField,
            format!("{field} is derived and can't be set"),
        )
        .with_fix(fix);
    }
    if COUNT_FIELDS.contains(&field) {
        return EditError::new(
            EditErrorCode::ReadOnlyField,
            format!("{field} is computed from the page's content"),
        );
    }
    if kind == Kind::Module && EDITABLE_MODULE_FIELDS.contains(&field) {
        return EditError::new(
            EditErrorCode::WrongTool,
            format!("module {field} is a setting; change it with patch_course_settings"),
        );
    }
    if matches!(field, "content" | "blocks") && kind == Kind::Page {
        return EditError::new(
            EditErrorCode::WrongTool,
            "page content is edited with patch_page_content",
        );
    }
    unknown_field(kind, field)
}

pub(super) fn unknown_field(kind: Kind, field: &str) -> EditError {
    EditError::new(
        EditErrorCode::UnknownField,
        format!("a {} has no editable field \"{field}\"", kind.noun()),
    )
    .with_fix(format!(
        "{} fields: {}",
        kind.noun(),
        kind.editable_fields().join(", ")
    ))
}

/// `value` as a non-empty string; `field` names it when null, `what` otherwise.
pub(super) fn required_text(value: Value, field: &str, what: &str) -> Result<String, EditError> {
    match value {
        Value::Null => Err(not_nullable(field)),
        value => non_empty_string(Some(&value), what),
    }
}

pub(super) fn not_nullable(field: &str) -> EditError {
    EditError::new(
        EditErrorCode::InvalidValue,
        format!("{field} can't be empty"),
    )
    .with_fix(format!("replace {field} with a new value instead"))
}

pub(super) fn optional_color(value: Option<&Value>) -> Result<Option<String>, EditError> {
    match value {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(color)) if is_hex_color(color) => Ok(Some(color.to_uppercase())),
        Some(_) => Err(EditError::new(
            EditErrorCode::InvalidValue,
            "color is a hex colour like \"#1F6964\", or null",
        )),
    }
}

pub(super) fn is_hex_color(color: &str) -> bool {
    color.len() == 7 && color.starts_with('#') && color[1..].chars().all(|c| c.is_ascii_hexdigit())
}

pub(super) fn optional_date(
    value: Option<&Value>,
    field: &str,
) -> Result<Option<DateTime<Utc>>, EditError> {
    match value {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(raw)) => DateTime::parse_from_rfc3339(raw)
            .map(|d| Some(d.with_timezone(&Utc)))
            .map_err(|_| {
                EditError::new(
                    EditErrorCode::InvalidValue,
                    format!("{field} is an RFC 3339 time like \"2027-02-01T08:00:00Z\", or null"),
                )
            }),
        Some(_) => Err(EditError::new(
            EditErrorCode::InvalidValue,
            format!("{field} is a time string or null"),
        )),
    }
}
