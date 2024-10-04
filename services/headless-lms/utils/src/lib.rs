//! Commonly used utils.

pub mod cache;
pub mod document_schema_processor;
pub mod email_processor;
pub mod error;
pub mod file_store;
pub mod folder_checksum;
pub mod futures;
pub mod http;
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

#[derive(Clone, PartialEq)]
pub struct AzureChatbotConfiguration {
    pub api_key: String,
    pub api_endpoint: Url,
}

impl AzureChatbotConfiguration {
    /// Attempts to create an AzureChatbotConfiguration from environment variables.
    /// Returns `Ok(Some(AzureChatbotConfiguration))` if both environment variables are set.
    /// Returns `Ok(None)` if no environment variables are set for chatbot.
    /// Returns an error if set environment variables fail to parse.
    pub fn try_from_env() -> anyhow::Result<Option<Self>> {
        let api_key = env::var("AZURE_CHATBOT_API_KEY").ok();
        let api_endpoint_str = env::var("AZURE_CHATBOT_API_ENDPOINT").ok();

        if let (Some(api_key), Some(api_endpoint_str)) = (api_key, api_endpoint_str) {
            let api_endpoint = Url::parse(&api_endpoint_str)
                .context("Invalid URL in AZURE_CHATBOT_API_ENDPOINT")?;
            Ok(Some(AzureChatbotConfiguration {
                api_key,
                api_endpoint,
            }))
        } else {
            Ok(None)
        }
    }
}

#[derive(Clone, PartialEq)]
pub struct AzureSearchConfiguration {
    pub vectorizer_resource_uri: String,
    pub vectorizer_deployment_id: String,
    pub vectorizer_api_key: String,
    pub vectorizer_model_name: String,
    pub search_endpoint: Url,
    pub search_api_key: String,
}

impl AzureSearchConfiguration {
    /// Attempts to create an AzureSearchConfiguration from environment variables.
    /// Returns `Ok(Some(AzureSearchConfiguration))` if all related environment variables are set.
    /// Returns `Ok(None)` if no environment variables are set for search and vectorizer.
    /// Returns an error if set environment variables fail to parse.
    pub fn try_from_env() -> anyhow::Result<Option<Self>> {
        let vectorizer_resource_uri = env::var("AZURE_VECTORIZER_RESOURCE_URI").ok();
        let vectorizer_deployment_id = env::var("AZURE_VECTORIZER_DEPLOYMENT_ID").ok();
        let vectorizer_api_key = env::var("AZURE_VECTORIZER_API_KEY").ok();
        let vectorizer_model_name = env::var("AZURE_VECTORIZER_MODEL_NAME").ok();
        let search_endpoint_str = env::var("AZURE_SEARCH_ENDPOINT").ok();
        let search_api_key = env::var("AZURE_SEARCH_API_KEY").ok();

        if let (
            Some(vectorizer_resource_uri),
            Some(vectorizer_deployment_id),
            Some(vectorizer_api_key),
            Some(vectorizer_model_name),
            Some(search_endpoint_str),
            Some(search_api_key),
        ) = (
            vectorizer_resource_uri,
            vectorizer_deployment_id,
            vectorizer_api_key,
            vectorizer_model_name,
            search_endpoint_str,
            search_api_key,
        ) {
            let search_endpoint =
                Url::parse(&search_endpoint_str).context("Invalid URL in AZURE_SEARCH_ENDPOINT")?;
            Ok(Some(AzureSearchConfiguration {
                vectorizer_resource_uri,
                vectorizer_deployment_id,
                vectorizer_api_key,
                vectorizer_model_name,
                search_endpoint,
                search_api_key,
            }))
        } else {
            Ok(None)
        }
    }
}

#[derive(Clone, PartialEq)]
pub struct AzureBlobStorageConfiguration {
    pub storage_account: String,
    pub access_key: String,
}

impl AzureBlobStorageConfiguration {
    /// Attempts to create an AzureBlobStorageConfiguration from environment variables.
    /// Returns `Ok(Some(AzureBlobStorageConfiguration))` if both environment variables are set.
    /// Returns `Ok(None)` if no environment variables are set for blob storage.
    pub fn try_from_env() -> anyhow::Result<Option<Self>> {
        let storage_account = env::var("AZURE_BLOB_STORAGE_ACCOUNT").ok();
        let access_key = env::var("AZURE_BLOB_STORAGE_ACCESS_KEY").ok();

        if let (Some(storage_account), Some(access_key)) = (storage_account, access_key) {
            Ok(Some(AzureBlobStorageConfiguration {
                storage_account,
                access_key,
            }))
        } else {
            Ok(None)
        }
    }
}

#[derive(Clone, PartialEq)]
pub struct AzureConfiguration {
    pub chatbot_config: Option<AzureChatbotConfiguration>,
    pub search_config: Option<AzureSearchConfiguration>,
    pub blob_storage_config: Option<AzureBlobStorageConfiguration>,
}

impl AzureConfiguration {
    /// Attempts to create an AzureConfiguration by calling the individual try_from_env functions.
    /// Returns `Ok(Some(AzureConfiguration))` if any of the configurations are set.
    /// Returns `Ok(None)` if no relevant environment variables are set.
    pub fn try_from_env() -> anyhow::Result<Option<Self>> {
        let chatbot = AzureChatbotConfiguration::try_from_env()?;
        let search_config = AzureSearchConfiguration::try_from_env()?;
        let blob_storage_config = AzureBlobStorageConfiguration::try_from_env()?;

        if chatbot.is_some() || search_config.is_some() || blob_storage_config.is_some() {
            Ok(Some(AzureConfiguration {
                chatbot_config: chatbot,
                search_config,
                blob_storage_config,
            }))
        } else {
            Ok(None)
        }
    }
}
