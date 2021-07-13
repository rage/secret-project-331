//! Controllers for requests starting with `/api/v0/cms/courses`.

use crate::controllers::helpers::media::upload_media_for_course;
use crate::domain::authorization::AuthUser;
use crate::utils::file_store::FileStore;
use crate::{controllers::ApplicationResult, models::courses::CourseStructure};
use actix_multipart as mp;
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use actix_web::HttpRequest;
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
#[instrument(skip(pool, file_store))]
async fn get_course_structure<T: FileStore>(
    request_course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<T>,
) -> ApplicationResult<Json<CourseStructure>> {
    let mut conn = pool.acquire().await?;
    let course_structure = crate::models::courses::get_course_structure(
        &mut conn,
        *request_course_id,
        file_store.as_ref(),
    )
    .await?;
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
async fn add_media_for_course<T: FileStore>(
    request_course_id: web::Path<Uuid>,
    payload: mp::Multipart,
    request: HttpRequest,
    pool: web::Data<PgPool>,
    file_store: web::Data<T>,
) -> ApplicationResult<Json<UploadResult>> {
    let mut conn = pool.acquire().await?;
    let course = crate::models::courses::get_course(&mut conn, *request_course_id).await?;

    let media_path =
        upload_media_for_course(request.headers(), payload, &course, file_store.as_ref()).await?;
    let download_url = file_store.get_download_url(&media_path.as_path()).await?;

    Ok(Json(UploadResult { url: download_url }))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_courses_routes<T: 'static + FileStore>(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{course_id}/structure",
        web::get().to(get_course_structure::<T>),
    )
    .route(
        "/{course_id}/upload",
        web::post().to(add_media_for_course::<T>),
    );
}
