use std::pin::Pin;
use std::sync::{
    Arc,
    atomic::{self, AtomicBool},
};
use std::task::{Context, Poll};

use bytes::Bytes;
use futures::stream::{BoxStream, Peekable};
use futures::{Stream, StreamExt};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_configurations::{
    ChatbotConfiguration, ReasoningEffortLevel, VerbosityLevel,
};
use headless_lms_models::chatbot_configurations_models::ModelType;
use headless_lms_models::chatbot_conversation_message_messages::{
    ChatbotConversationMessageMessage, MessageRole,
};
use headless_lms_models::chatbot_conversation_message_reasoning::ChatbotConversationMessageReasoning;
use headless_lms_models::chatbot_conversation_message_tool_calls::ChatbotConversationMessageToolCall;
use headless_lms_models::chatbot_conversation_messages::{
    self, ChatbotConversationMessage, Message,
};
use headless_lms_utils::json_schema_types::{JSONType, Schema};
use pin_project::pin_project;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tokio::{io::AsyncBufReadExt, sync::Mutex};
use tokio_stream::wrappers::LinesStream;
use tokio_util::io::StreamReader;
use tracing::trace;
use url::Url;
use utoipa::ToSchema;

use crate::chatbot_error::ChatbotResult;
use crate::chatbot_tools::provider_tools::azure_ai_search::{
    AZURE_AI_SEARCH_TOOL_NAME, get_azure_ai_search_tool_definition,
};
use crate::chatbot_tools::{
    AzureLLMToolDefinition, ChatbotToolCallResult, ClientToolAnswer, call_chatbot_tool,
    check_client_tool_arguments, client_tool_answer_output, client_tool_permission,
    get_client_chatbot_tool_definitions, get_permitted_chatbot_tool_definitions,
    tool_is_answered_by_client, tool_permission::ToolPermission,
};
use crate::citations::chatbot_cited_documents_to_citations;
use crate::conversation_context::{
    ChatbotPageContext, insert_page_context_message_if_changed, resolve_page_context,
};
use crate::llm_utils::{
    APIInputMessage, APIOutputMessage, MessageContent, estimate_tokens, get_params_for_model,
    make_streaming_llm_request, summarize_input_for_log,
};

use crate::prelude::*;
use crate::user_context::ChatbotUserContext;

/// How many LLM requests one turn may make, bounding a model that keeps calling tools instead of
/// answering.
const MAX_TOOL_CALL_ROUNDS_PER_TURN: u32 = 15;

/// Azure events that no parser needs to react to, or that some parser handles while another
/// legitimately sees them. An event outside this list is logged as unexpected, so a name Azure
/// starts sending has to be added here even when nothing acts on it.
const ALL_EXPECTED_EVENTS: &[&str] = &[
    "response.in_progress",
    "response.queued",
    "response.completed",
    "response.output_item.added",
    "response.output_item.done",
    "response.content_part.added",
    "response.content_part.done",
    // we can stream reasoning summary text with these
    "response.reasoning_summary_part.added",
    "response.reasoning_summary_part.done",
    "response.reasoning_summary_text.delta",
    "response.reasoning_summary_text.done",
    "response.reasoning_text.delta",
    "response.reasoning_text.done",
    "response.function_call_arguments.delta",
    "response.function_call_arguments.done",
    "response.custom_tool_call_input.delta",
    "response.custom_tool_call_input.done",
    "response.output_text.done",
    "response.refusal.done",
];

/// Appended to the system prompt when course-material search is enabled, to ground answers
/// in retrieved course material.
const SEARCH_GROUNDING_INSTRUCTION: &str = "\n\nSearch the course material with the azure_ai_search tool before answering, and ground your answer in the results with citations. Put only what you want to find in the query; the search is already limited to this course, so don't include the course name. Searching more than once is fine when it helps — to cover distinct sub-questions or angles, to refine when the first results don't answer, or when a follow-up or new instruction needs material you don't already have. When one search already answers, stop there. If you need more information about a specific document or a topic covered in it, use the document_lookup tool to retrieve the full document. Skip searching only for messages that don't need course material, like greetings or thanks. If you need more information about the course, like what pages and chapters are in it, use the course_structure tool.";

enum ParsedResponseLine {
    Event(String),
    Data(Box<ResponseOutput>),
}

impl ParsedResponseLine {
    fn parse(input: &str) -> ChatbotResult<Option<Self>> {
        if let Some(event_type) = input.strip_prefix("event: ") {
            Ok(Some(ParsedResponseLine::Event(event_type.to_string())))
        } else if let Some(data) = input.strip_prefix("data: ") {
            let response_output = match serde_json::from_str::<ResponseOutput>(data) {
                Ok(response_output) => response_output,
                Err(e) => {
                    // Log the raw line so deserialization failures against the Azure response
                    // schema can be diagnosed without reproducing them.
                    tracing::error!(
                        raw_line = %data,
                        error = %e,
                        "Failed to deserialize streamed response line from Azure"
                    );
                    return Err(ChatbotError::from(e));
                }
            };
            Ok(Some(ParsedResponseLine::Data(Box::new(response_output))))
        } else {
            Ok(None)
        }
    }
}

/// Response received from LLM API
#[derive(Deserialize, Serialize, Debug)]
pub struct Response {
    pub id: Option<String>,
    pub error: Option<ResponseError>,
    pub usage: Option<Usage>,
    pub reasoning: Option<ResponseReasoning>,
}

/// The reasoning settings a response reports back, as opposed to the ones the request asked for.
#[derive(Deserialize, Serialize, Debug, Clone, Default)]
pub struct ResponseReasoning {
    /// Which turns' reasoning the model drew on. Kept as a string rather than
    /// [`ReasoningContext`] so that a value this code does not know cannot fail the whole
    /// response; worth logging because only [`ModelType::GPTHardThinking`] asks for one, and
    /// everywhere else this is the deployment's own default.
    pub context: Option<String>,
}

/// What the request was billed for. Optional throughout: Azure reports the cache fields only on
/// some deployment types, and PTU-M never reports `cache_write_tokens` at all.
#[derive(Deserialize, Serialize, Debug, Clone, Default)]
pub struct Usage {
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub total_tokens: Option<i64>,
    pub input_tokens_details: Option<InputTokensDetails>,
    pub output_tokens_details: Option<OutputTokensDetails>,
}

/// How much of the input was served from Azure's prompt cache. The only way to tell whether the
/// prompt prefix is actually stable, since a perturbed prefix fails silently by costing more.
#[derive(Deserialize, Serialize, Debug, Clone, Default)]
pub struct InputTokensDetails {
    pub cached_tokens: Option<i64>,
    pub cache_write_tokens: Option<i64>,
}

/// How much of the output was thinking, which is what moves when the reasoning context widens or
/// narrows.
#[derive(Deserialize, Serialize, Debug, Clone, Default)]
pub struct OutputTokensDetails {
    pub reasoning_tokens: Option<i64>,
}

impl Usage {
    /// Emits the token counts, including how much of the prompt the cache served and, from
    /// `reasoning`, which turns' reasoning the model drew on.
    pub fn log(&self, context: &str, reasoning: Option<&ResponseReasoning>) {
        info!(
            context,
            input_tokens = self.input_tokens,
            output_tokens = self.output_tokens,
            reasoning_tokens = self
                .output_tokens_details
                .as_ref()
                .and_then(|details| details.reasoning_tokens),
            cached_tokens = self
                .input_tokens_details
                .as_ref()
                .and_then(|details| details.cached_tokens),
            cache_write_tokens = self
                .input_tokens_details
                .as_ref()
                .and_then(|details| details.cache_write_tokens),
            reasoning_context = reasoning.and_then(|reasoning| reasoning.context.as_deref()),
            "LLM token usage"
        );
    }
}

/// Error object returned by the LLM API on a failed response. Fields are optional so any
/// error shape deserializes rather than crashing the stream parser.
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct ResponseError {
    pub code: Option<String>,
    pub message: Option<String>,
    #[serde(rename = "type")]
    pub error_type: Option<String>,
    pub param: Option<String>,
}

impl std::fmt::Display for ResponseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}: {} (code: {}, param: {})",
            self.error_type.as_deref().unwrap_or("Error"),
            self.message.as_deref().unwrap_or("unknown error"),
            self.code.as_deref().unwrap_or("none"),
            self.param.as_deref().unwrap_or("none")
        )
    }
}

/// Incomplete response received from LLM API
#[derive(Deserialize, Serialize, Debug)]
pub struct IncompleteResponse {
    pub id: String,
    pub incomplete_details: IncompleteReason,
}

/// Response received from LLM API
#[derive(Deserialize, Serialize, Debug)]
pub struct IncompleteReason {
    pub reason: String,
}

