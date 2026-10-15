//! Building the request one turn sends: the conversation as Azure should replay it, plus the
//! system prompt and the tools the caller may use.

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_configurations::ChatbotConfiguration;
use headless_lms_models::chatbot_configurations_models::{ChatbotConfigurationModel, ModelType};
use headless_lms_models::chatbot_conversation_message_messages::MessageRole;
use headless_lms_models::chatbot_conversation_message_reasoning::ChatbotConversationMessageReasoning;
use headless_lms_models::chatbot_conversation_messages::{ChatbotConversationMessage, Message};

use super::azure::protocol::{
    InputItem, LLMRequest, LLMRequestParams, LLMToolChoice, RequestTextOptions,
};
use super::azure::tools::AzureLLMToolDefinition;
use super::client_tool_calls::abort::ToolCallAbortReason;
use super::search_grounding::build_search_grounding_instruction;
use crate::chatbot_error::ChatbotResult;
use crate::chatbot_tools::provider_tools::azure_ai_search::{
    self, get_azure_ai_search_tool_definition,
};
use crate::chatbot_tools::tool_category::EnabledToolCategories;
use crate::chatbot_tools::{
    get_client_chatbot_tool_definitions, get_permitted_chatbot_tool_definitions,
};
use crate::conversation_context::{
    ChatbotPageContext, insert_page_context_message_if_changed, resolve_page_context,
};
use crate::llm_utils::{APIInputMessage, MessageContent, estimate_tokens, get_params_for_model};
use crate::prelude::*;
use crate::user_context::ChatbotTurnContext;

/// A conversation's stored messages as the request should replay them.
///
/// Replaying reasoning keeps a turn's prefix matching what the previous turn's later rounds sent,
/// so only reasoning is ever dropped, and only where Azure would reject it: without an
/// `encrypted_content` payload it cannot be resolved once responses are not stored Azure-side, and
/// unless the item it reasoned about follows it immediately the request 400s. A conversation whose
/// stored tail is a reasoning item — a stream that died mid-round, or a round that persisted its
/// reasoning before its calls — would otherwise be unusable for good.
fn replayable_input_messages(
    messages: Vec<ChatbotConversationMessage>,
) -> ChatbotResult<Vec<APIInputMessage>> {
    let mut kept: Vec<ChatbotConversationMessage> = Vec::with_capacity(messages.len());
    // Backwards, because whether a reasoning item may stay depends on what survives after it.
    for message in messages.into_iter().rev() {
        let keep = match &message.message {
            Message::Reasoning(reasoning) => {
                reasoning.encrypted_content.is_some()
                    && kept
                        .last()
                        .is_some_and(|next| may_follow_reasoning(reasoning, next))
            }
            _ => true,
        };
        if keep {
            kept.push(message);
        }
    }
    kept.into_iter()
        .rev()
        .map(APIInputMessage::try_from)
        .collect()
}

/// One message a round just stored, as the next round should carry it, or `None` for a reasoning
/// item Azure would reject: without an `encrypted_content` payload it cannot be resolved once
/// responses are not stored Azure-side.
///
/// The in-turn counterpart of [`replayable_input_messages`], which applies the same rule plus the
/// ordering one that only a stored conversation can be checked against.
pub(super) fn replayable_input_message(
    message: ChatbotConversationMessage,
) -> ChatbotResult<Option<APIInputMessage>> {
    if let Message::Reasoning(reasoning) = &message.message
        && reasoning.encrypted_content.is_none()
    {
        return Ok(None);
    }
    APIInputMessage::try_from(message).map(Some)
}

/// Whether Azure accepts `next` immediately after the reasoning item `reasoning`.
///
/// Normally that is the item the reasoning reasoned about. The exception is another reasoning item
/// of the same response: a round that reasons more than once emits its items in a run, so replaying
/// the run whole is what keeps the next turn's prefix matching what that round itself sent.
fn may_follow_reasoning(
    reasoning: &ChatbotConversationMessageReasoning,
    next: &ChatbotConversationMessage,
) -> bool {
    match &next.message {
        Message::ToolCall(_) => true,
        Message::Text(text) => text.message_role == MessageRole::Assistant,
        Message::Reasoning(later) => later.response_id == reasoning.response_id,
        Message::ToolOutput(_) => false,
    }
}

