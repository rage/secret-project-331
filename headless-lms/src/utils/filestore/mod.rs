pub mod google_cloud_file_store;
pub mod local_file_store;

use std::{io, path::Path};

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use bytes::Bytes;
use futures::Stream;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct FileDescriptor {
    id: Uuid,
    mime_type: String,
}

#[async_trait]
pub trait FileStore {
    async fn upload(&self, path: &Path, contents: Vec<u8>, mime_type: String) -> Result<()>;
    async fn download(&self, path: &Path) -> Result<Vec<u8>>;
    async fn get_download_url(&self, path: &Path) -> Result<String>;
    async fn delete(&self, path: &Path) -> Result<()>;
}

fn path_to_str(path: &Path) -> Result<&str> {
    let str = path.to_str();
    match str {
        Some(s) => return Ok(s),
        None => {
            return Err(anyhow!(
                "Could not convert path to string because it contained invalid UTF-8 characters."
            ));
        }
    }
}
