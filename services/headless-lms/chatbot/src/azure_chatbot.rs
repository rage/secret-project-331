use std::collections::HashMap;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::{
    Arc,
    atomic::{self, AtomicBool},
};
use std::task::{Context, Poll};

use anyhow::{Error, Ok, anyhow};
use bytes::Bytes;
use chrono::Utc;
use futures::stream::{BoxStream, Peekable};
use futures::{Stream, StreamExt, TryStreamExt};
use headless_lms_models::chatbot_configurations::{ReasoningEffortLevel, VerbosityLevel};
use headless_lms_models::chatbot_conversation_messages::{ChatbotConversationMessage, MessageRole};
use headless_lms_models::chatbot_conversation_messages_citations::ChatbotConversationMessageCitation;
use headless_lms_utils::ApplicationConfiguration;
use headless_lms_utils::prelude::BackendError;
use pin_project::pin_project;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tokio::{io::AsyncBufReadExt, sync::Mutex};
use tokio_stream::wrappers::LinesStream;
use tokio_util::io::StreamReader;
use tracing::trace;
use url::Url;

use crate::chatbot_error::{ChatbotError, ChatbotErrorType};
use crate::chatbot_tools::ChatbotTool;
use crate::chatbot_tools::course_progress::call_chatbot_tool;
use crate::llm_utils::{
    APIMessage, APIMessageKind, APIMessageText, APIMessageToolCall, APIMessageToolResponse,
    APITool, APIToolCall, estimate_tokens, make_streaming_llm_request,
};
use crate::prelude::*;
use crate::search_filter::SearchFilter;

const CONTENT_FIELD_SEPARATOR: &str = ",|||,";

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
}

#[derive(Deserialize, Serialize, Debug)]
pub struct ContentFilter {
    pub filtered: bool,
    pub severity: String,
}

/// Data in a streamed response chunk
#[derive(Deserialize, Serialize, Debug)]
pub struct Choice {
    pub content_filter_results: Option<ContentFilterResults>,
    pub delta: Option<Delta>,
    pub finish_reason: Option<String>,
    pub index: i32,
}

/// Content in a streamed response chunk Choice
#[derive(Deserialize, Serialize, Debug)]
pub struct Delta {
    pub content: Option<String>,
    pub context: Option<DeltaContext>,
    pub tool_calls: Option<Vec<ToolCallInDelta>>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct DeltaContext {
    pub citations: Vec<Citation>,
}

/// A streamed tool call from Azure
#[derive(Deserialize, Serialize, Debug)]
pub struct ToolCallInDelta {
    pub id: Option<String>,
    pub function: DeltaTool,
    #[serde(rename = "type")]
    pub tool_type: Option<ToolCallType>,
}

/// Streamed tool call content
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct DeltaTool {
    #[serde(default)]
    pub arguments: String,
    pub name: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "snake_case")]
