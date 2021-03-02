use std::{io, path::Path};

use super::{path_to_str, FileStore};
use anyhow::Result;
use async_trait::async_trait;
use cloud_storage::{Bucket, Object};

pub struct GoogleCloudFileStore {
    bucket_name: String,
}

impl GoogleCloudFileStore {
    pub async fn new(bucket_name: String) -> Result<Self> {
        let _bucket = Bucket::read(&bucket_name).await?;
        // bucket exists, continue
        Ok(Self { bucket_name })
    }
}

#[async_trait]
impl FileStore for GoogleCloudFileStore {
    async fn upload(&self, path: &Path, file: Vec<u8>, mime_type: String) -> Result<()> {
        Object::create(&self.bucket_name, file, path_to_str(path)?, &mime_type).await?;
        Ok(())
    }

    async fn download(&self, path: &Path) -> Result<Vec<u8>> {
        let res = Object::download(&self.bucket_name, path_to_str(path)?).await?;
        Ok(res)
    }

    async fn get_download_url(&self, path: &Path) -> Result<String> {
        let object = Object::read(&self.bucket_name, path_to_str(path)?).await?;
        let url = object.download_url(60)?;
        Ok(url)
    }

    async fn delete(&self, path: &Path) -> Result<()> {
        Object::delete(&self.bucket_name, path_to_str(path)?).await?;
        Ok(())
    }
}
