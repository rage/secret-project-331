//! Runtime selection and setup for the file storage backend.

use std::{env, sync::Arc};

use anyhow::Context;
use headless_lms_base::program_config::ProgramConfig;

use super::{
    FileStore, google_cloud_file_store::GoogleCloudFileStore, local_file_store::LocalFileStore,
};

#[derive(Clone)]
pub struct FileStoreRuntimeConfig {
    pub use_google_cloud_storage: bool,
    pub google_cloud_storage_bucket_name: Option<String>,
}

impl FileStoreRuntimeConfig {
    pub fn try_from_env() -> anyhow::Result<Self> {
        let use_google_cloud_storage =
            ProgramConfig::bool_flag("FILE_STORE_USE_GOOGLE_CLOUD_STORAGE");
        let google_cloud_storage_bucket_name = if use_google_cloud_storage {
            Some(
                env::var("GOOGLE_CLOUD_STORAGE_BUCKET_NAME")
                    .context("GOOGLE_CLOUD_STORAGE_BUCKET_NAME must be defined when FILE_STORE_USE_GOOGLE_CLOUD_STORAGE is enabled")?,
            )
        } else {
            None
        };
        Ok(Self {
            use_google_cloud_storage,
            google_cloud_storage_bucket_name,
        })
    }
}

/// Sets up the storage backend shared by HTTP requests and background programs.
pub async fn setup_file_store(
    file_store_config: &FileStoreRuntimeConfig,
    base_url: &str,
) -> Arc<dyn FileStore + Send + Sync> {
    if file_store_config.use_google_cloud_storage {
        tracing::info!("Using Google Cloud Storage as the file store");
        let bucket_name = file_store_config
            .google_cloud_storage_bucket_name
            .clone()
            .expect("GOOGLE_CLOUD_STORAGE_BUCKET_NAME missing from runtime config");
        Arc::new(
            GoogleCloudFileStore::new(bucket_name)
                .await
                .expect("Failed to initialize file store"),
        )
    } else {
        tracing::info!("Using local file storage as the file store");
        let normalized_base_url = base_url.trim_end_matches('/');
        Arc::new(
            LocalFileStore::new(
                "uploads".into(),
                format!("{normalized_base_url}/api/v0/files/uploads/"),
            )
            .expect("Failed to initialize file store"),
        )
    }
}
