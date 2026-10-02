//! Turning a client's answer to a suspended tool call into the output that resumes the turn.

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_conversation_message_tool_calls::{
    self, ChatbotConversationMessageToolCall,
};

use super::abort::refused_call_output;
use crate::chatbot_error::ChatbotResult;
use crate::chatbot_tools::{
    ClientToolAnswer, check_client_tool_call, client_tool_answer_output, execute_action_tool,
    tool_is_answered_by_client, tool_is_confirmable_action,
};
use crate::prelude::*;
use crate::user_context::ChatbotTurnContext;

/// What a client's answer to a suspended call amounts to once it is applied.
pub(crate) struct AnsweredClientToolCall {
    /// The tool output the resumed turn reads.
    pub(crate) output: String,
    /// The payload the client sent, or None when the call was aborted instead of answered.
    pub(crate) client_answer: Option<serde_json::Value>,
    /// Data for the confirming admin's browser only, from a confirmed action tool's execution.
    /// Never persisted; carried out of band as an `ActionExecuted` stream event.
    pub(crate) execution_payload: Option<serde_json::Value>,
}

/// Turns a client's answer to a suspended call into the tool output that resumes the turn.
///
/// `unanswered` are the conversation's calls that have no output, which is where the answered call
/// has to be found: an answered call carries a failure output written at stream time, and building
/// an output for it re-parses arguments that were already refused, failing the request as a server
/// fault instead of telling the client the call is closed. `answer_client_tool_call` decides the
/// same thing again under the conversation lock; this only decides which error the client sees.
///
/// Fails with [ChatbotErrorType::InvalidToolAnswer] when `conversation_id` has no such call, the
/// call has already been answered, or the call is not one a client answers, all of which the
/// client got wrong.
pub(crate) async fn client_tool_output_for_answer(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    conversation_id: Uuid,
    unanswered: &[ChatbotConversationMessageToolCall],
    tool_call_id: &str,
    answer: &ClientToolAnswer,
    user_context: &ChatbotTurnContext,
) -> ChatbotResult<AnsweredClientToolCall> {
    let Some(tool_call) = unanswered
        .iter()
        .find(|call| call.tool_call_id == tool_call_id)
    else {
        return Err(missing_tool_call_error(conn, conversation_id, tool_call_id).await?);
    };

    if !tool_is_answered_by_client(&tool_call.tool_name) {
        return Err(chatbot_err!(
            InvalidToolAnswer,
            format!("Tool call {tool_call_id} is not one a client answers")
        ));
    }

    apply_client_tool_answer(conn, app_config, tool_call, answer, user_context).await
}

/// Why a call the client wants to answer is not among the conversation's unanswered ones: it
/// already has an output, or the conversation never had it.
async fn missing_tool_call_error(
    conn: &mut PgConnection,
    conversation_id: Uuid,
    tool_call_id: &str,
) -> ChatbotResult<ChatbotError> {
    let exists =
        models::chatbot_conversation_message_tool_calls::get_by_conversation_and_tool_call_id(
            conn,
            conversation_id,
            tool_call_id,
        )
        .await?
        .is_some();
    Ok(if exists {
        chatbot_err!(
            InvalidToolAnswer,
            format!("Tool call {tool_call_id} has already been answered")
        )
    } else {
        chatbot_err!(
            InvalidToolAnswer,
            format!("Chatbot conversation {conversation_id} has no tool call {tool_call_id}")
        )
    })
}

/// The tool output a client's answer to `tool_call` amounts to.
///
/// The call is authorized again here rather than trusted from the moment it was offered: nothing
/// bounds how long a call waits, so a role or the configuration can change while it does. A call
/// the caller may no longer make is aborted with an explanation for the model instead of having
/// its answer applied, because the turn stays stuck until its call has some output.
async fn apply_client_tool_answer(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    tool_call: &ChatbotConversationMessageToolCall,
    answer: &ClientToolAnswer,
    user_context: &ChatbotTurnContext,
) -> ChatbotResult<AnsweredClientToolCall> {
    if let Err(refusal) = check_client_tool_call(
        conn,
        user_context,
        &tool_call.tool_name,
        &tool_call.arguments_json(),
    )
    .await?
    {
        return Ok(AnsweredClientToolCall {
            output: refused_call_output(refusal, &tool_call.tool_name).to_string(),
            client_answer: None,
            execution_payload: None,
        });
    }

    if tool_is_confirmable_action(&tool_call.tool_name) {
        // Exactly-once guard: locks the call row for the rest of this transaction and refuses if
        // it was already answered, so two concurrent confirms cannot both execute the mutation.
        chatbot_conversation_message_tool_calls::lock_unanswered_for_execution(conn, tool_call.id)
            .await?;

        let outcome =
            execute_action_tool(conn, app_config, tool_call, answer, user_context).await?;
        let ClientToolAnswer::Data { result } = answer;
        return Ok(AnsweredClientToolCall {
            output: outcome.output,
            client_answer: Some(result.clone()),
            execution_payload: outcome.client_payload,
        });
    }

    let output =
        client_tool_answer_output(&tool_call.tool_name, &tool_call.arguments_json(), answer)?;
    let ClientToolAnswer::Data { result } = answer;
    Ok(AnsweredClientToolCall {
        output,
        client_answer: Some(result.clone()),
        execution_payload: None,
    })
}

