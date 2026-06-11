use headless_lms_utils::services::sisu::SisuDescriptions;
use std::collections::HashMap;

use crate::{
    azure_chatbot::{
        ArrayItem, ArrayProperty, InputItem, JSONType, JsonItem, LLMRequest, LLMRequestParams,
        LLMRequestResponseFormatParam, NonThinkingParams, RequestTextOptions, Schema,
        SchemaPropertyType, ThinkingParams,
    },
    chatbot_error::ChatbotResult,
    llm_utils::{
        APIInputMessage, MessageContent, make_blocking_llm_request, model_is_thinking,
        parse_text_completion,
    },
};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{
    application_task_default_language_models::TaskLMSpec,
    chatbot_conversation_message_messages::MessageRole,
};

const SYSTEM_PROMPT: &str = r#"You are given different type of information for an university course. There can exist multiple modules for the course which are differentiated by the module code as the key. Your task is to generate a single description combining information from all different modules but also generate module specific descriptions for each module.

When generating the description:
- Use the same language in the description that is used in the given information.
- Use same style of writing as in the given information.
- Ignore all the information that is not relevant for the course description.
- Ignore all the html tags inside the given information.
- Give the final output in json format where the descriptions for the modules are behind the same module keys as in the given information. Also put the description for the whole course behind a key named course_description.

Constraints:
- Base the summarization only on the information given to you.
- Only output the summarized description, nothing else.
- The maximum length for the description is 100 words.
"#;

pub const USER_PROMPT: &str = r#"Give description based on the given information."#;

pub async fn generate_description(
    app_config: &ApplicationConfiguration,
    task_lm: TaskLMSpec,
    sisu_course_info: HashMap<String, SisuDescriptions>,
) -> ChatbotResult<String> {
    let serialized_sisu_course_info = serde_json::to_string(&sisu_course_info).unwrap();
    let system_prompt = SYSTEM_PROMPT.to_owned();
    let prompt: String =
        format!("{system_prompt} Course information: {serialized_sisu_course_info}");

    let system_prompt = APIInputMessage {
        message_type: InputItem::Message {
            role: MessageRole::System,
            content: MessageContent::Text(prompt),
        },
    };

    let user_prompt = APIInputMessage {
        message_type: InputItem::Message {
            role: MessageRole::User,
            content: MessageContent::Text(USER_PROMPT.to_string()),
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
    //let json = serde_json::to_string_pretty(&chat_request).unwrap();
    //println!("{}", json);

    let completion = make_blocking_llm_request(chat_request, app_config)
        .await
        .unwrap();

    let completion_content: &String = &parse_text_completion(completion)?;
    //println!("Chatbot: {completion:?}");
    //println!("{parse_text_completion:?}");
    dbg!(completion_content);
    Ok(completion_content.to_string())
}