/// Streamed token of the response text
#[derive(Deserialize, Serialize, Debug)]
pub struct ResponseOutput {
    /// The event type of this response
    // Optional so a streamed `data:` line that omits `type` still deserializes and is ignored,
    // rather than aborting the whole chat stream.
    #[serde(rename = "type")]
    pub response_type: Option<String>, // for examples check out ALL_EXPECTED_EVENTS
    pub delta: Option<String>,
    pub item: Option<OutputItem>,
    pub response: Option<Response>,
    pub incomplete_response: Option<IncompleteResponse>,
    pub error: Option<ResponseError>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
pub enum OutputItem {
    Message {
        response_id: String,
        role: MessageRole,
        content: MessageContent,
    },
    Reasoning {
        response_id: String,
        id: String,
        summary: Vec<ReasoningOutput>,
        /// Absent unless the request set `store` to false, which is what makes Azure hand the
        /// reasoning back instead of keeping it and expecting `id` to resolve against it.
        #[serde(skip_serializing_if = "Option::is_none")]
        encrypted_content: Option<String>,
    },
    AzureAiSearchCall {
        response_id: String,
        call_id: String,
        /// JSON string
        arguments: String,
    },
    AzureAiSearchCallOutput {
        response_id: String,
        call_id: String,
        /// JSON string
        output: String,
    },
    FunctionCall {
        response_id: String,
        call_id: String,
        #[serde(rename = "name")]
        tool_name: String,
        /// JSON string
        arguments: String,
    },
    FunctionCallOutput {
        response_id: String,
        call_id: String,
        output: String,
    },
}

impl From<StreamItem> for ChatbotChatStreamEvent {
    fn from(value: StreamItem) -> Self {
        match value {
            StreamItem {
                item: OutputItem::Reasoning { id, .. },
                finished,
                ..
            } => ChatbotChatStreamEvent::Reasoning {
                finished,
                reasoning_id: id,
            },
            StreamItem {
                item:
                    OutputItem::AzureAiSearchCall {
                        arguments, call_id, ..
                    },
                finished,
                ..
            } => ChatbotChatStreamEvent::ToolCall {
                tool_name: Some(AZURE_AI_SEARCH_TOOL_NAME.to_string()),
                arguments: Some(arguments),
                tool_call_id: call_id,
                finished,
            },
            StreamItem {
                item:
                    OutputItem::FunctionCall {
                        tool_name,
                        arguments,
                        call_id,
                        ..
                    },
                ..
            } => ChatbotChatStreamEvent::ToolCall {
                tool_name: Some(tool_name),
                arguments: Some(arguments),
                tool_call_id: call_id,
                finished: false,
            },
            StreamItem {
                item: OutputItem::AzureAiSearchCallOutput { call_id, .. },
                ..
            } => ChatbotChatStreamEvent::ToolCall {
                tool_name: Some(AZURE_AI_SEARCH_TOOL_NAME.to_string()),
                arguments: None,
                tool_call_id: call_id,
                finished: true,
            },
            StreamItem {
                item: OutputItem::FunctionCallOutput { call_id, .. },
                ..
            } => ChatbotChatStreamEvent::ToolCall {
                // tool name and arguments are ignored in the frontend. this StreamEvent
                // just signals that the tool call has finished.
                tool_name: None,
                arguments: None,
                tool_call_id: call_id,
                finished: true,
            },
            StreamItem {
                item: OutputItem::Message { .. },
                ..
            } => ChatbotChatStreamEvent::Invalid,
        }
    }
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
pub enum InputItem {
    Message {
        role: MessageRole,
        content: MessageContent,
    },
    FunctionCall {
        call_id: String,
        #[serde(rename = "name")]
        tool_name: String,
        arguments: String,
    },
    FunctionCallOutput {
        call_id: String,
        output: String,
    },
    Reasoning {
        id: String,
        summary: Vec<ReasoningOutput>,
        /// Carries the reasoning itself, so a replayed item survives without Azure holding the
        /// response `id` refers to. An item sent without it is rejected once `store` is false.
        #[serde(skip_serializing_if = "Option::is_none")]
        encrypted_content: Option<String>,
    },
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct AISearchOutput {
    pub get_urls: Vec<Url>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LLMToolChoice {
    Auto,
    None,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct ThinkingParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<Reasoning>,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct RequestTextOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verbosity: Option<VerbosityLevel>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<LLMRequestResponseFormatParam>,
}
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct Reasoning {
    pub effort: ReasoningEffortLevel,
    /// Option to generate a reasoning summary with desired level of info
    pub summary: Option<SummaryType>,
    /// Which turns' reasoning the model may draw on. Leave unset for anything that is not certainly
    /// GPT-5.6: an older reasoning deployment rejects the parameter rather than ignoring it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<ReasoningContext>,
}

/// How far back the model reuses its own reasoning.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReasoningContext {
    /// Only this turn's reasoning, including the reasoning between the calls of one tool loop.
    /// Reasoning replayed from completed earlier turns still travels in the request, but is not
    /// rendered into the next sample.
    CurrentTurn,
    /// Also the reasoning items replayed from earlier turns, not only this turn's. GPT-5.6's own
    /// default when the request leaves the parameter unset.
    AllTurns,
}

/// Untagged would serialize these unit variants as `null`, which asks Azure for no summary at all.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SummaryType {
    Concise,
    Detailed,
    Auto,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct ReasoningOutput {
    #[serde(rename = "type")]
    pub output_type: String, //summary_text
    pub text: String,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct NonThinkingParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frequency_penalty: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presence_penalty: Option<f32>,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct MistralParams {
    // todo
    pub test: bool,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(untagged)]
pub enum LLMRequestParams {
    GPTThinking(ThinkingParams),
    GPTNonThinking(NonThinkingParams),
    Mistral(MistralParams),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct LLMRequestResponseFormatParam {
    #[serde(rename = "type")]
    pub format_type: JSONType, //should be JsonSchema
    pub name: String,
    pub schema: Schema,
    pub strict: bool, // should be true
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LLMRequest {
    pub input: Vec<APIInputMessage>,
    pub model: String,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub tools: Vec<AzureLLMToolDefinition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<LLMToolChoice>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parallel_tool_calls: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<RequestTextOptions>,
    /// Routes requests sharing a prompt prefix to the same cache entry. `None` for a model that has
    /// no Azure prompt cache.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_cache_key: Option<String>,
    #[serde(flatten)]
    pub params: LLMRequestParams,
}

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
    /// Writes the learner's new message to the conversation and builds the request for the turn
    /// that answers it.
    ///
    /// The write happens in one transaction with `abort_pending_client_tool_calls`, so a client
    /// answering a suspended tool call at the same moment either gets its answer in before the
    /// learner moved on, or finds the call already aborted. `page_context` is recorded ahead of
    /// the message it gives context for.
    async fn build_and_insert_incoming_user_message_to_db(
        conn: &mut PgConnection,
        chatbot_configuration_id: Uuid,
        conversation_id: Uuid,
        message: &str,
        page_context: Option<ChatbotPageContext>,
        user_context: &ChatbotUserContext,
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

        let mut tx = conn.begin().await.map_err(ChatbotError::from)?;

        models::chatbot_conversation_messages::abort_pending_client_tool_calls(
            &mut tx,
            conversation_id,
            NEW_MESSAGE_ABORT_OUTPUT,
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
            ChatbotConversationMessage {
                conversation_id,
                message: Message::Text(ChatbotConversationMessageMessage {
                    text: message.to_string(),
                    message_role: MessageRole::User,
                    message_is_complete: true,
                    used_tokens: estimate_tokens(message),
                    ..Default::default()
                }),
                ..Default::default()
            },
        )
        .await?;

        tx.commit().await.map_err(ChatbotError::from)?;

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
    async fn build_from_conversation(
        conn: &mut PgConnection,
        configuration: &ChatbotConfiguration,
        conversation_id: Uuid,
        user_context: &ChatbotUserContext,
        app_config: &ApplicationConfiguration,
    ) -> ChatbotResult<Self> {
        let model = models::chatbot_configurations_models::get_by_chatbot_configuration_id(
            conn,
            configuration.id,
        )
        .await?;

        let conversation_messages =
            models::chatbot_conversation_messages::get_by_conversation_id(conn, conversation_id)
                .await?;

        let mut system_prompt = configuration.prompt.clone();
        if configuration.use_azure_search {
            system_prompt.push_str(SEARCH_GROUNDING_INSTRUCTION);
        }

        let mut tools = if configuration.use_tools {
            let mut tools = get_permitted_chatbot_tool_definitions(conn, user_context).await?;
            tools.extend(get_client_chatbot_tool_definitions(conn, user_context).await?);
            tools
        } else {
            Vec::new()
        };

        if configuration.use_azure_search {
            tools.extend(vec![AzureLLMToolDefinition::Search(
                get_azure_ai_search_tool_definition(
                    app_config,
                    configuration.course_id.ok_or_else(|| {
                        chatbot_err!(Other, "Course id is missing from the chatbot configuration")
                    })?,
                    configuration.use_semantic_reranking,
                )?,
            )]);
        };

        let tool_choice = if configuration.use_azure_search || configuration.use_tools {
            Some(LLMToolChoice::Auto)
        } else {
            None
        };

        let params = get_params_for_model(&model.model, &model.model_type, Some(configuration));
        let prompt_cache_key = conversation_prompt_cache_key(&model.model_type, conversation_id);

        let mut api_chat_messages = replayable_input_messages(conversation_messages)?;
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
#[serde(tag = "type", content = "data")]
pub enum ChatbotChatStreamEvent {
    Delta {
        text: String,
        message_id: Uuid,
    },
    Reasoning {
        finished: bool,
        reasoning_id: String,
    },
    ToolCall {
        tool_name: Option<String>,
        arguments: Option<String>,
        tool_call_id: String,
        finished: bool,
    },
    Done,
    /// The turn stopped to wait for the client to answer a tool call, so it ends with neither an
    /// answer nor an error. Terminal like `Done`: the client stops reading, answers the call
    /// through the tool-response endpoint, and reads the stream that returns.
    ///
    /// Carries nothing, because the call it waits on was already streamed as an unfinished
    /// `ToolCall` event, and survives a reload only through the conversation's messages anyway.
    Suspended,
    Error(StreamEventError),
    /// If a ChatbotChatStreamEvent has been constructed from a StreamItem etc.,
    /// not all variants are valid ChatbotChatStreamEvents and shouldn't be sent to
    /// the frontend in the stream. In that case, use this variant.
    Invalid,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct StreamEventError {
    message: String,
    details: Option<String>,
}

/// Custom stream that encapsulates both the response stream and the cancellation guard. Makes sure that the guard is always dropped when the stream is dropped.
#[pin_project]
struct GuardedStream<S> {
    guard: RequestCancelledGuard,
    #[pin]
    stream: S,
}

impl<S> GuardedStream<S> {
    fn new(guard: RequestCancelledGuard, stream: S) -> Self {
        Self { guard, stream }
    }
}

impl<S> Stream for GuardedStream<S>
where
    S: Stream<Item = ChatbotResult<Bytes>> + Send,
{
    type Item = S::Item;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = self.project();
        let polled = this.stream.poll_next(cx);
        // Log stream errors here in the clean format; actix's dispatcher otherwise only
        // surfaces them as a terse Display line once the error is in the response body.
        if let Poll::Ready(Some(Err(error))) = &polled {
            error!("Chatbot response stream error:\n{error:?}");
        }
        polled
    }
}

/// A LinesStream that is peekable. Needed to determine which type of LLM response is
/// being received.
type PeekableLinesStream<'a> = Pin<
    Box<Peekable<LinesStream<StreamReader<BoxStream<'a, Result<Bytes, std::io::Error>>, Bytes>>>>,
>;
enum ResponseStreamType<'a> {
    ToolCall(PeekableLinesStream<'a>),
    TextResponse(PeekableLinesStream<'a>),
}

struct RequestCancelledGuard {
    response_message_id: Arc<Mutex<Uuid>>,
    full_response_text: Arc<Mutex<Vec<String>>>,
    pool: PgPool,
    done: Arc<AtomicBool>,
}

impl Drop for RequestCancelledGuard {
    fn drop(&mut self) {
        if self.done.load(atomic::Ordering::Relaxed) {
            return;
        }
        info!("Request ended before the turn completed. Cleaning up.");
        let response_message_id = self.response_message_id.clone();
        let full_response_text = self.full_response_text.clone();
        let pool = self.pool.clone();
        // Nothing awaits this task, so failures are logged instead of panicked on: a panic here
        // would be invisible apart from a stray tracing event.
        tokio::spawn(async move {
            info!("Verifying the received message has been handled");
            let id = response_message_id.lock().await.to_owned();
            if id.is_nil() {
                // Still nil when the turn died before streaming any text, e.g. during a tool call
                // round.
                info!("No response message was created for this request, nothing to clean up.");
                return;
            }
            let mut conn = match pool.acquire().await {
                Ok(conn) => conn,
                Err(err) => {
                    error!(
                        "Could not acquire a connection to clean up after a cancelled chatbot request: {err}"
                    );
                    return;
                }
            };
            let full_response_text = full_response_text.lock().await;
            if full_response_text.is_empty() {
                info!("No response received. Deleting the response message");
                if let Err(err) = models::chatbot_conversation_messages::delete(&mut conn, id).await
                {
                    error!("Could not delete the empty chatbot response message {id}: {err}");
                }
                return;
            }
            info!("Response received but not completed. Saving the text received so far.");
            let full_response_as_string = full_response_text.join("");
            let estimated_cost = estimate_tokens(&full_response_as_string);
            info!(
                "End of chatbot response stream. Estimated cost: {}. Response: {}",
                estimated_cost, full_response_as_string
            );

            if let Err(err) = models::chatbot_conversation_messages::update(
                &mut conn,
                id,
                &full_response_as_string,
                true,
                estimated_cost,
            )
            .await
            {
                error!("Could not save the partial chatbot response message {id}: {err}");
            }
        });
    }
}

/// For saving output items that are not text messages or function calls, i.e. that
/// don't need further processing and are not streamed to the user.
/// Saves reasoning and Azure AI Search items.
async fn process_output_item(
    conn: &mut PgConnection,
    item: OutputItem,
    conversation_id: Uuid,
    app_config: &ApplicationConfiguration,
) -> ChatbotResult<ChatbotConversationMessage> {
    match item {
        OutputItem::AzureAiSearchCall { .. } | OutputItem::Reasoning { .. } => {
            let message = APIOutputMessage { message_type: item }
                .to_chatbot_conversation_message(conversation_id)?;

            ChatbotResult::Ok(chatbot_conversation_messages::insert(conn, message).await?)
        }
        OutputItem::AzureAiSearchCallOutput {
            call_id,
            output,
            response_id,
        } => {
            let search_output: AISearchOutput = serde_json::from_str(&output)?;
            let api_key = if let Some(azure_config) = &app_config.azure_configuration
                && let Some(search_config) = &azure_config.search_config
            {
                &search_config.search_api_key
            } else {
                return ChatbotResult::Err(chatbot_err!(
                    Other,
                    "Azure search configuration not found, cannot process Azure AI search output item.".to_string()
                ));
            };
            let get_urls = search_output.get_urls.to_owned();

            let message = APIOutputMessage {
                message_type: OutputItem::AzureAiSearchCallOutput {
                    call_id,
                    output,
                    response_id: response_id.to_owned(),
                },
            }
            .to_chatbot_conversation_message(conversation_id)?;

            let conversation_message = chatbot_conversation_messages::insert(conn, message).await?;

            let res = chatbot_cited_documents_to_citations(
                conn,
                app_config.test_chatbot,
                get_urls,
                api_key,
                conversation_message.id,
                conversation_id,
            )
            .await;

            if let Err(e) = res {
                error!(
                    "Failed to save cited documents in the DB. Response id: {response_id} Error: {e}"
                );
            };

            ChatbotResult::Ok(conversation_message)
        }
        OutputItem::Message { ref content, .. } => {
            if let MessageContent::Refusal(..) = content {
                let message = APIOutputMessage {
                    message_type: item.clone(),
                }
                .to_chatbot_conversation_message(conversation_id)?;

                ChatbotResult::Ok(chatbot_conversation_messages::insert(conn, message).await?)
            } else {
                // this chunk has a text message and should be streamed!
                Err(chatbot_err!(
                    StreamingError,
                    "Unexpected message output item, it should have been streamed.".to_string()
                ))
            }
        }
        OutputItem::FunctionCall { .. } => {
            // this chunk has tool call data and it should already be saved!!
            Err(chatbot_err!(
                StreamingError,
                "Unexpected function call output item, it should have been processed.".to_string()
            ))
        }
        OutputItem::FunctionCallOutput { .. } => {
            // this chunk has tool output data
            // we shouldn't be receiving it from the LLM!
            // tool output is created by us!
            Err(chatbot_err!(
                StreamingError,
                "Unexpected function call output item, this shouldn't happen.".to_string()
            ))
        }
    }
}

/// One item of a tool-call round, held until the round is known complete so it can be stored in
/// its original stream order.
///
/// A round's function calls are only run, and inserted, once every item has streamed in; a
/// `Passthrough` item stored as soon as it streams would then land ahead of all of them instead of
/// next to the call it belongs beside. See [`StreamItem::defer_storage`].
enum PendingRoundItem {
    FunctionCall {
        tool_name: String,
        call_id: String,
        arguments: String,
    },
    Passthrough(OutputItem),
}

/// The item with a reasoning payload left out, for an event that only names the item.
///
/// A reasoning `encrypted_content` is multi-KB base64, and a deferred item is stored by the round
/// that produced it rather than from the event, which nothing downstream reads more than the id of.
fn item_without_reasoning_payload(item: &OutputItem) -> OutputItem {
    match item {
        OutputItem::Reasoning {
            response_id, id, ..
        } => OutputItem::Reasoning {
            response_id: response_id.clone(),
            id: id.clone(),
            summary: Vec::new(),
            encrypted_content: None,
        },
        other => other.clone(),
    }
}

/// Streams and parses one tool-call round of a response from Azure, consuming `lines`.
///
/// Runs the calls the server answers, stores each call beside its output, and ends the round by
/// yielding [`StreamEvent::Messages`] with the items the next round is sent. A call only the client
/// can answer is stored without an output and ends the turn with [`StreamEvent::Suspended`]
/// instead: the answer arrives in a later request, which rebuilds its input from the conversation.
async fn parse_tool<'a>(
    conn: &'a mut PgConnection,
    app_config: &'a ApplicationConfiguration,
    mut lines: PeekableLinesStream<'a>,
    conversation_id: Uuid,
    user_context: &'a ChatbotUserContext,
) -> BoxStream<'a, ChatbotResult<StreamEvent<'a>>> {
    let mut pending_round_items: Vec<PendingRoundItem> = vec![];
    let mut messages = vec![];
    let mut common_response_id: Option<String> = None;
    let mut response_received = false;
    let mut suspended = false;

    trace!("Parsing tool calls...");

    Box::pin(async_stream::try_stream! {
    while let Some(val) = lines.next().await {
        let line = val?;
        let response_output: ResponseOutput = match ParsedResponseLine::parse(&line)? {
            Some(ParsedResponseLine::Event(event_type)) => {
                trace!("Event: {event_type}");
                match event_type.as_str() {
                    "response.completed" | "response.incomplete" => {
                        response_received = true;
                    }
                    "response.output_text.delta" => {
                        Err(chatbot_err!(StreamingError,
                            "Error: Received response text while parsing tool calls. Either the tool call parsing failed or the LLM responded in an unexpected way."
                        ))?
                    }
                    "response.error" | "response.failed" | "error" => {
                        // error is logged in the next iteration
                     }
                    _ => {
                        if !ALL_EXPECTED_EVENTS.contains(&event_type.as_str()) {
                            warn!("Received unexpected event from Azure: Event: {}", event_type);
                        };
                    }
                };
                continue;
            }
            Some(ParsedResponseLine::Data(data)) => *data,
            None => {
                continue;
            }
        };

        if let Some(response) = response_output.response.as_ref()
            && let Some(usage) = response.usage.as_ref()
        {
            usage.log("streaming_tool_call_round", response.reasoning.as_ref());
        }

        // Surface any error the API reports (e.g. response.error, response.failed)
        // instead of continuing. Normal responses carry no error object.
        if let Some(response) = response_output.response
        && let Some(err) = response.error
        {
            let mut error = chatbot_err!(
                StreamingError,
                format!("Error received from Azure API. Response id: {}", response.id.as_deref().unwrap_or("not received"))
            );
            error.add_azure_source(err);
            Err(error)?
        };
        // Surface the error in case there is no response object, just an error
        if let Some(err) = response_output.error {
            let mut error = chatbot_err!(
                StreamingError,
                format!("Error received from Azure API. Response id: {}", common_response_id.as_deref().unwrap_or("not received"))
            );
            error.add_azure_source(err);
            Err(error)?

        };

        if response_received {
            // the stream ended
            if let Some(response) = &response_output.incomplete_response {
                // todo: can add content filter results for more info
                Err(chatbot_err!(StreamingError,
                    format!("The LLM response is incomplete. Reason: {}", response.incomplete_details.reason)
                ))?
            };
            if !pending_round_items
                .iter()
                .any(|item| matches!(item, PendingRoundItem::FunctionCall { .. }))
            {
                Err(chatbot_err!(StreamingError,
                    "The LLM response was supposed to contain function calls, but no function calls were found"
                ))?
            }
            let Some(response_id) = &common_response_id else {
                Err(chatbot_err!(StreamingError,
                    "Received tool response but response id not found, this shouldn't happen."
                ))?
            };

            for pending_item in pending_round_items.into_iter() {
                let (name, id, args) = match pending_item {
                    PendingRoundItem::FunctionCall { tool_name, call_id, arguments } => {
                        (tool_name, call_id, arguments)
                    }
                    // Stored here, in the round's original stream order alongside the function
                    // calls, rather than as soon as it streamed in: see
                    // [`StreamItem::defer_storage`].
                    PendingRoundItem::Passthrough(item) => {
                        process_output_item(conn, item.clone(), conversation_id, app_config).await?;
                        messages.push(APIOutputMessage { message_type: item });
                        continue;
                    }
                };
                // A client tool's arguments are checked before the turn suspends, not when an
                // answer arrives: nothing can answer a call the tool would reject, so it has to
                // fail while the turn can still hand the LLM a failure output.
                let refused_client_call = if tool_is_answered_by_client(&name) {
                    match check_client_tool_arguments(&name, &args) {
                        Ok(()) => {
                            // Recorded without an output: the client answers it through the
                            // tool-response endpoint, which resumes the turn from the conversation
                            // as stored, so the call has to be in the conversation before the turn
                            // ends.
                            let tool_call_message = APIOutputMessage {
                                message_type: OutputItem::FunctionCall {
                                    response_id: response_id.to_owned(),
                                    call_id: id,
                                    tool_name: name,
                                    arguments: args,
                                },
                            };
                            chatbot_conversation_messages::insert(
                                conn,
                                tool_call_message.to_chatbot_conversation_message(conversation_id)?,
                            )
                            .await?;
                            suspended = true;
                            continue;
                        }
                        Err(error) => {
                            if check_error_should_terminate_stream(error.error_type()) {
                                Err(error)?
                            } else {
                                warn!(
                                    "A client chatbot tool call was refused before the turn could suspend on it, reporting the failure to the LLM. Tool: {name}. Error: {error:?}"
                                );
                                Some(tool_failure_output_for_llm(&error))
                            }
                        }
                    }
                } else {
                    None
                };

                let tool_result = if let Some(output) = refused_client_call {
                    ChatbotToolCallResult { arguments: args, output }
                } else {
                    // The tool runs outside the transaction so a failure cannot leave a
                    // function call without its output.
                    let tool_call =
                        call_chatbot_tool(conn, app_config, &name, args.clone(), user_context).await;
                    match tool_call {
                        Ok(result) => result,
                        Err(error) => {
                            if check_error_should_terminate_stream(error.error_type()) {
                                Err(error)?
                            } else {
                                warn!(
                                    "Chatbot tool call failed, reporting the failure to the LLM. Tool: {name}. Error: {error:?}"
                                );
                                ChatbotToolCallResult {
                                    arguments: args,
                                    output: tool_failure_output_for_llm(&error),
                                }
                            }
                        }
                    }
                };

                let mut tx = conn.begin().await.map_err(ChatbotError::from)?;
                let tool_call_message = APIOutputMessage {
                    message_type: OutputItem::FunctionCall {
                        response_id: response_id.to_owned(),
                        call_id: id.to_owned(),
                        tool_name: name.to_owned(),
                        arguments: tool_result.arguments,
                    },
                };
                chatbot_conversation_messages::insert(
                    &mut tx,
                    tool_call_message.to_chatbot_conversation_message(conversation_id)?,
                )
                .await?;

                let function_call_output = OutputItem::FunctionCallOutput {
                        call_id: id.to_owned(),
                        output: tool_result.output,
                        response_id: response_id.to_owned(),
                    };
                let output_message = APIOutputMessage {
                    message_type: function_call_output.to_owned(),
                };
                chatbot_conversation_messages::insert(
                    &mut tx,
                    output_message.to_chatbot_conversation_message(conversation_id)?,
                )
                .await?;
                tx.commit().await.map_err(ChatbotError::from)?;

                messages.extend([tool_call_message, output_message]);

                yield StreamEvent::Item(StreamItem {
                    item: function_call_output,
                    finished: true,
                    defer_storage: false,
                });
            }

            if suspended {
                // No further round: the answers the turn is missing arrive in later requests, and
                // the resumed turn rebuilds its input from the conversation rather than from here.
                yield StreamEvent::Suspended;
            } else {
                let input_messages = messages.into_iter().map(APIInputMessage::from).collect::<Vec<APIInputMessage>>();
                yield StreamEvent::Messages(input_messages);
            }
            break;
        } else if let Some(item) = response_output.item {
            let finished = response_output.response_type.as_deref() == Some("response.output_item.done");
            match &item {
                OutputItem::FunctionCall {
                    call_id,
                    tool_name,
                    arguments,
                    response_id,
                } => {
                    common_response_id = Some(response_id.clone());
                    // Azure sends the item twice, `added` with empty arguments and `done` with
                    // them whole. The first call of a round loses its `added` to the stream type
                    // detection, so without this every later call is recorded twice, once with no
                    // arguments at all.
                    if finished {
                        pending_round_items.push(PendingRoundItem::FunctionCall {
                            tool_name: tool_name.clone(),
                            call_id: call_id.clone(),
                            arguments: arguments.clone(),
                        });
                    }
                    yield StreamEvent::Item(StreamItem { item, finished: false, defer_storage: false });
                }
                OutputItem::Message { content, .. } => {
                    if let MessageContent::Refusal(..) = content {
                        yield StreamEvent::Refusal(content.clone().get_content_text());
                        messages.push(APIOutputMessage { message_type: item });

                    } else {
                    Err(chatbot_err!(
                        StreamingError,
                        "Received a message item while parsing tool calls.".to_string()
                    ))?}
                },
                _ => {
                    // Storage is deferred to the round's finalize pass (see
                    // `PendingRoundItem::Passthrough` above), which is what keeps this item at its
                    // stream position relative to the round's function calls instead of landing
                    // ahead of all of them.
                    //
                    // Only the `done` copy is whole and only it is queued; taking the `added` one
                    // too would duplicate the item in the next request and, for reasoning, send it
                    // stripped of the payload Azure demands.
                    if finished {
                        yield StreamEvent::Item(StreamItem { item: item_without_reasoning_payload(&item), finished, defer_storage: true });
                        pending_round_items.push(PendingRoundItem::Passthrough(item));
                    } else {
                        yield StreamEvent::Item(StreamItem { item, finished, defer_storage: false });
                    }
                }
            }
        }
    }})
}

/// Reads the head of an Azure response until it is clear whether the round is a tool call or a
/// text answer.
///
/// Yields [`StreamEvent::Item`] for every output item seen while classifying, then a single
/// [`StreamEvent::ResponseIdStream`] handing the rest of the Azure stream on to the parser that
/// suits it. Errors if the response fails, arrives incomplete, or ends without classifying.
fn stream_and_detect_response_stream_type<'a>(
    mut lines: PeekableLinesStream<'a>,
) -> impl Stream<Item = ChatbotResult<StreamEvent<'a>>> {
    let mut response_id: Option<String> = None;
    let mut response_created_incoming = false;
    let mut error_incoming = false;
    let mut output_item_added = false;
    let mut output_item_done = false;

    Box::pin(async_stream::try_stream! {
    loop {
        let line_res = lines.next().await;
        match line_res {
            None => {
                break;
            }
            Some(val) => {
                let line = val?;
                let response_output = match ParsedResponseLine::parse(&line)? {
                    Some(ParsedResponseLine::Event(event_type)) => {
                        trace!("Event: {event_type}");
                        match event_type.as_str() {
                            "response.created" => {
                                response_created_incoming = true;
                            }
                            "response.output_item.added" => {
                                output_item_added = true;
                            }
                            "response.output_item.done" => {
                                output_item_done = true;
                            }
                            "response.function_call_arguments.delta" | "response.custom_tool_call_input.delta" => {
                                if let Some(id) = &response_id {
                                    yield StreamEvent::ResponseIdStream(
                                        id.to_string(),
                                        ResponseStreamType::ToolCall(lines),
                                    );
                                    break;
                                } else {
                                    Err(chatbot_err!(StreamingError,
                                        "No response_id found! This should never happen!"
                                    ))?;
                                };
                            }
                            "response.output_text.delta" | "response.refusal.delta" => {
                                if let Some(id) = &response_id {
                                    yield StreamEvent::ResponseIdStream(
                                        id.to_string(),
                                        ResponseStreamType::TextResponse(lines),
                                    );
                                    break;
                                } else {
                                    Err(chatbot_err!(StreamingError,
                                        "No response_id found! This should never happen!"
                                    ))?;
                                };
                            }
                            "response.incomplete" => {
                                // put in incomplete reason!
                                break Err(chatbot_err!(StreamingError, format!("Response incomplete. Response id: {}", response_id.as_deref().unwrap_or("not received"))))?
                            },
                            "response.error" | "error" | "response.failed" => { error_incoming = true; }
                            _ => {
                                if !ALL_EXPECTED_EVENTS.contains(&event_type.as_str()) {
                                    warn!("Received unexpected event from Azure: Event: {}", event_type);
                                };
                            }
                        }
                        continue;
                    }
                    Some(ParsedResponseLine::Data(response_output)) => response_output,
                    None => {
                        continue;
                    }
                };

                if error_incoming {
                    let fallback_error = chatbot_err!(StreamingError, format!("Response failed without receiving an API error. Response output: {:?} Response id: {}", &response_output, response_id.as_deref().unwrap_or("not received")));

                    if let Some(response) = response_output.response
                    && let Some(err) = response.error {
                        let mut error = chatbot_err!(
                            StreamingError,
                            format!("Error received from Azure API. Response id: {}", response_id.as_deref().unwrap_or("not received"))
                        );
                        error.add_azure_source(err);
                        break Err(error)?
                    } else if let Some(err) = response_output.error {
                        let mut error = chatbot_err!(
                            StreamingError,
                            format!("Error received from Azure API. Response id: {}", response_id.as_deref().unwrap_or("not received"))
                        );
                        error.add_azure_source(err);
                        break Err(error)?
                    } else {
                        break Err(fallback_error)?
                    };
                };
                if response_created_incoming {
                    let res = response_output.response.ok_or(chatbot_err!(
                        DeserializationError,
                        "Expected response object"
                    ))?;
                    response_id = res.id;
                    response_created_incoming = false;
                }
                if output_item_added {
                    let item = response_output.item.ok_or(chatbot_err!(
                        DeserializationError,
                        "Expected response output item"
                    ))?;
                    yield StreamEvent::Item(StreamItem {item, finished: false, defer_storage: false});
                    output_item_added = false;
                }
                else if output_item_done {
                    let item = response_output.item.ok_or(chatbot_err!(
                        DeserializationError,
                        "Expected response output item"
                    ))?;
                    yield StreamEvent::Item(StreamItem {item, finished: true, defer_storage: false});
                    output_item_done = false;
                }
            }
        }
        continue;
    }
    Err(chatbot_err!(StreamingError, format!(
        "The response received from Azure ended unexpectedly. Response id: {}", response_id.as_deref().unwrap_or("not received")
    )))?
    })
}

/// Parses the rest of a round already classified as a text answer, to the end of the Azure stream.
///
/// Yields [`StreamEvent::Delta`] per streamed token, [`StreamEvent::Item`] for the non-message
/// items that accompany it, and [`StreamEvent::Done`] once the whole answer has been stored on
/// `response_message`. Every delta is also appended to `full_response_text`, and `done` is set
/// before [`StreamEvent::Done`], so that the cancellation guard knows what it may still save.
/// Errors if Azure reports a failure, if a tool call arrives mid-answer, or if the stream ends
/// unfinished.
async fn parse_text_response<'a>(
    conn: &'a mut PgConnection,
    mut lines: PeekableLinesStream<'a>,
    full_response_text: Arc<Mutex<Vec<String>>>,
    done: Arc<AtomicBool>,
    response_message: ChatbotConversationMessage,
    response_id: String,
) -> BoxStream<'a, ChatbotResult<StreamEvent<'a>>> {
    trace!("Parsing stream to user...");

    let mut response_received = false;

    Box::pin(async_stream::try_stream! {
        while let Some(val) = lines.next().await {
            let line = val?;
            let response_output: ResponseOutput = match ParsedResponseLine::parse(&line)? {
                Some(ParsedResponseLine::Event(event_type)) => {
                    trace!("Event: {event_type}");
                    match event_type.as_str() {
                        "response.completed" | "response.incomplete" => {response_received = true;},
                        "response.output_text.delta" | "response.refusal.delta" => {
                            // streaming
                        },
                        "response.function_call_arguments.delta" | "response.custom_tool_call_input.delta" => {
                            error!("ERROR, function call received but can't be processed while streaming to user.");
                            return Err(chatbot_err!(StreamingError, "Unexpected function call while streaming to user"))?
                        },
                        "response.error" | "error" | "response.failed" => {
                            // error is logged in the next iteration
                        }
                        _ => {
                            if !ALL_EXPECTED_EVENTS.contains(&event_type.as_str()) {
                                warn!("Received unexpected event from Azure: Event: {}", event_type);
                            };
                        }
                    };
                    continue;
                },
                Some(ParsedResponseLine::Data(data)) => *data,
                None => {continue;},
            };

            if let Some(response) = response_output.response.as_ref()
                && let Some(usage) = response.usage.as_ref()
            {
                usage.log("streaming_answer", response.reasoning.as_ref());
            }

            // Surface any error the API reports (e.g. response.error, response.failed)
            // instead of continuing. Normal responses carry no error object.
            if let Some(response) = response_output.response
            && let Some(err) = response.error {
                let mut error = chatbot_err!(
                    StreamingError,
                    format!("Error received from Azure API. Response id: {}", &response_id)
                );
                error.add_azure_source(err);
                Err(error)?
            // Surface the error in case there is no response object, just an error
            } else if let Some(err) = response_output.error {
                let mut error = chatbot_err!(
                    StreamingError,
                    format!("Error received from Azure API. Response id: {}", &response_id)
                );
                error.add_azure_source(err);
                Err(error)?
            };

            let mut full_response_text = full_response_text.lock().await;

            if response_received {
                if let Some(response) = &response_output.incomplete_response {
                // todo: can add content filter results for more info
                Err(chatbot_err!(StreamingError,
                    format!("The LLM response is incomplete. Reason: {}", response.incomplete_details.reason)
                ))?
            };
                let full_response_as_string = full_response_text.join("");
                // todo: use the tokens given in the response
                let estimated_cost = estimate_tokens(&full_response_as_string);
                trace!(
                    "End of chatbot response stream. Estimated cost: {}. Response: {}",
                    estimated_cost, full_response_as_string
                );
                // Only the answer's own tokens. The conversation the request carried is already
                // counted on the messages it is built from, and a turn suspended on a client tool
                // call carries that same prefix again in every request that resumes it.
                models::chatbot_conversation_messages::update(
                    conn,
                    response_message.id,
                    &full_response_as_string,
                    true,
                    estimated_cost,
                ).await?;

                done.store(true, atomic::Ordering::Relaxed);
                yield StreamEvent::Done;
                break;
            }

            if let Some(delta) = &response_output.delta {
                full_response_text.push(delta.to_owned());
                yield StreamEvent::Delta(delta.clone());
            }

            if let Some(item) = &response_output.item {
                match item {
                    OutputItem::Message { .. } => continue,
                    OutputItem::FunctionCall { .. } => Err(chatbot_err!(StreamingError, "Error: unexpected function call after / during a text response.".to_string()))?,
                    _ => {
                        let finished = response_output.response_type.as_deref() == Some("response.output_item.done");
                        yield StreamEvent::Item(StreamItem { item: item.to_owned(), finished, defer_storage: false });
                        continue;
                    },
                };
            }
        }
        if !done.load(atomic::Ordering::Relaxed) {
            Err(chatbot_err!(StreamingError,"Stream ended unexpectedly"))?;
        }
    })
}

/// For passing streamed events and data between streaming functions.
enum StreamEvent<'a> {
    Delta(String),
    Refusal(String),
    Item(StreamItem),
    Messages(Vec<APIInputMessage>),
    ResponseIdStream(String, ResponseStreamType<'a>),
    Done,
    /// The round ended in a tool call only the client can answer, so the turn ends here and is
    /// continued by the request that brings the answer.
    Suspended,
}

#[derive(Debug, Clone)]
struct StreamItem {
    /// Item received from Azure.
    item: OutputItem,
    /// Has the item, like tool call or reasoning, been completed or is it in progress. When OutputItem is FunctionCallOutput, this field is ignored.
    finished: bool,
    /// Whether the item is stored later, at its correct position among the round's tool calls,
    /// rather than by the outer consumer as soon as this event is yielded.
    ///
    /// A tool-call round's function calls are only inserted once the round is known complete, so
    /// they land in `order_number` after every other item the round streamed in the meantime. A
    /// reasoning item stored immediately, the moment it streams, would then end up ahead of the
    /// call it actually reasoned about whenever a round makes more than one call — Azure rejects
    /// that item's `encrypted_content` on the next turn because it no longer sits where it was
    /// generated. Deferring it into the same ordered pass as the calls keeps the two aligned.
    defer_storage: bool,
}

/// Makes a request to Azure and returns the resulting stream.
async fn make_request_and_create_stream<'a>(
    chat_request: LLMRequest,
    app_config: &ApplicationConfiguration,
) -> ChatbotResult<PeekableLinesStream<'a>> {
    let response = make_streaming_llm_request(chat_request, app_config).await?;

    trace!("Receiving chat response with {:?}", response.version());

    // Replaces the client-wide read timeout, which reqwest arms once per request rather than per
    // chunk, so it cannot tell a stalled stream from a slow but healthy one.
    let stream = tokio_stream::StreamExt::timeout(response.bytes_stream(), STREAM_IDLE_TIMEOUT)
        .map(|chunk| match chunk {
            Ok(bytes) => bytes.map_err(std::io::Error::other),
            Err(_) => Err(std::io::Error::new(
                std::io::ErrorKind::TimedOut,
                format!(
                    "The LLM stream sent nothing for {} seconds",
                    STREAM_IDLE_TIMEOUT.as_secs()
                ),
            )),
        })
        .boxed();
    let reader = StreamReader::new(stream);
    let lines = reader.lines();
    let lines_stream = LinesStream::new(lines);
    let peekable_lines_stream = lines_stream.peekable();
    let pinned_lines = Box::pin(peekable_lines_stream);

    Ok(pinned_lines)
}

/// Creates a ChatbotChatStreamEvent::Error from the message and returns it in string form.
/// Either message or error should be Some.
/// If message is Some, use it as the StreamEvent message. Else, use ChatbotError's message.
/// error is either a ResponseError received from Azure and stored in ChatbotError, or
/// ChatbotError's error message, or None.
fn error_event_string_from_message(
    message: Option<&str>,
    error: Option<&ChatbotError>,
) -> ChatbotResult<String> {
    let (message, details): (&str, Option<String>) = if let Some(e) = error {
        let e_msg = if let Some(s) = e.azure_source() {
            format!("{s}")
        } else {
            e.message().to_string()
        };
        (message.unwrap_or(e.message()), Some(e_msg))
    } else {
        (
            message.ok_or(chatbot_err!(
                Other,
                "Called error_event_string_from_message with incorrect arguments"
            ))?,
            None,
        )
    };
    let err = ChatbotChatStreamEvent::Error(StreamEventError {
        message: message.to_string(),
        details,
    });
    serde_json::to_string(&err).map_err(ChatbotError::from)
}

/// These types of ChatbotErrors shouldn't be shown to the user and are likely created
/// from an unrecoverable error in our code that should make the stream fail.
fn check_error_should_terminate_stream(err: &ChatbotErrorType) -> bool {
    matches!(
        err,
        ChatbotErrorType::SerdeJson
            | ChatbotErrorType::DeserializationError
            | ChatbotErrorType::SqlxError
            | ChatbotErrorType::ReqwestError
            | ChatbotErrorType::UrlParse
    )
}

/// Turn a failed tool call into a function call output the LLM can act on, so it can
/// recover or explain the failure to the user instead of the turn dying.
///
/// Only messages written in tool code are passed through; anything else is reported
/// generically, because other messages are built from library errors and can carry
/// internals such as SQL or endpoint URLs.
fn tool_failure_output_for_llm(error: &ChatbotError) -> String {
    let reason = match error.error_type() {
        ChatbotErrorType::InvalidToolName
        | ChatbotErrorType::InvalidToolArguments
        | ChatbotErrorType::ToolUseError => error.message(),
        _ => "The tool is unavailable.",
    };
    format!(
        "The tool call failed and returned no data. Reason: {reason} Answer the user without this tool, or tell them what you would need to answer."
    )
}

/// Repairs the tool calls of the turn this request is itself running, so it aborts them whatever
/// their age. Use [answer_stale_unfinished_tool_calls] from a request that did not make them.
async fn answer_unfinished_tool_calls(
    conn: &mut PgConnection,
    conversation_id: Uuid,
) -> ChatbotResult<()> {
    answer_unfinished_tool_calls_created_before(conn, conversation_id, None).await?;
    Ok(())
}

/// How long a tool call must have gone unanswered before a request that did not make it may abort
/// it. A live turn writes a call and its output seconds apart, but a slow search or a reasoning
/// round widens that gap, and aborting inside it leaves two outputs for one `tool_call_id`.
const HANGING_TOOL_CALL_REAP_AFTER_MINUTES: i64 = 10;

/// Repairs tool calls left behind by turns that are long dead, without touching one that a turn
/// streaming in a concurrent request may still be about to answer. Returns the calls it left
/// unanswered.
async fn answer_stale_unfinished_tool_calls(
    conn: &mut PgConnection,
    conversation_id: Uuid,
) -> ChatbotResult<Vec<ChatbotConversationMessageToolCall>> {
    let cutoff = Utc::now() - chrono::Duration::minutes(HANGING_TOOL_CALL_REAP_AFTER_MINUTES);
    answer_unfinished_tool_calls_created_before(conn, conversation_id, Some(cutoff)).await
}

async fn answer_unfinished_tool_calls_created_before(
    conn: &mut PgConnection,
    conversation_id: Uuid,
    created_before: Option<DateTime<Utc>>,
) -> ChatbotResult<Vec<ChatbotConversationMessageToolCall>> {
    trace!(
        "Dealing with unfinished tool calls for conversation {}",
        conversation_id
    );
    headless_lms_models::chatbot_conversation_messages::answer_hanging_tool_call_messages_for_conversation(
        conn,
        conversation_id,
        created_before,
        HANGING_TOOL_CALL_ABORT_OUTPUT,
    )
    .await
    .map_err(ChatbotError::from)
}

/// Send and parse a Chatbot message and response and stream it to the user.
/// Controls the whole operation.
pub async fn send_chat_request_and_parse_stream(
    pool: PgPool,
    app_configuration: &ApplicationConfiguration,
    chatbot_configuration_id: Uuid,
    conversation_id: Uuid,
    message: &str,
    page_context: Option<ChatbotPageContext>,
    user_context: ChatbotUserContext,
) -> ChatbotResult<Pin<Box<dyn Stream<Item = ChatbotResult<Bytes>> + Send>>> {
    let mut conn = pool.acquire().await?;

    // A turn that dies without reaching one of the error paths below leaves a tool call with no
    // output, a history shape the LLM rejects for every later message of the conversation, so
    // repairing before the history is built is the only way such a conversation gets unstuck.
    // Only long-dead calls: another request may be streaming a turn of this same conversation.
    answer_stale_unfinished_tool_calls(&mut conn, conversation_id).await?;

    let app_config = app_configuration.to_owned();
    let chat_request = LLMRequest::build_and_insert_incoming_user_message_to_db(
        &mut conn,
        chatbot_configuration_id,
        conversation_id,
        message,
        page_context,
        &user_context,
        &app_config,
    )
    .await?;

    Ok(stream_turn(
        pool,
        app_config,
        conversation_id,
        chat_request,
        user_context,
    ))
}

/// Records a client's answer to a tool call the turn suspended on, and continues that turn once
/// nothing else is outstanding.
///
/// Of a round of parallel calls, only the request that answers the last one gets the resumed turn;
/// the others get a stream carrying `Suspended` again, so a client reads every response the same
/// way. `tool_call_id` must be a client-answered call of `conversation_id` that has no answer yet
/// and `answer` must fit what that call offered, or this fails with
/// [ChatbotErrorType::InvalidToolAnswer] and writes nothing.
pub async fn answer_tool_call_and_resume_stream(
    pool: PgPool,
    app_configuration: &ApplicationConfiguration,
    chatbot_configuration_id: Uuid,
    conversation_id: Uuid,
    tool_call_id: &str,
    answer: &ClientToolAnswer,
    user_context: ChatbotUserContext,
) -> ChatbotResult<Pin<Box<dyn Stream<Item = ChatbotResult<Bytes>> + Send>>> {
    let mut conn = pool.acquire().await?;

    // A call of another kind left without an output blocks the resume twice over: it counts as
    // outstanding when deciding whether the turn may continue, and the request the resume builds
    // would carry a call the LLM rejects for having no answer.
    // Only long-dead calls: another request may be streaming a turn of this same conversation.
    let unanswered = answer_stale_unfinished_tool_calls(&mut conn, conversation_id).await?;

    let answered = client_tool_output_for_answer(
        &mut conn,
        conversation_id,
        &unanswered,
        tool_call_id,
        answer,
        &user_context,
    )
    .await?;

    let outcome = models::chatbot_conversation_messages::answer_client_tool_call(
        &mut conn,
        conversation_id,
        tool_call_id,
        answered.output,
        answered.client_answer,
    )
    .await
    .map_err(rejected_tool_answer_error)?;

    if !outcome.turn_can_resume {
        trace!("Tool call {tool_call_id} answered, the turn is still waiting for another answer");
        return single_event_stream(ChatbotChatStreamEvent::Suspended);
    }

    let configuration =
        models::chatbot_configurations::get_by_id(&mut conn, chatbot_configuration_id).await?;
    let app_config = app_configuration.to_owned();
    let chat_request = LLMRequest::build_from_conversation(
        &mut conn,
        &configuration,
        conversation_id,
        &user_context,
        &app_config,
    )
    .await?;

    Ok(stream_turn(
        pool,
        app_config,
        conversation_id,
        chat_request,
        user_context,
    ))
}

/// What the model reads as the output of a call whose turn died before answering it.
const HANGING_TOOL_CALL_ABORT_OUTPUT: &str = "Unexpected error encountered, tool call aborted.";

/// What the model reads as the output of a client tool call the learner replaced with a new
/// message instead of answering.
const NEW_MESSAGE_ABORT_OUTPUT: &str = "The user sent a new message instead of answering this tool call, so it was never carried out and returned no data. Answer their new message; ask again only if you still need this.";

/// What the model reads as the output of a suspended tool call the caller may no longer use.
///
/// Written for the model rather than for the learner: it is the output of the model's own call,
/// and has to leave it able to carry on without the data it asked for.
const REVOKED_PERMISSION_TOOL_OUTPUT: &str = "The tool call was aborted and returned no data, because the user is no longer allowed to use this tool: their permissions changed while the call was waiting for them. Do not call this tool again in this conversation. Answer without it, or tell the user that you cannot do that step for them.";

/// What a client's answer to a suspended call amounts to once it is applied.
struct AnsweredClientToolCall {
    /// The tool output the resumed turn reads.
    output: String,
    /// The payload the client sent, or None when the call was aborted instead of answered.
    client_answer: Option<serde_json::Value>,
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
async fn client_tool_output_for_answer(
    conn: &mut PgConnection,
    conversation_id: Uuid,
    unanswered: &[ChatbotConversationMessageToolCall],
    tool_call_id: &str,
    answer: &ClientToolAnswer,
    user_context: &ChatbotUserContext,
) -> ChatbotResult<AnsweredClientToolCall> {
    let Some(tool_call) = unanswered
        .iter()
        .find(|call| call.tool_call_id == tool_call_id)
    else {
        return Err(missing_tool_call_error(conn, conversation_id, tool_call_id).await?);
    };

    let Some(permission) = client_tool_permission(&tool_call.tool_name) else {
        return Err(chatbot_err!(
            InvalidToolAnswer,
            format!("Tool call {tool_call_id} is not one a client answers")
        ));
    };

    apply_client_tool_answer(conn, tool_call, permission, answer, user_context).await
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
    tool_call: &ChatbotConversationMessageToolCall,
    permission: ToolPermission,
    answer: &ClientToolAnswer,
    user_context: &ChatbotUserContext,
) -> ChatbotResult<AnsweredClientToolCall> {
    if !permission.is_satisfied_by(conn, user_context).await? {
        warn!(
            tool_name = %tool_call.tool_name,
            "Aborting a suspended chatbot tool call: its caller no longer holds the permission it requires"
        );
        return Ok(AnsweredClientToolCall {
            output: REVOKED_PERMISSION_TOOL_OUTPUT.to_string(),
            client_answer: None,
        });
    }

    let output =
        client_tool_answer_output(&tool_call.tool_name, &tool_call.arguments_json(), answer)?;
    let ClientToolAnswer::Data { result } = answer;
    Ok(AnsweredClientToolCall {
        output,
        client_answer: Some(result.clone()),
    })
}

/// An answer the conversation has no room for is the client's mistake and has to reach it as a
/// client error instead of as a failed turn. Everything else stays a server fault.
fn rejected_tool_answer_error(error: ModelError) -> ChatbotError {
    match error.error_type() {
        ModelErrorType::RecordNotFound | ModelErrorType::InvalidRequest => {
            let message = error.message().to_string();
            chatbot_err!(InvalidToolAnswer, message, error)
        }
        _ => ChatbotError::from(error),
    }
}

/// A stream that carries one event and ends, for a response with no turn behind it.
fn single_event_stream(
    event: ChatbotChatStreamEvent,
) -> ChatbotResult<Pin<Box<dyn Stream<Item = ChatbotResult<Bytes>> + Send>>> {
    let line = Bytes::from(format!("{}\n", serde_json::to_string(&event)?));
    Ok(Box::pin(futures::stream::once(async move { Ok(line) })))
}

/// Runs the request rounds of one turn against the LLM and streams its events as NDJSON.
///
/// Keeps asking the LLM as long as a round ends in tool calls it answered itself, and ends the
/// turn on a text answer, an error, a suspension, or the iteration limit. Owns the cancellation
/// guard, so a client that disappears mid-turn still gets what arrived saved.
fn stream_turn(
    pool: PgPool,
    app_config: ApplicationConfiguration,
    conversation_id: Uuid,
    mut chat_request: LLMRequest,
    user_context: ChatbotUserContext,
) -> Pin<Box<dyn Stream<Item = ChatbotResult<Bytes>> + Send>> {
    let mut rounds_left = MAX_TOOL_CALL_ROUNDS_PER_TURN;

    // The id Azure assigns the round, for tying a failure to the request it came from. None
    // until the round has been classified.
    let mut response_id: Option<String> = None;

    let done = Arc::new(AtomicBool::new(false));
    let mut should_clean_tool_calls = false;
    let full_response_text = Arc::new(Mutex::new(Vec::new()));
    let response_message_id = Arc::new(Mutex::new(Uuid::nil()));

    let guard = RequestCancelledGuard {
        response_message_id: response_message_id.clone(),
        full_response_text: full_response_text.clone(),
        pool: pool.clone(),
        done: done.clone(),
    };

    let response_stream = async_stream::try_stream! {
        'outer: loop {
            let mut conn = pool.acquire().await?;

            if rounds_left == 0 {
                error!("Maximum tool call iterations exceeded");
                let event_string = error_event_string_from_message(Some("Maximum tool call iterations exceeded. The LLM may be stuck in a loop."), None)?;
                yield Bytes::from(event_string);
                yield Bytes::from("\n");
                done.store(true, atomic::Ordering::Relaxed);
                break 'outer;
            }
            rounds_left -= 1;

            let lines = match make_request_and_create_stream(chat_request.clone(), &app_config).await {
                Ok(val) => val,
                Err(error) => {
                    if check_error_should_terminate_stream(error.error_type()) {
                        break Err(error)?;
                    };
                    let event_string = error_event_string_from_message(None, Some(&error))?;
                    yield Bytes::from(event_string);
                    yield Bytes::from("\n");
                    done.store(true, atomic::Ordering::Relaxed);
                    break 'outer;
                },
            };
            let mut response_stream = stream_and_detect_response_stream_type(lines);
            let (received_response_id, typed_response_stream);
            loop {
                let Some(val) = response_stream.next().await else {
                    Err(chatbot_err!(StreamingError, "The response stream ended before its type could be determined"))?
                };
                match val {
                    Ok(StreamEvent::ResponseIdStream(id, stream)) => {
                        (received_response_id, typed_response_stream) = (id, stream);
                        break;
                    },
                    Ok(StreamEvent::Item(item)) => {
                        if item.finished {
                            // save it to db and put it in the LLM Request input
                            // in case another request will be made. Reuse the iteration's `conn`
                            // (still free here) instead of acquiring a second pool connection.
                            let message = process_output_item(&mut conn, item.item.to_owned(), conversation_id, &app_config).await?;
                            let input_message = APIInputMessage::try_from(message)?;
                            chat_request.input.push(input_message);

                        }
                        let event = ChatbotChatStreamEvent::from(item.to_owned());
                        if event != ChatbotChatStreamEvent::Invalid {
                            let event_string = serde_json::to_string(&event)?;
                            yield Bytes::from(event_string);
                            yield Bytes::from("\n");
                        };
                    },
                    Ok(StreamEvent::Refusal(text)) => {
                        // in practice this event shouldn't happen because when a refusal
                        // is being streamed, its streaming is done by parse_text_response.
                        error!("Chatbot refusal event encountered before response id was received.");
                        let message_id = *response_message_id.lock().await;
                        let event = ChatbotChatStreamEvent::Delta { text, message_id };
                        let event_string = serde_json::to_string(&event)?;
                        yield Bytes::from(event_string);
                        yield Bytes::from("\n");

                    },
                    Ok(StreamEvent::Done) => {
                        done.store(true, atomic::Ordering::Relaxed);
                        Err(chatbot_err!(StreamingError, "Stream ended unexpectedly."))?
                    },
                    Ok(StreamEvent::Messages(_)) | Ok(StreamEvent::Delta(_)) | Ok(StreamEvent::Suspended) => {
                        done.store(true, atomic::Ordering::Relaxed);
                        Err(chatbot_err!(StreamingError, "This shouldn't happen, only response items are expected before the response type is known."))?
                    },
                    Err(e) => {
                        error!(
                            input = %summarize_input_for_log(&chat_request.input),
                            "Stream ended unexpectedly. Response id: {} Error: {}", response_id.as_deref().unwrap_or("not received"), e
                        );
                        should_clean_tool_calls = true;
                        if check_error_should_terminate_stream(e.error_type()) {
                            if let Err(e2) = answer_unfinished_tool_calls(&mut conn, conversation_id).await {
                                error!("Error in chatbot streaming and couldn't answer unfinished tool calls: {e2}. Response id: {}", response_id.as_deref().unwrap_or("not received"));
                            };
                            return Err(e)?;
                        };
                        let event_string = error_event_string_from_message(None, Some(&e))?;
                        yield Bytes::from(event_string);
                        yield Bytes::from("\n");
                        done.store(true, atomic::Ordering::Relaxed);
                        break 'outer;
                    },
                }
            }

            response_id = Some(received_response_id.clone());

            let response_message: ChatbotConversationMessage;

            let mut final_stream = match typed_response_stream {
                ResponseStreamType::ToolCall(stream) => {
                    parse_tool(&mut conn, &app_config, stream, conversation_id, &user_context).await
                }
                ResponseStreamType::TextResponse(stream) => {
                    // create response_message once we need to start streaming to user.
                    response_message = models::chatbot_conversation_messages::insert(
                        &mut conn,
                        ChatbotConversationMessage {
                            conversation_id,
                            message: Message::Text(ChatbotConversationMessageMessage {
                                text: "".to_string(),
                                message_role: MessageRole::Assistant,
                                message_is_complete: false,
                                response_id: Some(received_response_id.clone()),
                                ..Default::default()
                            }),
                            ..Default::default()
                        },
                    ).await?;

                    // set the correct response_message_id
                    let mut response_message_id = response_message_id.lock().await;
                    *response_message_id = response_message.id;

                    // Move the citations of the turn onto the message that cites them before its
                    // text reaches the learner, so the markers in it have something behind them.
                    models::chatbot_conversation_messages_citations::attach_turn_citations_to_message(
                        &mut conn,
                        conversation_id,
                        response_message.id,
                    ).await?;

                    parse_text_response(&mut conn, stream, full_response_text.clone(), done.clone(), response_message, received_response_id).await
                }
            };

            let message_id = *response_message_id.lock().await;
            while let Some(line) = final_stream.next().await {
                let val = match line {
                    Ok(val) => val,
                    Err(e) => {
                        error!(
                            input = %summarize_input_for_log(&chat_request.input),
                            "Stream ended unexpectedly. Response id: {} Error: {}", response_id.as_deref().unwrap_or("not received"), e
                        );
                        let full_response_as_string = full_response_text.lock().await.join("");
                        let mut conn = pool.acquire().await?;
                        if !full_response_as_string.is_empty() {
                            // save the incomplete response received
                            let estimated_cost = estimate_tokens(&full_response_as_string);
                            models::chatbot_conversation_messages::update(
                                &mut conn,
                                message_id,
                                &full_response_as_string,
                                true,
                                estimated_cost,
                            ).await?;
                        };
                        should_clean_tool_calls = true;
                        if check_error_should_terminate_stream(e.error_type()) {
                            if let Err(e2) = answer_unfinished_tool_calls(&mut conn, conversation_id).await {
                                error!("Error in chatbot streaming and couldn't answer unfinished tool calls: {e2}. Response id: {}", response_id.as_deref().unwrap_or("not received"));
                            };
                            return Err(e)?;
                        };
                        let event_string = error_event_string_from_message(None, Some(&e))?;
                        yield Bytes::from(event_string);
                        yield Bytes::from("\n");
                        done.store(true, atomic::Ordering::Relaxed);
                        break 'outer;
                    }
                };
                match val {
                    StreamEvent::Delta(text) | StreamEvent::Refusal(text) => {
                        let delta = ChatbotChatStreamEvent::Delta { text, message_id };
                        let delta_as_string = serde_json::to_string(&delta)?;
                        yield Bytes::from(delta_as_string);
                        yield Bytes::from("\n");
                    },
                    StreamEvent::Item(stream_item) => {
                        match stream_item.item  {
                            OutputItem::FunctionCall { .. } | OutputItem::FunctionCallOutput { .. } => {
                                // item already processed
                            },
                            _ => {
                                // Storage of a `defer_storage` item is handled by the round that
                                // produced it, at its correct position among that round's tool
                                // calls: see `StreamItem::defer_storage`.
                                if stream_item.finished && !stream_item.defer_storage {
                                    let mut conn = pool.acquire().await?;
                                    process_output_item(&mut conn, stream_item.item.to_owned(), conversation_id, &app_config).await?;
                                }
                            },
                        };

                        let response = ChatbotChatStreamEvent::from(stream_item);
                        if response != ChatbotChatStreamEvent::Invalid {
                            let event_string = serde_json::to_string(&response)?;
                            yield Bytes::from(event_string);
                            yield Bytes::from("\n");
                        };
                    },
                    StreamEvent::Messages(messages) => {
                        chat_request.input.extend(messages);
                    },
                    StreamEvent::Done => {
                        let event =  ChatbotChatStreamEvent::Done;
                        let event_string = serde_json::to_string(&event)?;
                        yield Bytes::from(event_string);
                        yield Bytes::from("\n");
                        break 'outer;
                    }
                    StreamEvent::Suspended => {
                        let event = ChatbotChatStreamEvent::Suspended;
                        let event_string = serde_json::to_string(&event)?;
                        yield Bytes::from(event_string);
                        yield Bytes::from("\n");
                        // The turn ended on purpose, so the guard must not treat the conversation
                        // as one that died mid-answer and clean up after it.
                        done.store(true, atomic::Ordering::Relaxed);
                        break 'outer;
                    }
                    StreamEvent::ResponseIdStream(..) => {
                        done.store(true, atomic::Ordering::Relaxed);
                        Err(chatbot_err!(StreamingError, "This shouldn't happen, response stream received while already streaming a response stream to user."))?
                    },
                }
            }
        }
        if should_clean_tool_calls {
            let mut conn = pool.acquire().await?;
            answer_unfinished_tool_calls(&mut conn, conversation_id).await?;
        }

        if !done.load(atomic::Ordering::Relaxed) {
            let id = response_id.as_deref().unwrap_or("not received");
            let event_string = error_event_string_from_message(Some(format!("Stream ended unexpectedly. Response id: {id}").as_str()), None)?;
            yield Bytes::from(event_string);
            yield Bytes::from("\n");
        }
    };

