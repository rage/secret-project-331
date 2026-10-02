use secrecy::{ExposeSecret, SecretString};

use crate::{
    azure_chatbot::azure::protocol::{
        InputItem, LLMRequest, LLMRequestParams, LLMRequestResponseFormatParam, MistralParams,
        NonThinkingParams, OutputItem, Reasoning, ReasoningContext, ReasoningOutput,
        RequestTextOptions, Response as AzureResponse, ResponseError, ResponseReasoning,
        SummaryType, ThinkingParams, Usage,
    },
    azure_chatbot::azure::tools::AZURE_AI_SEARCH_TOOL_NAME,
    chatbot_error::ChatbotResult,
    chatbot_tools::tool_is_answered_by_client,
    prelude::*,
};
use core::default::Default;
use headless_lms_base::config::{
    ApplicationConfiguration, AzureChatbotConfiguration, AzureConfiguration,
    AzureSearchConfiguration,
};
use headless_lms_models::{
    chatbot_configurations::{ChatbotConfiguration, ReasoningEffortLevel},
    chatbot_configurations_models::ModelType,
    chatbot_conversation_message_messages::{ChatbotConversationMessageMessage, MessageRole},
    chatbot_conversation_message_reasoning::ChatbotConversationMessageReasoning,
    chatbot_conversation_message_tool_calls::{ChatbotConversationMessageToolCall, ToolKind},
    chatbot_conversation_message_tool_outputs::ChatbotConversationMessageToolOutput,
    chatbot_conversation_messages::{ChatbotConversationMessage, Message},
};
use headless_lms_utils::json_schema_types::{Schema, string_array_property};
use indexmap::IndexMap;
use reqwest::Response;
use reqwest::header::HeaderMap;
use serde::{Deserialize, Serialize};
use tracing::{debug, error, instrument, trace, warn};

/// The Azure section of the application configuration, or an error naming what's missing.
pub fn azure_configuration(
    app_config: &ApplicationConfiguration,
) -> ChatbotResult<&AzureConfiguration> {
    app_config.azure_configuration.as_ref().ok_or_else(|| {
        chatbot_err!(
            AzureRequestBuildError,
            "Azure configuration is missing from the application configuration"
        )
    })
}

/// The Azure AI Search section of the application configuration, or an error naming what's missing.
pub fn azure_search_configuration(
    app_config: &ApplicationConfiguration,
) -> ChatbotResult<&AzureSearchConfiguration> {
    azure_configuration(app_config)?
        .search_config
        .as_ref()
        .ok_or_else(|| {
            chatbot_err!(
                AzureRequestBuildError,
                "Search configuration is missing from the Azure configuration"
            )
        })
}

/// The Azure chatbot (Foundry) section of the application configuration, or an error naming
/// what's missing.
pub fn azure_chatbot_configuration(
    app_config: &ApplicationConfiguration,
) -> ChatbotResult<&AzureChatbotConfiguration> {
    azure_configuration(app_config)?
        .chatbot_config
        .as_ref()
        .ok_or_else(|| {
            chatbot_err!(
                AzureRequestBuildError,
                "Chatbot configuration is missing from the Azure configuration"
            )
        })
}

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

/// The single summary text that [`ChatbotConversationMessageReasoning::summary`] can hold, or
/// `None` for an item with no summary. Azure streams a summary in parts; a row keeps one.
fn summary_text(parts: &[ReasoningOutput]) -> Option<String> {
    if parts.is_empty() {
        return None;
    }
    Some(
        parts
            .iter()
            .map(|part| part.text.as_str())
            .collect::<Vec<_>>()
            .join(" "),
    )
}

/// A stored summary text as the summary parts that go back to Azure.
fn stored_summary(text: Option<String>) -> Vec<ReasoningOutput> {
    text.into_iter()
        .map(|text| ReasoningOutput {
            output_type: "summary_text".to_string(),
            text,
        })
        .collect()
}

/// Summary parts as the database round trip spells them.
///
/// A reasoning item goes back to Azure twice, once from memory during the turn that produced it
/// and again from storage on every later turn, and Azure caches on an exact prefix. Both spellings
/// have to agree or the second one misses the cache for everything from that item onwards, so the
/// round trip is spelled here rather than at each site that performs one of its halves.
fn summary_as_stored(parts: &[ReasoningOutput]) -> Vec<ReasoningOutput> {
    stored_summary(summary_text(parts))
}

