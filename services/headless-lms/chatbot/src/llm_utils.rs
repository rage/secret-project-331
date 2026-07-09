use secrecy::{ExposeSecret, SecretString};

use crate::{
    azure_chatbot::{
        InputItem, LLMRequest, LLMRequestParams, MistralParams, NonThinkingParams, OutputItem,
        Reasoning, ReasoningOutput, ResponseError, ResponseOutput, SummaryType, ThinkingParams,
    },
    chatbot_error::ChatbotResult,
    prelude::*,
};
use core::default::Default;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{
    chatbot_configurations::{ChatbotConfiguration, ReasoningEffortLevel},
    chatbot_configurations_models::ModelType,
    chatbot_conversation_message_messages::{ChatbotConversationMessageMessage, MessageRole},
    chatbot_conversation_message_reasoning::ChatbotConversationMessageReasoning,
    chatbot_conversation_message_tool_calls::{ChatbotConversationMessageToolCall, ToolKind},
    chatbot_conversation_message_tool_outputs::ChatbotConversationMessageToolOutput,
    chatbot_conversation_messages::{ChatbotConversationMessage, Message},
};
use reqwest::Response;
use reqwest::header::HeaderMap;
use serde::{Deserialize, Serialize};
use tracing::{debug, error, instrument, trace, warn};

/// Common message structure used for LLM API requests
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct APIOutputMessage {
    #[serde(flatten)]
    pub message_type: OutputItem,
}

/// Common message structure used for LLM API requests
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct APIInputMessage {
    #[serde(flatten)]
    pub message_type: InputItem,
}

impl From<APIOutputMessage> for APIInputMessage {
    fn from(message: APIOutputMessage) -> Self {
        match message.message_type {
            OutputItem::Message { role, content, .. } => APIInputMessage {
                message_type: InputItem::Message { role, content },
            },
            OutputItem::FunctionCall {
                call_id,
                tool_name,
                arguments,
                ..
            } => APIInputMessage {
                message_type: InputItem::FunctionCall {
                    call_id,
                    tool_name,
                    arguments,
                },
            },
            OutputItem::FunctionCallOutput {
                call_id, output, ..
            } => APIInputMessage {
                message_type: InputItem::FunctionCallOutput { call_id, output },
            },
            OutputItem::AzureAiSearchCall {
                call_id, arguments, ..
            } => APIInputMessage {
                message_type: InputItem::FunctionCall {
                    call_id,
                    tool_name: "azure_ai_search".to_string(),
                    arguments,
                },
            },
            OutputItem::AzureAiSearchCallOutput {
                call_id, output, ..
            } => APIInputMessage {
                message_type: InputItem::FunctionCallOutput { call_id, output },
            },
            OutputItem::Reasoning { id, summary, .. } => APIInputMessage {
                message_type: InputItem::Reasoning { id, summary },
            },
        }
    }
}

impl TryFrom<ChatbotConversationMessage> for APIInputMessage {
    type Error = ChatbotError;

