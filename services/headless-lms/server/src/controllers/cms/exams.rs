//! Controllers for requests starting with `/api/v0/cms/organizations`.

use crate::controllers::prelude::*;

/**
POST `/api/v0/cms/exams/:exam_id/upload` - Uploads a media (image, audio, file) for the course from Gutenberg page edit.

Put the the contents of the media in a form and add a content type header multipart/form-data.
# Example

Request:
```http
POST /api/v0/cms/pages/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/upload HTTP/1.1
Content-Type: multipart/form-data

BINARY_DATA
```
*/
#[generated_doc(UploadResult)]
#[instrument(skip(payload, request, file_store, app_conf))]
async fn add_media(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    payload: Multipart,
    request: HttpRequest,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<UploadResult>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Edit, user.id, Res::Exam(*exam_id)).await?;

    let media_path = upload_media(
        request.headers(),
        payload,
        StoreKind::Exam(*exam_id),
        file_store.as_ref(),
    )
    .await?;
    let download_url = file_store.get_download_url(media_path.as_path(), app_conf.as_ref());

    Ok(web::Json(UploadResult { url: download_url }))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{exam_id}/upload", web::post().to(add_media));
}
