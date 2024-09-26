use std::sync::{
    atomic::{self, AtomicBool},
    Arc,
};

use chrono::Utc;
use futures::prelude::stream::TryStreamExt;
use futures::Stream;
use headless_lms_models::chatbot_conversation_messages::ChatbotConversationMessage;

use headless_lms_utils::http::REQWEST_CLIENT;
use reqwest::header::HeaderMap;
use serde::{Deserialize, Serialize};
use tokio::{io::AsyncBufReadExt, sync::Mutex};
use tokio_util::io::StreamReader;
use web::Bytes;

use actix_web::web;

use crate::prelude::*;

pub const CHATBOT_AZURE_API_VERSION: &str = "2024-02-01";

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

/** The format accepted by the api. */
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
    pub temperature: f32,
    pub top_p: f32,
    pub frequency_penalty: f32,
    pub presence_penalty: f32,
    pub max_tokens: i32,
    pub stop: Option<String>,
    pub stream: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ChatReponse {
    pub text: String,
}

struct RequestCancelledGuard {
    response_message_id: Uuid,
    received_string: Arc<Mutex<Vec<String>>>,
    pool: web::Data<PgPool>,
    done: Arc<AtomicBool>,
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
        tokio::spawn(async move {
            info!("Verifying the received message has been handled");
            let mut conn = pool.acquire().await.expect("Could not acquire connection");
            let full_response_text = received_string.lock().await;
            // TODO: Verify this works
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
                "End of chatbot response stream. Esimated cost: {}. Response: {}",
                estimated_cost, full_response_as_string
            );

            models::chatbot_conversation_messages::update(
                &mut conn,
                response_message_id,
                &full_response_as_string,
                true,
            )
            .await
            .expect("Could not update response message");
        });
    }
}

pub async fn send_chat_request_and_parse_stream(
    conn: &mut PgConnection,
    // An Arc, cheap to clone.
    pool: web::Data<PgPool>,
    payload: &ChatRequest,
    app_config: &ApplicationConfiguration,
    conversation_id: Uuid,
    response_order_number: i32,
) -> anyhow::Result<impl Stream<Item = anyhow::Result<Bytes>>> {
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

    // Always set the api version so that we actually use the api that the code is written for
    url.set_query(Some(&format!("api-version={}", CHATBOT_AZURE_API_VERSION)));

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

    let response_message = models::chatbot_conversation_messages::insert(
        conn,
        models::chatbot_conversation_messages::ChatbotConversationMessage {
            id: Uuid::new_v4(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
            conversation_id,
            message: None,
            is_from_chatbot: true,
            message_is_complete: false,
            used_tokens: 0,
            order_number: response_order_number,
        },
    )
    .await?;

    let _request_cancelled_guard = RequestCancelledGuard {
        response_message_id: response_message.id,
        received_string: full_response_text.clone(),
        pool: pool.clone(),
        done: done.clone(),
    };

    let request = REQWEST_CLIENT
        .post(url)
        .headers(headers)
        .json(payload)
        .send();

    let response = request.await?;

    info!("Receiving chat response with {:?}", response.version());

    if !&response.status().is_success() {
        let status = &response.status();
        let error_message = &response.text().await?;
        return Err(anyhow::anyhow!(
            "Failed to send chat request. Status: {}. Error: {}",
            status,
            error_message
        ))?;
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
                info!("End of chatbot response stream. Esimated cost: {}. Response: {}", estimated_cost, full_response_as_string);
                done.store(true, atomic::Ordering::Relaxed);
                let mut conn = pool.acquire().await?;
                models::chatbot_conversation_messages::update(
                    &mut conn,
                    response_message.id,
                    &full_response_as_string,
                    true
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
                        let response = ChatReponse { text: content.clone() };
                        let response_as_string = serde_json::to_string(&response)?;
                        let bytes = Bytes::from(response_as_string);
                        yield bytes;
                        yield Bytes::from("\n");
                    }

                }
            }
        }

        if !done.load(atomic::Ordering::Relaxed) {
            Err(anyhow::anyhow!("Stream ended unexpectedly"))?;
        }
    };

    Ok(response_stream)
}

/** Estimate the number of tokens in a given text. We use this for example to estimate the expense of a chat request. The result is not accurate but it is cheap to calculate. */
pub fn estimate_tokens(text: &str) -> i32 {
    // Counting text length by taking into account how much space each unicode character takes. This makes more complex characters more expensive.
    let text_length = text.chars().fold(0, |acc, c| {
        let mut len = c.len_utf8() as i32;
        if len > 1 {
            // The longer the character is, the more likely the text around is taking up more tokens. This is because our estimate of 4 characters per token is only valid for english and non-english languages tend to have more complex characters.
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
