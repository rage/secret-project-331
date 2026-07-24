use std::collections::HashMap;
use std::sync::OnceLock;

use crate::{
    azure_chatbot::{
        InputItem, JSONType, JsonItem, LLMRequest, LLMRequestParams, LLMRequestResponseFormatParam,
        NonThinkingParams, RequestTextOptions, Schema, SchemaPropertyType, ThinkingParams,
    },
    chatbot_error::chatbot_err,
    content_cleaner::calculate_safe_token_limit,
    llm_utils::{
        APIInputMessage, MessageContent, estimate_tokens, make_blocking_llm_request,
        model_is_thinking, parse_text_completion,
    },
    prelude::{ChatbotError, ChatbotErrorType, ChatbotResult},
};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::{
    application_task_default_language_models::TaskLMSpec,
    chatbot_conversation_message_messages::MessageRole,
};

/// Structured LLM response for chart spec generation.
#[derive(serde::Deserialize)]
struct ChartSpecGenerationResponse {
    spec: String,
}

/// Vendored copy of https://vega.github.io/schema/vega-lite/v6.json, used to validate
/// generated specs without network access. All of its `$ref`s are internal.
static VEGA_LITE_SCHEMA_JSON: &str = include_str!("../schemas/vega-lite-v6.json");

/// How many validation attempts the model gets in total (first answer + repair rounds).
const MAX_GENERATION_ATTEMPTS: usize = 2;
/// Caps for how much validation detail is echoed back to the model and the teacher; union
/// schemas like Vega-Lite's can produce very many, very long errors.
const MAX_REPORTED_VALIDATION_ERRORS: usize = 5;
const MAX_VALIDATION_ERROR_CHARS: usize = 300;

/// System prompt for generating a Vega-Lite chart specification for the CMS chart block.
const SYSTEM_PROMPT: &str = r#"You are helping course staff create a chart for course materials.

Your task is to produce a single, complete, valid Vega-Lite specification based on the teacher's request.

Rules:
- Set "$schema" to "https://vega.github.io/schema/vega-lite/v6.json".
- If a data file URL is provided, reference it exactly as given via "data": {"url": "<the url>", "format": {"type": "<the format>"}}. Never inline data values in that case and never invent a different URL.
- If no data file is provided, include small, plausible inline example data via "data": {"values": [...]} so the chart renders.
- When a data sample is provided, use the field names exactly as they appear in the sample and pick encoding types (quantitative, nominal, ordinal, temporal) that match the sampled values.
- Include a concise "description" field that describes the chart for screen readers; write it in the same language as the teacher's request.
- Do not set "width", "height", or "autosize"; the rendering environment controls sizing.
- If an existing specification is provided, treat the request as an edit to it: change only what the request requires and preserve the rest.
- Prefer simple, readable charts over decorative complexity.

Your output must follow the JSON schema exactly:
{
  "spec": "<the complete Vega-Lite specification serialized as a JSON string>"
}"#;

/// User prompt prefix; also used by the mock LLM endpoint to recognize this task.
pub const USER_PROMPT_PREFIX: &str = "Create or edit a Vega-Lite chart specification according to the request below. Return JSON only.";

/// Input payload for chart spec generation.
pub struct ChartSpecGenerationInput {
    pub prompt: String,
    pub current_spec: Option<String>,
    pub data_url: Option<String>,
    pub data_format: Option<String>,
    pub data_sample: Option<String>,
}

/// Percent-encodes characters RFC 3986 forbids in URI fragments. Vega-Lite definition
/// names (e.g. `MarkPropDef<(Gradient|string|null)>`) contain such characters, and the
/// validator's meta-schema check rejects `$ref`s pointing at them. Fragments are
/// percent-decoded before JSON-pointer evaluation, so encoded refs still resolve to the
/// original definition keys.
fn percent_encode_ref(reference: &str) -> String {
    let mut out = String::with_capacity(reference.len());
    for byte in reference.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' => out.push(byte as char),
            b'-' | b'.' | b'_' | b'~' | b'!' | b'$' | b'&' | b'\'' | b'(' | b')' | b'*' | b'+'
            | b',' | b';' | b'=' | b':' | b'@' | b'/' | b'?' | b'#' | b'%' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

/// Rewrites every `$ref` string in the schema with [`percent_encode_ref`].
fn sanitize_refs(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::Object(map) => {
            for (key, entry) in map.iter_mut() {
                if key == "$ref" {
                    if let serde_json::Value::String(reference) = entry {
                        *reference = percent_encode_ref(reference);
                    }
                } else {
                    sanitize_refs(entry);
                }
            }
        }
        serde_json::Value::Array(items) => items.iter_mut().for_each(sanitize_refs),
        _ => {}
    }
}