pub enum ToolCallType {
    Function,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Citation {
    pub content: String,
    pub title: String,
    pub url: String,
    pub filepath: String,
}

/// Response received from LLM API
#[derive(Deserialize, Serialize, Debug)]
pub struct ResponseChunk {
    pub choices: Vec<Choice>,
    pub created: u64,
    pub id: String,
    pub model: String,
    pub object: String,
    pub system_fingerprint: Option<String>,
}

impl TryFrom<ChatbotConversationMessage> for APIMessage {
    type Error = ChatbotError;
    fn try_from(message: ChatbotConversationMessage) -> Result<Self, Self::Error> {
        let res = match message.message_role {
            MessageRole::Assistant => {
                if !message.tool_call_fields.is_empty() {
                    APIMessage {
                        role: message.message_role,
                        fields: APIMessageKind::ToolCall(APIMessageToolCall {
                            tool_calls: message
                                .tool_call_fields
                                .iter()
                                .map(|f| APIToolCall::from(f.clone()))
                                .collect(),
                        }),
                    }
                } else if let Some(msg) = message.message {
                    APIMessage {
                        role: message.message_role,
                        fields: APIMessageKind::Text(APIMessageText { content: msg }),
                    }
                } else {
                    return Err(ChatbotError::new(
                        ChatbotErrorType::InvalidMessageShape,
                        "A 'role: assistant' type ChatbotConversationMessage must have either tool_call_fields or a text message.",
                        None,
                    ));
                }
            }
            MessageRole::Tool => {
                if let Some(tool_output) = message.tool_output {
                    APIMessage {
                        role: message.message_role,
                        fields: APIMessageKind::ToolResponse(APIMessageToolResponse {
                            tool_call_id: tool_output.tool_call_id,
                            name: tool_output.tool_name,
                            content: tool_output.tool_output,
                        }),
                    }
                } else {
                    return Err(ChatbotError::new(
                        ChatbotErrorType::InvalidMessageShape,
                        "A 'role: tool' type ChatbotConversationMessage must have field tool_output.",
                        None,
                    ));
                }
            }
            MessageRole::User => APIMessage {
                role: message.message_role,
                fields: APIMessageKind::Text(APIMessageText {
                    content: message.message.unwrap_or_default(),
                }),
            },
            MessageRole::System => {
                return Err(ChatbotError::new(
                    ChatbotErrorType::InvalidMessageShape,
                    "A 'role: system' type ChatbotConversationMessage cannot be saved into the database.",
                    None,
                ));
            }
        };
        Result::Ok(res)
    }
}

/* impl TryFrom<APIMessage> for ChatbotConversationMessage {
    type Error = ChatbotError;
    fn try_from(message: APIMessage) -> Result<Self, Self::Error> {
        let res = match message.fields {
            APIMessageKind::Text(msg) => ChatbotConversationMessage {
                message_role: message.role,
                message: Some(msg.content),
                ..Default::default()
            },
            APIMessageKind::ToolCall(msg) => ChatbotConversationMessage {
                message_role: message.role,
                message: None,
                tool_call_fields: msg
                    .tool_calls
                    .iter()
                    .map(|x| ToolCallFields::try_from(x.to_owned()))
                    .collect()?,
                ..Default::default()
            },
            APIMessageKind::ToolResponse(msg) => {}
        };
        Result::Ok(res)
    }
} */

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LLMToolChoice {
    Auto,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct ThinkingParams {
    pub max_completion_tokens: Option<i32>,
    pub verbosity: Option<VerbosityLevel>,
    pub reasoning_effort: Option<ReasoningEffortLevel>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tools: Vec<AzureLLMToolDefinition>,
    pub tool_choice: Option<LLMToolChoice>,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct NonThinkingParams {
    pub max_tokens: Option<i32>,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub frequency_penalty: Option<f32>,
    pub presence_penalty: Option<f32>,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(untagged)]
pub enum LLMRequestParams {
    Thinking(ThinkingParams),
    NonThinking(NonThinkingParams),
}

/// A tool definition that is sent to the LLM. A tool that the LLM can call
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct AzureLLMToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: LLMToolType,
    pub function: LLMTool,
}

/// Content of a tool defintion that is sent to the LLM
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LLMTool {
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<LLMToolParams>,
}

/// Parameters that an AzureLLMToolDefinition accepts
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LLMToolParams {
    #[serde(rename = "type")]
    pub tool_type: LLMToolParamType,
    pub properties: HashMap<String, LLMToolParamProperties>,
    pub required: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LLMToolParamProperties {
    #[serde(rename = "type")]
    pub param_type: String,
    pub description: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LLMToolParamType {
    Object,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LLMToolType {
    Function,
}

pub fn get_chatbot_tools() -> Vec<AzureLLMToolDefinition> {
    vec![
        AzureLLMToolDefinition {
            tool_type: LLMToolType::Function,
            function: LLMTool {
                name: "course_progress".to_string(),
                description: "Get the user's progress on this course, including information about exercises attempted, points gained, the passing criteria for the course and if the user meets the criteria.".to_string(),
                parameters: None
            }
        }
    ]
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LLMRequest {
    pub messages: Vec<APIMessage>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub data_sources: Vec<DataSource>,
    #[serde(flatten)]
    pub params: LLMRequestParams,
    pub stop: Option<String>,
}

impl LLMRequest {
    pub async fn build_and_insert_incoming_message_to_db(
        conn: &mut PgConnection,
        chatbot_configuration_id: Uuid,
        conversation_id: Uuid,
        message: &str,
        app_config: &ApplicationConfiguration,
    ) -> anyhow::Result<(Self, ChatbotConversationMessage, i32)> {
        let index_name = Url::parse(&app_config.base_url)?
            .host_str()
            .expect("BASE_URL must have a host")
            .replace(".", "-");

        let configuration =
            models::chatbot_configurations::get_by_id(conn, chatbot_configuration_id).await?;

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
                created_at: Utc::now(),
                updated_at: Utc::now(),
                deleted_at: None,
                conversation_id,
                message: Some(message.to_string()),
                message_role: MessageRole::User,
                message_is_complete: true,
                used_tokens: estimate_tokens(message),
                order_number: new_order_number,
                tool_call_fields: vec![],
                tool_output: None,
            },
        )
        .await?;

        let mut api_chat_messages: Vec<APIMessage> = conversation_messages
            .into_iter()
            .map(|x| APIMessage::try_from(x))
            .collect::<Result<Vec<_>, ChatbotError>>()?;

        api_chat_messages = api_chat_messages;

        api_chat_messages.push(new_message.clone().try_into()?);

        api_chat_messages.insert(
            0,
            APIMessage {
                role: MessageRole::System,
                fields: APIMessageKind::Text(APIMessageText {
                    content: configuration.prompt.clone(),
                }),
            },
        );

        let data_sources = if configuration.use_azure_search {
            let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
                anyhow::anyhow!("Azure configuration is missing from the application configuration")
            })?;

            let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
                anyhow::anyhow!(
                    "Azure search configuration is missing from the Azure configuration"
                )
            })?;

            let query_type = if configuration.use_semantic_reranking {
                "vector_semantic_hybrid"
            } else {
                "vector_simple_hybrid"
            };

            vec![DataSource {
                data_type: "azure_search".to_string(),
                parameters: DataSourceParameters {
                    endpoint: search_config.search_endpoint.to_string(),
                    authentication: DataSourceParametersAuthentication {
                        auth_type: "api_key".to_string(),
                        key: search_config.search_api_key.clone(),
                    },
                    index_name,
                    query_type: query_type.to_string(),
                    semantic_configuration: "default".to_string(),
                    embedding_dependency: EmbeddingDependency {
                        dep_type: "deployment_name".to_string(),
                        deployment_name: search_config.vectorizer_deployment_id.clone(),
                    },
                    in_scope: false,
                    top_n_documents: 15,
                    strictness: 3,
                    filter: Some(
                        SearchFilter::eq("course_id", configuration.course_id.to_string())
                            .to_odata()?,
                    ),
                    fields_mapping: FieldsMapping {
                        content_fields_separator: CONTENT_FIELD_SEPARATOR.to_string(),
                        content_fields: vec!["chunk_context".to_string(), "chunk".to_string()],
                        filepath_field: "filepath".to_string(),
                        title_field: "title".to_string(),
                        url_field: "url".to_string(),
                        vector_fields: vec!["text_vector".to_string()],
                    },
                },
            }]
        } else {
            Vec::new()
        };

        let tools = if configuration.use_tools {
            get_chatbot_tools()
        } else {
            Vec::new()
        };

        let serialized_messages = serde_json::to_string(&api_chat_messages)?;
        let request_estimated_tokens = estimate_tokens(&serialized_messages);

        let params = if configuration.thinking_model {
            LLMRequestParams::Thinking(ThinkingParams {
                max_completion_tokens: Some(configuration.max_completion_tokens),
                reasoning_effort: Some(configuration.reasoning_effort),
                verbosity: Some(configuration.verbosity),
                tools,
                tool_choice: if configuration.use_tools {
                    Some(LLMToolChoice::Auto)
                } else {
                    None
                },
            })
        } else {
            LLMRequestParams::NonThinking(NonThinkingParams {
                max_tokens: Some(configuration.response_max_tokens),
                temperature: Some(configuration.temperature),
                top_p: Some(configuration.top_p),
                frequency_penalty: Some(configuration.frequency_penalty),
                presence_penalty: Some(configuration.presence_penalty),
            })
        };

        Ok((
            Self {
                messages: api_chat_messages,
                data_sources,
                params,
                stop: None,
            },
            new_message,
            request_estimated_tokens,
        ))
    }