/// An answer the conversation has no room for is the client's mistake and has to reach it as a
/// client error instead of as a failed turn. Everything else stays a server fault.
pub(crate) fn rejected_tool_answer_error(error: ModelError) -> ChatbotError {
    match error.error_type() {
        ModelErrorType::RecordNotFound | ModelErrorType::InvalidRequest => {
            let message = error.message().to_string();
            chatbot_err!(InvalidToolAnswer, message, error)
        }
        _ => ChatbotError::from(error),
    }
}

#[cfg(test)]
mod tests {
    use headless_lms_models::{
        chatbot_conversation_message_tool_calls::ToolKind,
        insert_data,
        test_helper::{Conn, init_app_conf},
    };

    use super::*;
    use crate::azure_chatbot::client_tool_calls::abort::ToolCallAbortReason;
    use crate::chatbot_tools::{
        ChatbotToolDeclaration,
        client_tools::ask_multiple_choice_question::AskMultipleChoiceQuestionTool,
        tool_authorization::test_helpers::{context, context_with_categories},
    };

    /// A recorded call to the multiple choice tool, as the suspending turn wrote it: with the
    /// argument text the model produced rather than with the object it parses into.
    fn recorded_question() -> ChatbotConversationMessageToolCall {
        ChatbotConversationMessageToolCall {
            tool_name: <AskMultipleChoiceQuestionTool as ChatbotToolDeclaration>::NAME.to_string(),
            tool_arguments: serde_json::Value::String(
                r#"{"question":"Which loop?","choices":["while","for"]}"#.to_string(),
            ),
            tool_call_id: "call_1".to_string(),
            tool_kind: ToolKind::ClientTool,
            response_id: "resp_1".to_string(),
            ..Default::default()
        }
    }

    fn picked_the_second_choice() -> ClientToolAnswer {
        ClientToolAnswer::Data {
            result: serde_json::json!({ "choice_index": 1 }),
        }
    }

    /// The abort branch: a call whose category the configuration no longer offers is closed with
    /// an explanation for the model instead of having its answer applied. The only registered
    /// client tool requires nothing of its caller, so the category is what this can vary.
    #[tokio::test]
    async fn apply_client_tool_answer_aborts_a_call_the_caller_can_no_longer_make() {
        insert_data!(:tx, :user, :org, :course);
        let no_categories = context_with_categories(Some(user), Some(course), Vec::new(), &[]);
        let app_config = init_app_conf().expect("Application Configuration initialization failed");

        let aborted = apply_client_tool_answer(
            tx.as_mut(),
            &app_config,
            &recorded_question(),
            &picked_the_second_choice(),
            &no_categories,
        )
        .await
        .expect("the call is aborted rather than failed");

        assert_eq!(
            aborted.output,
            ToolCallAbortReason::CategoryDisabled.model_output()
        );
        assert_eq!(aborted.client_answer, None);
    }

    #[tokio::test]
    async fn an_answer_from_a_caller_who_may_still_make_the_call_is_applied() {
        insert_data!(:tx, :user, :org, :course);
        let learner = context(Some(user), Some(course), Vec::new());
        let app_config = init_app_conf().expect("Application Configuration initialization failed");

        let applied = apply_client_tool_answer(
            tx.as_mut(),
            &app_config,
            &recorded_question(),
            &picked_the_second_choice(),
            &learner,
        )
        .await
        .expect("the answer is applied");

        assert!(applied.output.contains("\"for\""), "{}", applied.output);
        assert_eq!(
            applied.client_answer,
            Some(serde_json::json!({ "choice_index": 1 }))
        );
    }
}
