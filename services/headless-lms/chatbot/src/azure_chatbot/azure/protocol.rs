//! The Azure Responses API wire types: what a request carries and what a streamed response
//! deserializes into.

use headless_lms_models::chatbot_configurations::{ReasoningEffortLevel, VerbosityLevel};
use headless_lms_models::chatbot_conversation_message_messages::MessageRole;
use headless_lms_utils::json_schema_types::Schema;
use serde::{Deserialize, Deserializer, Serialize};
use url::Url;

use super::tools::AzureLLMToolDefinition;
use crate::llm_utils::{APIInputMessage, MessageContent};
use crate::prelude::*;

/// Response received from LLM API
#[derive(Deserialize, Serialize, Debug)]
pub struct Response {
    pub id: Option<String>,
    pub error: Option<ResponseError>,
    /// Why the model stopped short of a complete response. Present on `response.incomplete`.
    pub incomplete_details: Option<IncompleteReason>,
    pub usage: Option<Usage>,
    pub reasoning: Option<ResponseReasoning>,
}

/// The reasoning settings a response reports back, as opposed to the ones the request asked for.
#[derive(Deserialize, Serialize, Debug, Clone, Default)]
pub struct ResponseReasoning {
    /// Which turns' reasoning the model drew on. Kept as a string rather than
    /// [`ReasoningContext`] so that a value this code does not know cannot fail the whole
    /// response; worth logging because only [`ModelType::GPTHardThinking`](headless_lms_models::chatbot_configurations_models::ModelType::GPTHardThinking) asks for one, and
    /// everywhere else this is the deployment's own default.
    pub context: Option<String>,
}

/// What the request was billed for. Optional throughout: Azure reports the cache fields only on
/// some deployment types, and PTU-M never reports `cache_write_tokens` at all.
#[derive(Deserialize, Serialize, Debug, Clone, Default)]
pub struct Usage {
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub total_tokens: Option<i64>,
    pub input_tokens_details: Option<InputTokensDetails>,
    pub output_tokens_details: Option<OutputTokensDetails>,
}

/// How much of the input was served from Azure's prompt cache. The only way to tell whether the
/// prompt prefix is actually stable, since a perturbed prefix fails silently by costing more.
#[derive(Deserialize, Serialize, Debug, Clone, Default)]
pub struct InputTokensDetails {
    pub cached_tokens: Option<i64>,
    pub cache_write_tokens: Option<i64>,
}

/// How much of the output was thinking, which is what moves when the reasoning context widens or
/// narrows.
#[derive(Deserialize, Serialize, Debug, Clone, Default)]
pub struct OutputTokensDetails {
    pub reasoning_tokens: Option<i64>,
}

impl Usage {
    /// Emits the token counts, including how much of the prompt the cache served and, from
    /// `reasoning`, which turns' reasoning the model drew on.
    pub fn log(&self, context: &str, reasoning: Option<&ResponseReasoning>) {
        info!(
            context,
            input_tokens = self.input_tokens,
            output_tokens = self.output_tokens,
            reasoning_tokens = self
                .output_tokens_details
                .as_ref()
                .and_then(|details| details.reasoning_tokens),
            cached_tokens = self
                .input_tokens_details
                .as_ref()
                .and_then(|details| details.cached_tokens),
            cache_write_tokens = self
                .input_tokens_details
                .as_ref()
                .and_then(|details| details.cache_write_tokens),
            reasoning_context = reasoning.and_then(|reasoning| reasoning.context.as_deref()),
            "LLM token usage"
        );
    }
}

/// Error object returned by the LLM API on a failed response. Fields are optional so any
/// error shape deserializes rather than crashing the stream parser.
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct ResponseError {
    pub code: Option<String>,
    pub message: Option<String>,
    #[serde(rename = "type")]
    pub error_type: Option<String>,
    pub param: Option<String>,
}

impl std::fmt::Display for ResponseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}: {} (code: {}, param: {})",
            self.error_type.as_deref().unwrap_or("Error"),
            self.message.as_deref().unwrap_or("unknown error"),
            self.code.as_deref().unwrap_or("none"),
            self.param.as_deref().unwrap_or("none")
        )
    }
}

