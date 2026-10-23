//! Controllers for requests starting with `/api/v0/cms/pages`.

use models::{
    CourseOrExamId,
    page_history::HistoryChangeReason,
    pages::{
        CmsPageUpdate, ContentManagementPage, PageInfo, PageNavigationInformation, PageUpdateArgs,
        PageVisibility,
    },
};

use crate::{
    controllers::main_frontend::agent_changesets::{self, PendingAgentChanges},
    domain::{
        models_requests::{self, JwtKey},
        request_id::RequestId,
    },
    prelude::*,
};
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(paths(
    get_page,
    get_page_info,
    update_page,
    get_page_navigation,
    get_exercises_with_submissions,
    get_pending_agent_changes
))]
pub(crate) struct CmsPagesApiDoc;

/**
GET `/api/v0/cms/pages/:page_id` - Get a page with exercises and exercise tasks by id.

Request: `GET /api/v0/cms/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02`
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{page_id}",
    operation_id = "getCmsPage",
    tag = "cms_pages",
    params(
        ("page_id" = Uuid, Path, description = "Page id")
    ),
    responses(
        (status = 200, description = "CMS page with exercises and peer review data", body = ContentManagementPage)
    )
)]
async fn get_page(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ContentManagementPage>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;

    let cms_page = models::pages::get_page_with_exercises(&mut conn, *page_id).await?;
    token.authorized_ok(web::Json(cms_page))
}

/**
GET `/api/v0/cms/pages/:page_id/info` - Get a pages's course id, course name, organization slug

Request: `GET /api/v0/cms/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02/info`
*/
#[utoipa::path(
    get,
    path = "/{page_id}/info",
    operation_id = "getCmsPageInfo",
    tag = "cms_pages",
    params(
        ("page_id" = Uuid, Path, description = "Page id")
    ),
    responses(
        (status = 200, description = "Page info", body = PageInfo)
    )
)]
async fn get_page_info(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<PageInfo>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;

    let cms_page_info = models::pages::get_page_info(&mut conn, *page_id).await?;
    token.authorized_ok(web::Json(cms_page_info))
}

/**
PUT `/api/v0/cms/pages/:page_id` - Update a page by id.

Please note that this endpoint will change all the exercise and exercise task ids you've created. Make sure the use the updated ids from the response object.

If optional property front_page_of_chapter_id is set, this page will become the front page of the specified course part.

# Example: OUTDATED

Request:

```http
PUT /api/v0/cms/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02 HTTP/1.1
Content-Type: application/json

{
  "content": [{"type": "x"}],
  "url_path": "/part-1/hello-world",
  "title": "Hello world!",
  "chapter_id": "2495ffa3-7ea9-4615-baa5-828023688c79"
}
```
*/

#[instrument(skip(pool, app_conf))]
#[utoipa::path(
    put,
    path = "/{page_id}",
    operation_id = "updateCmsPage",
    tag = "cms_pages",
    params(
        ("page_id" = Uuid, Path, description = "Page id")
    ),
    request_body = CmsPageUpdate,
    responses(
        (status = 200, description = "Updated CMS page", body = ContentManagementPage)
    )
)]
async fn update_page(
    request_id: RequestId,
    payload: web::Json<CmsPageUpdate>,
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    jwt_key: web::Data<JwtKey>,
    app_conf: web::Data<ApplicationConfiguration>,
    user: AuthUser,
) -> ControllerResult<web::Json<ContentManagementPage>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;

    let cms_page_update = payload.0;
    domain::authorization::ensure_user_can_add_exercise_tasks(
        &mut conn,
        user.id,
        Some(*page_id),
        &cms_page_update.exercise_tasks,
    )
    .await?;
    let course_or_exam_id = models::pages::get_course_and_exam_id(&mut conn, *page_id).await?;
    let is_exam_page = matches!(course_or_exam_id, CourseOrExamId::Exam(_));
    let (expected_course_id, expected_exam_id) = match course_or_exam_id {
        CourseOrExamId::Course(course_id) => (Some(course_id), None),
        CourseOrExamId::Exam(exam_id) => (None, Some(exam_id)),
    };
    let saved = models::pages::update_by_id_in_parent_context(
        &mut conn,
        PageUpdateArgs {
            agent_attribution: None,
            page_id: *page_id,
            author: user.id,
            cms_page_update,
            retain_ids: false,
            history_change_reason: HistoryChangeReason::PageSaved,
            is_exam_page,
        },
        expected_course_id,
        expected_exam_id,
        models_requests::make_spec_fetcher(
            app_conf.base_url.clone(),
            request_id.0,
            jwt_key.into_inner(),
        ),
        models_requests::fetch_service_info,
    )
    .await?;
    token.authorized_ok(web::Json(saved))
}

/**
POST `/api/v0/cms/pages/:page_id/exercises-with-submissions` - Given a set of exercise ids, returns
the subset that has at least one existing submission. Used by the editor to warn the teacher before
saving a page edit that would remove one of these exercises, since that soft-deletes it and orphans
its submissions.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/{page_id}/exercises-with-submissions",
    operation_id = "getExercisesWithSubmissions",
    tag = "cms_pages",
    params(
        ("page_id" = Uuid, Path, description = "Page id")
    ),
    request_body = Vec<Uuid>,
    responses(
        (status = 200, description = "Exercise ids, among the given ones, that have submissions", body = Vec<Uuid>)
    )
)]
async fn get_exercises_with_submissions(
    exercise_ids: web::Json<Vec<Uuid>>,
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<Uuid>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;

    let exercise_ids_with_submissions =
        models::exercise_slide_submissions::get_exercise_ids_with_any_submissions(
            &mut conn,
            *page_id,
            &exercise_ids.0,
        )
        .await?;

    token.authorized_ok(web::Json(exercise_ids_with_submissions))
}

/**
GET /api/v0/cms/pages/:page_id/page-navigation - tells what's the next page, previous page, and the chapter front page given a page id.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{page_id}/page-navigation",
    operation_id = "getCmsPageNavigation",
    tag = "cms_pages",
    params(
        ("page_id" = Uuid, Path, description = "Page id")
    ),
    responses(
        (status = 200, description = "Page navigation", body = PageNavigationInformation)
    )
)]
async fn get_page_navigation(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<PageNavigationInformation>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let res =
        models::pages::get_page_navigation_data(&mut conn, *page_id, PageVisibility::Any).await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/cms/pages/:page_id/pending-agent-changes` - Whether the signed-in user has
unpublished AI agent changes on the page, for the notice in the page editor. `null` if not.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{page_id}/pending-agent-changes",
    operation_id = "getCmsPagePendingAgentChanges",
    tag = "cms_pages",
    params(
        ("page_id" = Uuid, Path, description = "Page id")
    ),
    responses(
        (status = 200, description = "The open changeset changing the page, if any", body = Option<PendingAgentChanges>)
    )
)]
async fn get_pending_agent_changes(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Option<PendingAgentChanges>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;
    let pending = agent_changesets::get_pending_agent_changes(&mut conn, user.id, *page_id).await?;
    token.authorized_ok(web::Json(pending))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{page_id}", web::get().to(get_page))
        .route("/{page_id}/info", web::get().to(get_page_info))
        .route(
            "/{page_id}/page-navigation",
            web::get().to(get_page_navigation),
        )
        .route("/{page_id}", web::put().to(update_page))
        .route(
            "/{page_id}/exercises-with-submissions",
            web::post().to(get_exercises_with_submissions),
        )
        .route(
            "/{page_id}/pending-agent-changes",
            web::get().to(get_pending_agent_changes),
        );
}
