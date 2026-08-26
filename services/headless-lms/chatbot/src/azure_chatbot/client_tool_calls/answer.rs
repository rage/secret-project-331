//! Turning a client's answer to a suspended tool call into the output that resumes the turn.

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_conversation_message_tool_calls::{
    self, ChatbotConversationMessageToolCall,
};

use super::abort::{category_disabled_output, permission_revoked_output};
use crate::chatbot_error::ChatbotResult;
use crate::chatbot_tools::tool_permission::ToolPermission;
use crate::chatbot_tools::{
    ClientToolAnswer, client_tool_answer_output, client_tool_gate, execute_action_tool,
    tool_is_confirmable_action,
};
use crate::prelude::*;
use crate::user_context::ChatbotTurnContext;
use headless_lms_models::chatbot_configurations::ToolCategory;

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

    let Some(gate) = client_tool_gate(&tool_call.tool_name) else {
        return Err(chatbot_err!(
            InvalidToolAnswer,
            format!("Tool call {tool_call_id} is not one a client answers")
        ));
    };

    apply_client_tool_answer(
        conn,
        app_config,
        tool_call,
        gate.category,
        gate.permission,
        answer,
        user_context,
    )
    .await
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

/// The tool output a client's answer to `tool_call` amounts to, given `permission`, the permission
/// the tool requires.
///
/// The permission is checked again here rather than trusted from the moment the call was offered:
/// nothing bounds how long a call waits, so a role can be revoked while it does. One that no
/// longer holds aborts the call with an explanation for the model instead of applying the answer,
/// because the turn stays stuck until its call has some output.
async fn apply_client_tool_answer(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    tool_call: &ChatbotConversationMessageToolCall,
    category: ToolCategory,
    permission: ToolPermission,
    answer: &ClientToolAnswer,
    user_context: &ChatbotTurnContext,
) -> ChatbotResult<AnsweredClientToolCall> {
    if let Some(output) = category_disabled_output(user_context, category, &tool_call.tool_name) {
        return Ok(AnsweredClientToolCall {
            output: output.to_string(),
            client_answer: None,
            execution_payload: None,
        });
    }

    if let Some(output) =
        permission_revoked_output(conn, user_context, permission, &tool_call.tool_name).await?
    {
        return Ok(AnsweredClientToolCall {
            output: output.to_string(),
            client_answer: None,
            execution_payload: None,
        });
    }

    if tool_is_confirmable_action(&tool_call.tool_name) {
        // `GlobalAdmin` (the only permission an action tool can require) implies a user id; the
        // permission check above already re-verified the caller still holds it.
        let acting_user_id = user_context.user_id.ok_or_else(|| {
            chatbot_err!(
                ToolUseError,
                "An action tool was confirmed by a caller with no user id.".to_string()
            )
        })?;

        // Exactly-once guard: locks the call row for the rest of this transaction and refuses if
        // it was already answered, so two concurrent confirms cannot both execute the mutation.
        chatbot_conversation_message_tool_calls::lock_unanswered_for_execution(conn, tool_call.id)
            .await?;

        let outcome = execute_action_tool(
            conn,
            app_config,
            &tool_call.tool_name,
            &tool_call.arguments_json(),
            tool_call.id,
            answer,
            acting_user_id,
            &user_context.enabled_tool_categories,
        )
        .await?;
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
        roles::UserRole,
        test_helper::{Conn, init_app_conf},
    };

    use super::*;
    use crate::azure_chatbot::client_tool_calls::abort::ToolCallAbortReason;
    use crate::chatbot_tools::{
        ChatbotToolDeclaration,
        client_tools::ask_multiple_choice_question::AskMultipleChoiceQuestionTool,
        tool_permission::test_helpers::{context, course_role},
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

    /// Exercises `apply_client_tool_answer`'s abort branch directly with `TeachesCourse`, a
    /// permission stronger than the one this tool actually declares: today's only registered
    /// client tool requires `Anyone`, which can never fail this check through the real call path,
    /// so this only proves the mechanism works for a future tool that requires more.
    #[tokio::test]
    async fn apply_client_tool_answer_aborts_when_the_permission_is_not_satisfied() {
        insert_data!(:tx, :user, :org, :course);
        let revoked = context(Some(user), Some(course), Vec::new());
        let app_config = init_app_conf().expect("Application Configuration initialization failed");

        let aborted = apply_client_tool_answer(
            tx.as_mut(),
            &app_config,
            &recorded_question(),
            ToolCategory::Interaction,
            ToolPermission::TeachesCourse,
            &picked_the_second_choice(),
            &revoked,
        )
        .await
        .expect("the call is aborted rather than failed");

        assert_eq!(
            aborted.output,
            ToolCallAbortReason::PermissionRevoked.model_output()
        );
        assert_eq!(aborted.client_answer, None);
    }

    #[tokio::test]
    async fn an_answer_from_a_caller_who_still_holds_the_permission_is_applied() {
        insert_data!(:tx, :user, :org, :course);
        let teacher = context(
            Some(user),
            Some(course),
            vec![course_role(user, course, UserRole::Teacher)],
        );
        let app_config = init_app_conf().expect("Application Configuration initialization failed");

        let applied = apply_client_tool_answer(
            tx.as_mut(),
            &app_config,
            &recorded_question(),
            ToolCategory::Interaction,
            ToolPermission::TeachesCourse,
            &picked_the_second_choice(),
            &teacher,
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
