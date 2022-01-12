//! Controllers for requests starting with `/api/v0/cms/pages`.

use models::{
    page_history::HistoryChangeReason,
    pages::{CmsPageUpdate, ContentManagementPage},
};

use crate::controllers::prelude::*;

/**
GET `/api/v0/cms/pages/:page_id` - Get a page with exercises and exercise tasks by id.

# Example OUTDATED

Request: `GET /api/v0/cms/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02`
*/
#[cfg_attr(doc, doc = generated_docs!(ContentManagementPage))]
#[instrument(skip(pool))]
async fn get_page(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ContentManagementPage>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Edit, user.id, Res::Page(*page_id)).await?;

    let cms_page = models::pages::get_page_with_exercises(&mut conn, *page_id).await?;
    Ok(web::Json(cms_page))
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
#[cfg_attr(doc, doc = generated_docs!(ContentManagementPage))]
#[instrument(skip(pool))]
async fn update_page(
    payload: web::Json<CmsPageUpdate>,
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ContentManagementPage>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Edit, user.id, Res::Page(*page_id)).await?;

    let page_update = payload.0;
    let (_, exam_id) = models::pages::get_course_and_exam_id(&mut conn, *page_id).await?;
    let saved = models::pages::update_page(
        &mut conn,
        *page_id,
        page_update,
        user.id,
        false,
        HistoryChangeReason::PageSaved,
        exam_id.is_some(),
    )
    .await?;
    Ok(web::Json(saved))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{page_id}", web::get().to(get_page))
        .route("/{page_id}", web::put().to(update_page));
}
