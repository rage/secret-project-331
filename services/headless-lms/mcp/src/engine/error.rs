//! Errors and warnings of the edit engines.

use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

/// Why an edit was rejected. Serialised as the `code` of a tool error.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EditErrorCode {
    InvalidOp,
    UnknownField,
    MissingField,
    FieldNotAllowed,
    InvalidValue,
    InvalidPath,
    NotFound,
    NumericIndex,
    PositionRequired,
    PositionNeedsChildren,
    PositionNeedsSibling,
    InvalidRange,
    MoveIntoItself,
    LabelInvalid,
    LabelReused,
    LabelUndefined,
    UnknownIds,
    MissingIds,
    DuplicateIds,
    ExerciseReadOnly,
    NotATextBlock,
    TextNotFound,
    TextAmbiguous,
    SplitInsideMarkup,
    MergeNotAdjacent,
    ReadOnlyField,
    DerivedField,
    WrongTool,
    PinnedFrontPage,
    DefaultModule,
    ModuleNotEmpty,
    ChapterNeedsPage,
    DuplicatePath,
    InvalidUrlPath,
    InvariantViolated,
    ExpectedCountMismatch,
    InvalidRegex,
    ReorderMismatch,
    CitationKey,
    InvalidBibtex,
    DuplicateTerm,
    /// A read's value is over the result budget; `details` lists smaller paths to read instead.
    TooLarge,
    /// The CMS validator rejected blocks (`details` lists its errors), or a page outside chapters
    /// would hold exercises or chapter listings.
    InvalidBlocks,
}

/// An edit rejected before anything was staged. Every message names the correct form where one
/// exists, so the agent can resend a fixed call.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct EditError {
    pub code: EditErrorCode,
    pub message: String,
    /// 0-based index of the failing op, when the failure belongs to one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub op: Option<usize>,
    /// The corrected form, e.g. a rewritten op or path.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fix: Option<String>,
    /// Candidates, sibling lists, unknown ids and similar machine-readable context.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

impl EditError {
    /// An error without a fix or details; the builders below add them.
    pub fn new(code: EditErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            op: None,
            fix: None,
            details: None,
        }
    }

    /// Adds the corrected form of the rejected call.
    pub fn with_fix(mut self, fix: impl Into<String>) -> Self {
        self.fix = Some(fix.into());
        self
    }

    /// Adds machine-readable context for the error.
    pub fn with_details(mut self, details: Value) -> Self {
        self.details = Some(details);
        self
    }

    /// Attributes the error to op `index` unless an inner step already did.
    pub fn at_op(mut self, index: usize) -> Self {
        self.op.get_or_insert(index);
        self
    }

    /// `path` addresses an item by position; `items` names what goes by id instead, e.g.
    /// "blocks".
    pub(crate) fn numeric_index(path: &str, items: &str) -> Self {
        Self::new(
            EditErrorCode::NumericIndex,
            format!("\"{path}\" uses a numeric index; {items} are addressed by id"),
        )
    }

    /// A bulk edit found `found` matches where the call expected `expected`; `matches` describes
    /// each one for the agent.
    pub(crate) fn expected_count_mismatch(
        expected: usize,
        found: usize,
        matches: Vec<Value>,
    ) -> Self {
        Self::new(
            EditErrorCode::ExpectedCountMismatch,
            format!("expected {expected} matches but found {found}; nothing was changed"),
        )
        .with_details(json!({ "matches": matches }))
    }

    /// An op that places items came without `position`; `fix` shows where items can go.
    pub(crate) fn position_required(fix: &str) -> Self {
        Self::new(
            EditErrorCode::PositionRequired,
            "this op needs \"position\"",
        )
        .with_fix(fix)
    }

    /// A range's `through` (`last`) comes before its start; `siblings` are the list's paths in
    /// order.
    pub(crate) fn reversed_range(first: Uuid, last: Uuid, siblings: Vec<String>) -> Self {
        Self::new(
            EditErrorCode::InvalidRange,
            format!("the range is reversed: /{last} comes before /{first}"),
        )
        .with_fix(format!("swap the ends: from /{last} through /{first}"))
        .with_details(json!({ "siblings_in_order": siblings }))
    }
}

impl std::fmt::Display for EditError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self.op {
            Some(op) => write!(f, "op {op}: {}", self.message)?,
            None => write!(f, "{}", self.message)?,
        }
        if let Some(fix) = &self.fix {
            write!(f, " Fix: {fix}")?;
        }
        Ok(())
    }
}

impl std::error::Error for EditError {}

/// Something the call did that the agent should know about but that didn't stop it.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Warning {
    pub code: WarningCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub op: Option<usize>,
}

impl Warning {
    /// A warning not yet attributed to an op; the engines' apply loops attribute it.
    pub fn new(code: WarningCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            op: None,
        }
    }
}

/// What a [`Warning`] is about.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum WarningCode {
    /// An id sent on a block meant to be new was replaced by a server-assigned one.
    IgnoredClientId,
    /// A copied exercise block got a new exercise with no submissions.
    ExerciseCopied,
    /// A new page in a live course was hidden because it has no content yet.
    NewPageHidden,
    /// A url_path was adjusted to fit the chapter or to be unique.
    UrlPathAdjusted,
    /// An exercise got a deadline of its own, which chapter deadlines are preferred to.
    OwnExerciseDeadline,
    /// An exercise's own deadline is before its chapter opens or after the chapter's deadline.
    DeadlineOutsideChapterWindow,
}
