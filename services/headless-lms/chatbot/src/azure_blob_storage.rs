use crate::prelude::*;
use anyhow::Context;
use azure_storage::StorageCredentials;
use azure_storage_blobs::prelude::*;
use headless_lms_utils::{ApplicationConfiguration, AzureBlobStorageConfiguration};
use std::path::Path;

/// A client for interacting with Azure Blob Storage.
pub struct AzureBlobClient {
    container_client: ContainerClient,
}

impl AzureBlobClient {
    pub async fn new(
        app_config: &ApplicationConfiguration,
        container_name_prefix: &str,
    ) -> anyhow::Result<Self> {
        let azure_configuration = app_config
            .azure_configuration
            .as_ref()
            .context("Azure configuration is missing")?;
        let AzureBlobStorageConfiguration {
            storage_account,
            access_key,
        } = azure_configuration
            .blob_storage_config
            .clone()
            .context("Azure Blob Storage configuration is missing")?;

        let container_name = format!("{}-chatbot", container_name_prefix);

        let storage_credentials = StorageCredentials::access_key(&storage_account, access_key);
        let blob_service_client = BlobServiceClient::new(storage_account, storage_credentials);
        let container_client = blob_service_client.container_client(container_name);

        Ok(AzureBlobClient { container_client })
    }

    /// Ensures the container used to store the blobs exists. If it does not, the container is created.
    pub async fn ensure_container_exists(&self) -> anyhow::Result<()> {
        if self.container_client.exists().await? {
            return Ok(());
        }

        info!(
            "Azure blob storage container '{}' does not exist. Creating...",
            self.container_client.container_name()
        );
        self.container_client
            .create()
            .public_access(PublicAccess::None)
            .await?;
        Ok(())
    }

    /// Uploads a file to the specified container.
    pub async fn upload_file(&self, path: &Path, file_bytes: &[u8]) -> anyhow::Result<()> {
        let blob_name = Self::convert_path_to_blob_name(path);
        let blob_client = self.container_client.blob_client(&blob_name);

        blob_client.put_block_blob(file_bytes.to_vec()).await?;

        info!("Blob '{}' uploaded successfully.", &blob_name);
        Ok(())
    }

    /// Deletes a file (blob) from the specified container.
    pub async fn delete_file(&self, path: &Path) -> anyhow::Result<()> {
        let blob_name = Self::convert_path_to_blob_name(path);
        let blob_client = self.container_client.blob_client(&blob_name);

        blob_client.delete().await?;

        info!("Blob '{}' deleted successfully.", &blob_name);
        Ok(())
    }

    /// Converts a path to a blob name by joining its components with '/'.
    fn convert_path_to_blob_name(path: &Path) -> String {
        path.components()
            .map(|comp| comp.as_os_str().to_string_lossy())
            .collect::<Vec<_>>()
            .join("/")
    }
}
