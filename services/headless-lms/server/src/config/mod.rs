//! Functionality for configuring the server
pub mod open_university_config;
pub mod program_config;

use crate::{
    OAuthClient,
    config::program_config::ProgramConfig,
    domain::{
        models_requests::JwtKey, rate_limit_middleware_builder::RateLimit,
        request_span_middleware::RequestSpan,
    },
};
use actix_http::{StatusCode, body::MessageBody};
use actix_web::{
    HttpResponse,
    error::InternalError,
    web::{self, Data, PayloadConfig, ServiceConfig},
};
use anyhow::Context;
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_utils::{
    cache::Cache, file_store::FileStore, icu4x::Icu4xBlob, ip_to_country::IpToCountryMapper,
    services::tmc::TmcClient,
};
use oauth2::{AuthUrl, ClientId, ClientSecret, TokenUrl, basic::BasicClient};
use secrecy::{ExposeSecret, SecretString};
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::{
    env,
    sync::{Arc, OnceLock},
};
use url::Url;

static SERVER_RUNTIME_CONFIG: OnceLock<ServerRuntimeConfig> = OnceLock::new();

#[derive(Clone)]
pub struct FileStoreRuntimeConfig {
    pub use_google_cloud_storage: bool,
    pub google_cloud_storage_bucket_name: Option<String>,
}

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
    pub jwt_password: SecretString,
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
        let file_store_use_google_cloud_storage =
            ProgramConfig::bool_flag("FILE_STORE_USE_GOOGLE_CLOUD_STORAGE");
        let google_cloud_storage_bucket_name = if file_store_use_google_cloud_storage {
            Some(
                env::var("GOOGLE_CLOUD_STORAGE_BUCKET_NAME")
                    .context("GOOGLE_CLOUD_STORAGE_BUCKET_NAME must be defined when FILE_STORE_USE_GOOGLE_CLOUD_STORAGE is enabled")?,
            )
        } else {
            None
        };
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
            jwt_password: SecretString::new(
                env::var("JWT_PASSWORD")
                    .context("JWT_PASSWORD must be defined")?
                    .into(),
            ),
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
            file_store: FileStoreRuntimeConfig {
                use_google_cloud_storage: file_store_use_google_cloud_storage,
                google_cloud_storage_bucket_name,
            },
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

pub struct ServerConfigBuilder {
    pub database_url: SecretString,
    pub oauth_application_id: String,
    pub oauth_secret: SecretString,
    pub auth_url: Url,
    pub token_url: Url,
    pub icu4x_postcard_path: String,
    pub file_store: Arc<dyn FileStore + Send + Sync>,
    pub app_conf: ApplicationConfiguration,
    pub redis_url: SecretString,
    pub jwt_password: SecretString,
    pub tmc_client: TmcClient,
}

impl ServerConfigBuilder {
    pub async fn from_runtime_config(runtime_config: &ServerRuntimeConfig) -> anyhow::Result<Self> {
        Ok(Self {
            database_url: runtime_config.database_url.clone(),
            oauth_application_id: runtime_config.oauth_application_id.clone(),
            oauth_secret: runtime_config.oauth_secret.clone(),
            auth_url: "https://tmc.mooc.fi/oauth/authorize"
                .parse()
                .context("Failed to parse auth_url")?,
            token_url: "https://tmc.mooc.fi/oauth/token"
                .parse()
                .context("Failed to parse token url")?,
            icu4x_postcard_path: runtime_config.icu4x_postcard_path.clone(),
            file_store: crate::setup_file_store(
                &runtime_config.file_store,
                &runtime_config.app_conf.base_url,
            )
            .await,
            app_conf: runtime_config.app_conf.clone(),
            redis_url: runtime_config.redis_url.clone(),
            jwt_password: runtime_config.jwt_password.clone(),
            tmc_client: TmcClient::new(
                runtime_config.app_conf.tmc_admin_access_token.clone(),
                runtime_config.ratelimit_protection_safe_api_key.clone(),
            )?,
        })
    }

