//! Shared helper functions for multiple controllers.

use std::{path::PathBuf, sync::Arc};

use actix_multipart::Field;
use actix_web::http::{header, HeaderMap};
use futures::StreamExt;
use headless_lms_utils::{
    file_store::file_utils::{get_extension_from_filename, upload_media_to_storage},
    strings::generate_random_string,
};
use models::organizations::DatabaseOrganization;

use crate::controllers::prelude::*;

#[derive(Debug, Clone, Copy, Deserialize, TS)]
pub enum StoreKind {
    Organization(Uuid),
    Course(Uuid),
    Exam(Uuid),
}

pub async fn upload_media<'a>(
    headers: &HeaderMap,
    mut payload: Multipart,
    store_kind: StoreKind,
    file_store: &Arc<dyn FileStore>,
) -> ControllerResult<PathBuf> {
    validate_media_headers(headers)?;

    let file_payload = payload
        .next()
        .await
        .ok_or_else(|| ControllerError::BadRequest("Missing form data".into()))?;
    match file_payload {
        Ok(field) => {
            let path: PathBuf = match field.content_type().type_() {
                mime::AUDIO => generate_audio_path(&field, store_kind),
                mime::IMAGE => generate_image_path(&field, store_kind),
                _ => generate_file_path(&field, store_kind),
            }?;
            upload_media_to_storage(&path, field, file_store).await?;
            Ok(path)
        }
        Err(err) => Err(ControllerError::InternalServerError(err.to_string())),
    }
}

pub async fn upload_image_for_organization(
    headers: &HeaderMap,
    mut payload: Multipart,
    organization: &DatabaseOrganization,
    file_store: &Arc<dyn FileStore>,
) -> ControllerResult<PathBuf> {
    validate_media_headers(headers)?;

    let next_payload = payload
        .next()
        .await
        .ok_or_else(|| ControllerError::BadRequest("Missing form data".into()))?;
    match next_payload {
        Ok(field) => {
            let path: PathBuf = match field.content_type().type_() {
                mime::IMAGE => {
                    generate_image_path(&field, StoreKind::Organization(organization.id))
                }
                unsupported => Err(ControllerError::BadRequest(format!(
                    "Unsupported image Mime type: {}",
                    unsupported
                ))),
            }?;
            upload_media_to_storage(&path, field, file_store).await?;
            Ok(path)
        }
        Err(err) => Err(ControllerError::InternalServerError(err.to_string())),
    }
}

fn generate_audio_path(field: &Field, store_kind: StoreKind) -> ControllerResult<PathBuf> {
    let extension = match field.content_type().to_string().as_str() {
        "audio/aac" => ".aac",
        "audio/mpeg" => ".mp3",
        "audio/ogg" => ".oga",
        "audio/opus" => ".opus",
        "audio/wav" => ".wav",
        "audio/webm" => ".weba",
        "audio/midi" => ".mid",
        "audio/x-midi" => ".mid",
        unsupported => {
            return Err(ControllerError::BadRequest(format!(
                "Unsupported audio Mime type: {}",
                unsupported
            )))
        }
    };
    let mut file_name = generate_random_string(30);
    file_name.push_str(extension);
    let path = path(&file_name, FileType::Audio, store_kind);

    Ok(path)
}

fn generate_file_path(field: &Field, store_kind: StoreKind) -> ControllerResult<PathBuf> {
    let field_content = field
        .content_disposition()
        .ok_or_else(|| ControllerError::BadRequest("Missing field content-disposition".into()))?;
    let field_content_name = field_content.get_filename().ok_or_else(|| {
        ControllerError::BadRequest("Missing file name in content-disposition".into())
    })?;

    let mut file_name = generate_random_string(30);
    let uploaded_file_extension = get_extension_from_filename(field_content_name);
    if let Some(extension) = uploaded_file_extension {
        file_name.push_str(format!(".{}", extension).as_str());
    }

    let path = path(&file_name, FileType::File, store_kind);

    Ok(path)
}

fn generate_image_path(field: &Field, store_kind: StoreKind) -> ControllerResult<PathBuf> {
    let extension = match field.content_type().to_string().as_str() {
        "image/jpeg" => ".jpg",
        "image/png" => ".png",
        "image/svg+xml" => ".svg",
        "image/tiff" => ".tif",
        "image/bmp" => ".bmp",
        "image/webp" => ".webp",
        "image/gif" => ".gif",
        unsupported => {
            return Err(ControllerError::BadRequest(format!(
                "Unsupported image Mime type: {}",
                unsupported
            )))
        }
    };

    // using a random string for the image name because
    // a) we don't want the filename to be user controllable
    // b) we don't want the filename to be too easily guessable (so no uuid)
    let mut file_name = generate_random_string(30);
    file_name.push_str(extension);
    let path = path(&file_name, FileType::Image, store_kind);

    Ok(path)
}

fn validate_media_headers(headers: &HeaderMap) -> ControllerResult<()> {
    let content_type = headers.get(header::CONTENT_TYPE).ok_or_else(|| {
        ControllerError::BadRequest("Please provide a Content-Type header".into())
    })?;
    let content_type_string = String::from_utf8_lossy(content_type.as_bytes()).to_string();

    if !content_type_string.contains("multipart/form-data") {
        return Err(ControllerError::BadRequest(format!(
            "Unsupported type: {}",
            content_type_string
        )));
    }

    let content_length = headers.get(header::CONTENT_LENGTH).ok_or_else(|| {
        ControllerError::BadRequest("Please provide a Content-Length in header".into())
    })?;
    let content_length_number = String::from_utf8_lossy(content_length.as_bytes())
        .to_string()
        .parse::<i32>()
        .map_err(|original_err| ControllerError::InternalServerError(original_err.to_string()))?;

    // This does not enforce the size of the file since the client can lie about the content length
    if content_length_number > 10485760 {
        return Err(ControllerError::BadRequest(
            "Content length over 10 MB".into(),
        ));
    }

    Ok(())
}

enum FileType {
    Image,
    Audio,
    File,
}

fn path(file_name: &str, file_type: FileType, store_kind: StoreKind) -> PathBuf {
    let (base_dir, base_id) = match store_kind {
        StoreKind::Organization(id) => ("organization", id),
        StoreKind::Course(id) => ("course", id),
        StoreKind::Exam(id) => ("exam", id),
    };
    let file_type_subdir = match file_type {
        FileType::Image => "images",
        FileType::Audio => "audios",
        FileType::File => "files",
    };
    [base_dir, &base_id.to_string(), file_type_subdir, file_name]
        .iter()
        .collect()
}
