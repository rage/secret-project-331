use std::sync::OnceLock;

use crate::{
    azure_chatbot::azure::protocol::{
        InputItem, LLMRequest, LLMRequestParams, LLMRequestResponseFormatParam, NonThinkingParams,
        RequestTextOptions, ThinkingParams,
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
- Never include a "data" or "datasets" property anywhere in the specification, and never use a data generator such as "sequence", "graticule" or "sphere". The teacher's data file is attached to your specification afterwards, so a chart that carried data of its own would be showing invented numbers as course material.
- When a data sample is provided, use the field names exactly as they appear in the sample and pick encoding types (quantitative, nominal, ordinal, temporal) that match the sampled values.
- Include a concise "description" field that describes the chart for screen readers.
- Write every human-readable piece of text in the chart in the target language given below: the "description", the chart "title", and every axis, legend, and encoding "title". Keep field names and other data values unchanged. If no target language is given, use the language of the teacher's request.
- Do not set "width", "height", or "autosize"; the rendering environment controls sizing.
- If an existing specification is provided, treat the request as an edit to it: change only what the request requires and preserve the rest.
- Prefer simple, readable charts over decorative complexity.

Your whole answer must be the Vega-Lite specification as a JSON object, with no wrapper object, no explanation and no code fences."#;

/// User prompt prefix. Also how the test-mode mock Azure API recognises a request from this
/// feature, since a JSON-mode request carries no schema name to identify it by.
pub const USER_PROMPT_PREFIX: &str = "Create or edit a Vega-Lite chart specification according to the request below. Return the specification itself as JSON and nothing else.";

/// The format the chart spec LLM is asked to answer in.
///
/// A plain JSON object rather than a named schema: Azure's structured output accepts only a
/// restricted subset of JSON Schema, which cannot describe a Vega-Lite specification. Handing the
/// specification back as the whole answer means the model writes it in the shape it is written in
/// everywhere else, and that the answer is guaranteed to parse.
fn response_format() -> LLMRequestResponseFormatParam {
    LLMRequestResponseFormatParam::JsonObject
}

/// Input payload for chart spec generation.
pub struct ChartSpecGenerationInput {
    pub prompt: String,
    pub current_spec: Option<String>,
    pub data_url: Option<String>,
    pub data_format: Option<String>,
    pub data_sample: Option<String>,
    /// Language for all human-readable chart text (a BCP 47 code, e.g. the course's `language_code`).
    pub language: Option<String>,
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
                match entry {
                    serde_json::Value::String(reference) if key == "$ref" => {
                        *reference = percent_encode_ref(reference);
                    }
                    // A `$ref` key whose value isn't a string is an ordinary schema node (e.g. a
                    // property literally named `$ref`), so keep descending into it.
                    _ => sanitize_refs(entry),
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

/// Names the first data source anywhere in the spec, or None when it carries none.
///
/// The model is not allowed to supply data at all -- [attach_data_file] adds the teacher's file
/// afterwards -- so any data source here is one the model produced. Enforced in code rather than
/// left to the prompt, because a chart is read as fact in course material and numbers invented to
/// satisfy the request would be misinformation. Recursive because Vega-Lite allows `data` on any
/// view and inside transforms, so a layered or concatenated chart can carry it far from the top
/// level.
fn find_data_source(value: &serde_json::Value) -> Option<&'static str> {
    match value {
        serde_json::Value::Object(fields) => {
            if fields.contains_key("datasets") {
                return Some("a \"datasets\" section");
            }
            if fields.contains_key("data") {
                return Some("a \"data\" property");
            }
            fields.values().find_map(find_data_source)
        }
        serde_json::Value::Array(items) => items.iter().find_map(find_data_source),
        _ => None,
    }
}

/// The data file a chart reads, as the request named it.
#[derive(Clone, Copy)]
pub struct DataFile<'a> {
    pub url: &'a str,
    pub format: Option<&'a str>,
}

/// Stands in for the teacher's file while a spec that has none is validated. The Vega-Lite schema
/// requires a data source on a top-level view, so a chart still waiting for its file could not be
/// checked at all otherwise. Never leaves [parse_and_validate_spec].
const PLACEHOLDER_DATA_FILE: DataFile<'static> = DataFile {
    url: "chart-data",
    format: None,
};

/// The spec with every data source taken out, or None when it isn't parseable JSON.
///
/// The model is asked to return no data, so the specification it edits is sent without any: it then
/// has nothing to copy forward, and an inline dataset in the teacher's spec does not eat the
/// context window either.
fn without_data(spec_string: &str) -> Option<String> {
    let mut spec: serde_json::Value = serde_json::from_str(spec_string).ok()?;
    remove_data_sources(&mut spec);
    serde_json::to_string_pretty(&spec).ok()
}

fn remove_data_sources(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::Object(fields) => {
            fields.remove("data");
            fields.remove("datasets");
            fields.values_mut().for_each(remove_data_sources);
        }
        serde_json::Value::Array(items) => items.iter_mut().for_each(remove_data_sources),
        _ => {}
    }
}

