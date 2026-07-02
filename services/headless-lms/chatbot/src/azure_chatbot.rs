use std::collections::HashMap;
use std::pin::Pin;
use std::sync::{
    Arc,
    atomic::{self, AtomicBool},
};
use std::task::{Context, Poll};

use anyhow::{Error, anyhow};
use bytes::Bytes;
use chrono::Utc;
use futures::stream::{BoxStream, Peekable};
use futures::{Stream, StreamExt, TryStreamExt};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_configurations::{ReasoningEffortLevel, VerbosityLevel};
use headless_lms_models::chatbot_conversation_message_messages::{
    ChatbotConversationMessageMessage, MessageRole,
};
use headless_lms_models::chatbot_conversation_messages::{
    self, ChatbotConversationMessage, Message,
};
use pin_project::pin_project;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use tokio::{io::AsyncBufReadExt, sync::Mutex};
use tokio_stream::wrappers::LinesStream;
use tokio_util::io::StreamReader;
use tracing::trace;
use url::Url;
use utoipa::ToSchema;

use crate::chatbot_error::ChatbotResult;
use crate::chatbot_tools::provider_tools::azure_ai_search::get_azure_ai_search_tool_definition;
use crate::chatbot_tools::{
    AzureLLMToolDefinition, ChatbotTool, get_chatbot_tool, get_chatbot_tool_definitions,
};
use crate::citations::chatbot_cited_documents_to_citations;
use crate::llm_utils::{
    APIInputMessage, APIOutputMessage, MessageContent, estimate_tokens, get_params_for_model,
    make_streaming_llm_request,
};

use crate::prelude::*;

pub const CONTENT_FIELD_SEPARATOR: &str = ",|||,";

/// Appended to the system prompt when course-material search is enabled, to ground answers
/// in retrieved course material.
const SEARCH_GROUNDING_INSTRUCTION: &str = "\n\nSearch the course material with the azure_ai_search tool before answering, and ground your answer in the results with citations. Put only what you want to find in the query; the search is already limited to this course, so don't include the course name. Searching more than once is fine when it helps — to cover distinct sub-questions or angles, to refine when the first results don't answer, or when a follow-up or new instruction needs material you don't already have. When one search already answers, stop there. Skip searching only for messages that don't need course material, like greetings or thanks.";

enum ParsedResponseLine {
    Event(String),
    Data(Box<ResponseOutput>),
}

