/*!
The server that handles the requests.

## See also

* [headless_lms_utils]
* [headless_lms_models]
*/

pub mod config;
pub mod controllers;
pub mod domain;
pub mod prelude;

pub mod programs;
#[cfg(test)]
pub mod test_helper;
#[cfg(all(test, feature = "ts_rs"))]
pub mod ts_binding_generator;

#[macro_use]
extern crate tracing;

#[macro_use]
extern crate doc_macro;

use anyhow::Result;
use headless_lms_utils::file_store::{
    google_cloud_file_store::GoogleCloudFileStore, local_file_store::LocalFileStore, FileStore,
};
use oauth2::{EndpointNotSet, EndpointSet};
use std::{env, sync::Arc};
use tracing_error::ErrorLayer;
use tracing_log::LogTracer;
use tracing_subscriber::{layer::SubscriberExt, EnvFilter};

pub type OAuthClient = oauth2::basic::BasicClient<
    EndpointSet,
    EndpointNotSet,
    EndpointNotSet,
    EndpointNotSet,
    EndpointSet,
>;

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

/**
Setups file store so that it can be passed to actix web as data.
Using Arc here so that this can be accessed from all the different worker threads.
*/
pub fn setup_file_store() -> Arc<dyn FileStore + Send + Sync> {
    if env::var("FILE_STORE_USE_GOOGLE_CLOUD_STORAGE").is_ok() {
        info!("Using Google Cloud Storage as the file store");
        let bucket_name = env::var("GOOGLE_CLOUD_STORAGE_BUCKET_NAME").expect("env FILE_STORE_USE_GOOGLE_CLOUD_STORAGE was defined but GOOGLE_CLOUD_STORAGE_BUCKET_NAME was not.");
        Arc::new(GoogleCloudFileStore::new(bucket_name).expect("Failed to initialize file store"))
    } else {
        info!("Using local file storage as the file store");
        Arc::new(
            LocalFileStore::new(
                "uploads".into(),
                "http://project-331.local/api/v0/files/uploads/".into(),
            )
            .expect("Failed to initialize file store"),
        )
    }
}

/// Includes the type's JSON example and/or TypeScript definition
/// generated by doc-file-generator as a string.
/// Used with the helper macro from the doc-macro crate: #[generated_doc]
#[macro_export]
macro_rules! generated_docs {
    ($t: expr_2021, ts) => {
        concat!(
            "## Response TypeScript definition\n",
            "```ts\n",
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/generated-docs/",
                stringify!($t),
                ".ts"
            )),
            "\n```\n",
        )
    };
    ($t: expr_2021, json) => {
        concat!(
            "## Example response\n",
            "```json\n",
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/generated-docs/",
                stringify!($t),
                ".json"
            )),
            "\n```\n",
        )
    };
    ($t: expr_2021) => {
        concat!(generated_docs!($t, ts), generated_docs!($t, json),)
    };
}