/// Routes every request of one conversation to the same prompt cache, or `None` for a model that has
/// no Azure prompt cache.
///
/// The transcript is append-only, so a turn's prefix contains the previous turn's, and the entry
/// worth routing to is the one that turn wrote.
fn conversation_prompt_cache_key(model_type: &ModelType, conversation_id: Uuid) -> Option<String> {
    model_type
        .is_azure_openai()
        .then(|| conversation_id.to_string())
}

impl LLMRequest {
    /// A request with no tools, tool choice, cache key, or output cap — the shape every one-shot
    /// LLM call outside a chatbot turn starts from. Override fields via struct-update syntax.
    pub fn new(model: String, input: Vec<APIInputMessage>, params: LLMRequestParams) -> Self {
        Self {
            input,
            model,
            tools: Vec::new(),
            tool_choice: None,
            parallel_tool_calls: None,
            max_output_tokens: None,
            text: None,
            prompt_cache_key: None,
            params,
        }
    }

    /// Writes the learner's new message to the conversation and builds the request for the turn
    /// that answers it.
    ///
    /// The write happens in one transaction with `abort_pending_client_tool_calls`, so a client
    /// answering a suspended tool call at the same moment either gets its answer in before the
    /// learner moved on, or finds the call already aborted. `page_context` is recorded ahead of
    /// the message it gives context for.
    pub(super) async fn build_and_insert_incoming_user_message_to_db(
        conn: &mut PgConnection,
        chatbot_configuration_id: Uuid,
        conversation_id: Uuid,
        message: &str,
        page_context: Option<ChatbotPageContext>,
        user_context: &ChatbotTurnContext,
        app_config: &ApplicationConfiguration,
    ) -> ChatbotResult<Self> {
        let configuration =
            models::chatbot_configurations::get_by_id(conn, chatbot_configuration_id).await?;

        let page = match page_context {
            Some(page_context) => {
                resolve_page_context(conn, page_context, configuration.course_id).await
            }
            None => None,
        };

        let mut tx = conn.begin().await?;

        models::chatbot_conversation_messages::abort_pending_client_tool_calls(
            &mut tx,
            conversation_id,
            ToolCallAbortReason::Replaced.model_output(),
        )
        .await?;

        if let Some(page) = &page {
            // Runs under the lock the abort above took, which is what keeps two requests from both
            // deciding the context changed and both writing it.
            insert_page_context_message_if_changed(
                &mut tx,
                conversation_id,
                page,
                user_context.course_name.as_deref(),
            )
            .await?;
        }

        models::chatbot_conversation_messages::insert(
            &mut tx,
            ChatbotConversationMessage::text(
                conversation_id,
                MessageRole::User,
                message.to_string(),
                estimate_tokens(message),
                None,
            ),
        )
        .await?;

        tx.commit().await?;

        Self::build_from_conversation(
            conn,
            &configuration,
            conversation_id,
            user_context,
            app_config,
        )
        .await
    }

    /// Builds the request for a turn from the conversation exactly as it is stored, writing
    /// nothing.
    ///
    /// Both the turn that follows a new user message and a resumed turn go through here, a
    /// resumed one adding nothing of its own beyond the tool output that woke it. The tools the
    /// request offers depend on `user_context`, so a caller who has lost a role is not offered a
    /// tool that needs it again.
    pub(super) async fn build_from_conversation(
        conn: &mut PgConnection,
        configuration: &ChatbotConfiguration,
        conversation_id: Uuid,
        user_context: &ChatbotTurnContext,
        app_config: &ApplicationConfiguration,
    ) -> ChatbotResult<Self> {
        let inputs = TurnInputs::load(conn, configuration, conversation_id, user_context).await?;
        Self::assemble(
            configuration,
            conversation_id,
            inputs,
            app_config,
            &user_context.enabled_tool_categories,
        )
    }

