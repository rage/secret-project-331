use actix_multipart as mp;
use futures::TryStreamExt;
use std::ffi::OsStr;
use std::path::Path;

use crate::controllers::ControllerResult;
use crate::utils::file_store::FileStore;

pub fn get_extension_from_filename(filename: &str) -> Option<&str> {
    Path::new(filename).extension().and_then(OsStr::to_str)
}

pub async fn upload_media_to_storage(
    path: &Path,
    field: mp::Field,
    file_store: &impl FileStore,
) -> ControllerResult<()> {
    let mime_type = field.content_type().clone().to_string();
    let correct_type = field.map_err(|o| anyhow::anyhow!(o));

    Ok(file_store
        .upload_stream(path, Box::pin(correct_type), mime_type)
        .await?)
}
