use crate::jwt::DEVELOPMENT_JWT_PASSWORD;
use anyhow::Context;
use chrono::{DateTime, Utc};
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

/// Parses a [`Url::join`] base, adding the trailing slash one needs: joining onto a base without it
/// replaces the base's last path segment instead of extending it.
///
/// On the parsed path, never the raw string: a slash appended to the string lands inside any query
/// or fragment the value carries, and makes trailing whitespace the parser would have trimmed
/// interior, where it percent-encodes instead.
fn parse_join_base(url: &str) -> Result<Url, url::ParseError> {
    let mut url = Url::parse(url)?;
    if !url.path().ends_with('/') {
        url.set_path(&format!("{}/", url.path()));
    }
    Ok(url)
}

#[derive(Clone)]
pub struct ApplicationConfiguration {
    pub base_url: String,
    pub test_mode: bool,
    pub test_chatbot: bool,
    pub test_sisu: bool,
    pub test_suotar: bool,
    pub test_moocfi: bool,
    pub disable_embedding_vector_creation_when_seeding: bool,
    pub development_uuid_login: bool,
    pub enable_admin_email_verification: bool,
    pub enable_email_ownership_verification: bool,
    pub azure_configuration: Option<AzureConfiguration>,
    pub suotar_configuration: SuotarConfiguration,
    pub moocfi_configuration: MoocfiConfiguration,
    pub tmc_account_creation_origin: Option<String>,
    pub tmc_admin_access_token: SecretString,
    pub oauth_server_configuration: OAuthServerConfiguration,
    /// Signing secret for the claims the host mints for exercise services and for the URLs it
    /// hands out for answer files; callers build a [`crate::jwt::JwtKey`] from it at the point of
    /// use. Carried here because the answer readers that mint those URLs live below the crate that
    /// owns the claims.
    pub jwt_password: SecretString,
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

        let test_moocfi = test_mode && bool_env_false_by_default("USE_MOCK_MOOCFI_ENDPOINT");

        let disable_embedding_vector_creation_when_seeding = false;

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

        let moocfi_configuration = if test_moocfi {
            MoocfiConfiguration::mock_conf(&base_url)?
        } else {
            MoocfiConfiguration::try_from_env()?
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
        let jwt_password = SecretString::new(
            env::var("JWT_PASSWORD")
                .context("JWT_PASSWORD must be defined")?
                .into(),
        );

        Ok(Self {
            base_url,
            test_mode,
            test_chatbot,
            test_sisu,
            test_suotar,
            test_moocfi,
            disable_embedding_vector_creation_when_seeding,
            development_uuid_login,
            enable_admin_email_verification,
            enable_email_ownership_verification,
            azure_configuration,
            suotar_configuration,
            moocfi_configuration,
            tmc_account_creation_origin,
            tmc_admin_access_token,
            oauth_server_configuration,
            jwt_password,
        })
    }

    pub fn mock_conf() -> anyhow::Result<Self> {
        let test_mode = true;
        let base_url = "http://project-331.local/".to_string();
        let development_uuid_login = false;
        let enable_admin_email_verification = false;
        let enable_email_ownership_verification = false;
        let azure_configuration = AzureConfiguration::mock_conf()?;
        let test_chatbot = true;
        let test_sisu = true;
        let test_suotar = false;
        let test_moocfi = false;
        let disable_embedding_vector_creation_when_seeding = true;
        let suotar_configuration = SuotarConfiguration::mock_conf("http://project-331.local")
            .expect("Failed to build the mock Suotar configuration");
        let moocfi_configuration = MoocfiConfiguration::mock_conf("http://project-331.local")
            .expect("Failed to build the mock mooc.fi configuration");
        let tmc_account_creation_origin = None;
        let tmc_admin_access_token = SecretString::new("mock-access-token".to_string().into());
        let oauth_server_configuration = OAuthServerConfiguration {
            rsa_public_key: "temp-change-when-needed".into(),
            rsa_private_key: SecretString::new("test-change".into()),
            oauth_token_hmac_key: SecretString::new("pippuri".into()),
            dpop_nonce_key: std::sync::Arc::new(secrecy::SecretBox::new(Box::new(
                "test-key".into(),
            ))),
        };
        let jwt_password = SecretString::new(DEVELOPMENT_JWT_PASSWORD.to_string().into());
        Ok(Self {
            base_url,
            test_mode,
            test_chatbot,
            test_sisu,
            test_suotar,
            test_moocfi,
            disable_embedding_vector_creation_when_seeding,
            development_uuid_login,
            enable_admin_email_verification,
            enable_email_ownership_verification,
            azure_configuration,
            suotar_configuration,
            moocfi_configuration,
            tmc_account_creation_origin,
            tmc_admin_access_token,
            oauth_server_configuration,
            jwt_password,
        })
    }
}

