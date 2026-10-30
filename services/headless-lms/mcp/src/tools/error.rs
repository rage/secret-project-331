//! The errors tools return, and how each reaches the agent.

use serde::Serialize;
use serde_json::{Map, Value, json};

use super::{McpScope, ToolResult};
use crate::engine::{EditError, EditErrorCode};
use crate::hints::SkillRefusal;
use crate::validator::ValidatorError;

/// The `code` of an error result, other than an edit rejection's [`EditErrorCode`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolErrorCode {
    OutdatedSkill,
    /// No `skill_version` was sent; the agent asks the teacher about installing the skill.
    SkillMissing,
    InvalidArguments,
    NotFound,
    /// The user's roles don't allow editing the course.
    Forbidden,
    TemporarilyUnavailable,
    StagedStateChanged,
    InsufficientScope,
    InternalError,
    /// Saving the staged changes failed, or the course would break a rule publishing relies on.
    PublishFailed,
    /// Staged entities changed live after they were staged.
    PublishConflict,
    /// The staged pages add exercises of services only administrators may add.
    AdminOnlyExerciseServices,
    /// The changeset isn't at the revision the call gave.
    ChangesetChanged,
    /// Without the entities a partial discard names, the rest couldn't be published.
    DiscardConflict,
    /// Reverting would undo or clash with later changes.
    RevertConflict,
    /// Staged pages lack a page title block or still hold template placeholder text.
    PagesNotReady,
}

