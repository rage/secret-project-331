use anyhow::Context;
use secrecy::{ExposeSecret, SecretBox, SecretString};
use std::sync::Arc;
use std::{env, str::FromStr};
use url::Url;

/// Reads a boolean env var where missing values default to false.
pub fn bool_env_false_by_default(key: &str) -> bool {
    match env::var(key) {
        Ok(value) => {
            let normalized = value.trim().to_ascii_lowercase();
            !matches!(
                normalized.as_str(),
                "" | "false" | "0" | "no" | "off" | "disabled"
            )
        }
        Err(_) => false,
    }
}

/// Reads an env var, treating a blank value the same as an unset one.
fn non_empty_env(key: &str) -> Option<String> {
    match env::var(key) {
        Ok(value) if !value.trim().is_empty() => Some(value.trim().to_string()),
        _ => None,
    }
}

/// Reads an integer env var, falling back to `default` when unset, blank or unparseable.
fn i64_env_or(key: &str, default: i64) -> i64 {
    non_empty_env(key)
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
}

#[derive(Clone)]
pub struct ApplicationConfiguration {
    pub base_url: String,
    pub test_mode: bool,
    pub test_chatbot: bool,
    pub test_sisu: bool,
    pub test_suotar: bool,
    pub development_uuid_login: bool,
    pub enable_admin_email_verification: bool,
    pub enable_email_ownership_verification: bool,
    pub azure_configuration: Option<AzureConfiguration>,
    pub suotar_configuration: SuotarConfiguration,
    pub tmc_account_creation_origin: Option<String>,
    pub tmc_admin_access_token: SecretString,
    pub oauth_server_configuration: OAuthServerConfiguration,
}

impl ApplicationConfiguration {
    /// Attempts to create an ApplicationConfiguration from environment variables.
    pub fn try_from_env() -> anyhow::Result<Self> {
        let base_url = env::var("BASE_URL").context("BASE_URL must be defined")?;
        let test_mode = bool_env_false_by_default("TEST_MODE");
        let development_uuid_login = bool_env_false_by_default("DEVELOPMENT_UUID_LOGIN");
        let enable_admin_email_verification =
            bool_env_false_by_default("ENABLE_ADMIN_EMAIL_VERIFICATION");
        let enable_email_ownership_verification =
            bool_env_false_by_default("ENABLE_EMAIL_OWNERSHIP_VERIFICATION");
        let test_chatbot = test_mode
            && (bool_env_false_by_default("USE_MOCK_AZURE_CONFIGURATION")
                || env::var("AZURE_CHATBOT_API_KEY").is_err());

        let test_sisu = test_mode && bool_env_false_by_default("USE_MOCK_SISU_ENDPOINT");

        // No mock fallback unlike Azure: credit registration writes to the real student registry.
        let test_suotar = test_mode && bool_env_false_by_default("USE_MOCK_SUOTAR_ENDPOINT");

        let azure_configuration = if test_chatbot {
            AzureConfiguration::mock_conf()?
        } else {
            AzureConfiguration::try_from_env()?
        };

        let suotar_configuration = if test_suotar {
            SuotarConfiguration::mock_conf(&base_url)?
        } else {
            SuotarConfiguration::try_from_env()?
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
            test_sisu,
            test_suotar,
            development_uuid_login,
            enable_admin_email_verification,
            enable_email_ownership_verification,
            azure_configuration,
            suotar_configuration,
            tmc_account_creation_origin,
            tmc_admin_access_token,
            oauth_server_configuration,
        })
    }
}

/// TODO: Suotar has not confirmed whether they want `Basic` or `Bearer`; `Basic` is what they
/// already accept on the legacy study-registry path.
pub const SUOTAR_AUTH_SCHEME: &str = "Basic";

/// The only token the mock Suotar accepts. Public on purpose: never a real credential.
pub const MOCK_SUOTAR_TOKEN: &str = "mock-suotar-token";

/// Auto-links a student number when Sisu's address matches a verified account email. Off until that
/// fast track exists; then it is the incident kill switch for it.
const FAST_TRACK_EMAIL_MATCH_ENABLED_DEFAULT: bool = false;

