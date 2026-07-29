use crate::http::REQWEST_CLIENT;
use crate::prelude::*;
use headless_lms_base::config::ApplicationConfiguration;
use secrecy::ExposeSecret;

use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct EmbeddingRequest {
    model: String,
    input: Vec<String>,
}

#[derive(Deserialize)]
struct EmbeddingResponse {
    data: Vec<Embedding>,
}

#[derive(Deserialize)]
struct Embedding {
    embedding: Vec<f32>,
}

pub async fn create_embeddings(
    input: Vec<String>,
    app_config: &ApplicationConfiguration,
) -> UtilResult<Vec<Vec<f32>>> {
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        util_err!(
            EmbeddingRequestBuildError,
            "Azure configuration is missing from the application configuration"
        )
    })?;

    let chatbot_config = azure_config.chatbot_config.as_ref().ok_or_else(|| {
        error!("Chatbot configuration missing");
        util_err!(
            EmbeddingRequestBuildError,
            "Chatbot configuration is missing from the Azure configuration"
        )
    })?;
    let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
        util_err!(
            EmbeddingRequestBuildError,
            "Azure search configuration is missing from the Azure configuration"
        )
    })?;

    let api_endpoint = chatbot_config.embeddings_endpoint()?;
    let response = REQWEST_CLIENT
        .post(api_endpoint)
        .header("Content-Type", "application/json")
        .header("api-key", chatbot_config.api_key.expose_secret())
        .json(&EmbeddingRequest {
            model: search_config.vectorizer_model_name.to_owned(),
            input,
        })
        .send()
        .await?;
    let json: EmbeddingResponse = serde_json::from_str(&response.text().await?)?;
    let embeddings: Vec<Vec<f32>> = json.data.iter().map(|e| e.embedding.to_owned()).collect();
    Ok(embeddings)
}