/// Why a tool call failed. Mapped to a tool result or a JSON-RPC error by the protocol layer.
#[derive(Debug, thiserror::Error)]
pub enum ToolError {
    /// An edit the engines rejected; shown to the agent with its fix.
    #[error(transparent)]
    Edit(#[from] EditError),
    #[error(transparent)]
    Skill(#[from] SkillRefusal),
    #[error("{message}")]
    InvalidArguments { message: String },
    #[error("{message}")]
    NotFound { message: String },
    /// The user's role doesn't allow this on that course or page.
    #[error("{message}")]
    Forbidden { message: String },
    /// A dependency (validator, storage) is down or busy; the same call can be retried.
    #[error("{message}")]
    Retryable {
        message: String,
        retry_after_seconds: u64,
    },
    /// Another call changed the staged state this call read, so nothing was staged; the call can
    /// be repeated after reading again.
    #[error("{message}")]
    StagedStateChanged {
        message: String,
        /// `{entity_type, entity_id}` of each entity that changed; empty when the whole changeset
        /// closed.
        entities: Vec<Value>,
    },
    /// The call changed nothing because it would break a rule of publishing or reverting; `code`
    /// names the rule and `details` what to fix.
    #[error("{message}")]
    Refused {
        code: ToolErrorCode,
        message: String,
        details: Map<String, Value>,
    },
    /// The token lacks a scope; answered with an HTTP 403 so the client can step up.
    #[error("this needs the {} scope", required.as_str())]
    InsufficientScope { required: McpScope },
    #[error("internal error: {0}")]
    Internal(String),
}

impl ToolError {
    /// The user's roles don't allow editing the course.
    pub fn no_edit_rights() -> Self {
        ToolError::Forbidden {
            message: "Your teacher account doesn't have edit rights on this course. To only read a course on courses.mooc.fi as reference, ask the teacher for its URL and use read_public_course.".to_string(),
        }
    }

    /// A dependency is down or busy; the agent may repeat the same call after
    /// `retry_after_seconds`.
    pub fn retryable(message: impl Into<String>, retry_after_seconds: u64) -> Self {
        ToolError::Retryable {
            message: message.into(),
            retry_after_seconds,
        }
    }

    /// A refusal with `message` when `error` is one; an internal error when the check couldn't be
    /// made.
    pub fn forbidden_or_internal(
        error: headless_lms_authorization::error::AuthorizationError,
        message: impl Into<String>,
    ) -> Self {
        use headless_lms_authorization::error::AuthorizationErrorType;
        use headless_lms_base::error::backend_error::BackendError;
        match error.error_type() {
            AuthorizationErrorType::Forbidden | AuthorizationErrorType::Unauthorized => {
                ToolError::Forbidden {
                    message: message.into(),
                }
            }
            _ => ToolError::Internal(format!("{error:?}")),
        }
    }

    /// A [`ToolError::Refused`] with the fields of `details`, a JSON object.
    pub fn refused(code: ToolErrorCode, message: impl Into<String>, details: Value) -> Self {
        ToolError::Refused {
            code,
            message: message.into(),
            details: match details {
                Value::Object(details) => details,
                _ => Map::new(),
            },
        }
    }

    /// The `error` object of the result the agent gets. Dispatch answers insufficient scopes and
    /// internal errors with protocol errors instead.
    pub fn into_json(self) -> Value {
        let (code, message) = match self {
            ToolError::Edit(edit) => return serde_json::to_value(edit).unwrap_or_default(),
            ToolError::Skill(SkillRefusal::Outdated(message)) => {
                (ToolErrorCode::OutdatedSkill, message)
            }
            ToolError::Skill(SkillRefusal::Missing(message)) => {
                (ToolErrorCode::SkillMissing, message)
            }
            ToolError::InvalidArguments { message } => (ToolErrorCode::InvalidArguments, message),
            ToolError::NotFound { message } => (ToolErrorCode::NotFound, message),
            ToolError::Forbidden { message } => (ToolErrorCode::Forbidden, message),
            ToolError::Retryable {
                message,
                retry_after_seconds,
            } => {
                return json!({"code": ToolErrorCode::TemporarilyUnavailable, "message": message, "retryable": true, "retry_after_seconds": retry_after_seconds});
            }
            ToolError::StagedStateChanged { message, entities } => {
                return json!({"code": ToolErrorCode::StagedStateChanged, "message": message, "retryable": true, "entities": entities});
            }
            ToolError::Refused {
                code,
                message,
                mut details,
            } => {
                details.insert("code".into(), json!(code));
                details.insert("message".into(), json!(message));
                return Value::Object(details);
            }
            ToolError::InsufficientScope { required } => {
                return json!({"code": ToolErrorCode::InsufficientScope, "required_scope": required.as_str()});
            }
            ToolError::Internal(_) => (
                ToolErrorCode::InternalError,
                "Internal error; the call changed nothing".to_string(),
            ),
        };
        json!({"code": code, "message": message})
    }

    /// The `isError` result the agent gets; see [`ToolError::into_json`].
    pub fn into_result(self) -> ToolResult {
        ToolResult::error(self.into_json())
    }
}

impl From<ValidatorError> for ToolError {
    fn from(error: ValidatorError) -> Self {
        match error {
            ValidatorError::Unavailable { retry_after, .. } => ToolError::retryable(
                "the content validator is unavailable, so nothing was staged; the same call can be retried",
                retry_after.map_or(2, |d| d.as_secs()),
            ),
            ValidatorError::TooLarge { .. } => ToolError::InvalidArguments {
                message: "Nothing was staged: the call writes too many or too large blocks for the validator to check at once. Write fewer or smaller blocks per call.".into(),
            },
            ValidatorError::FailedOnInput { message } => ToolError::Edit(
                EditError::new(
                    EditErrorCode::InvalidBlocks,
                    format!("Nothing was staged: the validator failed on these blocks ({message})"),
                )
                .with_fix("check the written blocks against the guide's block reference, or write them in smaller calls to find the one that fails"),
            ),
            rejected @ ValidatorError::Rejected { .. } => ToolError::Internal(rejected.to_string()),
        }
    }
}

impl From<headless_lms_models::ModelError> for ToolError {
    fn from(error: headless_lms_models::ModelError) -> Self {
        use headless_lms_base::error::backend_error::BackendError;
        use headless_lms_models::ModelErrorType;
        match error.error_type() {
            ModelErrorType::RecordNotFound | ModelErrorType::NotFound => ToolError::NotFound {
                message: error.message().to_string(),
            },
            ModelErrorType::PreconditionFailed | ModelErrorType::InvalidRequest => {
                ToolError::InvalidArguments {
                    message: error.message().to_string(),
                }
            }
            _ => ToolError::Internal(format!("{error:?}")),
        }
    }
}

impl From<headless_lms_authorization::error::AuthorizationError> for ToolError {
    fn from(error: headless_lms_authorization::error::AuthorizationError) -> Self {
        ToolError::forbidden_or_internal(error, "Your account isn't allowed to do this.")
    }
}
