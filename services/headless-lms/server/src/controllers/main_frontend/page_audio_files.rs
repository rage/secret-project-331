//! Controllers for requests starting with `/api/v0/main-frontend/page_audio`.

use std::path::Path;

use futures::StreamExt;
use models::page_audio_files::PageAudioFile;

use crate::prelude::*;

/**
POST `/api/v0/main-frontend/page_audio/:page_id` - Sets or updates the page audio.

# Example

Request:
```http
POST /api/v0/main-frontend/page_audio/d332f3d9-39a5-4a18-80f4-251727693c37 HTTP/1.1
Content-Type: multipart/form-data

BINARY_DATA
```
*/

#[instrument(skip(request, payload, pool, file_store))]
async fn set_page_audio(
    request: HttpRequest,
    mut payload: Multipart,
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let page = models::pages::get_page(&mut conn, *page_id).await?;
    if let Some(course_id) = page.course_id {
        let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(course_id)).await?;

        let field = match payload.next().await {
            Some(Ok(field)) => field,
            Some(Err(error)) => {
                return Err(ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    error.to_string(),
                    None,
                ));
            }
            None => {
                return Err(ControllerError::new(
                    ControllerErrorType::BadRequest,
                    "Didn't upload any files",
                    None,
                ));
            }
        };

        let mime_type = field
            .content_type()
            .map(|ct| ct.to_string())
            .unwrap_or_else(|| "".to_string());

        match mime_type.as_str() {
            "audio/mpeg" | "audio/ogg" => {}
            unsupported => {
                return Err(ControllerError::new(
                    ControllerErrorType::BadRequest,
                    format!("Unsupported audio Mime type: {}", unsupported),
                    None,
                ));
            }
        };

        let course = models::courses::get_course(&mut conn, page.course_id.unwrap()).await?;
        let media_path = upload_field_from_cms(
            request.headers(),
            field,
            StoreKind::Course(course.id),
            file_store.as_ref(),
            &mut conn,
            user,
        )
        .await?;

        models::page_audio_files::insert_page_audio(
            &mut conn,
            page.id,
            &media_path.as_path().to_string_lossy(),
            &mime_type,
        )
        .await?;

        token.authorized_ok(web::Json(true))
    } else {
        Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "The page needs to be related to a course.".to_string(),
            None,
        ))
    }
}

/**
DELETE `/api/v0/main-frontend/page_audio/:file_id` - Removes the chapter image.

# Example

Request:
```http
DELETE /api/v0/main-frontend/page_audio/d332f3d9-39a5-4a18-80f4-251727693c37 HTTP/1.1
```
*/

#[instrument(skip(pool, file_store))]
async fn remove_page_audio(
    page_audio_id: web::Path<Uuid>,
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let audio =
        models::page_audio_files::get_page_audio_files_by_id(&mut conn, *page_audio_id).await?;
    let page = models::pages::get_page(&mut conn, audio.page_id).await?;
    if let Some(course_id) = page.course_id {
        let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(course_id)).await?;

        let path = models::page_audio_files::delete_page_audio(&mut conn, *page_audio_id).await?;
        file_store.delete(Path::new(&path)).await.map_err(|_| {
            ControllerError::new(
                ControllerErrorType::BadRequest,
                "Could not delete the file from the file store".to_string(),
                None,
            )
        })?;
        token.authorized_ok(web::Json(()))
    } else {
        Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "The page needs to be related to a course.".to_string(),
            None,
        ))
    }
}

/**
GET `/api/v0/main-fronted/page_audio/:page_id/files` - Get a page audio files

Request: `GET /api/v0/cms/page_audio/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02/files`
*/
#[instrument(skip(app_conf))]

async fn get_page_audio(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Vec<PageAudioFile>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;

    let mut page_audio_files =
        models::page_audio_files::get_page_audio_files(&mut conn, *page_id).await?;

    let base_url = &app_conf.base_url;
    for audio in page_audio_files.iter_mut() {
        audio.path = format!("{base_url}/api/v0/files/{}", audio.path);
    }

    token.authorized_ok(web::Json(page_audio_files))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{page_id}", web::post().to(set_page_audio))
        .route("/{file_id}", web::delete().to(remove_page_audio))
        .route("/{page_id}/files", web::get().to(get_page_audio));
}