/// The scheme word Suotar requires before the API key.
pub const SUOTAR_AUTH_SCHEME: &str = "Bearer";

/// The only token the mock Suotar accepts. Public on purpose: never a real credential.
pub const MOCK_SUOTAR_TOKEN: &str = "mock-suotar-token";

/// Where and how to reach Suotar's moocfi API. In production the base url is
/// `https://opetushallinto.cs.helsinki.fi/suoritustarkistin/api/moocfi/`.
#[derive(Clone)]
pub struct SuotarConfiguration {
    /// Ends in `/` because it is a [`Url::join`] base and joined paths must be relative.
    pub api_base_url: Url,
    pub api_token: SecretString,
    /// Switches account linking on, and only people who enrolled at or after it are mailed a link,
    /// so turning it on does not mail everyone already on a roster. `None` where students get their
    /// number linked some other way.
    pub account_linking_since: Option<DateTime<Utc>>,
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
            account_linking_since: Self::account_linking_since_from_env()?,
        })
    }

    pub fn try_from_env() -> anyhow::Result<Self> {
        Self::from_values(
            non_empty_env("SUOTAR_API_BASE_URL"),
            non_empty_env("SUOTAR_API_KEY"),
            Self::account_linking_since_from_env()?,
        )
    }

    /// Whether account linking is on.
    pub fn is_account_linking_enabled(&self) -> bool {
        self.account_linking_since.is_some()
    }

    fn account_linking_since_from_env() -> anyhow::Result<Option<DateTime<Utc>>> {
        non_empty_env("SUOTAR_ACCOUNT_LINKING_SINCE")
            .map(|since| {
                DateTime::parse_from_rfc3339(&since)
                    .map(|since| since.with_timezone(&Utc))
                    .context("SUOTAR_ACCOUNT_LINKING_SINCE must be an RFC 3339 timestamp")
            })
            .transpose()
    }

    /// Pure so the no-mock-fallback rule can be tested without touching process env.
    fn from_values(
        api_base_url: Option<String>,
        api_token: Option<String>,
        account_linking_since: Option<DateTime<Utc>>,
    ) -> anyhow::Result<Self> {
        let api_base_url = api_base_url.context(
            "SUOTAR_API_BASE_URL must be defined unless TEST_MODE and USE_MOCK_SUOTAR_ENDPOINT are both on. Credit registration writes to the real student registry, so there is no mock fallback.",
        )?;
        let api_token = api_token.context(
            "SUOTAR_API_KEY must be defined unless TEST_MODE and USE_MOCK_SUOTAR_ENDPOINT are both on. Credit registration writes to the real student registry, so there is no mock fallback.",
        )?;
        Ok(Self {
            api_base_url: parse_join_base(&api_base_url)
                .context("Invalid URL in SUOTAR_API_BASE_URL")?,
            api_token: SecretString::new(api_token.into()),
            account_linking_since,
        })
    }
}

/// The only organization secret the mock mooc.fi accepts. Public on purpose: never a real credential.
pub const MOCK_MOOCFI_ORGANIZATION_SECRET: &str = "mock-moocfi-organization-secret";

