use std::collections::HashMap;

use crate::{
    azure_chatbot::{
        ArrayItem, ArrayProperty, JSONSchema, JSONType, LLMRequest, LLMRequestParams,
        LLMRequestResponseFormatParam, NonThinkingParams, Schema, ThinkingParams,
    },
    content_cleaner::calculate_safe_token_limit,
    llm_utils::{
        APIMessage, APIMessageKind, APIMessageText, estimate_tokens, make_blocking_llm_request,
        parse_text_completion,
    },
    prelude::{ChatbotError, ChatbotErrorType, ChatbotResult},
};
use headless_lms_models::application_task_default_language_models::TaskLMSpec;
use headless_lms_models::chatbot_conversation_messages::MessageRole;
use headless_lms_utils::{ApplicationConfiguration, prelude::BackendError};

/// Structured LLM response for CMS paragraph suggestions.
#[derive(serde::Deserialize)]
struct CmsParagraphSuggestionResponse {
    suggestions: Vec<String>,
}

/// System prompt for generating multiple alternative paragraph suggestions for CMS content.
const SYSTEM_PROMPT: &str = r#"You are helping course staff improve a single paragraph of course material.

Your task is to generate several alternative versions of the given paragraph based on the requested action.

General rules:
- Always preserve the original meaning and important details unless the action explicitly asks to add or remove content.
- Maintain a clear, pedagogical tone appropriate for course materials.
- Do not invent facts that contradict the original paragraph.

About the suggestions:
- Produce multiple alternative rewrites of the same paragraph.
- Each suggestion must be meaningfully different in structure, emphasis, or level of detail.
- Do NOT output suggestions that only differ by tiny edits (e.g. one or two word changes).
- Keep each suggestion self-contained and suitable for direct insertion into the material.

You will receive:
- The original paragraph text.
- The requested action (e.g. fix spelling, improve clarity, change tone, translate).
- Optional metadata such as target tone and target language.

Your output must follow the JSON schema exactly:
{
  "suggestions": ["...", "...", "..."]
}"#;

/// User prompt prefix; the concrete action and metadata will be appended.
const USER_PROMPT_PREFIX: &str = "Generate multiple rewritten versions of the paragraph according to the requested action and metadata. The paragraph may contain inline HTML markup valid inside a Gutenberg paragraph; preserve existing inline tags (links, emphasis, code, sub/superscripts) where possible, do not introduce block-level elements, and do not add new formatting to spans of text that were previously unformatted. Return JSON only.";

/// Input payload for CMS paragraph suggestions.
pub struct CmsParagraphSuggestionInput {
    pub action: String,
    pub content: String,
    pub is_html: bool,
    pub meta_tone: Option<String>,
    pub meta_language: Option<String>,
    pub meta_setting_type: Option<String>,
}

/// Generate multiple paragraph suggestions for CMS using an LLM with structured JSON output.
pub async fn generate_paragraph_suggestions(
    app_config: &ApplicationConfiguration,
    task_lm: TaskLMSpec,
    input: &CmsParagraphSuggestionInput,
) -> ChatbotResult<Vec<String>> {
    let CmsParagraphSuggestionInput {
        action,
        content,
        is_html: _,
        meta_tone,
        meta_language,
        meta_setting_type,
    } = input;

    let mut system_instructions = SYSTEM_PROMPT.to_owned();
    system_instructions.push_str("\n\nRequested action: ");
    system_instructions.push_str(action);
    if let Some(tone) = meta_tone {
        system_instructions.push_str("\nTarget tone: ");
        system_instructions.push_str(tone);
    }
    if let Some(lang) = meta_language {
        system_instructions.push_str("\nTarget language: ");
        system_instructions.push_str(lang);
    }
    if let Some(setting_type) = meta_setting_type {
        system_instructions.push_str("\nSetting type: ");
        system_instructions.push_str(setting_type);
    }

    let paragraph_source = content.as_str();

    let user_message_content = format!(
        "{prefix}\n\nOriginal paragraph (may include inline HTML):\n{paragraph}",
        prefix = USER_PROMPT_PREFIX,
        paragraph = paragraph_source
    );

    let used_tokens =
        estimate_tokens(&system_instructions) + estimate_tokens(&user_message_content);
    let token_budget =
        calculate_safe_token_limit(task_lm.context_size, task_lm.context_utilization);

    if used_tokens > token_budget {
        return Err(ChatbotError::new(
            ChatbotErrorType::ChatbotMessageSuggestError,
            "Input paragraph is too long for the CMS AI suggestion context window.".to_string(),
            None,
        ));
    }

    let system_message = APIMessage {
        role: MessageRole::System,
        fields: APIMessageKind::Text(APIMessageText {
            content: system_instructions,
        }),
    };

    let user_message = APIMessage {
        role: MessageRole::User,
        fields: APIMessageKind::Text(APIMessageText {
            content: user_message_content,
        }),
    };

    let params = if task_lm.thinking {
        LLMRequestParams::Thinking(ThinkingParams {
            max_completion_tokens: Some(4000),
            verbosity: None,
            reasoning_effort: None,
            tools: vec![],
            tool_choice: None,
        })
    } else {
        LLMRequestParams::NonThinking(NonThinkingParams {
            max_tokens: Some(2000),
            temperature: None,
            top_p: None,
            frequency_penalty: None,
            presence_penalty: None,
        })
    };

    let chat_request = LLMRequest {
        messages: vec![system_message, user_message],
        data_sources: vec![],
        params,
        response_format: Some(LLMRequestResponseFormatParam {
            format_type: JSONType::JsonSchema,
            json_schema: JSONSchema {
                name: "CmsParagraphSuggestionResponse".to_string(),
                strict: true,
                schema: Schema {
                    type_field: JSONType::Object,
                    properties: HashMap::from([(
                        "suggestions".to_string(),
                        ArrayProperty {
                            type_field: JSONType::Array,
                            items: ArrayItem {
                                type_field: JSONType::String,
                            },
                        },
                    )]),
                    required: vec!["suggestions".to_string()],
                    additional_properties: false,
                },
            },
        }),
        stop: None,
    };

    let completion = make_blocking_llm_request(chat_request, app_config, &task_lm).await?;

    let completion_content: &String = &parse_text_completion(completion)?;
    let response: CmsParagraphSuggestionResponse = serde_json::from_str(completion_content)
        .map_err(|_| {
            ChatbotError::new(
                ChatbotErrorType::ChatbotMessageSuggestError,
                "The CMS paragraph suggestion LLM returned an incorrectly formatted response."
                    .to_string(),
                None,
            )
        })?;

    if response.suggestions.is_empty() {
        return Err(ChatbotError::new(
            ChatbotErrorType::ChatbotMessageSuggestError,
            "The CMS paragraph suggestion LLM returned an empty suggestions list.".to_string(),
            None,
        ));
    }

    Ok(response.suggestions)
}
