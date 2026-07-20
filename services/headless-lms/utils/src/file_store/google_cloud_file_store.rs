use std::path::{Path, PathBuf};

use crate::prelude::*;
use async_trait::async_trait;
use bytes::Bytes;
use futures::StreamExt;
use google_cloud_auth::credentials::{
    Builder as CredentialsBuilder, Credentials,
    service_account::Builder as ServiceAccountCredentialsBuilder,
};
use google_cloud_auth::signer::Signer;
use google_cloud_storage::builder::storage::SignedUrlBuilder;
use google_cloud_storage::client::{Storage, StorageControl};
use serde_json::Value;
use std::{env, io};

use super::{FileStore, GenericPayload, generate_cache_folder_dir, path_to_str};

pub struct GoogleCloudFileStore {
    bucket_name: String,
    storage_client: Storage,
    control_client: StorageControl,
    signer: Signer,
    pub cache_files_path: PathBuf,
}

impl GoogleCloudFileStore {
    /// Creates a Google Cloud file store using ADC-backed SDK clients.
    #[instrument]
    pub async fn new(bucket_name: String) -> UtilResult<Self> {
        let (credentials, signer) = Self::build_credentials_and_signer()?;
        let storage_client = match credentials.clone() {
            Some(credentials) => Storage::builder()
                .with_credentials(credentials)
                .build()
                .await
                .map_err(Self::map_init_error)?,
            None => Storage::builder()
                .build()
                .await
                .map_err(Self::map_init_error)?,
        };
        let control_client = match credentials {
            Some(credentials) => StorageControl::builder()
                .with_credentials(credentials)
                .build()
                .await
                .map_err(Self::map_init_error)?,
            None => StorageControl::builder()
                .build()
                .await
                .map_err(Self::map_init_error)?,
        };
        let cache_files_path = generate_cache_folder_dir()?;

        Ok(Self {
            bucket_name,
            storage_client,
            control_client,
            signer,
            cache_files_path,
        })
    }

    /// Converts a raw bucket id into the GCS API resource name format.
    fn bucket_resource_name(&self) -> String {
        format!("projects/_/buckets/{}", self.bucket_name)
    }

    /// Builds Google Cloud credentials while preserving the legacy `cloud-storage`
    /// crate's support for JSON credentials supplied directly in an environment variable.
    fn build_credentials_and_signer() -> UtilResult<(Option<Credentials>, Signer)> {
        if let Some(credentials_json) = Self::credentials_json_from_env()? {
            let credentials = ServiceAccountCredentialsBuilder::new(credentials_json.clone())
                .build()
                .map_err(Self::map_init_error)?;
            let signer = ServiceAccountCredentialsBuilder::new(credentials_json)
                .build_signer()
                .map_err(Self::map_init_error)?;
            return Ok((Some(credentials), signer));
        }

        let signer = CredentialsBuilder::default()
            .build_signer()
            .map_err(Self::map_init_error)?;
        Ok((None, signer))
    }

    fn credentials_json_from_env() -> UtilResult<Option<Value>> {
        let raw_json = env::var("GOOGLE_APPLICATION_CREDENTIALS_JSON")
            .or_else(|_| env::var("SERVICE_ACCOUNT_JSON"))
            .ok();
        raw_json
            .map(|value| serde_json::from_str(&value).map_err(Self::map_init_error))
            .transpose()
    }

    /// Maps SDK initialization errors into the cloud storage util error.
    fn map_init_error<E: std::error::Error + Send + Sync + 'static>(error: E) -> UtilError {
        UtilError::new(
            UtilErrorType::CloudStorage,
            error.to_string(),
            Some(error.into()),
        )
    }
}

#[async_trait(?Send)]
impl FileStore for GoogleCloudFileStore {
    async fn upload(&self, path: &Path, file: Vec<u8>, mime_type: &str) -> UtilResult<()> {
        self.storage_client
            .write_object(
                self.bucket_resource_name(),
                path_to_str(path)?,
                Bytes::from(file),
            )
            .set_content_type(mime_type)
            .send_buffered()
            .await?;
        Ok(())
    }

    async fn download(&self, path: &Path) -> UtilResult<Vec<u8>> {
        let mut reader = self
            .storage_client
            .read_object(self.bucket_resource_name(), path_to_str(path)?)
            .send()
            .await?;
        let mut out = Vec::new();
        while let Some(chunk) = reader.next().await.transpose()? {
            out.extend_from_slice(&chunk);
        }
        Ok(out)
    }

