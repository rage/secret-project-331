//! Controllers for requests starting with `/api/v0/cms/cms/courses`.
use crate::{
    controllers::{ApplicationError, ApplicationResult},
    models::courses::{Course, CourseStructure, CourseUpdate, NewCourse},
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
GET `/api/v0/cms/courses` - Returns a list of all courses.

# Example
```json
[
    {
        "id": "a90c39f8-5d23-461f-8375-0b05a55d7ac1",
        "slug": "introduction-to-programming",
        "created_at": "2021-03-05T22:26:59.067294",
        "updated_at": "2021-03-05T22:26:59.067294",
        "name": "Introduction to Programming",
        "organization_id": "c6fbb0fe-b418-4156-8319-fc761d482dcb",
        "deleted": false
    }
]
```
 */
async fn get_all_courses(pool: web::Data<PgPool>) -> ApplicationResult<Json<Vec<Course>>> {
    let courses = crate::models::courses::all_courses(pool.get_ref()).await?;
    Ok(Json(courses))
}

/**
POST `/api/v0/cms/courses` - Create a new course.
# Example

Request:
```http
POST /api/v0/cms/courses HTTP/1.1
Content-Type: application/json

{
    "name": "Introduction to introduction",
    "slug": "introduction-to-introduction",
    "organization_id": "1b89e57e-8b57-42f2-9fed-c7a6736e3eec"
}
```

Response:
```json
{
    "id": "ab4541d8-6db4-4561-bdb2-45f35b2544a1",
    "slug": "introduction-to-introduction",
    "created_at": "2021-04-21T18:34:21.795388",
    "updated_at": "2021-04-21T18:34:21.795388",
    "name": "Introduction to introduction",
    "organization_id": "1b89e57e-8b57-42f2-9fed-c7a6736e3eec",
    "deleted": false
}
```
*/
async fn post_new_course(
    pool: web::Data<PgPool>,
    payload: web::Json<NewCourse>,
) -> ApplicationResult<Json<Course>> {
    let new_course = payload.0;
    let course = crate::models::courses::insert_course(&pool, new_course).await?;
    Ok(Json(course))
}

/**
POST `/api/v0/cms/courses/:course_id` - Update course.
# Example

Request:
```http
PUT /api/v0/cms/courses/ab4541d8-6db4-4561-bdb2-45f35b2544a1 HTTP/1.1
Content-Type: application/json

{
    "name": "Introduction to Introduction"
}

```

Response:
```json
{
    "id": "ab4541d8-6db4-4561-bdb2-45f35b2544a1",
    "slug": "introduction-to-introduction",
    "created_at": "2021-04-21T18:34:21.795388",
    "updated_at": "2021-04-21T18:49:21.398638",
    "name": "Introduction to Introduction",
    "organization_id": "1b89e57e-8b57-42f2-9fed-c7a6736e3eec",
    "deleted": false
}
```
*/
async fn update_course(
    payload: web::Json<CourseUpdate>,
    request_course_id: web::Path<String>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Course>> {
    let course_id = Uuid::from_str(&request_course_id)?;

    let course_update = payload.0;
    let course =
        crate::models::courses::update_course(pool.get_ref(), course_id, course_update).await?;
    Ok(Json(course))
}

/**
DELETE `/api/v0/cms/courses/:course_id` - Delete a course.
# Example

```json
{
    "id": "ab4541d8-6db4-4561-bdb2-45f35b2544a1",
    "slug": "introduction-to-introduction",
    "created_at": "2021-04-21T18:34:21.795388",
    "updated_at": "2021-04-21T18:49:21.398638",
    "name": "Introduction to Introduction",
    "organization_id": "1b89e57e-8b57-42f2-9fed-c7a6736e3eec",
    "deleted": true
}
```
*/
async fn delete_course(
    request_course_id: web::Path<String>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Course>> {
    let course_id = Uuid::from_str(&request_course_id)?;

    let course = crate::models::courses::delete_course(pool.get_ref(), course_id).await?;
    Ok(Json(course))
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
    "deleted": false
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
      "deleted": false
    }
  ],
  "course_parts": [
    {
      "id": "d332f3d9-39a5-4a18-80f4-251727693c37",
      "created_at": "2021-04-28T16:11:47.477850",
      "updated_at": "2021-04-28T16:11:47.477850",
      "name": "The Basics",
      "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
      "deleted": false,
      "part_number": 1
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
    cfg.route("", web::get().to(get_all_courses))
        .route("", web::post().to(post_new_course))
        .route("/{course_id}", web::put().to(update_course))
        .route("/{course_id}", web::delete().to(delete_course))
        .route("/{course_id}/images", web::post().to(upload_image))
        .route(
            "/{course_id}/structure",
            web::get().to(get_course_structure),
        );
}
