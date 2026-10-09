use crate::{
    azure_chatbot::azure::protocol::{
        InputItem, LLMRequestParams, LLMRequestResponseFormatParam, NonThinkingParams, Reasoning,
        ThinkingParams,
    },
    chatbot_error::chatbot_err,
    llm_utils::{APIInputMessage, MessageContent, model_is_thinking, request_structured_json},
    prelude::*,
};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::{
    application_task_default_language_models::TaskLMSpec,
    chatbot_configurations::ReasoningEffortLevel,
    chatbot_conversation_message_messages::MessageRole, feedback::NewFeedback,
    feedback_categories::FeedbackCategory,
};
use headless_lms_utils::json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType};
use indexmap::IndexMap;

/// Shape of the structured LLM output response, defined by the JSONSchema in
/// [response_format]
#[derive(serde::Deserialize)]
pub struct FeedbackCategorisationResponse {
    pub category_name: String,
}

// Maximum length in chars
pub const MAX_CATEGORY_NAME_LEN: usize = 255;

/// Names this feature's structured output to Azure. The test-mode mock Azure API picks its canned
/// answer for this feature by this name.
pub const RESPONSE_FORMAT_NAME: &str = "FeedbackCategorisationResponse";

/// The structured output format the suggestion LLM is asked to answer in. Must stay in
/// sync with [FeedbackCategorisationResponse].
fn response_format() -> LLMRequestResponseFormatParam {
    LLMRequestResponseFormatParam::JsonSchema {
        name: "FeedbackCategorisationResponse".to_string(),
        schema: Schema::strict_object(
            IndexMap::from([(
                "category_name".to_string(),
                SchemaPropertyType::Item(JsonItem {
                    type_field: JSONType::String,
                    description: None,
                }),
            )]),
            None,
        ),
        strict: true,
    }
}

fn format_category_list(categories: &[FeedbackCategory]) -> String {
    let c = categories
        .iter()
        .map(|c| c.name.to_owned())
        .collect::<Vec<String>>()
        .join(",");
    format!("[{c}]")
}

fn format_feedback(feedback: &NewFeedback) -> String {
    let start = "\n\nThe feedback to categorize: \n<START>\n".to_string();
    let end = "\n<END>";
    let selected_text = feedback.selected_text.as_ref().map_or("".to_string(), |s| {
        format!("\n\nAssociated course material text: {s}\n")
    });

    start
        + &feedback
            .feedback_given
            .replace("<END>", "")
            .replace("<START>", "")
        + end
        + &selected_text
}

/// System prompt instructions for generating suggested next messages
const SYSTEM_PROMPT: &str = r#"You are an expert text categorisation system. You are given written feedback submitted by a student who is completing a course, and a set of possible categories. Analyse the feedback and label it with one of the categories. If none of the categories fit, create a new category.

Allowed response types:
- Assign feedback into an existing category
- Create a new category and assign the feedback to it

When assigning to an existing category, return the category's name exactly as it is. The existing category names are given below. When creating a new category, return the proposed new category name. In both cases, only the category name should be returned: whether it is listed below or not indicates is it an existing category or a new one.

Constraints:
- analyse the meaning and context of the feedback
- don't focus on specific details too much
- understand the intention behind the feedback and what problem it is really aiming to convey
- compare the feedback to the existing categories: could it fit into one of them?
- be conservative when adding new cateogries. If the feedback could be assigned to an existing one, do so instead of creating a new category for it.

New category constraints:
- the name should be as short and concise as possible
- the name should be only adequately descriptive: based on it, one should be able to understand what kind of feedback the category contains
- the name must not be overly specific: it should give a reasonable clue about the category's content, but not describe it with detail
- the name should describe the general type of feedback in that category and not be based on any specific details in the feedback. For example, instead of "Confusion about the topic in chapter 4" try "Material comprehension difficulties"
- the name should fit in with the existing categories, i.e. follow the same naming logic
- the name should use normal, correct language

Currently existing categories:

"#;

// todo: truncate long category names
pub async fn categorize_feedback(
    app_config: &ApplicationConfiguration,
    task_lm: &TaskLMSpec,
    feedback: &NewFeedback,
    categories: &[FeedbackCategory],
) -> ChatbotResult<FeedbackCategorisationResponse> {
    let prompt = SYSTEM_PROMPT.to_string() + &format_category_list(categories);
    let input = vec![
        APIInputMessage {
            message_type: InputItem::Message {
                role: MessageRole::System,
                content: MessageContent::Text(prompt),
            },
        },
        APIInputMessage {
            message_type: InputItem::Message {
                role: MessageRole::User,
                content: MessageContent::Text(format_feedback(feedback)),
            },
        },
    ];
    let (params, max_output_tokens) = if model_is_thinking(task_lm.model_type) {
        (
            LLMRequestParams::GPTThinking(ThinkingParams {
                reasoning: Some(Reasoning {
                    effort: ReasoningEffortLevel::Low,
                    summary: None,
                    context: None,
                }),
            }),
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
    let res: FeedbackCategorisationResponse = request_structured_json(
        input,
        task_lm.model.to_owned(),
        params,
        max_output_tokens,
        response_format(),
        app_config,
        || {
            chatbot_err!(
                FailedAzureResponse,
                "Invalidly structured response from Azure"
            )
        },
    )
    .await?;

    // truncate if too long
    if res.category_name.chars().count() > MAX_CATEGORY_NAME_LEN {
        let category_name = res
            .category_name
            .chars()
            .take(MAX_CATEGORY_NAME_LEN)
            .collect::<String>();
        Ok(FeedbackCategorisationResponse { category_name })
    } else {
        Ok(res)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The test-mode mock Azure API picks this feature's canned answer by the format name, so the
    /// name is pinned even though the shape it wraps is shared.
    #[test]
    fn the_response_format_is_named_after_this_feature() {
        let serialized =
            serde_json::to_value(response_format()).expect("The response format serializes");
        assert_eq!(
            serialized["name"],
            serde_json::json!("FeedbackCategorisationResponse")
        );
    }
}