    /// Assembles the request's shape — grounding instruction, tool list, `tool_choice`, params,
    /// prompt cache key, and the system-message prepend — from data [`TurnInputs::load`] already
    /// read from the database.
    fn assemble(
        configuration: &ChatbotConfiguration,
        conversation_id: Uuid,
        inputs: TurnInputs,
        app_config: &ApplicationConfiguration,
        enabled_tool_categories: &EnabledToolCategories,
    ) -> ChatbotResult<Self> {
        let TurnInputs {
            model,
            messages,
            mut tools,
        } = inputs;

        let offers_tools = !tools.is_empty();
        let offers_search = configuration.use_azure_search
            && enabled_tool_categories.contains(azure_ai_search::CATEGORY);

        let mut system_prompt = configuration.prompt.clone();
        system_prompt.push_str(
            "All code you generate should be indented with 2 spaces, regardless of the language.\n",
        );
        if offers_search {
            system_prompt.push_str(&build_search_grounding_instruction(enabled_tool_categories));
            tools.push(AzureLLMToolDefinition::Search(
                get_azure_ai_search_tool_definition(
                    app_config,
                    configuration.course_id.ok_or_else(|| {
                        chatbot_err!(Other, "Course id is missing from the chatbot configuration")
                    })?,
                    configuration.use_semantic_reranking,
                )?,
            ));
        }

        let tool_choice = if offers_tools || offers_search {
            Some(LLMToolChoice::Auto)
        } else {
            None
        };

        let params = get_params_for_model(&model.model, &model.model_type, Some(configuration));
        let prompt_cache_key = conversation_prompt_cache_key(&model.model_type, conversation_id);

        let mut api_chat_messages = replayable_input_messages(messages)?;
        api_chat_messages.insert(
            0,
            APIInputMessage {
                message_type: InputItem::Message {
                    role: MessageRole::System,
                    content: MessageContent::Text(system_prompt),
                },
            },
        );

        Ok(Self {
            input: api_chat_messages,
            model: model.model,
            max_output_tokens: Some(configuration.max_output_tokens),
            tools,
            tool_choice,
            parallel_tool_calls: Some(true),
            text: Some(RequestTextOptions {
                verbosity: Some(configuration.verbosity),
                format: None,
            }),
            prompt_cache_key,
            params,
        })
    }
}

/// The database reads a turn's request is assembled from: the configured model, the
/// conversation's stored messages, and the tools `user_context` is currently permitted to use.
struct TurnInputs {
    model: ChatbotConfigurationModel,
    messages: Vec<ChatbotConversationMessage>,
    tools: Vec<AzureLLMToolDefinition>,
}

impl TurnInputs {
    async fn load(
        conn: &mut PgConnection,
        configuration: &ChatbotConfiguration,
        conversation_id: Uuid,
        user_context: &ChatbotTurnContext,
    ) -> ChatbotResult<Self> {
        let model = models::chatbot_configurations_models::get_by_chatbot_configuration_id(
            conn,
            configuration.id,
        )
        .await?;

        let messages =
            models::chatbot_conversation_messages::get_by_conversation_id(conn, conversation_id)
                .await?;

        let mut tools = get_permitted_chatbot_tool_definitions(conn, user_context).await?;
        tools.extend(get_client_chatbot_tool_definitions(conn, user_context).await?);

        Ok(Self {
            model,
            messages,
            tools,
        })
    }
}

#[cfg(test)]
mod tests {
    use headless_lms_models::{
        chatbot_conversation_message_tool_calls::ToolKind,
        insert_data,
        test_helper::{
            Conn, chatbot_reasoning_message, chatbot_text_message, chatbot_tool_call_message,
            chatbot_tool_output_message, insert_chatbot_conversation,
        },
    };

    use super::*;
    use crate::azure_chatbot::test_helpers::shape;

