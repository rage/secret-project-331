//! Allows storing files to a file storage backend.
pub mod file_utils;
pub mod google_cloud_file_store;
pub mod local_file_store;

use std::{
    path::{Path, PathBuf},
    pin::Pin,
};

use async_trait::async_trait;
use bytes::Bytes;
use futures::Stream;
use uuid::Uuid;

use crate::{prelude::*, ApplicationConfiguration};

pub type GenericPayload = Pin<Box<dyn Stream<Item = Result<Bytes, anyhow::Error>>>>;
/**
Allows storing files to a file storage backend.
*/
#[async_trait(?Send)]
pub trait FileStore {
    /// Upload a file that's in memory to a path.
    async fn upload(
        &self,
        path: &Path,
        contents: Vec<u8>,
        mime_type: &str,
    ) -> Result<(), UtilError>;
    /// Upload a file without loading the whole file to memory
    async fn upload_stream(
        &self,
        path: &Path,
        mut contents: GenericPayload,
        mime_type: &str,
    ) -> Result<(), UtilError>;
    /// Download a file to memory.
    async fn download(&self, path: &Path) -> Result<Vec<u8>, UtilError>;
    /// Download a file without loading the whole file to memory.
    async fn download_stream(
        &self,
        path: &Path,
    ) -> Result<Box<dyn Stream<Item = std::io::Result<Bytes>>>, UtilError>;
    /// Get a url that can be used to download the file without authentication for a while.
    /// In most cases you probably want to use get_download_url() instead.
    async fn get_direct_download_url(&self, path: &Path) -> Result<String, UtilError>;
    /// Get a url for a file in FileStore that can be used to access the resource.
    fn get_download_url(&self, path: &Path, app_conf: &ApplicationConfiguration) -> String {
        format!(
            "{}/api/v0/files/{}",
            app_conf.base_url,
            path.to_string_lossy()
        )
    }
    /// Delete a file.
    async fn delete(&self, path: &Path) -> Result<(), UtilError>;
}

fn path_to_str(path: &Path) -> Result<&str, UtilError> {
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

pub fn organization_image_path(
    organization_id: Uuid,
    image_name: &str,
) -> Result<PathBuf, UtilError> {
    let path = PathBuf::from(format!(
        "organizations/{}/images/{}",
        organization_id, image_name
    ));
    Ok(path)
}

pub fn organization_audio_path(
    organization_id: Uuid,
    audio_name: &str,
) -> Result<PathBuf, UtilError> {
    let path = PathBuf::from(format!(
        "organizations/{}/audios/{}",
        organization_id, audio_name
    ));
    Ok(path)
}

pub fn organization_file_path(
    organization_id: Uuid,
    file_name: &str,
) -> Result<PathBuf, UtilError> {
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
