//! Shared helper functions for multiple controllers.

use crate::controllers::{ApplicationError, ApplicationResult};
use crate::models::courses::Course;
use crate::utils::file_store::file_utils::{get_extension_from_filename, upload_media_to_storage};
use crate::utils::file_store::{course_audio_path, course_file_path, course_image_path, FileStore};
use crate::utils::strings::generate_random_string;
use actix_multipart as mp;
use actix_web::http::{header, HeaderMap};
use futures::StreamExt;
use std::path::PathBuf;

pub async fn upload_media_for_course_2(
    headers: &HeaderMap,
    mut payload: mp::Multipart,
    course: &Course,
    file_store: &impl FileStore,
) -> ApplicationResult<PathBuf> {
    validate_media_headers(&headers)?;

    let next_payload = payload
        .next()
        .await
        .ok_or_else(|| ApplicationError::BadRequest("Missing form data".into()))?;
    match next_payload {
        Ok(field) => {
            let path: PathBuf = match field.content_type().type_() {
                mime::AUDIO => generate_audio_path(&field, &course),
                mime::IMAGE => generate_image_path(&field, &course),
                _ => generate_file_path(&field, &course),
            }?;
            upload_media_to_storage(&path, field, file_store).await?;
            Ok(path)
        }
        Err(err) => Err(ApplicationError::InternalServerError(err.to_string())),
    }
}

fn generate_audio_path(field: &mp::Field, course: &Course) -> ApplicationResult<PathBuf> {
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
            return Err(ApplicationError::BadRequest(format!(
                "Unsupported audio Mime type: {}",
                unsupported
            )))
        }
    };
    let mut file_name = generate_random_string(30);
    file_name.push_str(extension);
    let path = course_audio_path(&course, file_name)
        .map_err(|err| ApplicationError::InternalServerError(err.to_string()))?;

    Ok(path)
}

fn generate_file_path(field: &mp::Field, course: &Course) -> ApplicationResult<PathBuf> {
    let field_content = field
        .content_disposition()
        .ok_or_else(|| ApplicationError::BadRequest("Missing field content-disposition".into()))?;
    let field_content_name = field_content.get_filename().ok_or_else(|| {
        ApplicationError::BadRequest("Missing file name in content-disposition".into())
    })?;

    let mut file_name = generate_random_string(30);
    let uploaded_file_extension = get_extension_from_filename(field_content_name);
    if let Some(extension) = uploaded_file_extension {
        file_name.push_str(format!(".{}", extension).as_str());
    }

    let path = course_file_path(&course, file_name)
        .map_err(|err| ApplicationError::InternalServerError(err.to_string()))?;

    Ok(path)
}

fn generate_image_path(field: &mp::Field, course: &Course) -> ApplicationResult<PathBuf> {
    let extension = match field.content_type().to_string().as_str() {
        "image/jpeg" => ".jpg",
        "image/png" => ".png",
        "image/svg+xml" => ".svg",
        "image/tiff" => ".tif",
        "image/bmp" => ".bmp",
        "image/webp" => ".webp",
        "image/gif" => ".gif",
        unsupported => {
            return Err(ApplicationError::BadRequest(format!(
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
    let path = course_image_path(&course, file_name)
        .map_err(|err| ApplicationError::InternalServerError(err.to_string()))?;

    Ok(path)
}

fn validate_media_headers(headers: &HeaderMap) -> ApplicationResult<()> {
    let content_type = headers.get(header::CONTENT_TYPE).ok_or_else(|| {
        ApplicationError::BadRequest("Please provide a Content-Type header".into())
    })?;
    let content_type_string = String::from_utf8_lossy(content_type.as_bytes()).to_string();

    if !content_type_string.contains("multipart/form-data") {
        return Err(ApplicationError::BadRequest(format!(
            "Unsupported type: {}",
            content_type_string
        )));
    }

    let content_length = headers.get(header::CONTENT_LENGTH).ok_or_else(|| {
        ApplicationError::BadRequest("Please provide a Content-Length in header".into())
    })?;
    let content_length_number = String::from_utf8_lossy(content_length.as_bytes())
        .to_string()
        .parse::<i32>()
        .map_err(|original_err| ApplicationError::InternalServerError(original_err.to_string()))?;

    // This does not enforce the size of the file since the client can lie about the content length
    if content_length_number > 10485760 {
        return Err(ApplicationError::BadRequest(
            "Content length over 10 MB".into(),
        ));
    }

    Ok(())
}