/// Points the spec at the data file the request named.
///
/// The chart then reads exactly the file the teacher attached, whether the model wrote the spec
/// from scratch or repaired one that had drifted. Sub-views inherit a top-level data source, so
/// this reaches every view of a layered or concatenated chart too.
fn attach_data_file(spec: &mut serde_json::Value, url: &str, format: Option<&str>) {
    let Some(fields) = spec.as_object_mut() else {
        return;
    };
    let mut data = serde_json::Map::new();
    data.insert(
        "url".to_string(),
        serde_json::Value::String(url.to_string()),
    );
    if let Some(format) = format {
        data.insert("format".to_string(), serde_json::json!({ "type": format }));
    }
    fields.insert("data".to_string(), serde_json::Value::Object(data));
}

/// Parses one LLM answer, rejects any data the model supplied, attaches `data_file` and validates
/// the result against the Vega-Lite schema. The error string describes the failure in a form
/// suitable for feeding back to the model.
fn parse_and_validate_spec(
    completion_content: &str,
    validator: &jsonschema::Validator,
    data_file: Option<DataFile<'_>>,
) -> Result<serde_json::Value, String> {
    let mut spec: serde_json::Value = serde_json::from_str(completion_content)
        .map_err(|e| format!("The specification is not valid JSON: {e}"))?;
    if !spec.is_object() {
        return Err("The specification must be a JSON object.".to_string());
    }
    if spec.get("spec").is_some_and(serde_json::Value::is_object) {
        return Err(
            "The answer must be the Vega-Lite specification itself, not an object wrapping it."
                .to_string(),
        );
    }
    if let Some(offence) = find_data_source(&spec) {
        return Err(format!(
            "The specification must not contain any data, but it has {offence}. Leave the data out \
             entirely; the teacher's data file is attached to the specification afterwards."
        ));
    }
    let attached = data_file.unwrap_or(PLACEHOLDER_DATA_FILE);
    attach_data_file(&mut spec, attached.url, attached.format);
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
    if !errors.is_empty() {
        return Err(format!(
            "The specification does not conform to the Vega-Lite v6 JSON Schema: {}",
            errors.join("; ")
        ));
    }
    if data_file.is_none() {
        // Leave a chart that has no file yet without one, so the block can say so.
        spec.as_object_mut().map(|fields| fields.remove("data"));
    }
    Ok(spec)
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
    let data_file = input.data_url.as_deref().map(|url| DataFile {
        url,
        format: input.data_format.as_deref(),
    });

    let mut user_message_content = format!(
        "{USER_PROMPT_PREFIX}\n\nRequest:\n{prompt}",
        prompt = input.prompt
    );
    if let Some(language) = &input.language {
        user_message_content
            .push_str("\n\nTarget language for all human-readable chart text (BCP 47 code): ");
        user_message_content.push_str(language);
    }
    if let Some(format) = &input.data_format {
        user_message_content.push_str("\n\nFormat of the data file that will be attached: ");
        user_message_content.push_str(format);
    }
    if let Some(sample) = &input.data_sample {
        user_message_content.push_str("\n\nSample of the data file contents:\n");
        user_message_content.push_str(sample);
    }
    if let Some(current_spec) = &input.current_spec {
        user_message_content.push_str("\n\nExisting specification to edit:\n");
        // A specification too broken to parse is sent as it stands: repairing it is the request.
        user_message_content
            .push_str(&without_data(current_spec).unwrap_or_else(|| current_spec.clone()));
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
            max_output_tokens,
            text: Some(RequestTextOptions {
                verbosity: None,
                format: Some(response_format()),
            }),
            ..LLMRequest::new(task_lm.model.to_owned(), messages.clone(), params.clone())
        };

        let completion = make_blocking_llm_request(chat_request, app_config).await?;
        let completion_content = parse_text_completion(completion)?;

        match parse_and_validate_spec(&completion_content, validator, data_file) {
            Ok(spec) => {
                return serde_json::to_string_pretty(&spec).map_err(|e| {
                    chatbot_err!(
                        SerdeJson,
                        "Failed to serialize the generated chart specification.".to_string(),
                        e
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

    /// The wire shape is the contract with Azure: JSON mode takes no name and no schema, and a
    /// schema smuggled back in would be rejected by the API rather than ignored.
    #[test]
    fn the_response_format_asks_only_for_a_json_object() {
        let serialized =
            serde_json::to_value(response_format()).expect("The response format serializes");

        assert_eq!(serialized, serde_json::json!({"type": "json_object"}));
    }

    #[test]
    fn accepts_a_valid_spec() {
        // The shape the mock LLM endpoint answers with.
        let spec = serde_json::json!({
            "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
            "description": "Mock AI generated bar chart",
            "data": {"url": "/data.json", "format": {"type": "json"}},
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
        let content =
            serde_json::json!({"mark": 123, "sentinel": "sentinel-value-xyz"}).to_string();
        let err = parse_and_validate_spec(&content, validator(), Some(DATA_FILE))
            .expect_err("should be rejected");
        assert!(
            !err.contains("sentinel-value-xyz"),
            "error echoed the spec: {err}"
        );
    }

    #[test]
    fn parse_and_validate_reports_a_non_json_spec() {
        let result = parse_and_validate_spec("this is not json", validator(), Some(DATA_FILE));
        assert!(result.is_err());
        assert!(
            result
                .expect_err("should be an error")
                .contains("not valid JSON")
        );
    }

    const DATA_FILE: DataFile<'static> = DataFile {
        url: "/uploads/data.csv",
        format: Some("csv"),
    };

    /// A chart as the model must now produce it: no data of any kind.
    fn dataless_spec() -> serde_json::Value {
        serde_json::json!({
            "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
            "mark": "bar",
            "encoding": {"x": {"field": "a", "type": "quantitative"}}
        })
    }

    #[test]
    fn accepts_a_specification_that_carries_no_data() {
        assert_eq!(find_data_source(&dataless_spec()), None);
    }

    #[test]
    fn accepts_multiple_views_that_carry_no_data() {
        let spec = serde_json::json!({ "hconcat": [dataless_spec(), dataless_spec()] });
        assert_eq!(find_data_source(&spec), None);
    }

    #[test]
    fn rejects_inline_data_values() {
        let spec = serde_json::json!({"data": {"values": [{"a": 1}]}, "mark": "bar"});
        assert!(find_data_source(&spec).is_some());
    }

    #[test]
    fn rejects_a_data_file_the_model_chose_itself() {
        let spec =
            serde_json::json!({"data": {"url": "http://example.com/data.csv"}, "mark": "bar"});
        assert!(find_data_source(&spec).is_some());
    }

    #[test]
    fn rejects_data_hidden_in_a_layer() {
        let spec = serde_json::json!({
            "layer": [dataless_spec(), {"data": {"values": [{"a": 1}]}, "mark": "line"}]
        });
        assert!(find_data_source(&spec).is_some());
    }

    #[test]
    fn rejects_data_hidden_in_a_transform() {
        let spec = serde_json::json!({
            "transform": [{
                "lookup": "a",
                "from": {"data": {"values": [{"a": 1, "b": 2}]}, "key": "a", "fields": ["b"]}
            }],
            "mark": "bar"
        });
        assert!(find_data_source(&spec).is_some());
    }

    #[test]
    fn rejects_a_datasets_section() {
        let spec = serde_json::json!({
            "datasets": {"invented": [{"a": 1}]},
            "data": {"name": "invented"},
            "mark": "bar"
        });
        assert!(find_data_source(&spec).is_some());
    }

    #[test]
    fn rejects_generated_data() {
        for generator in ["sequence", "graticule", "sphere"] {
            let spec = serde_json::json!({ "data": { generator: {} }, "mark": "bar" });
            assert!(find_data_source(&spec).is_some(), "{generator} was allowed");
        }
    }

    #[test]
    fn parse_and_validate_rejects_an_answer_that_brings_its_own_data() {
        let spec = serde_json::json!({
            "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
            "data": {"values": [{"a": 1}]},
            "mark": "bar",
            "encoding": {"x": {"field": "a", "type": "quantitative"}}
        });
        let err = parse_and_validate_spec(&spec.to_string(), validator(), Some(DATA_FILE))
            .expect_err("should be rejected");

        assert!(err.contains("must not contain any data"), "{err}");
    }

    #[test]
    fn attaches_the_data_file_with_its_format() {
        let mut spec = dataless_spec();

        attach_data_file(&mut spec, "/uploads/data.csv", Some("csv"));

        assert_eq!(
            spec["data"],
            serde_json::json!({"url": "/uploads/data.csv", "format": {"type": "csv"}})
        );
    }

    #[test]
    fn attaches_a_data_file_of_unknown_format() {
        let mut spec = dataless_spec();

        attach_data_file(&mut spec, "/uploads/data", None);

        assert_eq!(spec["data"], serde_json::json!({"url": "/uploads/data"}));
    }

    #[test]
    fn attaching_replaces_whatever_data_was_there() {
        let mut spec = serde_json::json!({"data": {"values": [{"a": 1}]}, "mark": "bar"});

        attach_data_file(&mut spec, "/uploads/data.csv", Some("csv"));

        assert_eq!(
            spec["data"],
            serde_json::json!({"url": "/uploads/data.csv", "format": {"type": "csv"}})
        );
    }

    #[test]
    fn strips_every_data_source_from_the_specification_being_edited() {
        let spec = serde_json::json!({
            "data": {"url": "/uploads/data.csv"},
            "datasets": {"named": [{"a": 1}]},
            "layer": [{"data": {"values": [{"a": 1}]}, "mark": "bar"}],
            "mark": "line"
        });

        let stripped = without_data(&spec.to_string()).expect("should be parseable");

        assert_eq!(
            find_data_source(&serde_json::from_str(&stripped).unwrap()),
            None
        );
        assert!(
            stripped.contains("line"),
            "the chart itself was lost: {stripped}"
        );
    }

    #[test]
    fn leaves_an_unparseable_specification_to_be_sent_as_it_stands() {
        assert_eq!(without_data("{ not json"), None);
    }

    #[test]
    fn parse_and_validate_attaches_the_teacher_s_data_file() {
        let spec =
            parse_and_validate_spec(&dataless_spec().to_string(), validator(), Some(DATA_FILE))
                .expect("should be accepted");

        assert_eq!(
            spec["data"],
            serde_json::json!({"url": "/uploads/data.csv", "format": {"type": "csv"}})
        );
    }

    #[test]
    fn parse_and_validate_leaves_a_chart_with_no_file_yet_without_data() {
        let spec = parse_and_validate_spec(&dataless_spec().to_string(), validator(), None)
            .expect("should be accepted");

        assert_eq!(spec.get("data"), None, "the placeholder leaked out: {spec}");
    }

    #[test]
    fn parse_and_validate_accepts_a_valid_answer() {
        let spec = r#"{"$schema":"https://vega.github.io/schema/vega-lite/v6.json","mark":"bar","encoding":{"x":{"field":"a","type":"quantitative"}}}"#;
        let result = parse_and_validate_spec(spec, validator(), Some(DATA_FILE));
        assert!(result.is_ok(), "expected valid, got: {result:?}");
    }

    #[test]
    fn parse_and_validate_rejects_an_answer_that_wraps_the_specification() {
        let wrapped = serde_json::json!({ "spec": dataless_spec() }).to_string();

        let err = parse_and_validate_spec(&wrapped, validator(), Some(DATA_FILE))
            .expect_err("should be rejected");

        assert!(err.contains("not an object wrapping it"), "{err}");
    }

    #[test]
    fn parse_and_validate_rejects_an_answer_that_is_not_an_object() {
        let err = parse_and_validate_spec("[1, 2]", validator(), Some(DATA_FILE))
            .expect_err("should be rejected");

        assert!(err.contains("must be a JSON object"), "{err}");
    }
}
