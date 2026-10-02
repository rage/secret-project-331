use anyhow::Context;
use headless_lms_base::{config::ApplicationConfiguration, program_config::ProgramConfig};
use headless_lms_gcs_file_store::runtime::FileStoreRuntimeConfig;
use secrecy::SecretString;
use std::{env, sync::OnceLock};

static SERVER_RUNTIME_CONFIG: OnceLock<ServerRuntimeConfig> = OnceLock::new();

#[derive(Clone)]
pub struct ServerRuntimeConfig {
    /// Database connection URL — contains credentials, so kept secret.
    pub database_url: SecretString,
    pub oauth_application_id: String,
    pub oauth_secret: SecretString,
    pub icu4x_postcard_path: String,
    pub app_conf: ApplicationConfiguration,
    /// Redis connection URL — may contain credentials, so kept secret.
    pub redis_url: SecretString,
    /// The mock Suotar's own Redis database, off the cache's index 1 so a flush cannot reach it.
    pub mock_suotar_redis_db_index: i64,
    pub private_cookie_key: SecretString,
    pub test_mode: bool,
    pub allow_no_https_for_development: bool,
    pub host: String,
    pub port: String,
    pub file_store: FileStoreRuntimeConfig,
    pub tmc_server_secret_for_communicating_to_secret_project: SecretString,
    pub ratelimit_protection_safe_api_key: SecretString,
    pub pod_namespace: String,
}

impl ServerRuntimeConfig {
    /// Loads runtime configuration from environment variables.
    pub fn try_from_env() -> anyhow::Result<Self> {
        let app_conf = ApplicationConfiguration::try_from_env()?;
        let test_mode = app_conf.test_mode;
        let file_store = FileStoreRuntimeConfig::try_from_env()?;
        let ratelimit_protection_safe_api_key = match env::var("RATELIMIT_PROTECTION_SAFE_API_KEY")
        {
            Ok(value) => value,
            Err(_) if cfg!(debug_assertions) || test_mode => "mock-api-key".to_string(),
            Err(_) => {
                anyhow::bail!("RATELIMIT_PROTECTION_SAFE_API_KEY must be defined in production")
            }
        };

        Ok(Self {
            database_url: SecretString::new(
                env::var("DATABASE_URL")
                    .context("DATABASE_URL must be defined")?
                    .into(),
            ),
            oauth_application_id: env::var("OAUTH_APPLICATION_ID")
                .context("OAUTH_APPLICATION_ID must be defined")?,
            oauth_secret: SecretString::new(
                env::var("OAUTH_SECRET")
                    .context("OAUTH_SECRET must be defined")?
                    .into(),
            ),
            icu4x_postcard_path: env::var("ICU4X_POSTCARD_PATH")
                .context("ICU4X_POSTCARD_PATH must be defined")?,
            redis_url: SecretString::new(
                env::var("REDIS_URL")
                    .context("REDIS_URL must be defined")?
                    .into(),
            ),
            mock_suotar_redis_db_index: env::var("MOCK_SUOTAR_REDIS_DB_INDEX")
                .ok()
                .and_then(|value| value.trim().parse().ok())
                .unwrap_or(2),
            private_cookie_key: SecretString::new(
                env::var("PRIVATE_COOKIE_KEY")
                    .context("PRIVATE_COOKIE_KEY must be defined")?
                    .into(),
            ),
            allow_no_https_for_development: ProgramConfig::bool_flag(
                "ALLOW_NO_HTTPS_FOR_DEVELOPMENT",
            ),
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("PORT").unwrap_or_else(|_| "3001".to_string()),
            file_store,
            tmc_server_secret_for_communicating_to_secret_project: SecretString::new(
                env::var("TMC_SERVER_SECRET_FOR_COMMUNICATING_TO_SECRET_PROJECT")
                    .context(
                        "TMC_SERVER_SECRET_FOR_COMMUNICATING_TO_SECRET_PROJECT must be defined",
                    )?
                    .into(),
            ),
            ratelimit_protection_safe_api_key: SecretString::new(
                ratelimit_protection_safe_api_key.into(),
            ),
            pod_namespace: env::var("POD_NAMESPACE").unwrap_or_else(|_| "default".to_string()),
            app_conf,
            test_mode,
        })
    }
}

/// Sets global runtime configuration for request-path consumers.
pub fn set_server_runtime_config(config: ServerRuntimeConfig) -> anyhow::Result<()> {
    SERVER_RUNTIME_CONFIG.set(config).map_err(|_| {
        anyhow::anyhow!(
            "SERVER_RUNTIME_CONFIG was already initialized in set_server_runtime_config"
        )
    })
}

/// Returns global runtime configuration loaded during startup.
pub fn server_runtime_config() -> &'static ServerRuntimeConfig {
    SERVER_RUNTIME_CONFIG
        .get()
        .expect("SERVER_RUNTIME_CONFIG has not been initialized; call set_server_runtime_config before request handling")
}
