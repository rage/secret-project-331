//! The tool handler trait and the registry dispatch looks tools up in.

use async_trait::async_trait;
use indexmap::IndexMap;
use schemars::JsonSchema;
use serde::de::DeserializeOwned;
use serde_json::{Map, Value};

use super::catalog::ToolDefinition;
use super::{McpPrincipal, RequestContext, ToolError, ToolOutcome};

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
    /// A registry listing `tools` in the given order.
    pub fn new(tools: Vec<Tool<S>>) -> Self {
        Self {
            tools: tools
                .into_iter()
                .map(|tool| (tool.definition.name, tool))
                .collect(),
        }
    }

    /// The tool called `name`, without a scope check; [`Self::listings_for`] lists what a principal may call.
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