/// The Vega-Lite validator built from the vendored schema; built once per process.
fn vega_lite_validator() -> ChatbotResult<&'static jsonschema::Validator> {
    static VALIDATOR: OnceLock<Result<jsonschema::Validator, String>> = OnceLock::new();
    VALIDATOR
        .get_or_init(|| {
            let mut schema: serde_json::Value =
                serde_json::from_str(VEGA_LITE_SCHEMA_JSON).map_err(|e| e.to_string())?;
            sanitize_refs(&mut schema);
            jsonschema::validator_for(&schema).map_err(|e| e.to_string())
        })
        .as_ref()
        .map_err(|e| {
            chatbot_err!(
                ChatbotMessageSuggestError,
                format!("The bundled Vega-Lite schema could not be loaded: {e}")
            )
        })
}

/// Parses one LLM answer and validates the spec against the Vega-Lite schema. The error
/// string describes the failure in a form suitable for feeding back to the model.
fn parse_and_validate_spec(
    completion_content: &str,
    validator: &jsonschema::Validator,
) -> Result<serde_json::Value, String> {
    let response: ChartSpecGenerationResponse =
        serde_json::from_str(completion_content).map_err(|_| {
            r#"The response did not follow the required {"spec": "..."} JSON format."#.to_string()
        })?;
    let spec: serde_json::Value = serde_json::from_str(&response.spec)
        .map_err(|e| format!("The specification is not valid JSON: {e}"))?;
    if !spec.is_object() {
        return Err("The specification must be a JSON object.".to_string());
    }
    let errors: Vec<String> = validator
        .iter_errors(&spec)
        .take(MAX_REPORTED_VALIDATION_ERRORS)
        .map(|error| {
            // `masked()` omits the failing instance from the message; the raw Display
            // would start with the whole (possibly huge) spec and truncate the reason away.
            format!(
                "{} (at instance path \"{}\")",
                error.masked(),
                error.instance_path()
            )
            .chars()
            .take(MAX_VALIDATION_ERROR_CHARS)
            .collect()
        })
        .collect();
    if errors.is_empty() {
        Ok(spec)
    } else {
        Err(format!(
            "The specification does not conform to the Vega-Lite v6 JSON Schema: {}",
            errors.join("; ")
        ))
    }
}

fn text_message(role: MessageRole, content: String) -> APIInputMessage {
    APIInputMessage {
        message_type: InputItem::Message {
            role,
            content: MessageContent::Text(content),
        },
    }
}