    pub async fn update_messages_from_db(
        mut self,
        conn: &mut PgConnection,
        conversation_id: Uuid,
    ) -> anyhow::Result<Self> {
        let conversation_messages =
            models::chatbot_conversation_messages::get_by_conversation_id(conn, conversation_id)
                .await?;
        let api_messages: Vec<APIMessage> = conversation_messages
            .into_iter()
            .map(|x| APIMessage::try_from(x))
            .collect::<Result<Vec<_>, ChatbotError>>()?;
        self.messages.extend(api_messages);
        Ok(self)
    }

    pub async fn update_messages_to_db(
        self,
        _conn: &mut PgConnection,
        _new_msgs: Vec<APIMessage>,
    ) -> anyhow::Result<(Self, i32)> {
        Ok((self, 0))
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DataSource {
    #[serde(rename = "type")]
    pub data_type: String,
    pub parameters: DataSourceParameters,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DataSourceParameters {
    pub endpoint: String,
    pub authentication: DataSourceParametersAuthentication,
    pub index_name: String,
    pub query_type: String,
    pub embedding_dependency: EmbeddingDependency,
    pub in_scope: bool,
    pub top_n_documents: i32,
    pub strictness: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter: Option<String>,
    pub fields_mapping: FieldsMapping,
    pub semantic_configuration: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DataSourceParametersAuthentication {
    #[serde(rename = "type")]
    pub auth_type: String,
    pub key: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmbeddingDependency {
    #[serde(rename = "type")]
    pub dep_type: String,
    pub deployment_name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FieldsMapping {
    pub content_fields_separator: String,
    pub content_fields: Vec<String>,
    pub filepath_field: String,
    pub title_field: String,
    pub url_field: String,
    pub vector_fields: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
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
            models::chatbot_conversation_messages::update(
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

pub async fn make_request_and_stream<'a>(
    chat_request: LLMRequest,
    model_name: &str,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<ResponseStreamType<'a>> {
    let response = make_streaming_llm_request(chat_request, model_name, app_config).await?;

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

    loop {
        let line_res = pinned_lines.as_mut().peek().await;
        match line_res {
            None => {
                break;
            }
            Some(Err(e)) => {
                return Err(anyhow!(
                    "There was an error streaming response from Azure: {}",
                    e
                ));
            }
            Some(Result::Ok(line)) => {
                if !line.starts_with("data: ") {
                    pinned_lines.next().await;
                    continue;
                }
                let json_str = line.trim_start_matches("data: ");
                let response_chunk = serde_json::from_str::<ResponseChunk>(json_str)
                    .map_err(|e| anyhow::anyhow!("Failed to parse response chunk: {}", e))?;
                for choice in &response_chunk.choices {
                    if let Some(d) = &choice.delta {
                        if d.content.is_some() || d.context.is_some() {
                            return Ok(ResponseStreamType::TextResponse(pinned_lines));
                        } else if let Some(_calls) = &d.tool_calls {
                            return Ok(ResponseStreamType::Toolcall(pinned_lines));
                        } else if d.content.is_none() {
                            pinned_lines.next().await;
                            continue;
                        }
                    }
                }
                pinned_lines.next().await;
            }
        }
    }

    Err(Error::msg(
        "The response received from Azure had an unexpected shape and couldn't be parsed"
            .to_string(),
    ))
}

/// Streams and parses a LLM response from Azure that contains function calls.
/// Calls the functions and returns a Vec of function results to be sent to Azure.
pub async fn parse_tool<'a>(
    conn: &mut PgConnection,
    mut lines: PeekableLinesStream<'a>,
    user_context: &ChatbotUserContext,
) -> anyhow::Result<Vec<APIMessage>> {
    let mut function_name_id_args: Vec<(String, String, String)> = vec![];
    let mut currently_streamed_function_name_id: Option<(String, String)> = None;
    let mut currently_streamed_function_args = vec![];
    let mut messages = vec![];

    trace!("Parsing tool calls...");

    while let Some(val) = lines.next().await {
        let line = val?;
        if !line.to_owned().starts_with("data: ") {
            continue;
        }
        let json_str = line.trim_start_matches("data: ");
        if json_str.trim() == "[DONE]" {
            // the stream ended
            if function_name_id_args.is_empty() {
                return Err(anyhow::anyhow!(
                    "The LLM response was supposed to contain function calls, but no function calls were found"
                ));
            }
            let mut assistant_tool_calls_msg = Vec::new();
            let mut tool_result_msgs = Vec::new();

            for (name, id, args) in function_name_id_args.iter() {
                // created and args parsed before above tool msg append
                let tool = call_chatbot_tool(conn, &name, &args, user_context).await?;

                assistant_tool_calls_msg.push(APIToolCall {
                    function: APITool {
                        name: name.to_owned(),
                        arguments: serde_json::to_string(tool.get_arguments())?,
                    },
                    id: id.to_owned(),
                    tool_type: ToolCallType::Function,
                });
                tool_result_msgs.push(APIMessage {
                    role: MessageRole::Tool,
                    fields: APIMessageKind::ToolResponse(APIMessageToolResponse {
                        content: tool.output(),
                        name: name.to_owned(),
                        tool_call_id: id.to_owned(),
                    }),
                })
            }
            messages.push(APIMessage {
                role: MessageRole::Assistant,
                fields: APIMessageKind::ToolCall(APIMessageToolCall {
                    tool_calls: assistant_tool_calls_msg,
                }),
            });
            messages.extend(tool_result_msgs);
            break;
        }
        let response_chunk = serde_json::from_str::<ResponseChunk>(json_str)
            .map_err(|e| anyhow::anyhow!("Failed to parse response chunk: {} {}", e, json_str))?;
        for choice in &response_chunk.choices {
            if Some("tool_calls".to_string()) == choice.finish_reason {
                // the stream is finished for now because of "tool_calls"
                // so if we're still streaming smóme func call, finish it and store it
                if let Some((name, id)) = &currently_streamed_function_name_id {
                    // we have streamed some func call and args so let's join the args
                    // and save the call
                    let fn_args = currently_streamed_function_args.join("");
                    function_name_id_args.push((
                        name.to_owned(),
                        id.to_owned(),
                        fn_args.to_owned(),
                    ));
                    currently_streamed_function_args.clear();
                    currently_streamed_function_name_id = None;
                }
            }
            if let Some(delta) = &choice.delta {
                if let Some(tool_calls) = &delta.tool_calls {
                    // this chunk has tool call info
                    for call in tool_calls {
                        if let (Some(name), Some(id)) = (&call.function.name, &call.id) {
                            // if this chunk has a tool name and id, then a new call is made.
                            // if there is previously streamed args, then their streaming is
                            // complete, let's join and save them before processing this new
                            // call.
                            if let Some((name_prev, id_prev)) = currently_streamed_function_name_id
                            {
                                let fn_args = currently_streamed_function_args.join("");
                                function_name_id_args.push((
                                    name_prev.to_owned(),
                                    id_prev.to_owned(),
                                    fn_args,
                                ));
                                currently_streamed_function_args.clear();
                            }
                            // set the tool name nad id from this chunk to currently_streamed
                            // and save any arguments to currently_streamed_function_args
                            // until the stream is complete or a new call is made.
                            currently_streamed_function_name_id =
                                Some((name.to_owned(), id.to_owned()));
                        };
                        // always save any streamed function args. it can be an empty string
                        // but that's ok.
                        currently_streamed_function_args.push(call.function.arguments.clone());
                    }
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
    response_order_number: i32,
    pool: PgPool,
    request_estimated_tokens: i32,
) -> anyhow::Result<Pin<Box<dyn Stream<Item = anyhow::Result<Bytes>> + Send + 'a>>> {
    let response_message = models::chatbot_conversation_messages::insert(
        conn,
        ChatbotConversationMessage {
            id: Uuid::new_v4(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
            conversation_id,
            message: None,
            message_role: MessageRole::Assistant,
            message_is_complete: false,
            used_tokens: request_estimated_tokens,
            order_number: response_order_number,
            tool_call_fields: vec![], // update later
            tool_output: None,
        },
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

    let response_stream = async_stream::try_stream! {
        while let Some(val) = lines.next().await {
            let line = val?;
            if !line.starts_with("data: ") {
                continue;
            }
            let json_str = line.trim_start_matches("data: ");
            let mut full_response_text = full_response_text.lock().await;

            if json_str.trim() == "[DONE]" {
                let full_response_as_string = full_response_text.join("");
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
            let response_chunk = serde_json::from_str::<ResponseChunk>(json_str).map_err(|e| {
                anyhow::anyhow!("Failed to parse response chunk: {}", e)
            })?;

            for choice in &response_chunk.choices {
                if let Some(delta) = &choice.delta {
                    if let Some(content) = &delta.content {
                        full_response_text.push(content.clone());
                        let response = ChatResponse { text: content.clone() };
                        let response_as_string = serde_json::to_string(&response)?;
                        yield Bytes::from(response_as_string);
                        yield Bytes::from("\n");
                    }
                    if let Some(context) = &delta.context {
                        let citation_message_id = response_message.id;
                        let mut conn = pool.acquire().await?;
                        for (idx, cit) in context.citations.iter().enumerate() {
                            let content = if cit.content.len() < 255 {cit.content.clone()} else {cit.content[0..255].to_string()};
                            let split = content.split_once(CONTENT_FIELD_SEPARATOR);
                            if split.is_none() {
                                error!("Chatbot citation doesn't have any content or is missing 'chunk_context'. Something is wrong with Azure.");
                            }
                            let cleaned_content: String = split.unwrap_or(("","")).1.to_string();

                            let document_url = cit.url.clone();
                            let mut page_path = PathBuf::from(&cit.filepath);
                            page_path.set_extension("");
                            let page_id_str = page_path.file_name();
                            let page_id = page_id_str.and_then(|id_str| Uuid::parse_str(id_str.to_string_lossy().as_ref()).ok());
                            let course_material_chapter_number = if let Some(id) = page_id {
                                let chapter = models::chapters::get_chapter_by_page_id(&mut conn, id).await.ok();
                                chapter.map(|c| c.chapter_number)
                            } else {
                                None
                            };

                            models::chatbot_conversation_messages_citations::insert(
                                &mut conn, ChatbotConversationMessageCitation {
                                    id: Uuid::new_v4(),
                                    created_at: Utc::now(),
                                    updated_at: Utc::now(),
                                    deleted_at: None,
                                    conversation_message_id: citation_message_id,
                                    conversation_id: response_message.conversation_id,
                                    course_material_chapter_number,
                                    title: cit.title.clone(),
                                    content: cleaned_content,
                                    document_url,
                                    citation_number: (idx+1) as i32,
                                }
                            ).await?;
                        }
                    }
                }
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
    let (mut chat_request, new_message, request_estimated_tokens) =
        LLMRequest::build_and_insert_incoming_message_to_db(
            conn,
            chatbot_configuration_id,
            conversation_id,
            message,
            app_config,
        )
        .await?;

    let model = models::chatbot_configurations_models::get_by_chatbot_configuration_id(
        conn,
        chatbot_configuration_id,
    )
    .await?;

    let mut response_order_number = new_message.order_number + 1;
    //let mut tool_msgs = vec![];

    let mut max_iterations_left = 15;

    loop {
        max_iterations_left -= 1;
        if max_iterations_left == 0 {
            error!("Maximum tool call iterations exceeded");
            return Err(anyhow::anyhow!(
                "Maximum tool call iterations exceeded. The LLM may be stuck in a loop."
            ));
        }

        println!("!!!!!!!!!!!!!!!!!!!!{:?}", chat_request);

        let response_type =
            make_request_and_stream(chat_request.clone(), &model.deployment_name, app_config)
                .await?;

        let new_tool_msgs = match response_type {
            ResponseStreamType::Toolcall(stream) => parse_tool(conn, stream, &user_context).await?,
            ResponseStreamType::TextResponse(stream) => {
                return parse_and_stream_to_user(
                    conn,
                    stream,
                    conversation_id,
                    response_order_number,
                    pool,
                    request_estimated_tokens,
                )
                .await;
            }
        };
        (chat_request, response_order_number) = chat_request
            .update_messages_to_db(conn, new_tool_msgs)
            .await?;
    }
}
