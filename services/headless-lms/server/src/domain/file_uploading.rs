use std::path::Path;

use actix_multipart as mp;
use futures::TryStreamExt;
use headless_lms_utils::file_store::FileStore;

pub async fn upload_media_to_storage(
    path: &Path,
    field: mp::Field,
    file_store: &dyn FileStore,
) -> anyhow::Result<()> {
    let mime_type = field.content_type().to_string();
    let correct_type = field;

    file_store
        .upload_stream(
            path,
            Box::pin(correct_type.map_err(anyhow::Error::msg)),
            &mime_type,
        )
        .await
        .map_err(anyhow::Error::msg)
}
