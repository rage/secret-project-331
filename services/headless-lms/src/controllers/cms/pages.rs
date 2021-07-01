//! Controllers for requests starting with `/api/v0/cms/pages`.

use crate::{
    controllers::{ApplicationError, ApplicationResult},
    domain::authorization::AuthUser,
    models::{
        courses::Course,
        pages::{NewPage, Page, PageUpdate},
    },
    utils::file_store::{
        course_audio_path, course_file_path, course_image_path,
        file_utils::{get_extension_from_filename, upload_media_to_storage},
        FileStore,
    },
};

use actix_multipart as mp;
use actix_web::{
    http::header,
    web::{self, Json},
};

use actix_web::{web::ServiceConfig, HttpRequest};

use futures::StreamExt;
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

/**
GET `/api/v0/cms/pages/:page_id` - Get a page with exercises and exercise tasks by id.

# Example

Request: `GET /api/v0/cms/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02`

Response:
```json
{
  "id": "40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02",
  "created_at": "2021-03-08T20:14:56.216394",
  "updated_at": "2021-03-08T20:14:56.216394",
  "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
  "content": [
    {
      "type": "x"
    }
  ],
  "url_path": "/part-1/hello-world",
  "title": "Hello world!",
  "deleted_at": null,
  "chapter_id": "2495ffa3-7ea9-4615-baa5-828023688c79"
}
```
*/
#[instrument(skip(pool))]
async fn get_page(
    request_page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ApplicationResult<Json<Page>> {
    let mut conn = pool.acquire().await?;
    let page = crate::models::pages::get_page_with_exercises(&mut conn, *request_page_id).await?;
    Ok(Json(page))
}

/**
POST `/api/v0/cms/pages` - Create a new page.

Please note that this endpoint will change all the exercise and exercise task ids you've created. Make sure the use the updated ids from the response object.

If optional property front_page_of_chapter_id is set, this page will become the front page of the specified course part.

# Example:

Request:
```http
POST /api/v0/cms/pages HTTP/1.1
Content-Type: application/json

{
  "content": [
    {
      "type": "x",
      "id": "2a4e517d-a7d2-4d82-89fb-a1333d8d01d1"
    }
  ],
  "url_path": "/part-2/best-page",
  "title": "Hello world!",
  "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
  "chapter_id": "2495ffa3-7ea9-4615-baa5-828023688c79"
}
```

Response:
```json
{
  "id": "d90bf7ab-181c-4aa2-a87e-5c28238cc67d",
  "created_at": "2021-03-12T09:27:36.428501",
  "updated_at": "2021-03-12T09:27:36.428501",
  "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
  "content": [
    {
      "id": "18110110-d02a-4432-8cb9-084d0c63a524",
      "type": "x"
    }
  ],
  "url_path": "/part-2/best-page",
  "title": "Hello world!",
  "deleted_at": null,
  "chapter_id": "2495ffa3-7ea9-4615-baa5-828023688c79",
  "front_page_of_chapter_id": null
}
```

*/
#[instrument(skip(pool))]
async fn post_new_page(
    payload: web::Json<NewPage>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ApplicationResult<Json<Page>> {
    let mut conn = pool.acquire().await?;
    let new_page = payload.0;
    let page = crate::models::pages::insert_page(&mut conn, new_page).await?;
    Ok(Json(page))
}

/**
PUT `/api/v0/cms/pages/:page_id` - Update a page by id.

Please note that this endpoint will change all the exercise and exercise task ids you've created. Make sure the use the updated ids from the response object.

If optional property front_page_of_chapter_id is set, this page will become the front page of the specified course part.

# Example:

Request:

```http
PUT /api/v0/cms/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02 HTTP/1.1
Content-Type: application/json

{
  "content": [{"type": "x"}],
  "url_path": "/part-1/hello-world",
  "title": "Hello world!",
  "chapter_id": "2495ffa3-7ea9-4615-baa5-828023688c79"
}
```

Response:

```json
{
  "id": "40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02",
  "created_at": "2021-03-08T20:14:56.216394",
  "updated_at": "2021-03-08T20:14:56.216394",
  "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
  "content": [
    {
      "type": "x"
    }
  ],
  "url_path": "/part-1/hello-world",
  "title": "Hello world!",
  "deleted_at": null,
  "chapter_id": "2495ffa3-7ea9-4615-baa5-828023688c79",
  "front_page_of_chapter_id": null
}
```
*/
#[instrument(skip(pool))]
async fn update_page(
    payload: web::Json<PageUpdate>,
    request_page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ApplicationResult<Json<Page>> {
    let mut conn = pool.acquire().await?;
    let page_update = payload.0;
    let page = crate::models::pages::update_page(&mut conn, *request_page_id, page_update).await?;
    Ok(Json(page))
}

/**
DELETE `/api/v0/cms/pages/:page_id` - Delete a page, related exercises, and related exercise tasks by id.


# Example

Request: `DELETE /api/v0/cms/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02`

Response:
```json
{
  "id": "40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02",
  "created_at": "2021-03-08T20:14:56.216394",
  "updated_at": "2021-03-08T20:29:22.511073",
  "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
  "content": [
    {
      "type": "x"
    }
  ],
  "url_path": "/part-1/hello-world",
  "title": "Hello world!",
  "deleted_at": "2021-04-28T16:33:42.670935",
  "chapter_id": "2495ffa3-7ea9-4615-baa5-828023688c79"
}
```
*/
#[instrument(skip(pool))]
async fn delete_page(
    request_page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ApplicationResult<Json<Page>> {
    let mut conn = pool.acquire().await?;
    let deleted_page =
        crate::models::pages::delete_page_and_exercises(&mut conn, *request_page_id).await?;
    Ok(Json(deleted_page))
}

/// Result of a image upload. Tells where the uploaded image can be retrieved from.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
struct UploadResult {
    url: String,
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
    request_page_id: web::Path<Uuid>,
    mut payload: mp::Multipart,
    request: HttpRequest,
    pool: web::Data<PgPool>,
    file_store: web::Data<T>,
) -> ApplicationResult<Json<UploadResult>> {
    let mut conn = pool.acquire().await?;
    let course_id = crate::models::pages::get_course_id(&mut conn, *request_page_id).await?;
    let course = crate::models::courses::get_course(&mut conn, course_id).await?;
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
                file_name.push_str(extension);
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
        "image/tiff" => ".tiff",
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
        "audio/midi" => ".midi",
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
pub fn _add_pages_routes<T: 'static + FileStore>(cfg: &mut ServiceConfig) {
    cfg.route("/{page_id}", web::get().to(get_page))
        .route("", web::post().to(post_new_page))
        .route("/{page_id}", web::put().to(update_page))
        .route("/{page_id}", web::delete().to(delete_page))
        .route(
            "/{page_id}/upload",
            web::post().to(upload_media_for_course::<T>),
        );
}