    fn try_from(message: ChatbotConversationMessage) -> Result<Self, Self::Error> {
        let res = match message.message {
            Message::Text(text_message) => match text_message.message_role {
                MessageRole::User | MessageRole::Assistant => APIInputMessage {
                    message_type: InputItem::Message {
                        role: text_message.message_role,
                        content: MessageContent::Text(text_message.text),
                    },
                },
                _ => {
                    return Err(chatbot_err!(
                        InvalidMessageShape,
                        "A 'role: system' or 'role: developer' type text-variant ChatbotConversationMessage shouldn't be saved into the database."
                    ));
                }
            },
            Message::ToolCall(tool_call) => match tool_call.tool_kind {
                ToolKind::Function => APIInputMessage {
                    message_type: InputItem::FunctionCall {
                        call_id: tool_call.tool_call_id,
                        tool_name: tool_call.tool_name,
                        arguments: serde_json::to_string(&tool_call.tool_arguments)?,
                    },
                },
                ToolKind::AzureAiSearch => APIInputMessage {
                    message_type: InputItem::FunctionCall {
                        call_id: tool_call.tool_call_id,
                        tool_name: "azure_ai_search".to_string(),
                        arguments: serde_json::to_string(&tool_call.tool_arguments)?,
                    },
                },
            },
            Message::ToolOutput(tool_output) => match tool_output.tool_kind {
                ToolKind::Function => APIInputMessage {
                    message_type: InputItem::FunctionCallOutput {
                        call_id: tool_output.tool_call_id,
                        output: tool_output.output,
                    },
                },
                ToolKind::AzureAiSearch => APIInputMessage {
                    message_type: InputItem::FunctionCallOutput {
                        call_id: tool_output.tool_call_id,
                        output: tool_output.output,
                    },
                },
            },
            Message::Reasoning(ChatbotConversationMessageReasoning {
                reasoning_id,
                summary,
                ..
            }) => {
                let summ = if let Some(text) = summary {
                    vec![ReasoningOutput {
                        output_type: "summary_text".to_string(),
                        text,
                    }]
                } else {
                    vec![]
                };
                APIInputMessage {
                    message_type: InputItem::Reasoning {
                        id: reasoning_id,
                        summary: summ,
                    },
                }
            }
        };
        Result::Ok(res)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum MessageContent {
    Text(String),
    OutputText(Vec<MessageContentItem>),
    Refusal(Vec<RefusalContentItem>),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MessageContentItem {
    pub text: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RefusalContentItem {
    pub refusal: String,
}

impl MessageContent {
    pub fn get_content_text(self) -> String {
        match self {
            MessageContent::Text(msg_text) => msg_text,
            MessageContent::OutputText(output) => output
                .iter()
                .map(|x| x.text.to_owned())
                .collect::<Vec<String>>()
                .join(""),
            MessageContent::Refusal(refusal) => refusal
                .iter()
                .map(|x| x.refusal.to_owned())
                .collect::<Vec<String>>()
                .join(""),
        }
    }
}

impl APIOutputMessage {
    /// Create a ChatbotConversationMessage from an APIMessage to save it into the DB.
    /// Notice that the insert operation ignores some of the fields, like timestamps.
    /// `to_chatbot_conversation_message` doesn't set the correct order_number field
    /// value.
    pub fn to_chatbot_conversation_message(
        &self,
        conversation_id: Uuid,
    ) -> ChatbotResult<ChatbotConversationMessage> {
        let res = match self.message_type.clone() {
            OutputItem::Message {
                role,
                content,
                response_id,
                ..
            } => {
                let text = content.get_content_text();
                let used_tokens = estimate_tokens(&text);

                ChatbotConversationMessage {
                    conversation_id,
                    message: Message::Text(ChatbotConversationMessageMessage {
                        text,
                        message_role: role,
                        message_is_complete: true,
                        used_tokens,
                        response_id: if role == MessageRole::User {
                            None
                        } else {
                            Some(response_id)
                        },
                        ..Default::default()
                    }),
                    ..Default::default()
                }
            }
            OutputItem::FunctionCall {
                call_id,
                tool_name,
                arguments,
                response_id,
            } => ChatbotConversationMessage {
                conversation_id,
                message: Message::ToolCall(ChatbotConversationMessageToolCall {
                    tool_name,
                    tool_arguments: serde_json::to_value(arguments)?,
                    tool_call_id: call_id,
                    tool_kind: ToolKind::Function,
                    response_id,
                    ..Default::default()
                }),
                ..Default::default()
            },
            OutputItem::FunctionCallOutput {
                call_id,
                output,
                response_id,
            } => ChatbotConversationMessage {
                conversation_id,
                message: Message::ToolOutput(ChatbotConversationMessageToolOutput {
                    output,
                    tool_call_id: call_id,
                    tool_kind: ToolKind::Function,
                    response_id,
                    ..Default::default()
                }),
                ..Default::default()
            },
            OutputItem::AzureAiSearchCall {
                call_id,
                arguments,
                response_id,
            } => ChatbotConversationMessage {
                conversation_id,
                message: Message::ToolCall(ChatbotConversationMessageToolCall {
                    tool_arguments: serde_json::to_value(arguments)?,
                    tool_call_id: call_id,
                    tool_kind: ToolKind::AzureAiSearch,
                    tool_name: "azure_ai_search".to_string(),
                    response_id,
                    ..Default::default()
                }),
                ..Default::default()
            },
            OutputItem::AzureAiSearchCallOutput {
                call_id,
                output,
                response_id,
            } => ChatbotConversationMessage {
                conversation_id,
                message: Message::ToolOutput(ChatbotConversationMessageToolOutput {
                    tool_call_id: call_id,
                    tool_kind: ToolKind::AzureAiSearch,
                    output,
                    response_id,
                    ..Default::default()
                }),
                ..Default::default()
            },
            OutputItem::Reasoning {
                summary,
                response_id,
                id,
            } => {
                let text = if !summary.is_empty() {
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
                    message: Message::Reasoning(ChatbotConversationMessageReasoning {
                        summary: text,
                        response_id,
                        reasoning_id: id,
                        ..Default::default()
                    }),
                    ..Default::default()
                }
            }
        };
        Result::Ok(res)
    }
}

impl TryFrom<ChatbotConversationMessage> for APIOutputMessage {
    type Error = ChatbotError;

    fn try_from(message: ChatbotConversationMessage) -> ChatbotResult<Self> {
        let res = match message.message {
            Message::Text(text_message) => match text_message.message_role {
                MessageRole::User | MessageRole::Assistant => APIOutputMessage {
                    message_type: OutputItem::Message {
                        role: text_message.message_role,
                        content: MessageContent::Text(text_message.text),
                        response_id: if text_message.message_role == MessageRole::User {
                            "".to_string()
                        } else {
                            text_message.response_id.ok_or(chatbot_err!(
                                    Other,
                                    "Can't convert ChatbotConversationMessage into APIOutputMessage: a role='assistant' message should have a response_id, but it's missing"
                                ))?
                        },
                        phase: None,
                    },
                },
                _ => {
                    return Err(chatbot_err!(
                        InvalidMessageShape,
                        "A 'role: system' or 'role: developer' type text-variant ChatbotConversationMessage shouldn't be saved into the database."
                    ));
                }
            },
            Message::ToolCall(tool_call) => match tool_call.tool_kind {
                ToolKind::Function => APIOutputMessage {
                    message_type: OutputItem::FunctionCall {
                        call_id: tool_call.tool_call_id,
                        tool_name: tool_call.tool_name,
                        arguments: serde_json::to_string(&tool_call.tool_arguments)?,
                        response_id: tool_call.response_id,
                    },
                },
                ToolKind::AzureAiSearch => APIOutputMessage {
                    message_type: OutputItem::AzureAiSearchCall {
                        call_id: tool_call.tool_call_id,
                        arguments: serde_json::to_string(&tool_call.tool_arguments)?,
                        response_id: tool_call.response_id,
                    },
                },
            },
            Message::ToolOutput(tool_output) => match tool_output.tool_kind {
                ToolKind::Function => APIOutputMessage {
                    message_type: OutputItem::FunctionCallOutput {
                        call_id: tool_output.tool_call_id,
                        output: tool_output.output,
                        response_id: tool_output.response_id,
                    },
                },
                ToolKind::AzureAiSearch => APIOutputMessage {
                    message_type: OutputItem::AzureAiSearchCallOutput {
                        call_id: tool_output.tool_call_id,
                        output: tool_output.output,
                        response_id: tool_output.response_id,
                    },
                },
            },
            Message::Reasoning(reasoning) => {
                if let Some(text) = reasoning.summary {
                    APIOutputMessage {
                        message_type: OutputItem::Reasoning {
                            summary: vec![ReasoningOutput {
                                output_type: "summary_text".to_string(),
                                text,
                            }],
                            response_id: reasoning.response_id,
                            id: reasoning.reasoning_id,
                        },
                    }
                } else {
                    APIOutputMessage {
                        message_type: OutputItem::Reasoning {
                            summary: vec![],
                            response_id: reasoning.response_id,
                            id: reasoning.reasoning_id,
                        },
                    }
                }
            }
        };
        Result::Ok(res)
    }
}

impl From<ChatbotConversationMessageToolOutput> for APIOutputMessage {
    fn from(value: ChatbotConversationMessageToolOutput) -> Self {
        match value.tool_kind {
            ToolKind::Function => APIOutputMessage {
                message_type: OutputItem::FunctionCallOutput {
                    call_id: value.tool_call_id,
                    output: value.output,
                    response_id: value.response_id,
                },
            },
            ToolKind::AzureAiSearch => APIOutputMessage {
                message_type: OutputItem::AzureAiSearchCallOutput {
                    response_id: value.response_id,
                    call_id: value.tool_call_id,
                    output: value.output,
                },
            },
        }
    }
}

impl TryFrom<APIOutputMessage> for ChatbotConversationMessageToolOutput {
    type Error = ChatbotError;
    fn try_from(value: APIOutputMessage) -> ChatbotResult<Self> {
        match value.message_type {
            OutputItem::FunctionCallOutput {
                call_id,
                output,
                response_id,
            } => Ok(ChatbotConversationMessageToolOutput {
                output,
                tool_call_id: call_id,
                response_id,
                ..Default::default()
            }),
            OutputItem::AzureAiSearchCallOutput {
                response_id,
                call_id,
                output,
            } => Ok(ChatbotConversationMessageToolOutput {
                output,
                tool_call_id: call_id,
                response_id,
                ..Default::default()
            }),
            _ => Err(chatbot_err!(
                Other,
                "Can't convert APIMessage to ChatbotConversationMessageToolOutput: APIMessage type is not OutputItem::FunctionCallOutput"
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
    pub tool_type: ToolKind,
}

impl From<ChatbotConversationMessageToolCall> for APIToolCall {
    fn from(value: ChatbotConversationMessageToolCall) -> Self {
        APIToolCall {
            function: APITool {
                arguments: value.tool_arguments.to_string(),
                name: value.tool_name,
            },
            id: value.tool_call_id,
            tool_type: value.tool_kind,
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
            tool_kind: value.tool_type,
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
    pub output: Vec<APIOutputMessage>,
}

/// Builds common headers for LLM requests
#[instrument(skip(api_key), fields(api_key_length = api_key.expose_secret().len()))]
pub fn build_llm_headers(api_key: &SecretString) -> ChatbotResult<HeaderMap> {
    trace!("Building LLM request headers");
    let mut headers = HeaderMap::new();
    headers.insert(
        "api-key",
        // Exposed only here, at the point the header value is constructed.
        api_key.expose_secret().parse().map_err(|_e| {
            error!("Failed to parse API key");
            chatbot_err!(AzureRequestBuildError, "Invalid API key")
        })?,
    );
    headers.insert(
        "content-type",
        "application/json".parse().map_err(|_e| {
            error!("Failed to parse content-type header");
            chatbot_err!(AzureRequestBuildError, "Internal error")
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
    api_key: &SecretString,
) -> ChatbotResult<LLMResponse> {
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
async fn process_llm_response(response: Response) -> ChatbotResult<LLMResponse> {
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        error!(
            status = %status,
            error = %error_text,
            "Error calling LLM API"
        );
        return Err(chatbot_err!(
            FailedAzureResponse,
            format!(
                "Error calling LLM API: Status: {}. Error: {}",
                status, error_text
            )
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
) -> ChatbotResult<Response> {
    debug!(
        "Preparing streaming LLM request with {} messages",
        chat_request.input.len()
    );
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        error!("Azure configuration missing");
        chatbot_err!(
            AzureRequestBuildError,
            "Azure configuration is missing from the application configuration"
        )
    })?;

    let chatbot_config = azure_config.chatbot_config.as_ref().ok_or_else(|| {
        error!("Chatbot configuration missing");
        chatbot_err!(
            AzureRequestBuildError,
            "Chatbot configuration is missing from the Azure configuration"
        )
    })?;

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
        let azure_error: Option<ResponseError> =
            serde_json::from_str::<ResponseOutput>(&error_text)?.error;
        let mut error = chatbot_err!(
            FailedAzureResponse,
            format!(
                "Error calling LLM API: Status: {}. Error: {}",
                status, error_text
            )
        );
        if let Some(e) = azure_error {
            error.add_azure_source(e); // todo does it work
        }
        error!(
            status = %status,
            error = %error_text,
            "Error calling streaming LLM API"
        );
        return Err(error);
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
) -> ChatbotResult<LLMResponse> {
    debug!(
        "Preparing blocking LLM request with {} messages",
        chat_request.input.len()
    );
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        error!("Azure configuration missing");
        chatbot_err!(
            AzureRequestBuildError,
            "Azure configuration is missing from the application configuration"
        )
    })?;

    let chatbot_config = azure_config.chatbot_config.as_ref().ok_or_else(|| {
        error!("Chatbot configuration missing");
        chatbot_err!(
            AzureRequestBuildError,
            "Chatbot configuration is missing from the Azure configuration"
        )
    })?;

    let api_endpoint = chatbot_config.api_endpoint.to_owned();

    trace!("Making LLM request to endpoint: {}", api_endpoint);
    make_llm_request(chat_request, &api_endpoint, &chatbot_config.api_key).await
}

/// Collects all the completion choices to a string. Assumes the completion has only
/// text message content, no tool calls or tool output.
pub fn parse_text_completion(completion: LLMResponse) -> ChatbotResult<String> {
    let res =
    completion
        .output
        .into_iter()
        .map(|x| match x.message_type {
            OutputItem::Message {  content , ..} => Ok(content.get_content_text()),
            OutputItem::Reasoning { .. } => Ok("".to_string()),
            _ =>  Err(chatbot_err!( InvalidMessageShape, "It was assumed this LLM response contains only text, but a tool call or tool response was detected.")),
        })
        .collect::<ChatbotResult<Vec<String>>>()?
        .join("");
    if res.is_empty() {
        return Err(chatbot_err!(
            InvalidMessageShape,
            "No content returned from LLM"
        ));
    };
    Ok(res)
}

pub fn get_params_for_model(
    model_name: &str,
    model_type: &ModelType,
    configuration: Option<&ChatbotConfiguration>,
) -> LLMRequestParams {
    if model_name == "gpt-5.2-chat" {
        return LLMRequestParams::GPTThinking(ThinkingParams {
            reasoning: Some(Reasoning {
                effort: ReasoningEffortLevel::Medium,
                summary: Some(SummaryType::Detailed),
            }),
        });
    }
    match model_type {
        ModelType::GPTNonThinking => {
            if let Some(conf) = configuration {
                LLMRequestParams::GPTNonThinking(NonThinkingParams {
                    temperature: Some(conf.temperature),
                    top_p: Some(conf.top_p),
                    frequency_penalty: Some(conf.frequency_penalty),
                    presence_penalty: Some(conf.presence_penalty),
                })
            } else {
                LLMRequestParams::GPTNonThinking(NonThinkingParams {
                    temperature: None,
                    top_p: None,
                    frequency_penalty: None,
                    presence_penalty: None,
                })
            }
        }
        ModelType::GPTHardThinking => {
            // make sure the effort value is valid for the model type
            let effort = if let Some(conf) = configuration {
                if conf.reasoning_effort == ReasoningEffortLevel::Minimal {
                    ReasoningEffortLevel::Low
                } else {
                    conf.reasoning_effort
                }
            } else {
                ReasoningEffortLevel::None
            };
            LLMRequestParams::GPTThinking(ThinkingParams {
                reasoning: Some(Reasoning {
                    effort,
                    summary: Some(SummaryType::Detailed),
                }),
            })
        }
        ModelType::GPTThinking => {
            // make sure the effort value is valid for the model type
            let effort = if let Some(conf) = configuration {
                if conf.reasoning_effort == ReasoningEffortLevel::None {
                    ReasoningEffortLevel::Minimal
                } else if conf.reasoning_effort == ReasoningEffortLevel::Xhigh {
                    ReasoningEffortLevel::High
                } else {
                    conf.reasoning_effort
                }
            } else {
                ReasoningEffortLevel::Minimal
            };
            LLMRequestParams::GPTThinking(ThinkingParams {
                reasoning: Some(Reasoning {
                    effort,
                    summary: Some(SummaryType::Detailed),
                }),
            })
        }
        ModelType::Mistral => LLMRequestParams::Mistral(MistralParams { test: true }),
    }
}

/// Checks if the model_type is a thinking model type. This function defines
/// which model types are thinking (reasoning)
pub fn model_is_thinking(model_type: ModelType) -> bool {
    matches!(
        model_type,
        ModelType::GPTHardThinking | ModelType::GPTThinking
    )
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
