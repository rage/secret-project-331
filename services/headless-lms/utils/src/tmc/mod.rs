use reqwest::Client;
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::{debug, error, info};
use url::Url;
use uuid::Uuid;

use crate::ApplicationConfiguration;
use crate::prelude::*;

#[derive(Debug, Clone)]
pub struct TmcClient {
    client: Client,
    admin_access_token: SecretString,
    ratelimit_api_key: SecretString,
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

#[derive(Deserialize)]
struct TmcDeleteAccountResponse {
    success: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TMCUser {
    pub id: i32, // upstream_id
    pub username: String,
    pub email: String,
    pub administrator: bool,
    pub courses_mooc_fi_user_id: Option<Uuid>,
    pub user_field: TMCUserField,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TMCUserField {
    pub first_name: String,
    pub last_name: String,
    pub organizational_id: String,
    pub course_announcements: bool,
}

enum TMCRequestAuth {
    UseAdminToken,
    UseUserToken(SecretString),
    NoAuth,
}

const TMC_API_URL: &str = "https://tmc.mooc.fi/api/v8/users";

fn format_tmc_errors(errors: &serde_json::Value) -> String {
    let mut error_messages = Vec::new();

    if let Some(errors_obj) = errors.as_object() {
        for (field, field_errors) in errors_obj {
            if let Some(error_array) = field_errors.as_array() {
                for error_msg in error_array {
                    if let Some(msg) = error_msg.as_str() {
                        let field_name = match field.as_str() {
                            "login" => "username",
                            _ => field,
                        };
                        error_messages.push(format!("{}: {}", field_name, msg));
                    }
                }
            } else if let Some(msg) = field_errors.as_str() {
                error_messages.push(format!("{}: {}", field, msg));
            }
        }
    }

    if error_messages.is_empty() {
        errors.to_string()
    } else {
        error_messages.join(", ")
    }
}

fn parse_tmc_error_response(error_text: &str, status: Option<reqwest::StatusCode>) -> String {
    if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(error_text) {
        if let Some(errors) = error_json.get("errors") {
            return format_tmc_errors(errors);
        } else if let Some(message) = error_json.get("message").and_then(|m| m.as_str()) {
            return message.to_string();
        }
    }

    if let Some(status) = status {
        format!("Request failed with status {}: {}", status, error_text)
    } else {
        format!("Request failed: {}", error_text)
    }
}

impl TmcClient {
    fn check_if_tmc_error_response(response_text: &str) -> Option<UtilError> {
        if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(response_text) {
            if error_json.get("errors").is_some()
                || error_json.get("success") == Some(&serde_json::Value::Bool(false))
            {
                let error_message = parse_tmc_error_response(response_text, None);
                return Some(UtilError::new(
                    UtilErrorType::TmcErrorResponse,
                    error_message,
                    None,
                ));
            }
        }
        None
    }

    async fn deserialize_response_with_tmc_error_check<T: serde::de::DeserializeOwned>(
        &self,
        response: reqwest::Response,
        error_context: &str,
    ) -> UtilResult<T> {
        let response_text = response.text().await.map_err(|e| {
            UtilError::new(
                UtilErrorType::DeserializationError,
                format!("Failed to read TMC response body: {}", error_context),
                Some(e.into()),
            )
        })?;

        serde_json::from_str(&response_text).map_err(|e| {
            if let Some(tmc_error) = Self::check_if_tmc_error_response(&response_text) {
                tmc_error
            } else {
                UtilError::new(
                    UtilErrorType::DeserializationError,
                    format!("Failed to parse {}: {}", error_context, e),
                    Some(e.into()),
                )
            }
        })
    }

    pub fn new_from_env() -> UtilResult<Self> {
        let is_dev =
            cfg!(debug_assertions) || std::env::var("APP_ENV").map_or(true, |v| v == "development");

        let admin_access_token = std::env::var("TMC_ACCESS_TOKEN").unwrap_or_else(|_| {
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
            if admin_access_token.trim().is_empty() {
                return Err(UtilError::new(
                    UtilErrorType::Other,
                    "TMC_ACCESS_TOKEN cannot be empty".to_string(),
                    None,
                ));
            }
            if ratelimit_api_key.trim().is_empty() {
                return Err(UtilError::new(
                    UtilErrorType::Other,
                    "RATELIMIT_PROTECTION_SAFE_API_KEY cannot be empty".to_string(),
                    None,
                ));
            }
        }

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| {
                UtilError::new(
                    UtilErrorType::Other,
                    "Failed to build HTTP client".to_string(),
                    Some(e.into()),
                )
            })?;

        Ok(Self {
            client,
            admin_access_token: SecretString::new(admin_access_token.into()),
            ratelimit_api_key: SecretString::new(ratelimit_api_key.into()),
        })
    }

    async fn request_with_headers(
        &self,
        method: reqwest::Method,
        url: &str,
        tmc_request_auth: TMCRequestAuth,
        body: Option<serde_json::Value>,
    ) -> UtilResult<reqwest::Response> {
        let mut builder = self
            .client
            .request(method, url)
            .header(
                "RATELIMIT-PROTECTION-SAFE-API-KEY",
                self.ratelimit_api_key.expose_secret(),
            )
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .header(reqwest::header::ACCEPT, "application/json");

        let access_token = match tmc_request_auth {
            TMCRequestAuth::UseAdminToken => Some(&self.admin_access_token),
            TMCRequestAuth::UseUserToken(ref token) => Some(token),
            TMCRequestAuth::NoAuth => None,
        };

        if let Some(token) = access_token {
            builder = builder.bearer_auth(token.expose_secret());
        }

        if let Some(json_body) = body {
            builder = builder.json(&json_body);
        }

        let res = builder.send().await.map_err(|e| {
            UtilError::new(
                UtilErrorType::TmcHttpError,
                "Failed to send HTTP request".to_string(),
                Some(e.into()),
            )
        })?;

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

            let error_message = parse_tmc_error_response(&error_text, Some(status));

            Err(UtilError::new(
                UtilErrorType::TmcHttpError,
                error_message,
                None,
            ))
        }
    }

    pub async fn update_user_information(
        &self,
        first_name: String,
        last_name: String,
        email: Option<String>,
        user_upstream_id: String,
    ) -> UtilResult<()> {
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

        self.request_with_headers(
            reqwest::Method::PUT,
            &url,
            TMCRequestAuth::UseAdminToken,
            Some(payload_value),
        )
        .await
        .map(|_| ())
    }

    pub async fn post_new_user_to_tmc(
        &self,
        user_info: NewUserInfo,
        app_conf: &ApplicationConfiguration,
    ) -> UtilResult<i32> {
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
            .request_with_headers(
                reqwest::Method::POST,
                &url,
                TMCRequestAuth::NoAuth,
                Some(payload),
            )
            .await?;

        let body: TMCUserResponse = self
            .deserialize_response_with_tmc_error_check(response, "TMC user response")
            .await?;
        Ok(body.id)
    }

    pub async fn set_user_password_managed_by_courses_mooc_fi(
        &self,
        user_upstream_id: String,
        user_id: Uuid,
    ) -> UtilResult<()> {
        let url = format!(
            "{}/{}/set_password_managed_by_courses_mooc_fi",
            TMC_API_URL, user_upstream_id
        );

        let payload = serde_json::json!({
            "courses_mooc_fi_user_id": user_id.to_string(),
        });

        self.request_with_headers(
            reqwest::Method::POST,
            &url,
            TMCRequestAuth::UseAdminToken,
            Some(payload),
        )
        .await
        .map(|_| ())
    }

    pub async fn get_user_from_tmc_with_email(&self, email: String) -> UtilResult<TmcUserInfo> {
        let mut url = Url::parse(TMC_API_URL)?;
        url.path_segments_mut()
            .map_err(|_| {
                UtilError::new(
                    UtilErrorType::UrlParse,
                    "Failed to get path segments from URL".to_string(),
                    None,
                )
            })?
            .push("get_user_with_email");
        url.query_pairs_mut().append_pair("email", &email);

        let res = self
            .request_with_headers(
                reqwest::Method::GET,
                url.as_str(),
                TMCRequestAuth::UseAdminToken,
                None,
            )
            .await?;

        let user: TmcUserInfo = self
            .deserialize_response_with_tmc_error_check(res, "TMC user from JSON")
            .await?;

        Ok(user)
    }

    pub async fn delete_user_from_tmc(&self, user_upstream_id: String) -> UtilResult<bool> {
        let url = format!("{}/{}", TMC_API_URL, user_upstream_id);

        let res = self
            .request_with_headers(
                reqwest::Method::DELETE,
                &url,
                TMCRequestAuth::UseAdminToken,
                None,
            )
            .await?;

        let body: TmcDeleteAccountResponse = self
            .deserialize_response_with_tmc_error_check(res, "delete response from TMC")
            .await?;

        Ok(body.success)
    }

    pub async fn get_user_from_tmc_mooc_fi_by_tmc_access_token(
        &self,
        tmc_access_token: &SecretString,
    ) -> UtilResult<TMCUser> {
        info!("Getting user details from tmc.mooc.fi");

        let res = self
            .request_with_headers(
                reqwest::Method::GET,
                &format!("{}/current?show_user_fields=1", TMC_API_URL),
                TMCRequestAuth::UseUserToken(tmc_access_token.clone()),
                None,
            )
            .await?;

        if !res.status().is_success() {
            error!("Failed to get user from TMC with status {}", res.status());
            return Err(UtilError::new(
                UtilErrorType::Other,
                "Failed to get current user from TMC".to_string(),
                None,
            ));
        }

        debug!("Received response from TMC, parsing user data");
        let tmc_user: TMCUser = self
            .deserialize_response_with_tmc_error_check(res, "current user from TMC by access token")
            .await?;

        debug!(
            "Creating or fetching user with TMC id {} and mooc.fi UUID {}",
            tmc_user.id,
            tmc_user
                .courses_mooc_fi_user_id
                .map(|uuid| uuid.to_string())
                .unwrap_or_else(|| "None (will generate new UUID)".to_string())
        );
        Ok(tmc_user)
    }

    pub async fn get_user_from_tmc_mooc_fi_by_tmc_access_token_and_upstream_id(
        &self,
        upstream_id: &i32,
    ) -> UtilResult<TMCUser> {
        info!("Getting user details from tmc.mooc.fi");

        let res = self
            .request_with_headers(
                reqwest::Method::GET,
                &format!("{}/{}?show_user_fields=1", TMC_API_URL, upstream_id),
                TMCRequestAuth::UseAdminToken,
                None,
            )
            .await?;

        if !res.status().is_success() {
            error!("Failed to get user from TMC with status {}", res.status());
            return Err(UtilError::new(
                UtilErrorType::Other,
                "Failed to get user from TMC".to_string(),
                None,
            ));
        }

        debug!("Received response from TMC, parsing user data");
        let tmc_user: TMCUser = self
            .deserialize_response_with_tmc_error_check(res, "user from TMC by upstream ID")
            .await?;

        Ok(tmc_user)
    }

    pub fn mock_for_test() -> Self {
        Self {
            client: Client::default(),
            admin_access_token: SecretString::new("mock-token".to_string().into()),
            ratelimit_api_key: SecretString::new("mock-api-key".to_string().into()),
        }
    }
}
