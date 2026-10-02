//! Functionality for configuring the server

use headless_lms_base::program_config::ProgramConfig;

use crate::OAuthClient;
use actix_http::{StatusCode, body::MessageBody};
use actix_web::{
    HttpResponse,
    error::InternalError,
    web::{self, Data, PayloadConfig, ServiceConfig},
};
use anyhow::Context;
use headless_lms_base::{config::ApplicationConfiguration, jwt::JwtKey};
use headless_lms_cache::cache::Cache;
use headless_lms_credit_registration::is_waiting_item;
use headless_lms_file_store::file_store::FileStore;
use headless_lms_gcs_file_store::runtime::setup_file_store;
use headless_lms_http_api::controllers;
use headless_lms_mock_suotar::mock_suotar::store::MockSuotarStore;
use headless_lms_models::suotar_api_calls::PgSuotarCallAudit;
use headless_lms_use_cases::domain;
use headless_lms_utils::{
    icu4x::Icu4xBlob, ip_to_country::IpToCountryMapper, services::sisu::SisuClient,
    services::suotar::SuotarClient, services::tmc::TmcClient,
};
use oauth2::{AuthUrl, ClientId, ClientSecret, TokenUrl, basic::BasicClient};
use secrecy::{ExposeSecret, SecretString};
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::{
    env,
    sync::{Arc, OnceLock},
};
use url::Url;

pub use headless_lms_use_cases::config::{
    ServerRuntimeConfig, server_runtime_config, set_server_runtime_config,
};

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
    pub mock_suotar_redis_db_index: i64,
    pub tmc_client: TmcClient,
    pub sisu_client: SisuClient,
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
            file_store: setup_file_store(
                &runtime_config.file_store,
                &runtime_config.app_conf.base_url,
            )
            .await,
            app_conf: runtime_config.app_conf.clone(),
            redis_url: runtime_config.redis_url.clone(),
            mock_suotar_redis_db_index: runtime_config.mock_suotar_redis_db_index,
            tmc_client: TmcClient::new(
                runtime_config.app_conf.tmc_admin_access_token.clone(),
                runtime_config.ratelimit_protection_safe_api_key.clone(),
            )?,
            sisu_client: SisuClient::new(runtime_config.app_conf.base_url.clone())?,
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
        domain::internal_error_reporting::init_error_reporting(db_pool.clone());
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

        // Only the mock's own routes need this, and they exist only under the same flag.
        let mock_suotar_store = if app_conf.test_suotar {
            warn!(
                "MOCK SUOTAR ENABLED - credit registrations are simulated and are NOT recorded in Sisu"
            );
            Some(Data::new(MockSuotarStore::new(
                self.redis_url.expose_secret(),
                self.mock_suotar_redis_db_index,
            )?))
        } else {
            None
        };

        let jwt_key = Data::new(JwtKey::new(&app_conf.jwt_password)?);

        let tmc_client = Data::new(self.tmc_client);

        let sisu_client = Data::new(self.sisu_client);

        // Built here rather than in `from_runtime_config` because auditing every call needs the pool.
        let suotar_client = Data::new(SuotarClient::new(
            &app_conf.suotar_configuration,
            Arc::new(PgSuotarCallAudit::new(
                db_pool.as_ref().clone(),
                is_waiting_item,
            )),
        ));

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
            sisu_client,
            suotar_client,
            mock_suotar_store,
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
    pub sisu_client: Data<SisuClient>,
    pub suotar_client: Data<SuotarClient>,
    pub mock_suotar_store: Option<Data<MockSuotarStore>>,
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
        sisu_client,
        suotar_client,
        mock_suotar_store,
    } = server_config;
    // turns file_store from `dyn FileStore + Send + Sync` to `dyn FileStore` to match controllers
    // Not using Data::new for file_store to avoid double wrapping it in a arc
    let file_store = Data::from(file_store as Arc<dyn FileStore>);
    if let Some(mock_suotar_store) = mock_suotar_store {
        config.app_data(mock_suotar_store);
    }
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
        .app_data(sisu_client)
        .app_data(suotar_client)
        .configure(|cfg| controllers::configure_api(cfg, app_conf));
}
