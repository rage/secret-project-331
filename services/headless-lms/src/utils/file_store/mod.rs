//! Allows storing files to a file storage backend.
pub mod file_utils;
pub mod google_cloud_file_store;
pub mod local_file_store;

use std::{
    path::{Path, PathBuf},
    pin::Pin,
};

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use bytes::Bytes;
use futures::Stream;

use crate::models::courses::Course;

pub type GenericPayload = Pin<Box<dyn Stream<Item = Result<Bytes>>>>;
/**
Allows storing files to a file storage backend.
*/
#[async_trait(?Send)]
pub trait FileStore {
    /// Upload a file that's in memory to a path.
    async fn upload(&self, path: &Path, contents: Vec<u8>, mime_type: String) -> Result<()>;
    /// Upload a file without loading the whole file to memory
    async fn upload_stream(
        &self,
        path: &Path,
        mut contents: GenericPayload,
        mime_type: String,
    ) -> Result<()>;
    /// Download a file to memory.
    async fn download(&self, path: &Path) -> Result<Vec<u8>>;
    /// Download a file without loading the whole file to memory.
    async fn download_stream(
        &self,
        path: &Path,
    ) -> Result<Box<dyn Stream<Item = std::io::Result<Bytes>>>>;
    /// Get a url that can be used to download the file without authentication for a while.
    async fn get_download_url(&self, path: &Path) -> Result<String>;
    /// Delete a file.
    async fn delete(&self, path: &Path) -> Result<()>;
}

fn path_to_str(path: &Path) -> Result<&str> {
    let str = path.to_str();
    match str {
        Some(s) => Ok(s),
        None => Err(anyhow!(
            "Could not convert path to string because it contained invalid UTF-8 characters."
        )),
    }
}

pub fn course_image_path(course: &Course, image_name: String) -> Result<PathBuf> {
    let path = PathBuf::from(format!(
        "organizations/{}/courses/{}/images/{}",
        course.organization_id, course.id, image_name
    ));
    Ok(path)
}

pub fn course_audio_path(course: &Course, audio_name: String) -> Result<PathBuf> {
    let path = PathBuf::from(format!(
        "organizations/{}/courses/{}/audios/{}",
        course.organization_id, course.id, audio_name
    ));
    Ok(path)
}

pub fn course_file_path(course: &Course, file_name: String) -> Result<PathBuf> {
    let path = PathBuf::from(format!(
        "organizations/{}/courses/{}/files/{}",
        course.organization_id, course.id, file_name
    ));
    Ok(path)
}
