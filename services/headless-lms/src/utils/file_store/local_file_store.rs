use super::{path_to_str, FileStore, GenericPayload};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use bytes::Bytes;
use futures::{Stream, StreamExt};
use std::path::{Path, PathBuf};
use tokio::io::{self, AsyncWriteExt};
use tokio::{
    fs::{self, OpenOptions},
    io::BufWriter,
};
use tokio_util::io::ReaderStream;

#[derive(Debug, Clone)]
pub struct LocalFileStore {
    pub base_path: PathBuf,
    pub base_url: String,
}

impl LocalFileStore {
    pub async fn new(base_path: PathBuf, base_url: String) -> Result<Self> {
        if base_path.exists() {
            if !base_path.is_dir() {
                return Err(anyhow!("Base path should be a folder"));
            }
        } else {
            fs::create_dir_all(&base_path).await?;
        }
        Ok(Self {
            base_path,
            base_url,
        })
    }
}
#[async_trait(?Send)]
impl FileStore for LocalFileStore {
    async fn upload(&self, path: &Path, contents: Vec<u8>, _mime_type: String) -> Result<()> {
        let full_path = self.base_path.join(path);
        fs::write(full_path, contents).await?;
        Ok(())
    }

    async fn download(&self, path: &Path) -> Result<Vec<u8>> {
        let full_path = self.base_path.join(path);
        Ok(fs::read(full_path).await?)
    }

    async fn delete(&self, path: &Path) -> Result<()> {
        let full_path = self.base_path.join(path);
        fs::remove_file(full_path).await?;
        Ok(())
    }

    async fn get_download_url(&self, path: &Path) -> Result<String> {
        let full_path = self.base_path.join(path);
        if !full_path.exists() {
            return Err(anyhow!("File does not exist"));
        }
        let path_str = path_to_str(path)?;
        if self.base_url.ends_with('/') {
            return Ok(format!("{}{}", self.base_url, path_str));
        }
        Ok(format!("{}/{}", self.base_url, path_str))
    }

    async fn upload_stream(
        &self,
        path: &Path,
        mut contents: GenericPayload,
        _mime_type: String,
    ) -> Result<()> {
        let full_path = self.base_path.join(path);
        let parent_option = full_path.parent();
        if parent_option.is_none() {
            return Err(anyhow!("Image path did not have a parent folder"));
        }
        let parent = parent_option.unwrap();
        if parent.exists() {
            if !parent.is_dir() {
                return Err(anyhow!("Base path should be a folder"));
            }
        } else {
            fs::create_dir_all(&parent).await?;
        }
        let file = OpenOptions::new()
            .create(true)
            .write(true)
            .open(full_path)
            .await?;

        let mut buf_writer = BufWriter::new(file);

        while let Some(bytes_res) = contents.next().await {
            let bytes = bytes_res?;
            buf_writer.write_all(&bytes).await?;
        }

        buf_writer.flush().await?;

        Ok(())
    }

    async fn download_stream(
        &self,
        path: &Path,
    ) -> Result<Box<dyn Stream<Item = std::io::Result<Bytes>>>> {
        let full_path = self.base_path.join(path);
        let file = fs::File::open(full_path).await?;
        let reader = io::BufReader::new(file);
        let stream = ReaderStream::new(reader);
        Ok(Box::new(stream))
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::LocalFileStore;
    use crate::utils::file_store::FileStore;
    use tempdir::TempDir;

    #[actix_rt::test]
    async fn upload_download_delete_works() {
        let dir = TempDir::new("test-local-filestore").expect("Failed to create a temp dir");
        let base_path = dir.into_path();
        let local_file_store =
            LocalFileStore::new(base_path.clone(), "http://localhost:3000".to_string())
                .await
                .expect("Could not create local file storage");

        let path1 = Path::new("file1");
        let test_file_contents = "Test file contents".as_bytes().to_vec();
        // Put content to storage and read it back
        local_file_store
            .upload(&path1, test_file_contents.clone(), "text/plain".to_string())
            .await
            .expect("Failed to put a file into local file storage.");
        let retrivied_file = local_file_store
            .download(&path1)
            .await
            .expect("Failed to retrieve a file from local file storage");
        assert_eq!(test_file_contents, retrivied_file);

        local_file_store
            .delete(&path1)
            .await
            .expect("Failed to delete a file");

        // After deletion getting the file should fail
        let retrivied_file2 = local_file_store.download(&path1).await;
        assert!(retrivied_file2.is_err());
    }

    #[actix_rt::test]
    async fn get_download_url_works() {
        let dir = TempDir::new("test-local-filestore").expect("Failed to create a temp dir");
        let base_path = dir.into_path();
        let local_file_store =
            LocalFileStore::new(base_path.clone(), "http://localhost:3000".to_string())
                .await
                .expect("Could not create local file storage");
        let test_file_contents = "Test file contents 2".as_bytes().to_vec();
        let path1 = Path::new("file1");
        local_file_store
            .upload(&path1, test_file_contents.clone(), "text/plain".to_string())
            .await
            .expect("Failed to put a file into local file storage.");
        let url = local_file_store
            .get_download_url(&path1)
            .await
            .expect("Failed to get a download url");
        let expected_url = format!("http://localhost:3000/{}", path1.to_string_lossy());
        assert_eq!(url, expected_url);

        let nonexistant_file = Path::new("does-not-exist");
        let res = local_file_store.get_download_url(&nonexistant_file).await;
        assert!(res.is_err());
    }
}