    /// Stores one conversation's worth of messages and gives back the messages they replay as.
    async fn replayed_items(
        conn: &mut PgConnection,
        build: impl Fn(Uuid) -> Vec<ChatbotConversationMessage>,
    ) -> Vec<APIInputMessage> {
        let (_configuration, conversation_id) = insert_chatbot_conversation(conn).await;
        for message in build(conversation_id) {
            models::chatbot_conversation_messages::insert(conn, message)
                .await
                .expect("the message is stored");
        }

        let stored =
            models::chatbot_conversation_messages::get_by_conversation_id(conn, conversation_id)
                .await
                .expect("the conversation is read back");
        replayable_input_messages(stored).expect("the messages convert")
    }

    async fn replayed_shape(
        conn: &mut PgConnection,
        build: impl Fn(Uuid) -> Vec<ChatbotConversationMessage>,
    ) -> Vec<String> {
        shape(&replayed_items(conn, build).await)
    }

    /// Reasoning is replayed so the next turn's prefix still matches what the last turn sent, but
    /// an item from before responses stopped being stored Azure-side has no payload to resolve and
    /// would fail the whole request. Dropping one must also leave every call behind its own
    /// reasoning, because Azure rejects a reasoning item that its call does not follow.
    #[tokio::test]
    async fn only_reasoning_that_carries_its_payload_is_replayed() {
        insert_data!(:tx);

        assert_eq!(
            replayed_shape(tx.as_mut(), |id| vec![
                chatbot_reasoning_message(id, "rs_replayable", "resp_1", Some("payload")),
                chatbot_tool_call_message(id, "call_1", ToolKind::Function, "resp_1"),
                chatbot_tool_output_message(id, "call_1", ToolKind::Function, "resp_1"),
                chatbot_reasoning_message(id, "rs_legacy", "resp_1", None),
                chatbot_tool_call_message(id, "call_2", ToolKind::Function, "resp_1"),
                chatbot_tool_output_message(id, "call_2", ToolKind::Function, "resp_1"),
            ])
            .await,
            vec![
                "reasoning:rs_replayable",
                "call:call_1",
                "output:call_1",
                "call:call_2",
                "output:call_2",
            ]
        );
    }

    /// The payload is the whole reason the item is worth replaying, and it reaches Azure only if it
    /// survives both the write and the read.
    #[tokio::test]
    async fn a_replayed_reasoning_item_still_carries_its_payload() {
        insert_data!(:tx);

        let replayed = replayed_items(tx.as_mut(), |id| {
            vec![
                chatbot_reasoning_message(id, "rs_1", "resp_1", Some("opaque-payload")),
                chatbot_tool_call_message(id, "call_1", ToolKind::Function, "resp_1"),
            ]
        })
        .await;

        let InputItem::Reasoning {
            encrypted_content, ..
        } = &replayed
            .first()
            .expect("the reasoning item is replayed")
            .message_type
        else {
            panic!("the replayed item is a reasoning item");
        };
        assert_eq!(encrypted_content.as_deref(), Some("opaque-payload"));
    }

