//! The `guide` tool: block schemas from the CMS and the hand-written topics.

use async_trait::async_trait;

use crate::guide;
use crate::state::McpState;
use crate::tools::args::GuideArgs;
use crate::tools::{RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult};

/// Handler of the `guide` tool.
pub struct Guide;

#[async_trait(?Send)]
impl ToolHandler<McpState> for Guide {
    type Args = GuideArgs;

    async fn call(
        &self,
        state: &McpState,
        _: &RequestContext,
        args: GuideArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let block_types = args.block_types.unwrap_or_default();
        let topics = args.topics.unwrap_or_default();
        let schemas = if block_types.is_empty() && !topics.is_empty() {
            None
        } else {
            Some(state.block_schemas().await?)
        };
        Ok(ToolResult::success(guide::answer(schemas.as_deref(), &block_types, &topics)?).into())
    }
}
