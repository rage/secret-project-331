use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_base::prelude_base_and_re_exports::BackendError;
use headless_lms_models::{
    application_task_default_language_models::TaskLMSpec,
    chatbot_conversation_message_messages::MessageRole,
};
use headless_lms_utils::json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType};
use indexmap::IndexMap;
use tracing::debug;
use utoipa::ToSchema;

use crate::{
    azure_chatbot::azure::protocol::{
        InputItem, LLMRequestParams, LLMRequestResponseFormatParam, NonThinkingParams,
        ThinkingParams,
    },
    llm_utils::{APIInputMessage, MessageContent, model_is_thinking, request_structured_json},
    prelude::{ChatbotError, ChatbotErrorType, ChatbotResult, chatbot_err},
};

#[derive(serde::Serialize, serde::Deserialize, ToSchema, Debug)]
pub struct PromptCreationResponse {
    pub prompt: String,
    pub first_message: String,
}

pub const RESPONSE_FORMAT_NAME: &str = "PromptCreationResponse";

/// The structured output format the description LLM is asked to answer in. Must stay in
/// sync with [PromptCreationResponse].
fn response_format() -> LLMRequestResponseFormatParam {
    LLMRequestResponseFormatParam {
        format_type: JSONType::JsonSchema,
        name: "PromptCreationResponse".to_string(),
        schema: Schema::strict_object(
            IndexMap::from([
                (
                    "prompt".to_string(),
                    SchemaPropertyType::Item(JsonItem {
                        type_field: JSONType::String,
                        description: None,
                    }),
                ),
                (
                    "first_message".to_string(),
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

fn prompt_if_course(course_name: &str, course_desc: Option<String>) -> String {
    if course_name.len() == 0 {
        return "".to_string();
    };
    let mut course_info = format!(
        "\n\nThe chatbot appears on a course called {}.",
        course_name
    );
    if let Some(d) = course_desc {
        course_info += &format!("The course has the following description: {d}");
    }
    course_info += "\n\n Constraints:\n\n- Don't assume information about the course, refer to the description if it's provided\n";

    course_info
}

const SYSTEM_PROMPT_1: &str = r#"
You are an expert prompt engineer. Generate a high-quality system prompt and a first message for an LLM-based chatbot. The system prompt should be clear and informative. The first message is a message this chatbot sends to the user at the start of a conversation and should be designed to engage the user and help them understand how the chatbot can be useful. The first message should be short and concise. Avoid overwhelming the user with information.

The chatbot that this prompt will be used on has the following description, including its specified purpose and task:

"#;

/// Create a prompt and an initial message for a chatbot configuration
pub async fn generate_prompt(
    app_config: &ApplicationConfiguration,
    task_lm: TaskLMSpec,
    course_name: &str,
    course_desc: Option<String>,
    chatbot_purpose: &str,
) -> ChatbotResult<PromptCreationResponse> {
    let prompt =
        SYSTEM_PROMPT_1.to_string() + chatbot_purpose + &prompt_if_course(course_name, course_desc);
    debug!("{}", &prompt);
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

    let res: PromptCreationResponse = request_structured_json(
        input,
        task_lm.model.to_owned(),
        params,
        max_output_tokens,
        response_format(),
        app_config,
        || chatbot_err!(Other, "todo"),
    )
    .await?;

    Ok(res)
}
