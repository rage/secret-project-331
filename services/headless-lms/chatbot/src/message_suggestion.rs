use crate::{
    azure_chatbot::{
        Items, JSONSchema, JSONType, LLMRequest, LLMRequestParams, LLMRequestResponseFormatParam,
        NonThinkingParams, Schema,
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

// todo what is the correct value
/// Maximum context window size for LLM in tokens
pub const MAX_CONTEXT_WINDOW: i32 = 16000;
/// Maximum percentage of context window to use in a single request
pub const MAX_CONTEXT_UTILIZATION: f32 = 0.75;

/// System prompt instructions for generating suggested next messages
const SYSTEM_PROMPT: &str = r#"You are given a conversation between a helpful learning assistant and a student. You task is to generate three messages that the student could send to the assistant next.

The messages should be:

* short and clear
* aid in learning
* independent of time (no October 2023)
* related to the course topics and the conversation so far
* etc.

Directions:

* output only the three message suggestions, nothing else
*

The course the student is on is: Advanced chatbot course

The conversation is as follows:
"#;

/// User prompt instructions for generating suggested next messages
const USER_PROMPT: &str = r#"Suggest exactly three messages that the user could send next. Output only the message suggestions separated by a newline."#;

pub async fn generate_suggested_messages(
    app_config: &ApplicationConfiguration,
    conversation_messages: &Vec<ChatbotConversationMessage>,
) -> ChatbotResult<Vec<String>> {
    let used_tokens = estimate_tokens(SYSTEM_PROMPT) + estimate_tokens(USER_PROMPT);
    let token_budget = calculate_safe_token_limit(MAX_CONTEXT_WINDOW, MAX_CONTEXT_UTILIZATION);
    let conv_len = conversation_messages.len();

    // calculate how many messages to include in the conversation context
    let (_, order_n) = conversation_messages
        .iter()
        // iterate through the messages starting from the newest until token limit is hit
        .rfold((used_tokens, conv_len), |(tokens, n), el| {
            if !el.message.is_none() {
                // add previous tokens, this message's tokens and extra 1 tokens for newline
                let new_tokens = tokens + el.used_tokens + 1;
                if new_tokens > token_budget {
                    return (tokens, n);
                }
                let new_n = el.order_number as usize;
                return (new_tokens, new_n);
            } else {
                return (tokens, n);
            }
        });
    // the order number of the earliest message to inlcude in the conversation context
    let conversation = &conversation_messages[order_n..]
        .iter()
        .map(|x| x.message.to_owned())
        .collect::<Option<Vec<String>>>()
        .ok_or_else(|| {
            // todo, should probably just put in an empty convo??
            // or when could this fail, it probably never should
            ChatbotError::new(
                ChatbotErrorType::ChatbotMessageSuggestError,
                "Failed to ",
                None,
            )
        })?
        .join("\n\n");
    println!("🐱🐱🐱🐱🐱🐱🐱 Conversation: {:?}", conversation);

    let system_prompt = APIMessage {
        role: MessageRole::System,
        fields: APIMessageKind::Text(APIMessageText {
            content: SYSTEM_PROMPT.to_string() + &conversation,
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
                name: "Lol".to_string(),
                strict: true,
                schema: Schema {
                    type_field: JSONType::Array,
                    items: Items {
                        type_field: JSONType::String,
                    },
                    min_items: 3,
                    max_items: 3,
                },
            },
        }),
        stop: None,
    };
    // add the teacher's prompt
    let completion = make_blocking_llm_request(chat_request, app_config).await?;
    println!("🐱🐱🐱🐱🐱🐱🐱 Completion: {:?}", completion);
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
            message.content.split("\n").map(|x| x.to_owned()).collect()
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
