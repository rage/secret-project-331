//! Controllers for requests starting with `/api/v0/cms/chapters`.
use std::{path::PathBuf, str::FromStr};

use crate::{
    controllers::{helpers::media::upload_media_for_course, ApplicationError, ApplicationResult},
    domain::authorization::AuthUser,
    models::chapters::{Chapter, ChapterUpdate, ChapterWithImageUrl, NewChapter},
    utils::file_store::FileStore,
    ApplicationConfiguration,
};
use actix_multipart as mp;
use actix_web::web::{self, Json};
use actix_web::{web::ServiceConfig, HttpRequest};
use sqlx::PgPool;
use uuid::Uuid;

/**
POST `/api/v0/cms/chapters` - Create a new course part.
# Example

Request:
```http
POST /api/v0/cms/chapters HTTP/1.1
Content-Type: application/json

{
    "name": "The Basics",
    "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
    "chapter_number": 1,
    "front_page_id": null
}
```

Response:
```json
{
  "id": "037ec5fa-87e0-4031-be65-3790fee92954",
  "created_at": "2021-04-28T16:33:42.670935",
  "updated_at": "2021-04-28T16:33:42.670935",
  "name": "The Basics",
  "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
  "deleted_at": null,
  "chapter_number": 1,
  "front_page_id": null
}
```
*/
#[instrument(skip(pool))]
async fn post_new_chapter(
    pool: web::Data<PgPool>,
    payload: web::Json<NewChapter>,
    user: AuthUser,
) -> ApplicationResult<Json<Chapter>> {
    let mut conn = pool.acquire().await?;
    let new_chapter = payload.0;
    let chapter = crate::models::chapters::insert_chapter(&mut conn, new_chapter).await?;
    Ok(Json(chapter))
}

