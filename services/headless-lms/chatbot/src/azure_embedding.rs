use crate::prelude::*;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_utils::http::REQWEST_CLIENT;
use secrecy::ExposeSecret;

const API_VERSION: &str = "2024-07-01";

use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct EmbeddingRequest {
    model: String,
    input: String,
}

#[derive(Deserialize)]
struct EmbeddingResponse {
    data: Vec<Embedding>,
}

#[derive(Deserialize)]
struct Embedding {
    embedding: Vec<f32>,
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

    let api_endpoint = chatbot_config.embeddings_endpoint()?;
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
    let json: EmbeddingResponse = serde_json::from_str(&response.text().await?)?;
    let embedding = json.data.first().unwrap().embedding.to_owned();
    debug!("LENGTH: {}", embedding.len());
    Ok(())
}
