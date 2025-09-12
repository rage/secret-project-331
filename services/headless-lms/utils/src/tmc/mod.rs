use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use serde_json::json;
use url::Url;
use uuid::Uuid;

use crate::ApplicationConfiguration;

#[derive(Debug, Clone)]
pub struct TmcClient {
    client: Client,
    access_token: String,
    ratelimit_api_key: String,
}

pub struct NewUserInfo {
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub password: String,
    pub password_confirmation: String,
    pub language: String,
}

#[derive(Debug, Deserialize)]
pub struct TmcUserInfo {
    pub id: Uuid,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub upstream_id: i32,
}

#[derive(Deserialize)]
pub struct TMCUserResponse {
    pub id: i32,
}

const TMC_API_URL: &str = "https://tmc.mooc.fi/api/v8/users";

impl TmcClient {
    pub fn new_from_env() -> Result<Self> {
        let is_dev =
            cfg!(debug_assertions) || std::env::var("APP_ENV").map_or(true, |v| v == "development");

        let access_token = std::env::var("TMC_ACCESS_TOKEN").unwrap_or_else(|_| {
            if is_dev {
                "mock-access-token".to_string()
            } else {
                panic!("TMC_ACCESS_TOKEN must be defined in production")
            }
        });

        let ratelimit_api_key =
            std::env::var("RATELIMIT_PROTECTION_SAFE_API_KEY").unwrap_or_else(|_| {
                if is_dev {
                    "mock-api-key".to_string()
                } else {
                    panic!("RATELIMIT_PROTECTION_SAFE_API_KEY must be defined in production")
                }
            });

        if !is_dev {
            if access_token.trim().is_empty() {
                anyhow::bail!("TMC_ACCESS_TOKEN cannot be empty");
            }
            if ratelimit_api_key.trim().is_empty() {
                anyhow::bail!("RATELIMIT_PROTECTION_SAFE_API_KEY cannot be empty");
            }
        }

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .context("Failed to build HTTP client")?;

        Ok(Self {
            client,
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

            if let Ok(parsed) = reqwest::Url::parse(url) {
                let redacted = format!(
                    "{}{}",
                    parsed.origin().unicode_serialization(),
                    parsed.path()
                );
                tracing::warn!("Request to {} failed with status {}", redacted, status);
            } else {
                tracing::warn!("Request failed with status {}", status);
            }
            tracing::debug!("Response body: {}", error_text);

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
        email: Option<String>,
        user_upstream_id: String,
    ) -> Result<()> {
        let mut user_obj = serde_json::Map::new();
        let mut user_field_obj = serde_json::Map::new();

        if let Some(email) = email {
            user_obj.insert("email".to_string(), serde_json::Value::String(email));
        }

        user_field_obj.insert(
            "first_name".to_string(),
            serde_json::Value::String(first_name),
        );
        user_field_obj.insert(
            "last_name".to_string(),
            serde_json::Value::String(last_name),
        );

        let mut payload = serde_json::Map::new();

        if !user_obj.is_empty() {
            payload.insert("user".to_string(), serde_json::Value::Object(user_obj));
        }

        payload.insert(
            "user_field".to_string(),
            serde_json::Value::Object(user_field_obj),
        );

        let payload_value = serde_json::Value::Object(payload);

        let url = format!("{}/{}", TMC_API_URL, user_upstream_id);

        self.request_with_headers(reqwest::Method::PUT, &url, true, Some(payload_value))
            .await
            .map(|_| ())
    }

    pub async fn post_new_user_to_tmc(
        &self,
        user_info: NewUserInfo,
        app_conf: &ApplicationConfiguration,
    ) -> Result<i32> {
        let payload = json!({
            "user": {
                "email": user_info.email,
                "first_name": user_info.first_name,
                "last_name": user_info.last_name,
                "password": user_info.password,
                "password_confirmation": user_info.password_confirmation
            },
            "user_field": {
                "first_name": user_info.first_name,
                "last_name": user_info.last_name
            },
            "origin": app_conf.tmc_account_creation_origin,
            "language": user_info.language
        });

        let url = format!("{}?include_id=true", TMC_API_URL);
        let response = self
            .request_with_headers(reqwest::Method::POST, &url, false, Some(payload))
            .await?;

        let body: TMCUserResponse = response.json().await?;
        Ok(body.id)
    }

    pub async fn set_user_password_managed_by_courses_mooc_fi(
        &self,
        user_upstream_id: String,
        user_id: Uuid,
    ) -> Result<()> {
        let url = format!(
            "{}/{}/set_password_managed_by_courses_mooc_fi",
            TMC_API_URL, user_upstream_id
        );

        let payload = serde_json::json!({
            "courses_mooc_fi_user_id": user_id.to_string(),
        });

        self.request_with_headers(reqwest::Method::POST, &url, true, Some(payload))
            .await
            .map(|_| ())
    }

    pub async fn get_user_from_tmc_with_email(&self, email: String) -> Result<TmcUserInfo> {
        let mut url = Url::parse(TMC_API_URL).unwrap();
        url.path_segments_mut().unwrap().push("get_user_with_email");
        url.query_pairs_mut().append_pair("email", &email);

        let res = self
            .request_with_headers(reqwest::Method::GET, url.as_str(), true, None)
            .await?;

        let user: TmcUserInfo = res
            .json()
            .await
            .context("Failed to parse TMC user from JSON")?;

        Ok(user)
    }

    pub fn mock_for_test() -> Self {
        Self {
            client: Client::default(),
            access_token: "mock-token".to_string(),
            ratelimit_api_key: "mock-api-key".to_string(),
        }
    }
}
