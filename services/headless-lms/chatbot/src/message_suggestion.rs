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
use headless_lms_models::{
    application_task_default_language_models::TaskLMSpec,
    chatbot_conversation_messages::{ChatbotConversationMessage, MessageRole},
};
use headless_lms_utils::{ApplicationConfiguration, prelude::BackendError};
use rand::seq::IndexedRandom;

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
pub const USER_PROMPT: &str = r#"Suggest exactly three messages that the user could send next."#;

/// Calls an LLM and generates suggested messages for a chatbot conversation
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
            let mut rng = rand::rng();
            let examples = ism.choose_multiple(&mut rng, 5).cloned().collect::<Vec<String>>().join(" ");
            format!("Example suggested messages: {}\n\n", examples)} else {"".to_string()})
        + &(if let Some(c_d) = course_desc {format!("Description for course: {}\n\n", c_d)} else {"".to_string()})
        + "The conversation so far:\n";

    let used_tokens = estimate_tokens(&prompt) + estimate_tokens(USER_PROMPT);
    let token_budget =
        calculate_safe_token_limit(task_lm.context_size, task_lm.context_utilization);

    let conversation =
        &create_conversation_from_msgs(conversation_messages, used_tokens, token_budget)?;

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

    let completion = make_blocking_llm_request(chat_request, app_config, &task_lm).await?;

    let completion_content: &String = &parse_text_completion(completion)?;
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

/// Take ChatbotConversationMessages from a list until no more fit into the token budget.
/// Transcribe the conversation's messages' content into a string.
fn create_conversation_from_msgs(
    conversation_messages: &[ChatbotConversationMessage],
    mut used_tokens: i32,
    token_budget: i32,
) -> ChatbotResult<String> {
    conversation_messages
        .to_vec()
        .sort_by_key(|el| el.order_number);
    let conv_len = conversation_messages.len();
    // calculate how many messages to include in the conversation context
    let cutoff = conversation_messages
        .iter()
        .enumerate()
        // we want to take messages starting from the newest (=last)
        .rev()
        .map_while(|(idx, el)| {
            if el.message.is_some() {
                // add this message's tokens and extra 5 tokens for newline and
                // tag to used_tokens
                used_tokens += el.used_tokens + 5;
            } else if let Some(output) = &el.tool_output {
                // add the tokens needed for the tool info to used_tokens
                let s = format!("{}:\n{}\n\n", output.tool_name, output.tool_output);
                used_tokens += estimate_tokens(&s);
            } else {
                // if there is no message or tool output, skip this element.
                // putting in conv_len won't affect the truncation later as we take min.
                return Some(conv_len);
            }
            if used_tokens > token_budget {
                return None;
            }
            // include this element's index as a potential cutoff point
            Some(idx)
        })
        // select the minimum index i.e. oldest message to include
        .min()
        .ok_or(ChatbotError::new(
            ChatbotErrorType::ChatbotMessageSuggestError,
            "Failed to create context for message suggestion LLM, there were no conversation messages or none of them fit into the context.",
            None,
        ))?;
    // cut off messages older than order_n from the conversation to keep context short
    let conversation = conversation_messages[cutoff..]
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

    Ok(conversation)
}

