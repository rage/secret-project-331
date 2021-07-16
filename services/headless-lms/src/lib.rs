pub mod controllers;
pub mod domain;
pub mod models;
pub mod regrading;
pub mod utils;

#[cfg(test)]
pub mod test_helper;

#[macro_use]
extern crate tracing;

use actix_http::error::InternalError;
use actix_web::web::{self, HttpResponse, ServiceConfig};
use anyhow::Result;
use oauth2::basic::BasicClient;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing_actix_web::TracingLogger;
use tracing_error::ErrorLayer;
use tracing_log::LogTracer;
use tracing_subscriber::{prelude::__tracing_subscriber_SubscriberExt, EnvFilter};
use utils::file_store::FileStore;

pub type OAuthClient = Arc<BasicClient>;

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct ApplicationConfiguration {
    pub base_url: String,
    pub test_mode: bool,
}

pub fn configure<T: 'static + FileStore>(
    config: &mut ServiceConfig,
    file_store: T,
    app_conf: ApplicationConfiguration,
) {
    let json_config = web::JsonConfig::default()
        .limit(81920)
        .error_handler(|err, _req| {
            info!("Bad request: {}", &err);
            // create custom error response
            let response = HttpResponse::BadRequest().body(format!(
                "{{\"title\": \"Bad Request\", \"detail\": \"{}\"}}",
                &err
            ));
            InternalError::from_response(err, response).into()
        });
    config
        .app_data(json_config)
        .service(
            web::scope("/api/v0")
                .wrap(TracingLogger::default())
                .configure(controllers::configure_controllers::<T>),
        )
        .data(file_store)
        .data(app_conf);
}

/**
Sets up tokio tracing. Also makes sure that log statements from libraries respect the log level
settings that have been set with RUST_LOG, for example:

```no_run
use std::env;
env::set_var("RUST_LOG", "info,actix_web=info,sqlx=warn");
```
*/
pub fn setup_tracing() -> Result<()> {
    let subscriber = tracing_subscriber::Registry::default()
        .with(tracing_subscriber::fmt::layer())
        .with(ErrorLayer::default())
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")));
    tracing::subscriber::set_global_default(subscriber)?;
    LogTracer::init()?;
    Ok(())
}
