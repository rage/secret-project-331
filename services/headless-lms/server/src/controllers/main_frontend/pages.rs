//! Controllers for requests starting with `/api/v0/main-frontend/pages`.

use std::{path::PathBuf, str::FromStr, sync::Arc};

use futures::StreamExt;
use models::{
    page_history::PageHistory,
    pages::{HistoryRestoreData, NewPage, Page, PageAudioFiles, PageInfo},
};

use crate::{
    domain::{
        models_requests::{self, JwtKey},
        request_id::RequestId,
    },
    prelude::*,
};

/**
POST `/api/v0/main-frontend/pages` - Create a new page.

Please note that this endpoint will change all the exercise and exercise task ids you've created. Make sure the use the updated ids from the response object.

If optional property front_page_of_chapter_id is set, this page will become the front page of the specified course part.

# Example:

Request:
```http
POST /api/v0/main-frontend/pages HTTP/1.1
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
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn post_new_page(
    request_id: RequestId,
    payload: web::Json<NewPage>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    jwt_key: web::Data<JwtKey>,
) -> ControllerResult<web::Json<Page>> {
    let mut conn = pool.acquire().await?;
    let new_page = payload.0;
    let course_id = new_page.course_id.ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::BadRequest,
            "Cannot create a new page without a course id".to_string(),
            None,
        )
    })?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(course_id)).await?;

    let page = models::pages::insert_new_content_page(
        &mut conn,
        new_page,
        user.id,
        models_requests::make_spec_fetcher(request_id.0, Arc::clone(&jwt_key)),
        models_requests::fetch_service_info,
    )
    .await?;
    token.authorized_ok(web::Json(page))
}

/**
DELETE `/api/v0/main-frontend/pages/:page_id` - Delete a page, related exercises, and related exercise tasks by id.


# Example

Request: `DELETE /api/v0/main-frontend/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02`
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn delete_page(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Page>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;
    let deleted_page = models::pages::delete_page_and_exercises(&mut conn, *page_id).await?;

    token.authorized_ok(web::Json(deleted_page))
}

/**
GET /api/v0/main-frontend/pages/:page_id/history
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn history(
    pool: web::Data<PgPool>,
    page_id: web::Path<Uuid>,
    pagination: web::Query<Pagination>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<PageHistory>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Page(*page_id)).await?;

    let res = models::page_history::history(&mut conn, *page_id, *pagination).await?;

    token.authorized_ok(web::Json(res))
}

/**
GET /api/v0/main-frontend/pages/:page_id/history_count
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn history_count(
    pool: web::Data<PgPool>,
    page_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<i64>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Page(*page_id)).await?;
    let res = models::page_history::history_count(&mut conn, *page_id).await?;

    token.authorized_ok(web::Json(res))
}

/**
POST /api/v0/main-frontend/pages/:page_id/restore
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn restore(
    request_id: RequestId,
    pool: web::Data<PgPool>,
    page_id: web::Path<Uuid>,
    restore_data: web::Json<HistoryRestoreData>,
    user: AuthUser,
    jwt_key: web::Data<JwtKey>,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;
    let res = models::pages::restore(
        &mut conn,
        *page_id,
        restore_data.history_id,
        user.id,
        models_requests::make_spec_fetcher(request_id.0, Arc::clone(&jwt_key)),
        models_requests::fetch_service_info,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-fronted/pages/:page_id/info` - Get a pages's course id, course name, organization slug

Request: `GET /api/v0/cms/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02/info`
*/
#[generated_doc]
async fn get_page_info(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<PageInfo>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;

    let page_info = models::pages::get_page_info(&mut conn, *page_id).await?;

    token.authorized_ok(web::Json(page_info))
}

