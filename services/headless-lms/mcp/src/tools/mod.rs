//! Tool trait, registry and the shapes handlers return. Handlers get a [`RequestContext`] and
//! return structured results; the protocol layer turns them into MCP results.

pub mod args;
pub mod catalog;
pub mod guide_tool;
pub mod schema;

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use uuid::Uuid;

use crate::engine::EditError;
use crate::hints::{Hint, OutdatedSkill};
use crate::protocol::context::CapabilityContext;
use crate::protocol::progress::ProgressReporter;

/// OAuth scopes. A tool is listed only when the token has its scope.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Scope {
    #[serde(rename = "material:read")]
    MaterialRead,
    #[serde(rename = "material:stage")]
    MaterialStage,
    #[serde(rename = "material:publish")]
    MaterialPublish,
    #[serde(rename = "settings:write")]
    SettingsWrite,
}

impl Scope {
    pub fn as_str(self) -> &'static str {
        match self {
            Scope::MaterialRead => "material:read",
            Scope::MaterialStage => "material:stage",
            Scope::MaterialPublish => "material:publish",
            Scope::SettingsWrite => "settings:write",
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        [
            Scope::MaterialRead,
            Scope::MaterialStage,
            Scope::MaterialPublish,
            Scope::SettingsWrite,
        ]
        .into_iter()
        .find(|s| s.as_str() == raw)
    }
}

/// Who is calling, as established by the OAuth layer.
#[derive(Debug, Clone)]
pub struct Principal {
    pub user_id: Uuid,
    pub scopes: Vec<Scope>,
    pub oauth_client_id: Option<Uuid>,
    pub grant_id: Option<Uuid>,
    /// The OAuth client's display name, for "teacher X via <client>" attribution.
    pub client_name: Option<String>,
}

impl Principal {
    pub fn has_scope(&self, scope: Scope) -> bool {
        self.scopes.contains(&scope)
    }
}

/// Echoed state of a confirmation round trip, already verified.
#[derive(Debug, Clone)]
pub struct RetryState {
    /// The payload the handler put in [`ConfirmationRequest::state`].
    pub state: Value,
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
    pub principal: Principal,
    pub capabilities: CapabilityContext,
    pub tool_name: String,
    /// Set when this call is the retry after a confirmation round trip.
    pub retry: Option<RetryState>,
    pub progress: ProgressReporter,
}

impl RequestContext {
    pub fn require_scope(&self, scope: Scope) -> Result<(), ToolError> {
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
    /// Sealed into `requestState` and handed back on the retry as [`RetryState::state`].
    pub state: Value,
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
        retry_after_seconds: Option<u64>,
    },
    /// The token lacks a scope; answered with an HTTP 403 so the client can step up.
    #[error("this needs the {} scope", required.as_str())]
    InsufficientScope { required: Scope },
    #[error("internal error: {0}")]
    Internal(String),
}

impl ToolError {
    /// The structured body of an `isError` result, or None for errors that become protocol errors.
    pub fn to_result(&self) -> Option<ToolResult> {
        let error = match self {
            ToolError::Edit(edit) => serde_json::to_value(edit).unwrap_or_default(),
            ToolError::OutdatedSkill(outdated) => {
                json!({"code": "outdated_skill", "message": outdated.message})
            }
            ToolError::InvalidArguments { message } => {
                json!({"code": "invalid_arguments", "message": message})
            }
            ToolError::NotFound { message } => json!({"code": "not_found", "message": message}),
            ToolError::Forbidden { message } => json!({"code": "forbidden", "message": message}),
            ToolError::Retryable {
                message,
                retry_after_seconds,
            } => {
                json!({"code": "temporarily_unavailable", "message": message, "retryable": true, "retry_after_seconds": retry_after_seconds})
            }
            ToolError::InsufficientScope { .. } | ToolError::Internal(_) => return None,
        };
        Some(ToolResult {
            structured: Map::from_iter([("error".to_string(), error)]),
            hints: Vec::new(),
            is_error: true,
        })
    }
}

impl From<crate::validator::ValidatorError> for ToolError {
    fn from(error: crate::validator::ValidatorError) -> Self {
        match error {
            crate::validator::ValidatorError::Unavailable { retry_after, .. } => ToolError::Retryable {
                message: "the content validator is unavailable, so nothing was staged; the same call can be retried".into(),
                retry_after_seconds: retry_after.map(|d| d.as_secs()).or(Some(2)),
            },
            rejected @ crate::validator::ValidatorError::Rejected { .. } => ToolError::Internal(rejected.to_string()),
        }
    }
}

/// Implements one tool. `S` is the application state the protocol layer passes through, such as
/// the database pool, config and validator client.
#[async_trait]
pub trait ToolHandler<S: Send + Sync>: Send + Sync {
    async fn call(
        &self,
        state: &S,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError>;
}

/// Placeholder for tools whose database-backed handler isn't registered yet.
pub struct NotImplemented;

#[async_trait]
impl<S: Send + Sync> ToolHandler<S> for NotImplemented {
    async fn call(
        &self,
        _: &S,
        ctx: &RequestContext,
        _: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        Err(ToolError::Internal(format!(
            "{} isn't available on this server yet",
            ctx.tool_name
        )))
    }
}

/// The tools in their fixed `tools/list` order, each with its handler.
pub struct ToolRegistry<S> {
    definitions: Vec<catalog::ToolDefinition>,
    handlers: HashMap<&'static str, Arc<dyn ToolHandler<S>>>,
}

impl<S: Send + Sync + 'static> ToolRegistry<S> {
    /// Every tool from the catalog, all answered by [`NotImplemented`] until registered.
    pub fn with_catalog() -> Self {
        let definitions = catalog::definitions();
        let handlers = definitions
            .iter()
            .map(|d| (d.name, Arc::new(NotImplemented) as Arc<dyn ToolHandler<S>>))
            .collect();
        Self {
            definitions,
            handlers,
        }
    }

    /// Sets the handler for a catalog tool. Panics on a name the catalog doesn't have.
    pub fn register(mut self, name: &str, handler: Arc<dyn ToolHandler<S>>) -> Self {
        let definition = self
            .definitions
            .iter()
            .find(|d| d.name == name)
            .unwrap_or_else(|| panic!("{name} isn't in the tool catalog"));
        self.handlers.insert(definition.name, handler);
        self
    }

    pub fn definitions(&self) -> &[catalog::ToolDefinition] {
        &self.definitions
    }

    pub fn definition(&self, name: &str) -> Option<&catalog::ToolDefinition> {
        self.definitions.iter().find(|d| d.name == name)
    }

    pub fn handler(&self, name: &str) -> Option<Arc<dyn ToolHandler<S>>> {
        self.handlers.get(name).cloned()
    }
}

/// Parses a tool's arguments object into its args struct, with a message the agent can act on.
pub fn parse_arguments<T: for<'de> Deserialize<'de>>(
    arguments: Map<String, Value>,
) -> Result<T, ToolError> {
    serde_json::from_value(Value::Object(arguments)).map_err(|e| ToolError::InvalidArguments {
        message: format!("invalid arguments: {e}"),
    })
}

/// Parses an id argument given as `pg7` or `/pg7`.
pub fn parse_id(raw: &str, what: &str) -> Result<Uuid, ToolError> {
    Uuid::parse_str(raw.trim().trim_start_matches('/')).map_err(|_| ToolError::InvalidArguments {
        message: format!("{what} must be an id (a UUID), got \"{raw}\""),
    })
}