/// Generate a Vega-Lite chart specification from a teacher's prompt using an LLM with
/// structured JSON output. The result is validated against the Vega-Lite v6 JSON Schema;
/// on failure the validation errors are sent back to the model for one repair round.
/// Returns the specification pretty-printed as a JSON string.
pub async fn generate_chart_spec(
    app_config: &ApplicationConfiguration,
    task_lm: TaskLMSpec,
    input: &ChartSpecGenerationInput,
) -> ChatbotResult<String> {
    let validator = vega_lite_validator()?;

    let mut user_message_content = format!(
        "{USER_PROMPT_PREFIX}\n\nRequest:\n{prompt}",
        prompt = input.prompt
    );
    if let Some(data_url) = &input.data_url {
        user_message_content.push_str("\n\nData file URL: ");
        user_message_content.push_str(data_url);
        if let Some(format) = &input.data_format {
            user_message_content.push_str("\nData file format: ");
            user_message_content.push_str(format);
        }
    }
    if let Some(sample) = &input.data_sample {
        user_message_content.push_str("\n\nSample of the data file contents:\n");
        user_message_content.push_str(sample);
    }
    if let Some(current_spec) = &input.current_spec {
        user_message_content.push_str("\n\nExisting specification to edit:\n");
        user_message_content.push_str(current_spec);
    }

    let mut estimated_tokens =
        estimate_tokens(SYSTEM_PROMPT) + estimate_tokens(&user_message_content);
    let token_budget =
        calculate_safe_token_limit(task_lm.context_size, task_lm.context_utilization);

    if estimated_tokens > token_budget {
        return Err(chatbot_err!(
            ChatbotMessageSuggestError,
            "The chart generation input is too long for the AI model's context window.".to_string()
        ));
    }

    let (params, max_output_tokens) = if model_is_thinking(task_lm.model_type) {
        (
            LLMRequestParams::GPTThinking(ThinkingParams { reasoning: None }),
            Some(8000),
        )
    } else {
        (
            LLMRequestParams::GPTNonThinking(NonThinkingParams {
                temperature: None,
                top_p: None,
                frequency_penalty: None,
                presence_penalty: None,
            }),
            Some(6000),
        )
    };

    let mut messages = vec![
        text_message(MessageRole::System, SYSTEM_PROMPT.to_string()),
        text_message(MessageRole::User, user_message_content),
    ];
    let mut last_failure = String::new();

    for attempt in 0..MAX_GENERATION_ATTEMPTS {
        let chat_request = LLMRequest {
            input: messages.clone(),
            model: task_lm.model.to_owned(),
            max_output_tokens,
            tools: vec![],
            tool_choice: None,
            params: params.clone(),
            text: Some(RequestTextOptions {
                verbosity: None,
                format: Some(LLMRequestResponseFormatParam {
                    format_type: JSONType::JsonSchema,
                    name: "ChartSpecGenerationResponse".to_string(),
                    schema: Schema {
                        type_field: JSONType::Object,
                        properties: HashMap::from([(
                            "spec".to_string(),
                            SchemaPropertyType::Item(JsonItem {
                                type_field: JSONType::String,
                            }),
                        )]),
                        required: vec!["spec".to_string()],
                        additional_properties: false,
                    },
                    strict: true,
                }),
            }),
        };

        let completion = make_blocking_llm_request(chat_request, app_config).await?;
        let completion_content = parse_text_completion(completion)?;

        match parse_and_validate_spec(&completion_content, validator) {
            Ok(spec) => {
                return serde_json::to_string_pretty(&spec).map_err(|e| {
                    ChatbotError::new(
                        ChatbotErrorType::SerdeJson,
                        "Failed to serialize the generated chart specification.".to_string(),
                        Some(e.into()),
                    )
                });
            }
            Err(failure) => {
                last_failure = failure;
                if attempt + 1 < MAX_GENERATION_ATTEMPTS {
                    let correction = format!(
                        "The returned specification was rejected: {last_failure}\n\nReturn the corrected, complete Vega-Lite specification. Follow the same JSON output format."
                    );
                    estimated_tokens +=
                        estimate_tokens(&completion_content) + estimate_tokens(&correction);
                    if estimated_tokens > token_budget {
                        break;
                    }
                    messages.push(text_message(MessageRole::Assistant, completion_content));
                    messages.push(text_message(MessageRole::User, correction));
                }
            }
        }
    }

    Err(chatbot_err!(
        ChatbotMessageSuggestError,
        format!("The AI could not produce a valid Vega-Lite specification. {last_failure}")
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn validator() -> &'static jsonschema::Validator {
        vega_lite_validator().expect("the vendored Vega-Lite schema should compile")
    }

    #[test]
    fn accepts_a_valid_spec() {
        // Mirrors the spec the mock LLM endpoint returns.
        let spec = serde_json::json!({
            "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
            "description": "Mock AI generated bar chart",
            "data": {"url": "/chart-block-example-data.json", "format": {"type": "json"}},
            "mark": "bar",
            "encoding": {
                "x": {"field": "category", "type": "nominal"},
                "y": {"field": "value", "type": "quantitative"}
            }
        });
        assert!(validator().iter_errors(&spec).next().is_none());
    }

    #[test]
    fn rejects_an_invalid_spec() {
        let spec = serde_json::json!({"mark": 123, "encoding": "not an object"});
        assert!(validator().iter_errors(&spec).next().is_some());
    }

    #[test]
    fn validation_errors_do_not_echo_the_spec() {
        let spec = serde_json::json!({"mark": 123, "sentinel": "sentinel-value-xyz"});
        let content = serde_json::json!({ "spec": spec.to_string() }).to_string();
        let err = parse_and_validate_spec(&content, validator()).expect_err("should be rejected");
        assert!(
            !err.contains("sentinel-value-xyz"),
            "error echoed the spec: {err}"
        );
    }

    #[test]
    fn parse_and_validate_reports_a_non_json_spec() {
        let content = serde_json::json!({"spec": "this is not json"}).to_string();
        let result = parse_and_validate_spec(&content, validator());
        assert!(result.is_err());
        assert!(
            result
                .expect_err("should be an error")
                .contains("not valid JSON")
        );
    }

    #[test]
    fn parse_and_validate_accepts_a_valid_answer() {
        let spec = r#"{"$schema":"https://vega.github.io/schema/vega-lite/v6.json","data":{"values":[{"a":1}]},"mark":"bar","encoding":{"x":{"field":"a","type":"quantitative"}}}"#;
        let content = serde_json::json!({ "spec": spec }).to_string();
        let result = parse_and_validate_spec(&content, validator());
        assert!(result.is_ok(), "expected valid, got: {result:?}");
    }
}