impl From<APIOutputMessage> for APIInputMessage {
    fn from(message: APIOutputMessage) -> Self {
        match message.message_type {
            // Flattened to text: a stored message can only come back as text, and the parts Azure
            // streams lose their `type` on the way in, which the API rejects on the way back.
            OutputItem::Message { role, content, .. } => APIInputMessage {
                message_type: InputItem::Message {
                    role,
                    content: MessageContent::Text(content.get_content_text()),
                },
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
                    tool_name: AZURE_AI_SEARCH_TOOL_NAME.to_string(),
                    arguments,
                },
            },
            OutputItem::AzureAiSearchCallOutput {
                call_id, output, ..
            } => APIInputMessage {
                message_type: InputItem::FunctionCallOutput { call_id, output },
            },
            OutputItem::Reasoning {
                id,
                summary,
                encrypted_content,
                ..
            } => APIInputMessage {
                message_type: InputItem::Reasoning {
                    id,
                    summary: summary_as_stored(&summary),
                    encrypted_content,
                },
            },
        }
    }
}

impl TryFrom<ChatbotConversationMessage> for APIInputMessage {
    type Error = ChatbotError;

    fn try_from(message: ChatbotConversationMessage) -> Result<Self, Self::Error> {
        let res = match message.message {
            Message::Text(text_message) => match text_message.message_role {
                MessageRole::User | MessageRole::Assistant | MessageRole::Developer => {
                    APIInputMessage {
                        message_type: InputItem::Message {
                            role: text_message.message_role,
                            content: MessageContent::Text(text_message.text),
                        },
                    }
                }
                MessageRole::System => {
                    return Err(chatbot_err!(
                        InvalidMessageShape,
                        "A 'role: system' type text-variant ChatbotConversationMessage shouldn't be saved into the database."
                    ));
                }
            },
            Message::ToolCall(tool_call) => APIInputMessage {
                message_type: InputItem::FunctionCall {
                    arguments: tool_call.arguments_json(),
                    call_id: tool_call.tool_call_id,
                    tool_name: if tool_call.tool_kind.is_provider_tool() {
                        AZURE_AI_SEARCH_TOOL_NAME.to_string()
                    } else {
                        tool_call.tool_name
                    },
                },
            },
            Message::ToolOutput(tool_output) => APIInputMessage {
                message_type: InputItem::FunctionCallOutput {
                    call_id: tool_output.tool_call_id,
                    output: tool_output.output,
                },
            },
            Message::Reasoning(ChatbotConversationMessageReasoning {
                reasoning_id,
                summary,
                encrypted_content,
                ..
            }) => APIInputMessage {
                message_type: InputItem::Reasoning {
                    id: reasoning_id,
                    summary: stored_summary(summary),
                    encrypted_content,
                },
            },
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
            } => {
                // The only place a call's kind is decided, so the stored row and the engine agree
                // on which calls suspend the turn.
                let tool_kind = if tool_is_answered_by_client(&tool_name) {
                    ToolKind::ClientTool
                } else {
                    ToolKind::Function
                };
                ChatbotConversationMessage {
                    conversation_id,
                    message: Message::ToolCall(ChatbotConversationMessageToolCall::new(
                        call_id,
                        tool_name,
                        arguments,
                        tool_kind,
                        response_id,
                    )),
                    ..Default::default()
                }
            }
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
                message: Message::ToolCall(ChatbotConversationMessageToolCall::new(
                    call_id,
                    AZURE_AI_SEARCH_TOOL_NAME.to_string(),
                    arguments,
                    ToolKind::AzureAiSearch,
                    response_id,
                )),
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
                encrypted_content,
            } => ChatbotConversationMessage {
                conversation_id,
                message: Message::Reasoning(ChatbotConversationMessageReasoning {
                    summary: summary_text(&summary),
                    response_id,
                    reasoning_id: id,
                    encrypted_content,
                    ..Default::default()
                }),
                ..Default::default()
            },
        };
        Result::Ok(res)
    }
}

impl TryFrom<ChatbotConversationMessage> for APIOutputMessage {
    type Error = ChatbotError;

