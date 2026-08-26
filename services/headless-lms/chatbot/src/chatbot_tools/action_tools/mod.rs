//! The confirm-and-execute primitive: a client tool whose confirmed answer runs a privileged
//! mutation on the server instead of only rendering data the client already had.
//!
//! [ClientChatbotTool](crate::chatbot_tools::ClientChatbotTool) cannot carry this: its
//! `parse_response`/`output` are synchronous and get no [PgConnection], no
//! [ApplicationConfiguration] and no acting-user id. [ConfirmableActionTool] is the one place that
//! threads those in, so every action tool gets the same confirm-parsing, exactly-once guard,
//! transaction handling and audit write instead of a hand-rolled copy each.

use serde::Deserialize;
use sqlx::PgConnection;
use uuid::Uuid;

pub mod reset_exercises;

use headless_lms_base::config::ApplicationConfiguration;

use crate::chatbot_tools::ChatbotToolDeclaration;
use crate::prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult, chatbot_err};

pub mod edit_user_account;
pub mod generate_password_reset_link;
pub mod update_cheating_status;

/// The one answer shape every action tool accepts.
#[derive(Deserialize)]
pub struct ConfirmAnswer {
    pub confirmed: bool,
}

/// What executing a confirmed action produced.
pub struct ExecutedAction {
    /// Model-facing description of what happened. Never contains secrets.
    pub output: String,
    /// Data for the confirming admin's browser only (e.g. the reset link). Sent as a stream
    /// event, never persisted, never shown to the model.
    pub client_payload: Option<serde_json::Value>,
    /// What the audit row records about the action's target and effect.
    pub audit: ActionAuditFields,
}

/// What the audit row records about a confirmed action, beyond who ran it and what tool it was.
pub struct ActionAuditFields {
    pub target_user_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    /// One human-readable sentence, e.g. "Reset 3 exercises for jane@example.com in Course X".
    /// Must never contain secrets: this is stored in `chatbot_action_logs`.
    pub summary: String,
}

/// A client tool whose confirmed answer performs a privileged mutation on the server.
///
/// Suspends the turn like [ClientChatbotTool](crate::chatbot_tools::ClientChatbotTool); the
/// client answers with [ConfirmAnswer]. A declined answer produces [Self::declined_output]
/// without touching the database. A confirmed answer runs [Self::execute] inside the same
/// transaction as the audit insert and the recorded tool output, guarded by
/// `lock_unanswered_for_execution` so it can run at most once.
pub trait ConfirmableActionTool: ChatbotToolDeclaration {
    type Arguments;

    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments>;

    /// Performs the mutation. Must re-verify every model-supplied display field against the
    /// database (case-insensitively for emails) and refuse with a descriptive error rather than
    /// mutate on a mismatch, so a wrong or stale display can never mutate a row it doesn't
    /// describe. `acting_user_id` is the confirming admin.
    fn execute(
        conn: &mut PgConnection,
        app_config: &ApplicationConfiguration,
        arguments: &Self::Arguments,
        acting_user_id: Uuid,
    ) -> impl std::future::Future<Output = ChatbotResult<ExecutedAction>> + Send;

    fn declined_output(_arguments: &Self::Arguments) -> String {
        "The admin declined the action. Nothing was changed. Do not retry unless asked to."
            .to_string()
    }

    fn output_description_instructions() -> Option<String>;
}

/// Unicode-aware case-insensitive equality for a model-supplied display field against its
/// current database value. `eq_ignore_ascii_case` would reject a match for cased letters outside
/// ASCII (e.g. Finnish å/Ö) that differ only in case, spuriously refusing a genuine match.
pub fn display_field_matches(actual: &str, supplied: &str) -> bool {
    actual.to_lowercase() == supplied.to_lowercase()
}

/// Re-verifies a model-supplied display field against `actual`, per [ConfirmableActionTool::execute]'s
/// contract: refuses with a descriptive error naming `field_name` and `rerun_tool` instead of
/// mutating on a mismatch.
pub fn verify_display_field(
    field_name: &str,
    actual: &str,
    supplied: &str,
    rerun_tool: &str,
) -> ChatbotResult<()> {
    if display_field_matches(actual, supplied) {
        Ok(())
    } else {
        Err(chatbot_err!(
            ToolUseError,
            format!(
                "The {field_name} does not match the current record. Re-run {rerun_tool} and try again."
            )
        ))
    }
}