/// Days an `email_verified_at` may be old and still count as fast-track proof. Bounded because a
/// deprovisioned university address can be reissued to somebody else.
const FAST_TRACK_MAX_EMAIL_VERIFICATION_AGE_DAYS_DEFAULT: i64 = 365;

#[derive(Clone)]
pub struct SuotarConfiguration {
    /// Ends in `/` because it is a [`Url::join`] base and joined paths must be relative.
    pub api_base_url: Url,
    pub api_token: SecretString,
    /// Nothing reads it yet.
    pub fast_track_email_match_enabled: bool,
    /// Nothing reads it yet.
    pub fast_track_max_email_verification_age_days: i64,
}

impl SuotarConfiguration {
    /// Points the client at our own mock controller. Only reachable with `TEST_MODE` and
    /// `USE_MOCK_SUOTAR_ENDPOINT` both on.
    pub fn mock_conf(base_url: &str) -> anyhow::Result<Self> {
        Ok(Self {
            api_base_url: Url::parse(base_url)
                .context("Invalid URL in BASE_URL")?
                .join("/api/v0/mock-suotar/")?,
            api_token: SecretString::new(MOCK_SUOTAR_TOKEN.to_string().into()),
            fast_track_email_match_enabled: Self::fast_track_enabled_from_env(),
            fast_track_max_email_verification_age_days: Self::fast_track_max_age_from_env(),
        })
    }

    pub fn try_from_env() -> anyhow::Result<Self> {
        Self::from_values(
            non_empty_env("SUOTAR_API_BASE_URL"),
            non_empty_env("SUOTAR_API_KEY"),
            Self::fast_track_enabled_from_env(),
            Self::fast_track_max_age_from_env(),
        )
    }

    fn fast_track_enabled_from_env() -> bool {
        match non_empty_env("SUOTAR_FAST_TRACK_EMAIL_MATCH_ENABLED") {
            Some(_) => bool_env_false_by_default("SUOTAR_FAST_TRACK_EMAIL_MATCH_ENABLED"),
            None => FAST_TRACK_EMAIL_MATCH_ENABLED_DEFAULT,
        }
    }

    fn fast_track_max_age_from_env() -> i64 {
        i64_env_or(
            "SUOTAR_FAST_TRACK_MAX_EMAIL_VERIFICATION_AGE_DAYS",
            FAST_TRACK_MAX_EMAIL_VERIFICATION_AGE_DAYS_DEFAULT,
        )
    }

    /// Pure so the no-mock-fallback rule can be tested without touching process env.
    fn from_values(
        api_base_url: Option<String>,
        api_token: Option<String>,
        fast_track_email_match_enabled: bool,
        fast_track_max_email_verification_age_days: i64,
    ) -> anyhow::Result<Self> {
        let api_base_url = api_base_url.context(
            "SUOTAR_API_BASE_URL must be defined unless TEST_MODE and USE_MOCK_SUOTAR_ENDPOINT are both on. Credit registration writes to the real student registry, so there is no mock fallback.",
        )?;
        let api_token = api_token.context(
            "SUOTAR_API_KEY must be defined unless TEST_MODE and USE_MOCK_SUOTAR_ENDPOINT are both on. Credit registration writes to the real student registry, so there is no mock fallback.",
        )?;
        let api_base_url = if api_base_url.ends_with('/') {
            api_base_url
        } else {
            format!("{api_base_url}/")
        };
        Ok(Self {
            api_base_url: Url::parse(&api_base_url)
                .context("Invalid URL in SUOTAR_API_BASE_URL")?,
            api_token: SecretString::new(api_token.into()),
            fast_track_email_match_enabled,
            fast_track_max_email_verification_age_days,
        })
    }
}

#[derive(Clone)]
pub struct AzureChatbotConfiguration {
    pub api_key: SecretString,
    pub api_base: Url,
    pub project_name: String,
}

