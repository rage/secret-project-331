//! Allows storing files to a file storage backend.
pub mod google_cloud_file_store;
pub mod local_file_store;

use std::path::Path;

use anyhow::{anyhow, Result};
use async_trait::async_trait;
/**
Allows storing files to a file storage backend.
*/
#[async_trait]
pub trait FileStore {
    /// Upload a file that's in memory to a path.
    async fn upload(&self, path: &Path, contents: Vec<u8>, mime_type: String) -> Result<()>;
    /// Download a file to memory.
    async fn download(&self, path: &Path) -> Result<Vec<u8>>;
    /// Get a url that can be used to download the file without authentication for a while.
    async fn get_download_url(&self, path: &Path) -> Result<String>;
    /// Delete a file.
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