    async fn get_direct_download_url(&self, path: &Path) -> UtilResult<String> {
        let object_name = path_to_str(path)?;
        // Keep old behavior: verify object exists before returning a URL.
        self.control_client
            .get_object()
            .set_bucket(self.bucket_resource_name())
            .set_object(object_name)
            .send()
            .await?;
        let url = SignedUrlBuilder::for_object(self.bucket_resource_name(), object_name)
            .with_method(google_cloud_storage::http::Method::GET)
            .with_expiration(std::time::Duration::from_secs(300))
            .sign_with(&self.signer)
            .await
            .map_err(|e| {
                UtilError::new(UtilErrorType::CloudStorage, e.to_string(), Some(e.into()))
            })?;
        Ok(url)
    }

    async fn delete(&self, path: &Path) -> UtilResult<()> {
        self.control_client
            .delete_object()
            .set_bucket(self.bucket_resource_name())
            .set_object(path_to_str(path)?)
            .send()
            .await?;
        Ok(())
    }

    async fn upload_stream(
        &self,
        path: &Path,
        mut contents: GenericPayload,
        mime_type: &str,
    ) -> UtilResult<()> {
        let mut collected = Vec::new();
        while let Some(chunk) = contents.next().await {
            let chunk = chunk
                .map_err(|e| UtilError::new(UtilErrorType::CloudStorage, e.to_string(), None))?;
            collected.extend_from_slice(&chunk);
        }
        self.storage_client
            .write_object(
                self.bucket_resource_name(),
                path_to_str(path)?,
                Bytes::from(collected),
            )
            .set_content_type(mime_type)
            .send_buffered()
            .await?;
        Ok(())
    }

    async fn download_stream(
        &self,
        path: &Path,
    ) -> UtilResult<Box<dyn futures::Stream<Item = std::io::Result<bytes::Bytes>>>> {
        let mut reader = self
            .storage_client
            .read_object(self.bucket_resource_name(), path_to_str(path)?)
            .send()
            .await?;
        let stream = async_stream::stream! {
            while let Some(item) = reader.next().await {
                yield item.map_err(io::Error::other);
            }
        };
        Ok(Box::new(stream))
    }

    fn get_cache_files_folder_path(&self) -> UtilResult<&Path> {
        Ok(&self.cache_files_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_MUTEX: Mutex<()> = Mutex::new(());

    struct EnvRestore {
        google_application_credentials_json: Option<String>,
        service_account_json: Option<String>,
    }

    impl EnvRestore {
        fn capture() -> Self {
            Self {
                google_application_credentials_json: env::var(
                    "GOOGLE_APPLICATION_CREDENTIALS_JSON",
                )
                .ok(),
                service_account_json: env::var("SERVICE_ACCOUNT_JSON").ok(),
            }
        }
    }

    impl Drop for EnvRestore {
        fn drop(&mut self) {
            unsafe {
                match &self.google_application_credentials_json {
                    Some(value) => env::set_var("GOOGLE_APPLICATION_CREDENTIALS_JSON", value),
                    None => env::remove_var("GOOGLE_APPLICATION_CREDENTIALS_JSON"),
                }
                match &self.service_account_json {
                    Some(value) => env::set_var("SERVICE_ACCOUNT_JSON", value),
                    None => env::remove_var("SERVICE_ACCOUNT_JSON"),
                }
            }
        }
    }

    #[tokio::test]
    async fn uses_google_application_credentials_json_contents() {
        let signer = {
            let _guard = ENV_MUTEX.lock().expect("environment mutex was poisoned");
            let _restore = EnvRestore::capture();
            unsafe {
                env::set_var(
                    "GOOGLE_APPLICATION_CREDENTIALS_JSON",
                    r#"{
                        "type": "service_account",
                        "client_email": "json-creds@example.iam.gserviceaccount.com",
                        "private_key_id": "test-private-key-id",
                        "private_key": "not-a-real-private-key",
                        "project_id": "test-project-id"
                    }"#,
                );
                env::remove_var("SERVICE_ACCOUNT_JSON");
            }

            GoogleCloudFileStore::build_credentials_and_signer()
                .expect("raw JSON credentials should build a signer")
                .1
        };

        let client_email = signer
            .client_email()
            .await
            .expect("service account signer should expose client email without IAM API");
        assert_eq!(client_email, "json-creds@example.iam.gserviceaccount.com");
    }
}
