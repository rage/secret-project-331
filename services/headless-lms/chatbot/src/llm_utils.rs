use crate::{azure_chatbot::LLMRequest, prelude::*};
use headless_lms_utils::ApplicationConfiguration;
use reqwest::Response;
use reqwest::header::HeaderMap;
use serde::{Deserialize, Serialize};
use tracing::{debug, error, instrument, trace, warn};

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

/// Common message structure used for LLM API requests
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct APIMessage {
    pub role: MessageRole,
    pub content: String,
}

/// Base LLM request structure (common fields)
#[derive(Serialize, Deserialize, Debug)]
pub struct BaseLlmRequest {
    pub messages: Vec<APIMessage>,
    pub temperature: f32,
    pub max_tokens: Option<i32>,
}

/// Simple completion-focused LLM request for Azure OpenAI
/// Note: In Azure OpenAI, the model is specified in the URL, not in the request body
#[derive(Serialize, Deserialize, Debug)]
pub struct AzureCompletionRequest {
    #[serde(flatten)]
    pub base: LLMRequest,
    pub stream: bool,
}

/// Response from LLM for simple completions
#[derive(Deserialize, Debug)]
pub struct LLMCompletionResponse {
    pub choices: Vec<LLMChoice>,
}

#[derive(Deserialize, Debug)]
pub struct LLMChoice {
    pub message: APIMessage,
}

/// Builds common headers for LLM requests
#[instrument(skip(api_key), fields(api_key_length = api_key.len()))]
pub fn build_llm_headers(api_key: &str) -> anyhow::Result<HeaderMap> {
    trace!("Building LLM request headers");
    let mut headers = HeaderMap::new();
    headers.insert(
        "api-key",
        api_key.parse().map_err(|_e| {
            error!("Failed to parse API key");
            anyhow::anyhow!("Invalid API key")
        })?,
    );
    headers.insert(
        "content-type",
        "application/json".parse().map_err(|_e| {
            error!("Failed to parse content-type header");
            anyhow::anyhow!("Internal error")
        })?,
    );
    trace!("Successfully built headers");
    Ok(headers)
}

/// Prepares Azure OpenAI endpoint with API version
#[instrument(skip(endpoint))]
pub fn prepare_azure_endpoint(mut endpoint: url::Url) -> url::Url {
    trace!(
        "Preparing Azure endpoint with API version {}",
        LLM_API_VERSION
    );
    // Always set the API version so that we actually use the API that the code is written for
    endpoint.set_query(Some(&format!("api-version={}", LLM_API_VERSION)));
    trace!("Endpoint prepared: {}", endpoint);
    endpoint
}

/// Estimate the number of tokens in a given text.
#[instrument(skip(text), fields(text_length = text.len()))]
pub fn estimate_tokens(text: &str) -> i32 {
    trace!("Estimating tokens for text");
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
    let estimated_tokens = text_length / 4;
    trace!("Estimated {} tokens for text", estimated_tokens);
    estimated_tokens
}

/// Makes a non-streaming request to an LLM
#[instrument(skip(chat_request, endpoint, api_key), fields(
    num_messages = chat_request.messages.len(),
    temperature,
    max_tokens,
    endpoint = %endpoint
))]
async fn make_llm_request(
    chat_request: LLMRequest,
    endpoint: &url::Url,
    api_key: &str,
) -> anyhow::Result<LLMCompletionResponse> {
    debug!(
        "Preparing LLM request with {} messages",
        chat_request.messages.len()
    );

    trace!("Base request: {:?}", chat_request);

    let request = AzureCompletionRequest {
        base: chat_request,
        stream: false,
    };

    let headers = build_llm_headers(api_key)?;
    debug!("Sending request to LLM endpoint: {}", endpoint);

    let response = REQWEST_CLIENT
        .post(prepare_azure_endpoint(endpoint.clone()))
        .headers(headers)
        .json(&request)
        .send()
        .await?;

    trace!("Received response from LLM");
    process_llm_response(response).await
}

/// Process a non-streaming LLM response
#[instrument(skip(response), fields(status = %response.status()))]
async fn process_llm_response(response: Response) -> anyhow::Result<LLMCompletionResponse> {
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        error!(
            status = %status,
            error = %error_text,
            "Error calling LLM API"
        );
        return Err(anyhow::anyhow!(
            "Error calling LLM API: Status: {}. Error: {}",
            status,
            error_text
        ));
    }

    trace!("Processing successful LLM response");
    // Parse the response
    let completion: LLMCompletionResponse = response.json().await?;
    debug!(
        "Successfully processed LLM response with {} choices",
        completion.choices.len()
    );
    Ok(completion)
}

/// Makes a streaming request to an LLM
#[instrument(skip(chat_request, app_config), fields(
    num_messages = chat_request.messages.len(),
    temperature,
    max_tokens
))]
pub async fn make_streaming_llm_request(
    chat_request: LLMRequest,
    model_deployment_name: &str,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<Response> {
    debug!(
        "Preparing streaming LLM request with {} messages",
        chat_request.messages.len()
    );
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        error!("Azure configuration missing");
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let chatbot_config = azure_config.chatbot_config.as_ref().ok_or_else(|| {
        error!("Chatbot configuration missing");
        anyhow::anyhow!("Chatbot configuration is missing from the Azure configuration")
    })?;

    trace!("Base request: {:?}", chat_request);

    let request = AzureCompletionRequest {
        base: chat_request,
        stream: true,
    };

    let headers = build_llm_headers(&chatbot_config.api_key)?;
    let api_endpoint = chatbot_config
        .api_endpoint_first
        .join(&(model_deployment_name.to_owned() + &chatbot_config.api_endpoint_last))?;
    debug!(
        "Sending streaming request to LLM endpoint: {}",
        api_endpoint
    );

    let response = REQWEST_CLIENT
        .post(prepare_azure_endpoint(api_endpoint.clone()))
        .headers(headers)
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        error!(
            status = %status,
            error = %error_text,
            "Error calling streaming LLM API"
        );
        return Err(anyhow::anyhow!(
            "Error calling LLM API: Status: {}. Error: {}",
            status,
            error_text
        ));
    }

    debug!("Successfully initiated streaming response");
    Ok(response)
}

/// Makes a non-streaming request to an LLM using application configuration
#[instrument(skip(chat_request, app_config), fields(
    num_messages = chat_request.messages.len(),
    temperature,
    max_tokens
))]
pub async fn make_blocking_llm_request(
    chat_request: LLMRequest,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<LLMCompletionResponse> {
    debug!(
        "Preparing blocking LLM request with {} messages",
        chat_request.messages.len()
    );
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        error!("Azure configuration missing");
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let chatbot_config = azure_config.chatbot_config.as_ref().ok_or_else(|| {
        error!("Chatbot configuration missing");
        anyhow::anyhow!("Chatbot configuration is missing from the Azure configuration")
    })?;

    let api_endpoint = chatbot_config
        .api_endpoint_first
        .join("gpt-4o")?
        .join(&chatbot_config.api_endpoint_last)?;

    trace!("Making LLM request to endpoint: {}", api_endpoint);
    make_llm_request(chat_request, &api_endpoint, &chatbot_config.api_key).await
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