    // Encapsulate the stream and the guard within GuardedStream. This moves the request guard into the stream and ensures that it is dropped when the stream is dropped.
    // This way we do cleanup only when the stream is dropped and not when this function returns.
    let guarded_stream = GuardedStream::new(guard, response_stream);

    Box::pin(guarded_stream)
}

#[cfg(test)]
mod tests {
    use headless_lms_models::{
        chatbot_conversation_message_tool_calls::ToolKind,
        insert_data,
        roles::UserRole,
        test_helper::{
            Conn, chatbot_reasoning_message, chatbot_text_message, chatbot_tool_call_message,
            chatbot_tool_output_message, init_app_conf, insert_chatbot_conversation,
        },
    };

    use super::*;
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

    /// Labels each replayed item so a test can assert the whole sequence, which `APIInputMessage`
    /// is not comparable enough to do directly.
    fn shape(items: &[APIInputMessage]) -> Vec<String> {
        items
            .iter()
            .map(|item| match &item.message_type {
                InputItem::Message { role, .. } => format!("message:{role}"),
                InputItem::FunctionCall { call_id, .. } => format!("call:{call_id}"),
                InputItem::FunctionCallOutput { call_id, .. } => format!("output:{call_id}"),
                InputItem::Reasoning { id, .. } => format!("reasoning:{id}"),
            })
            .collect()
    }

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

