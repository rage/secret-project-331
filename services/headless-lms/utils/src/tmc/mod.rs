use anyhow::{Context, Result};
use reqwest::{Client, Response};
use serde_json::Value;

#[derive(Debug)]
pub struct TmcClient {
    client: Client,
    access_token: String,
    ratelimit_api_key: String,
}

const TMC_API_URL: &str = "https://tmc.mooc.fi/api/v8/users";

impl TmcClient {
    pub fn new_from_env() -> Result<Self> {
        Ok(Self {
            client: Client::default(),
            access_token: std::env::var("TMC_ACCESS_TOKEN")
                .context("TMC_ACCESS_TOKEN must be defined")?,
            ratelimit_api_key: std::env::var("RATELIMIT_PROTECTION_SAFE_API_KEY")
                .context("RATELIMIT_PROTECTION_SAFE_API_KEY must be defined")?,
        })
    }

    pub async fn put_json_with_auth(&self, json_body: &Value) -> Result<Response> {
        let url = format!("{}/current", TMC_API_URL);
        self.client
            .put(url)
            .bearer_auth(&self.access_token)
            .header("RATELIMIT-PROTECTION-SAFE-API-KEY", &self.ratelimit_api_key)
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .header(reqwest::header::ACCEPT, "application/json")
            .json(json_body)
            .send()
            .await
            .context(format!(
                "Failed to send PUT request to {TMC_API_URL}/current"
            ))
    }

    pub async fn post_json_with_auth(&self, json_body: &Value) -> Result<Response> {
        self.client
            .post(TMC_API_URL)
            .bearer_auth(&self.access_token)
            .header("RATELIMIT-PROTECTION-SAFE-API-KEY", &self.ratelimit_api_key)
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .header(reqwest::header::ACCEPT, "application/json")
            .json(json_body)
            .send()
            .await
            .context(format!("Failed to send POST request to {TMC_API_URL}"))
    }
}
