//! Controllers for requests starting with `/api/v0/main-frontend/pages`.

use std::sync::Arc;

use models::{
    page_history::PageHistory,
    pages::{HistoryRestoreData, NewPage, Page, PageDetailsUpdate, PageInfo},
};
use utoipa::OpenApi;

use crate::{
    domain::{
        models_requests::{self, JwtKey},
        request_id::RequestId,
    },
    prelude::*,
};

#[derive(OpenApi)]
#[openapi(paths(
    post_new_page,
    delete_page,
    get_page_info,
    update_page_details,
    history,
    history_count,
    restore,
    get_all_pages_by_course_id
))]
pub(crate) struct MainFrontendPagesApiDoc;

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

#[instrument(skip(pool, app_conf))]
#[utoipa::path(
    post,
    path = "",
    operation_id = "createPage",
    tag = "pages",
    request_body = NewPage,
    responses(
        (status = 200, description = "Created page", body = Page)
    )
)]
async fn post_new_page(
    request_id: RequestId,
    payload: web::Json<NewPage>,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
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
        models_requests::make_spec_fetcher(
            app_conf.base_url.clone(),
            request_id.0,
            Arc::clone(&jwt_key),
        ),
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
#[instrument(skip(pool))]
#[utoipa::path(
    delete,
    path = "/{page_id}",
    operation_id = "deletePage",
    tag = "pages",
    params(
        ("page_id" = Uuid, Path, description = "Page id")
    ),
    responses(
        (status = 200, description = "Deleted page", body = Page)
    )
)]
async fn delete_page(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Page>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;
    let deleted_page =
        models::pages::delete_page_and_exercises(&mut conn, *page_id, user.id).await?;

    token.authorized_ok(web::Json(deleted_page))
}

/**
GET /api/v0/main-frontend/pages/:page_id/history
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{page_id}/history",
    operation_id = "getPageHistory",
    tag = "pages",
    params(
        ("page_id" = Uuid, Path, description = "Page id"),
        ("page" = Option<i64>, Query, description = "Page number"),
        ("limit" = Option<i64>, Query, description = "Page size")
    ),
    responses(
        (status = 200, description = "Page history entries", body = Vec<PageHistory>)
    )
)]
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
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{page_id}/history_count",
    operation_id = "getPageHistoryCount",
    tag = "pages",
    params(
        ("page_id" = Uuid, Path, description = "Page id")
    ),
    responses(
        (status = 200, description = "Page history count", body = i64)
    )
)]
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

#[instrument(skip(pool, app_conf))]
#[utoipa::path(
    post,
    path = "/{page_id}/restore",
    operation_id = "restorePageHistory",
    tag = "pages",
    params(
        ("page_id" = Uuid, Path, description = "Page id")
    ),
    request_body = HistoryRestoreData,
    responses(
        (status = 200, description = "Restored history id", body = Uuid)
    )
)]
async fn restore(
    request_id: RequestId,
    pool: web::Data<PgPool>,
    page_id: web::Path<Uuid>,
    restore_data: web::Json<HistoryRestoreData>,
    app_conf: web::Data<ApplicationConfiguration>,
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
        models_requests::make_spec_fetcher(
            app_conf.base_url.clone(),
            request_id.0,
            Arc::clone(&jwt_key),
        ),
        models_requests::fetch_service_info,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-fronted/pages/:page_id/info` - Get a pages's course id, course name, organization slug

Request: `GET /api/v0/cms/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02/info`
*/
#[utoipa::path(
    get,
    path = "/{page_id}/info",
    operation_id = "getPageInfo",
    tag = "pages",
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

    let page_info = models::pages::get_page_info(&mut conn, *page_id).await?;

    token.authorized_ok(web::Json(page_info))
}

/**
POST `/api/v0/main-frontend/pages/:page_id/page-details` - Update pages title and url_path.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    put,
    path = "/{page_id}/page-details",
    operation_id = "updatePageDetails",
    tag = "pages",
    params(
        ("page_id" = Uuid, Path, description = "Page id")
    ),
    request_body = PageDetailsUpdate,
    responses(
        (status = 200, description = "Updated page details", body = bool)
    )
)]
async fn update_page_details(
    page_id: web::Path<Uuid>,
    payload: web::Json<PageDetailsUpdate>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;

    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;

    models::pages::update_page_details(&mut conn, *page_id, &payload).await?;
    token.authorized_ok(web::Json(true))
}

/**
GET `/api/v0/main-frontend/pages/:course_id/all-course-pages-for-course` - Get all pages of a course
*/
#[utoipa::path(
    get,
    path = "/{course_id}/all-course-pages-for-course",
    operation_id = "getCoursePages",
    tag = "pages",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Course pages", body = Vec<Page>)
    )
)]
async fn get_all_pages_by_course_id(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<Page>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;

    let mut pages = models::pages::get_pages_by_course_id(&mut conn, *course_id).await?;

    pages.sort_by(|a, b| a.order_number.cmp(&b.order_number));

    token.authorized_ok(web::Json(pages))
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
        .route(
            "/{page_id}/page-details",
            web::put().to(update_page_details),
        )
        .route("/{page_id}/history", web::get().to(history))
        .route("/{page_id}/history_count", web::get().to(history_count))
        .route("/{page_id}/restore", web::post().to(restore))
        .route(
            "/{course_id}/all-course-pages-for-course",
            web::get().to(get_all_pages_by_course_id),
        );
}