fn create_msg_string(m: &ChatbotConversationMessage) -> String {
    match m.message_role {
        MessageRole::User => {
            if let Some(message) = &m.message {
                format!("Student:\n{message}\n\n")
            } else {
                "".to_string()
            }
        }
        MessageRole::Assistant => {
            if let Some(message) = &m.message {
                format!("Assistant:\n{message}\n\n")
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

#[cfg(test)]
mod tests {
    use super::*;

    fn get_msgs() -> Vec<ChatbotConversationMessage> {
        vec![ChatbotConversationMessage {
            order_number: 0,
            message_role: MessageRole::System,
            message: Some("You are a helpful assistant.".to_string()),
            used_tokens: 6,
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 0,
            message_role: MessageRole::Assistant,
            message: Some("Hello! What can I help you with?".to_string()),
            used_tokens: 9,
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 1,
            message_role: MessageRole::User,
            message: Some("Hi, I’m stuck on solving quadratic equations. I don’t really get when to factor and when to use the quadratic formula.".to_string()),
            used_tokens: 26,
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 2,
            message_role: MessageRole::Assistant,
            message: Some("No worries — that’s a super common question 😊
Let’s start simple: do you remember the standard form of a quadratic equation?".to_string()),
            used_tokens: 27,
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 3,
            message_role: MessageRole::User,
            message: Some("Is it something like ax² + bx + c = 0?".to_string()),
            used_tokens: 14,
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 4,
            message_role: MessageRole::Assistant,
            message: Some("Exactly! Great start.
Now, factoring works best when the numbers are “nice” — meaning you can easily find two numbers that multiply to ac and add to b.

The quadratic formula works every time, but it can be more work.

Let’s try this one:
x² + 5x + 6 = 0

Would you like to try factoring it?".to_string()),
            used_tokens: 79,
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 5,
            message_role: MessageRole::User,
            message: Some("Okay… I need two numbers that multiply to 6 and add to 5. So 2 and 3?".to_string()),
            used_tokens: 24,
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 6,
            message_role: MessageRole::Assistant,
            message: Some("Perfect! 🎯

So we rewrite it as:
(x + 2)(x + 3) = 0

Now what do we do?".to_string()),
            used_tokens: 56,
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 7,
            message_role: MessageRole::User,
            message: Some("Set each part equal to zero?
x + 2 = 0 and x + 3 = 0?".to_string()),
            used_tokens: 23,
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 8,
            message_role: MessageRole::Assistant,
            message: Some("Yes!

So your solutions are:
x = -2
x = -3

See how clean that was? That’s when factoring is ideal.

Now let’s try one that’s harder:
2x² + 3x + 1 = 0

Do you want to try factoring again, or use the quadratic formula?".to_string()),
            used_tokens: 67,
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 9,
            message_role: MessageRole::User,
            message: Some("Factoring looks harder with the 2 in front… maybe quadratic formula?".to_string()),
            used_tokens: 15,
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 10,
            message_role: MessageRole::Assistant,
            message: Some("Good instinct. When a ≠ 1, the quadratic formula is often safer.

The formula is:

x = (-b ± √(b² - 4ac)) / 2a

For this equation:
a = 2
b = 3
c = 1

First step: calculate the discriminant (b² - 4ac). Want to try that?".to_string()),
            used_tokens: 80,
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 11,
            message_role: MessageRole::User,
            message: Some("Okay
3² - 4(2)(1)
= 9 - 8
= 1".to_string()),
            used_tokens: 22,
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 12,
            message_role: MessageRole::Assistant,
            message: Some("Excellent!

Now plug it into the formula:

x = (-3 ± √1) / 4

Since √1 = 1, what are the two answers?".to_string()),
            used_tokens: 34,
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 13,
            message_role: MessageRole::User,
            message: Some("(-3 + 1)/4 = -2/4 = -1/2
(-3 - 1)/4 = -4/4 = -1".to_string()),
            used_tokens: 33,
            ..Default::default()
        },
                ChatbotConversationMessage {
            order_number: 14,
            message_role: MessageRole::Assistant,
            message: Some("YES 👏

So your solutions are:
x = -1/2
x = -1

You handled that really well.

Quick check:
When would you choose factoring over the quadratic formula?".to_string()),
            used_tokens: 40,
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 15,
            message_role: MessageRole::User,
            message: Some("If the numbers are simple and easy to factor. Otherwise use the formula since it always works.".to_string()),
            used_tokens: 19,
            ..Default::default()
        },
                ChatbotConversationMessage {
            order_number: 16,
            message_role: MessageRole::Assistant,
            message: Some("Exactly right. You’ve got it!

Want to try a challenge problem next time with completing the square?".to_string()),
            used_tokens: 21,
            ..Default::default()
        },
        ]
    }

    #[test]
    fn create_context_it_fits() {
        let used_tokens = 2000;
        let token_budget = 3000;
        let conv_msgs = get_msgs();

        let convo = create_conversation_from_msgs(&conv_msgs, used_tokens, token_budget)
            .expect("Creating conversation string failed!");

        let expected_string = r#"Assistant:
Hello! What can I help you with?

Student:
Hi, I’m stuck on solving quadratic equations. I don’t really get when to factor and when to use the quadratic formula.

Assistant:
No worries — that’s a super common question 😊
Let’s start simple: do you remember the standard form of a quadratic equation?

Student:
Is it something like ax² + bx + c = 0?

Assistant:
Exactly! Great start.
Now, factoring works best when the numbers are “nice” — meaning you can easily find two numbers that multiply to ac and add to b.

The quadratic formula works every time, but it can be more work.

Let’s try this one:
x² + 5x + 6 = 0

Would you like to try factoring it?

Student:
Okay… I need two numbers that multiply to 6 and add to 5. So 2 and 3?

Assistant:
Perfect! 🎯

So we rewrite it as:
(x + 2)(x + 3) = 0

Now what do we do?

Student:
Set each part equal to zero?
x + 2 = 0 and x + 3 = 0?

Assistant:
Yes!

So your solutions are:
x = -2
x = -3

See how clean that was? That’s when factoring is ideal.

Now let’s try one that’s harder:
2x² + 3x + 1 = 0

Do you want to try factoring again, or use the quadratic formula?

Student:
Factoring looks harder with the 2 in front… maybe quadratic formula?

Assistant:
Good instinct. When a ≠ 1, the quadratic formula is often safer.

The formula is:

x = (-b ± √(b² - 4ac)) / 2a

For this equation:
a = 2
b = 3
c = 1

First step: calculate the discriminant (b² - 4ac). Want to try that?

Student:
Okay
3² - 4(2)(1)
= 9 - 8
= 1

Assistant:
Excellent!

Now plug it into the formula:

x = (-3 ± √1) / 4

Since √1 = 1, what are the two answers?

Student:
(-3 + 1)/4 = -2/4 = -1/2
(-3 - 1)/4 = -4/4 = -1

Assistant:
YES 👏

So your solutions are:
x = -1/2
x = -1

You handled that really well.

Quick check:
When would you choose factoring over the quadratic formula?

Student:
If the numbers are simple and easy to factor. Otherwise use the formula since it always works.

Assistant:
Exactly right. You’ve got it!

Want to try a challenge problem next time with completing the square?

"#.to_string();

        assert_eq!(convo, expected_string);
    }

    #[test]
    fn create_context_it_wont_fit() {
        let used_tokens = 2000;
        let token_budget = 2300;
        let conv_msgs = get_msgs();

        let convo = create_conversation_from_msgs(&conv_msgs, used_tokens, token_budget)
            .expect("Creating conversation string failed!");

        let expected_string = r#"Assistant:
Good instinct. When a ≠ 1, the quadratic formula is often safer.

The formula is:

x = (-b ± √(b² - 4ac)) / 2a

For this equation:
a = 2
b = 3
c = 1

First step: calculate the discriminant (b² - 4ac). Want to try that?

Student:
Okay
3² - 4(2)(1)
= 9 - 8
= 1

Assistant:
Excellent!

Now plug it into the formula:

x = (-3 ± √1) / 4

Since √1 = 1, what are the two answers?

Student:
(-3 + 1)/4 = -2/4 = -1/2
(-3 - 1)/4 = -4/4 = -1

Assistant:
YES 👏

So your solutions are:
x = -1/2
x = -1

You handled that really well.

Quick check:
When would you choose factoring over the quadratic formula?

Student:
If the numbers are simple and easy to factor. Otherwise use the formula since it always works.

Assistant:
Exactly right. You’ve got it!

Want to try a challenge problem next time with completing the square?

"#
        .to_string();
        assert_eq!(convo, expected_string);
    }
}
