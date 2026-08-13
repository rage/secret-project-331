use crate::http::REQWEST_CLIENT;
use crate::prelude::*;
use headless_lms_base::config::ApplicationConfiguration;
use secrecy::ExposeSecret;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct EmbeddingRequest {
    pub model: String,
    pub input: Vec<String>,
}

#[derive(Deserialize, Serialize)]
pub struct EmbeddingResponse {
    pub object: String,
    pub model: String,
    pub usage: EmbeddingResponseUsage,
    pub data: Vec<Embedding>,
}

#[derive(Deserialize, Serialize)]
pub struct Embedding {
    pub embedding: Vec<f32>,
    pub index: i32,
    pub object: String,
}

#[derive(Deserialize, Serialize)]
pub struct EmbeddingResponseUsage {
    pub prompt_tokens: i32,
    pub total_tokens: i32,
}

pub async fn create_embeddings(
    app_config: &ApplicationConfiguration,
    input: Vec<String>,
) -> UtilResult<Vec<Vec<f32>>> {
    let app_config = app_config.to_owned();
    let azure_config = app_config.azure_configuration.ok_or_else(|| {
        util_err!(
            EmbeddingRequestBuildError,
            "Azure configuration is missing from the application configuration"
        )
    })?;

    let chatbot_config = azure_config.chatbot_config.ok_or_else(|| {
        error!("Chatbot configuration missing");
        util_err!(
            EmbeddingRequestBuildError,
            "Chatbot configuration is missing from the Azure configuration"
        )
    })?;
    let search_config = azure_config.search_config.ok_or_else(|| {
        util_err!(
            EmbeddingRequestBuildError,
            "Azure search configuration is missing from the Azure configuration"
        )
    })?;

    let api_endpoint = chatbot_config.embeddings_endpoint()?;
    let input_len = input.len();
    println!("ENDPOINT: {}", api_endpoint);
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

    if response.status().is_success() {
        let body = &response.text().await?;
        let mut json: EmbeddingResponse = serde_json::from_str(body)?;

        if json.data.len() != input_len {
            return Err(util_err!(
                EmbeddingRequestBuildError,
                format!(
                    "Embedding API returned {} embeddings for {} inputs",
                    json.data.len(),
                    input_len
                )
            ));
        }
        json.data.sort_by_key(|e| e.index);
        let embeddings: Vec<Vec<f32>> = json.data.into_iter().map(|e| e.embedding).collect();

        Ok(embeddings)
    } else {
        Err(util_err!(
            EmbeddingRequestBuildError,
            format!(
                "Embedding API failed: {} - {}",
                response.status(),
                response.text().await?
            )
        ))
    }
}
