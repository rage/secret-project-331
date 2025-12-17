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
pub mod tmc;
pub mod url_encoding;
pub mod url_to_oembed_endpoint;

#[macro_use]
extern crate tracing;

use anyhow::Context;
use secrecy::{ExposeSecret, SecretBox, SecretString};
use std::sync::Arc;
use std::{env, str::FromStr};
use url::Url;

#[derive(Clone)]
pub struct ApplicationConfiguration {
    pub base_url: String,
    pub test_mode: bool,
    pub test_chatbot: bool,
    pub development_uuid_login: bool,
    pub azure_configuration: Option<AzureConfiguration>,
    pub tmc_account_creation_origin: Option<String>,
    pub tmc_admin_access_token: SecretString,
    pub oauth_server_configuration: OAuthServerConfiguration,
}

impl ApplicationConfiguration {
    /// Attempts to create an ApplicationConfiguration from environment variables.
    pub fn try_from_env() -> anyhow::Result<Self> {
        let base_url = env::var("BASE_URL").context("BASE_URL must be defined")?;
        let test_mode = env::var("TEST_MODE").is_ok();
        let development_uuid_login = env::var("DEVELOPMENT_UUID_LOGIN").is_ok();
        let test_chatbot = test_mode
            && (env::var("USE_MOCK_AZURE_CONFIGURATION").is_ok_and(|v| v.as_str() != "false")
                || env::var("AZURE_CHATBOT_API_KEY").is_err());

        let azure_configuration = if test_chatbot {
            AzureConfiguration::mock_conf()?
        } else {
            AzureConfiguration::try_from_env()?
        };

        let tmc_account_creation_origin = Some(
            env::var("TMC_ACCOUNT_CREATION_ORIGIN")
                .context("TMC_ACCOUNT_CREATION_ORIGIN must be defined")?,
        );

        let tmc_admin_access_token = SecretString::new(
            std::env::var("TMC_ACCESS_TOKEN")
                .unwrap_or_else(|_| {
                    if test_mode {
                        "mock-access-token".to_string()
                    } else {
                        panic!("TMC_ACCESS_TOKEN must be defined in production")
                    }
                })
                .into(),
        );
        let oauth_server_configuration = OAuthServerConfiguration::try_from_env()
            .context("Failed to load OAuth server configuration")?;

        Ok(Self {
            base_url,
            test_mode,
            test_chatbot,
            development_uuid_login,
            azure_configuration,
            tmc_account_creation_origin,
            tmc_admin_access_token,
            oauth_server_configuration,
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

    pub fn connection_string(&self) -> anyhow::Result<String> {
        Ok(format!(
            "DefaultEndpointsProtocol=https;AccountName={};AccountKey={};EndpointSuffix=core.windows.net",
            self.storage_account, self.access_key
        ))
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

    /// Creates an AzureConfiguration with empty and mock values to be used in testing and dev
    /// environments when Azure access is not needed. Enables the azure chatbot functionality to be
    /// mocked with the api_endpoint from our application.
    /// Returns `Ok(Some(AzureConfiguration))`
    pub fn mock_conf() -> anyhow::Result<Option<Self>> {
        let base_url = env::var("BASE_URL").context("BASE_URL must be defined")?;
        let chatbot_config = Some(AzureChatbotConfiguration {
            api_key: "".to_string(),
            api_endpoint: Url::parse(&base_url)?.join("/api/v0/mock-azure/test/")?,
        });
        let search_config = Some(AzureSearchConfiguration {
            vectorizer_resource_uri: "".to_string(),
            vectorizer_deployment_id: "".to_string(),
            vectorizer_api_key: "".to_string(),
            vectorizer_model_name: "".to_string(),
            search_api_key: "".to_string(),
            search_endpoint: Url::from_str("https://example.com/does-not-exist/")?,
        });
        let blob_storage_config = Some(AzureBlobStorageConfiguration {
            storage_account: "".to_string(),
            access_key: "".to_string(),
        });

        Ok(Some(AzureConfiguration {
            chatbot_config,
            search_config,
            blob_storage_config,
        }))
    }
}

#[derive(Clone)]
pub struct OAuthServerConfiguration {
    pub rsa_public_key: String,
    pub rsa_private_key: String,
    /// Secret key for HMAC-SHA-256 hashing of OAuth tokens (access tokens, refresh tokens, auth codes).
    pub oauth_token_hmac_key: String,
    /// Secret key for signing DPoP nonces (HMAC).
    pub dpop_nonce_key: Arc<SecretBox<String>>,
}

impl PartialEq for OAuthServerConfiguration {
    fn eq(&self, other: &Self) -> bool {
        self.rsa_public_key == other.rsa_public_key
            && self.rsa_private_key == other.rsa_private_key
            && self.oauth_token_hmac_key == other.oauth_token_hmac_key
            && self.dpop_nonce_key.expose_secret() == other.dpop_nonce_key.expose_secret()
    }
}

impl OAuthServerConfiguration {
    /// Attempts to create an OAuthServerConfiguration.
    /// Return `Ok(Some(OAuthConfiguration))` if all configurations are set.
    /// Return `Err` if any is not set.
    pub fn try_from_env() -> anyhow::Result<Self> {
        let rsa_public_key =
            env::var("OAUTH_RSA_PUBLIC_PEM").context("OAUTH_RSA_PUBLIC_KEY must be defined")?;
        let rsa_private_key =
            env::var("OAUTH_RSA_PRIVATE_PEM").context("OAUTH_RSA_PRIVATE_KEY must be defined")?;
        let oauth_token_hmac_key =
            env::var("OAUTH_TOKEN_HMAC_KEY").context("OAUTH_TOKEN_HMAC_KEY must be defined")?;
        let dpop_nonce_key = Arc::new(SecretBox::new(Box::new(
            env::var("OAUTH_DPOP_NONCE_KEY").context("OAUTH_DPOP_NONCE_KEY must be defined")?,
        )));

        Ok(Self {
            rsa_public_key,
            rsa_private_key,
            oauth_token_hmac_key,
            dpop_nonce_key,
        })
    }
}
