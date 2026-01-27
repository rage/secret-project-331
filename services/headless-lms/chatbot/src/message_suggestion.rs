use crate::{
    azure_chatbot::{LLMRequest, LLMRequestParams, NonThinkingParams},
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

/// System prompt instructions for generating suggested next messages
const SYSTEM_PROMPT: &str = r#"You are given a conversation between a helpful learning assistant and a student. You task is to generate three messages that the student could send to the assistant next.

The messages should be:

* short and clear
* aid in learning
* etc.

Directions:

* output only the three message suggestions, nothing else

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

    // collect the conversation messages into one string
    // while tracking token use so we don't go over the context window wize
    let (_used_tokens2, conversation) = conversation_messages
        .iter()
        // iterate through the messages starting from the newest until token limit is hit
        .rfold((used_tokens, "".to_string()), |(tokens, msgs), el| {
            if let Some(message) = &el.message {
                // add previous tokens, this message's tokens and extra 5 tokens for the tag
                let new_tokens = tokens + el.used_tokens + 5;
                if new_tokens > MAX_CONTEXT_WINDOW {
                    return (tokens, msgs);
                }
                let tag = format!("[{who} said:]\n", who = el.message_role);
                let new_msgs = tag + message + "\n" + &msgs;
                return (new_tokens, new_msgs);
            } else {
                return (tokens, msgs);
            }
        });
    println!("!!!!!!!!!!!!!!!!!!!Conversation: {:?}", conversation);

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
        // estimate tokens and shorten conversation if needed
        messages: vec![system_prompt, user_prompt],
        data_sources: vec![],
        params: LLMRequestParams::NonThinking(NonThinkingParams {
            max_tokens: None,
            temperature: None,
            top_p: None,
            frequency_penalty: None,
            presence_penalty: None,
        }),
        stop: None,
    };
    // add the teacher's prompt
    // make llm reqes
    let completion = make_blocking_llm_request(chat_request, app_config).await?;
    println!("!!!!!!!!!!!!!!!!!!!{:?}", completion);
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
