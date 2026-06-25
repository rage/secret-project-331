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
const SEARCH_GROUNDING_INSTRUCTION: &str = "\n\nAlways call the azure_ai_search tool to find relevant course material before answering any questions. Base your answer on the results and cite them. Skip the search only for greetings or thanks.";

enum ParsedResponseLine {
    Event(String),
    Data(ResponseOutput),
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
            Ok(Some(ParsedResponseLine::Data(response_output)))
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
    pub error: Option<String>,
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
    pub delta: Option<String>,
    pub item: Option<OutputItem>,
    pub response: Option<Response>,
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
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct AiSearchOutput {
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
    pub properties: HashMap<String, ArrayProperty>,
    /// All 'properties' keys must be included in this 'required' list
    pub required: Vec<String>,
    /// additionalProperties should always be 'false'
    pub additional_properties: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ArrayProperty {
    #[serde(rename = "type")]
    pub type_field: JSONType,
    pub items: ArrayItem,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ArrayItem {
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
    pub async fn build_and_insert_incoming_message_to_db(
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

        let params = get_params_for_model(&model, &configuration);

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

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatResponse {
    pub text: String,
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
    response_message_id: Uuid,
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
        let response_message_id = self.response_message_id;
        let received_string = self.received_string.clone();
        let pool = self.pool.clone();
        let request_estimated_tokens = self.request_estimated_tokens;
        tokio::spawn(async move {
            info!("Verifying the received message has been handled");
            let mut conn = pool.acquire().await.expect("Could not acquire connection");
            let full_response_text = received_string.lock().await;
            if full_response_text.is_empty() {
                info!("No response received. Deleting the response message");
                models::chatbot_conversation_messages::delete(&mut conn, response_message_id)
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
                response_message_id,
                &full_response_as_string,
                true,
                request_estimated_tokens + estimated_cost,
            )
            .await
            .expect("Could not update response message");
        });
    }
}

/// Creates a stream with the LLMRequest and processes received OutputItems until receiving
/// a response text or tool call.
/// Returns:
///     response id created by Azure (String),
///     ResponseStreamType (type: response text or tool call) containing the created stream
pub async fn make_request_and_stream<'a>(
    conn: &mut PgConnection,
    chat_request: LLMRequest,
    conversation_id: Uuid,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<(String, ResponseStreamType<'a>)> {
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
    let mut pinned_lines = Box::pin(peekable_lines_stream);

    // empty string because when event: response.created, it will be set as the correct
    // value, and this event is the first event of the stream.
    let mut response_id = "".to_string();
    let mut output_item_incoming = false;
    let mut response_created_incoming = false;
    let mut error_incoming = false;

    loop {
        let line_res = pinned_lines.as_mut().peek().await;
        match line_res {
            None => {
                break;
            }
            Some(Err(e)) => {
                return Err(anyhow!(
                    "There was an error streaming response from Azure: {}. Response id: {}",
                    e,
                    response_id
                ));
            }
            Some(Result::Ok(line)) => {
                match ParsedResponseLine::parse(line)? {
                    Some(ParsedResponseLine::Event(event_type)) => {
                        trace!("Event: {event_type}");
                        match event_type.as_str() {
                            "response.created" => {
                                response_created_incoming = true;
                            }
                            "response.output_item.done" => {
                                output_item_incoming = true;
                            }
                            "response.function_call_arguments.delta" => {
                                if response_id.is_empty() {
                                    return Err(anyhow::anyhow!(
                                        "No response_id found! This should never happen!"
                                    ));
                                }
                                return Ok((
                                    response_id,
                                    ResponseStreamType::Toolcall(pinned_lines),
                                ));
                            }
                            "response.output_text.delta" => {
                                return Ok((
                                    response_id,
                                    ResponseStreamType::TextResponse(pinned_lines),
                                ));
                            }
                            "response.error" => {
                                error_incoming = true;
                            }
                            _ => {}
                        }
                    }
                    Some(ParsedResponseLine::Data(response_output)) => {
                        if error_incoming
                            && let Some(response) = &response_output.response
                            && let Some(error) = &response.error
                        {
                            Err(chatbot_err!(
                                StreamingError,
                                format!(
                                    "Error received from the API: {}. Response id: {}",
                                    error, response.id
                                )
                            ))?
                        };
                        if response_created_incoming {
                            let res = response_output.response.ok_or(chatbot_err!(
                                DeserializationError,
                                "Expected response object"
                            ))?;
                            response_id = res.id;
                            response_created_incoming = false;
                        }
                        if output_item_incoming {
                            let item = response_output.item.ok_or(chatbot_err!(
                                DeserializationError,
                                "Expected response output item"
                            ))?;
                            // put in input
                            process_output_item(conn, item, conversation_id, app_config).await?;
                            output_item_incoming = false;
                        }
                    }
                    None => {}
                }
                pinned_lines.next().await;
                continue;
            }
        }
    }
    Err(Error::msg(format!(
        "The response received from Azure ended unexpectedly. Response id: {response_id}"
    )))
}

/// For saving output items that are not text messages or function calls, i.e. that
/// don't need further processing and are not streamed to the user.
/// Saves reasoning and Azure AI items.
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
            let search_output: AiSearchOutput = serde_json::from_str(&output)?;
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
/// Calls the functions and returns a Vec of function results to be sent to Azure.
pub async fn parse_tool<'a>(
    conn: &mut PgConnection,
    mut lines: PeekableLinesStream<'a>,
    conversation_id: Uuid,
    user_context: &ChatbotUserContext,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<Vec<APIOutputMessage>> {
    let mut function_name_id_args: Vec<(String, String, Value)> = vec![];
    let mut messages = vec![];
    let mut common_response_id = "".to_string();
    let mut response_received = false;
    let mut error_incoming = false;

    trace!("Parsing tool calls...");

    while let Some(val) = lines.next().await {
        let line = val?;
        let response_output = match ParsedResponseLine::parse(&line)? {
            Some(ParsedResponseLine::Event(event_type)) => {
                match event_type.as_str() {
                    "response.completed" => {
                        response_received = true;
                    }
                    "response.output_text.delta" => {
                        return Err(anyhow::anyhow!(
                            "Error: Received response text while parsing tool calls. Either the tool call parsing failed or the LLM responded in an unexpected way."
                        ));
                    }
                    "response.error" => {
                        error_incoming = true;
                    }
                    _ => {}
                };
                continue;
            }
            Some(ParsedResponseLine::Data(data)) => data,
            None => {
                continue;
            }
        };

        if error_incoming
            && let Some(response) = &response_output.response
            && let Some(error) = &response.error
        {
            Err(chatbot_err!(
                StreamingError,
                format!("Error received from the API: {}.", error)
            ))?
        };

        if response_received {
            // the stream ended
            if function_name_id_args.is_empty() {
                return Err(anyhow::anyhow!(
                    "The LLM response was supposed to contain function calls, but no function calls were found"
                ));
            }
            if common_response_id.is_empty() {
                return Err(anyhow::anyhow!(
                    "Received tool response but response id not found, this shouldn't happen."
                ));
            };
            let mut tool_msgs = Vec::new();

            for (name, id, args) in function_name_id_args.iter() {
                let tool = get_chatbot_tool(conn, name, args, user_context).await?;

                tool_msgs.push(APIOutputMessage {
                    message_type: OutputItem::FunctionCall {
                        response_id: (common_response_id).to_owned(),
                        call_id: id.to_owned(),
                        tool_name: name.to_owned(),
                        arguments: serde_json::to_string(tool.get_arguments())?,
                    },
                });
                tool_msgs.push(APIOutputMessage {
                    message_type: OutputItem::FunctionCallOutput {
                        call_id: id.to_owned(),
                        output: tool.get_tool_output(),
                        response_id: (common_response_id).to_owned(),
                    },
                });
            }
            // save tool_msgs to the db
            for m in &tool_msgs {
                chatbot_conversation_messages::insert(
                    conn,
                    m.to_chatbot_conversation_message(conversation_id)?,
                )
                .await?;
            }
            messages.extend(tool_msgs);
            break;
        } else if let Some(item) = response_output.item {
            match item {
                OutputItem::FunctionCall {
                    call_id,
                    tool_name,
                    arguments,
                    response_id,
                } => {
                    common_response_id = response_id;
                    function_name_id_args.push((
                        tool_name,
                        call_id,
                        serde_json::from_str::<Value>(&arguments)?,
                    ));
                }
                OutputItem::Message { .. } => Err(chatbot_err!(
                    StreamingError,
                    "Error: unexpected message item !!!".to_string()
                ))?,
                _ => {
                    // save this chunk's data
                    process_output_item(conn, item.clone(), conversation_id, app_config).await?;
                    // add this output item to the messages to be included in the next
                    // LLMRequest
                    messages.push(APIOutputMessage { message_type: item });
                }
            }
        }
    }
    Ok(messages)
}

/// Streams and parses a LLM response from Azure that contains a text response.
pub async fn parse_and_stream_to_user<'a>(
    conn: &mut PgConnection,
    mut lines: PeekableLinesStream<'a>,
    conversation_id: Uuid,
    pool: PgPool,
    request_estimated_tokens: i32,
    response_id: String,
    app_config: ApplicationConfiguration,
) -> anyhow::Result<Pin<Box<dyn Stream<Item = anyhow::Result<Bytes>> + Send + 'a>>> {
    // insert the to-be-streamed bot text response to db
    let response_message = models::chatbot_conversation_messages::insert(
        conn,
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
        conn,
        response_id,
        response_message.id,
    )
    .await?;

    let done = Arc::new(AtomicBool::new(false));
    let full_response_text = Arc::new(Mutex::new(Vec::new()));
    // Instantiate the guard before creating the stream.
    let guard = RequestCancelledGuard {
        response_message_id: response_message.id,
        received_string: full_response_text.clone(),
        pool: pool.clone(),
        done: done.clone(),
        request_estimated_tokens,
    };

    trace!("Parsing stream to user...");

    let mut response_received = false;
    let mut error_incoming = false;

    let response_stream = async_stream::try_stream! {
        while let Some(val) = lines.next().await {
            let line = val?;
            let response_output: ResponseOutput = match ParsedResponseLine::parse(&line)? {
                Some(ParsedResponseLine::Event(event_type)) => {
                    match event_type.as_str() {
                        "response.completed" | "response.incomplete" => {response_received = true;},
                        "response.output_text.delta" => {
                            // streaming
                        },
                        "response.function_call_arguments.delta" => {
                            error!("ERROR, function call received but can't be processed while streaming to user.");
                            return Err(chatbot_err!(StreamingError, format!("Unexpected function call while streaming to user")))?
                        },
                        "response.error" => {error_incoming = true;},
                        _ => {},
                    };
                    continue;
                },
                Some(ParsedResponseLine::Data(data)) => data,
                None => {continue;},
            };

            let mut full_response_text = full_response_text.lock().await;

            if response_received {
                let full_response_as_string = full_response_text.join("");
                // todo: use the tokens given in the response
                let estimated_cost = estimate_tokens(&full_response_as_string);
                trace!(
                    "End of chatbot response stream. Estimated cost: {}. Response: {}",
                    estimated_cost, full_response_as_string
                );
                done.store(true, atomic::Ordering::Relaxed);
                let mut conn = pool.acquire().await?;
                models::chatbot_conversation_messages::update(
                    &mut conn,
                    response_message.id,
                    &full_response_as_string,
                    true,
                    request_estimated_tokens + estimated_cost,
                ).await?;
                break;
            }

            if error_incoming &&
                let Some(response) = &response_output.response && let Some(error) = &response.error
            {
                Err(chatbot_err!(StreamingError, format!("Error received from the API: {}.", error)))?

            };

            if let Some(delta) = &response_output.delta {
                full_response_text.push(delta.to_owned());
                let response = ChatResponse { text: delta.clone() };
                let response_as_string = serde_json::to_string(&response)?;
                yield Bytes::from(response_as_string);
                yield Bytes::from("\n");
            }

            if let Some(item) = &response_output.item {
                match item {
                    OutputItem::Message { .. } => continue,
                    OutputItem::FunctionCall { .. } => Err(chatbot_err!(StreamingError, "Error: unexpected function call after / during a text response.".to_string()))?,
                    _ => {
                        let mut conn = pool.acquire().await?;
                        process_output_item(&mut conn, item.to_owned(), conversation_id, &app_config).await?;
                        continue;
                    },
                };
            }
        }

        if !done.load(atomic::Ordering::Relaxed) {
            Err(anyhow::anyhow!("Stream ended unexpectedly"))?;
        }
    };

    // Encapsulate the stream and the guard within GuardedStream. This moves the request guard into the stream and ensures that it is dropped when the stream is dropped.
    // This way we do cleanup only when the stream is dropped and not when this function returns.
    let guarded_stream = GuardedStream::new(guard, response_stream);

    // Box and pin the GuardedStream to satisfy the Unpin requirement
    Ok(Box::pin(guarded_stream))
}

pub async fn send_chat_request_and_parse_stream(
    conn: &mut PgConnection,
    pool: PgPool,
    app_config: &ApplicationConfiguration,
    chatbot_configuration_id: Uuid,
    conversation_id: Uuid,
    message: &str,
    user_context: ChatbotUserContext,
) -> anyhow::Result<Pin<Box<dyn Stream<Item = anyhow::Result<Bytes>> + Send>>> {
    let (mut chat_request, request_estimated_tokens) =
        LLMRequest::build_and_insert_incoming_message_to_db(
            conn,
            chatbot_configuration_id,
            conversation_id,
            message,
            app_config,
        )
        .await?;

    let mut max_iterations_left = 15;

    loop {
        max_iterations_left -= 1;
        if max_iterations_left == 0 {
            error!("Maximum tool call iterations exceeded");
            return Err(anyhow::anyhow!(
                "Maximum tool call iterations exceeded. The LLM may be stuck in a loop."
            ));
        }

        let (response_id, response_type) =
            make_request_and_stream(conn, chat_request.clone(), conversation_id, app_config)
                .await?;

        let new_conversation_items = match response_type {
            ResponseStreamType::Toolcall(stream) => {
                parse_tool(conn, stream, conversation_id, &user_context, app_config).await?
            }
            ResponseStreamType::TextResponse(stream) => {
                return parse_and_stream_to_user(
                    conn,
                    stream,
                    conversation_id,
                    pool,
                    request_estimated_tokens,
                    response_id,
                    app_config.to_owned(),
                )
                .await;
            }
        };
        chat_request.input.extend(
            new_conversation_items
                .into_iter()
                .map(APIInputMessage::try_from)
                .collect::<ChatbotResult<Vec<APIInputMessage>>>()?,
        );
    }
}
