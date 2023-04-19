use std::{ffi::OsStr, io::Bytes, path::Path};

use rand::distributions::DistString;

use crate::{
    prelude::{BackendError, UtilError, UtilErrorType, UtilResult},
    ApplicationConfiguration,
};

pub fn get_extension_from_filename(filename: &str) -> Option<&str> {
    Path::new(filename).extension().and_then(OsStr::to_str)
}

pub struct FileContentFetcherWithFilesystemCache {
    file_cache_path: Path,
}

impl FileContentFetcherWithFilesystemCache {
    pub async fn fetch_file_content_or_use_filesystem_cache(
        &self,
        file_url: &url::Url,
    ) -> UtilResult<Vec<u8>> {
        let hash = blake3::hash(file_url.as_str().as_bytes());
        let cached_file_path = self.file_cache_path.join(hash.to_hex().as_str());
        match tokio::fs::read(&cached_file_path).await {
            Ok(string) => return Ok(string),
            Err(_) => {
                info!(
                    "File not found in cache, fetching from url: {}",
                    file_url.as_str()
                );
            }
        }

        let random_filename =
            rand::distributions::Alphanumeric.sample_string(&mut rand::thread_rng(), 32);
        let temp_path = self.file_cache_path.join(random_filename.as_str());

        let file_content = reqwest::get(file_url.as_str())
            .await
            .map_err(|original_error| {
                UtilError::new(
                    UtilErrorType::CloudStorage,
                    "Could not fetch url".into(),
                    Some(original_error.into()),
                )
            })?
            .bytes()
            .await
            .map_err(|original_error| {
                UtilError::new(
                    UtilErrorType::CloudStorage,
                    "Could not read response body".into(),
                    Some(original_error.into()),
                )
            })?;
        tokio::fs::write(&temp_path, &file_content).await?;
        tokio::fs::rename(&temp_path, &cached_file_path).await?;
        Ok(file_content.to_vec())
    }
}
