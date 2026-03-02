use headless_lms_models::{
    application_task_default_language_models::{
        self, ApplicationTask, ApplicationTaskDefaultLanguageModel,
    },
    chatbot_configurations_models::{self, NewChatbotConfigurationModel},
};

use crate::prelude::*;

pub struct SeedApplicationLLMsResult {
    pub llm_default_model_id: Uuid,
    pub llm_default_model_thinking: bool,
}

pub async fn seed_application_task_llms(
    db_pool: PgPool,
) -> anyhow::Result<SeedApplicationLLMsResult> {
    let mut conn = db_pool.acquire().await?;

    let llm = chatbot_configurations_models::insert(
        &mut conn,
        NewChatbotConfigurationModel {
            id: Uuid::parse_str("f14d70bd-c228-4447-bddd-4f6f66705356")?,
            model: "mock-gpt".to_string(),
            thinking: false,
            default_model: true,
            deployment_name: "mock-gpt".to_string(),
            context_size: 10000,
        },
    )
    .await?;

    application_task_default_language_models::insert(
        &mut conn,
        ApplicationTaskDefaultLanguageModel {
            model_id: llm.id,
            task: ApplicationTask::ContentCleaning,
            context_utilization: 0.75,
            ..Default::default()
        },
    )
    .await?;

    application_task_default_language_models::insert(
        &mut conn,
        ApplicationTaskDefaultLanguageModel {
            model_id: llm.id,
            task: ApplicationTask::MessageSuggestion,
            context_utilization: 0.75,
            ..Default::default()
        },
    )
    .await?;

    Ok(SeedApplicationLLMsResult {
        llm_default_model_id: llm.id,
        llm_default_model_thinking: llm.thinking,
    })
}
