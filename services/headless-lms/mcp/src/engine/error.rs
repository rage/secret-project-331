use serde::Serialize;
use serde_json::Value;

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
    PageNotLoaded,
    InvariantViolated,
    ExpectedCountMismatch,
    InvalidRegex,
    ReorderMismatch,
    CitationKey,
    InvalidBibtex,
    DuplicateTerm,
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
    pub fn new(code: EditErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            op: None,
            fix: None,
            details: None,
        }
    }

    pub fn with_fix(mut self, fix: impl Into<String>) -> Self {
        self.fix = Some(fix.into());
        self
    }

    pub fn with_details(mut self, details: Value) -> Self {
        self.details = Some(details);
        self
    }

    /// Attributes the error to op `index` unless an inner step already did.
    pub fn at_op(mut self, index: usize) -> Self {
        self.op.get_or_insert(index);
        self
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
    /// Content still mentions something the call removed or renamed.
    StillReferenced,
}
