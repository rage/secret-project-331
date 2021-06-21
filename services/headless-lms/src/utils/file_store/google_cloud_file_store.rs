use super::{path_to_str, FileStore};
use actix_http::Payload;
use anyhow::Result;
use async_trait::async_trait;
use bytes::Bytes;
use cloud_storage::{Bucket, Object};
use futures::{future::try_join, StreamExt};
use std::path::Path;
use tokio_stream::wrappers::ReceiverStream;

const BUFFER_SIZE: usize = 512;

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

#[async_trait(?Send)]
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

    async fn upload_stream(
        &self,
        path: &Path,
        mut contents: Payload,
        mime_type: String,
    ) -> Result<()> {
        let (sender, receiver) = tokio::sync::mpsc::channel(BUFFER_SIZE);
        let receiver_stream = ReceiverStream::new(receiver);
        let send_fut = async {
            while let Some(bytes) = contents.next().await {
                sender
                    .send(bytes)
                    .await
                    .map_err(|e| cloud_storage::Error::Other(e.to_string()))?;
            }
            drop(sender);
            Ok(())
        };
        let recv_fut = Object::create_streamed(
            &self.bucket_name,
            receiver_stream,
            None,
            path_to_str(path)?,
            &mime_type,
        );
        try_join(send_fut, recv_fut).await?;
        Ok(())
    }

    async fn download_stream(
        &self,
        path: &Path,
    ) -> Result<Box<dyn futures::Stream<Item = std::io::Result<bytes::Bytes>>>> {
        let stream = Object::download_streamed(&self.bucket_name, path_to_str(path)?).await?;
        let stream_with_corrected_type: _ = stream
            // cloud_storage download_streamed returns the bytes one by one which is not optimal for us
            // that's why why group the singular bytes to chunks and convert those chunks to Bytes objects.
            .chunks(BUFFER_SIZE)
            .map(|chunked_bytes_results| {
                // Turn Vec<Result<u8>> -> Result<Vec<u8>>
                let with_combined_result = chunked_bytes_results
                    .into_iter()
                    .collect::<Result<Vec<_>, _>>();
                let as_bytes = with_combined_result
                    .map(|vec| Bytes::from(vec))
                    .map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err));
                as_bytes
            });
        Ok(Box::new(stream_with_corrected_type))
    }
}
