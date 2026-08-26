use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{
    application_task_default_language_models::TaskLMSpec,
    chatbot_configurations::ChatbotConfiguration,
};

use crate::{
    azure_chatbot::azure::protocol::{LLMRequestParams, NonThinkingParams, ThinkingParams},
    llm_utils::model_is_thinking,
    prelude::ChatbotResult,
};

/// Create a prompt and an initial message for a chatbot configuration
pub async fn generate_prompt(
    app_config: &ApplicationConfiguration,
    task_lm: TaskLMSpec,
    chatbot_config: &ChatbotConfiguration,
) -> ChatbotResult<()> {
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

    Ok(())
}
