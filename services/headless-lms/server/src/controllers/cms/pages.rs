//! Controllers for requests starting with `/api/v0/cms/pages`.

use crate::controllers::prelude::*;
use models::{
    page_history::HistoryChangeReason,
    pages::{CmsPageUpdate, ContentManagementPage},
};

/**
GET `/api/v0/cms/pages/:page_id` - Get a page with exercises and exercise tasks by id.

# Example OUTDATED

Request: `GET /api/v0/cms/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02`

Response:
```json
{
  "id": "40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02",
  "created_at": "2021-03-08T20:14:56.216394",
  "updated_at": "2021-03-08T20:14:56.216394",
  "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
  "content": [
    {
      "type": "x"
    }
  ],
  "url_path": "/part-1/hello-world",
  "title": "Hello world!",
  "deleted_at": null,
  "chapter_id": "2495ffa3-7ea9-4615-baa5-828023688c79"
}
```
*/
#[instrument(skip(pool))]
async fn get_page(
    request_page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ContentManagementPage>> {
    let mut conn = pool.acquire().await?;
    let (course_id, exam_id) =
        models::pages::get_course_and_exam_id(&mut conn, *request_page_id).await?;
    if let Some(course_id) = course_id {
        authorize(&mut conn, Act::Edit, user.id, Res::Course(course_id)).await?;
    } else if let Some(exam_id) = exam_id {
        authorize(&mut conn, Act::Edit, user.id, Res::Exam(exam_id)).await?;
    } else {
        return Err(anyhow::anyhow!("No course or exam associated with page").into());
    }
    let cms_page = models::pages::get_page_with_exercises(&mut conn, *request_page_id).await?;
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

Response:

```json
{
  "id": "40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02",
  "created_at": "2021-03-08T20:14:56.216394",
  "updated_at": "2021-03-08T20:14:56.216394",
  "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
  "content": [
    {
      "type": "x"
    }
  ],
  "url_path": "/part-1/hello-world",
  "title": "Hello world!",
  "deleted_at": null,
  "chapter_id": "2495ffa3-7ea9-4615-baa5-828023688c79",
  "front_page_of_chapter_id": null
}
```
*/
#[instrument(skip(pool))]
async fn update_page(
    payload: web::Json<CmsPageUpdate>,
    request_page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ContentManagementPage>> {
    let mut conn = pool.acquire().await?;
    let page_update = payload.0;
    let (course_id, exam_id) =
        models::pages::get_course_and_exam_id(&mut conn, *request_page_id).await?;
    if let Some(course_id) = course_id {
        authorize(&mut conn, Act::Edit, user.id, Res::Course(course_id)).await?;
    } else if let Some(exam_id) = exam_id {
        authorize(&mut conn, Act::Edit, user.id, Res::Exam(exam_id)).await?;
    }
    let saved = models::pages::update_page(
        &mut conn,
        *request_page_id,
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