/**
PUT `/api/v0/main-frontend/pages/:page_id/audio` - Sets or updates the page audio.

# Example

Request:
```http
PUT /api/v0/main-frontend/pages/d332f3d9-39a5-4a18-80f4-251727693c37/audio HTTP/1.1
Content-Type: multipart/form-data

BINARY_DATA
```
*/
#[generated_doc]
#[instrument(skip(request, payload, pool, file_store, app_conf))]
async fn set_page_audio(
    request: HttpRequest,
    mut payload: Multipart,
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let page = models::pages::get_page(&mut conn, *page_id).await?;
    if let Some(course_id) = page.course_id {
        let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(course_id)).await?;

        let next_payload = payload.next().await.ok_or_else(|| {
            ControllerError::new(
                ControllerErrorType::BadRequest,
                "Didn't upload any files".into(),
                None,
            )
        })?;

        let mime_type = match next_payload {
            Ok(field) => {
                let mime_type = field
                    .content_type()
                    .map(|ct| ct.to_string())
                    .unwrap_or("".to_string());
                match mime_type.as_str() {
                    "audio/mpeg" | "audio/ogg" => mime_type,
                    unsupported => {
                        return Err(ControllerError::new(
                            ControllerErrorType::BadRequest,
                            format!("Unsupported audio Mime type: {}", unsupported),
                            None,
                        ))
                    }
                }
            }
            Err(err) => {
                return Err(ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    err.to_string(),
                    None,
                ))
            }
        };

        // ----------------------------------------------------------------------------------

        let course = models::courses::get_course(&mut conn, page.id).await?;
        let media_path = upload_file_from_cms(
            request.headers(),
            payload,
            StoreKind::Course(course.id),
            file_store.as_ref(),
            pool,
            user,
        )
        .await?;

        let download_url =
            file_store.get_download_url(media_path.data.as_path(), app_conf.as_ref());
        models::pages::insert_page_audio(&mut conn, page.id, &download_url, &mime_type).await?;

        token.authorized_ok(web::Json(true))
    } else {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            format!("The page needs to be related to a course."),
            None,
        ));
    }
}

/**
DELETE `/api/v0/main-frontend/pages/:page_id/audio` - Removes the chapter image.

# Example

Request:
```http
DELETE /api/v0/main-frontend/pages/d332f3d9-39a5-4a18-80f4-251727693c37/audio HTTP/1.1
```
*/

#[generated_doc]
#[instrument(skip(pool, file_store))]
async fn remove_page_audio(
    page_audio_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let audio = models::pages::get_page_audio_files_by_id(&mut conn, *page_audio_id).await?;
    let page = models::pages::get_page(&mut conn, audio.page_id).await?;
    if let Some(course_id) = page.course_id {
        let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(course_id)).await?;

        // update the delete function to return PATH
        // let file = PathBuf::from_str(&audio.path).map_err(|original_error| {
        //     ControllerError::new(
        //         ControllerErrorType::InternalServerError,
        //         original_error.to_string(),
        //         Some(original_error.into()),
        //     )
        // })?;

        let deleted_audio_path = models::pages::delete_page_audio(&mut conn, page.id).await?;
        file_store
            .delete(&deleted_audio_path)
            .await
            .map_err(|original_error| {
                ControllerError::new(
                    ControllerErrorType::BadRequest,
                    format!("Could not delete the file from file store"),
                    None,
                )
            })?;
        token.authorized_ok(web::Json(()))
    } else {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            format!("The page needs to be related to a course."),
            None,
        ));
    }
}

/**
GET `/api/v0/main-fronted/pages/:page_id/audio_files` - Get a pages audio files

Request: `GET /api/v0/cms/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02/audio_files`
*/
#[generated_doc]
async fn get_page_audio(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<PageAudioFiles>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;

    let page_audio_file = models::pages::get_page_audio_files(&mut conn, *page_id).await?;

    token.authorized_ok(web::Json(page_audio_file))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(post_new_page))
        .route("/{page_id}", web::delete().to(delete_page))
        .route("/{page_id}/info", web::get().to(get_page_info))
        .route("/{page_id}/history", web::get().to(history))
        .route("/{page_id}/history_count", web::get().to(history_count))
        .route("/{page_id}/audio", web::put().to(set_page_audio))
        .route("/{page_id}/audio", web::delete().to(remove_page_audio))
        .route("/{page_id}/audio_files", web::get().to(get_page_audio))
        .route("/{history_id}/restore", web::post().to(restore));
}
