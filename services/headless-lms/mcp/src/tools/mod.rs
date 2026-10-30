//! Tool trait, registry and the shapes handlers return. Handlers get a [`RequestContext`] and
//! return structured results; the protocol layer turns them into MCP results.

pub mod args;
pub mod catalog;
mod error;
mod handler;
pub mod schema;

use serde::Serialize;
use serde_json::{Map, Value, json};

use crate::hints::Hint;
use crate::protocol::context::ClientContext;
use crate::protocol::progress::ProgressReporter;

pub use error::{ToolError, ToolErrorCode};
pub use handler::{Tool, ToolHandler, ToolRegistry};
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

/// Key of the confirmation in the input requests and responses.
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
    /// Errors with [`ToolError::InsufficientScope`] unless the caller's token has `scope`.
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

    /// Adds one hint to the result.
    pub fn with_hint(mut self, hint: Hint) -> Self {
        self.hints.push(hint);
        self
    }

    /// Adds several hints to the result.
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

/// How a handler call ended.
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

/// Runs CPU-heavy pure work, such as an engine pass over every page, on the blocking pool, so that
/// the worker thread keeps serving other requests meanwhile.
pub(crate) async fn off_worker<T: Send + 'static>(
    work: impl FnOnce() -> T + Send + 'static,
) -> Result<T, ToolError> {
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|e| ToolError::Internal(format!("a blocking task failed: {e}")))
}