/**
DELETE `/api/v0/cms/courses-parts/:chapter_id` - Delete a course part.
# Example

```json
{
  "id": "037ec5fa-87e0-4031-be65-3790fee92954",
  "created_at": "2021-04-28T16:33:42.670935",
  "updated_at": "2021-04-28T16:33:42.670935",
  "name": "The Basics",
  "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
  "deleted_at": "2021-04-28T16:33:42.670935",
  "chapter_number": 1,
  "front_page_id": "0ebba931-b027-4154-8274-2afb00d79306"
}
```
*/
#[instrument(skip(pool))]
async fn delete_chapter(
    request_chapter_id: web::Path<String>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ApplicationResult<Json<Chapter>> {
    let mut conn = pool.acquire().await?;
    let course_id = Uuid::from_str(&request_chapter_id)?;

    let chapter = crate::models::chapters::delete_chapter(&mut conn, course_id).await?;
    Ok(Json(chapter))
}

/**
PUT `/api/v0/cms/chapters/:chapter_id` - Update course part.
# Example

Request:
```http
PUT /api/v0/cms/chapters/d332f3d9-39a5-4a18-80f4-251727693c37  HTTP/1.1
Content-Type: application/json

{
    "name": "The Basics",
    "chapter_image_url": null,
    "chapter_number": 2,
    "front_page_id": "0ebba931-b027-4154-8274-2afb00d79306"
}

```

Response:
```json
{
  "id": "d332f3d9-39a5-4a18-80f4-251727693c37",
  "created_at": "2021-04-28T16:11:47.477850",
  "updated_at": "2021-04-28T16:53:14.896121",
  "name": "The Basics",
  "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
  "deleted_at": null,
  "chapter_image_url": null,
  "chapter_number": 2,
  "front_page_id": "0ebba931-b027-4154-8274-2afb00d79306"
}
```
*/
#[instrument(skip(payload, pool, file_store, app_conf))]
async fn update_chapter<T: FileStore>(
    payload: web::Json<ChapterUpdate>,
    request_chapter_id: web::Path<String>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<T>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ApplicationResult<Json<ChapterWithImageUrl>> {
    let mut conn = pool.acquire().await?;
    let course_id = Uuid::from_str(&request_chapter_id)?;

    let course_update = payload.0;
    let chapter =
        crate::models::chapters::update_chapter(&mut conn, course_id, course_update).await?;

    let response =
        ChapterWithImageUrl::from_chapter(&chapter, file_store.as_ref(), app_conf.as_ref());

    Ok(Json(response))
}

/**
PUT `/api/v0/cms/chapters/:chapter_id/image` - Sets or updates the chapter image.

# Example

Request:
```http
PUT /api/v0/cms/chapters/d332f3d9-39a5-4a18-80f4-251727693c37/image HTTP/1.1
Content-Type: multipart/form-data

BINARY_DATA
```

Response:
```json
{
  "id": "d332f3d9-39a5-4a18-80f4-251727693c37",
  "created_at": "2021-04-28T16:11:47.477850",
  "updated_at": "2021-04-28T16:53:14.896121",
  "name": "The Basics",
  "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
  "deleted_at": null,
  "chapter_image_url": "http://project-331.local/api/v0/files/organizations/1b89e57e-8b57-42f2-9fed-c7a6736e3eec/courses/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/images/iHZMHdvsazy43ZtP0Ea01sy8AOpUiZ.png",
  "chapter_number": 2,
  "front_page_id": "0ebba931-b027-4154-8274-2afb00d79306"
}
```
*/
#[instrument(skip(request, payload, pool, file_store, app_conf))]
async fn set_chapter_image<T: FileStore>(
    request: HttpRequest,
    payload: mp::Multipart,
    request_chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<T>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ApplicationResult<Json<ChapterWithImageUrl>> {
    let mut conn = pool.acquire().await?;
    let chapter = crate::models::chapters::get_chapter(&mut conn, *request_chapter_id).await?;
    let course = crate::models::courses::get_course(&mut conn, chapter.course_id).await?;

    let chapter_image =
        upload_media_for_course(request.headers(), payload, &course, file_store.as_ref())
            .await?
            .to_string_lossy()
            .to_string();
    let updated_chapter =
        crate::models::chapters::update_chapter_image(&mut conn, chapter.id, Some(chapter_image))
            .await?;

    // Remove old image if one exists.
    if let Some(old_image) = chapter.chapter_image {
        let file = PathBuf::from_str(&old_image).map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
        file_store.delete(&file).await.map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
    }

    let response =
        ChapterWithImageUrl::from_chapter(&updated_chapter, file_store.as_ref(), app_conf.as_ref());

    Ok(Json(response))
}

/**
REMOVE `/api/v0/cms/chapters/:chapter_id/image` - Removes the chapter image.

# Example

Request:
```http
DELETE /api/v0/cms/chapters/d332f3d9-39a5-4a18-80f4-251727693c37/image HTTP/1.1
```
*/
#[instrument(skip(pool, file_store))]
async fn remove_chapter_image<T: FileStore>(
    request_chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<T>,
) -> ApplicationResult<Json<()>> {
    let mut conn = pool.acquire().await?;
    let chapter = crate::models::chapters::get_chapter(&mut conn, *request_chapter_id).await?;
    if let Some(chapter_image) = chapter.chapter_image {
        let file = PathBuf::from_str(&chapter_image).map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
        let _res =
            crate::models::chapters::update_chapter_image(&mut conn, chapter.id, None).await?;
        file_store.delete(&file).await.map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
    }
    Ok(Json(()))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_chapters_routes<T: 'static + FileStore>(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(post_new_chapter))
        .route("/{chapter_id}", web::delete().to(delete_chapter))
        .route("/{chapter_id}", web::put().to(update_chapter::<T>))
        .route("/{chapter_id}/image", web::put().to(set_chapter_image::<T>))
        .route(
            "/{chapter_id}/image",
            web::delete().to(remove_chapter_image::<T>),
        );
}
