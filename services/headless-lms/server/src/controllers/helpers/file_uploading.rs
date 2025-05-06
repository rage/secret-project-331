//! Helper functions related to uploading to file storage.

pub use crate::domain::authorization::AuthorizationToken;
use crate::prelude::*;
use actix_http::header::HeaderMap;
use actix_multipart as mp;
use actix_multipart::Field;
use actix_web::http::header;
use futures::{StreamExt, TryStreamExt};
use headless_lms_utils::file_store::{FileStore, GenericPayload};
use headless_lms_utils::{
    file_store::file_utils::get_extension_from_filename, strings::generate_random_string,
};
use mime::Mime;
use models::exercise_slides::ExerciseSlide;
use models::exercise_tasks::ExerciseTask;
use models::exercises::Exercise;
use models::organizations::DatabaseOrganization;
use rand::distr::Alphanumeric;
use rand::distr::SampleString;
use std::{collections::HashMap, path::Path};
use std::{path::PathBuf, sync::Arc};

/// Processes an upload from an exercise service or an exercise iframe.
/// This function assumes that any permission checks have already been made.
pub async fn process_exercise_service_upload(
    conn: &mut PgConnection,
    exercise_service_slug: &str,
    mut payload: Multipart,
    file_store: &dyn FileStore,
    paths: &mut HashMap<String, String>,
    uploader: Option<AuthUser>,
    base_url: &str,
) -> Result<(), ControllerError> {
    let mut tx = conn.begin().await?;
    while let Some(item) = payload.next().await {
        let field = item.unwrap();
        let field_name = {
            let name_ref = field.name().ok_or_else(|| {
                ControllerError::new(
                    ControllerErrorType::BadRequest,
                    "Tried to upload a file without a file name".to_string(),
                    None,
                )
            })?;
            name_ref.to_string()
        };

        let random_filename = generate_random_string(32);
        let path = format!("{exercise_service_slug}/{random_filename}");

        upload_field_to_storage(&mut tx, Path::new(&path), field, file_store, uploader).await?;
        let url = format!("{base_url}/api/v0/files/{path}");
        paths.insert(field_name, url);
    }
    tx.commit().await?;
    Ok(())
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub enum StoreKind {
    Organization(Uuid),
    Course(Uuid),
    Exam(Uuid),
}

/// Processes an upload from CMS.
pub async fn upload_file_from_cms(
    headers: &HeaderMap,
    mut payload: Multipart,
    store_kind: StoreKind,
    file_store: &dyn FileStore,
    conn: &mut PgConnection,
    user: AuthUser,
) -> Result<PathBuf, ControllerError> {
    let file_payload = payload.next().await.ok_or_else(|| {
        ControllerError::new(ControllerErrorType::BadRequest, "Missing form data", None)
    })?;
    match file_payload {
        Ok(field) => {
            upload_field_from_cms(headers, field, store_kind, file_store, conn, user).await
        }
        Err(err) => Err(ControllerError::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            None,
        )),
    }
}

/// Processes an upload from CMS.
pub async fn upload_field_from_cms(
    headers: &HeaderMap,
    field: Field,
    store_kind: StoreKind,
    file_store: &dyn FileStore,
    conn: &mut PgConnection,
    user: AuthUser,
) -> Result<PathBuf, ControllerError> {
    validate_media_headers(headers, &user, conn).await?;
    let path = match field.content_type().map(|ct| ct.type_()) {
        Some(mime::AUDIO) => generate_audio_path(&field, store_kind)?,
        Some(mime::IMAGE) => generate_image_path(&field, store_kind)?,
        _ => generate_file_path(&field, store_kind)?,
    };
    upload_field_to_storage(conn, &path, field, file_store, Some(user)).await?;
    Ok(path)
}

/// Processes an upload for an organization's image.
pub async fn upload_image_for_organization(
    headers: &HeaderMap,
    mut payload: Multipart,
    organization: &DatabaseOrganization,
    file_store: &Arc<dyn FileStore>,
    user: AuthUser,
    conn: &mut PgConnection,
) -> Result<PathBuf, ControllerError> {
    validate_media_headers(headers, &user, conn).await?;
    let next_payload: Result<Field, mp::MultipartError> =
        payload.next().await.ok_or_else(|| {
            ControllerError::new(ControllerErrorType::BadRequest, "Missing form data", None)
        })?;
    match next_payload {
        Ok(field) => {
            let path: PathBuf = match field.content_type().map(|ct| ct.type_()) {
                Some(mime::IMAGE) => {
                    generate_image_path(&field, StoreKind::Organization(organization.id))
                }
                Some(unsupported) => Err(ControllerError::new(
                    ControllerErrorType::BadRequest,
                    format!("Unsupported image Mime type: {}", unsupported),
                    None,
                )),
                None => Err(ControllerError::new(
                    ControllerErrorType::BadRequest,
                    "Missing image Mime type",
                    None,
                )),
            }?;
            upload_field_to_storage(conn, &path, field, file_store.as_ref(), Some(user)).await?;
            Ok(path)
        }
        Err(err) => Err(ControllerError::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            None,
        )),
    }
}