/// Why a response is incomplete, e.g. `max_output_tokens` or `content_filter`.
#[derive(Deserialize, Serialize, Debug)]
pub struct IncompleteReason {
    pub reason: String,
}

/// One line of the Azure event stream. Which fields are set depends on `response_type`: a text
/// delta, a completed item, a whole response, or an error.
#[derive(Deserialize, Serialize, Debug)]
pub struct ResponseOutput {
    /// The event type of this response
    // Optional so a streamed `data:` line that omits `type` still deserializes and is ignored,
    // rather than aborting the whole chat stream.
    #[serde(rename = "type")]
    pub response_type: Option<String>, // for examples check out sse::ALL_EXPECTED_EVENTS
    pub delta: Option<String>,
    pub item: Option<ReceivedOutputItem>,
    pub response: Option<Response>,
    pub error: Option<ResponseError>,
}

/// An output item as it arrived, which is not necessarily one this code knows.
///
/// Azure adds item kinds, and [`OutputItem`] rejects a tag it has no variant for — which would
/// fail the line it arrived on and end the whole stream. Anything that does not deserialize is
/// kept as raw JSON and dropped by [`Self::known`] instead.
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(untagged)]
pub enum ReceivedOutputItem {
    Known(OutputItem),
    Unreadable(serde_json::Value),
}

