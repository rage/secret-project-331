use std::collections::HashMap;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::{
    Arc,
    atomic::{self, AtomicBool},
};
use std::task::{Context, Poll};
use std::vec;

use bytes::Bytes;
use chrono::Utc;
use futures::{Stream, TryStreamExt};
use headless_lms_models::chatbot_configurations::{ReasoningEffortLevel, VerbosityLevel};
use headless_lms_models::chatbot_conversation_messages::ChatbotConversationMessage;
use headless_lms_models::chatbot_conversation_messages_citations::ChatbotConversationMessageCitation;
use headless_lms_utils::ApplicationConfiguration;
use pin_project::pin_project;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use tokio::{io::AsyncBufReadExt, sync::Mutex};
use tokio_util::io::StreamReader;
use url::Url;

use crate::llm_utils::{APIMessage, MessageRole, estimate_tokens, make_streaming_llm_request};
use crate::prelude::*;
use crate::search_filter::SearchFilter;

const CONTENT_FIELD_SEPARATOR: &str = ",|||,";

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

#[derive(Deserialize, Serialize, Debug)]
pub struct Choice {
    pub content_filter_results: Option<ContentFilterResults>,
    pub delta: Option<Delta>,
    pub finish_reason: Option<String>,
    pub index: i32,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Delta {
    pub content: Option<String>,
    pub context: Option<DeltaContext>,
    pub tool_calls: Option<Vec<DeltaToolCall>>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct DeltaContext {
    pub citations: Vec<Citation>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct DeltaToolCall {
    pub id: String,
    pub function: DeltaTool,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct DeltaTool {
    pub arguments: String,
    pub name: Option<String>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Citation {
    pub content: String,
    pub title: String,
    pub url: String,
    pub filepath: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct ResponseChunk {
    pub choices: Vec<Choice>,
    pub created: u64,
    pub id: String,
    pub model: String,
    pub object: String,
    pub system_fingerprint: Option<String>,
}

impl From<ChatbotConversationMessage> for APIMessage {
    fn from(message: ChatbotConversationMessage) -> Self {
        APIMessage {
            role: if message.is_from_chatbot {
                MessageRole::Assistant
            } else {
                MessageRole::User
            },
            content: message.message.unwrap_or_default(),
            name: None,
            tool_call_id: None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct AzureLLMToolDefintion {
    #[serde(rename = "type")]
    pub tool_type: LLMToolType,
    pub function: LLMTool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LLMTool {
    pub name: String,
    pub description: String,
    pub parameters: LLMToolParams,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LLMToolParams {
    #[serde(rename = "type")]
    pub tool_type: LLMToolParamType,
    pub properties: Fooname,
    pub required: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Fooname {
    fooname: LLMToolParamProperties,
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
pub enum LLMToolChoice {
    // should be in chatbot_configurations?
    Auto,
    //Required,
    None,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LLMToolType {
    Function,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct ThinkingParams {
    pub max_completion_tokens: Option<i32>,
    pub verbosity: Option<VerbosityLevel>,
    pub reasoning_effort: Option<ReasoningEffortLevel>,
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
    None,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LLMRequest {
    pub messages: Vec<APIMessage>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub data_sources: Vec<DataSource>,
    #[serde(flatten)]
    pub params: LLMRequestParams,
    pub tools: Vec<AzureLLMToolDefintion>,
    pub tool_choice: Option<LLMToolChoice>,
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
                is_from_chatbot: false,
                message_is_complete: true,
                used_tokens: estimate_tokens(message),
                order_number: new_order_number,
            },
        )
        .await?;

        let mut api_chat_messages: Vec<APIMessage> =
            conversation_messages.into_iter().map(Into::into).collect();

        api_chat_messages.push(new_message.clone().into());

        api_chat_messages.insert(
            0,
            APIMessage {
                role: MessageRole::System,
                content: configuration.prompt.clone(),
                name: None,
                tool_call_id: None,
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

        let tools = if true {
            vec![AzureLLMToolDefintion {
                tool_type: LLMToolType::Function,
                function: LLMTool {
                    name: "foo".to_string(),
                    description: "foo".to_string(),
                    parameters: LLMToolParams {
                        tool_type: LLMToolParamType::Object,
                        properties: Fooname {
                            fooname: LLMToolParamProperties {
                                param_type: "string".to_string(),
                                description: "Get foo".to_string(),
                            },
                        },
                        required: vec!["fooname".to_string()],
                    },
                },
            }]
        } else {
            vec![]
        };

        let serialized_messages = serde_json::to_string(&api_chat_messages)?;
        let request_estimated_tokens = estimate_tokens(&serialized_messages);

        let params = if configuration.thinking_model {
            LLMRequestParams::Thinking(ThinkingParams {
                max_completion_tokens: Some(configuration.max_completion_tokens),
                reasoning_effort: Some(configuration.reasoning_effort),
                verbosity: Some(configuration.verbosity),
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
                tools,
                tool_choice: Some(LLMToolChoice::Auto),
                stop: None,
            },
            new_message,
            request_estimated_tokens,
        ))
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

pub async fn send_chat_request_and_parse_stream(
    conn: &mut PgConnection,
    pool: PgPool,
    app_config: &ApplicationConfiguration,
    chatbot_configuration_id: Uuid,
    conversation_id: Uuid,
    message: &str,
) -> anyhow::Result<Pin<Box<dyn Stream<Item = anyhow::Result<Bytes>> + Send>>> {
    let (chat_request, new_message, request_estimated_tokens) =
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

    let response_order_number = new_message.order_number + 1;

    let response_message = models::chatbot_conversation_messages::insert(
        conn,
        ChatbotConversationMessage {
            id: Uuid::new_v4(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
            conversation_id,
            message: None,
            is_from_chatbot: true,
            message_is_complete: false,
            used_tokens: request_estimated_tokens,
            order_number: response_order_number,
        },
    )
    .await?;

    let full_response_text = Arc::new(Mutex::new(Vec::new()));
    let done = Arc::new(AtomicBool::new(false));
    // Instantiate the guard before creating the stream.
    let guard = RequestCancelledGuard {
        response_message_id: response_message.id,
        received_string: full_response_text.clone(),
        pool: pool.clone(),
        done: done.clone(),
        request_estimated_tokens,
    };

    let response =
        make_streaming_llm_request(chat_request.clone(), &model.deployment_name, app_config)
            .await?;

    info!("Receiving chat response with {:?}", response.version());

    if !response.status().is_success() {
        let status = response.status();
        let error_message = response.text().await?;
        return Err(anyhow::anyhow!(
            "Failed to send chat request. Status: {}. Error: {}",
            status,
            error_message
        ));
    }

    let stream = response.bytes_stream().map_err(std::io::Error::other);
    let reader = StreamReader::new(stream);
    let mut lines = reader.lines();

    let response_stream = async_stream::try_stream! {
        'outer: loop {
        let mut function_calls: HashMap<(String, String), serde_json::Value> = HashMap::new();
        let mut function_call: Option<(String,String)> = None;
        let function_args = Arc::new(Mutex::new(Vec::new())); //idk?

        while let Some(line) = lines.next_line().await? {
            if !line.starts_with("data: ") {
                continue;
            }
            let json_str = line.trim_start_matches("data: ");

            let mut full_response_text = full_response_text.lock().await;
            let mut function_args = function_args.lock().await;
            if json_str.trim() == "[DONE]" {
                if function_calls.is_empty() {
                let full_response_as_string = full_response_text.join("");
                let estimated_cost = estimate_tokens(&full_response_as_string);
                info!(
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
                break 'outer;
             } else {
                    info!("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Funcrion calls: {:?}\n Trying to call functions...", function_calls);
                    let mut messages = (&chat_request).messages.clone();
                    for (key,val) in function_calls.iter() {
                        messages.push(APIMessage {
                            role: MessageRole::Tool,
                            content: "Your fooname has been recorded".to_string(),
                            name: Some(key.0.to_string()),
                            tool_call_id: Some(key.1.to_string()) })
                    }
                    let chat_request2 = LLMRequest {messages, data_sources: (&chat_request).data_sources.clone(), params: (&chat_request).params.clone(), tools: (&chat_request).tools.clone(), tool_choice: (&chat_request).tool_choice.clone(), stop: None
                        };
                    let response = make_streaming_llm_request(chat_request2, &model.deployment_name, app_config).await?;

                    break;
                }
            }
            let response_chunk = serde_json::from_str::<ResponseChunk>(json_str).map_err(|e| {
                anyhow::anyhow!("Failed to parse response chunk: {}", e)
            })?;

            for choice in &response_chunk.choices {
                if Some("tool_calls".to_string()) == choice.finish_reason {
                    if let Some(name_id) = &function_call {
                        function_calls.insert(name_id.to_owned(), json!(function_args.join("")));
                        function_args.clear();
                        function_call = None;
                    }
                }
                if let Some(delta) = &choice.delta {
                    if let Some(tool_calls) = &delta.tool_calls {
                        for call in tool_calls {
                            if let Some(name) = &call.function.name {
                                if let Some(prev_name) = function_call {
                                    function_calls.insert(prev_name, json!(function_args.join("")));
                                    function_args.clear();
                                }
                                function_call = Some((name.to_owned(), call.id.clone()));
                            };
                            function_args.push(call.function.arguments.clone());


                        }
                    }
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
                                    conversation_id,
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
    }
    };

    // Encapsulate the stream and the guard within GuardedStream. This moves the request guard into the stream and ensures that it is dropped when the stream is dropped.
    // This way we do cleanup only when the stream is dropped and not when this function returns.
    let guarded_stream = GuardedStream::new(guard, response_stream);

    // Box and pin the GuardedStream to satisfy the Unpin requirement
    Ok(Box::pin(guarded_stream))
}