/// The organization slug the mock mooc.fi records our registrations under.
pub const MOCK_MOOCFI_ORGANIZATION_SLUG: &str = "courses-mooc-fi-mock";

/// The handoff secret the mock mooc.fi mints with. Public on purpose: never a real credential.
pub const MOCK_MOOCFI_HANDOFF_SECRET: &str = "mock-moocfi-handoff-secret";

const DEFAULT_MOOCFI_URL: &str = "https://www.mooc.fi/";

/// Where mooc.fi is and, when delegated credit registration is on, how courses talks to it.
#[derive(Clone)]
pub struct MoocfiConfiguration {
    /// mooc.fi's backend; its GraphQL API is under it. Ends in `/`, as a [`Url::join`] base.
    pub base_url: Url,
    /// mooc.fi's student-facing site, for links back to a course's registration page. Ends in `/`.
    pub frontend_url: Url,
    /// `None` turns delegated credit registration off: no lookups, no report-back.
    pub delegation: Option<MoocfiDelegationConfiguration>,
    /// Bearer secret mooc.fi's backend mints handoffs with. `None` closes the mint.
    pub handoff_secret: Option<SecretString>,
}

/// How courses calls mooc.fi's organization API as the organization that registers delegated
/// completions.
#[derive(Clone)]
pub struct MoocfiDelegationConfiguration {
    /// The root the `api/...` routes are joined onto; [`MoocfiConfiguration::base_url`] except under
    /// the mock. Ends in `/`.
    pub api_base_url: Url,
    pub organization_secret: SecretString,
    /// Our organization's slug on mooc.fi, which tells our registrations from other registrars'.
    pub organization_slug: String,
}

impl MoocfiConfiguration {
    /// Points delegation and the student-facing links at our own mock controller; the GraphQL API
    /// stays wherever `MOOCFI_BASE_URL` says, so dev logins keep their real mooc.fi ids.
    pub fn mock_conf(base_url: &str) -> anyhow::Result<Self> {
        let mock_url = Url::parse(base_url)
            .context("Invalid URL in BASE_URL")?
            .join("/api/v0/mock-moocfi/")?;
        Ok(Self {
            base_url: Self::base_url_from_env()?,
            frontend_url: mock_url.clone(),
            delegation: Some(MoocfiDelegationConfiguration {
                api_base_url: mock_url,
                organization_secret: SecretString::new(
                    MOCK_MOOCFI_ORGANIZATION_SECRET.to_string().into(),
                ),
                organization_slug: MOCK_MOOCFI_ORGANIZATION_SLUG.to_string(),
            }),
            handoff_secret: Some(SecretString::new(
                MOCK_MOOCFI_HANDOFF_SECRET.to_string().into(),
            )),
        })
    }

    /// Never fails on a missing variable: delegation is optional, and a missing secret must not
    /// keep the server from booting. Fails only on a set value that does not parse.
    pub fn try_from_env() -> anyhow::Result<Self> {
        let base_url = Self::base_url_from_env()?;
        let frontend_url = parse_join_base(
            non_empty_env("MOOCFI_FRONTEND_URL")
                .as_deref()
                .unwrap_or(DEFAULT_MOOCFI_URL),
        )
        .context("Invalid URL in MOOCFI_FRONTEND_URL")?;
        let delegation = match (
            non_empty_env("MOOCFI_ORGANIZATION_SECRET"),
            non_empty_env("MOOCFI_ORGANIZATION_SLUG"),
        ) {
            (Some(organization_secret), Some(organization_slug)) => {
                Some(MoocfiDelegationConfiguration {
                    api_base_url: base_url.clone(),
                    organization_secret: SecretString::new(organization_secret.into()),
                    organization_slug,
                })
            }
            (None, None) => None,
            _ => {
                tracing::warn!(
                    "Delegated mooc.fi credit registration is off: MOOCFI_ORGANIZATION_SECRET and MOOCFI_ORGANIZATION_SLUG must both be set"
                );
                None
            }
        };
        Ok(Self {
            base_url,
            frontend_url,
            delegation,
            handoff_secret: non_empty_env("MOOCFI_HANDOFF_SECRET")
                .map(|secret| SecretString::new(secret.into())),
        })
    }

