use crate::prelude::*;
use headless_lms_utils::ApplicationConfiguration;
use reqwest::header::HeaderMap;
use reqwest::Response;
use serde::{Deserialize, Serialize};

// API version for Azure OpenAI calls
pub const LLM_API_VERSION: &str = "2024-06-01";

/// Role of a message in a conversation
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum MessageRole {
    #[serde(rename = "system")]
    System,
    #[serde(rename = "user")]
    User,
    #[serde(rename = "assistant")]
    Assistant,
}

/// Common message structure used for LLM requests
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Message {
    pub role: MessageRole,
    pub content: String,
}

/// Base LLM request structure (common fields)
#[derive(Serialize, Deserialize, Debug)]
pub struct BaseLlmRequest {
    pub messages: Vec<Message>,
    pub temperature: f32,
    pub max_tokens: i32,
}

/// Simple completion-focused LLM request for Azure OpenAI
/// Note: In Azure OpenAI, the model is specified in the URL, not in the request body
#[derive(Serialize, Deserialize, Debug)]
pub struct AzureCompletionRequest {
    #[serde(flatten)]
    pub base: BaseLlmRequest,
    pub stream: bool,
}

/// Response from LLM for simple completions
#[derive(Deserialize, Debug)]
pub struct LlmCompletionResponse {
    pub choices: Vec<LlmChoice>,
}

#[derive(Deserialize, Debug)]
pub struct LlmChoice {
    pub message: Message,
}

/// Builds common headers for LLM requests
pub fn build_llm_headers(api_key: &str) -> anyhow::Result<HeaderMap> {
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
            .parse()
            .map_err(|_e| anyhow::anyhow!("Internal error"))?,
    );
    Ok(headers)
}

/// Prepares Azure OpenAI endpoint with API version
pub fn prepare_azure_endpoint(endpoint: &mut url::Url) {
    endpoint.set_query(Some(&format!("api-version={}", LLM_API_VERSION)));
}

/// Estimate the number of tokens in a given text.
pub fn estimate_tokens(text: &str) -> i32 {
    let text_length = text.chars().fold(0, |acc, c| {
        let mut len = c.len_utf8() as i32;
        if len > 1 {
            // The longer the character is, the more likely the text around is taking up more tokens
            len *= 2;
        }
        if c.is_ascii_punctuation() {
            // Punctuation is less common and is thus less likely to be part of a token
            len *= 2;
        }
        acc + len
    });
    // A token is roughly 4 characters
    text_length / 4
}

/// Makes a non-streaming request to an LLM
///
/// This is suitable for simple completion tasks where you want the full response at once
async fn make_llm_request(
    messages: Vec<Message>,
    temperature: f32,
    max_tokens: i32,
    endpoint: &url::Url,
    api_key: &str,
) -> anyhow::Result<LlmCompletionResponse> {
    let base_request = BaseLlmRequest {
        messages,
        temperature,
        max_tokens,
    };

    // We don't use streaming for simple requests
    let request = AzureCompletionRequest {
        base: base_request,
        stream: false,
    };

    let headers = build_llm_headers(api_key)?;

    // Call the LLM API
    let response = REQWEST_CLIENT
        .post(endpoint.clone())
        .headers(headers)
        .json(&request)
        .send()
        .await?;

    process_llm_response(response).await
}

/// Process a non-streaming LLM response
async fn process_llm_response(response: Response) -> anyhow::Result<LlmCompletionResponse> {
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        return Err(anyhow::anyhow!(
            "Error calling LLM API: Status: {}. Error: {}",
            status,
            error_text
        ));
    }

    // Parse the response
    let completion: LlmCompletionResponse = response.json().await?;
    Ok(completion)
}

/// Makes a streaming request to an LLM
///
/// This function will prepare and send the request but doesn't handle streaming
/// response processing, which should be done by the caller based on their needs
pub async fn make_streaming_llm_request(
    messages: Vec<Message>,
    temperature: f32,
    max_tokens: i32,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<Response> {
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let chatbot_config = azure_config.chatbot_config.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Chatbot configuration is missing from the Azure configuration")
    })?;

    let base_request = BaseLlmRequest {
        messages,
        temperature,
        max_tokens,
    };

    // Enable streaming
    let request = AzureCompletionRequest {
        base: base_request,
        stream: true,
    };

    let headers = build_llm_headers(&chatbot_config.api_key)?;

    // Call the LLM API
    let response = REQWEST_CLIENT
        .post(chatbot_config.api_endpoint.clone())
        .headers(headers)
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        return Err(anyhow::anyhow!(
            "Error calling LLM API: Status: {}. Error: {}",
            status,
            error_text
        ));
    }

    Ok(response)
}

/// Makes a non-streaming request to an LLM using application configuration
///
/// This is suitable for simple completion tasks where you want the full response at once
pub async fn make_blocking_llm_request(
    messages: Vec<Message>,
    temperature: f32,
    max_tokens: i32,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<LlmCompletionResponse> {
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let chatbot_config = azure_config.chatbot_config.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Chatbot configuration is missing from the Azure configuration")
    })?;

    make_llm_request(
        messages,
        temperature,
        max_tokens,
        &chatbot_config.api_endpoint,
        &chatbot_config.api_key,
    )
    .await
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