    fn picked_the_second_choice() -> ClientToolAnswer {
        ClientToolAnswer::Data {
            result: serde_json::json!({ "choice_index": 1 }),
        }
    }

    /// Nothing bounds how long a suspended call waits, so the permission it required can be gone
    /// by the time the answer arrives. The turn still needs an output to get unstuck, so the call
    /// is aborted with an explanation instead of the request failing.
    #[tokio::test]
    async fn an_answer_is_aborted_when_the_permission_it_needed_is_gone() {
        insert_data!(:tx, :user, :org, :course);
        let revoked = context(Some(user), Some(course), Vec::new());

        let aborted = apply_client_tool_answer(
            tx.as_mut(),
            &recorded_question(),
            ToolPermission::TeachesCourse,
            &picked_the_second_choice(),
            &revoked,
        )
        .await
        .expect("the call is aborted rather than failed");

        assert_eq!(aborted.output, REVOKED_PERMISSION_TOOL_OUTPUT);
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

        let applied = apply_client_tool_answer(
            tx.as_mut(),
            &recorded_question(),
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

    /// A `response.failed` line carries `error` as an object, not a string. Deserializing it
    /// must succeed so the error can be surfaced instead of crashing the stream parser.
    #[test]
    fn response_failed_with_error_object_deserializes() {
        let line = r#"{"type":"response.failed","response":{"id":"resp_abc","status":"failed","error":{"code":"tool_user_error","message":"Could not complete vectorization action."}},"sequence_number":8}"#;

        let parsed: ResponseOutput = serde_json::from_str(line).unwrap();
        let error = parsed
            .response
            .expect("response object")
            .error
            .expect("error object");

        assert_eq!(error.code.as_deref(), Some("tool_user_error"));
        assert!(error.message.unwrap().contains("vectorization"));
    }

    /// `Suspended` is terminal for the frontend reader, which tells the variants apart by `type`
    /// alone, and like `Done` it carries no `data` key at all.
    #[test]
    fn the_suspended_event_serialises_without_a_data_key() {
        assert_eq!(
            serde_json::to_string(&ChatbotChatStreamEvent::Suspended).unwrap(),
            r#"{"type":"Suspended"}"#
        );
    }

    /// The lines of a streamed Azure response, as the stream parsers read them.
    fn azure_response_stream<'a>(lines: &[&str]) -> PeekableLinesStream<'a> {
        let body = format!("{}\n", lines.join("\n"));
        let bytes: BoxStream<'a, Result<Bytes, std::io::Error>> =
            futures::stream::once(async move { Ok(Bytes::from(body)) }).boxed();
        Box::pin(LinesStream::new(StreamReader::new(bytes).lines()).peekable())
    }

    /// Azure sends an item as `added` before it sends it as `done`, and only the `done` copy is
    /// whole or stored. Carrying both into the next round would send the item twice, and with
    /// `store` off the `added` copy of a reasoning item has no `encrypted_content`, which Azure
    /// rejects outright.
    #[tokio::test]
    async fn only_the_finished_copy_of_a_streamed_item_reaches_the_next_round() {
        insert_data!(:tx);
        let (_configuration, conversation_id) = insert_chatbot_conversation(tx.as_mut()).await;
        let user_context = context(None, None, Vec::new());
        let app_config =
            ApplicationConfiguration::mock_conf().expect("the mock configuration builds");

        let mut events = parse_tool(
            tx.as_mut(),
            &app_config,
            azure_response_stream(&[
                "event: response.output_item.added",
                r#"data: {"type":"response.output_item.added","item":{"type":"reasoning","id":"rs_1","response_id":"resp_1","summary":[]}}"#,
                "event: response.output_item.done",
                r#"data: {"type":"response.output_item.done","item":{"type":"reasoning","id":"rs_1","response_id":"resp_1","summary":[],"encrypted_content":"payload"}}"#,
                "event: response.output_item.done",
                r#"data: {"type":"response.output_item.done","item":{"type":"function_call","id":"fc_1","response_id":"resp_1","call_id":"call_1","name":"no_such_tool","arguments":"{}"}}"#,
                "event: response.completed",
                r#"data: {"type":"response.completed","response":{"id":"resp_1"}}"#,
            ]),
            conversation_id,
            &user_context,
        )
        .await;

        let mut next_round = None;
        while let Some(event) = events.next().await {
            if let StreamEvent::Messages(messages) = event.expect("the round streams to the end") {
                next_round = Some(messages);
            }
        }
        drop(events);

        let next_round = next_round.expect("the round hands its items on");
        assert_eq!(
            shape(&next_round),
            vec!["reasoning:rs_1", "call:call_1", "output:call_1"],
        );
        let InputItem::Reasoning {
            encrypted_content, ..
        } = &next_round[0].message_type
        else {
            panic!("the first item is the reasoning item");
        };
        assert_eq!(encrypted_content.as_deref(), Some("payload"));
    }

    /// A message counts the tokens it added to the conversation. The conversation it was asked for
    /// is not counted again here, because a turn suspended on a client tool call sends that same
    /// prefix once per request it takes to finish, and charging it per request would multiply it.
    #[tokio::test]
    async fn a_streamed_answer_counts_its_own_tokens_and_not_the_prefix_it_answers() {
        insert_data!(:tx);
        let (_configuration, conversation) = insert_chatbot_conversation(tx.as_mut()).await;
        let prefix = "Which loop should I use here, and why is the other one worse?".repeat(20);
        chatbot_conversation_messages::insert(
            tx.as_mut(),
            ChatbotConversationMessage {
                conversation_id: conversation,
                message: Message::Text(ChatbotConversationMessageMessage {
                    text: prefix.clone(),
                    message_role: MessageRole::User,
                    message_is_complete: true,
                    used_tokens: estimate_tokens(&prefix),
                    ..Default::default()
                }),
                ..Default::default()
            },
        )
        .await
        .expect("the question is inserted");
        let response_message = chatbot_conversation_messages::insert(
            tx.as_mut(),
            ChatbotConversationMessage {
                conversation_id: conversation,
                message: Message::Text(ChatbotConversationMessageMessage {
                    message_role: MessageRole::Assistant,
                    response_id: Some("resp_answer".to_string()),
                    ..Default::default()
                }),
                ..Default::default()
            },
        )
        .await
        .expect("the answer is inserted");
        let answer = "A for loop.";

        let mut events = parse_text_response(
            tx.as_mut(),
            azure_response_stream(&[
                "event: response.output_text.delta",
                &format!(r#"data: {{"type":"response.output_text.delta","delta":"{answer}"}}"#),
                "event: response.completed",
                r#"data: {"type":"response.completed","response":{"id":"resp_answer"}}"#,
            ]),
            Arc::new(Mutex::new(Vec::new())),
            Arc::new(AtomicBool::new(false)),
            response_message.clone(),
            "resp_answer".to_string(),
        )
        .await;
        while let Some(event) = events.next().await {
            event.expect("the response streams to the end");
        }
        drop(events);

        let stored = models::chatbot_conversation_messages::get_message_fields(
            tx.as_mut(),
            response_message.id,
        )
        .await
        .expect("the answer is stored");
        let Message::Text(stored) = stored else {
            panic!("the answer is a text message");
        };
        assert_eq!(stored.text, answer);
        assert_eq!(stored.used_tokens, estimate_tokens(answer));
    }

    /// Azure returns azure_ai_search call/output items with `arguments`/`output` as strings.
    #[test]
    fn azure_ai_search_output_items_deserialize() {
        let call = r#"{"type":"azure_ai_search_call","id":"fc_1","response_id":"resp_abc","call_id":"call_1","arguments":"{\"query\":\"trademarks\"}","status":"completed"}"#;
        match serde_json::from_str::<OutputItem>(call).unwrap() {
            OutputItem::AzureAiSearchCall { arguments, .. } => {
                assert!(arguments.contains("trademarks"))
            }
            other => panic!("expected AzureAiSearchCall, got {other:?}"),
        }

        let output = r#"{"type":"azure_ai_search_call_output","id":"fco_1","response_id":"resp_abc","call_id":"call_1","output":"remote tool call failed","status":"in_progress"}"#;
        match serde_json::from_str::<OutputItem>(output).unwrap() {
            OutputItem::AzureAiSearchCallOutput { output, .. } => {
                assert_eq!(output, "remote tool call failed")
            }
            other => panic!("expected AzureAiSearchCallOutput, got {other:?}"),
        }
    }
}