    fn try_from(message: ChatbotConversationMessage) -> ChatbotResult<Self> {
        let res = match message.message {
            Message::Text(text_message) => match text_message.message_role {
                MessageRole::User | MessageRole::Assistant | MessageRole::Developer => {
                    APIOutputMessage {
                        message_type: OutputItem::Message {
                            role: text_message.message_role,
                            content: MessageContent::Text(text_message.text),
                            response_id: if text_message.message_role == MessageRole::User {
                                "".to_string()
                            } else {
                                text_message.response_id.ok_or(chatbot_err!(
                                    Other,
                                    "Can't convert ChatbotConversationMessage into APIOutputMessage: only a role='user' message may lack a response_id"
                                ))?
                            },
                        },
                    }
                }
                MessageRole::System => {
                    return Err(chatbot_err!(
                        InvalidMessageShape,
                        "A 'role: system' type text-variant ChatbotConversationMessage shouldn't be saved into the database."
                    ));
                }
            },
            Message::ToolCall(tool_call) => {
                let arguments = tool_call.arguments_json();
                if tool_call.tool_kind.is_provider_tool() {
                    APIOutputMessage {
                        message_type: OutputItem::AzureAiSearchCall {
                            call_id: tool_call.tool_call_id,
                            arguments,
                            response_id: tool_call.response_id,
                        },
                    }
                } else {
                    APIOutputMessage {
                        message_type: OutputItem::FunctionCall {
                            call_id: tool_call.tool_call_id,
                            tool_name: tool_call.tool_name,
                            arguments,
                            response_id: tool_call.response_id,
                        },
                    }
                }
            }
            Message::ToolOutput(tool_output) => APIOutputMessage::from(tool_output),
            Message::Reasoning(reasoning) => APIOutputMessage {
                message_type: OutputItem::Reasoning {
                    summary: stored_summary(reasoning.summary),
                    response_id: reasoning.response_id,
                    id: reasoning.reasoning_id,
                    encrypted_content: reasoning.encrypted_content,
                },
            },
        };
        Result::Ok(res)
    }
}

impl From<ChatbotConversationMessageToolOutput> for APIOutputMessage {
    fn from(value: ChatbotConversationMessageToolOutput) -> Self {
        if value.tool_kind.is_provider_tool() {
            APIOutputMessage {
                message_type: OutputItem::AzureAiSearchCallOutput {
                    response_id: value.response_id,
                    call_id: value.tool_call_id,
                    output: value.output,
                },
            }
        } else {
            APIOutputMessage {
                message_type: OutputItem::FunctionCallOutput {
                    call_id: value.tool_call_id,
                    output: value.output,
                    response_id: value.response_id,
                },
            }
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

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct APITool {
    pub arguments: String,
    pub name: String,
}

/// The `store: false` every request sends, as a type rather than a `bool` so that no construction
/// site can send the other value.
///
/// Azure hands back the `encrypted_content` that makes a reasoning item replayable only when it is
/// not keeping the response itself, and a kept response is retained for 30 days for nothing:
/// nothing here ever reads one back by id.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct StoreDisabled;

impl Serialize for StoreDisabled {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_bool(false)
    }
}

impl<'de> Deserialize<'de> for StoreDisabled {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        if bool::deserialize(deserializer)? {
            return Err(serde::de::Error::custom(
                "a request that asks Azure to store the response is not one this service sends",
            ));
        }
        Ok(StoreDisabled)
    }
}

/// The `include` a reasoning request asks for, or `None` for a model that produces no reasoning.
///
/// Redundant on current deployments, where [`StoreDisabled`] alone is enough to get
/// `encrypted_content` back. It goes out anyway because Azure's general Responses documentation
/// still describes the field as required while its reasoning-model guide says it is not, and a
/// deployment following the older contract would return reasoning items carrying no payload — which
/// replays as nothing and fails no test.
fn reasoning_include(params: &LLMRequestParams) -> Option<Vec<String>> {
    match params {
        LLMRequestParams::GPTThinking(_) => Some(vec!["reasoning.encrypted_content".to_string()]),
        LLMRequestParams::GPTNonThinking(_) | LLMRequestParams::Mistral(_) => None,
    }
}

/// Simple completion-focused LLM request for Azure OpenAI
/// Note: In Azure OpenAI, the model is specified in the URL, not in the request body
#[derive(Serialize, Deserialize, Debug)]
pub struct AzureCompletionRequest {
    #[serde(flatten)]
    pub base: LLMRequest,
    pub stream: bool,
    pub store: StoreDisabled,
    /// See [`reasoning_include`].
    #[serde(skip_serializing_if = "Option::is_none")]
    pub include: Option<Vec<String>>,
}

/// The wire shape of [`AzureCompletionRequest`], borrowing its conversation instead of owning it.
///
/// A turn's request grows every round, so building the outbound body from an owned
/// `AzureCompletionRequest` would deep-copy the whole accumulated conversation per round just to
/// serialize it. Serialize-only: nothing needs to read one of these back, so unlike its owned
/// sibling it derives no `Deserialize`.
#[derive(Serialize)]
struct AzureCompletionRequestRef<'a> {
    #[serde(flatten)]
    base: &'a LLMRequest,
    stream: bool,
    store: StoreDisabled,
    #[serde(skip_serializing_if = "Option::is_none")]
    include: Option<Vec<String>>,
}

