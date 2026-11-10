//! Which chatbot configuration answers on course design plan pages.

use headless_lms_models::chatbot_configurations::{
    self, ChatbotConfiguration, NewChatbotConf, ToolCategory,
};
use headless_lms_models::chatbot_configurations_models;

use crate::prelude::*;

const FALLBACK_PROMPT: &str = "You help a team design a MOOC (massive open online course) with their course design plan. Give practical, specific feedback grounded in the plan and in established online course design practice, such as the ADDIE process, clear learning goals, a must/should/nice-to-know split of core content, multimodal content, accessibility and realistic student workload. Keep answers brief.";

const FALLBACK_INITIAL_MESSAGE: &str = "Hi! I can review your plan, answer questions about MOOC design and suggest changes for you to apply.";

/// The course design assistant's configuration: the one flagged on a guide course, or else a
/// built-in one created on first use that has plan tools but no guide course to search.
pub async fn get_or_create_assistant_configuration(
    conn: &mut PgConnection,
) -> ChatbotResult<ChatbotConfiguration> {
    if let Some(configuration) = chatbot_configurations::get_course_designer_assistant(conn).await?
    {
        return Ok(configuration);
    }
    let model = chatbot_configurations_models::get_default(conn).await?;
    let configuration = chatbot_configurations::insert_course_designer_assistant_if_missing(
        conn,
        NewChatbotConf {
            course_id: None,
            chatbot_name: "Course design assistant".to_string(),
            model_id: model.id,
            prompt: FALLBACK_PROMPT.to_string(),
            initial_message: FALLBACK_INITIAL_MESSAGE.to_string(),
            use_azure_search: false,
            maintain_azure_search_index: false,
            enabled_tool_categories: vec![ToolCategory::CoursePlanning],
            suggest_next_messages: false,
            ..Default::default()
        },
    )
    .await?;
    Ok(configuration)
}