    pub async fn build(self) -> anyhow::Result<ServerConfig> {
        let json_config = web::JsonConfig::default().limit(2_097_152).error_handler(
            |err, _req| -> actix_web::Error {
                info!("Bad request: {}", &err);
                let body = format!("{{\"title\": \"Bad Request\", \"message\": \"{}\"}}", &err);
                // create custom error response
                let response = HttpResponse::with_body(StatusCode::BAD_REQUEST, body.boxed());
                InternalError::from_response(err, response).into()
            },
        );
        let json_config = Data::new(json_config);

        let payload_config = PayloadConfig::default().limit(2_097_152);
        let payload_config = Data::new(payload_config);

        let db_pool = PgPoolOptions::new()
            .max_connections(15)
            .min_connections(5)
            .connect(self.database_url.expose_secret())
            .await?;
        crate::domain::internal_error_reporting::init_error_reporting(db_pool.clone());
        let db_pool = Data::new(db_pool);

        let oauth_client: OAuthClient = BasicClient::new(ClientId::new(self.oauth_application_id))
            .set_client_secret(ClientSecret::new(
                self.oauth_secret.expose_secret().to_string(),
            ))
            .set_auth_uri(AuthUrl::from_url(self.auth_url.clone()))
            .set_token_uri(TokenUrl::from_url(self.token_url.clone()));
        let oauth_client = Data::new(oauth_client);

        let icu4x_blob = Icu4xBlob::new(&self.icu4x_postcard_path)?;
        let icu4x_blob = Data::new(icu4x_blob);

        let app_conf = Data::new(self.app_conf);

        let ip_to_country_mapper = IpToCountryMapper::new(&app_conf)?;
        let ip_to_country_mapper = Data::new(ip_to_country_mapper);

        let cache = Cache::new(self.redis_url.expose_secret())?;
        let cache = Data::new(cache);

        let jwt_key = JwtKey::new(&self.jwt_password)?;
        let jwt_key = Data::new(jwt_key);

        let tmc_client = Data::new(self.tmc_client);

        let config = ServerConfig {
            json_config,
            db_pool,
            oauth_client,
            icu4x_blob,
            ip_to_country_mapper,
            file_store: self.file_store,
            app_conf,
            jwt_key,
            cache,
            payload_config,
            tmc_client,
        };
        Ok(config)
    }
}

#[derive(Clone)]
pub struct ServerConfig {
    pub payload_config: Data<PayloadConfig>,
    pub json_config: Data<web::JsonConfig>,
    pub db_pool: Data<PgPool>,
    pub oauth_client: Data<OAuthClient>,
    pub icu4x_blob: Data<Icu4xBlob>,
    pub ip_to_country_mapper: Data<IpToCountryMapper>,
    pub file_store: Arc<dyn FileStore + Send + Sync>,
    pub app_conf: Data<ApplicationConfiguration>,
    pub cache: Data<Cache>,
    pub jwt_key: Data<JwtKey>,
    pub tmc_client: Data<TmcClient>,
}

/// Common configuration that is used by both production and testing.
pub fn configure(config: &mut ServiceConfig, server_config: ServerConfig) {
    let ServerConfig {
        json_config,
        db_pool,
        oauth_client,
        icu4x_blob,
        ip_to_country_mapper,
        file_store,
        app_conf,
        jwt_key,
        cache,
        payload_config,
        tmc_client,
    } = server_config;
    let api_rate_limit_config = RateLimit::global_api_rate_limit_config(app_conf.test_mode);
    // turns file_store from `dyn FileStore + Send + Sync` to `dyn FileStore` to match controllers
    // Not using Data::new for file_store to avoid double wrapping it in a arc
    let file_store = Data::from(file_store as Arc<dyn FileStore>);
    config
        .app_data(payload_config)
        .app_data(json_config)
        .app_data(db_pool)
        .app_data(oauth_client)
        .app_data(icu4x_blob)
        .app_data(ip_to_country_mapper)
        .app_data(file_store)
        .app_data(app_conf.clone())
        .app_data(jwt_key)
        .app_data(cache)
        .app_data(tmc_client)
        .service(
            web::scope("/api/v0")
                .wrap(RateLimit::new(api_rate_limit_config))
                .wrap(RequestSpan)
                .configure(|c| crate::controllers::configure_controllers(c, app_conf)),
        );
}
