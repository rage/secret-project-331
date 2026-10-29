//! Tool trait, registry and the shapes handlers return. Handlers get a [`RequestContext`] and
//! return structured results; the protocol layer turns them into MCP results.

pub mod args;
pub mod catalog;
pub mod schema;

use async_trait::async_trait;
use indexmap::IndexMap;
use schemars::JsonSchema;
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::{Map, Value, json};

use self::catalog::ToolDefinition;
use crate::engine::{EditError, EditErrorCode};
use crate::hints::{Hint, OutdatedSkill};
use crate::protocol::context::ClientContext;
use crate::protocol::progress::ProgressReporter;
use crate::validator::ValidatorError;

pub use headless_lms_models::library::oauth::mcp::{McpPrincipal, McpScope};

/// Echoed state of a confirmation round trip, already verified.
#[derive(Debug, Clone)]
pub struct RetryState {
    /// The client's answers keyed like the input requests (`"confirm"`).
    pub input_responses: Map<String, Value>,
}

impl RetryState {
    /// The action the user took on the confirmation, if any (`accept`, `decline`, `cancel`).
    pub fn confirmation_action(&self) -> Option<&str> {
        self.input_responses
            .get(CONFIRMATION_KEY)?
            .get("action")?
            .as_str()
    }
}

pub(crate) const CONFIRMATION_KEY: &str = "confirm";

/// Everything a handler knows about the request besides its arguments.
pub struct RequestContext {
    pub principal: McpPrincipal,
    pub client: ClientContext,
    pub tool_name: &'static str,
    /// Set when this call is the retry after a confirmation round trip.
    pub retry: Option<RetryState>,
    pub progress: ProgressReporter,
}

impl RequestContext {
    pub fn require_scope(&self, scope: McpScope) -> Result<(), ToolError> {
        if self.principal.has_scope(scope) {
            Ok(())
        } else {
            Err(ToolError::InsufficientScope { required: scope })
        }
    }
}

/// A structured tool result. Hints live inside the structured object because clients drop the
/// text content when structured content is present.
#[derive(Debug, Clone, PartialEq)]
pub struct ToolResult {
    pub structured: Map<String, Value>,
    pub hints: Vec<Hint>,
    pub is_error: bool,
}

impl ToolResult {
    /// `value` must serialize to a JSON object.
    pub fn success(value: impl Serialize) -> Self {
        let structured = match serde_json::to_value(value) {
            Ok(Value::Object(map)) => map,
            Ok(other) => Map::from_iter([("result".to_string(), other)]),
            Err(error) => {
                Map::from_iter([("serialization_error".to_string(), json!(error.to_string()))])
            }
        };
        Self {
            structured,
            hints: Vec::new(),
            is_error: false,
        }
    }

    /// A failed call's result: `{"error": error}`.
    pub fn error(error: Value) -> Self {
        Self {
            structured: Map::from_iter([("error".to_string(), error)]),
            hints: Vec::new(),
            is_error: true,
        }
    }

    pub fn with_hint(mut self, hint: Hint) -> Self {
        self.hints.push(hint);
        self
    }

    pub fn with_hints(mut self, hints: impl IntoIterator<Item = Hint>) -> Self {
        self.hints.extend(hints);
        self
    }

    /// The structured object as sent: the result fields, then `hints`.
    pub fn structured_content(&self) -> Value {
        let mut object = self.structured.clone();
        if !self.hints.is_empty() {
            object.insert("hints".into(), json!(self.hints));
        }
        Value::Object(object)
    }
}

/// A human decision the handler needs before it can finish, such as confirming a risky publish.
#[derive(Debug, Clone)]
pub struct ConfirmationRequest {
    /// Shown to the human.
    pub message: String,
    /// A page on our domain where the human confirms.
    pub url: String,
    pub elicitation_id: String,
    /// Returned instead when the client can't do URL elicitation: the link as text.
    pub fallback: ToolResult,
}

#[derive(Debug, Clone)]
pub enum ToolOutcome {
    Complete(ToolResult),
    NeedsConfirmation(ConfirmationRequest),
}

impl From<ToolResult> for ToolOutcome {
    fn from(result: ToolResult) -> Self {
        ToolOutcome::Complete(result)
    }
}

/// The `code` of an error result, other than an edit rejection's [`EditErrorCode`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    OutdatedSkill,
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
}