// These limits must match the limits in CMS/src/services/backend/media/uploadMediaToServer.ts
// If you modify these, update the TypeScript file as well.
// Note: The nginx ingress also has a limit on max request size (see kubernetes/base/ingress.yml)
const FILE_SIZE_LIMITS: &[(mime::Name, i32)] = &[
    // 10 MB for images
    (mime::IMAGE, 10 * 1024 * 1024),
    // 100 MB for audio
    (mime::AUDIO, 100 * 1024 * 1024),
    // 100 MB for video
    (mime::VIDEO, 100 * 1024 * 1024),
    // 25 MB for documents/other files
    (mime::APPLICATION, 25 * 1024 * 1024),
];
// 10 MB default fallback
const DEFAULT_FILE_SIZE_LIMIT: i32 = 10 * 1024 * 1024;

fn get_size_limit_for_mime(mime_type: Option<mime::Name>) -> i32 {
    mime_type
        .and_then(|mime| FILE_SIZE_LIMITS.iter().find(|(m, _)| *m == mime))
        .map(|(_, size)| *size)
        .unwrap_or(DEFAULT_FILE_SIZE_LIMIT)
}

/// Uploads the data from the multipart `field` to the given `path` in file storage.
async fn upload_field_to_storage(
    conn: &mut PgConnection,
    path: &Path,
    field: mp::Field,
    file_store: &dyn FileStore,
    uploader: Option<AuthUser>,
) -> Result<(), ControllerError> {
    // Check file size limit based on mime type
    let mime_type = field.content_type().map(|ct| ct.type_());
    let size_limit = get_size_limit_for_mime(mime_type);

    // Get size from content disposition if available
    // Note: This does not enforce the size of the file since the client can lie about the content length
    if let Some(content_disposition) = field.content_disposition() {
        if let Some(size_str) = content_disposition
            .parameters
            .iter()
            .find_map(|p| p.as_unknown("size"))
        {
            if let Ok(size) = size_str.parse::<u64>() {
                if size > size_limit as u64 {
                    return Err(ControllerError::new(
                        ControllerErrorType::BadRequest,
                        format!(
                            "File size {} exceeds limit of {} bytes for type {}",
                            size,
                            size_limit,
                            mime_type.map_or("unknown".to_string(), |m| m.to_string())
                        ),
                        None,
                    ));
                }
            }
        }
    }

    // TODO: convert archives into a uniform format
    let mime_type = field
        .content_type()
        .map(|ct| ct.to_string())
        .unwrap_or_default();

    let name = {
        let name_ref = field.name().ok_or_else(|| {
            ControllerError::new(
                ControllerErrorType::BadRequest,
                "Tried to upload a file without a file name".to_string(),
                None,
            )
        })?;
        name_ref.to_string()
    };

    let contents = Box::pin(field.map_err(|orig| anyhow::Error::msg(orig.to_string())));

    upload_file_to_storage(
        conn,
        path,
        &name,
        &mime_type,
        contents,
        file_store,
        uploader.map(|u| u.id),
    )
    .await?;
    Ok(())
}
pub async fn upload_certificate_svg(
    conn: &mut PgConnection,
    file_name: &str,
    file: GenericPayload,
    file_store: &dyn FileStore,
    course_id: Uuid,
    uploader: AuthUser,
) -> Result<(Uuid, PathBuf), ControllerError> {
    let path = path(file_name, FileType::Image, StoreKind::Course(course_id));
    let safe_path = make_filename_safe(&path);
    let id = upload_file_to_storage(
        conn,
        &safe_path,
        file_name,
        "image/svg+xml",
        file,
        file_store,
        Some(uploader.id),
    )
    .await?;
    Ok((id, safe_path))
}

pub struct ExerciseTaskInfo<'a> {
    pub course_id: Uuid,
    pub exercise: &'a Exercise,
    pub exercise_slide: &'a ExerciseSlide,
    pub exercise_task: &'a ExerciseTask,
}

pub async fn upload_exercise_archive(
    conn: &mut PgConnection,
    file: GenericPayload,
    file_store: &dyn FileStore,
    exercise: ExerciseTaskInfo<'_>,
    mime: Mime,
    uploader: Uuid,
) -> Result<(Uuid, PathBuf), ControllerError> {
    let file_name = &exercise.exercise.name;
    let path = nested_path(
        &[
            "user-exercise-uploads",
            "exercise",
            &exercise.exercise.id.to_string(),
            "slide",
            &exercise.exercise_slide.id.to_string(),
            "task",
            &exercise.exercise_task.id.to_string(),
            file_name,
        ],
        FileType::File,
        StoreKind::Course(exercise.course_id),
    );
    let safe_path = make_filename_safe(&path);
    let id = upload_file_to_storage(
        conn,
        &safe_path,
        file_name,
        mime.as_ref(),
        file,
        file_store,
        Some(uploader),
    )
    .await?;
    Ok((id, safe_path))
}

