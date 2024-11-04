use std::collections::HashMap;

use crate::prelude::*;
use anyhow::Context;
use azure_core::prelude::Metadata;
use azure_storage::StorageCredentials;
use azure_storage_blobs::prelude::*;
use bytes::Bytes;
use futures::StreamExt;
use headless_lms_utils::{ApplicationConfiguration, AzureBlobStorageConfiguration};

/// A client for interacting with Azure Blob Storage.
pub struct AzureBlobClient {
    container_client: ContainerClient,
    pub container_name: String,
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
        let container_client = blob_service_client.container_client(container_name.clone());

        Ok(AzureBlobClient {
            container_client,
            container_name,
        })
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
    pub async fn upload_file(
        &self,
        blob_path: &str,
        file_bytes: &[u8],
        metadata: Option<HashMap<String, Bytes>>,
    ) -> anyhow::Result<()> {
        let blob_client = self.container_client.blob_client(blob_path);

        let mut put_blob = blob_client.put_block_blob(file_bytes.to_vec());

        if let Some(meta) = metadata {
            let mut m = Metadata::new();
            for (key, value) in meta {
                m.insert(key, value);
            }
            put_blob = put_blob.metadata(m);
        }

        put_blob.await?;

        info!("Blob '{}' uploaded successfully.", blob_path);
        Ok(())
    }

    /// Deletes a file (blob) from the specified container.
    pub async fn delete_file(&self, path: &str) -> anyhow::Result<()> {
        let blob_client = self.container_client.blob_client(path);

        blob_client.delete().await?;

        info!("Blob '{}' deleted successfully.", path);
        Ok(())
    }

    pub async fn list_files_with_prefix(&self, prefix: &str) -> anyhow::Result<Vec<String>> {
        let mut result = Vec::new();
        let prefix_owned = prefix.to_string();
        let response = self.container_client.list_blobs().prefix(prefix_owned);
        let mut stream = response.into_stream();

        while let Some(list) = stream.next().await {
            let list = list?;
            let blobs: Vec<_> = list.blobs.blobs().collect();
            for blob in blobs {
                result.push(blob.name.clone());
            }
        }
        Ok(result)
    }
}
