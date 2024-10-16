use std::pin::Pin;
use std::sync::{
    atomic::{self, AtomicBool},
    Arc,
};
use std::task::{Context, Poll};

use bytes::Bytes;
use chrono::Utc;
use futures::{Stream, TryStreamExt};
use headless_lms_models::chatbot_conversation_messages::ChatbotConversationMessage;
use headless_lms_utils::{http::REQWEST_CLIENT, ApplicationConfiguration};
use pin_project::pin_project;
use reqwest::header::HeaderMap;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tokio::{io::AsyncBufReadExt, sync::Mutex};
use tokio_util::io::StreamReader;
use url::Url;

use crate::prelude::*;

pub const CHATBOT_AZURE_API_VERSION: &str = "2024-06-01";

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

/// The format accepted by the API.
#[derive(Serialize, Deserialize, Debug)]
pub struct ApiChatMessage {
    pub role: String,
    pub content: String,
}

impl From<ChatbotConversationMessage> for ApiChatMessage {
    fn from(message: ChatbotConversationMessage) -> Self {
        ApiChatMessage {
            role: if message.is_from_chatbot {
                "assistant".to_string()
            } else {
                "user".to_string()
            },
            content: message.message.unwrap_or_default(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ChatRequest {
    pub messages: Vec<ApiChatMessage>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub data_sources: Vec<DataSource>,
    pub temperature: f32,
    pub top_p: f32,
    pub frequency_penalty: f32,
    pub presence_penalty: f32,
    pub max_tokens: i32,
    pub stop: Option<String>,
    pub stream: bool,
}

impl ChatRequest {
    pub async fn build_and_insert_incoming_message_to_db(
        conn: &mut PgConnection,
        chatbot_configuration_id: Uuid,
        conversation_id: Uuid,
        message: &str,
        app_config: &ApplicationConfiguration,
    ) -> anyhow::Result<(Self, ChatbotConversationMessage, i32)> {
        let index_name_prefix = Url::parse(&app_config.base_url)?
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

        let mut api_chat_messages: Vec<ApiChatMessage> =
            conversation_messages.into_iter().map(Into::into).collect();

        api_chat_messages.push(new_message.clone().into());

        api_chat_messages.insert(
            0,
            ApiChatMessage {
                role: "system".to_string(),
                content: configuration.prompt.clone(),
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

            vec![DataSource {
                data_type: "azure_search".to_string(),
                parameters: DataSourceParameters {
                    endpoint: search_config.search_endpoint.to_string(),
                    authentication: DataSourceParametersAuthentication {
                        auth_type: "api_key".to_string(),
                        key: search_config.search_api_key.clone(),
                    },
                    index_name: format!("{}-{}", index_name_prefix, configuration.course_id),
                    query_type: "vector_simple_hybrid".to_string(),
                    semantic_configuration: "default".to_string(),
                    embedding_dependency: EmbeddingDependency {
                        dep_type: "deployment_name".to_string(),
                        deployment_name: search_config.vectorizer_deployment_id.clone(),
                    },
                    in_scope: false,
                    top_n_documents: 5,
                    strictness: 3,
                    fields_mapping: FieldsMapping {
                        content_fields_separator: ",".to_string(),
                        content_fields: vec!["chunk".to_string()],
                        filepath_field: "filepath".to_string(),
                        title_field: "title".to_string(),
                        url_field: "page_path".to_string(),
                        vector_fields: vec!["text_vector".to_string()],
                    },
                },
            }]
        } else {
            Vec::new()
        };

        let serialized_messages = serde_json::to_string(&api_chat_messages)?;
        let request_estimated_tokens = estimate_tokens(&serialized_messages);

        Ok((
            Self {
                messages: api_chat_messages,
                data_sources,
                temperature: configuration.temperature,
                top_p: configuration.top_p,
                frequency_penalty: configuration.frequency_penalty,
                presence_penalty: configuration.presence_penalty,
                max_tokens: configuration.response_max_tokens,
                stop: None,
                stream: true,
            },
            new_message,
            request_estimated_tokens,
        ))
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DataSource {
    #[serde(rename = "type")]
    pub data_type: String,
    pub parameters: DataSourceParameters,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DataSourceParameters {
    pub endpoint: String,
    pub authentication: DataSourceParametersAuthentication,
    pub index_name: String,
    pub query_type: String,
    pub embedding_dependency: EmbeddingDependency,
    pub in_scope: bool,
    pub top_n_documents: i32,
    pub strictness: i32,
    pub fields_mapping: FieldsMapping,
    pub semantic_configuration: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DataSourceParametersAuthentication {
    #[serde(rename = "type")]
    pub auth_type: String,
    pub key: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct EmbeddingDependency {
    #[serde(rename = "type")]
    pub dep_type: String,
    pub deployment_name: String,
}

#[derive(Serialize, Deserialize, Debug)]
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
        info!("Request cancelled");
        if self.done.load(atomic::Ordering::Relaxed) {
            return;
        }
        warn!("Request was not completed. Cleaning up.");
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
        ChatRequest::build_and_insert_incoming_message_to_db(
            conn,
            chatbot_configuration_id,
            conversation_id,
            message,
            app_config,
        )
        .await?;

    let full_response_text = Arc::new(Mutex::new(Vec::new()));
    let done = Arc::new(AtomicBool::new(false));

    let azure_config = app_config
        .azure_configuration
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Azure configuration not found"))?;

    let chatbot_config = azure_config
        .chatbot_config
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Chatbot configuration not found"))?;

    let api_key = chatbot_config.api_key.clone();
    let mut url = chatbot_config.api_endpoint.clone();

    // Always set the API version so that we actually use the API that the code is written for
    url.set_query(Some(&format!("api-version={}", CHATBOT_AZURE_API_VERSION)));

    let headers = build_headers(&api_key)?;

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

    // Instantiate the guard before creating the stream.
    let guard = RequestCancelledGuard {
        response_message_id: response_message.id,
        received_string: full_response_text.clone(),
        pool: pool.clone(),
        done: done.clone(),
        request_estimated_tokens,
    };

    let request = REQWEST_CLIENT
        .post(url)
        .headers(headers)
        .json(&chat_request)
        .send();

    let response = request.await?;

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

    let stream = response
        .bytes_stream()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e));
    let reader = StreamReader::new(stream);
    let mut lines = reader.lines();

    let response_stream = async_stream::try_stream! {
        while let Some(line) = lines.next_line().await? {
            if !line.starts_with("data: ") {
                continue;
            }
            let json_str = line.trim_start_matches("data: ");
            let mut full_response_text = full_response_text.lock().await;
            if json_str.trim() == "[DONE]" {
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

/// Build the headers for the API request.
fn build_headers(api_key: &str) -> anyhow::Result<HeaderMap> {
    let mut headers = HeaderMap::new();
    headers.insert(
        "api-key",
        api_key
            .parse()
            .map_err(|_e| anyhow::anyhow!("Invalid API key"))?,
    );
    headers.insert(
        "content-type",
        "application/json"
            .to_string()
            .parse()
            .map_err(|_e| anyhow::anyhow!("Internal error"))?,
    );
    Ok(headers)
}

/// Estimate the number of tokens in a given text. We use this for example to estimate the expense of a chat request. The result is not accurate but it is cheap to calculate.
pub fn estimate_tokens(text: &str) -> i32 {
    // Counting text length by taking into account how much space each unicode character takes. This makes more complex characters more expensive.
    let text_length = text.chars().fold(0, |acc, c| {
        let mut len = c.len_utf8() as i32;
        if len > 1 {
            // The longer the character is, the more likely the text around is taking up more tokens. This is because our estimate of 4 characters per token is only valid for English and non-English languages tend to have more complex characters.
            len *= 2;
        }
        if c.is_ascii_punctuation() {
            // Punctuation is less common and is thus less likely to be part of a token.
            len *= 2;
        }
        acc + len
    });
    // A token is roughly 4 characters
    text_length / 4
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_estimate_tokens() {
        // The real number is 4
        assert_eq!(estimate_tokens("Hello, world!"), 3);
        assert_eq!(estimate_tokens(""), 0);
        // The real number is 9
        assert_eq!(
            estimate_tokens("This is a longer sentence with several words."),
            11
        );
        // The real number is 7
        assert_eq!(estimate_tokens("Hyvää päivää!"), 7);
        // The real number is 9
        assert_eq!(estimate_tokens("トークンは楽しい"), 12);
        // The real number is 52
        assert_eq!(
            estimate_tokens("🙂🙃😀😃😄😁😆😅😂🤣😊😇🙂🙃😀😃😄😁😆😅😂🤣😊😇"),
            48
        );
        // The real number is 18
        assert_eq!(estimate_tokens("ฉันใช้โทเค็นทุกวัน"), 27);
        // The real number is 17
        assert_eq!(estimate_tokens("Жетони роблять мене щасливим"), 25);
    }
}