async fn upload_file_to_storage(
    conn: &mut PgConnection,
    path: &Path,
    file_name: &str,
    mime_type: &str,
    file: GenericPayload,
    file_store: &dyn FileStore,
    uploader: Option<Uuid>,
) -> Result<Uuid, ControllerError> {
    let mut tx = conn.begin().await?;
    let path_string = path.to_str().context("invalid path")?.to_string();
    let id =
        models::file_uploads::insert(&mut tx, file_name, &path_string, mime_type, uploader).await?;
    file_store.upload_stream(path, file, mime_type).await?;
    tx.commit().await?;
    Ok(id)
}

fn make_filename_safe(path: &PathBuf) -> PathBuf {
    let mut path_buf = path.to_owned();
    let random_string = Alphanumeric.sample_string(&mut rand::rng(), 25);
    path_buf.set_file_name(random_string);
    if let Some(ext) = path.extension() {
        // For convenience, we'll keep the original extension in most cases. We'll just filter out any potentially problematic characters.
        let ext = ext
            .to_str()
            .unwrap_or("")
            .chars()
            .filter(|c| c.is_alphanumeric())
            .collect::<String>();
        path_buf.set_extension(ext);
    }
    path_buf
}

pub async fn delete_file_from_storage(
    conn: &mut PgConnection,
    id: Uuid,
    file_store: &dyn FileStore,
) -> Result<(), ControllerError> {
    let file_to_delete = models::file_uploads::delete_and_fetch_path(conn, id).await?;
    file_store.delete(Path::new(&file_to_delete)).await?;
    Ok(())
}

/// Generates a path for an audio file with the appropriate extension.
fn generate_audio_path(field: &Field, store_kind: StoreKind) -> Result<PathBuf, ControllerError> {
    let extension = match field
        .content_type()
        .map(|ct| ct.to_string())
        .unwrap_or_default()
        .as_str()
    {
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
    Ok(path)
}

/// Generates a path for a generic file with the appropriate extension based on its filename.
fn generate_file_path(field: &Field, store_kind: StoreKind) -> Result<PathBuf, ControllerError> {
    let field_content = field.content_disposition().ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::BadRequest,
            "No content disposition in uploaded file".to_string(),
            None,
        )
    })?;
    let field_content_name = field_content.get_filename().ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::BadRequest,
            "Missing file name in content-disposition",
            None,
        )
    })?;

    let mut file_name = generate_random_string(30);
    let uploaded_file_extension = get_extension_from_filename(field_content_name);
    if let Some(extension) = uploaded_file_extension {
        file_name.push_str(format!(".{}", extension).as_str());
    }

    let path = path(&file_name, FileType::File, store_kind);
    Ok(path)
}

/// Generates a path for an image file with the appropriate extension.
fn generate_image_path(field: &Field, store_kind: StoreKind) -> Result<PathBuf, ControllerError> {
    let extension = match field
        .content_type()
        .map(|ct| ct.to_string())
        .unwrap_or_default()
        .as_str()
    {
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
    Ok(path)
}

/// Generates a path for an audio file with the appropriate extension.
async fn validate_media_headers(
    headers: &HeaderMap,
    user: &AuthUser,
    conn: &mut PgConnection,
) -> ControllerResult<()> {
    let content_type = headers.get(header::CONTENT_TYPE).ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::BadRequest,
            "Please provide a Content-Type header",
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
            "Please provide a Content-Length in header",
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

    let mime_type = headers
        .get("X-File-Type")
        .map(|h| h.to_str().unwrap_or("application/octet-stream"))
        .unwrap_or("application/octet-stream")
        .split('/')
        .next()
        .map(|s| match s {
            "image" => mime::IMAGE,
            "audio" => mime::AUDIO,
            "video" => mime::VIDEO,
            "application" => mime::APPLICATION,
            _ => mime::APPLICATION,
        });
    let size_limit = get_size_limit_for_mime(mime_type);

    // Note: This does not enforce the size of the file since the client can lie about the content length
    if content_length_number > size_limit {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            format!(
                "File size {} exceeds limit of {} bytes for type {}",
                content_length_number,
                size_limit,
                mime_type.map_or("unknown".to_string(), |m| m.to_string())
            ),
            None,
        ));
    }

    let token = authorize(conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    token.authorized_ok(())
}

enum FileType {
    Image,
    Audio,
    File,
}

fn path(file_name: &str, file_type: FileType, store_kind: StoreKind) -> PathBuf {
    nested_path(&[file_name], file_type, store_kind)
}

fn nested_path(components: &[&str], file_type: FileType, store_kind: StoreKind) -> PathBuf {
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
    [base_dir, &base_id.to_string(), file_type_subdir]
        .iter()
        .chain(components)
        .collect()
}
