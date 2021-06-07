//! Controllers for requests starting with `/api/v0/cms/courses`.
use crate::{
    controllers::{ApplicationError, ApplicationResult},
    models::courses::CourseStructure,
    utils::file_store::{course_image_path, local_file_store::LocalFileStore},
};
use actix_web::{
    http::header,
    web::{self, Json},
};
use actix_web::{web::ServiceConfig, HttpRequest};
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::str::FromStr;
use uuid::Uuid;

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
async fn get_course_structure(
    request_course_id: web::Path<String>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<CourseStructure>> {
    let course_id = Uuid::from_str(&request_course_id)?;

    let course_structure =
        crate::models::courses::get_course_structure(pool.get_ref(), course_id).await?;
    Ok(Json(course_structure))
}
/// Result of a image upload. Tells where the uploaded image can be retrieved from.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
struct ImageUploadResult {
    url: String,
}

/**
POST `/api/v0/cms/courses/:course_id/images` - Upload a image.

Put the the contents of the image in the request body and add a content type header. such as image/jpeg.
# Example

Request:
```http
POST /api/v0/cms/courses/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/images HTTP/1.1
Content-Type: image/png

BINARY_DATA
```

Response:
```json
{
    "url": "/api/v0/files/organizations/1b89e57e-8b57-42f2-9fed-c7a6736e3eec/courses/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/images/iHZMHdvsazy43ZtP0Ea01sy8AOpUiZ.png"
}
```
*/
async fn upload_image(
    request_course_id: web::Path<String>,
    payload: web::Payload,
    request: HttpRequest,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<ImageUploadResult>> {
    // TODO: add max image size
    let course_id = Uuid::from_str(&request_course_id)?;
    let course = crate::models::courses::get_course(pool.get_ref(), course_id).await?;
    let headers = request.headers();
    let content_type_option = headers.get(header::CONTENT_TYPE);
    if content_type_option.is_none() {
        return Err(ApplicationError::BadRequest(
            "Please provide a Content-Type header".into(),
        ));
    }
    let content_type = content_type_option.unwrap();
    let content_type_string = String::from_utf8_lossy(content_type.as_bytes()).to_string();

    let extension = match content_type_string.as_str() {
        "image/jpg" => ".jpg",
        "image/jpeg" => ".jpg",
        "image/png" => ".png",
        "image/svg+xml" => ".svg",
        "image/webp" => ".webp",
        "image/gif" => ".gif",
        _ => return Err(ApplicationError::BadRequest("Unsupported mime type".into())),
    };

    let local_file_store =
        LocalFileStore::new("uploads".into(), "/api/v0/images".to_string()).await?;

    // using a random string for the image name because
    // a) we don't want the filename to be user controllable
    // b) we don't want the filename to be too easily guessable (so no uuid)
    let mut image_name: String = thread_rng()
        .sample_iter(&Alphanumeric)
        .take(30)
        .map(char::from)
        .collect();

    image_name.push_str(extension);

    let path = course_image_path(&course, image_name)
        .map_err(|err| ApplicationError::InternalServerError(err.to_string()))?;

    local_file_store
        .upload_stream(&path, payload, content_type_string)
        .await?;

    Ok(Json(ImageUploadResult {
        url: format!("/api/v0/files/{}", path.to_string_lossy()),
    }))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_courses_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_id}/images", web::post().to(upload_image))
        .route(
            "/{course_id}/structure",
            web::get().to(get_course_structure),
        );
}