#[derive(Debug, thiserror::Error)]
pub enum ToolError {
    /// An edit the engines rejected; shown to the agent with its fix.
    #[error(transparent)]
    Edit(#[from] EditError),
    #[error(transparent)]
    OutdatedSkill(#[from] OutdatedSkill),
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
        code: ErrorCode,
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
    pub fn refused(code: ErrorCode, message: impl Into<String>, details: Value) -> Self {
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
            ToolError::OutdatedSkill(outdated) => (ErrorCode::OutdatedSkill, outdated.message),
            ToolError::InvalidArguments { message } => (ErrorCode::InvalidArguments, message),
            ToolError::NotFound { message } => (ErrorCode::NotFound, message),
            ToolError::Forbidden { message } => (ErrorCode::Forbidden, message),
            ToolError::Retryable {
                message,
                retry_after_seconds,
            } => {
                return json!({"code": ErrorCode::TemporarilyUnavailable, "message": message, "retryable": true, "retry_after_seconds": retry_after_seconds});
            }
            ToolError::StagedStateChanged { message, entities } => {
                return json!({"code": ErrorCode::StagedStateChanged, "message": message, "retryable": true, "entities": entities});
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
                return json!({"code": ErrorCode::InsufficientScope, "required_scope": required.as_str()});
            }
            ToolError::Internal(_) => (
                ErrorCode::InternalError,
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
            ValidatorError::Unavailable { retry_after, .. } => ToolError::Retryable {
                message: "the content validator is unavailable, so nothing was staged; the same call can be retried".into(),
                retry_after_seconds: retry_after.map_or(2, |d| d.as_secs()),
            },
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

/// Runs CPU-heavy pure work, such as an engine pass over every page, on the blocking pool, so that
/// the worker thread keeps serving other requests meanwhile.
pub(crate) async fn off_worker<T: Send + 'static>(
    work: impl FnOnce() -> T + Send + 'static,
) -> Result<T, ToolError> {
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|e| ToolError::Internal(format!("a blocking task failed: {e}")))
}

/// Implements one tool. `S` is the application state the protocol layer passes through, such as
/// the database pool, config and validator client.
#[async_trait(?Send)]
pub trait ToolHandler<S>: Send + Sync {
    /// The tool's arguments; their JSON Schema is the tool's input schema.
    type Args: DeserializeOwned + JsonSchema + 'static;

    /// Whether `call` can answer [`ToolOutcome::NeedsConfirmation`]. Only then does dispatch bind
    /// the call's arguments to a confirmation, which costs a pass over them.
    const ASKS_FOR_CONFIRMATION: bool = false;

    async fn call(
        &self,
        state: &S,
        ctx: &RequestContext,
        args: Self::Args,
    ) -> Result<ToolOutcome, ToolError>;
}

/// A [`ToolHandler`] taking its arguments as JSON, so that one registry holds every tool.
#[async_trait(?Send)]
pub(crate) trait JsonToolHandler<S>: Send + Sync {
    fn asks_for_confirmation(&self) -> bool;

    async fn call_with_json(
        &self,
        state: &S,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError>;
}

#[async_trait(?Send)]
impl<S, H: ToolHandler<S>> JsonToolHandler<S> for H {
    fn asks_for_confirmation(&self) -> bool {
        H::ASKS_FOR_CONFIRMATION
    }

    async fn call_with_json(
        &self,
        state: &S,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args = serde_json::from_value(Value::Object(arguments)).map_err(|e| {
            ToolError::InvalidArguments {
                message: format!("invalid arguments: {e}"),
            }
        })?;
        self.call(state, ctx, args).await
    }
}

/// A tool with its handler.
pub struct Tool<S> {
    pub definition: ToolDefinition,
    pub(crate) handler: Box<dyn JsonToolHandler<S>>,
}

/// The tools in their `tools/list` order.
pub struct ToolRegistry<S> {
    tools: IndexMap<&'static str, Tool<S>>,
}

impl<S> ToolRegistry<S> {
    pub fn new(tools: Vec<Tool<S>>) -> Self {
        Self {
            tools: tools
                .into_iter()
                .map(|tool| (tool.definition.name, tool))
                .collect(),
        }
    }

    pub fn get(&self, name: &str) -> Option<&Tool<S>> {
        self.tools.get(name)
    }

    #[cfg(test)]
    pub fn definitions(&self) -> impl Iterator<Item = &ToolDefinition> {
        self.tools.values().map(|tool| &tool.definition)
    }

    /// The `tools/list` entries of the tools `principal` may call.
    pub fn listings_for(&self, principal: &McpPrincipal) -> Vec<rmcp::model::Tool> {
        self.tools
            .values()
            .filter(|tool| principal.has_scope(tool.definition.scope))
            .map(|tool| tool.definition.listing.clone())
            .collect()
    }
}
