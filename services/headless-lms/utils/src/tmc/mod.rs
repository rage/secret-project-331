use anyhow::{Context, Result};
use reqwest::Client;
use serde_json::json;

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

    fn request_with_headers(
        &self,
        method: reqwest::Method,
        url: &str,
        use_auth: bool,
    ) -> reqwest::RequestBuilder {
        let builder = self
            .client
            .request(method, url)
            .header("RATELIMIT-PROTECTION-SAFE-API-KEY", &self.ratelimit_api_key)
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .header(reqwest::header::ACCEPT, "application/json");

        if use_auth {
            builder.bearer_auth(&self.access_token)
        } else {
            builder
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

        let res = self
            .request_with_headers(reqwest::Method::PUT, &url, true)
            .json(&payload)
            .send()
            .await
            .context("Failed to send request to https://tmc.mooc.fi")?;

        if res.status().is_success() {
            Ok(())
        } else {
            let status = res.status();
            let error_text = res
                .text()
                .await
                .unwrap_or_else(|e| format!("(Failed to read error body: {e})"));

            warn!(
                "MOOC.fi update failed with status {}: {}",
                status, error_text
            );

            Err(anyhow::anyhow!(
                "MOOC.fi update failed with status {status}: {error_text}"
            ))
        }
    }

    pub async fn post_new_user_to_moocfi(
        &self,
        first_name: String,
        last_name: String,
        email: String,
        password: String,
        password_confirmation: String,
        language: String,
    ) -> Result<()> {
        let origin = std::env::var("TMC_ACCOUNT_CREATION_ORIGIN")
            .context("TMC_ACCOUNT_CREATION_ORIGIN must be defined")?;

        let payload = json!({
            "user": {
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "password": password,
                "password_confirmation": password_confirmation
            },
            "user_field": {
                "first_name": first_name,
                "last_name": last_name
            },
            "origin": origin,
            "language": language
        });

        let res = self
            .request_with_headers(reqwest::Method::POST, TMC_API_URL, false)
            .json(&payload)
            .send()
            .await
            .context("Failed to send request to https://tmc.mooc.fi")?;

        if res.status().is_success() {
            Ok(())
        } else {
            let status = res.status();
            let error_text = res
                .text()
                .await
                .unwrap_or_else(|e| format!("(Failed to read error body: {e})"));

            warn!(
                "MOOC.fi user creation failed with status {}: {}",
                status, error_text
            );

            Err(anyhow::anyhow!(
                "MOOC.fi user creation failed with status {status}: {error_text}"
            ))
        }
    }
}
