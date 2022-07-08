//! Controllers for requests starting with `/api/v0/cms/pages`.

use models::{
    page_history::HistoryChangeReason,
    pages::{CmsPageUpdate, ContentManagementPage, PageInfo, PageRoutingDataWithChapterStatus},
    CourseOrExamId,
};

use crate::controllers::prelude::*;

/**
GET `/api/v0/cms/pages/:page_id` - Get a page with exercises and exercise tasks by id.

Request: `GET /api/v0/cms/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02`
*/
#[generated_doc]
#[instrument(skip(pool))]
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
#[generated_doc]
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
#[generated_doc]
#[instrument(skip(pool))]
async fn update_page(
    payload: web::Json<CmsPageUpdate>,
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ContentManagementPage>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;

    let page_update = payload.0;
    let course_or_exam_id = models::pages::get_course_and_exam_id(&mut conn, *page_id).await?;
    let is_exam_page = matches!(course_or_exam_id, CourseOrExamId::Exam(_));
    let saved = models::pages::update_page(
        &mut conn,
        *page_id,
        page_update,
        user.id,
        false,
        HistoryChangeReason::PageSaved,
        is_exam_page,
    )
    .await?;
    token.authorized_ok(web::Json(saved))
}

/**
 GET /api/v0/cms/pages/:page_id/next-page - returns next pages info.
 If current page is the last page of the chapter, returns next chapters first page.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_next_page(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Option<PageRoutingDataWithChapterStatus>>> {
    let mut conn = pool.acquire().await?;
    let next_page_data = models::pages::get_next_page(&mut conn, *page_id).await?;
    let next_page_data_with_status =
        models::pages::get_next_page_with_chapter_status(next_page_data).await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;
    token.authorized_ok(web::Json(next_page_data_with_status))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{page_id}", web::get().to(get_page))
        .route("/{page_id}/info", web::get().to(get_page_info))
        .route("/{page_id}/next-page", web::get().to(get_next_page))
        .route("/{page_id}", web::put().to(update_page));
}
