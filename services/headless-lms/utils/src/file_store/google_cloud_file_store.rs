use std::path::Path;

use async_trait::async_trait;
use bytes::Bytes;
use cloud_storage::Client;
use futures::{future::try_join, StreamExt};
use tokio_stream::wrappers::ReceiverStream;

use super::{path_to_str, FileStore, GenericPayload};
use crate::error::util_error::UtilError;

const BUFFER_SIZE: usize = 512;

pub struct GoogleCloudFileStore {
    bucket_name: String,
    client: Client,
}

impl GoogleCloudFileStore {
    /// Needs to not be async because of how this is used in worker factories
    #[instrument]
    pub fn new(bucket_name: String) -> Result<Self, UtilError> {
        let client = Client::default();

        Ok(Self {
            bucket_name,
            client,
        })
    }
}

#[async_trait(?Send)]
impl FileStore for GoogleCloudFileStore {
    async fn upload(&self, path: &Path, file: Vec<u8>, mime_type: &str) -> Result<(), UtilError> {
        self.client
            .object()
            .create(&self.bucket_name, file, path_to_str(path)?, mime_type)
            .await?;
        Ok(())
    }

    async fn download(&self, path: &Path) -> Result<Vec<u8>, UtilError> {
        let res = self
            .client
            .object()
            .download(&self.bucket_name, path_to_str(path)?)
            .await?;
        Ok(res)
    }

    async fn get_direct_download_url(&self, path: &Path) -> Result<String, UtilError> {
        let object = self
            .client
            .object()
            .read(&self.bucket_name, path_to_str(path)?)
            .await?;
        let url = object.download_url(300)?;
        Ok(url)
    }

    async fn delete(&self, path: &Path) -> Result<(), UtilError> {
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
        mime_type: &str,
    ) -> Result<(), UtilError> {
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
            mime_type,
        );
        try_join(send_fut, recv_fut).await?;
        Ok(())
    }

    async fn download_stream(
        &self,
        path: &Path,
    ) -> Result<Box<dyn futures::Stream<Item = std::io::Result<bytes::Bytes>>>, UtilError> {
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
