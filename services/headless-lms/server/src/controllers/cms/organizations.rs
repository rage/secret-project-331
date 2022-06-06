//! Controllers for requests starting with `/api/v0/cms/organizations`.

use crate::controllers::prelude::*;

/**
POST `/api/v0/cms/organizations/:organization_id/upload` - Uploads a media (image, audio, file) for the course from Gutenberg page edit.

Put the the contents of the media in a form and add a content type header multipart/form-data.
# Example

Request:
```http
POST /api/v0/cms/pages/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/upload HTTP/1.1
Content-Type: multipart/form-data

BINARY_DATA
```
*/
#[generated_doc]
#[instrument(skip(payload, request, pool, file_store, app_conf))]
async fn add_media(
    organization_id: web::Path<Uuid>,
    payload: Multipart,
    request: HttpRequest,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<UploadResult>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Organization(*organization_id),
    )
    .await?;
    let organization = models::organizations::get_organization(&mut conn, *organization_id).await?;

    let media_path = upload_media(
        request.headers(),
        payload,
        StoreKind::Organization(organization.id),
        file_store.as_ref(),
        pool,
        user,
    )
    .await?;
    let download_url = file_store.get_download_url(media_path.data.as_path(), app_conf.as_ref());
    token.authorized_ok(web::Json(UploadResult { url: download_url }))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{organization_id}/upload", web::post().to(add_media));
}
