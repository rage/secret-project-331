//! Controllers for requests starting with `/api/v0/cms/organizations`.

use models::exams::{ExamInstructions, ExamInstructionsUpdate};

use crate::prelude::*;

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
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Exam(*exam_id)).await?;
    let media_path = upload_file_from_cms(
        request.headers(),
        payload,
        StoreKind::Exam(*exam_id),
        file_store.as_ref(),
        &mut conn,
        user,
    )
    .await?;
    let download_url = file_store.get_download_url(media_path.as_path(), app_conf.as_ref());

    token.authorized_ok(web::Json(UploadResult { url: download_url }))
}

/**
GET `/api/v0/cms/exams/:exam_id/edit` - Get the exam instructions for Gutenberg Editor.
*/

#[instrument(skip(pool))]
async fn get_exam_instructions(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<ExamInstructions>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Exam(*exam_id)).await?;
    let exam_instructions_data =
        models::exams::get_exam_instructions_data(&mut conn, *exam_id).await?;

    token.authorized_ok(web::Json(exam_instructions_data))
}

/**
PUT `/api/v0/cms/exams/:exam_id/edit` - Insert new instructions from Gutenberg editor.

# Example

Request:
```http
PUT /api/v0/cms/exams/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/edit HTTP/1.1
```
*/

#[instrument(skip(pool, payload))]
async fn update_exam_instructions(
    payload: web::Json<ExamInstructionsUpdate>,
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<ExamInstructions>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Exam(*exam_id)).await?;
    let instructions_update = payload.0;
    let saved_instructions =
        models::exams::update_exam_instructions(&mut conn, *exam_id, instructions_update).await?;

    token.authorized_ok(web::Json(saved_instructions))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{exam_id}/upload", web::post().to(add_media))
        .route("/{exam_id}/edit", web::get().to(get_exam_instructions))
        .route("/{exam_id}/edit", web::put().to(update_exam_instructions));
}
