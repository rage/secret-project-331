//! Why a suspended tool call is closed without ever being carried out, and the text the model
//! reads for it.

use crate::chatbot_error::ChatbotResult;
use crate::chatbot_tools::tool_permission::ToolPermission;
use crate::prelude::*;
use crate::user_context::ChatbotTurnContext;
use headless_lms_models::chatbot_configurations::ToolCategory;

/// Why a tool call's output was written without running the call.
pub(crate) enum ToolCallAbortReason {
    /// The turn that made this call died; a later request is repairing it.
    Hanging,
    /// The learner sent a new message instead of answering it.
    Replaced,
    /// The permission this call needed was revoked while it waited for the client.
    PermissionRevoked,
    /// The category this call's tool belongs to was disabled on the configuration while it
    /// waited for the client.
    CategoryDisabled,
}

impl ToolCallAbortReason {
    /// The output the model reads for a call closed this way.
    ///
    /// Prompt text: keep every variant byte-identical, or the model's behavior on seeing it changes.
    pub(crate) fn model_output(&self) -> &'static str {
        match self {
            Self::Hanging => "Unexpected error encountered, tool call aborted.",
            Self::Replaced => {
                "The user sent a new message instead of answering this tool call, so it was never carried out and returned no data. Answer their new message; ask again only if you still need this."
            }
            Self::PermissionRevoked => {
                "The tool call was aborted and returned no data, because the user is no longer allowed to use this tool: their permissions changed while the call was waiting for them. Do not call this tool again in this conversation. Answer without it, or tell the user that you cannot do that step for them."
            }
            Self::CategoryDisabled => {
                "The tool call was aborted and returned no data, because this chatbot no longer offers this kind of tool: its configuration changed while the call was waiting for them. Do not call this tool again in this conversation. Answer without it, or tell the user that you cannot do that step for them."
            }
        }
    }
}

/// The abort output for `tool_name`, if `permission` no longer holds for `user_context` — checked
/// both when the server plans to run a call and when a client's answer to one arrives, since
/// nothing bounds how long a call waits and a role can be revoked while it does.
pub(crate) async fn permission_revoked_output(
    conn: &mut PgConnection,
    user_context: &ChatbotTurnContext,
    permission: ToolPermission,
    tool_name: &str,
) -> ChatbotResult<Option<&'static str>> {
    if permission.is_satisfied_by(conn, user_context).await? {
        return Ok(None);
    }
    warn!(
        tool_name,
        "Aborting a chatbot tool call: its caller no longer holds the permission it requires"
    );
    Ok(Some(ToolCallAbortReason::PermissionRevoked.model_output()))
}

/// The abort output for `tool_name`, if `category` is no longer enabled on `user_context`'s
/// configuration — the same staleness window as [permission_revoked_output], for the
/// configuration-scoped half of a tool's gate rather than the caller-scoped half.
pub(crate) fn category_disabled_output(
    user_context: &ChatbotTurnContext,
    category: ToolCategory,
    tool_name: &str,
) -> Option<&'static str> {
    if user_context.enabled_tool_categories.contains(category) {
        return None;
    }
    warn!(
        tool_name,
        "Aborting a chatbot tool call: its category is no longer enabled on the chatbot configuration"
    );
    Some(ToolCallAbortReason::CategoryDisabled.model_output())
}
