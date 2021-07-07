//! Controllers for requests starting with `/api/v0/cms/courses`.

use crate::controllers::ApplicationError;
use crate::domain::authorization::AuthUser;
use crate::models::courses::Course;
use crate::utils::file_store::file_utils::{get_extension_from_filename, upload_media_to_storage};
use crate::utils::file_store::{course_audio_path, course_file_path, course_image_path, FileStore};
use crate::{controllers::ApplicationResult, models::courses::CourseStructure};
use actix_multipart as mp;
use actix_web::http::header;
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use actix_web::HttpRequest;
use futures::StreamExt;
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

/// Result of a image upload. Tells where the uploaded image can be retrieved from.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
struct UploadResult {
    url: String,
}

/**
GET `/api/v0/cms/courses/:course_id/structure` - Returns the structure of a course.
# Example
```json
{
  "course": {
    "id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
    "slug": "introduction-to-everything",
    "created_at": "2021-04-28T10:40:54.503917",
    "updated_at": "2021-04-28T10:40:54.503917",
    "name": "Introduction to everything",
    "organization_id": "1b89e57e-8b57-42f2-9fed-c7a6736e3eec",
    "deleted_at": null
  },
  "pages": [
    {
      "id": "f3b0d699-c9be-4d56-bd0a-9d40e5547e4d",
      "created_at": "2021-04-28T13:51:51.024118",
      "updated_at": "2021-04-28T14:36:18.179490",
      "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
      "content": [],
      "url_path": "/",
      "title": "Welcome to Introduction to Everything",
      "deleted_at": null,
      "chapter_id": "d332f3d9-39a5-4a18-80f4-251727693c37"
    }
  ],
  "chapters": [
    {
      "id": "d332f3d9-39a5-4a18-80f4-251727693c37",
      "created_at": "2021-04-28T16:11:47.477850",
      "updated_at": "2021-04-28T16:11:47.477850",
      "name": "The Basics",
      "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
      "deleted_at": null,
      "chapter_number": 1,
      "front_page_id": null
    }
  ]
}
```
*/
#[instrument(skip(pool))]
async fn get_course_structure(
    request_course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ApplicationResult<Json<CourseStructure>> {
    let mut conn = pool.acquire().await?;
    let course_structure =
        crate::models::courses::get_course_structure(&mut conn, *request_course_id).await?;
    Ok(Json(course_structure))
}

/**
POST `/api/v0/cms/pages/:page_id/upload` - Uploads a media (image, audio, file) for the course from Gutenberg page edit.

Put the the contents of the media in a form and add a content type header multipart/form-data.
# Example

Request:
```http
POST /api/v0/cms/pages/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/upload HTTP/1.1
Content-Type: multipart/form-data

BINARY_DATA
```

Response:
```json
{
    "url": "/api/v0/files/organizations/1b89e57e-8b57-42f2-9fed-c7a6736e3eec/courses/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/images/iHZMHdvsazy43ZtP0Ea01sy8AOpUiZ.png"
}

```
*/
#[instrument(skip(payload, request, pool, file_store))]
async fn upload_media_for_course<T: FileStore>(
    request_course_id: web::Path<Uuid>,
    mut payload: mp::Multipart,
    request: HttpRequest,
    pool: web::Data<PgPool>,
    file_store: web::Data<T>,
) -> ApplicationResult<Json<UploadResult>> {
    let mut conn = pool.acquire().await?;
    let course = crate::models::courses::get_course(&mut conn, *request_course_id).await?;
    let headers = request.headers();

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

    let next_payload = payload
        .next()
        .await
        .ok_or_else(|| ApplicationError::BadRequest("Missing form data".into()))?;
    match next_payload {
        Ok(field) => {
            let mime = field.content_type();

            // using a random string for the image name because
            // a) we don't want the filename to be user controllable
            // b) we don't want the filename to be too easily guessable (so no uuid)
            let mut file_name: String = thread_rng()
                .sample_iter(&Alphanumeric)
                .take(30)
                .map(char::from)
                .collect();

            if mime.type_() == mime::IMAGE {
                return upload_image_for_course(file_name, field, &course, file_store.as_ref())
                    .await;
            } else if mime.type_() == mime::AUDIO {
                return upload_audio_for_course(file_name, field, &course, file_store.as_ref())
                    .await;
            }

            let field_content = field.content_disposition().ok_or_else(|| {
                ApplicationError::BadRequest("Missing field content-disposition".into())
            })?;
            let field_content_name = field_content.get_filename().ok_or_else(|| {
                ApplicationError::BadRequest("Missing file name in content-disposition".into())
            })?;

            let uploaded_file_extension = get_extension_from_filename(field_content_name);
            if let Some(extension) = uploaded_file_extension {
                file_name.push_str(format!(".{}", extension).as_str());
            }

            let path = course_file_path(&course, file_name)
                .map_err(|err| ApplicationError::InternalServerError(err.to_string()))?;

            upload_media_to_storage(&path, field, file_store.as_ref()).await?;

            return Ok(Json(UploadResult {
                url: file_store.get_download_url(&path.as_path()).await?,
            }));
        }
        Err(err) => Err(ApplicationError::InternalServerError(err.to_string())),
    }
}

async fn upload_image_for_course(
    mut file_name: String,
    field: mp::Field,
    course: &Course,
    file_store: &impl FileStore,
) -> ApplicationResult<Json<UploadResult>> {
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
    file_name.push_str(extension);
    let path = course_image_path(&course, file_name)
        .map_err(|err| ApplicationError::InternalServerError(err.to_string()))?;

    upload_media_to_storage(&path, field, file_store).await?;

    return Ok(Json(UploadResult {
        url: file_store.get_download_url(&path.as_path()).await?,
    }));
}

async fn upload_audio_for_course(
    mut file_name: String,
    field: mp::Field,
    course: &Course,
    file_store: &impl FileStore,
) -> ApplicationResult<Json<UploadResult>> {
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
    file_name.push_str(extension);
    let path = course_audio_path(&course, file_name)
        .map_err(|err| ApplicationError::InternalServerError(err.to_string()))?;

    upload_media_to_storage(&path, field, file_store).await?;

    return Ok(Json(UploadResult {
        url: file_store.get_download_url(&path.as_path()).await?,
    }));
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_courses_routes<T: 'static + FileStore>(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{course_id}/structure",
        web::get().to(get_course_structure),
    )
    .route(
        "/{course_id}/upload",
        web::post().to(upload_media_for_course::<T>),
    );
}
