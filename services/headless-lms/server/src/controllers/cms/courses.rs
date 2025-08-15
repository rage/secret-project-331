//! Controllers for requests starting with `/api/v0/cms/courses`.

use crate::prelude::*;

use headless_lms_models::chatbot_configurations::ChatbotConfiguration;
use models::{
    course_instances::CourseInstance,
    pages::{Page, PageVisibility},
    partner_block::PartnersBlock,
    peer_or_self_review_configs::{self, CmsPeerOrSelfReviewConfiguration},
    peer_or_self_review_questions::normalize_cms_peer_or_self_review_questions,
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
async fn get_course_default_peer_or_self_review_configuration(
    course_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<CmsPeerOrSelfReviewConfiguration>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let peer_or_self_review_config =
        models::peer_or_self_review_configs::get_course_default_cms_peer_review(
            &mut conn, *course_id,
        )
        .await?;

    let peer_or_self_review_questions =
        models::peer_or_self_review_questions::get_course_default_cms_peer_or_self_review_questions(
            &mut conn,
            peer_or_self_review_config.id,
        )
        .await?;

    token.authorized_ok(web::Json(CmsPeerOrSelfReviewConfiguration {
        peer_or_self_review_config,
        peer_or_self_review_questions,
    }))
}

#[instrument(skip(pool))]
async fn put_course_default_peer_or_self_review_configuration(
    course_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
    payload: web::Json<CmsPeerOrSelfReviewConfiguration>,
) -> ControllerResult<web::Json<CmsPeerOrSelfReviewConfiguration>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let mut config = payload.0;
    normalize_cms_peer_or_self_review_questions(&mut config.peer_or_self_review_questions);
    let cms_peer_or_self_review_configuration =
        peer_or_self_review_configs::upsert_course_default_cms_peer_review_and_questions(
            &mut conn, &config,
        )
        .await?;
    token.authorized_ok(web::Json(cms_peer_or_self_review_configuration))
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
PUT `/api/v0/cms/courses/:course_id/research-consent-form-questions` - Upserts questions for the courses research form from Gutenberg research form edit.
*/

#[instrument(skip(pool, payload))]
async fn upsert_course_research_form_questions(
    payload: web::Json<Vec<NewResearchFormQuestion>>,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ResearchFormQuestion>>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?;

    let res = models::research_forms::upsert_research_form_questions(&mut conn, &payload).await?;

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
 POST /api/v0/main-frontend/courses/:course_id/partners_block - Create or updates a partners block for a course
*/
#[instrument(skip(payload, pool))]
async fn post_partners_block(
    path: web::Path<Uuid>,
    payload: web::Json<Option<serde_json::Value>>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let course_id = path.into_inner();

    let content = payload.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?;

    models::partner_block::upsert_partner_block(&mut conn, course_id, content).await?;

    token.authorized_ok(web::Json(()))
}

/**
GET /courses/:course_id/partners_blocks - Gets a partners block related to a course
*/
#[instrument(skip(pool))]
async fn get_partners_block(
    path: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<PartnersBlock>> {
    let course_id = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    // Check if the course exists in the partners_blocks table
    let course_exists = models::partner_block::check_if_course_exists(&mut conn, course_id).await?;

    let partner_block = if course_exists {
        // If the course exists, fetch the partner block
        models::partner_block::get_partner_block(&mut conn, course_id).await?
    } else {
        // If the course does not exist, create a new partner block with an empty content array
        let empty_content: Option<serde_json::Value> = Some(serde_json::Value::Array(vec![]));

        // Upsert the partner block with the empty content
        models::partner_block::upsert_partner_block(&mut conn, course_id, empty_content).await?
    };

    token.authorized_ok(web::Json(partner_block))
}

/**
DELETE `/api/v0/main-frontend/courses/:course_id` - Delete a partners block in a course.
*/
#[instrument(skip(pool))]
async fn delete_partners_block(
    path: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<PartnersBlock>> {
    let course_id = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::UsuallyUnacceptableDeletion,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;
    let deleted_partners_block =
        models::partner_block::delete_partner_block(&mut conn, course_id).await?;

    token.authorized_ok(web::Json(deleted_partners_block))
}

/**
GET /api/v0/cms/courses/:course_id/nondefault-chatbot-configurations - Get all chatbot configurations of this course.
*/
#[instrument(skip(pool))]
async fn get_course_nondefault_chatbot_configurations(
    path: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ChatbotConfiguration>>> {
    let course_id = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::UsuallyUnacceptableDeletion,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;
    let course_chatbot_configurations =
        models::chatbot_configurations::get_nondefault_for_course(&mut conn, course_id).await?;
    token.authorized_ok(web::Json(course_chatbot_configurations))
}

/**
GET /api/v0/cms/courses/:course_id/can-add-chatbot - Get the boolean to answer if chatbots are enabled on this course.
*/
#[instrument(skip(pool))]
async fn get_course_can_add_chatbot(
    path: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let course_id = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?;
    let course = models::courses::get_course(&mut conn, course_id).await?;
    let course_can_add = course.can_add_chatbot;
    token.authorized_ok(web::Json(course_can_add))
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
            web::get().to(get_course_default_peer_or_self_review_configuration),
        )
        .route(
            "/{course_id}/default-peer-review",
            web::put().to(put_course_default_peer_or_self_review_configuration),
        )
        .route("/{course_id}/pages", web::get().to(get_all_pages))
        .route(
            "/{courseId}/research-consent-form-questions",
            web::put().to(upsert_course_research_form_questions),
        )
        .route(
            "/{course_id}/research-consent-form",
            web::get().to(get_research_form_with_course_id),
        )
        .route(
            "/{course_id}/research-consent-form",
            web::put().to(upsert_course_research_form),
        )
        .route(
            "/{course_id}/partners-block",
            web::post().to(post_partners_block),
        )
        .route(
            "/{course_id}/partners-block",
            web::get().to(get_partners_block),
        )
        .route(
            "/{course_id}/partners-block",
            web::delete().to(delete_partners_block),
        )
        .route("/{course_id}/modules", web::get().to(get_course_modules))
        .route(
            "/{course_id}/course-instances",
            web::get().to(get_course_instances),
        )
        .route(
            "/{course_id}/nondefault-chatbot-configurations",
            web::get().to(get_course_nondefault_chatbot_configurations),
        )
        .route(
            "/{course_id}/can-add-chatbot",
            web::get().to(get_course_can_add_chatbot),
        );
}
