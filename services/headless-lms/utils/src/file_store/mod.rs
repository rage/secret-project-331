//! Allows storing files to a file storage backend.
pub mod file_utils;
pub mod google_cloud_file_store;
pub mod local_file_store;

use std::{
    os::unix::prelude::OsStrExt,
    path::{Path, PathBuf},
    pin::Pin,
};

use async_trait::async_trait;
use bytes::Bytes;
use futures::Stream;
use rand::distributions::DistString;

use uuid::Uuid;

use crate::{prelude::*, ApplicationConfiguration};

pub type GenericPayload = Pin<Box<dyn Stream<Item = Result<Bytes, anyhow::Error>>>>;
/**
Allows storing files to a file storage backend.
*/
#[async_trait(?Send)]
pub trait FileStore {
    /// Upload a file that's in memory to a path.
    async fn upload(&self, path: &Path, contents: Vec<u8>, mime_type: &str) -> UtilResult<()>;
    /// Upload a file without loading the whole file to memory
    async fn upload_stream(
        &self,
        path: &Path,
        mut contents: GenericPayload,
        mime_type: &str,
    ) -> UtilResult<()>;
    /// Download a file to memory.
    async fn download(&self, path: &Path) -> UtilResult<Vec<u8>>;
    /// Download a file without loading the whole file to memory.
    async fn download_stream(
        &self,
        path: &Path,
    ) -> UtilResult<Box<dyn Stream<Item = std::io::Result<Bytes>>>>;
    /// Get a url that can be used to download the file without authentication for a while.
    /// In most cases you probably want to use get_download_url() instead.
    async fn get_direct_download_url(&self, path: &Path) -> UtilResult<String>;
    /// Get a url for a file in FileStore that can be used to access the resource.
    fn get_download_url(&self, path: &Path, app_conf: &ApplicationConfiguration) -> String {
        format!(
            "{}/api/v0/files/{}",
            app_conf.base_url,
            path.to_string_lossy()
        )
    }
    /// Delete a file.
    async fn delete(&self, path: &Path) -> UtilResult<()>;

    /// This function returns a path to a folder where downloaded files can be cached.
    fn get_cache_files_folder_path(&self) -> UtilResult<&Path>;

    async fn fetch_file_content_or_use_filesystem_cache(
        &self,
        file_path: &Path,
    ) -> UtilResult<Vec<u8>> {
        let cache_folder = self.get_cache_files_folder_path()?;
        let hash = blake3::hash(file_path.as_os_str().as_bytes());
        let cached_file_path = cache_folder.join(hash.to_hex().as_str());
        match tokio::fs::read(&cached_file_path).await {
            Ok(string) => return Ok(string),
            Err(_) => {
                info!(
                    "File not found in cache, fetching from file store using path: {}",
                    file_path.to_str().unwrap_or_default()
                );
            }
        }

        let random_filename =
            rand::distributions::Alphanumeric.sample_string(&mut rand::thread_rng(), 32);
        let temp_path = cache_folder.join(random_filename.as_str());

        let file_content = self.download(file_path).await?;

        tokio::fs::write(&temp_path, &file_content).await?;
        tokio::fs::rename(&temp_path, &cached_file_path).await?;
        Ok(file_content.to_vec())
    }
}

fn generate_cache_folder_dir() -> UtilResult<PathBuf> {
    let cache_files_path =
        std::env::var("HEADLESS_LMS_CACHE_FILES_PATH").map_err(|original_error| {
            UtilError::new(
                UtilErrorType::Other,
                "You need to define the HEADLESS_LMS_CACHE_FILES_PATH environment variable."
                    .to_string(),
                Some(original_error.into()),
            )
        })?;
    let path = PathBuf::from(cache_files_path).join("headlesss-lms-cached-files");
    if !path.exists() {
        std::fs::create_dir_all(&path)?;
    }
    Ok(path)
}

fn path_to_str(path: &Path) -> UtilResult<&str> {
    let str = path.to_str();
    match str {
        Some(s) => Ok(s),
        None => Err(UtilError::new(
            UtilErrorType::Other,
            "Could not convert path to string because it contained invalid UTF-8 characters."
                .to_string(),
            None,
        )),
    }
}

pub fn organization_image_path(organization_id: Uuid, image_name: &str) -> UtilResult<PathBuf> {
    let path = PathBuf::from(format!(
        "organizations/{}/images/{}",
        organization_id, image_name
    ));
    Ok(path)
}

pub fn organization_audio_path(organization_id: Uuid, audio_name: &str) -> UtilResult<PathBuf> {
    let path = PathBuf::from(format!(
        "organizations/{}/audios/{}",
        organization_id, audio_name
    ));
    Ok(path)
}

pub fn organization_file_path(organization_id: Uuid, file_name: &str) -> UtilResult<PathBuf> {
    let path = PathBuf::from(format!(
        "organizations/{}/files/{}",
        organization_id, file_name
    ));
    Ok(path)
}

pub fn repository_exercise_path(repository_id: Uuid, repository_exercise_id: Uuid) -> PathBuf {
    PathBuf::from(format!(
        "repository_exercises/{repository_id}/{repository_exercise_id}",
    ))
}
