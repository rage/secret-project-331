use super::{path_to_str, FileStore, GenericPayload};
use anyhow::Result;
use async_trait::async_trait;
use bytes::Bytes;
use cloud_storage::Client;
use futures::{future::try_join, StreamExt};
use std::{path::Path, time::Duration};
use tokio_stream::wrappers::ReceiverStream;

const BUFFER_SIZE: usize = 512;

pub struct GoogleCloudFileStore {
    bucket_name: String,
    client: Client,
}

impl GoogleCloudFileStore {
    #[instrument]
    pub async fn new(bucket_name: String) -> Result<Self> {
        let client = Client::default();
        info!("Checking whether bucket exists");
        let bucket = client.bucket();
        let bucket_future = bucket.read(&bucket_name);
        let _res = tokio::time::timeout(Duration::from_secs(2), bucket_future).await??;
        info!("Bucket exits");
        Ok(Self {
            bucket_name,
            client,
        })
    }
}

#[async_trait(?Send)]
impl FileStore for GoogleCloudFileStore {
    async fn upload(&self, path: &Path, file: Vec<u8>, mime_type: String) -> Result<()> {
        self.client
            .object()
            .create(&self.bucket_name, file, path_to_str(path)?, &mime_type)
            .await?;
        Ok(())
    }

    async fn download(&self, path: &Path) -> Result<Vec<u8>> {
        let res = self
            .client
            .object()
            .download(&self.bucket_name, path_to_str(path)?)
            .await?;
        Ok(res)
    }

    async fn get_direct_download_url(&self, path: &Path) -> Result<String> {
        let object = self
            .client
            .object()
            .read(&self.bucket_name, path_to_str(path)?)
            .await?;
        let url = object.download_url(60)?;
        Ok(url)
    }

    async fn delete(&self, path: &Path) -> Result<()> {
        self.client
            .object()
            .delete(&self.bucket_name, path_to_str(path)?)
            .await?;
        Ok(())
    }

    async fn upload_stream(
        &self,
        path: &Path,
        mut contents: GenericPayload,
        mime_type: String,
    ) -> Result<()> {
        let object_client = self.client.object();
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
        let recv_fut = object_client.create_streamed(
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
        let stream = self
            .client
            .object()
            .download_streamed(&self.bucket_name, path_to_str(path)?)
            .await?;
        let stream_with_corrected_type: _ = stream
            // cloud_storage download_streamed returns the bytes one by one which is not optimal for us
            // that's why why group the singular bytes to chunks and convert those chunks to Bytes objects.
            .chunks(BUFFER_SIZE)
            .map(|chunked_bytes_results| {
                // Turn Vec<Result<u8>> -> Result<Vec<u8>>
                let with_combined_result = chunked_bytes_results
                    .into_iter()
                    .collect::<Result<Vec<_>, _>>();
                with_combined_result
                    .map(Bytes::from)
                    .map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err))
            });
        Ok(Box::new(stream_with_corrected_type))
    }
}
