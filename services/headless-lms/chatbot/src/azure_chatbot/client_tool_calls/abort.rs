//! Why a suspended tool call is closed without ever being carried out, and the text the model
//! reads for it.

use crate::chatbot_tools::ClientToolCallRefusal;
use crate::prelude::*;

/// Why a tool call's output was written without running the call.
pub(crate) enum ToolCallAbortReason {
    /// The turn that made this call died; a later request is repairing it.
    Hanging,
    /// The learner sent a new message instead of answering it.
    Replaced,
    /// The caller may not make this call: either they never could, or the roles that let them
    /// were changed while it waited for the client.
    NotAuthorized,
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
            Self::NotAuthorized => {
                "The tool call was aborted and returned no data, because the user is not allowed to use this tool on what the call named. Do not call this tool again in this conversation. Answer without it, or tell the user that you cannot do that step for them."
            }
            Self::CategoryDisabled => {
                "The tool call was aborted and returned no data, because this chatbot no longer offers this kind of tool: its configuration changed while the call was waiting for them. Do not call this tool again in this conversation. Answer without it, or tell the user that you cannot do that step for them."
            }
        }
    }
}

/// The output the model reads for a call `check_client_tool_call` refused.
///
/// The refusal is checked both when the server plans to suspend on a call and when a client's
/// answer to one arrives, since nothing bounds how long a call waits and a role or a
/// configuration can change while it does.
pub(crate) fn refused_call_output(refusal: ClientToolCallRefusal, tool_name: &str) -> &'static str {
    match refusal {
        ClientToolCallRefusal::NotAuthorized => {
            warn!(
                tool_name,
                "Aborting a chatbot tool call: its caller is not allowed to make it"
            );
            ToolCallAbortReason::NotAuthorized.model_output()
        }
        ClientToolCallRefusal::CategoryDisabled => {
            warn!(
                tool_name,
                "Aborting a chatbot tool call: its category is no longer enabled on the chatbot configuration"
            );
            ToolCallAbortReason::CategoryDisabled.model_output()
        }
    }
}