impl ParsedResponseLine {
    pub fn parse(input: &str) -> ChatbotResult<Option<Self>> {
        if input.starts_with("event: ") {
            let event_type = input.trim_start_matches("event: ").to_string();
            Ok(Some(ParsedResponseLine::Event(event_type)))
        } else if input.starts_with("data: ") {
            let data = input.trim_start_matches("data: ").to_string();
            let response_output = match serde_json::from_str::<ResponseOutput>(&data) {
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

/// Context about the user and course for a chatbot interaction.
/// Passed to tool implementations so they can access user-specific data.
pub struct ChatbotUserContext {
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub course_name: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct ContentFilterResults {
    pub hate: Option<ContentFilter>,
    pub self_harm: Option<ContentFilter>,
    pub sexual: Option<ContentFilter>,
    pub violence: Option<ContentFilter>,
    //pub jailbreak: Option<ContentFilter>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct ContentFilter {
    pub blocked: bool,
    pub source_type: ContentFilterSource,
    pub content_filter_results: Vec<ContentFilterResults>,
}
#[derive(Deserialize, Serialize, Debug)]
pub struct ContentFilterResult {
    pub filtered: bool,
    pub severity: String,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "snake_case")]
pub enum ContentFilterSource {
    Prompt,
    Completion,
}

/// Response received from LLM API
#[derive(Deserialize, Serialize, Debug)]
pub struct Response {
    pub id: String,
    pub error: Option<ResponseError>,
}

/// Error object returned by the LLM API on a failed response. Fields are optional so any
/// error shape deserializes rather than crashing the stream parser.
#[derive(Deserialize, Serialize, Debug)]
pub struct ResponseError {
    pub code: Option<String>,
    pub message: Option<String>,
}

impl std::fmt::Display for ResponseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{} (code: {})",
            self.message.as_deref().unwrap_or("unknown error"),
            self.code.as_deref().unwrap_or("none")
        )
    }
}

/// Incomplete response received from LLM API
#[derive(Deserialize, Serialize, Debug)]
pub struct IncompleteResponse {
    pub id: String,
    pub incomplete_details: IncompleteReason,
    pub content_filters: Vec<ContentFilter>,
}

/// Response received from LLM API
#[derive(Deserialize, Serialize, Debug)]
pub struct IncompleteReason {
    pub reason: String,
}

/// Streamed token of the response text
#[derive(Deserialize, Serialize, Debug)]
pub struct ResponseOutput {
    #[serde(rename = "type")]
    pub response_type: String,
    pub delta: Option<String>,
    pub item: Option<OutputItem>,
    pub response: Option<Response>,
    pub incomplete_response: Option<IncompleteResponse>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
pub enum OutputItem {
    Message {
        response_id: String,
        role: MessageRole,
        content: MessageContent,
        // todo phase for reasoning preamble
        #[serde(skip_serializing_if = "Option::is_none")]
        phase: Option<MessagePhase>,
    },
    Reasoning {
        response_id: String,
        id: String,
        summary: Vec<ReasoningOutput>,
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

/// Phase determines how to react to the message. Commentary-phase can have e.g.
/// a reasoning preamble, and final answer is self-explanatory.
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "snake_case")]
pub enum MessagePhase {
    Commentary,
    FinalAnswer,
}

impl From<StreamItem> for ChatbotChatStreamEvent {
    fn from(value: StreamItem) -> Self {
        match value {
            StreamItem {
                item: OutputItem::Reasoning { id, .. },
                finished,
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
            } => ChatbotChatStreamEvent::ToolCall {
                tool_name: Some("azure_ai_search".to_string()),
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
                finished,
            } => ChatbotChatStreamEvent::ToolCall {
                tool_name: Some(tool_name),
                arguments: Some(arguments),
                tool_call_id: call_id,
                finished,
            },
            StreamItem {
                item: OutputItem::AzureAiSearchCallOutput { call_id, .. },
                ..
            } => ChatbotChatStreamEvent::ToolCall {
                tool_name: Some("azure_ai_search".to_string()),
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
            _ => ChatbotChatStreamEvent::None,
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
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(untagged)]
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
#[serde(rename_all = "snake_case")]
pub enum JSONType {
    JsonSchema,
    Object,
    Array,
    String,
}

/// Defines LLM structured output shape and types
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Schema {
    #[serde(rename = "type")]
    /// Type of the schema, should be Object
    pub type_field: JSONType,
    // only array-type properties are supported for now
    pub properties: HashMap<String, SchemaPropertyType>,
    /// All 'properties' keys must be included in this 'required' list
    pub required: Vec<String>,
    /// additionalProperties should always be 'false'
    pub additional_properties: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum SchemaPropertyType {
    ArrayProperty(ArrayProperty),
    Object(Schema),
    Item(JsonItem),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ArrayProperty {
    #[serde(rename = "type")]
    pub type_field: JSONType,
    pub items: ArrayItem,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum ArrayItem {
    Schema(Schema),
    JsonItem(JsonItem),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct JsonItem {
    #[serde(rename = "type")]
    pub type_field: JSONType,
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
    pub max_output_tokens: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<RequestTextOptions>,
    #[serde(flatten)]
    pub params: LLMRequestParams,
}

impl LLMRequest {
    pub async fn build_and_insert_incoming_user_message_to_db(
        conn: &mut PgConnection,
        chatbot_configuration_id: Uuid,
        conversation_id: Uuid,
        message: &str,
        app_config: &ApplicationConfiguration,
    ) -> anyhow::Result<(Self, i32)> {
        let configuration =
            models::chatbot_configurations::get_by_id(conn, chatbot_configuration_id).await?;

        let model = models::chatbot_configurations_models::get_by_chatbot_configuration_id(
            conn,
            chatbot_configuration_id,
        )
        .await?;

        let conversation_messages =
            models::chatbot_conversation_messages::get_by_conversation_id(conn, conversation_id)
                .await?;

        let new_order_number = conversation_messages
            .iter()
            .map(|m| m.order_number)
            .max()
            .unwrap_or(0)
            + 1;

        let new_message = models::chatbot_conversation_messages::insert(
            conn,
            ChatbotConversationMessage {
                id: Uuid::new_v4(),
                order_number: new_order_number,
                created_at: Utc::now(),
                updated_at: Utc::now(),
                deleted_at: None,
                conversation_id,
                message: Message::Text(ChatbotConversationMessageMessage {
                    text: message.to_string(),
                    message_role: MessageRole::User,
                    message_is_complete: true,
                    used_tokens: estimate_tokens(message),
                    ..Default::default()
                }),
            },
        )
        .await?;

        let mut api_chat_messages: Vec<APIInputMessage> = conversation_messages
            .into_iter()
            .filter_map(|m| match m.message {
                Message::Reasoning(..) => None,
                _ => Some(APIInputMessage::try_from(m)),
            })
            .collect::<ChatbotResult<Vec<_>>>()?;

        // put new user message into the messages list
        api_chat_messages.push(new_message.clone().try_into()?);

        let mut system_prompt = configuration.prompt.clone();
        if configuration.use_azure_search {
            system_prompt.push_str(SEARCH_GROUNDING_INSTRUCTION);
        }

        api_chat_messages.insert(
            0,
            APIInputMessage {
                message_type: InputItem::Message {
                    role: MessageRole::System,
                    content: MessageContent::Text(system_prompt),
                },
            },
        );

        let mut tools = if configuration.use_tools {
            get_chatbot_tool_definitions()
        } else {
            Vec::new()
        };

        if configuration.use_azure_search {
            tools.extend(vec![AzureLLMToolDefinition::Search(
                get_azure_ai_search_tool_definition(
                    app_config,
                    configuration.course_id,
                    configuration.use_semantic_reranking,
                )?,
            )]);
        };

        let tool_choice = if configuration.use_azure_search || configuration.use_tools {
            Some(LLMToolChoice::Auto)
        } else {
            None
        };

        let serialized_messages = serde_json::to_string(&api_chat_messages)?;
        let request_estimated_tokens = estimate_tokens(&serialized_messages);

        let params = get_params_for_model(&model.model, &model.model_type, Some(&configuration));

        Ok((
            Self {
                input: api_chat_messages,
                model: model.model,
                max_output_tokens: Some(configuration.max_output_tokens),
                tools,
                tool_choice,
                text: Some(RequestTextOptions {
                    verbosity: Some(configuration.verbosity),
                    format: None,
                }),
                params,
            },
            request_estimated_tokens,
        ))
    }
}

// todo: remove?
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatResponse {
    pub text: String,
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
    Error {
        message: String,
    },
    None,
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
    S: Stream<Item = anyhow::Result<Bytes>> + Send,
{
    type Item = S::Item;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = self.project();
        this.stream.poll_next(cx)
    }
}

/// A LinesStream that is peekable. Needed to determine which type of LLM response is
/// being received.
type PeekableLinesStream<'a> = Pin<
    Box<Peekable<LinesStream<StreamReader<BoxStream<'a, Result<Bytes, std::io::Error>>, Bytes>>>>,
>;
pub enum ResponseStreamType<'a> {
    Toolcall(PeekableLinesStream<'a>),
    TextResponse(PeekableLinesStream<'a>),
}

struct RequestCancelledGuard {
    response_message_id: Arc<Mutex<Uuid>>,
    received_string: Arc<Mutex<Vec<String>>>,
    pool: PgPool,
    done: Arc<AtomicBool>,
    request_estimated_tokens: i32,
}

impl Drop for RequestCancelledGuard {
    fn drop(&mut self) {
        if self.done.load(atomic::Ordering::Relaxed) {
            return;
        }
        warn!("Request was not cancelled. Cleaning up.");
        let response_message_id = self.response_message_id.clone();
        let received_string = self.received_string.clone();
        let pool = self.pool.clone();
        let request_estimated_tokens = self.request_estimated_tokens;
        tokio::spawn(async move {
            info!("Verifying the received message has been handled");
            let mut conn = pool.acquire().await.expect("Could not acquire connection");
            let full_response_text = received_string.lock().await;
            let id = response_message_id.lock().await.to_owned();
            if full_response_text.is_empty() {
                info!("No response received. Deleting the response message");
                models::chatbot_conversation_messages::delete(&mut conn, id)
                    .await
                    .expect("Could not delete response message");
                return;
            }
            info!("Response received but not completed. Saving the text received so far.");
            let full_response_as_string = full_response_text.join("");
            let estimated_cost = estimate_tokens(&full_response_as_string);
            info!(
                "End of chatbot response stream. Estimated cost: {}. Response: {}",
                estimated_cost, full_response_as_string
            );

            // Update with request_estimated_tokens + estimated_cost
            models::chatbot_conversation_message_messages::update(
                &mut conn,
                id,
                &full_response_as_string,
                true,
                request_estimated_tokens + estimated_cost,
            )
            .await
            .expect("Could not update response message");
        });
    }
}

/// For saving output items that are not text messages or function calls, i.e. that
/// don't need further processing and are not streamed to the user.
/// Saves reasoning and Azure AI Search items.
pub async fn process_output_item(
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
                    response_id,
                },
            }
            .to_chatbot_conversation_message(conversation_id)?;

            let conversation_message = chatbot_conversation_messages::insert(conn, message).await?;

            chatbot_cited_documents_to_citations(
                conn,
                app_config.test_chatbot,
                get_urls,
                api_key,
                conversation_message.id,
                conversation_id,
            )
            .await?;

            ChatbotResult::Ok(conversation_message)
        }
        OutputItem::Message { .. } => {
            // this chunk has a text message and should be streamed!
            Err(chatbot_err!(
                StreamingError,
                "Unexpected message output item, it should have been streamed.".to_string()
            ))
        }
        OutputItem::FunctionCall { .. } => {
            // this chunk has tool call data andit should already be saved!!
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

/// Streams and parses a LLM response from Azure that contains function calls.
/// Calls the functions and yields a Vec of function results to be sent to Azure.
/// Consumes the lines (stream), because it ends when a custom function call is made.
/// Returns a stream to be consumed in the caller.
async fn parse_tool<'a>(
    conn: &'a mut PgConnection,
    mut lines: PeekableLinesStream<'a>,
    conversation_id: Uuid,
    user_context: &'a ChatbotUserContext,
) -> BoxStream<'a, ChatbotResult<StreamEvent<'a>>> {
    let mut function_name_id_args: Vec<(String, String, Value)> = vec![];
    let mut messages = vec![];
    let mut common_response_id: Option<String> = None;
    let mut response_received = false;

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
                    _ => {}
                };
                continue;
            }
            Some(ParsedResponseLine::Data(data)) => *data,
            None => {
                continue;
            }
        };

        // Surface any error the API reports (e.g. response.error, response.failed)
        // instead of continuing. Normal responses carry no error object.
        if let Some(response) = &response_output.response
        && let Some(error) = &response.error
        {
            Err(chatbot_err!(
                StreamingError,
                format!("Error received from the API: {}. Response id: {}", error, response.id)
            ))?
        };

        if response_received {
            // the stream ended
            if let Some(response) = &response_output.incomplete_response {
                // todo: can add content filter results for more info
                Err(chatbot_err!(StreamingError,
                    format!("The LLM response is incomplete. Reason: {}", response.incomplete_details.reason)
                ))?
            };
            if function_name_id_args.is_empty() {
                Err(chatbot_err!(StreamingError,
                    "The LLM response was supposed to contain function calls, but no function calls were found"
                ))?
            }
            let Some(response_id) = common_response_id else {
                Err(chatbot_err!(StreamingError,
                    "Received tool response but response id not found, this shouldn't happen."
                ))?
            };
            let mut tool_msgs = Vec::new();

            for (name, id, args) in function_name_id_args.iter() {
                let tool = get_chatbot_tool(conn, name, args, user_context).await?;
                let output = tool.get_tool_output();

                tool_msgs.push(APIOutputMessage {
                    message_type: OutputItem::FunctionCall {
                        response_id: response_id.to_owned(),
                        call_id: id.to_owned(),
                        tool_name: name.to_owned(),
                        arguments: serde_json::to_string(tool.get_arguments())?,
                    },
                });
                let function_call_output = OutputItem::FunctionCallOutput {
                        call_id: id.to_owned(),
                        output,
                        response_id: response_id.to_owned(),
                    };
                tool_msgs.push(APIOutputMessage {
                    message_type: function_call_output.to_owned(),
                });
                yield StreamEvent::Item(StreamItem {
                    item: function_call_output,
                    finished: true,
                });
            }
            // save tool_msgs to the db
            let mut tx = conn.begin().await.map_err(|e| anyhow::anyhow!(e))?;
            for m in &tool_msgs {
                chatbot_conversation_messages::insert(
                    &mut tx,
                    m.to_chatbot_conversation_message(conversation_id)?,
                )
                .await?;
            }
            tx.commit().await.map_err(|e| anyhow::anyhow!(e))?;

            messages.extend(tool_msgs);
            let input_messages = messages.into_iter().map(APIInputMessage::from).collect::<Vec<APIInputMessage>>();
            yield StreamEvent::Messages(input_messages);
            break;
        } else if let Some(item) = response_output.item {
            match item.to_owned() {
                OutputItem::FunctionCall {
                    call_id,
                    tool_name,
                    arguments,
                    response_id,
                } => {
                    common_response_id = Some(response_id);
                    function_name_id_args.push((
                        tool_name,
                        call_id,
                        serde_json::from_str::<Value>(&arguments)?,
                    ));
                    yield StreamEvent::Item(StreamItem { item, finished: false });
                }
                OutputItem::Message { .. } => Err(chatbot_err!(
                    StreamingError,
                    "Error: unexpected message item !!!".to_string()
                ))?,
                _ => {
                    let finished = response_output.response_type.as_str() == "response.output_item.done";
                    yield StreamEvent::Item(StreamItem { item: item.to_owned(), finished});

                    // add this output item to the messages to be included in the next
                    // LLMRequest
                    messages.push(APIOutputMessage { message_type: item });
                }
            }
        }
    }})
}

/// Stream from Azure and return the stream when a text response or tool call response is detected.
/// Tool calls and text responses are processed later with differing logic.
/// Returns a stream to be consumed in the caller.
/// Yields the lines (stream) argument, which is the Azure stream.
fn stream_and_detect_response_stream_type<'a>(
    mut lines: PeekableLinesStream<'a>,
) -> impl Stream<Item = Result<StreamEvent<'a>, anyhow::Error>> {
    let mut response_id: Option<String> = None;
    let mut response_created_incoming = false;
    let mut error_incoming = false;
    let mut output_item_added = false;
    let mut output_item_done = false;

