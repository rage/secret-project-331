//! Controllers for requests starting with `/api/v0/cms/courses`.

use crate::prelude::*;

use models::{
    course_instances::CourseInstance,
    pages::{Page, PageVisibility},
    peer_review_configs::{self, CmsPeerReviewConfiguration},
    peer_review_questions::normalize_cms_peer_review_questions,
};

use crate::prelude::models::course_modules::CourseModule;
use models::research_forms::{
    NewResearchForm, NewResearchFormQuestion, ResearchForm, ResearchFormQuestion,
};

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

    let media_path = upload_file_from_cms(
        request.headers(),
        payload,
        StoreKind::Course(course.id),
        file_store.as_ref(),
        &mut conn,
        user,
    )
    .await?;
    let download_url = file_store.get_download_url(media_path.as_path(), app_conf.as_ref());

    token.authorized_ok(web::Json(UploadResult { url: download_url }))
}

#[instrument(skip(pool))]
async fn get_course_default_peer_review_configuration(
    course_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<CmsPeerReviewConfiguration>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

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

#[instrument(skip(pool))]
async fn put_course_default_peer_review_configuration(
    course_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<CmsPeerReviewConfiguration>,
) -> ControllerResult<web::Json<CmsPeerReviewConfiguration>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let mut config = payload.0;
    normalize_cms_peer_review_questions(&mut config.peer_review_questions);
    let cms_peer_review_configuration =
        peer_review_configs::upsert_course_default_cms_peer_review_and_questions(
            &mut conn, &config,
        )
        .await?;
    token.authorized_ok(web::Json(cms_peer_review_configuration))
}

/**
GET `/api/v0/cms/courses/:course_id/pages` - Gets all pages for a course.
*/
#[instrument(skip(pool))]
async fn get_all_pages(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<Page>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;

    let res = models::pages::get_all_by_course_id_and_visibility(
        &mut conn,
        *course_id,
        PageVisibility::Any,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
PUT `/api/v0/cms/courses/:course_id/research-consent-form` - Upserts courses research form from Gutenberg research form edit.
*/

#[instrument(skip(pool, payload))]
async fn upsert_course_research_form(
    payload: web::Json<NewResearchForm>,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<ResearchForm>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?;
    let new_research_form = payload;
    let res = models::research_forms::upsert_research_form(
        &mut conn,
        PKeyPolicy::Generate,
        &new_research_form,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/cms/courses/:course_id/research-consent-form` - Fetches courses research form with course id.
*/
#[instrument(skip(pool))]
async fn get_research_form_with_course_id(
    course_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Option<ResearchForm>>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?;
    let res = models::research_forms::get_research_form_with_course_id(&mut conn, *course_id)
        .await
        .optional()?;

    token.authorized_ok(web::Json(res))
}

/**
PUT `/api/v0/cms/courses/:course_id/research-consent-form-question` - Upserts questions for the courses research form from Gutenberg research form edit.
*/

#[instrument(skip(pool, payload))]
async fn upsert_course_research_form_question(
    payload: web::Json<NewResearchFormQuestion>,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<ResearchFormQuestion>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?;
    let question = payload;
    let res = models::research_forms::upsert_research_form_questions(&mut conn, &question).await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/cms/courses/:course_id/modules`
Returns modules in the course.
*/
#[instrument(skip(pool))]
async fn get_course_modules(
    course_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<CourseModule>>> {
    let mut conn = pool.acquire().await?;
    let course_modules = models::course_modules::get_by_course_id(&mut conn, *course_id).await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;
    token.authorized_ok(web::Json(course_modules))
}

/**
GET `/api/v0/cms/courses/:course_id/course-instances` - Returns all course instances for given course id.
*/
#[instrument(skip(pool))]
async fn get_course_instances(
    course_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<CourseInstance>>> {
    let mut conn = pool.acquire().await?;
    let instances =
        models::course_instances::get_course_instances_for_course(&mut conn, *course_id).await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;
    token.authorized_ok(web::Json(instances))
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
        )
        .route("/{course_id}/pages", web::get().to(get_all_pages))
        .route(
            "/{courseId}/research-consent-form-question",
            web::put().to(upsert_course_research_form_question),
        )
        .route(
            "/{course_id}/research-consent-form",
            web::get().to(get_research_form_with_course_id),
        )
        .route(
            "/{course_id}/research-consent-form",
            web::put().to(upsert_course_research_form),
        )
        .route("/{course_id}/modules", web::get().to(get_course_modules))
        .route(
            "/{course_id}/course-instances",
            web::get().to(get_course_instances),
        );
}
