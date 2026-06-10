use std::collections::HashMap;

use crate::{
    azure_chatbot::{
        ArrayItem, ArrayProperty, InputItem, JSONType, LLMRequest, LLMRequestParams,
        LLMRequestResponseFormatParam, NonThinkingParams, RequestTextOptions, Schema,
        SchemaPropertyType, ThinkingParams,
    },
    chatbot_error::chatbot_err,
    content_cleaner::calculate_safe_token_limit,
    llm_utils::{
        APIInputMessage, MessageContent, estimate_tokens, make_blocking_llm_request,
        model_is_thinking, parse_text_completion,
    },
    prelude::{ChatbotError, ChatbotErrorType, ChatbotResult},
};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::{
    application_task_default_language_models::TaskLMSpec,
    chatbot_conversation_message_messages::MessageRole,
    chatbot_conversation_messages::{ChatbotConversationMessage, Message},
};
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
            let examples = ism
                .sample(&mut rng, 5)
                .cloned()
                .collect::<Vec<String>>()
                .join(" ");
            format!("Example suggested messages: {}\n\n", examples)} else {"".to_string()})
        + &(if let Some(c_d) = course_desc {format!("Description for course: {}\n\n", c_d)} else {"".to_string()})
        + "The conversation so far:\n";

    let used_tokens = estimate_tokens(&prompt) + estimate_tokens(USER_PROMPT);
    let token_budget =
        calculate_safe_token_limit(task_lm.context_size, task_lm.context_utilization);

    let conversation =
        &create_conversation_from_msgs(conversation_messages, used_tokens, token_budget)?;

    let system_prompt = APIInputMessage {
        message_type: InputItem::Message {
            role: MessageRole::System,
            content: MessageContent::Text(prompt + conversation),
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
                name: "ChatbotNextMessageSuggestionResponse".to_string(),
                schema: Schema {
                    type_field: JSONType::Object,
                    properties: HashMap::from([(
                        "suggestions".to_string(),
                        SchemaPropertyType::ArrayProperty(ArrayProperty {
                            type_field: JSONType::Array,
                            items: ArrayItem {
                                type_field: JSONType::String,
                            },
                        }),
                    )]),
                    required: Vec::from(["suggestions".to_string()]),
                    additional_properties: false,
                },
                strict: true,
            }),
        }),
    };

    let completion = make_blocking_llm_request(chat_request, app_config).await?;

    let completion_content: &String = &parse_text_completion(completion)?;
    let suggestions: ChatbotNextMessageSuggestionResponse =
        serde_json::from_str(completion_content).map_err(|_| {
            chatbot_err!(
                ChatbotMessageSuggestError,
                "The message suggestion LLM returned an incorrectly formatted response."
                    .to_string()
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
    // todo empty messages?
    let mut sorted_conversation_messages = conversation_messages.to_vec();
    sorted_conversation_messages.sort_by_key(|el| el.order_number);
    let conversation: Vec<ChatbotConversationMessage> = sorted_conversation_messages
        .iter()
        .filter_map(|el| match &el.message {
            Message::Text(_) => Some(el.to_owned()),
            _ => None,
        })
        .collect();

    let conv_len = conversation.len();
    // calculate how many messages to include in the conversation context
    let cutoff = conversation
        .iter()
        .enumerate()
        // we want to take messages starting from the newest (=last)
        .rev()
        .map_while(|(idx, el)| {
            match el.message.to_owned()  {
                Message::Text(msg) => {
                // add this message's tokens and extra 5 tokens for newline and
                // tag to used_tokens
                used_tokens += msg.used_tokens + 5;}
                Message::ToolOutput(o) => {
                // add the tokens needed for the tool info to used_tokens
                let s = format!("Output:\n{}\n\n", o.output); // todo: which tool call was it
                used_tokens += estimate_tokens(&s);
                }
                _ => {
                    // if there is no message or tool output, skip this element.
                    // putting in conv_len won't affect the truncation later as we take min.
                    return Some(conv_len);
                }
            }

            if used_tokens > token_budget {
                return None;
            }
            // include this element's index as a potential cutoff point
            Some(idx)
        })
        // select the minimum index i.e. oldest message to include
        .min()
        .ok_or(chatbot_err!(
            ChatbotMessageSuggestError,
            "Failed to create context for message suggestion LLM, there were no conversation messages or none of them fit into the context."
        ))?;
    // cut off messages older than order_n from the conversation to keep context short
    let conversation = conversation[cutoff..]
        .iter()
        .map(create_msg_string)
        .collect::<Vec<String>>()
        .join("");
    if conversation.trim().is_empty() {
        // this happens only if the conversation contains only ChatbotConversationMessages
        // that have no message property, which should never happen in practice
        return Err(chatbot_err!(
            ChatbotMessageSuggestError,
            "Failed to create context for message suggestion LLM, there were no conversation messages or no content in any messages. There should be some messages before messages are suggested."
        ));
    };

    Ok(conversation)
}

fn create_msg_string(m: &ChatbotConversationMessage) -> String {
    match m.message.to_owned() {
        Message::Text(text_message) => {
            match text_message.message_role {
                MessageRole::Assistant => {
                    format!("Assistant:\n{}\n\n", text_message.text)
                }
                MessageRole::User => {
                    format!("Student:\n{}\n\n", text_message.text)
                }
                _ => "".to_string(), //todo error?
            }
        }
        Message::ToolCall(tool_call) => {
            format!(
                "Tool call: Name: {} Arguments: {}\n\n",
                tool_call.tool_name, tool_call.tool_arguments
            )
        }
        Message::ToolOutput(tool_output) => {
            format!("Tool output: {}\n\n", tool_output.output) // todo: get the tool name
        }
        Message::Reasoning(..) => "".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use headless_lms_models::chatbot_conversation_message_messages::ChatbotConversationMessageMessage;

    use super::*;

    fn get_msgs() -> Vec<ChatbotConversationMessage> {
        vec![ChatbotConversationMessage {
            order_number: 0,
            message: Message::Text(ChatbotConversationMessageMessage {
                message_role: MessageRole::System,
                text: "You are a helpful assistant.".to_string(),
                used_tokens: 6,
                ..Default::default()
            }),
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 0,
            message: Message::Text(ChatbotConversationMessageMessage {
            message_role: MessageRole::Assistant,
            text: "Hello! What can I help you with?".to_string(),
            used_tokens: 9,
        ..Default::default()}),
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 1,
                        message: Message::Text(ChatbotConversationMessageMessage {
            message_role: MessageRole::User,

            text: "Hi, I’m stuck on solving quadratic equations. I don’t really get when to factor and when to use the quadratic formula.".to_string(),
            used_tokens: 26,
            ..Default::default()}),
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 2,
                        message: Message::Text(ChatbotConversationMessageMessage {

            message_role: MessageRole::Assistant,
            text: "No worries — that’s a super common question 😊
Let’s start simple: do you remember the standard form of a quadratic equation?".to_string(),
            used_tokens: 27,
            ..Default::default()}),
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 3,
                        message: Message::Text(ChatbotConversationMessageMessage {

            message_role: MessageRole::User,
            text: "Is it something like ax² + bx + c = 0?".to_string(),
            used_tokens: 14,
            ..Default::default()}),
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 4,
                        message: Message::Text(ChatbotConversationMessageMessage {

            message_role: MessageRole::Assistant,
            text: "Exactly! Great start.
Now, factoring works best when the numbers are “nice” — meaning you can easily find two numbers that multiply to ac and add to b.

The quadratic formula works every time, but it can be more work.

Let’s try this one:
x² + 5x + 6 = 0

Would you like to try factoring it?".to_string(),
            used_tokens: 79,
            ..Default::default()}),
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 5,
                        message: Message::Text(ChatbotConversationMessageMessage {

            message_role: MessageRole::User,
            text: "Okay… I need two numbers that multiply to 6 and add to 5. So 2 and 3?".to_string(),
            used_tokens: 24,
            ..Default::default()}),
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 6,
                        message: Message::Text(ChatbotConversationMessageMessage {

            message_role: MessageRole::Assistant,
            text: "Perfect! 🎯

So we rewrite it as:
(x + 2)(x + 3) = 0

Now what do we do?".to_string(),
            used_tokens: 56,
            ..Default::default()}),
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 7,
                        message: Message::Text(ChatbotConversationMessageMessage {

            message_role: MessageRole::User,
            text: "Set each part equal to zero?
x + 2 = 0 and x + 3 = 0?".to_string(),
            used_tokens: 23,
            ..Default::default()}),
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 8,
                        message: Message::Text(ChatbotConversationMessageMessage {

            message_role: MessageRole::Assistant,
            text: "Yes!

So your solutions are:
x = -2
x = -3

See how clean that was? That’s when factoring is ideal.

Now let’s try one that’s harder:
2x² + 3x + 1 = 0

Do you want to try factoring again, or use the quadratic formula?".to_string(),
            used_tokens: 67,
            ..Default::default()}),
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 9,
                        message: Message::Text(ChatbotConversationMessageMessage {

            message_role: MessageRole::User,
            text: "Factoring looks harder with the 2 in front… maybe quadratic formula?".to_string(),
            used_tokens: 15,
            ..Default::default()}),
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 10,
                        message: Message::Text(ChatbotConversationMessageMessage {

            message_role: MessageRole::Assistant,
            text: "Good instinct. When a ≠ 1, the quadratic formula is often safer.

The formula is:

x = (-b ± √(b² - 4ac)) / 2a

For this equation:
a = 2
b = 3
c = 1

First step: calculate the discriminant (b² - 4ac). Want to try that?".to_string(),
            used_tokens: 80,
            ..Default::default()}),
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 11,
                        message: Message::Text(ChatbotConversationMessageMessage {

            message_role: MessageRole::User,
            text: "Okay
3² - 4(2)(1)
= 9 - 8
= 1".to_string(),
            used_tokens: 22,
            ..Default::default()}),
            ..Default::default()

        },
        ChatbotConversationMessage {
            order_number: 12,
                        message: Message::Text(ChatbotConversationMessageMessage {

            message_role: MessageRole::Assistant,
            text: "Excellent!

Now plug it into the formula:

x = (-3 ± √1) / 4

Since √1 = 1, what are the two answers?".to_string(),
            used_tokens: 34,
            ..Default::default()}),
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 13,
                        message: Message::Text(ChatbotConversationMessageMessage {

            message_role: MessageRole::User,
            text: "(-3 + 1)/4 = -2/4 = -1/2
(-3 - 1)/4 = -4/4 = -1".to_string(),
            used_tokens: 33,
            ..Default::default()}),
            ..Default::default()
        },
                ChatbotConversationMessage {
            order_number: 14,
                        message: Message::Text(ChatbotConversationMessageMessage {

            message_role: MessageRole::Assistant,
            text: "YES 👏

So your solutions are:
x = -1/2
x = -1

You handled that really well.

Quick check:
When would you choose factoring over the quadratic formula?".to_string(),
            used_tokens: 40,
            ..Default::default()}),
            ..Default::default()
        },
        ChatbotConversationMessage {
            order_number: 15,
                        message: Message::Text(ChatbotConversationMessageMessage {

            message_role: MessageRole::User,
            text: "If the numbers are simple and easy to factor. Otherwise use the formula since it always works.".to_string(),
            used_tokens: 19,
            ..Default::default()}),
            ..Default::default()
        },
                ChatbotConversationMessage {
            order_number: 16,
                        message: Message::Text(ChatbotConversationMessageMessage {

            message_role: MessageRole::Assistant,
            text: "Exactly right. You’ve got it!

Want to try a challenge problem next time with completing the square?".to_string(),
            used_tokens: 21,
            ..Default::default()}),
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
