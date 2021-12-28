//! Controllers for requests starting with `/api/v0/main-frontend/pages`.

use crate::controllers::prelude::*;
use models::{
    page_history::PageHistory,
    pages::{HistoryRestoreData, NewPage, Page},
};

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

Response:
```json
{
  "id": "d90bf7ab-181c-4aa2-a87e-5c28238cc67d",
  "created_at": "2021-03-12T09:27:36.428501",
  "updated_at": "2021-03-12T09:27:36.428501",
  "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
  "content": [
    {
      "id": "18110110-d02a-4432-8cb9-084d0c63a524",
      "type": "x"
    }
  ],
  "url_path": "/part-2/best-page",
  "title": "Hello world!",
  "deleted_at": null,
  "chapter_id": "2495ffa3-7ea9-4615-baa5-828023688c79",
  "front_page_of_chapter_id": null
}
```

*/
#[instrument(skip(pool))]
async fn post_new_page(
    payload: web::Json<NewPage>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Page>> {
    let mut conn = pool.acquire().await?;
    let new_page = payload.0;
    let course_id = new_page.course_id.ok_or_else(|| {
        ControllerError::BadRequest("Cannot create a new page without a course id".to_string())
    })?;
    authorize(&mut conn, Act::Edit, user.id, Res::Course(course_id)).await?;
    let page = models::pages::insert_page(&mut conn, new_page, user.id).await?;
    Ok(web::Json(page))
}

/**
DELETE `/api/v0/main-frontend/pages/:page_id` - Delete a page, related exercises, and related exercise tasks by id.


# Example

Request: `DELETE /api/v0/main-frontend/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02`

Response:
```json
{
  "id": "40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02",
  "created_at": "2021-03-08T20:14:56.216394",
  "updated_at": "2021-03-08T20:29:22.511073",
  "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
  "content": [
    {
      "type": "x"
    }
  ],
  "url_path": "/part-1/hello-world",
  "title": "Hello world!",
  "deleted_at": "2021-04-28T16:33:42.670935",
  "chapter_id": "2495ffa3-7ea9-4615-baa5-828023688c79"
}
```
*/
#[instrument(skip(pool))]
async fn delete_page(
    request_page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Page>> {
    let mut conn = pool.acquire().await?;
    let (course_id, exam_id) =
        models::pages::get_course_and_exam_id(&mut conn, *request_page_id).await?;
    if let Some(course_id) = course_id {
        authorize(&mut conn, Act::Edit, user.id, Res::Course(course_id)).await?;
    } else if let Some(exam_id) = exam_id {
        authorize(&mut conn, Act::Edit, user.id, Res::Exam(exam_id)).await?;
    } else {
        return Err(anyhow::anyhow!("Page not associated with course or exam").into());
    }
    let deleted_page =
        models::pages::delete_page_and_exercises(&mut conn, *request_page_id).await?;
    Ok(web::Json(deleted_page))
}

/**
GET /api/v0/main-frontend/pages/:page_id/history
*/
async fn history(
    pool: web::Data<PgPool>,
    page_id: web::Path<Uuid>,
    pagination: web::Query<Pagination>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<PageHistory>>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::View, user.id, Res::Page(*page_id)).await?;

    let res = models::page_history::history(&mut conn, page_id.into_inner(), &pagination).await?;
    Ok(web::Json(res))
}

/**
GET /api/v0/main-frontend/pages/:page_id/history_count
*/
async fn history_count(
    pool: web::Data<PgPool>,
    page_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<i64>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::View, user.id, Res::Page(*page_id)).await?;

    let res = models::page_history::history_count(&mut conn, page_id.into_inner()).await?;
    Ok(web::Json(res))
}

/**
POST /api/v0/main-frontend/pages/:page_id/restore
*/
async fn restore(
    pool: web::Data<PgPool>,
    page_id: web::Path<Uuid>,
    restore_data: web::Json<HistoryRestoreData>,
    user: AuthUser,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Edit, user.id, Res::Page(*page_id)).await?;

    let res = models::pages::restore(
        &mut conn,
        page_id.into_inner(),
        restore_data.history_id,
        user.id,
    )
    .await?;
    Ok(web::Json(res))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(post_new_page))
        .route("/{page_id}", web::delete().to(delete_page))
        .route("/{page_id}/history", web::get().to(history))
        .route("/{page_id}/history_count", web::get().to(history_count))
        .route("/{history_id}/restore", web::post().to(restore));
}