    /// mooc.fi's GraphQL endpoint.
    pub fn graphql_url(&self) -> anyhow::Result<Url> {
        Ok(self.base_url.join("api")?)
    }

    fn base_url_from_env() -> anyhow::Result<Url> {
        parse_join_base(
            non_empty_env("MOOCFI_BASE_URL")
                .as_deref()
                .unwrap_or(DEFAULT_MOOCFI_URL),
        )
        .context("Invalid URL in MOOCFI_BASE_URL")
    }
}

#[derive(Clone)]
pub struct AzureChatbotConfiguration {
    pub api_key: SecretString,
    /// Ends in `/` because it is a [`Url::join`] base and joined paths must be relative.
    pub api_base: Url,
    pub project_name: String,
}

impl AzureChatbotConfiguration {
    /// Attempts to create an AzureChatbotConfiguration from environment variables.
    ///
    /// Needs all three of `AZURE_CHATBOT_API_KEY`, `AZURE_CHATBOT_API_ENDPOINT` and
    /// `AZURE_PROJECT_NAME`. Any of them missing gives `Ok(None)` rather than an error, so a caller
    /// that requires a chatbot has to reject the `None` itself. Errors only on a set value that
    /// fails to parse.
    pub fn try_from_env() -> anyhow::Result<Option<Self>> {
        let api_key = env::var("AZURE_CHATBOT_API_KEY").ok();
        let api_endpoint = env::var("AZURE_CHATBOT_API_ENDPOINT").ok();
        let project_name = env::var("AZURE_PROJECT_NAME").ok();

        if let (Some(api_key), Some(api_endpoint), Some(project_name)) =
            (api_key, api_endpoint, project_name)
        {
            Ok(Some(Self::from_values(
                api_key,
                &api_endpoint,
                project_name,
            )?))
        } else {
            Ok(None)
        }
    }

    /// Pure so the join base can be tested without touching process env.
    fn from_values(
        api_key: String,
        api_endpoint: &str,
        project_name: String,
    ) -> anyhow::Result<Self> {
        Ok(Self {
            api_key: SecretString::new(api_key.into()),
            api_base: parse_join_base(api_endpoint)
                .context("Invalid URL in AZURE_CHATBOT_API_ENDPOINT")?,
            project_name,
        })
    }

