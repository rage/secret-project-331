use anyhow::{Context, Result};
use reqwest::Client;
use serde_json::json;

use crate::ApplicationConfiguration;

#[derive(Debug, Clone)]
pub struct TmcClient {
    client: Client,
    access_token: String,
    ratelimit_api_key: String,
}

const TMC_API_URL: &str = "https://tmc.mooc.fi/api/v8/users";

impl TmcClient {
    pub fn new_from_env() -> Result<Self> {
        let access_token =
            std::env::var("TMC_ACCESS_TOKEN").context("TMC_ACCESS_TOKEN must be defined")?;
        let ratelimit_api_key = std::env::var("RATELIMIT_PROTECTION_SAFE_API_KEY")
            .context("RATELIMIT_PROTECTION_SAFE_API_KEY must be defined")?;

        if access_token.trim().is_empty() {
            anyhow::bail!("TMC_ACCESS_TOKEN cannot be empty");
        }
        if ratelimit_api_key.trim().is_empty() {
            anyhow::bail!("RATELIMIT_PROTECTION_SAFE_API_KEY cannot be empty");
        }
        Ok(Self {
            client: Client::default(),
            access_token,
            ratelimit_api_key,
        })
    }

    async fn request_with_headers(
        &self,
        method: reqwest::Method,
        url: &str,
        use_auth: bool,
        body: Option<serde_json::Value>,
    ) -> Result<reqwest::Response> {
        let mut builder = self
            .client
            .request(method, url)
            .header("RATELIMIT-PROTECTION-SAFE-API-KEY", &self.ratelimit_api_key)
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .header(reqwest::header::ACCEPT, "application/json");

        if use_auth {
            builder = builder.bearer_auth(&self.access_token);
        }

        if let Some(json_body) = body {
            builder = builder.json(&json_body);
        }

        let res = builder
            .send()
            .await
            .context("Failed to send HTTP request")?;

        if res.status().is_success() {
            Ok(res)
        } else {
            let status = res.status();
            let error_text = res
                .text()
                .await
                .unwrap_or_else(|e| format!("(Failed to read error body: {e})"));

            warn!(
                "Request to {} failed with status {}: {}",
                url, status, error_text
            );

            Err(anyhow::anyhow!(
                "Request failed with status {}: {}",
                status,
                error_text
            ))
        }
    }

    pub async fn update_user_information(
        &self,
        first_name: String,
        last_name: String,
        email: String,
    ) -> Result<()> {
        let payload = json!({
            "user": { "email": email },
            "user_field": {
                "first_name": first_name,
                "last_name": last_name
            }
        });

        let url = format!("{}/current", TMC_API_URL);

        self.request_with_headers(reqwest::Method::PUT, &url, true, Some(payload))
            .await
            .map(|_| ())
    }

    pub async fn post_new_user_to_moocfi(
        &self,
        first_name: String,
        last_name: String,
        email: String,
        password: String,
        password_confirmation: String,
        language: String,
        app_conf: &ApplicationConfiguration,
    ) -> Result<()> {
        let payload = json!({
            "user": {
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "password":password,
                "password_confirmation": password_confirmation
            },
            "user_field": {
                "first_name": first_name,
                "last_name": last_name
            },
            "origin": app_conf.tmc_account_creation_origin,
            "language": language
        });

        self.request_with_headers(reqwest::Method::POST, TMC_API_URL, false, Some(payload))
            .await
            .map(|_| ())
    }

    pub fn mock_for_test() -> Self {
        Self {
            client: Client::default(),
            access_token: "mock-token".to_string(),
            ratelimit_api_key: "mock-api-key".to_string(),
        }
    }
}
