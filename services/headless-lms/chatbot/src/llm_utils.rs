use crate::{
    azure_chatbot::{ChatResponse, LLMRequest, OutputItem, ReasoningOutput, ToolCallType},
    chatbot_error::ChatbotResult,
    prelude::*,
};
use core::default::Default;
use headless_lms_models::{
    chatbot_conversation_message_messages::{ChatbotConversationMessageMessage, MessageRole},
    chatbot_conversation_message_reasoning::ChatbotConversationMessageReasoning,
    chatbot_conversation_message_tool_calls::{ChatbotConversationMessageToolCall, ToolKind},
    chatbot_conversation_message_tool_outputs::ChatbotConversationMessageToolOutput,
    chatbot_conversation_messages::{ChatbotConversationMessage, Message},
};
use headless_lms_utils::ApplicationConfiguration;
use reqwest::Response;
use reqwest::header::HeaderMap;
use serde::{Deserialize, Serialize};
use tracing::{debug, error, instrument, trace, warn};

// API version for Azure OpenAI calls
pub const LLM_API_VERSION: &str = "2024-10-21";

/// Common message structure used for LLM API requests
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct APIMessage {
    #[serde(flatten)]
    pub message_type: OutputItem,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum MessageContent {
    Text(String),
    Object(Vec<ChatResponse>),
}

impl MessageContent {
    pub fn get_content_text(self) -> String {
        match self {
            MessageContent::Text(msg_text) => msg_text,
            MessageContent::Object(output) => output
                .iter()
                .map(|x| x.text.to_owned())
                .collect::<Vec<String>>()
                .join(""),
        }
    }
}

impl APIMessage {
    /// Create a ChatbotConversationMessage from an APIMessage to save it into the DB.
    /// Notice that the insert operation ignores some of the fields, like timestamps.
    /// `to_chatbot_conversation_message` doesn't set the correct order_number field
    /// value.
    pub fn to_chatbot_conversation_message(
        &self,
        conversation_id: Uuid,
        order_number: i32,
    ) -> ChatbotResult<ChatbotConversationMessage> {
        let res = match self.message_type.clone() {
            OutputItem::Message { role, content } => {
                let text = content.get_content_text();
                let used_tokens = estimate_tokens(&text);

                ChatbotConversationMessage {
                    conversation_id,
                    order_number,
                    message: Message::Text(ChatbotConversationMessageMessage {
                        text,
                        message_role: role,
                        message_is_complete: true,
                        used_tokens,
                        ..Default::default()
                    }),
                    ..Default::default()
                }
            }
            OutputItem::FunctionCall {
                call_id,
                tool_name,
                arguments,
            } => ChatbotConversationMessage {
                conversation_id,
                order_number,
                message: Message::ToolCall(ChatbotConversationMessageToolCall {
                    tool_name,
                    tool_arguments: arguments,
                    tool_call_id: call_id,
                    tool_kind: ToolKind::Function,
                    ..Default::default()
                }),
                ..Default::default()
            },
            OutputItem::FunctionCallOutput { call_id, output } => ChatbotConversationMessage {
                conversation_id,
                order_number,
                message: Message::ToolOutput(ChatbotConversationMessageToolOutput {
                    output,
                    tool_call_id: call_id,
                    tool_kind: ToolKind::Function,
                    ..Default::default()
                }),
                ..Default::default()
            },
            OutputItem::AzureAiSearchCall { call_id, arguments } => ChatbotConversationMessage {
                conversation_id,
                order_number,
                message: Message::ToolCall(ChatbotConversationMessageToolCall {
                    tool_arguments: arguments,
                    tool_call_id: call_id,
                    tool_kind: ToolKind::AzureAiSearch,
                    tool_name: "azure_ai_search".to_string(),
                    ..Default::default()
                }),
                ..Default::default()
            },
            OutputItem::AzureAiSearchCallOutput { call_id, output } => ChatbotConversationMessage {
                conversation_id,
                order_number,
                message: Message::ToolOutput(ChatbotConversationMessageToolOutput {
                    tool_call_id: call_id,
                    tool_kind: ToolKind::AzureAiSearch,
                    output,
                    ..Default::default()
                }),
                ..Default::default()
            },
            OutputItem::Reasoning { summary } => {
                let text = if summary.len() > 0 {
                    Some(
                        summary
                            .iter()
                            .map(|i| i.text.to_owned())
                            .collect::<Vec<String>>()
                            .join(" "),
                    )
                } else {
                    None
                };
                ChatbotConversationMessage {
                    conversation_id,
                    order_number,
                    message: Message::Reasoning(ChatbotConversationMessageReasoning {
                        summary: text,
                        ..Default::default()
                    }),
                    ..Default::default()
                }
            }
        };
        Result::Ok(res)
    }
}

impl TryFrom<ChatbotConversationMessage> for APIMessage {
    type Error = ChatbotError;
    fn try_from(message: ChatbotConversationMessage) -> ChatbotResult<Self> {
        let res = match message.message {
            Message::Text(text_message) => {
                match text_message.message_role {
                    MessageRole::User | MessageRole::Assistant => APIMessage {
                        message_type: OutputItem::Message {
                            role: text_message.message_role,
                            content: MessageContent::Text(text_message.text),
                        },
                    },
                    _ => {
                        return Err(ChatbotError::new(
                            ChatbotErrorType::Other,
                            "IDK what to do with system and developer role messages",
                            None,
                        ));
                    } // todo
                }
            }
            Message::ToolCall(tool_call) => match tool_call.tool_kind {
                ToolKind::Function => APIMessage {
                    message_type: OutputItem::FunctionCall {
                        call_id: tool_call.tool_call_id,
                        tool_name: tool_call.tool_name,
                        arguments: tool_call.tool_arguments,
                    },
                },
                ToolKind::AzureAiSearch => APIMessage {
                    message_type: OutputItem::AzureAiSearchCall {
                        call_id: tool_call.tool_call_id,
                        arguments: tool_call.tool_arguments,
                    },
                },
            },
            Message::ToolOutput(tool_output) => match tool_output.tool_kind {
                ToolKind::Function => APIMessage {
                    message_type: OutputItem::FunctionCallOutput {
                        call_id: tool_output.tool_call_id,
                        output: tool_output.output,
                    },
                },
                ToolKind::AzureAiSearch => APIMessage {
                    message_type: OutputItem::AzureAiSearchCallOutput {
                        call_id: tool_output.tool_call_id,
                        output: tool_output.output,
                    },
                },
            },
            Message::Reasoning(reasoning) => {
                if let Some(text) = reasoning.summary {
                    APIMessage {
                        message_type: OutputItem::Reasoning {
                            summary: vec![ReasoningOutput {
                                output_type: "summary_text".to_string(),
                                text,
                            }],
                        },
                    }
                } else {
                    APIMessage {
                        message_type: OutputItem::Reasoning { summary: vec![] },
                    }
                }
            } //TODO TODO
              /* {
                  return Err(ChatbotError::new(
                      ChatbotErrorType::InvalidMessageShape,
                      "A 'role: system' type ChatbotConversationMessage cannot be saved into the database.",
                      None,
                  ));
              } */
        };
        Result::Ok(res)
    }
}

impl From<ChatbotConversationMessageToolOutput> for APIMessage {
    fn from(value: ChatbotConversationMessageToolOutput) -> Self {
        APIMessage {
            message_type: OutputItem::FunctionCallOutput {
                call_id: value.tool_call_id,
                output: value.output,
            },
        }
    }
}

impl TryFrom<APIMessage> for ChatbotConversationMessageToolOutput {
    type Error = ChatbotError;
    fn try_from(value: APIMessage) -> ChatbotResult<Self> {
        match value.message_type {
            OutputItem::FunctionCallOutput { call_id, output } => {
                Ok(ChatbotConversationMessageToolOutput {
                    output,
                    tool_call_id: call_id,
                    ..Default::default()
                })
            }
            _ => Err(ChatbotError::new(
                ChatbotErrorType::Other,
                "Can't convert APIMessage to ChatbotConversationMessageToolOutput: APIMessage type is not OutputItem::FunctionCallOutput",
                None,
            )),
        }
    }
}

/// An LLM tool call that is part of a request to Azure
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct APIToolCall {
    pub function: APITool,
    pub id: String,
    #[serde(rename = "type")]
    pub tool_type: ToolCallType,
}

impl From<ChatbotConversationMessageToolCall> for APIToolCall {
    fn from(value: ChatbotConversationMessageToolCall) -> Self {
        APIToolCall {
            function: APITool {
                arguments: value.tool_arguments.to_string(),
                name: value.tool_name,
            },
            id: value.tool_call_id,
            tool_type: ToolCallType::Function,
        }
    }
}

impl TryFrom<APIToolCall> for ChatbotConversationMessageToolCall {
    type Error = ChatbotError;
    fn try_from(value: APIToolCall) -> ChatbotResult<Self> {
        Ok(ChatbotConversationMessageToolCall {
            tool_name: value.function.name,
            tool_arguments: serde_json::from_str(&value.function.arguments)?,
            tool_call_id: value.id,
            ..Default::default()
        })
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct APITool {
    pub arguments: String,
    pub name: String,
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
pub struct LLMResponse {
    pub id: String,
    pub output: Vec<APIMessage>,
}

#[derive(Deserialize, Debug)]
pub struct LLMOutput {
    #[serde(rename = "type")]
    pub output_type: String, // "message"
    pub message: APIMessage,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct APIOutputMessage {
    pub content: Vec<ChatResponse>,
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
    num_messages = chat_request.input.len(),
    temperature,
    max_tokens,
    endpoint = %endpoint
))]
async fn make_llm_request(
    chat_request: LLMRequest,
    endpoint: &url::Url,
    api_key: &str,
) -> anyhow::Result<LLMResponse> {
    debug!(
        "Preparing LLM request with {} messages",
        chat_request.input.len()
    );

    trace!("Base request: {:?}", chat_request);

    let request = AzureCompletionRequest {
        base: chat_request,
        stream: false,
    };

    let headers = build_llm_headers(api_key)?;
    debug!("Sending request to LLM endpoint: {}", endpoint);

    let response = REQWEST_CLIENT
        .post(endpoint.clone())
        .headers(headers)
        .json(&request)
        .send()
        .await?;

    trace!("Received response from LLM");
    process_llm_response(response).await
}

/// Process a non-streaming LLM response
#[instrument(skip(response), fields(status = %response.status()))]
async fn process_llm_response(response: Response) -> anyhow::Result<LLMResponse> {
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
    let completion: LLMResponse = response.json().await?;
    debug!(
        "Successfully processed LLM response with {} choices",
        completion.output.len()
    );
    Ok(completion)
}

/// Makes a streaming request to an LLM
#[instrument(skip(chat_request, app_config), fields(
    num_messages = chat_request.input.len(),
    temperature,
    max_tokens
))]
pub async fn make_streaming_llm_request(
    chat_request: LLMRequest,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<Response> {
    debug!(
        "Preparing streaming LLM request with {} messages",
        chat_request.input.len()
    );
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        error!("Azure configuration missing");
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let chatbot_config = azure_config.chatbot_config.as_ref().ok_or_else(|| {
        error!("Chatbot configuration missing");
        anyhow::anyhow!("Chatbot configuration is missing from the Azure configuration")
    })?;

    trace!(
        "🧶🧶🧶🧶🧶🧶🧶🧶Base request: {:?}",
        serde_json::to_string(&chat_request)
    );

    let request = AzureCompletionRequest {
        base: chat_request,
        stream: true,
    };

    let headers = build_llm_headers(&chatbot_config.api_key)?;
    let api_endpoint = chatbot_config.api_endpoint.to_owned();
    debug!(
        "Sending streaming request to LLM endpoint: {}",
        api_endpoint
    );

    let response = REQWEST_CLIENT
        .post(api_endpoint)
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
    num_messages = chat_request.input.len(),
    temperature,
    max_tokens
))]
pub async fn make_blocking_llm_request(
    chat_request: LLMRequest,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<LLMResponse> {
    debug!(
        "Preparing blocking LLM request with {} messages",
        chat_request.input.len()
    );
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        error!("Azure configuration missing");
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let chatbot_config = azure_config.chatbot_config.as_ref().ok_or_else(|| {
        error!("Chatbot configuration missing");
        anyhow::anyhow!("Chatbot configuration is missing from the Azure configuration")
    })?;

    let api_endpoint = chatbot_config.api_endpoint.to_owned();

    trace!("Making LLM request to endpoint: {}", api_endpoint);
    make_llm_request(chat_request, &api_endpoint, &chatbot_config.api_key).await
}

/// Collects all the completion choices to a string. Assumes the completion has only
/// text message content, no tool calls or responses.
pub fn parse_text_completion(completion: LLMResponse) -> ChatbotResult<String> {
    let res =
    completion
        .output
        .into_iter()
        .map(|x| match x.message_type {
            OutputItem::Message { role: _role, content } => Ok(content.get_content_text()),
            _ =>  Err(ChatbotError::new( ChatbotErrorType::InvalidMessageShape, "It was assumed this LLM response contains only text, but a tool call or tool response was detected.", None)),
        })
        .collect::<ChatbotResult<Vec<String>>>()?
        .join("");
    if res.is_empty() {
        return Err(ChatbotError::new(
            ChatbotErrorType::InvalidMessageShape,
            "No content returned from LLM",
            None,
        ));
    };
    Ok(res)
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
