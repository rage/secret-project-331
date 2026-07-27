use std::env;

use crate::prelude::*;
use azure_core::request_options::App;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_conversation_message_reasoning::ChatbotConversationMessageReasoning;
use headless_lms_utils::http::REQWEST_CLIENT;
use secrecy::ExposeSecret;
use url::Url;

const API_VERSION: &str = "2024-07-01";

use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct EmbeddingRequest {
    model: String,
    input: String,
}

#[derive(Deserialize)]
struct EmbeddingData {
    embedding: Vec<f32>,
}

#[derive(Deserialize)]
struct EmbeddingResponse {
    data: Vec<EmbeddingData>,
}

pub async fn create_embedding(
    input: String,
    app_config: &ApplicationConfiguration,
) -> ChatbotResult<()> {
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        chatbot_err!(
            AzureRequestBuildError,
            "Azure configuration is missing from the application configuration"
        )
    })?;

    let chatbot_config = azure_config.chatbot_config.as_ref().ok_or_else(|| {
        error!("Chatbot configuration missing");
        chatbot_err!(
            AzureRequestBuildError,
            "Chatbot configuration is missing from the Azure configuration"
        )
    })?;
    let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
        chatbot_err!(
            AzureRequestBuildError,
            "Azure search configuration is missing from the Azure configuration"
        )
    })?;
    let api_endpoint_str = env::var("AZURE_CHATBOT_API_ENDPOINT").ok().unwrap();

    let api_endpoint = Url::parse(api_endpoint_str.as_str())?
        .join("openai/v1/embeddings")
        .unwrap();
    dbg!(format!("HERE IS URL!!!!!: {api_endpoint}"));
    let input_json = serde_json::to_string(&input)?;

    let response = REQWEST_CLIENT
        .post(api_endpoint)
        .header("Content-Type", "application/json")
        .header("api-key", chatbot_config.api_key.expose_secret())
        .json(&EmbeddingRequest {
            model: search_config.vectorizer_model_name.to_owned(),
            input: input_json,
        })
        .send()
        .await?;
    dbg!(response);
    Ok(())
}
