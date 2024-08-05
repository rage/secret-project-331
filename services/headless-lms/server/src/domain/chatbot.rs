use actix_http::header;
use futures::prelude::stream::TryStreamExt;
use futures::Stream;
use once_cell::sync::Lazy;
use reqwest::header::HeaderMap;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncBufReadExt;
use tokio_util::io::StreamReader;
use web::Bytes;

use actix::{Actor, Handler, Message, StreamHandler};
use actix_web::{http, web, App, Error, HttpRequest, HttpResponse, HttpServer};
use actix_web_actors::ws;

use crate::prelude::*;

static CLIENT: Lazy<Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .use_rustls_tls()
        .https_only(true)
        .build()
        .expect("Failed to build Client")
});

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
    pub index: u32,
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

#[derive(Serialize, Deserialize, Debug)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    pub temperature: f64,
    pub top_p: f64,
    pub frequency_penalty: f64,
    pub presence_penalty: f64,
    pub max_tokens: u32,
    pub stop: Option<String>,
    pub stream: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ChatReponse {
    pub text: String,
}

struct RequestCancelledGuard;

impl Drop for RequestCancelledGuard {
    fn drop(&mut self) {
        info!("Request cancelled");
    }
}

pub async fn send_chat_request_and_parse_stream(
    payload: &ChatRequest,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<impl Stream<Item = anyhow::Result<Bytes>>> {
    let mut full_response_text = Vec::new();
    let _request_cancelled_guard = RequestCancelledGuard;

    let api_key = app_config
        .chatbot_azure_api_key
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Chatbot API key not found"))?;
    let mut url = app_config
        .chatbot_azure_api_endpoint
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Chatbot API endpoint not found"))?
        .clone();

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

    let request = CLIENT.post(url).headers(headers).json(payload).send();

    let response = request.await?;

    info!("Receiving chat response with {:?}", response.version());

    dbg!(response.status(), response.headers(), response.version());

    let stream = response
        .bytes_stream()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e));
    let reader = StreamReader::new(stream);
    let mut lines = reader.lines();

    let response_stream = async_stream::try_stream! {
        let mut done = false;
        while let Some(line) = lines.next_line().await? {
            // dbg!(&line);
            if !line.starts_with("data: ") {
                continue;
            }
            let json_str = line.trim_start_matches("data: ");
            if json_str.trim() == "[DONE]" {
                let full_response_as_string = full_response_text.join("");
                let estimated_cost = estimate_tokens(&full_response_as_string);
                info!("End of chatbot response stream. Esimated cost: {}. Response: {}", estimated_cost, full_response_as_string);
                done = true;
                break;
            }
            let response_chunk = serde_json::from_str::<ResponseChunk>(json_str).map_err(|e| {
                // dbg!(&json_str);
                // dbg!(&e);
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

        if !done {
            Err(anyhow::anyhow!("Stream ended unexpectedly"))?;
        }
    };

    Ok(response_stream)
}

/** Estimate the number of tokens in a given text. We use this for example to estimate the expense of a chat request. The result is not accurate but it is cheap to calculate. */
fn estimate_tokens(text: &str) -> u32 {
    // Counting text length by taking into account how much space each unicode character takes. This makes more complex characters more expensive.
    let text_length = text.chars().fold(0, |acc, c| {
        let mut len = c.len_utf8() as u32;
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
    text_length as u32 / 4
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
