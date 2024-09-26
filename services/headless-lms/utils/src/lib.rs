//! Commonly used utils.

pub mod cache;
pub mod document_schema_processor;
pub mod email_processor;
pub mod error;
pub mod file_store;
pub mod folder_checksum;
pub mod futures;
pub mod icu4x;
pub mod ip_to_country;
pub mod language_tag_to_name;
pub mod merge_edits;
pub mod numbers;
pub mod page_visit_hasher;
pub mod pagination;
pub mod prelude;
pub mod strings;
pub mod url_to_oembed_endpoint;

#[macro_use]
extern crate tracing;

use anyhow::Context;
use std::env;
use url::Url;

#[derive(Clone, PartialEq)]
pub struct ApplicationConfiguration {
    pub base_url: String,
    pub test_mode: bool,
    pub development_uuid_login: bool,
    pub azure_configuration: Option<AzureConfiguration>,
}

#[derive(Clone, PartialEq)]
pub struct AzureConfiguration {
    pub chatbot_api_key: Option<String>,
    pub chatbot_api_endpoint: Option<Url>,
    pub vectorizer_resource_uri: Option<String>,
    pub vectorizer_deployment_id: Option<String>,
    pub vectorizer_api_key: Option<String>,
    pub vectorizer_model_name: Option<String>,
}

impl ApplicationConfiguration {
    /// Attempts to create an ApplicationConfiguration from environment variables.
    pub fn try_from_env() -> anyhow::Result<Self> {
        let base_url = env::var("BASE_URL").context("BASE_URL must be defined")?;
        let test_mode = env::var("TEST_MODE").is_ok();
        let development_uuid_login = env::var("DEVELOPMENT_UUID_LOGIN").is_ok();

        let azure_configuration = AzureConfiguration::try_from_env()?;

        Ok(Self {
            base_url,
            test_mode,
            development_uuid_login,
            azure_configuration,
        })
    }
}

impl AzureConfiguration {
    /// Attempts to create an AzureConfiguration from environment variables.
    /// Returns `Ok(Some(AzureConfiguration))` if any Azure-related environment variable is set.
    /// Returns `Ok(None)` if no Azure-related environment variables are set.
    /// Returns an error if any set Azure-related environment variable fails to parse.
    pub fn try_from_env() -> anyhow::Result<Option<Self>> {
        let chatbot_api_key = env::var("AZURE_CHATBOT_API_KEY").ok();
        let chatbot_api_endpoint = match env::var("AZURE_CHATBOT_API_ENDPOINT") {
            Ok(s) => Some(Url::parse(&s).context("Invalid URL in AZURE_CHATBOT_API_ENDPOINT")?),
            Err(_) => None,
        };
        let vectorizer_resource_uri = env::var("AZURE_VECTORIZER_RESOURCE_URI").ok();
        let vectorizer_deployment_id = env::var("AZURE_VECTORIZER_DEPLOYMENT_ID").ok();
        let vectorizer_api_key = env::var("AZURE_VECTORIZER_API_KEY").ok();
        let vectorizer_model_name = env::var("AZURE_VECTORIZER_MODEL_NAME").ok();

        if chatbot_api_key.is_some()
            || chatbot_api_endpoint.is_some()
            || vectorizer_resource_uri.is_some()
            || vectorizer_deployment_id.is_some()
            || vectorizer_api_key.is_some()
            || vectorizer_model_name.is_some()
        {
            Ok(Some(AzureConfiguration {
                chatbot_api_key,
                chatbot_api_endpoint,
                vectorizer_resource_uri,
                vectorizer_deployment_id,
                vectorizer_api_key,
                vectorizer_model_name,
            }))
        } else {
            Ok(None)
        }
    }
}
