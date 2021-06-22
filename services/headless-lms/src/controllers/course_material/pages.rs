//! Controllers for requests starting with `/api/v0/course-material/pages`.
use crate::{controllers::ApplicationResult, models::pages::PageRoutingData};
use actix_web::web::{self, Json, ServiceConfig};
use sqlx::PgPool;
use uuid::Uuid;

/**
 GET /api/v0/course-material/pages/:page_id/next-page - returns next pages info.
 If current page is the last page of the chapter, returns next chapters first page.
 # Example,
```json
{
    "url_path": "/path-to-next/page",
    "title": "Name of the next page",
    "chapter_number": 1
}
```
*/
#[instrument(skip(pool))]
async fn get_next_page(
    request_page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Option<PageRoutingData>>> {
    let mut conn = pool.acquire().await?;
    let next_page_data = crate::models::pages::get_next_page(&mut conn, *request_page_id).await?;
    Ok(Json(next_page_data))
}

/**
 GET /api/v0/course-material/pages/:page_id/previous-page - returns previous pages routing data.
 If current page is the front page of the chapter, returns previous chapters last page if exists.
 # Example,
```json
{
    "url_path": "/path-to-previous/page",
    "title": "Name of the previous page",
    "chapter_number": 1
}
```
*/
async fn get_previous_page(
    request_page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Option<PageRoutingData>>> {
    let mut conn = pool.acquire().await?;
    let previous_page_data =
        crate::models::pages::get_previous_page(&mut conn, *request_page_id).await?;
    Ok(Json(previous_page_data))
}

pub fn _add_pages_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{current_page_id}/next-page", web::get().to(get_next_page));
    cfg.route(
        "/{current_page_id}/previous-page",
        web::get().to(get_previous_page),
    );
}
