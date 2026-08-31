use headless_lms_utils::{
    json_schema_types::{
        ArrayItem, ArrayProperty, JSONType, JsonItem, Schema, SchemaPropertyType,
        string_array_property,
    },
    services::sisu::SisuDescriptions,
};
use indexmap::IndexMap;
use std::collections::HashMap;

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
    chatbot_conversation_message_messages::MessageRole,
};
use utoipa::ToSchema;

#[derive(serde::Serialize, serde::Deserialize, ToSchema, Debug)]
pub struct SisuDescriptionResponse {
    pub course_description: String,
    pub audience: Vec<String>,
    pub modules: Vec<Module>,
}

#[derive(serde::Serialize, serde::Deserialize, ToSchema, Debug)]
pub struct Module {
    pub course_code: String,
    pub description: String,
    pub prerequisites: Vec<String>,
}

/// Names this feature's structured output to Azure. The test-mode mock Azure API picks its canned
/// answer for this feature by this name.
pub const RESPONSE_FORMAT_NAME: &str = "LLMDescriptionResponse";

/// The structured output format the description LLM is asked to answer in. Must stay in
/// sync with [SisuDescriptionResponse].
fn response_format() -> LLMRequestResponseFormatParam {
    LLMRequestResponseFormatParam {
        format_type: JSONType::JsonSchema,
        name: RESPONSE_FORMAT_NAME.to_string(),
        schema: Schema::strict_object(
            IndexMap::from([
                (
                    "course_description".to_string(),
                    SchemaPropertyType::Item(JsonItem {
                        type_field: JSONType::String,
                        description: None,
                    }),
                ),
                ("audience".to_string(), string_array_property(None)),
                (
                    "modules".to_string(),
                    SchemaPropertyType::ArrayProperty(ArrayProperty {
                        type_field: JSONType::Array,
                        description: None,
                        items: ArrayItem::Schema(Schema::strict_object(
                            IndexMap::from([
                                (
                                    "course_code".to_string(),
                                    SchemaPropertyType::Item(JsonItem {
                                        type_field: JSONType::String,
                                        description: None,
                                    }),
                                ),
                                (
                                    "description".to_string(),
                                    SchemaPropertyType::Item(JsonItem {
                                        type_field: JSONType::String,
                                        description: None,
                                    }),
                                ),
                                ("prerequisites".to_string(), string_array_property(None)),
                            ]),
                            None,
                        )),
                    }),
                ),
            ]),
            None,
        ),
        strict: true,
    }
}

// You are given different type of information for an university course. There can exist multiple modules for the course which are differentiated by the module code as the key. Your task is to generate a single description combining information from all different modules but also generate module specific descriptions and prerequisites for each module. The prerequisites should be given in a list of individual requisites.

const SYSTEM_PROMPT: &str = r#"
Your task is to
1. Generate a single general description combining the information from all the different modules behind the key "course_description".
2. Behind the "audience" key you should create an array with suitable audience types as items on the list. By default this should always be just "everyone", unless the course material information truly specifies suitable audience types. Audience types should be general, for example "students" or "veterans". If you output more specific audience types also include "everyone" in the list unless it can be understood that the course is not for everyone. It is fine to mention some groups in addition to "everyone" that would just mean that the course works particularly well for those groups but everyone can take it. Please note that remarks about which study programme can choose this course are bureocratic university boilerplate and does not necessarily indicate the audience the course is meant for. Audience types like "Bachelor's degree students" are too specific.
3. Behind the "modules" key, you will generate an array of items, where each item represents one module, and thus the array has as many items as there are module codes. Each module item inside the array will have three fields, "course_code", "description" and "prerequisites".
  3.1 The "course_code" field will have the corresponing module code.
  3.2 The "description" field will be a description summarized from all the information you are given on the specific module.
  3.3 The "prerequisites" field will be an array, with each prerequisite differentiated as an item in the list.


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
    "audience": ["..."],
    "modules": [
        {
            "course_code": "...",
            "description": "...",
            "prerequisites": ["...", "...", "..."]
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

    let descriptions: SisuDescriptionResponse = request_structured_json(
        vec![system_prompt, user_prompt],
        task_lm.model.to_owned(),
        params,
        max_output_tokens,
        response_format(),
        app_config,
        || {
            chatbot_err!(
                SisuDescriptionError,
                "Sisu description LLM returned an incorrectly formatted response.".to_string()
            )
        },
    )
    .await?;
    Ok(descriptions)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Pins the JSON sent to Azure, not the Rust value, so that adding fields to the
    /// shared schema types cannot change what this feature asks the LLM for.
    #[test]
    fn response_format_json_is_unchanged() {
        let serialized =
            serde_json::to_value(response_format()).expect("The response format serializes");
        assert_eq!(
            serialized,
            serde_json::json!({
                "type": "json_schema",
                "name": "LLMDescriptionResponse",
                "schema": {
                    "type": "object",
                    "properties": {
                        "course_description": { "type": "string" },
                        "audience": {
                            "type": "array",
                            "items": { "type": "string" }
                        },
                        "modules": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "course_code": { "type": "string" },
                                    "description": { "type": "string" },
                                    "prerequisites": {
                                        "type": "array",
                                        "items": { "type": "string" }
                                    }
                                },
                                "required": ["course_code", "description", "prerequisites"],
                                "additionalProperties": false
                            }
                        }
                    },
                    "required": ["course_description", "audience", "modules"],
                    "additionalProperties": false
                },
                "strict": true
            })
        );
    }
}