impl ReceivedOutputItem {
    /// The item, or `None` for one this code cannot read, logged as it arrived.
    pub fn known(self) -> Option<OutputItem> {
        match self {
            Self::Known(item) => Some(item),
            Self::Unreadable(raw) => {
                warn!("Ignoring an output item from Azure that could not be read: {raw}");
                None
            }
        }
    }
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
pub enum OutputItem {
    Message {
        response_id: String,
        role: MessageRole,
        content: MessageContent,
    },
    Reasoning {
        response_id: String,
        id: String,
        summary: Vec<ReasoningOutput>,
        /// Absent unless the request set `store` to false, which is what makes Azure hand the
        /// reasoning back instead of keeping it and expecting `id` to resolve against it.
        #[serde(skip_serializing_if = "Option::is_none")]
        encrypted_content: Option<String>,
    },
    AzureAiSearchCall {
        response_id: String,
        call_id: String,
        /// JSON string
        arguments: String,
    },
    AzureAiSearchCallOutput {
        response_id: String,
        call_id: String,
        /// JSON string
        output: String,
    },
    FunctionCall {
        response_id: String,
        call_id: String,
        #[serde(rename = "name")]
        tool_name: String,
        /// JSON string
        arguments: String,
    },
    FunctionCallOutput {
        response_id: String,
        call_id: String,
        output: String,
    },
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
pub enum InputItem {
    Message {
        role: MessageRole,
        content: MessageContent,
    },
    FunctionCall {
        call_id: String,
        #[serde(rename = "name")]
        tool_name: String,
        arguments: String,
    },
    FunctionCallOutput {
        call_id: String,
        output: String,
    },
    Reasoning {
        id: String,
        summary: Vec<ReasoningOutput>,
        /// Carries the reasoning itself, so a replayed item survives without Azure holding the
        /// response `id` refers to. An item sent without it is rejected once `store` is false.
        #[serde(skip_serializing_if = "Option::is_none")]
        encrypted_content: Option<String>,
    },
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct AISearchOutput {
    #[serde(deserialize_with = "urls_that_parse")]
    pub get_urls: Vec<Url>,
}

/// The search results whose url this code can actually fetch. One unparseable entry must not
/// drop every other citation from the same search.
fn urls_that_parse<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Vec<Url>, D::Error> {
    let raw = Vec::<String>::deserialize(deserializer)?;
    Ok(raw
        .into_iter()
        .filter_map(|value| match Url::parse(&value) {
            Ok(url) => Some(url),
            Err(error) => {
                warn!("Ignoring a cited document url the search returned: {value} ({error})");
                None
            }
        })
        .collect())
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LLMToolChoice {
    Auto,
    None,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ThinkingParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<Reasoning>,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct RequestTextOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verbosity: Option<VerbosityLevel>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<LLMRequestResponseFormatParam>,
}
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct Reasoning {
    pub effort: ReasoningEffortLevel,
    pub summary: Option<SummaryType>,
    /// Which turns' reasoning the model may draw on. Leave unset for anything that is not certainly
    /// GPT-5.6: an older reasoning deployment rejects the parameter rather than ignoring it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<ReasoningContext>,
}

/// How far back the model reuses its own reasoning.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReasoningContext {
    /// Only this turn's reasoning, including the reasoning between the calls of one tool loop.
    /// Reasoning replayed from completed earlier turns still travels in the request, but is not
    /// rendered into the next sample.
    CurrentTurn,
    /// Also the reasoning items replayed from earlier turns, not only this turn's. GPT-5.6's own
    /// default when the request leaves the parameter unset.
    AllTurns,
}

/// Untagged would serialize these unit variants as `null`, which asks Azure for no summary at all.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SummaryType {
    Concise,
    Detailed,
    Auto,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct ReasoningOutput {
    #[serde(rename = "type")]
    pub output_type: String, //summary_text
    pub text: String,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NonThinkingParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frequency_penalty: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presence_penalty: Option<f32>,
}

/// Mistral's request parameters are not decided yet; this field exists only so
/// [`LLMRequestParams::Mistral`] has a shape of its own to serialize and deserialize as, distinct
/// from the other two variants.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct MistralParams {
    pub placeholder: bool,
}

/// Each variant's own struct rejects a field belonging to another, which is what tells them apart
/// on the way back in: untagged tries them in order and they otherwise all match any object.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(untagged)]
pub enum LLMRequestParams {
    GPTThinking(ThinkingParams),
    GPTNonThinking(NonThinkingParams),
    Mistral(MistralParams),
}

/// How the model is asked to shape its answer.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum LLMRequestResponseFormatParam {
    /// An object matching `schema` exactly. Azure only accepts a restricted subset of JSON Schema
    /// here, so a feature whose answer cannot be described in it wants `JsonObject` instead.
    JsonSchema {
        /// What Azure, and the test-mode mock Azure API, identify the format by.
        name: String,
        schema: Schema,
        /// Should always be true: without it Azure treats the schema as a hint.
        strict: bool,
    },
    /// Any valid JSON object, for an answer whose shape Azure cannot be told.
    JsonObject,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LLMRequest {
    pub input: Vec<APIInputMessage>,
    pub model: String,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub tools: Vec<AzureLLMToolDefinition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<LLMToolChoice>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parallel_tool_calls: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<RequestTextOptions>,
    /// Routes requests sharing a prompt prefix to the same cache entry. `None` for a model that has
    /// no Azure prompt cache.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_cache_key: Option<String>,
    #[serde(flatten)]
    pub params: LLMRequestParams,
}

/// Builds the error the stream parsers raise when Azure reports a failure on the line they are
/// reading, attaching `err` as the error's Azure source.
pub(super) fn azure_stream_error(response_id: Option<&str>, err: ResponseError) -> ChatbotError {
    let mut error = chatbot_err!(
        UpstreamReportedError,
        format!(
            "Error received from Azure API. Response id: {}",
            response_id.unwrap_or("not received")
        )
    );
    error.add_azure_source(err);
    error
}

/// The error Azure reported on this line, if any: the one nested under `response` when a response
/// object came with it, otherwise the top-level one. `fallback_response_id` is used only for the
/// latter, since the former carries its own response id.
pub(crate) fn reported_azure_error(
    output: &ResponseOutput,
    fallback_response_id: Option<&str>,
) -> Option<ChatbotError> {
    if let Some(response) = &output.response
        && let Some(err) = &response.error
    {
        return Some(azure_stream_error(response.id.as_deref(), err.clone()));
    }
    output
        .error
        .as_ref()
        .map(|err| azure_stream_error(fallback_response_id, err.clone()))
}

/// Why the response this line carries is incomplete, if it says so. A response that stopped short
/// still streams as if it had finished, so this is the only thing that tells the two apart.
pub(crate) fn reported_incomplete_reason(output: &ResponseOutput) -> Option<&str> {
    output
        .response
        .as_ref()?
        .incomplete_details
        .as_ref()
        .map(|details| details.reason.as_str())
}

/// Logs the usage a response line carries, if any, under `context`.
pub(crate) fn log_response_usage(response_output: &ResponseOutput, context: &str) {
    if let Some(response) = response_output.response.as_ref()
        && let Some(usage) = response.usage.as_ref()
    {
        usage.log(context, response.reasoning.as_ref());
    }
}

/// Logs `output`'s usage under `context`, then errors if it reports a failure — the two checks
/// both stream parsers make on every line, before either looks at its own content.
pub(crate) fn check_response_output(
    output: &ResponseOutput,
    response_id: Option<&str>,
    context: &str,
) -> ChatbotResult<()> {
    log_response_usage(output, context);
    match reported_azure_error(output, response_id) {
        Some(error) => Err(error),
        None => Ok(()),
    }
}

/// Errors once a response has finished streaming if it stopped short of a complete one, whether
/// `output` names the reason or the caller only knows a `response.incomplete` event fired with none.
pub(crate) fn check_response_complete(
    output: &ResponseOutput,
    incomplete_without_reason: bool,
) -> ChatbotResult<()> {
    let reason = reported_incomplete_reason(output)
        .or_else(|| incomplete_without_reason.then_some("not reported"));
    match reason {
        Some(reason) => Err(chatbot_err!(
            ResponseIncomplete,
            format!("The LLM response is incomplete. Reason: {reason}")
        )),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A `response.failed` line carries `error` as an object, not a string. Deserializing it
    /// must succeed so the error can be surfaced instead of crashing the stream parser.
    #[test]
    fn response_failed_with_error_object_deserializes() {
        let line = r#"{"type":"response.failed","response":{"id":"resp_abc","status":"failed","error":{"code":"tool_user_error","message":"Could not complete vectorization action."}},"sequence_number":8}"#;

        let parsed: ResponseOutput = serde_json::from_str(line).unwrap();
        let error = parsed
            .response
            .expect("response object")
            .error
            .expect("error object");

        assert_eq!(error.code.as_deref(), Some("tool_user_error"));
        assert!(error.message.unwrap().contains("vectorization"));
    }

    /// Azure returns azure_ai_search call/output items with `arguments`/`output` as strings.
    #[test]
    fn azure_ai_search_output_items_deserialize() {
        let call = r#"{"type":"azure_ai_search_call","id":"fc_1","response_id":"resp_abc","call_id":"call_1","arguments":"{\"query\":\"trademarks\"}","status":"completed"}"#;
        match serde_json::from_str::<OutputItem>(call).unwrap() {
            OutputItem::AzureAiSearchCall { arguments, .. } => {
                assert!(arguments.contains("trademarks"))
            }
            other => panic!("expected AzureAiSearchCall, got {other:?}"),
        }

        let output = r#"{"type":"azure_ai_search_call_output","id":"fco_1","response_id":"resp_abc","call_id":"call_1","output":"remote tool call failed","status":"in_progress"}"#;
        match serde_json::from_str::<OutputItem>(output).unwrap() {
            OutputItem::AzureAiSearchCallOutput { output, .. } => {
                assert_eq!(output, "remote tool call failed")
            }
            other => panic!("expected AzureAiSearchCallOutput, got {other:?}"),
        }
    }

    /// An item kind Azure adds and this code has no variant for must not fail the whole line, or
    /// it would kill the stream over an item nothing forced it to react to.
    #[test]
    fn an_unknown_item_type_deserializes_as_unreadable_instead_of_failing() {
        let line = r#"{"type":"response.output_item.done","item":{"type":"web_search_call","id":"ws_1","status":"completed"}}"#;

        let parsed: ResponseOutput =
            serde_json::from_str(line).expect("the line deserializes despite the unknown item");
        assert!(matches!(
            parsed.item,
            Some(ReceivedOutputItem::Unreadable(_))
        ));
        assert!(parsed.item.and_then(ReceivedOutputItem::known).is_none());
    }
}