    Box::pin(async_stream::try_stream! {
    loop {
        let line_res = lines.as_mut().peek().await;
        match line_res {
            None => {
                break;
            }
            Some(Err(e)) => {
                Err(anyhow!(
                    "There was an error streaming response from Azure: {e}. Response id: {}", response_id.as_deref().unwrap_or("not received")
                ))?;
            }
            Some(Result::Ok(line)) => {
                match ParsedResponseLine::parse(line)? {
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
                            "response.function_call_arguments.delta" => {
                                if let Some(id) = &response_id {
                                    yield StreamEvent::ResponseIdStream((
                                        id.to_string(),
                                        ResponseStreamType::Toolcall(lines),
                                    ));
                                    break;
                                } else {
                                    Err(anyhow::anyhow!(
                                        "No response_id found! This should never happen!"
                                    ))?;
                                };
                            }
                            "response.output_text.delta" => {
                                if let Some(id) = &response_id {
                                    yield StreamEvent::ResponseIdStream((
                                        id.to_string(),
                                        ResponseStreamType::TextResponse(lines),
                                    ));
                                    break;
                                } else {
                                    Err(anyhow::anyhow!(
                                        "No response_id found! This should never happen!"
                                    ))?;
                                };
                            }
                            "response.incomplete" => {
                                break Err(anyhow::anyhow!("Response incomplete. Response id: {}", response_id.as_deref().unwrap_or("not received")))?
                            },
                            "response.error" => { error_incoming = true; }
                            _ => {}
                        }
                    }
                    Some(ParsedResponseLine::Data(response_output)) => {
                        if error_incoming {
                            let res = response_output.response.ok_or(chatbot_err!(
                                DeserializationError,
                                "Expected response object"
                            ))?;
                            let res_error = res.error.ok_or(chatbot_err!(
                                DeserializationError,
                                "Expected error object"
                            ))?;

                            break Err(anyhow::anyhow!("Error received from Azure: {} Response id: {}", res_error, response_id.as_deref().unwrap_or("not received")))?
                        }
                        else if response_created_incoming {
                            let res = response_output.response.ok_or(chatbot_err!(
                                DeserializationError,
                                "Expected response object"
                            ))?;
                            response_id = Some(res.id);
                            response_created_incoming = false;
                        }
                        if output_item_added {
                            let item = response_output.item.ok_or(chatbot_err!(
                                DeserializationError,
                                "Expected response output item"
                            ))?;
                            yield StreamEvent::Item(StreamItem {item, finished: false});
                            output_item_added = false;
                        }
                        else if output_item_done {
                            let item = response_output.item.ok_or(chatbot_err!(
                                DeserializationError,
                                "Expected response output item"
                            ))?;
                            yield StreamEvent::Item(StreamItem {item, finished: true});
                            output_item_done = false;
                        }
                    }
                    None => {}
                }
            }
        }
        lines.next().await;
        continue;
    }
    Err(Error::msg(format!(
        "The response received from Azure ended unexpectedly. Response id: {}", response_id.as_deref().unwrap_or("not received")
    )))?
    })
}

