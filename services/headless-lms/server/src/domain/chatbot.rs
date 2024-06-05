use actix_http::header;
use futures::prelude::stream::TryStreamExt;
use reqwest::header::HeaderMap;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncBufReadExt;
use tokio_util::io::StreamReader;

use crate::prelude::*;

#[derive(Deserialize, Serialize, Debug)]
struct ContentFilterResults {
    hate: ContentFilter,
    self_harm: ContentFilter,
    sexual: ContentFilter,
    violence: ContentFilter,
}

#[derive(Deserialize, Serialize, Debug)]
struct ContentFilter {
    filtered: bool,
    severity: String,
}

#[derive(Deserialize, Serialize, Debug)]
struct Choice {
    content_filter_results: Option<ContentFilterResults>,
    delta: Option<Delta>,
    finish_reason: Option<String>,
    index: u32,
}

#[derive(Deserialize, Serialize, Debug)]
struct Delta {
    content: String,
}

#[derive(Deserialize, Serialize, Debug)]
struct ResponseChunk {
    choices: Vec<Choice>,
    created: u64,
    id: String,
    model: String,
    object: String,
    system_fingerprint: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct ChatRequest {
    messages: Vec<ChatMessage>,
    temperature: f64,
    top_p: f64,
    frequency_penalty: f64,
    presence_penalty: f64,
    max_tokens: u32,
    stop: Option<String>,
    stream: bool,
}

async fn send_chat_request_and_parse_stream(
    api_key: &str,
    url: &str,
    payload: &ChatRequest,
) -> ControllerResult<Vec<ResponseChunk>> {
    let client = Client::new();

    let mut headers = HeaderMap::new();
    headers.insert(
        "api-key",
        api_key.parse().map_err(|_e| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Invalid API key".to_string(),
                None,
            )
        })?,
    );
    headers.insert(
        header::CONTENT_TYPE,
        "application/json".to_string().parse().map_err(|_e| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                "Invalid header value".to_string(),
                None,
            )
        })?,
    );

    let request = client.post(url).headers(headers).json(payload).send();

    let stream = request
        .await
        .unwrap()
        .bytes_stream()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e));
    let reader = StreamReader::new(stream);
    let mut lines = reader.lines();
    let mut response_chunks = Vec::new();

    while let Some(line) = lines.next_line().await.unwrap() {
        if !line.starts_with("data: ") {
            continue;
        }
        let json_str = line.trim_start_matches("data: ");
        if json_str.trim() == "[DONE]" {
            return todo!("Handle DONE");
        }
        let response_chunk = serde_json::from_str::<ResponseChunk>(json_str);
        match response_chunk {
            Ok(response_chunk) => response_chunks.push(response_chunk),
            Err(e) => {
                return Err(ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    format!("Failed to parse chat response: {}", e),
                    None,
                ))
            }
        };
    }

    Err(ControllerError::new(
        ControllerErrorType::InternalServerError,
        "Chat response did not end".to_string(),
        None,
    ))
}

#[tokio::main]
async fn main() {
    let api_key = "x";
    let url = "https://example.com";
    let payload = ChatRequest {
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: "You are an AI assistant that helps people find information.".to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: "Hi! What are monads?".to_string(),
            },
        ],
        temperature: 0.7,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        max_tokens: 1000,
        stop: None,
        stream: true,
    };

    let _response_chunks = send_chat_request_and_parse_stream(api_key, url, &payload)
        .await
        .unwrap();
}
