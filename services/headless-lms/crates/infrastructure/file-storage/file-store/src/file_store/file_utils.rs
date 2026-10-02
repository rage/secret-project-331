use super::GenericPayload;
use futures::TryStreamExt;
use std::{ffi::OsStr, path::Path};
use tokio_util::io::ReaderStream;

pub fn get_extension_from_filename(filename: &str) -> Option<&str> {
    Path::new(filename).extension().and_then(OsStr::to_str)
}

pub fn file_to_payload(file: std::fs::File) -> GenericPayload {
    let file = tokio::fs::File::from_std(file);
    let stream = ReaderStream::new(file).map_err(anyhow::Error::from);
    Box::pin(stream) as GenericPayload
}
