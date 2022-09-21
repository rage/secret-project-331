//! Shared helper functions for multiple controllers.

use std::{path::PathBuf, sync::Arc};

pub use crate::domain::authorization::AuthorizationToken;
use crate::{
    domain::{authorization::AuthorizedResponse, file_uploading::upload_media_to_storage},
    prelude::*,
};
use actix_http::header::HeaderMap;
use actix_multipart::Field;
use actix_web::http::header;
use futures::StreamExt;
use headless_lms_utils::{
    file_store::file_utils::get_extension_from_filename, strings::generate_random_string,
};
use models::organizations::DatabaseOrganization;

#[derive(Debug, Clone, Copy, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub enum StoreKind {
    Organization(Uuid),
    Course(Uuid),
    Exam(Uuid),
}

pub async fn upload_media<'a>(
    headers: &HeaderMap,
    mut payload: Multipart,
    store_kind: StoreKind,
    file_store: &dyn FileStore,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<PathBuf> {
    let mut conn = pool.acquire().await?;
    validate_media_headers(headers, &user, &pool).await?;
    let file_payload = payload.next().await.ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::BadRequest,
            "Missing form data".into(),
            None,
        )
    })?;
    match file_payload {
        Ok(field) => {
            let path: AuthorizedResponse<PathBuf> = match field.content_type().type_() {
                mime::AUDIO => generate_audio_path(&field, store_kind, &user, &pool).await?,
                mime::IMAGE => generate_image_path(&field, store_kind, &user, &pool).await?,
                _ => generate_file_path(&field, store_kind, &user, &pool).await?,
            };
            upload_media_to_storage(&path.data, field, file_store).await?;
            let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
            token.authorized_ok(path.data)
        }
        Err(err) => Err(ControllerError::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            Some(err.into()),
        )),
    }
}

pub async fn upload_image_for_organization(
    headers: &HeaderMap,
    mut payload: Multipart,
    organization: &DatabaseOrganization,
    file_store: &Arc<dyn FileStore>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<PathBuf> {
    validate_media_headers(headers, &user, &pool).await?;
    let mut conn = pool.acquire().await?;
    let next_payload = payload.next().await.ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::BadRequest,
            "Missing form data".into(),
            None,
        )
    })?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    match next_payload {
        Ok(field) => {
            let path: PathBuf = match field.content_type().type_() {
                mime::IMAGE => {
                    generate_image_path(
                        &field,
                        StoreKind::Organization(organization.id),
                        &user,
                        &pool,
                    )
                    .await
                }
                unsupported => Err(ControllerError::new(
                    ControllerErrorType::BadRequest,
                    format!("Unsupported image Mime type: {}", unsupported),
                    None,
                )),
            }
            .map(|value| value.data)?;
            upload_media_to_storage(&path, field, file_store.as_ref()).await?;
            token.authorized_ok(path)
        }
        Err(err) => Err(ControllerError::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            Some(err.into()),
        )),
    }
}

async fn generate_audio_path(
    field: &Field,
    store_kind: StoreKind,
    user: &AuthUser,
    pool: &web::Data<PgPool>,
) -> ControllerResult<PathBuf> {
    let mut conn = pool.acquire().await?;
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
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                format!("Unsupported audio Mime type: {}", unsupported),
                None,
            ))
        }
    };
    let mut file_name = generate_random_string(30);
    file_name.push_str(extension);
    let path = path(&file_name, FileType::Audio, store_kind);
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    token.authorized_ok(path)
}

async fn generate_file_path(
    field: &Field,
    store_kind: StoreKind,
    user: &AuthUser,
    pool: &web::Data<PgPool>,
) -> ControllerResult<PathBuf> {
    let mut conn = pool.acquire().await?;
    let field_content = field.content_disposition();
    let field_content_name = field_content.get_filename().ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::BadRequest,
            "Missing file name in content-disposition".into(),
            None,
        )
    })?;

    let mut file_name = generate_random_string(30);
    let uploaded_file_extension = get_extension_from_filename(field_content_name);
    if let Some(extension) = uploaded_file_extension {
        file_name.push_str(format!(".{}", extension).as_str());
    }

    let path = path(&file_name, FileType::File, store_kind);

    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    token.authorized_ok(path)
}

async fn generate_image_path(
    field: &Field,
    store_kind: StoreKind,
    user: &AuthUser,
    pool: &web::Data<PgPool>,
) -> ControllerResult<PathBuf> {
    let mut conn = pool.acquire().await?;
    let extension = match field.content_type().to_string().as_str() {
        "image/jpeg" => ".jpg",
        "image/png" => ".png",
        "image/svg+xml" => ".svg",
        "image/tiff" => ".tif",
        "image/bmp" => ".bmp",
        "image/webp" => ".webp",
        "image/gif" => ".gif",
        unsupported => {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                format!("Unsupported image Mime type: {}", unsupported),
                None,
            ))
        }
    };

    // using a random string for the image name because
    // a) we don't want the filename to be user controllable
    // b) we don't want the filename to be too easily guessable (so no uuid)
    let mut file_name = generate_random_string(30);
    file_name.push_str(extension);
    let path = path(&file_name, FileType::Image, store_kind);

    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    token.authorized_ok(path)
}

async fn validate_media_headers(
    headers: &HeaderMap,
    user: &AuthUser,
    pool: &web::Data<PgPool>,
) -> ControllerResult<()> {
    let mut conn = pool.acquire().await?;
    let content_type = headers.get(header::CONTENT_TYPE).ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::BadRequest,
            "Please provide a Content-Type header".into(),
            None,
        )
    })?;
    let content_type_string = String::from_utf8_lossy(content_type.as_bytes()).to_string();

    if !content_type_string.contains("multipart/form-data") {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            format!("Unsupported type: {}", content_type_string),
            None,
        ));
    }

    let content_length = headers.get(header::CONTENT_LENGTH).ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::BadRequest,
            "Please provide a Content-Length in header".into(),
            None,
        )
    })?;
    let content_length_number = String::from_utf8_lossy(content_length.as_bytes())
        .to_string()
        .parse::<i32>()
        .map_err(|original_err| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                original_err.to_string(),
                Some(original_err.into()),
            )
        })?;

    // This does not enforce the size of the file since the client can lie about the content length
    if content_length_number > 10485760 {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Content length over 10 MB".into(),
            None,
        ));
    }

    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    token.authorized_ok(())
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
