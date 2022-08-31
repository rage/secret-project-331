//! Controllers for requests starting with `/api/v0/cms/organizations`.

use models::peer_review_configs::{self, CmsPeerReviewConfiguration};

use crate::controllers::prelude::*;

/**
POST `/api/v0/cms/courses/:course_id/upload` - Uploads a media (image, audio, file) for the course from Gutenberg page edit.

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
    course_id: web::Path<Uuid>,
    payload: Multipart,
    request: HttpRequest,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<UploadResult>> {
    let mut conn = pool.acquire().await?;
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(course.id)).await?;

    let media_path = upload_media(
        request.headers(),
        payload,
        StoreKind::Course(course.id),
        file_store.as_ref(),
        pool,
        user,
    )
    .await?;
    let download_url = file_store.get_download_url(media_path.data.as_path(), app_conf.as_ref());

    token.authorized_ok(web::Json(UploadResult { url: download_url }))
}

#[generated_doc]
#[instrument(skip(pool))]
async fn get_course_default_peer_review_configuration(
    course_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<CmsPeerReviewConfiguration>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::View, Some(user.id), Res::Course(*course_id)).await?;

    let peer_review_config =
        models::peer_review_configs::get_course_default_cms_peer_review(&mut conn, *course_id)
            .await?;

    let peer_review_questions =
        models::peer_review_questions::get_course_default_cms_peer_review_questions(
            &mut conn,
            peer_review_config.id,
        )
        .await?;

    token.authorized_ok(web::Json(CmsPeerReviewConfiguration {
        peer_review_config,
        peer_review_questions,
    }))
}

#[generated_doc]
#[instrument(skip(pool))]
async fn put_course_default_peer_review_configuration(
    course_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<CmsPeerReviewConfiguration>,
) -> ControllerResult<web::Json<CmsPeerReviewConfiguration>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::View, Some(user.id), Res::Course(*course_id)).await?;

    let cms_peer_review_configuration =
        peer_review_configs::upsert_course_default_cms_peer_review_and_questions(
            &mut conn, &payload.0,
        )
        .await?;
    token.authorized_ok(web::Json(cms_peer_review_configuration))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_id}/upload", web::post().to(add_media))
        .route(
            "/{course_id}/default-peer-review",
            web::get().to(get_course_default_peer_review_configuration),
        )
        .route(
            "/{course_id}/default-peer-review",
            web::put().to(put_course_default_peer_review_configuration),
        );
}
