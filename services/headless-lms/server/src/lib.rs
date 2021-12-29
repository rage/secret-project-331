pub mod controllers;
pub mod domain;
pub mod regrading;

#[cfg(test)]
pub mod test_helper;

#[macro_use]
extern crate tracing;

use std::sync::Arc;

use actix_http::{body::AnyBody, StatusCode};
use actix_web::{
    error::InternalError,
    web::{self, Data, ServiceConfig},
    HttpResponse,
};
use anyhow::Result;
pub use headless_lms_models as models;
pub use headless_lms_utils as utils;
use oauth2::basic::BasicClient;
// use tracing_actix_web::TracingLogger;
use tracing_error::ErrorLayer;
use tracing_log::LogTracer;
use tracing_subscriber::{prelude::__tracing_subscriber_SubscriberExt, EnvFilter};
use utils::{file_store::FileStore, ApplicationConfiguration};

pub type OAuthClient = Arc<BasicClient>;

pub fn configure(
    config: &mut ServiceConfig,
    file_store: Arc<dyn FileStore>,
    app_conf: ApplicationConfiguration,
) {
    let json_config =
        web::JsonConfig::default()
            .limit(1048576)
            .error_handler(|err, _req| -> actix_web::Error {
                info!("Bad request: {}", &err);
                let body = format!("{{\"title\": \"Bad Request\", \"message\": \"{}\"}}", &err);
                let body_bytes = body.as_bytes();
                // create custom error response
                let response = HttpResponse::with_body(
                    StatusCode::BAD_REQUEST,
                    AnyBody::copy_from_slice(body_bytes),
                );
                InternalError::from_response(err, response).into()
            });
    config
        .app_data(json_config)
        .service(
            web::scope("/api/v0")
                // .wrap(TracingLogger::default())
                .configure(controllers::configure_controllers),
        )
        // Not using Data::new for file_store to avoid double wrapping it in a arc
        .app_data(Data::from(file_store))
        .app_data(Data::new(app_conf));
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
        .with(
            tracing_subscriber::fmt::layer()
                .event_format(tracing_subscriber::fmt::format().compact()),
        )
        .with(ErrorLayer::default())
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")));
    tracing::subscriber::set_global_default(subscriber)?;
    LogTracer::init()?;
    Ok(())
}
