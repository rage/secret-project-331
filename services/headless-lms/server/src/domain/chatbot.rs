use actix_http::header;
use futures::prelude::stream::TryStreamExt;
use futures::Stream;
use reqwest::header::HeaderMap;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncBufReadExt;
use tokio_util::io::StreamReader;
use web::Bytes;

use crate::prelude::*;

#[derive(Deserialize, Serialize, Debug)]
pub struct ContentFilterResults {
    pub hate: ContentFilter,
    pub self_harm: ContentFilter,
    pub sexual: ContentFilter,
    pub violence: ContentFilter,
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
    pub content: String,
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

pub async fn send_chat_request_and_parse_stream(
    payload: &ChatRequest,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<impl Stream<Item = anyhow::Result<Bytes>>> {
    let api_key = app_config
        .chatbot_azure_api_key
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Chatbot API key not found"))?;
    let url = app_config
        .chatbot_azure_api_endpoint
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Chatbot API endpoint not found"))?;

    let client = Client::new();

    let mut headers = HeaderMap::new();
    headers.insert(
        "api-key",
        api_key
            .parse()
            .map_err(|_e| anyhow::anyhow!("Invalid API key"))?,
    );
    headers.insert(
        header::CONTENT_TYPE,
        "application/json"
            .to_string()
            .parse()
            .map_err(|_e| anyhow::anyhow!("Internal error"))?,
    );

    let request = client.post(url).headers(headers).json(payload).send();

    let stream = request
        .await?
        .bytes_stream()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e));
    let reader = StreamReader::new(stream);
    let mut lines = reader.lines();

    let response_stream = async_stream::try_stream! {
        let mut done = false;
        while let Some(line) = lines.next_line().await? {
            if !line.starts_with("data: ") {
                continue;
            }
            let json_str = line.trim_start_matches("data: ");
            if json_str.trim() == "[DONE]" {
                // TODO: Handle DONE
                done = true;
                break;
            }
            let response_chunk = serde_json::from_str::<ResponseChunk>(json_str)?;
            let bytes = Bytes::from(json_str.to_string());
            yield bytes;
        }

        if !done {
            Err(anyhow::anyhow!("Stream ended unexpectedly"))?;
        }
    };

    Ok(response_stream)
}