impl AzureChatbotConfiguration {
    /// Attempts to create an AzureChatbotConfiguration from environment variables.
    /// Returns `Ok(Some(AzureChatbotConfiguration))` if both environment variables are set.
    /// Returns `Ok(None)` if no environment variables are set for chatbot.
    /// Returns an error if set environment variables fail to parse.
    pub fn try_from_env() -> anyhow::Result<Option<Self>> {
        let api_key = env::var("AZURE_CHATBOT_API_KEY").ok();
        let api_endpoint_str = env::var("AZURE_CHATBOT_API_ENDPOINT").ok();
        let project_name = env::var("AZURE_PROJECT_NAME").ok();

        if let (Some(api_key), Some(api_endpoint_str), Some(project_name)) =
            (api_key, api_endpoint_str, project_name)
        {
            let api_base = Url::parse(&api_endpoint_str)
                .context("Invalid URL in AZURE_CHATBOT_API_ENDPOINT")?;
            Ok(Some(AzureChatbotConfiguration {
                api_key: SecretString::new(api_key.into()),
                api_base,
                project_name,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn responses_endpoint(&self) -> anyhow::Result<Url> {
        Ok(self.api_base.join(&format!(
            "/api/projects/{}/openai/v1/responses",
            self.project_name
        ))?)
    }

    pub fn embeddings_endpoint(&self) -> anyhow::Result<Url> {
        Ok(self.api_base.join("openai/v1/embeddings")?)
    }
}

#[derive(Clone)]
pub struct AzureSearchConfiguration {
    pub vectorizer_resource_uri: String,
    pub vectorizer_deployment_id: String,
    pub vectorizer_api_key: SecretString,
    pub vectorizer_model_name: String,
    pub search_endpoint: Url,
    pub search_api_key: SecretString,
    pub search_connection_id: String,
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
        let search_connection_id = env::var("AZURE_SEARCH_CONNECTION_ID").ok();

        if let (
            Some(vectorizer_resource_uri),
            Some(vectorizer_deployment_id),
            Some(vectorizer_api_key),
            Some(vectorizer_model_name),
            Some(search_endpoint_str),
            Some(search_api_key),
            Some(search_connection_id),
        ) = (
            vectorizer_resource_uri,
            vectorizer_deployment_id,
            vectorizer_api_key,
            vectorizer_model_name,
            search_endpoint_str,
            search_api_key,
            search_connection_id,
        ) {
            let search_endpoint =
                Url::parse(&search_endpoint_str).context("Invalid URL in AZURE_SEARCH_ENDPOINT")?;
            Ok(Some(AzureSearchConfiguration {
                vectorizer_resource_uri,
                vectorizer_deployment_id,
                vectorizer_api_key: SecretString::new(vectorizer_api_key.into()),
                vectorizer_model_name,
                search_endpoint,
                search_api_key: SecretString::new(search_api_key.into()),
                search_connection_id,
            }))
        } else {
            Ok(None)
        }
    }
}

#[derive(Clone)]
pub struct AzureBlobStorageConfiguration {
    pub storage_account: String,
    pub access_key: SecretString,
}

impl AzureBlobStorageConfiguration {
    /// Attempts to create an AzureBlobStorageConfiguration from environment variables.
    /// Returns `Ok(Some(AzureBlobStorageConfiguration))` if both environment variables are set.
    /// Returns `Ok(None)` if no environment variables are set for blob storage.
    /// Returns an error if set environment variables fail to parse.
    pub fn try_from_env() -> anyhow::Result<Option<Self>> {
        let storage_account = env::var("AZURE_BLOB_STORAGE_ACCOUNT").ok();
        let access_key = env::var("AZURE_BLOB_STORAGE_ACCESS_KEY").ok();

        if let (Some(storage_account), Some(access_key)) = (storage_account, access_key) {
            Ok(Some(AzureBlobStorageConfiguration {
                storage_account,
                access_key: SecretString::new(access_key.into()),
            }))
        } else {
            Ok(None)
        }
    }

    /// Builds the Azure storage connection string. The result embeds the account
    /// access key, so it is returned wrapped in `SecretString` (zeroized on drop,
    /// redacted from `Debug`); call `.expose_secret()` only at the point it is handed
    /// to the Azure SDK.
    pub fn connection_string(&self) -> anyhow::Result<SecretString> {
        Ok(SecretString::new(
            format!(
                "DefaultEndpointsProtocol=https;AccountName={};AccountKey={};EndpointSuffix=core.windows.net",
                self.storage_account,
                self.access_key.expose_secret()
            )
            .into(),
        ))
    }
}

#[derive(Clone)]
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
            api_key: SecretString::new(String::new().into()),
            api_base: Url::parse(&base_url)?.join("/api/v0/mock-azure/test/v1/responses")?,
            project_name: String::new().into(),
        });
        let search_config = Some(AzureSearchConfiguration {
            vectorizer_resource_uri: "".to_string(),
            vectorizer_deployment_id: "".to_string(),
            vectorizer_api_key: SecretString::new(String::new().into()),
            vectorizer_model_name: "".to_string(),
            search_api_key: SecretString::new(String::new().into()),
            search_endpoint: Url::from_str("https://example.com/does-not-exist/")?,
            search_connection_id: "".to_string(),
        });
        let blob_storage_config = Some(AzureBlobStorageConfiguration {
            storage_account: "".to_string(),
            access_key: SecretString::new(String::new().into()),
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
    /// RSA private key (PEM) used to sign OAuth/OIDC tokens. Secret: zeroized on drop,
    /// redacted from `Debug`; only exposed when handed to the signing key builder.
    pub rsa_private_key: SecretString,
    /// Secret key for HMAC-SHA-256 hashing of OAuth tokens (access tokens, refresh tokens, auth codes).
    pub oauth_token_hmac_key: SecretString,
    /// Secret key for signing DPoP nonces (HMAC).
    pub dpop_nonce_key: Arc<SecretBox<String>>,
}

impl PartialEq for OAuthServerConfiguration {
    fn eq(&self, other: &Self) -> bool {
        self.rsa_public_key == other.rsa_public_key
            && self.rsa_private_key.expose_secret() == other.rsa_private_key.expose_secret()
            && self.oauth_token_hmac_key.expose_secret()
                == other.oauth_token_hmac_key.expose_secret()
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
        let rsa_private_key = SecretString::new(
            env::var("OAUTH_RSA_PRIVATE_PEM")
                .context("OAUTH_RSA_PRIVATE_KEY must be defined")?
                .into(),
        );
        let oauth_token_hmac_key = SecretString::new(
            env::var("OAUTH_TOKEN_HMAC_KEY")
                .context("OAUTH_TOKEN_HMAC_KEY must be defined")?
                .into(),
        );
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn suotar_configuration_has_no_mock_fallback() {
        assert!(SuotarConfiguration::from_values(None, None, false, 365).is_err());
        assert!(
            SuotarConfiguration::from_values(
                Some("https://suotar.example.com/api".to_string()),
                None,
                false,
                365
            )
            .is_err()
        );
        assert!(
            SuotarConfiguration::from_values(None, Some("token".to_string()), false, 365).is_err()
        );
        assert!(
            SuotarConfiguration::from_values(
                Some("https://suotar.example.com/api".to_string()),
                Some("token".to_string()),
                false,
                365
            )
            .is_ok()
        );
    }

    /// `Url::join` replaces the whole path unless the base ends in `/`, so a base without one
    /// silently drops the `/api` prefix from every call.
    #[test]
    fn suotar_configuration_normalises_the_join_base() {
        let conf = SuotarConfiguration::from_values(
            Some("https://suotar.example.com/api".to_string()),
            Some("token".to_string()),
            false,
            365,
        )
        .expect("valid fixture values");
        assert_eq!(
            conf.api_base_url.as_str(),
            "https://suotar.example.com/api/"
        );
        assert_eq!(
            conf.api_base_url
                .join("persons/resolve-by-student-numbers")
                .expect("a relative join on a base ending in a slash")
                .as_str(),
            "https://suotar.example.com/api/persons/resolve-by-student-numbers"
        );
    }

    #[test]
    fn mock_conf_points_at_our_own_mock_controller() {
        let conf = SuotarConfiguration::mock_conf("http://project-331.local")
            .expect("valid fixture values");
        assert_eq!(
            conf.api_base_url.as_str(),
            "http://project-331.local/api/v0/mock-suotar/"
        );
        assert_eq!(conf.api_token.expose_secret(), MOCK_SUOTAR_TOKEN);
    }

    #[test]
    fn fast_track_defaults_are_off_and_a_year() {
        let conf = SuotarConfiguration::mock_conf("http://project-331.local")
            .expect("valid fixture values");
        assert!(!conf.fast_track_email_match_enabled);
        assert_eq!(conf.fast_track_max_email_verification_age_days, 365);
    }
}
