//! Answering tool calls that a dead turn left without an output, which the LLM rejects for every
//! later message of the conversation.

use headless_lms_models::chatbot_conversation_message_tool_calls::ChatbotConversationMessageToolCall;
use headless_lms_models::chatbot_conversation_messages::UnansweredToolCallScope;
use tracing::trace;

use super::abort::ToolCallAbortReason;
use crate::chatbot_error::ChatbotResult;
use crate::prelude::*;

/// Repairs the tool calls that the turn this request is itself running left unanswered, whatever
/// their age. `response_ids` names the responses that turn's rounds were given, which is what keeps
/// it off the calls of a turn streaming in another request. Use
/// [answer_stale_unfinished_tool_calls] from a request that made none of them.
pub(crate) async fn answer_unfinished_tool_calls(
    conn: &mut PgConnection,
    conversation_id: Uuid,
    response_ids: &[String],
) -> ChatbotResult<()> {
    if response_ids.is_empty() {
        return Ok(());
    }
    reap_unanswered_tool_calls(
        conn,
        conversation_id,
        UnansweredToolCallScope::OwnTurn(response_ids),
    )
    .await?;
    Ok(())
}

/// How long a tool call must have gone unanswered before a request that did not make it may abort
/// it. A live turn writes a call and its output seconds apart, but a slow search or a reasoning
/// round widens that gap, and aborting inside it leaves two outputs for one `tool_call_id`.
const HANGING_TOOL_CALL_REAP_AFTER_MINUTES: i64 = 10;

/// Repairs tool calls left behind by turns that are long dead, without touching one that a turn
/// streaming in a concurrent request may still be about to answer. Returns the calls it left
/// unanswered.
pub(crate) async fn answer_stale_unfinished_tool_calls(
    conn: &mut PgConnection,
    conversation_id: Uuid,
) -> ChatbotResult<Vec<ChatbotConversationMessageToolCall>> {
    let cutoff = Utc::now() - chrono::Duration::minutes(HANGING_TOOL_CALL_REAP_AFTER_MINUTES);
    reap_unanswered_tool_calls(
        conn,
        conversation_id,
        UnansweredToolCallScope::AnyTurnOlderThan(cutoff),
    )
    .await
}

/// Aborts the conversation's tool calls that have no output and fall within `scope`. Returns the
/// calls it left unanswered.
async fn reap_unanswered_tool_calls(
    conn: &mut PgConnection,
    conversation_id: Uuid,
    scope: UnansweredToolCallScope<'_>,
) -> ChatbotResult<Vec<ChatbotConversationMessageToolCall>> {
    trace!(
        "Dealing with unfinished tool calls for conversation {}",
        conversation_id
    );
    headless_lms_models::chatbot_conversation_messages::answer_hanging_tool_call_messages_for_conversation(
        conn,
        conversation_id,
        scope,
        ToolCallAbortReason::Hanging.model_output(),
    )
    .await
    .map_err(ChatbotError::from)
}
