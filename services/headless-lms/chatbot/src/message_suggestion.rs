use std::collections::HashMap;

use crate::{
    azure_chatbot::{
        ArrayItem, ArrayProperty, JSONSchema, JSONType, LLMRequest, LLMRequestParams,
        LLMRequestResponseFormatParam, NonThinkingParams, Schema, ThinkingParams,
    },
    content_cleaner::calculate_safe_token_limit,
    llm_utils::{
        APIMessage, APIMessageKind, APIMessageText, estimate_tokens, make_blocking_llm_request,
    },
    prelude::{ChatbotError, ChatbotErrorType, ChatbotResult},
};
use headless_lms_models::{
    application_task_default_language_models::TaskLMSpec,
    chatbot_conversation_messages::{ChatbotConversationMessage, MessageRole},
};
use headless_lms_utils::{ApplicationConfiguration, prelude::BackendError};
use tracing::info;

/// Shape of the structured LLM output response, defined by the JSONSchema in
/// generate_suggested_messages
#[derive(serde::Deserialize)]
struct ChatbotNextMessageSuggestionResponse {
    suggestions: Vec<String>,
}

/// System prompt instructions for generating suggested next messages
const SYSTEM_PROMPT: &str = r#"You are given a conversation between a helpful teaching assistant chatbot and a student. Your task is to analyze the conversation and suggest what messages the user could send to the teaching assistant chatbot next to best support the user's learning.

When generating suggestions:
- Base them strictly on the content and tone of the conversation so far
- Think of questions that will help deepen the user's understanding, aid in learning, clear misconceptions and motivate the user to think and reason about the subject at hand
- Avoid introducing unrelated topics or information not motivated by the conversation
- Maintain a supportive, respectful, and clear tone
- Keep the suggested messages short and concise
- The teaching assistant's messages are marked to have been said by 'assistant'.

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
- Role-play a student who wants to learn.
- Only output the suggested messages, nothing else.
- Suggest exactly 3 alternate next user messages.
- Be brief, concise and clear. Use as few words and sentences as possible.
- Generate messages that fit some of the categories 'clarification', 'elaboration', 'placing in context', 'how to learn this', and 'practical use'

"#;

/// User prompt instructions for generating suggested next messages
const USER_PROMPT: &str = r#"Suggest exactly three messages that the user could send next."#;

pub async fn generate_suggested_messages(
    app_config: &ApplicationConfiguration,
    task_lm: TaskLMSpec,
    conversation_messages: &[ChatbotConversationMessage],
    initial_suggested_messages: Option<Vec<String>>,
    course_name: &str,
    course_desc: Option<String>,
) -> ChatbotResult<Vec<String>> {
    let prompt = SYSTEM_PROMPT.to_owned()
        + &format!("The course is: {}\n\n", course_name)
        // if there are initial suggested messages, then include <=5 of them as examples
        + &(if let Some(ism) = initial_suggested_messages {
            let examples = ism.into_iter().take(5).collect::<Vec<String>>().join(" ");
            format!("Example suggested messages: {}\n\n", examples)} else {"".to_string()})
        + &(if let Some(c_d) = course_desc {format!("Description for course: {}\n\n", c_d)} else {"".to_string()})
        + "The conversation so far:\n";

    let mut used_tokens = estimate_tokens(&prompt) + estimate_tokens(USER_PROMPT);
    let token_budget =
        calculate_safe_token_limit(task_lm.context_size, task_lm.context_utilization);
    let conv_len = conversation_messages.len();

    // calculate how many messages to include in the conversation context
    let order_n = conversation_messages
        .iter()
        // we want to take messages starting from the newest (=last)
        .rev()
        .map_while(|el| {
            if el.message.is_some() {
                // add this message's tokens and extra 4 tokens for newline and
                // tag to used_tokens
                used_tokens += el.used_tokens + 4;
            } else if let Some(output) = &el.tool_output {
                // add the tokens needed for the tool info to used_tokens
                let s = format!("{}:\n{}\n\n", output.tool_name, output.tool_output);
                used_tokens += estimate_tokens(&s);
            } else {
                // if there is no message or tool output, skip this element.
                // big number won't affect the truncation later as we take min.
                return Some(conv_len);
            }
            if used_tokens > token_budget {
                return None;
            }
            let new_order_n = el.order_number as usize;
            // include this element's order_number as a potential cutoff point
            Some(new_order_n)
        })
        // fuse to cut off the iterator at the first None, i.e. the first msg that
        // didn't fit into the context
        .fuse()
        // select the minimum order_number i.e. oldest message to include
        .min()
        .ok_or(ChatbotError::new(
            ChatbotErrorType::ChatbotMessageSuggestError,
            "Failed to create context for message suggestion LLM, there were no conversation messages or none of them fit into the context.",
            None,
        ))?;
    // cut off messages older than order_n from the conversation to keep context short
    let conversation = &conversation_messages[order_n..]
        .iter()
        .map(create_msg_string)
        .collect::<Vec<String>>()
        .join("");
    if conversation.trim().is_empty() {
        // this happens only if the conversation contains only ChatbotConversationMessages
        // that have no message property, which should never happen in practice
        return Err(ChatbotError::new(
            ChatbotErrorType::ChatbotMessageSuggestError,
            "Failed to create context for message suggestion LLM, there were no conversation messages or no content in any messages. There should be some messages before messages are suggested.",
            None,
        ));
    };

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

    let params = if task_lm.thinking {
        LLMRequestParams::Thinking(ThinkingParams {
            max_completion_tokens: None,
            verbosity: None,
            reasoning_effort: None,
            tools: vec![],
            tool_choice: None,
        })
    } else {
        LLMRequestParams::NonThinking(NonThinkingParams {
            max_tokens: None,
            temperature: None,
            top_p: None,
            frequency_penalty: None,
            presence_penalty: None,
        })
    };

    let chat_request = LLMRequest {
        messages: vec![system_prompt, user_prompt],
        data_sources: vec![],
        params,
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
        Some("/chat/suggestions".to_string())
    } else {
        // if it's not test mode, the default, actual endpoint is used
        None
    };
    let completion =
        make_blocking_llm_request(chat_request, app_config, &task_lm, endpoint_path).await?;

    // parse chat completion
    let completion_content: &String = &completion
        .choices
        .into_iter()
        .map(|x| match x.message.fields {
            APIMessageKind::Text(message) => message.content,
            _ => "".to_string(),
        })
        .collect::<Vec<String>>()
        .join("");
    // parse structured output
    let suggestions: ChatbotNextMessageSuggestionResponse =
        serde_json::from_str(completion_content).map_err(|_| {
            ChatbotError::new(
                ChatbotErrorType::ChatbotMessageSuggestError,
                "The message suggestion LLM returned an incorrectly formatted response."
                    .to_string(),
                None,
            )
        })?;

    Ok(suggestions.suggestions)
}

fn create_msg_string(m: &ChatbotConversationMessage) -> String {
    match m.message_role {
        MessageRole::User => {
            if let Some(msg) = &m.message {
                format!("Student said:\n {msg}\n\n")
            } else {
                "".to_string()
            }
        }
        MessageRole::Assistant => {
            if let Some(msg) = &m.message {
                format!("Assistant said:\n {msg}\n\n")
            } else {
                "".to_string()
            }
        }
        MessageRole::Tool => {
            if let Some(output) = &m.tool_output {
                format!("Tool {}: {}\n\n", output.tool_name, output.tool_output)
            } else {
                "".to_string()
            }
        }
        MessageRole::System => "".to_string(),
    }
}