    pub fn responses_endpoint(&self) -> anyhow::Result<Url> {
        Ok(self.api_base.join(&format!(
            "api/projects/{}/openai/v1/responses",
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
        let base_url =
            env::var("BASE_URL").unwrap_or_else(|_| "http://project-331.local/".to_string());
        let chatbot_config = Some(AzureChatbotConfiguration {
            api_key: SecretString::new(String::new().into()),
            api_base: Url::parse(&base_url)?.join("/api/v0/mock-azure/")?,
            project_name: String::from("test"),
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
        assert!(SuotarConfiguration::from_values(None, None, None).is_err());
        assert!(
            SuotarConfiguration::from_values(
                Some("https://suotar.example.com/api".to_string()),
                None,
                None
            )
            .is_err()
        );
        assert!(SuotarConfiguration::from_values(None, Some("token".to_string()), None).is_err());
        assert!(
            SuotarConfiguration::from_values(
                Some("https://suotar.example.com/api".to_string()),
                Some("token".to_string()),
                None
            )
            .is_ok()
        );
    }

    /// `Url::join` replaces the whole path unless the base ends in `/`, so a base without one
    /// silently drops the `/api` prefix from every call.
    #[test]
    fn suotar_configuration_normalises_the_join_base() {
        let conf = SuotarConfiguration::from_values(
            Some("https://opetushallinto.cs.helsinki.fi/suoritustarkistin/api/moocfi".to_string()),
            Some("token".to_string()),
            None,
        )
        .expect("valid fixture values");
        assert_eq!(
            conf.api_base_url.as_str(),
            "https://opetushallinto.cs.helsinki.fi/suoritustarkistin/api/moocfi/"
        );
        assert_eq!(
            conf.api_base_url
                .join("persons/resolve-by-student-numbers")
                .expect("a relative join on a base ending in a slash")
                .as_str(),
            "https://opetushallinto.cs.helsinki.fi/suoritustarkistin/api/moocfi/persons/resolve-by-student-numbers"
        );
    }

    fn azure_chatbot_conf(api_endpoint: &str) -> AzureChatbotConfiguration {
        AzureChatbotConfiguration::from_values(
            "key".to_string(),
            api_endpoint,
            "some-project".to_string(),
        )
        .expect("valid fixture values")
    }

    fn azure_chatbot_embeddings_endpoint(api_endpoint: &str) -> String {
        azure_chatbot_conf(api_endpoint)
            .embeddings_endpoint()
            .expect("a relative join on a base ending in a slash")
            .to_string()
    }

    #[test]
    fn azure_chatbot_configuration_normalises_the_join_base() {
        let conf = azure_chatbot_conf("https://example.services.ai.azure.com/foundry");
        assert_eq!(
            conf.api_base.as_str(),
            "https://example.services.ai.azure.com/foundry/"
        );
        assert_eq!(
            conf.responses_endpoint()
                .expect("a relative join on a base ending in a slash")
                .as_str(),
            "https://example.services.ai.azure.com/foundry/api/projects/some-project/openai/v1/responses"
        );
        assert_eq!(
            conf.embeddings_endpoint()
                .expect("a relative join on a base ending in a slash")
                .as_str(),
            "https://example.services.ai.azure.com/foundry/openai/v1/embeddings"
        );
    }

    /// `AZURE_CHATBOT_API_ENDPOINT` is read untrimmed, so a file-mounted secret hands over whatever
    /// whitespace the file ends with, and a deployment pinning `api-version` hands over a query.
    #[test]
    fn a_query_a_fragment_or_stray_whitespace_does_not_move_the_join_base() {
        assert_eq!(
            azure_chatbot_embeddings_endpoint(
                "https://example.services.ai.azure.com/foundry?api-version=2024-10-21"
            ),
            "https://example.services.ai.azure.com/foundry/openai/v1/embeddings"
        );
        assert_eq!(
            azure_chatbot_embeddings_endpoint(
                "https://example.services.ai.azure.com/foundry#anchor"
            ),
            "https://example.services.ai.azure.com/foundry/openai/v1/embeddings"
        );
        assert_eq!(
            azure_chatbot_embeddings_endpoint("https://example.services.ai.azure.com/foundry "),
            "https://example.services.ai.azure.com/foundry/openai/v1/embeddings"
        );
        assert_eq!(
            azure_chatbot_embeddings_endpoint("https://example.services.ai.azure.com/foundry/ "),
            "https://example.services.ai.azure.com/foundry/openai/v1/embeddings"
        );
    }

    #[test]
    fn a_join_base_that_already_ends_in_a_slash_is_left_as_it_is() {
        assert_eq!(
            azure_chatbot_conf("https://example.services.ai.azure.com/foundry/")
                .api_base
                .as_str(),
            "https://example.services.ai.azure.com/foundry/"
        );
        assert_eq!(
            azure_chatbot_conf("https://example.services.ai.azure.com/foundry//")
                .api_base
                .as_str(),
            "https://example.services.ai.azure.com/foundry//"
        );
        assert_eq!(
            azure_chatbot_conf("https://example.services.ai.azure.com")
                .api_base
                .as_str(),
            "https://example.services.ai.azure.com/"
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
}