/// Response from LLM for simple completions
#[derive(Deserialize, Debug)]
pub struct LLMResponse {
    pub id: String,
    pub output: Vec<APIOutputMessage>,
    pub usage: Option<Usage>,
    pub reasoning: Option<ResponseReasoning>,
}

/// The structured output format for a feature whose whole answer is a list of strings.
///
/// `name` is what Azure, and the test-mode mock Azure API, identify the format by, so it has to
/// name the feature rather than the shape. `property` is the single key the list arrives under.
pub fn string_list_response_format(name: &str, property: &str) -> LLMRequestResponseFormatParam {
    LLMRequestResponseFormatParam::JsonSchema {
        name: name.to_string(),
        schema: Schema::strict_object(
            IndexMap::from([(property.to_string(), string_array_property(None))]),
            None,
        ),
        strict: true,
    }
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

/// A request to the Azure AI Search management API, carrying the headers every one of its
/// endpoints wants. The search API key is exposed only here.
pub fn azure_search_request(
    method: reqwest::Method,
    url: url::Url,
    search_config: &AzureSearchConfiguration,
) -> reqwest::RequestBuilder {
    REQWEST_CLIENT
        .request(method, url)
        .header("Content-Type", "application/json")
        .header("api-key", search_config.search_api_key.expose_secret())
}

/// Logs the shape and order of a request's `input` items when Azure rejects it.
///
/// Azure's item-shape errors (e.g. an out-of-place reasoning item whose `encrypted_content` "could
/// not be verified") name an item by id but not by position, so diagnosing one from the error alone
/// means guessing at what the request actually looked like. This spells out every item's type, id,
/// and `response_id` in order, which is what identifies a reasoning item sitting next to the wrong
/// call.
pub(crate) fn summarize_input_for_log(input: &[APIInputMessage]) -> String {
    input
        .iter()
        .map(|message| match &message.message_type {
            InputItem::Message { role, .. } => format!("Message({role:?})"),
            InputItem::FunctionCall {
                call_id, tool_name, ..
            } => format!("FunctionCall({tool_name}, {call_id})"),
            InputItem::FunctionCallOutput { call_id, .. } => {
                format!("FunctionCallOutput({call_id})")
            }
            InputItem::Reasoning {
                id,
                encrypted_content,
                ..
            } => format!(
                "Reasoning({id}, encrypted_content={})",
                if encrypted_content.is_some() {
                    "present"
                } else {
                    "absent"
                }
            ),
        })
        .collect::<Vec<_>>()
        .join(" -> ")
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
        include: reasoning_include(&chat_request.params),
        base: chat_request,
        stream: false,
        store: StoreDisabled,
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
    process_llm_response(response, &request.base.input).await
}

/// Builds the error for a failed LLM HTTP response, parsing `error_text` as an Azure error body
/// when possible and attaching it as the error's Azure source.
fn llm_http_error(status: reqwest::StatusCode, error_text: String) -> ChatbotError {
    let azure_response = serde_json::from_str::<AzureResponse>(&error_text);
    match azure_response {
        Ok(response) => {
            let azure_error: Option<ResponseError> = response.error;
            // Format the error message to be minimal and add the Azure source.
            let mut error = chatbot_err!(
                FailedAzureResponse,
                format!(
                    "Error calling LLM API: Status: {}. Error: {}",
                    status,
                    &azure_error
                        .as_ref()
                        .and_then(|e| e.code.to_owned())
                        .or_else(|| azure_error.as_ref().and_then(|e| e.error_type.to_owned()))
                        .unwrap_or(error_text)
                )
            );
            if let Some(e) = azure_error {
                error.add_azure_source(e);
            };
            error
        }
        // If Azure returned data in some other shape, just show the unparsed text.
        Err(_) => chatbot_err!(
            FailedAzureResponse,
            format!(
                "Error calling LLM API: Status: {}. Error: {}",
                status, &error_text
            )
        ),
    }
}

/// Process a non-streaming LLM response
#[instrument(skip(response), fields(status = %response.status()))]
async fn process_llm_response(
    response: Response,
    input: &[APIInputMessage],
) -> ChatbotResult<LLMResponse> {
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        error!(
            status = %status,
            error = %error_text,
            input = %summarize_input_for_log(input),
            "Error calling LLM API"
        );
        return Err(llm_http_error(status, error_text));
    }

    trace!("Processing successful LLM response");
    // Parse the response
    let completion: LLMResponse = response.json().await?;
    debug!(
        "Successfully processed LLM response with {} choices",
        completion.output.len()
    );
    if let Some(usage) = &completion.usage {
        usage.log("non_streaming", completion.reasoning.as_ref());
    }
    Ok(completion)
}

