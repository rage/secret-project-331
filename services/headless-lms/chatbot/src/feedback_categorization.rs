use crate::{
    azure_chatbot::azure::protocol::{
        InputItem, LLMRequestParams, LLMRequestResponseFormatParam, NonThinkingParams,
        ThinkingParams,
    },
    chatbot_error::chatbot_err,
    llm_utils::{APIInputMessage, MessageContent, model_is_thinking, request_structured_json},
    prelude::{ChatbotError, ChatbotErrorType, ChatbotResult},
};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::{
    application_task_default_language_models::TaskLMSpec,
    chatbot_conversation_message_messages::MessageRole, feedback::Feedback,
};
use headless_lms_utils::json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType};
use indexmap::IndexMap;

/// Shape of the structured LLM output response, defined by the JSONSchema in
/// [response_format]
#[derive(serde::Deserialize)]
pub struct FeedbackCategorisationResponse {
    pub feedback_id: u32,
    pub category_name: String,
}

/// Names this feature's structured output to Azure. The test-mode mock Azure API picks its canned
/// answer for this feature by this name.
pub const RESPONSE_FORMAT_NAME: &str = "FeedbackCategorisationResponse";

/// The structured output format the suggestion LLM is asked to answer in. Must stay in
/// sync with [FeedbackCategorisationResponse].
fn response_format() -> LLMRequestResponseFormatParam {
    LLMRequestResponseFormatParam {
        format_type: JSONType::JsonSchema,
        name: "FeedbackCategorisationResponse".to_string(),
        schema: Schema::strict_object(
            IndexMap::from([
                (
                    "feedback_id".to_string(),
                    SchemaPropertyType::Item(JsonItem {
                        type_field: JSONType::Number,
                        description: None, // add desc
                    }),
                ),
                (
                    "category_name".to_string(),
                    SchemaPropertyType::Item(JsonItem {
                        type_field: JSONType::String,
                        description: None,
                    }),
                ),
            ]),
            None,
        ),
        strict: true,
    }
}

/// System prompt instructions for generating suggested next messages
const SYSTEM_PROMPT: &str = r#""#;

pub async fn categorize_feedback(
    app_config: &ApplicationConfiguration,
    task_lm: TaskLMSpec,
    feedback: Feedback,
) -> ChatbotResult<FeedbackCategorisationResponse> {
    let prompt = SYSTEM_PROMPT.to_string() + "";
    let input = vec![APIInputMessage {
        message_type: InputItem::Message {
            role: MessageRole::System,
            content: MessageContent::Text(prompt),
        },
    }];
    let (params, max_output_tokens) = if model_is_thinking(task_lm.model_type) {
        (
            LLMRequestParams::GPTThinking(ThinkingParams { reasoning: None }),
            Some(7000),
        )
    } else {
        (
            LLMRequestParams::GPTNonThinking(NonThinkingParams {
                temperature: None,
                top_p: None,
                frequency_penalty: None,
                presence_penalty: None,
            }),
            Some(4000),
        )
    };
    let res: FeedbackCategorisationResponse = request_structured_json(
        input,
        task_lm.model.to_owned(),
        params,
        max_output_tokens,
        response_format(),
        app_config,
        || {
            chatbot_err!(
                FailedAzureResponse,
                "Invalidly structured response from Azure"
            )
        },
    )
    .await?;

    Ok(res)
}