/// Streams and parses an LLM response from Azure that contains a text response.
/// Consumes the lines (stream) from Azure, because the stream ends when a text response
/// is finished.
/// Returns a stream to be consumed in the caller.
async fn parse_text_response<'a>(
    conn: &'a mut PgConnection,
    mut lines: PeekableLinesStream<'a>,
    full_response_text: Arc<Mutex<Vec<String>>>,
    done: Arc<AtomicBool>,
    response_message: ChatbotConversationMessage,
    request_estimated_tokens: i32,
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
                        "response.output_text.delta" => {
                            // streaming
                        },
                        "response.function_call_arguments.delta" => {
                            error!("ERROR, function call received but can't be processed while streaming to user.");
                            return Err(chatbot_err!(StreamingError, format!("Unexpected function call while streaming to user")))?
                        },
                        _ => {},
                    };
                    continue;
                },
                Some(ParsedResponseLine::Data(data)) => *data,
                None => {continue;},
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
                models::chatbot_conversation_messages::update(
                    conn,
                    response_message.id,
                    &full_response_as_string,
                    true,
                    request_estimated_tokens + estimated_cost,
                ).await?;

                done.store(true, atomic::Ordering::Relaxed);
                yield StreamEvent::Done;
                break;
            }

            // Surface any error the API reports (e.g. response.error, response.failed)
            // instead of continuing. Normal responses carry no error object.
            if let Some(response) = &response_output.response
            && let Some(error) = &response.error
            {
                Err(chatbot_err!(StreamingError, format!("Error received from the API: {}. Response id: {}", error, response.id)))?
            };

            if let Some(delta) = &response_output.delta {
                full_response_text.push(delta.to_owned());
                yield StreamEvent::Delta(delta.clone());
            }

            if let Some(item) = &response_output.item {
                match item {
                    OutputItem::Message { .. } => continue,
                    OutputItem::FunctionCall { .. } => Err(chatbot_err!(StreamingError, "Error: unexpected function call after / during a text response.".to_string()))?,
                    _ => {
                        let finished = &response_output.response_type == "response.output_item.done";
                        yield StreamEvent::Item(StreamItem { item: item.to_owned(), finished });
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
    Item(StreamItem),
    Messages(Vec<APIInputMessage>),
    ResponseIdStream((String, ResponseStreamType<'a>)),
    Done,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
struct StreamItem {
    /// Item received from Azure.
    item: OutputItem,
    /// Has the item, like tool call or reasoning, been completed or is it in progress. When OutputItem is FunctionCallOutput, this field is ignored.
    finished: bool,
}

/// Makes a request to Azure and returns the resulting stream.
pub async fn make_request_and_create_stream<'a>(
    chat_request: LLMRequest,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<PeekableLinesStream<'a>> {
    let response = make_streaming_llm_request(chat_request, app_config).await?;

    trace!("Receiving chat response with {:?}", response.version());

    if !response.status().is_success() {
        let status = response.status();
        let error_message = response.text().await?;
        return Err(anyhow::anyhow!(
            "Failed to send chat request. Status: {}. Error: {}",
            status,
            error_message
        ));
    }

    let stream = response
        .bytes_stream()
        .map_err(std::io::Error::other)
        .boxed();
    let reader = StreamReader::new(stream);
    let lines = reader.lines();
    let lines_stream = LinesStream::new(lines);
    let peekable_lines_stream = lines_stream.peekable();
    let pinned_lines = Box::pin(peekable_lines_stream);

    Ok(pinned_lines)
}

/// Send and parse a Chatbot message and response and stream it to the user.
/// Controls the whole operation.
pub async fn send_chat_request_and_parse_stream(
    pool: PgPool,
    app_configuration: &ApplicationConfiguration,
    chatbot_configuration_id: Uuid,
    conversation_id: Uuid,
    message: &str,
    user_context: ChatbotUserContext,
) -> anyhow::Result<Pin<Box<dyn Stream<Item = anyhow::Result<Bytes>> + Send>>> {
    let mut conn = pool.acquire().await?;
    let app_config = app_configuration.to_owned();
    let (mut chat_request, request_estimated_tokens) =
        LLMRequest::build_and_insert_incoming_user_message_to_db(
            &mut conn,
            chatbot_configuration_id,
            conversation_id,
            message,
            &app_config,
        )
        .await?;

    let mut max_iterations_left = 15;

    // response id created by Azure, can be used in figuring out what went wrong if
    // request or streaming fails. also stored in the db.
    let response_id = Arc::new(Mutex::new(String::new()));

    let done = Arc::new(AtomicBool::new(false));
    let full_response_text = Arc::new(Mutex::new(Vec::new()));
    let response_message_id = Arc::new(Mutex::new(Uuid::nil()));

    // Instantiate the guard before creating the stream.
    let guard = RequestCancelledGuard {
        response_message_id: response_message_id.clone(),
        received_string: full_response_text.clone(),
        pool: pool.clone(),
        done: done.clone(),
        request_estimated_tokens,
    };

    let response_stream = async_stream::try_stream! { 'outer: loop
        {
            let mut conn = pool.acquire().await?;

            max_iterations_left -= 1;
            if max_iterations_left == 0 {
                error!("Maximum tool call iterations exceeded");
                let err_message = "Maximum tool call iterations exceeded. The LLM may be stuck in a loop.";
                let err = ChatbotChatStreamEvent::Error { message: err_message.to_string() };
                let event_string = serde_json::to_string(&err)?;
                yield Bytes::from(event_string);
                yield Bytes::from("\n");
                break 'outer Err(anyhow::anyhow!(err_message))?
            }

            let lines = make_request_and_create_stream(chat_request.clone(), &app_config)
                    .await?;
            let mut response_stream = stream_and_detect_response_stream_type(lines);
            let (received_response_id, typed_response_stream);
            loop {
                if let Some(val) = response_stream.next().await {
                match val {
                    Ok(StreamEvent::ResponseIdStream(stuff)) => {
                        (received_response_id, typed_response_stream) = stuff;
                        break;
                    },
                    Ok(StreamEvent::Item(item)) => {
                        if item.finished {
                            // save it to db and put it in the LLM Request input
                            // in case another request will be made
                            let mut conn = pool.acquire().await?;
                            let message = process_output_item(&mut conn, item.item.to_owned(), conversation_id, &app_config).await?;
                            let input_message = APIInputMessage::try_from(message)?;
                            chat_request.input.push(input_message);

                        }
                        let event = ChatbotChatStreamEvent::from(item.to_owned());
                        if event != ChatbotChatStreamEvent::None {
                            let event_string = serde_json::to_string(&event)?;
                            yield Bytes::from(event_string);
                            yield Bytes::from("\n");
                        };
                    },
                    Ok(StreamEvent::Done) => {
                        break 'outer Err(anyhow::anyhow!("This shouldn't happen, stream ended unxpectedly."))?
                    },
                    Ok(StreamEvent::Messages(_)) | Ok(StreamEvent::Delta(_)) => {
                        break 'outer Err(anyhow::anyhow!("This shouldn't happen, messages or response delta not expected."))?
                    },
                    Err(e) => break 'outer Err(anyhow::anyhow!("Stream ended unexpectedly: {e} Response id: {}", response_id.lock().await))?,
                }}
            }

            // update response_id once it's found.
            let mut response_id = response_id.lock().await;
            *response_id = received_response_id;

            let mut final_stream = match typed_response_stream {
                ResponseStreamType::Toolcall(stream) => {
                    parse_tool(&mut conn, stream, conversation_id, &user_context).await
                }
                ResponseStreamType::TextResponse(stream) => {
                    // first, create the response message, update citation ids
                    // and update the response_message_id arc mutex.
                    // then, stream the response in parse_text_response.
                    let response_message = models::chatbot_conversation_messages::insert(
                    &mut conn,
                    ChatbotConversationMessage {
                        conversation_id,
                        message: Message::Text(ChatbotConversationMessageMessage {
                            text: "".to_string(),
                            message_role: MessageRole::Assistant,
                            message_is_complete: false,
                            used_tokens: request_estimated_tokens,
                            response_id: Some(response_id.to_owned()),
                            ..Default::default()
                        }),
                        ..Default::default()
                    },
                    )
                    .await?;
                    models::chatbot_conversation_messages_citations::update_citation_message_ids(
                        &mut conn,
                        response_id.to_string(),
                        response_message.id,
                    ).await?;

                    // set the correct response_message_id
                    {let mut response_message_id = response_message_id.lock().await;
                    *response_message_id = response_message.id;}

                    parse_text_response(&mut conn, stream, full_response_text.clone(), done.clone(), response_message, request_estimated_tokens).await
                }
            };

            let message_id = *response_message_id.lock().await;
            while let Some(line) = final_stream.next().await {
                let val = line?;
                match val {
                    StreamEvent::Delta(delta) => {
                        let response =  ChatbotChatStreamEvent::Delta  { text: delta.clone(), message_id };
                        let response_as_string = serde_json::to_string(&response)?;
                        yield Bytes::from(response_as_string);
                        yield Bytes::from("\n");
                    },
                    StreamEvent::Item(stream_item) => {
                        match stream_item.item  {
                            OutputItem::Message { .. } | OutputItem::FunctionCall { .. } | OutputItem::FunctionCallOutput { .. } => {
                                // item already processed
                            },
                            _ => {
                                // save this item in the db if it's finished
                                if stream_item.finished {
                                    let mut conn = pool.acquire().await?;
                                    process_output_item(&mut conn, stream_item.item.to_owned(), conversation_id, &app_config).await?;
                                }
                            },
                        };

                        let response = ChatbotChatStreamEvent::from(stream_item);
                        if response != ChatbotChatStreamEvent::None {
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
                    StreamEvent::ResponseIdStream(..) => {
                        Err(anyhow::anyhow!("This shouldn't happen, response stream received while already streaming a response stream to user."))?
                    },
                }
            }
        }
        if !done.load(atomic::Ordering::Relaxed) {
            let id = response_id.lock().await;
            Err(chatbot_err!(StreamingError, format!("Stream ended unexpectedly. Response id: {id}")))?;
        }
    };

    // Encapsulate the stream and the guard within GuardedStream. This moves the request guard into the stream and ensures that it is dropped when the stream is dropped.
    // This way we do cleanup only when the stream is dropped and not when this function returns.
    let guarded_stream = GuardedStream::new(guard, response_stream);

    // Box and pin the GuardedStream to satisfy the Unpin requirement
    Ok(Box::pin(guarded_stream))
}

#[cfg(test)]
mod tests {
    use super::*;

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