    /// Azure 400s a request whose reasoning item is not immediately followed by the item it
    /// reasoned about, and nothing repairs the conversation afterwards: a stream that dies while
    /// reasoning — a closed tab, or `max_output_tokens` exhausted — leaves a stored tail that
    /// every later turn would resend, so the conversation stays dead. Dropping reasoning costs
    /// only cache hits, so a mispaired item never survives.
    #[tokio::test]
    async fn reasoning_is_replayed_only_when_what_it_reasoned_about_follows_it() {
        insert_data!(:tx);

        assert_eq!(
            replayed_shape(tx.as_mut(), |id| vec![
                chatbot_reasoning_message(id, "rs_1", "resp_1", Some("payload")),
                chatbot_tool_call_message(id, "call_1", ToolKind::Function, "resp_1"),
            ])
            .await,
            vec!["reasoning:rs_1", "call:call_1"],
        );

        assert_eq!(
            replayed_shape(tx.as_mut(), |id| vec![
                chatbot_reasoning_message(id, "rs_1", "resp_1", Some("payload")),
                chatbot_text_message(id, MessageRole::Assistant, "Here you go.", Some("resp_1")),
            ])
            .await,
            vec!["reasoning:rs_1", "message:Assistant"],
        );

        assert_eq!(
            replayed_shape(tx.as_mut(), |id| vec![
                chatbot_text_message(id, MessageRole::User, "How do loops work?", None),
                chatbot_reasoning_message(id, "rs_1", "resp_1", Some("payload")),
            ])
            .await,
            vec!["message:User"],
        );

        assert_eq!(
            replayed_shape(tx.as_mut(), |id| vec![
                chatbot_reasoning_message(id, "rs_1", "resp_1", Some("payload")),
                chatbot_text_message(id, MessageRole::User, "How do loops work?", None),
            ])
            .await,
            vec!["message:User"],
        );

        assert_eq!(
            replayed_shape(tx.as_mut(), |id| vec![
                chatbot_reasoning_message(id, "rs_1", "resp_1", Some("payload")),
                chatbot_tool_output_message(id, "call_1", ToolKind::Function, "resp_1"),
            ])
            .await,
            vec!["output:call_1"],
        );

        // A payload-less item does not count as the follower that keeps the one before it.
        assert_eq!(
            replayed_shape(tx.as_mut(), |id| vec![
                chatbot_reasoning_message(id, "rs_1", "resp_1", Some("payload")),
                chatbot_reasoning_message(id, "rs_legacy", "resp_1", None),
                chatbot_tool_call_message(id, "call_1", ToolKind::Function, "resp_1"),
            ])
            .await,
            vec!["reasoning:rs_1", "call:call_1"],
        );

        // Two responses' reasoning ends up adjacent only if what the first reasoned about is gone.
        assert_eq!(
            replayed_shape(tx.as_mut(), |id| vec![
                chatbot_reasoning_message(id, "rs_1", "resp_1", Some("payload")),
                chatbot_reasoning_message(id, "rs_2", "resp_2", Some("payload")),
                chatbot_tool_call_message(id, "call_1", ToolKind::Function, "resp_1"),
            ])
            .await,
            vec!["reasoning:rs_2", "call:call_1"],
        );
    }

    /// A round that reasons more than once emits its reasoning items in a run, so the round itself
    /// sends the whole run on to its next request. Replaying only part of it would make every later
    /// turn's prefix diverge from that, throwing away the cache hit the replay is there to buy.
    #[tokio::test]
    async fn a_run_of_reasoning_from_one_response_is_replayed_whole() {
        insert_data!(:tx);

        assert_eq!(
            replayed_shape(tx.as_mut(), |id| vec![
                chatbot_reasoning_message(id, "rs_1", "resp_1", Some("payload")),
                chatbot_reasoning_message(id, "rs_2", "resp_1", Some("payload")),
                chatbot_tool_call_message(id, "call_1", ToolKind::Function, "resp_1"),
                chatbot_tool_output_message(id, "call_1", ToolKind::Function, "resp_1"),
                chatbot_tool_call_message(id, "call_2", ToolKind::Function, "resp_1"),
                chatbot_tool_output_message(id, "call_2", ToolKind::Function, "resp_1"),
            ])
            .await,
            vec![
                "reasoning:rs_1",
                "reasoning:rs_2",
                "call:call_1",
                "output:call_1",
                "call:call_2",
                "output:call_2",
            ],
        );
    }

    /// Mistral is not served through Azure OpenAI, so a prompt cache key means nothing to it. The
    /// guard is one match arm, and losing it sends the parameter to an API that never asked for it.
    #[test]
    fn a_model_that_is_not_azure_openai_gets_no_prompt_cache_key() {
        let conversation_id = Uuid::new_v4();

        assert_eq!(
            conversation_prompt_cache_key(&ModelType::Mistral, conversation_id),
            None
        );
        assert!(
            conversation_prompt_cache_key(&ModelType::GPTHardThinking, conversation_id).is_some()
        );
    }
}