/// Makes a streaming request to an LLM
#[instrument(skip(chat_request, app_config), fields(
    num_messages = chat_request.input.len(),
    temperature,
    max_tokens
))]
pub async fn make_streaming_llm_request(
    chat_request: &LLMRequest,
    app_config: &ApplicationConfiguration,
) -> ChatbotResult<Response> {
    debug!(
        "Preparing streaming LLM request with {} messages",
        chat_request.input.len()
    );
    let chatbot_config = azure_chatbot_configuration(app_config)
        .inspect_err(|_| error!("Azure chatbot configuration missing"))?;

    let request = AzureCompletionRequestRef {
        include: reasoning_include(&chat_request.params),
        base: chat_request,
        stream: true,
        store: StoreDisabled,
    };

    let headers = build_llm_headers(&chatbot_config.api_key)?;
    let api_endpoint = chatbot_config.responses_endpoint()?;
    debug!(
        "Sending streaming request to LLM endpoint: {}",
        api_endpoint
    );

    let send = REQWEST_STREAMING_CLIENT
        .post(api_endpoint)
        .headers(headers)
        .json(&request)
        .send();
    let response = tokio::time::timeout(STREAM_RESPONSE_HEADERS_TIMEOUT, send)
        .await
        .map_err(|_| {
            chatbot_err!(
                StreamEndedEarly,
                format!(
                    "The LLM did not send response headers within {} seconds",
                    STREAM_RESPONSE_HEADERS_TIMEOUT.as_secs()
                )
            )
        })??;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        error!(
            status = %status,
            error = %error_text,
            input = %summarize_input_for_log(&request.base.input),
            "Error calling streaming LLM API"
        );
        return Err(llm_http_error(status, error_text));
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
    let chatbot_config = azure_chatbot_configuration(app_config)
        .inspect_err(|_| error!("Azure chatbot configuration missing"))?;

    let api_endpoint = chatbot_config.responses_endpoint()?;

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

/// Sends `input` as a one-shot structured-JSON request and deserializes the reply as `T`.
///
/// `on_invalid_response` builds the error raised when the reply doesn't parse as `T`, so each
/// caller can raise its own [`ChatbotErrorType`] and wording for that failure.
pub async fn request_structured_json<T: serde::de::DeserializeOwned>(
    input: Vec<APIInputMessage>,
    model: String,
    params: LLMRequestParams,
    max_output_tokens: Option<i32>,
    format: LLMRequestResponseFormatParam,
    app_config: &ApplicationConfiguration,
    on_invalid_response: impl FnOnce() -> ChatbotError,
) -> ChatbotResult<T> {
    let chat_request = LLMRequest {
        max_output_tokens,
        text: Some(RequestTextOptions {
            verbosity: None,
            format: Some(format),
        }),
        ..LLMRequest::new(model, input, params)
    };
    let completion = make_blocking_llm_request(chat_request, app_config).await?;
    let content = parse_text_completion(completion)?;
    serde_json::from_str(&content).map_err(|_| on_invalid_response())
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
                context: None,
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
                    // Only this arm is guaranteed to be GPT-5.6, the one version that accepts the
                    // parameter, and it renders less context than 5.6's `all_turns` default.
                    context: Some(ReasoningContext::CurrentTurn),
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
                    // Assigned by model name, so it also covers deployments older than GPT-5.6,
                    // which reject a reasoning context outright.
                    context: None,
                }),
            })
        }
        ModelType::Mistral => LLMRequestParams::Mistral(MistralParams { placeholder: true }),
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
    use crate::chatbot_tools::{
        ChatbotToolDeclaration,
        client_tools::ask_multiple_choice_question::AskMultipleChoiceQuestionTool,
    };

    use super::*;

    fn thinking_request() -> LLMRequest {
        LLMRequest {
            input: vec![],
            model: "gpt-5.6".to_string(),
            tools: vec![],
            tool_choice: None,
            parallel_tool_calls: None,
            max_output_tokens: None,
            text: None,
            prompt_cache_key: Some("a-key".to_string()),
            params: LLMRequestParams::GPTThinking(ThinkingParams {
                reasoning: Some(Reasoning {
                    effort: ReasoningEffortLevel::Medium,
                    summary: Some(SummaryType::Detailed),
                    context: None,
                }),
            }),
        }
    }

    /// Asking for the payload explicitly is what keeps a deployment that follows Azure's older
    /// contract from returning reasoning items that replay as nothing. It is asked for only where a
    /// reasoning item can appear: Mistral is not an Azure OpenAI model at all, and a non-reasoning
    /// deployment has no reason to be offered a reasoning-only include value.
    #[test]
    fn only_a_reasoning_request_asks_for_the_encrypted_payload() {
        let thinking = reasoning_include(&thinking_request().params);
        assert_eq!(
            thinking.as_deref(),
            Some(["reasoning.encrypted_content".to_string()].as_slice())
        );

        let non_thinking = LLMRequestParams::GPTNonThinking(NonThinkingParams {
            temperature: None,
            top_p: None,
            frequency_penalty: None,
            presence_penalty: None,
        });
        assert_eq!(reasoning_include(&non_thinking), None);
        assert_eq!(
            reasoning_include(&LLMRequestParams::Mistral(MistralParams {
                placeholder: true
            })),
            None
        );

        let body = serde_json::to_value(AzureCompletionRequest {
            include: reasoning_include(&thinking_request().params),
            base: thinking_request(),
            stream: true,
            store: StoreDisabled,
        })
        .expect("the request serializes");
        assert_eq!(
            body["include"],
            serde_json::json!(["reasoning.encrypted_content"])
        );
    }

    /// Storing the response is what makes Azure withhold the `encrypted_content` a later turn
    /// replays, so `store` has one right value on every request. A body that says otherwise, or
    /// says nothing, has to fail rather than be read as having declined.
    #[test]
    fn a_request_body_can_only_decline_azure_side_storage() {
        let body = serde_json::to_value(AzureCompletionRequest {
            include: None,
            base: thinking_request(),
            stream: true,
            store: StoreDisabled,
        })
        .expect("the request serializes");

        assert_eq!(body["store"], serde_json::json!(false));
        assert!(
            serde_json::from_value::<AzureCompletionRequest>(body.clone()).is_ok(),
            "the body a request actually sends round-trips"
        );

        let mut asks_for_storage = body.clone();
        asks_for_storage["store"] = serde_json::json!(true);
        assert!(
            serde_json::from_value::<AzureCompletionRequest>(asks_for_storage).is_err(),
            "a body that asks Azure to store the response is not representable"
        );

        let mut silent = body;
        silent
            .as_object_mut()
            .expect("a request is a JSON object")
            .remove("store");
        assert!(serde_json::from_value::<AzureCompletionRequest>(silent).is_err());
    }

    /// Only GPT-5.6 tolerates being told which reasoning to render: an older reasoning deployment
    /// rejects the parameter outright. [`ModelType::GPTHardThinking`] is always GPT-5.6 here, while
    /// `GPTThinking` is assigned by model name and so still covers older ones, and the
    /// `gpt-5.2-chat` override lands on that same variant from a name that is certainly not 5.6.
    #[test]
    fn only_the_model_type_that_is_certainly_gpt_5_6_asks_for_the_current_turn_context() {
        let context_of = |model_name: &str, model_type| {
            let params = get_params_for_model(model_name, &model_type, None);
            serde_json::to_value(params).expect("the params serialize")["reasoning"]["context"]
                .clone()
        };

        assert_eq!(
            context_of("gpt-5.6", ModelType::GPTHardThinking),
            serde_json::json!("current_turn")
        );
        assert_eq!(
            context_of("gpt-5.4", ModelType::GPTThinking),
            serde_json::Value::Null
        );
        assert_eq!(
            context_of("gpt-5.2-chat", ModelType::GPTHardThinking),
            serde_json::Value::Null
        );
        assert_eq!(
            context_of("gpt-4.1", ModelType::GPTNonThinking),
            serde_json::Value::Null
        );
        assert_eq!(
            context_of("mistral", ModelType::Mistral),
            serde_json::Value::Null
        );
    }

    /// The `type` tag of every [`OutputItem`] variant, which is what
    /// [`every_output_item_serializes_the_same_from_memory_as_from_storage`] measures its cases
    /// against. Kept honest by [`output_item_tag`].
    const EVERY_OUTPUT_ITEM_TAG: &[&str] = &[
        "azure_ai_search_call",
        "azure_ai_search_call_output",
        "function_call",
        "function_call_output",
        "message",
        "reasoning",
    ];

    /// The tag one item serializes as. Matched exhaustively, so an added [`OutputItem`] variant
    /// fails to compile here instead of quietly going missing from [`EVERY_OUTPUT_ITEM_TAG`].
    fn output_item_tag(item: &OutputItem) -> &'static str {
        match item {
            OutputItem::Message { .. } => "message",
            OutputItem::Reasoning { .. } => "reasoning",
            OutputItem::AzureAiSearchCall { .. } => "azure_ai_search_call",
            OutputItem::AzureAiSearchCallOutput { .. } => "azure_ai_search_call_output",
            OutputItem::FunctionCall { .. } => "function_call",
            OutputItem::FunctionCallOutput { .. } => "function_call_output",
        }
    }

    fn output_text(text: &str) -> MessageContentItem {
        MessageContentItem {
            text: text.to_string(),
        }
    }

    fn summary_part(text: &str) -> ReasoningOutput {
        ReasoningOutput {
            output_type: "summary_text".to_string(),
            text: text.to_string(),
        }
    }

    /// One case per shape a round can hand on, `OutputItem` variant by variant. The shapes that
    /// break the invariant below most easily are in here on purpose: a multi-part reasoning summary,
    /// a refusal that arrives as a content part, and arguments a row keeps as a JSON string.
    fn round_trip_cases() -> Vec<APIOutputMessage> {
        [
            OutputItem::Message {
                response_id: "resp_1".to_string(),
                role: MessageRole::Assistant,
                content: MessageContent::Text("Here you go.".to_string()),
            },
            OutputItem::Message {
                response_id: "resp_1".to_string(),
                role: MessageRole::Assistant,
                content: MessageContent::OutputText(vec![
                    output_text("First part. "),
                    output_text("Second part."),
                ]),
            },
            OutputItem::Message {
                response_id: "resp_1".to_string(),
                role: MessageRole::Assistant,
                content: MessageContent::Refusal(vec![RefusalContentItem {
                    refusal: "I cannot help with that.".to_string(),
                }]),
            },
            OutputItem::Reasoning {
                response_id: "resp_1".to_string(),
                id: "rs_1".to_string(),
                summary: vec![summary_part("First part."), summary_part("Second part.")],
                encrypted_content: Some("payload".to_string()),
            },
            OutputItem::Reasoning {
                response_id: "resp_1".to_string(),
                id: "rs_2".to_string(),
                summary: vec![],
                encrypted_content: None,
            },
            OutputItem::FunctionCall {
                response_id: "resp_1".to_string(),
                call_id: "call_1".to_string(),
                tool_name: "course_progress".to_string(),
                arguments: r#"{"query":"loops"}"#.to_string(),
            },
            OutputItem::FunctionCallOutput {
                response_id: "resp_1".to_string(),
                call_id: "call_1".to_string(),
                output: r#"{"completed":3}"#.to_string(),
            },
            OutputItem::AzureAiSearchCall {
                response_id: "resp_1".to_string(),
                call_id: "call_2".to_string(),
                arguments: r#"{"query":"loops"}"#.to_string(),
            },
            OutputItem::AzureAiSearchCallOutput {
                response_id: "resp_1".to_string(),
                call_id: "call_2".to_string(),
                output: r#"{"documents":[]}"#.to_string(),
            },
        ]
        .into_iter()
        .map(|message_type| APIOutputMessage { message_type })
        .collect()
    }

    /// An item goes back to Azure twice: from memory during the round that produced it, and from
    /// storage on every turn after. Azure's prompt cache matches an exact prefix, so the two
    /// spellings have to be byte-identical or the conversation misses the cache from that item
    /// onwards and the model is shown something other than what it wrote.
    #[test]
    fn every_output_item_serializes_the_same_from_memory_as_from_storage() {
        let cases = round_trip_cases();

        let mut covered: Vec<&str> = cases
            .iter()
            .map(|case| output_item_tag(&case.message_type))
            .collect();
        covered.sort_unstable();
        covered.dedup();
        assert_eq!(
            covered, EVERY_OUTPUT_ITEM_TAG,
            "every OutputItem variant needs a case"
        );

        for from_azure in cases {
            assert_eq!(
                serde_json::to_value(&from_azure.message_type).expect("the item serializes")["type"],
                serde_json::json!(output_item_tag(&from_azure.message_type)),
            );

            let during_the_turn = APIInputMessage::from(from_azure.clone());
            let stored = from_azure
                .to_chatbot_conversation_message(Uuid::new_v4())
                .expect("the item is storable");
            let on_a_later_turn = APIInputMessage::try_from(stored).expect("the row converts back");

            assert_eq!(
                serde_json::to_string(&during_the_turn).expect("the in-memory item serializes"),
                serde_json::to_string(&on_a_later_turn).expect("the stored item serializes"),
                "{:?}",
                from_azure.message_type,
            );
        }
    }

    /// Pins the JSON sent to Azure, not the Rust value, so that adding fields to the shared schema
    /// types cannot change what the features built on this ask the LLM for.
    #[test]
    fn a_string_list_response_format_is_the_schema_azure_expects() {
        let serialized = serde_json::to_value(string_list_response_format(
            "AFeatureResponse",
            "suggestions",
        ))
        .expect("the response format serializes");
        assert_eq!(
            serialized,
            serde_json::json!({
                "type": "json_schema",
                "name": "AFeatureResponse",
                "schema": {
                    "type": "object",
                    "properties": {
                        "suggestions": {
                            "type": "array",
                            "items": { "type": "string" }
                        }
                    },
                    "required": ["suggestions"],
                    "additionalProperties": false
                },
                "strict": true
            })
        );
    }

    /// Untagged unit variants serialize as `null`, which Azure reads as a request for no summary,
    /// so this enum must not be untagged.
    #[test]
    fn the_reasoning_summary_type_serializes_as_the_name_azure_expects() {
        assert_eq!(
            serde_json::to_string(&SummaryType::Detailed).expect("the summary type serializes"),
            r#""detailed""#
        );
    }

    const CLIENT_TOOL_NAME: &str = <AskMultipleChoiceQuestionTool as ChatbotToolDeclaration>::NAME;

    /// Which calls suspend a turn is decided from the tool name, so a stored call cannot end up
    /// with a kind the engine disagrees with.
    #[test]
    fn a_stored_tool_call_gets_its_kind_from_the_tool_name() {
        for (tool_name, expected) in [
            (CLIENT_TOOL_NAME, ToolKind::ClientTool),
            ("course_structure", ToolKind::Function),
        ] {
            let message = APIOutputMessage {
                message_type: OutputItem::FunctionCall {
                    response_id: "resp_1".to_string(),
                    call_id: "call_1".to_string(),
                    tool_name: tool_name.to_string(),
                    arguments: "{}".to_string(),
                },
            }
            .to_chatbot_conversation_message(Uuid::new_v4())
            .expect("the call converts to a conversation message");

            let Message::ToolCall(call) = message.message else {
                panic!("expected a tool call message");
            };
            assert_eq!(call.tool_kind, expected, "{tool_name}");
        }
    }

    /// A client tool call is an ordinary function call to Azure: which of the two ends answers it
    /// is our business, not the provider's, so a resumed turn replays the proven shape.
    #[test]
    fn a_client_tool_call_and_its_answer_go_back_as_function_items() {
        let call = ChatbotConversationMessage {
            message: Message::ToolCall(ChatbotConversationMessageToolCall {
                tool_name: CLIENT_TOOL_NAME.to_string(),
                tool_call_id: "call_1".to_string(),
                tool_kind: ToolKind::ClientTool,
                response_id: "resp_1".to_string(),
                ..Default::default()
            }),
            ..Default::default()
        };
        match APIInputMessage::try_from(call)
            .expect("the call converts")
            .message_type
        {
            InputItem::FunctionCall {
                call_id, tool_name, ..
            } => {
                assert_eq!(call_id, "call_1");
                assert_eq!(tool_name, CLIENT_TOOL_NAME);
            }
            other => panic!("expected a function call, got {other:?}"),
        }

        let answer = ChatbotConversationMessage {
            message: Message::ToolOutput(ChatbotConversationMessageToolOutput {
                output: "the client answered".to_string(),
                tool_call_id: "call_1".to_string(),
                tool_kind: ToolKind::ClientTool,
                response_id: "resp_1".to_string(),
                ..Default::default()
            }),
            ..Default::default()
        };
        match APIInputMessage::try_from(answer)
            .expect("the answer converts")
            .message_type
        {
            InputItem::FunctionCallOutput { call_id, output } => {
                assert_eq!(call_id, "call_1");
                assert_eq!(output, "the client answered");
            }
            other => panic!("expected a function call output, got {other:?}"),
        }
    }

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
