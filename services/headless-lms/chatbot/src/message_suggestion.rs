use std::collections::HashMap;

use crate::{
    azure_chatbot::{
        ArrayItem, ArrayProperty, JSONSchema, JSONType, LLMRequest, LLMRequestParams,
        LLMRequestResponseFormatParam, NonThinkingParams, Schema,
    },
    content_cleaner::calculate_safe_token_limit,
    llm_utils::{
        APIMessage, APIMessageKind, APIMessageText, estimate_tokens, make_blocking_llm_request,
    },
    prelude::{ChatbotError, ChatbotErrorType, ChatbotResult},
};
use headless_lms_models::chatbot_conversation_messages::{ChatbotConversationMessage, MessageRole};
use headless_lms_utils::ApplicationConfiguration;
use headless_lms_utils::prelude::BackendError;
use tracing::info;

/// Shape of the structured LLM output response, defined by the JSONSchema in
/// generate_suggested_messages
#[derive(serde::Deserialize)]
struct ChatbotNextMessageSuggestionResponse {
    suggestions: Vec<String>,
}

// todo what is the correct value ????????++
/// Maximum context window size for LLM in tokens
pub const MAX_CONTEXT_WINDOW: i32 = 16000;
/// Maximum percentage of context window to use in a single request
pub const MAX_CONTEXT_UTILIZATION: f32 = 0.75;

/// System prompt instructions for generating suggested next messages
const SYSTEM_PROMPT: &str = r#"You are given a conversation between a helpful teaching assistant chatbot and a student. Your task is to analyze the conversation and suggest what messages the user could send to the teaching assistant chatbot next to best support the user's learning.

When generating suggestions:
- Base them strictly on the content and tone of the conversation so far
- Think of questions that will help deepen the user's understanding, aid in learning, clear misconceptions and motivate the user to think and reason about the subject at hand
- Avoid introducing unrelated topics or information not motivated by the conversation
- Maintain a supportive, respectful, and clear tone
- Keep the suggested messages short and concise

Steps:
1. Analyze the student's current level of understanding, confusion, and engagement.
2. Identify any misconceptions, gaps, or opportunities for deeper learning.
3. Propose next messages that:
   - Advance understanding
   - Encourage active thinking
   - Are appropriate in difficulty and tone
   - Are appropriate in the context of the conversation so far
   - Are relevant to the topic of the conversation, context and course

Constraints:
- Do not continue the conversation yourself.
- Do not role-play the teaching assistant.
- Only output the suggested messages, nothing else.
- Suggest exactly 3 alternate next user messages.
- Be brief, concise and clear.

"#;

/// User prompt instructions for generating suggested next messages
const USER_PROMPT: &str = r#"Suggest exactly three messages that the user could send next."#;

pub async fn generate_suggested_messages(
    app_config: &ApplicationConfiguration,
    conversation_messages: &[ChatbotConversationMessage],
    initial_suggested_messages: Option<Vec<String>>,
    course_name: &str,
) -> ChatbotResult<Vec<String>> {
    let prompt = SYSTEM_PROMPT.to_owned()
        + &format!("The course is: {}\n\n", course_name)
        // if there are initial suggested messages, then include <=5 of them as examples
        + &(if let Some(ism) = initial_suggested_messages {format!("Example suggested messages: {}\n\n", ism.into_iter().take(5).collect::<Vec<String>>().join(" "))} else {"".to_string()})
        + "The conversation so far:\n";
    let used_tokens = estimate_tokens(&prompt) + estimate_tokens(USER_PROMPT);
    let token_budget = calculate_safe_token_limit(MAX_CONTEXT_WINDOW, MAX_CONTEXT_UTILIZATION);
    let conv_len = conversation_messages.len();

    // calculate how many messages to include in the conversation context
    let (_, order_n) = conversation_messages
        .iter()
        // iterate through the messages starting from the newest until token limit is hit
        // initial values: tokens already used are in the accumulator,
        // the msg n to cut off the convo from is the convo len (take no msgs)
        .rfold((used_tokens, conv_len), |(accum_tokens, nth_msg), el| {
            if el.message.is_some() {
                // add previous tokens, this message's tokens and extra 1 tokens for newline to the accumulator
                let new_accum_tokens = accum_tokens + el.used_tokens + 1;
                if new_accum_tokens > token_budget {
                    return (accum_tokens, nth_msg);
                }
                let new_order_n = el.order_number as usize;
                (new_accum_tokens, new_order_n)
            } else {
                (accum_tokens, nth_msg)
            }
        });
    // cut off messages older than order_n from the conversation to keep context short
    let conversation = &conversation_messages[order_n..]
        .iter()
        .map(|x| x.message.to_owned())
        .collect::<Option<Vec<String>>>()
        .ok_or_else(|| {
            // this isn't ok only if the conversation contains only ChatbotConversationMessages
            // that have no message property, which should never happen in practice
            ChatbotError::new(
                ChatbotErrorType::ChatbotMessageSuggestError,
                "Failed to create context for message suggestion LLM, there were no conversation messages. There should be some messages before messages are suggested.",
                None,
            )
        })?
        .join("\n\n");

    let system_prompt = APIMessage {
        role: MessageRole::System,
        fields: APIMessageKind::Text(APIMessageText {
            content: prompt + conversation,
        }),
    };
    let user_prompt = APIMessage {
        role: MessageRole::User,
        fields: APIMessageKind::Text(APIMessageText {
            content: USER_PROMPT.to_string(),
        }),
    };

    let chat_request = LLMRequest {
        messages: vec![system_prompt, user_prompt],
        data_sources: vec![],
        params: LLMRequestParams::NonThinking(NonThinkingParams {
            max_tokens: None,
            temperature: None,
            top_p: None,
            frequency_penalty: None,
            presence_penalty: None,
        }),
        response_format: Some(LLMRequestResponseFormatParam {
            format_type: JSONType::JsonSchema,
            json_schema: JSONSchema {
                name: "ChatbotNextMessageSuggestionResponse".to_string(),
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
                    required: Vec::from(["suggestions".to_string()]),
                    additional_properties: false,
                },
            },
        }),
        stop: None,
    };

    let endpoint_path = if app_config.test_chatbot && app_config.test_mode {
        info!("Test mode. Using mock azure endpoint for LLM message suggestion.");
        Some("gpt-4o/chat/suggestions".to_string())
    } else {
        // if it's not test mode, the default, actual endpoint is used
        None
    };
    let completion = make_blocking_llm_request(chat_request, app_config, endpoint_path).await?;
    let suggested_messages: Vec<String> = match &completion
        .choices
        .first()
        .ok_or_else(|| {
            ChatbotError::new(
                ChatbotErrorType::ChatbotMessageSuggestError,
                "The message suggestion LLM didn't send a response with content. Weird.",
                None,
            )
        })?
        .message
        .fields
    {
        APIMessageKind::Text(message) => {
            // parse structured output
            let suggestions: ChatbotNextMessageSuggestionResponse =
                serde_json::from_str(&message.content)?;
            suggestions.suggestions
        }
        _ => {
            return Err(ChatbotError::new(
                ChatbotErrorType::ChatbotMessageSuggestError,
                "The message suggestion LLM returned something other than a text response. This was unexpected and incorrect.".to_string(),
                None,
            ));
        }
    };
    Ok(suggested_messages)
}
