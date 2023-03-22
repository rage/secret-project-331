//! Controllers for requests starting with `/api/v0/main-frontend/chapters`.

use std::{path::PathBuf, str::FromStr, sync::Arc};

use models::chapters::{Chapter, ChapterUpdate, NewChapter};

use crate::{
    domain::{
        models_requests::{self, JwtKey},
        request_id::RequestId,
    },
    prelude::*,
};

/**
POST `/api/v0/main-frontend/chapters` - Create a new course part.
# Example

Request:
```http
POST /api/v0/main-frontend/chapters HTTP/1.1
Content-Type: application/json

{
    "name": "The Basics",
    "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
    "chapter_number": 1,
    "front_page_id": null
}
```
*/
#[generated_doc]
#[instrument(skip(pool, file_store, app_conf))]
async fn post_new_chapter(
    request_id: RequestId,
    pool: web::Data<PgPool>,
    payload: web::Json<NewChapter>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
    jwt_key: web::Data<JwtKey>,
) -> ControllerResult<web::Json<Chapter>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(payload.course_id),
    )
    .await?;
    let new_chapter = payload.0;
    let (database_chapter, ..) = models::library::content_management::create_new_chapter(
        &mut conn,
        PKeyPolicy::Generate,
        &new_chapter,
        user.id,
        models_requests::make_spec_fetcher(request_id.0, Arc::clone(&jwt_key)),
        models_requests::fetch_service_info,
    )
    .await?;
    return token.authorized_ok(web::Json(Chapter::from_database_chapter(
        &database_chapter,
        file_store.as_ref(),
        app_conf.as_ref(),
    )));
}

/**
DELETE `/api/v0/main-frontend/chapters/:chapter_id` - Delete a chapter.
*/
#[generated_doc]
#[instrument(skip(pool, file_store, app_conf))]
async fn delete_chapter(
    chapter_id: web::Path<String>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Chapter>> {
    let mut conn = pool.acquire().await?;
    let chapter_id = Uuid::from_str(&chapter_id)?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Chapter(chapter_id),
    )
    .await?;
    let deleted_chapter = models::chapters::delete_chapter(&mut conn, chapter_id).await?;
    return token.authorized_ok(web::Json(Chapter::from_database_chapter(
        &deleted_chapter,
        file_store.as_ref(),
        app_conf.as_ref(),
    )));
}

/**
PUT `/api/v0/main-frontend/chapters/:chapter_id` - Update chapter.
# Example

Request:
```http
PUT /api/v0/main-frontend/chapters/d332f3d9-39a5-4a18-80f4-251727693c37  HTTP/1.1
Content-Type: application/json

{
    "name": "The Basics",
    "chapter_image_url": null,
    "chapter_number": 2,
    "front_page_id": "0ebba931-b027-4154-8274-2afb00d79306"
}

```
*/
#[generated_doc]
#[instrument(skip(payload, pool, file_store, app_conf))]
async fn update_chapter(
    payload: web::Json<ChapterUpdate>,
    chapter_id: web::Path<String>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Chapter>> {
    let mut conn = pool.acquire().await?;
    let chapter_id = Uuid::from_str(&chapter_id)?;
    let course_id = models::chapters::get_course_id(&mut conn, chapter_id).await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(course_id)).await?;
    let course_update = payload.0;
    let chapter = models::chapters::update_chapter(&mut conn, chapter_id, course_update).await?;

    let response = Chapter::from_database_chapter(&chapter, file_store.as_ref(), app_conf.as_ref());

    token.authorized_ok(web::Json(response))
}

/**
PUT `/api/v0/main-frontend/chapters/:chapter_id/image` - Sets or updates the chapter image.

# Example

Request:
```http
PUT /api/v0/main-frontend/chapters/d332f3d9-39a5-4a18-80f4-251727693c37/image HTTP/1.1
Content-Type: multipart/form-data

BINARY_DATA
```
*/
#[generated_doc]
#[instrument(skip(request, payload, pool, file_store, app_conf))]
async fn set_chapter_image(
    request: HttpRequest,
    payload: Multipart,
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Chapter>> {
    let mut conn = pool.acquire().await?;
    let chapter = models::chapters::get_chapter(&mut conn, *chapter_id).await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(chapter.course_id),
    )
    .await?;

    let course = models::courses::get_course(&mut conn, chapter.course_id).await?;
    let chapter_image = upload_file_from_cms(
        request.headers(),
        payload,
        StoreKind::Course(course.id),
        file_store.as_ref(),
        pool,
        user,
    )
    .await?
    .data
    .to_string_lossy()
    .to_string();
    let updated_chapter =
        models::chapters::update_chapter_image_path(&mut conn, chapter.id, Some(chapter_image))
            .await?;

    // Remove old image if one exists.
    if let Some(old_image_path) = chapter.chapter_image_path {
        let file = PathBuf::from_str(&old_image_path).map_err(|original_error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                original_error.to_string(),
                Some(original_error.into()),
            )
        })?;
        file_store.delete(&file).await.map_err(|original_error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                original_error.to_string(),
                Some(original_error.into()),
            )
        })?;
    }

    let response =
        Chapter::from_database_chapter(&updated_chapter, file_store.as_ref(), app_conf.as_ref());

    token.authorized_ok(web::Json(response))
}

/**
DELETE `/api/v0/main-frontend/chapters/:chapter_id/image` - Removes the chapter image.

# Example

Request:
```http
DELETE /api/v0/main-frontend/chapters/d332f3d9-39a5-4a18-80f4-251727693c37/image HTTP/1.1
```
*/
#[generated_doc]
#[instrument(skip(pool, file_store))]
async fn remove_chapter_image(
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let chapter = models::chapters::get_chapter(&mut conn, *chapter_id).await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(chapter.course_id),
    )
    .await?;
    if let Some(chapter_image_path) = chapter.chapter_image_path {
        let file = PathBuf::from_str(&chapter_image_path).map_err(|original_error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                original_error.to_string(),
                Some(original_error.into()),
            )
        })?;
        let _res = models::chapters::update_chapter_image_path(&mut conn, chapter.id, None).await?;
        file_store.delete(&file).await.map_err(|original_error| {
            ControllerError::new(
                ControllerErrorType::InternalServerError,
                original_error.to_string(),
                Some(original_error.into()),
            )
        })?;
    }
    token.authorized_ok(web::Json(()))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(post_new_chapter))
        .route("/{chapter_id}", web::delete().to(delete_chapter))
        .route("/{chapter_id}", web::put().to(update_chapter))
        .route("/{chapter_id}/image", web::put().to(set_chapter_image))
        .route(
            "/{chapter_id}/image",
            web::delete().to(remove_chapter_image),
        );
}
