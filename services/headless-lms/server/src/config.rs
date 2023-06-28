//! Functionality for configuring the server

use crate::{
    domain::{models_requests::JwtKey, request_span_middleware::RequestSpan},
    OAuthClient,
};
use actix_http::{body::MessageBody, StatusCode};
use actix_web::{
    error::InternalError,
    web::{self, Data, ServiceConfig},
    HttpResponse,
};
use anyhow::Context;
use headless_lms_utils::{
    cache::Cache, file_store::FileStore, icu4x::Icu4xBlob, ip_to_country::IpToCountryMapper,
    ApplicationConfiguration,
};
use oauth2::{basic::BasicClient, AuthUrl, ClientId, ClientSecret, TokenUrl};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::{env, sync::Arc};
use url::Url;

pub struct ServerConfigBuilder {
    pub database_url: String,
    pub oauth_application_id: String,
    pub oauth_secret: String,
    pub auth_url: Url,
    pub icu4x_postcard_path: String,
    pub file_store: Arc<dyn FileStore + Send + Sync>,
    pub app_conf: ApplicationConfiguration,
    pub redis_url: String,
    pub jwt_password: String,
}

impl ServerConfigBuilder {
    pub fn try_from_env() -> anyhow::Result<Self> {
        let builder = Self {
            database_url: env::var("DATABASE_URL").context("DATABASE_URL must be defined")?,
            oauth_application_id: env::var("OAUTH_APPLICATION_ID")
                .context("OAUTH_APPLICATION_ID must be defined")?,
            oauth_secret: env::var("OAUTH_SECRET").context("OAUTH_SECRET must be defined")?,
            auth_url: "https://tmc.mooc.fi/oauth/token"
                .parse()
                .expect("known to work"),
            icu4x_postcard_path: env::var("ICU4X_POSTCARD_PATH")
                .context("ICU4X_POSTCARD_PATH must be defined")?,
            file_store: crate::setup_file_store(),
            app_conf: ApplicationConfiguration {
                base_url: env::var("BASE_URL").context("BASE_URL must be defined")?,
                test_mode: env::var("TEST_MODE").is_ok(),
                development_uuid_login: env::var("DEVELOPMENT_UUID_LOGIN").is_ok(),
            },
            redis_url: env::var("REDIS_URL").context("REDIS_URL must be defined")?,
            jwt_password: env::var("JWT_PASSWORD").context("JWT_PASSWORD must be defined")?,
        };
        Ok(builder)
    }

    pub async fn build(self) -> anyhow::Result<ServerConfig> {
        let json_config = web::JsonConfig::default().limit(1048576).error_handler(
            |err, _req| -> actix_web::Error {
                info!("Bad request: {}", &err);
                let body = format!("{{\"title\": \"Bad Request\", \"message\": \"{}\"}}", &err);
                // create custom error response
                let response = HttpResponse::with_body(StatusCode::BAD_REQUEST, body.boxed());
                InternalError::from_response(err, response).into()
            },
        );
        let json_config = Data::new(json_config);

        let db_pool = PgPoolOptions::new()
            .max_connections(15)
            .min_connections(5)
            .connect(&self.database_url)
            .await?;
        let db_pool = Data::new(db_pool);

        let oauth_client: OAuthClient = Arc::new(BasicClient::new(
            ClientId::new(self.oauth_application_id),
            Some(ClientSecret::new(self.oauth_secret)),
            AuthUrl::from_url(self.auth_url.clone()),
            Some(TokenUrl::from_url(self.auth_url)),
        ));

        let icu4x_blob = Icu4xBlob::new(&self.icu4x_postcard_path)?;
        let icu4x_blob = Data::new(icu4x_blob);

        let ip_to_country_mapper = IpToCountryMapper::new()?;
        let ip_to_country_mapper = Data::new(ip_to_country_mapper);

        let app_conf = Data::new(self.app_conf);

        let cache = Cache::new(&self.redis_url).await;
        let cache = Data::new(cache);

        let jwt_key = JwtKey::new(&self.jwt_password)?;
        let jwt_key = Data::new(jwt_key);

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
        };
        Ok(config)
    }
}

#[derive(Clone)]
pub struct ServerConfig {
    pub json_config: Data<web::JsonConfig>,
    pub db_pool: Data<PgPool>,
    pub oauth_client: OAuthClient,
    pub icu4x_blob: Data<Icu4xBlob>,
    pub ip_to_country_mapper: Data<IpToCountryMapper>,
    pub file_store: Arc<dyn FileStore + Send + Sync>,
    pub app_conf: Data<ApplicationConfiguration>,
    pub cache: Data<Cache>,
    pub jwt_key: Data<JwtKey>,
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
    } = server_config;
    // turns file_store from `dyn FileStore + Send + Sync` to `dyn FileStore` to match controllers
    // Not using Data::new for file_store to avoid double wrapping it in a arc
    let file_store = Data::from(file_store as Arc<dyn FileStore>);
    config
        .app_data(json_config)
        .app_data(db_pool)
        .app_data(oauth_client)
        .app_data(icu4x_blob)
        .app_data(ip_to_country_mapper)
        .app_data(file_store)
        .app_data(app_conf)
        .app_data(jwt_key)
        .app_data(cache)
        .service(
            web::scope("/api/v0")
                .wrap(RequestSpan)
                .configure(crate::controllers::configure_controllers),
        );
}
