use headless_lms_utils::services::sisu::SisuDescriptions;
use std::collections::HashMap;

use crate::{
    azure_chatbot::{
        ArrayItem, ArrayProperty, InputItem, JSONType, JsonItem, LLMRequest, LLMRequestParams,
        LLMRequestResponseFormatParam, NonThinkingParams, RequestTextOptions, Schema,
        SchemaPropertyType, ThinkingParams,
    },
    chatbot_error::chatbot_err,
    llm_utils::{
        APIInputMessage, MessageContent, make_blocking_llm_request, model_is_thinking,
        parse_text_completion,
    },
    prelude::{ChatbotError, ChatbotErrorType, ChatbotResult},
};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::{
    application_task_default_language_models::TaskLMSpec,
    chatbot_conversation_message_messages::MessageRole,
};
use utoipa::ToSchema;

#[derive(serde::Serialize, serde::Deserialize, ToSchema, Debug)]
pub struct SisuDescriptionResponse {
    pub course_description: String,
    pub modules: Vec<Module>,
}

#[derive(serde::Serialize, serde::Deserialize, ToSchema, Debug)]
pub struct Module {
    pub course_code: String,
    pub description: String,
}

const SYSTEM_PROMPT: &str = r#"You are given different type of information for an university course. There can exist multiple modules for the course which are differentiated by the module code as the key. Your task is to generate a single description combining information from all different modules but also generate module specific descriptions for each module.

When generating the description:
- Use the same language in the description that is used in the given information.
- Use same style of writing as in the given information.
- Ignore all the information that is not relevant for the course description.
- Ignore all the html tags inside the given information.
- When generating module descriptions don't use filler words such as 'this course', give only relevant information.

Constraints:
- Base the summarization only on the information given to you.
- Only output the summarized description, nothing else.
- The maximum length for the description is 100 words.
- If there is only one module in the course, use exactly the same description for both course description and module description.

Your output must follow the JSON schema exactly:
{
    "course_description": "...",
    "modules": [
        {
            "course_code": "...",
            "description": "..."
        }
    ]
}"#;

pub const USER_PROMPT: &str = r#"Give description based on the given information."#;

pub async fn generate_description(
    app_config: &ApplicationConfiguration,
    task_lm: TaskLMSpec,
    sisu_course_info: HashMap<String, SisuDescriptions>,
) -> ChatbotResult<SisuDescriptionResponse> {
    let serialized_sisu_course_info = serde_json::to_string(&sisu_course_info)?;
    let prompt: String = format!("{USER_PROMPT} Course information: {serialized_sisu_course_info}");

    let system_prompt = APIInputMessage {
        message_type: InputItem::Message {
            role: MessageRole::System,
            content: MessageContent::Text(SYSTEM_PROMPT.to_string()),
        },
    };

    let user_prompt = APIInputMessage {
        message_type: InputItem::Message {
            role: MessageRole::User,
            content: MessageContent::Text(prompt),
        },
    };

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

    let chat_request = LLMRequest {
        input: vec![system_prompt, user_prompt],
        model: task_lm.model.to_owned(),
        max_output_tokens,
        tools: vec![],
        tool_choice: None,
        params,
        text: Some(RequestTextOptions {
            verbosity: None,
            format: Some(LLMRequestResponseFormatParam {
                format_type: JSONType::JsonSchema,
                name: "LLMDescriptionResponse".to_string(),
                schema: Schema {
                    type_field: JSONType::Object,
                    properties: HashMap::from([
                        (
                            "course_description".to_string(),
                            SchemaPropertyType::Item(JsonItem {
                                type_field: JSONType::String,
                            }),
                        ),
                        (
                            "modules".to_string(),
                            SchemaPropertyType::ArrayProperty(ArrayProperty {
                                type_field: JSONType::Array,
                                items: ArrayItem::Schema(Schema {
                                    type_field: JSONType::Object,
                                    properties: HashMap::from([
                                        (
                                            "course_code".to_string(),
                                            SchemaPropertyType::Item(JsonItem {
                                                type_field: JSONType::String,
                                            }),
                                        ),
                                        (
                                            "description".to_string(),
                                            SchemaPropertyType::Item(JsonItem {
                                                type_field: JSONType::String,
                                            }),
                                        ),
                                    ]),
                                    required: Vec::from([
                                        "course_code".to_string(),
                                        "description".to_string(),
                                    ]),
                                    additional_properties: false,
                                }),
                            }),
                        ),
                    ]),
                    required: Vec::from(["course_description".to_string(), "modules".to_string()]),
                    additional_properties: false,
                },
                strict: true,
            }),
        }),
    };

    let completion = make_blocking_llm_request(chat_request, app_config).await?;

    let completion_content: &String = &parse_text_completion(completion)?;

    let descriptions: SisuDescriptionResponse =
        serde_json::from_str(completion_content).map_err(|_| {
            chatbot_err!(
                SisuDescriptionError,
                "Sisu description LLM returned an incorrectly formatted response.".to_string()
            )
        })?;
    Ok(descriptions)
}
