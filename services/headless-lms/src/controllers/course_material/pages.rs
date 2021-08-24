//! Controllers for requests starting with `/api/v0/course-material/pages`.
use crate::{
    controllers::ControllerResult,
    models::{chapters::ChapterStatus, pages::PageRoutingDataWithChapterStatus},
};
use actix_web::web::{self, Json, ServiceConfig};
use chrono::Utc;
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
    "chapter_number": 1,
    "chapter_id": "uuidv4",
    "chapter_opens_at": "2014-11-28T12:45:59.324310806Z",
    "chapter_status": "open",
}
```
*/
#[instrument(skip(pool))]
async fn get_next_page(
    request_page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<Option<PageRoutingDataWithChapterStatus>>> {
    let mut conn = pool.acquire().await?;
    let next_page_data = crate::models::pages::get_next_page(&mut conn, *request_page_id).await?;
    match next_page_data {
        Some(data) => {
            let open = data
                .chapter_opens_at
                .map(|o| o <= Utc::now())
                .unwrap_or(true);
            let status = if open {
                ChapterStatus::Open
            } else {
                ChapterStatus::Closed
            };
            Ok(Json(Some(PageRoutingDataWithChapterStatus {
                url_path: data.url_path,
                title: data.title,
                chapter_number: data.chapter_number,
                chapter_id: data.chapter_id,
                chapter_opens_at: data.chapter_opens_at,
                chapter_front_page_id: data.chapter_front_page_id,
                chapter_status: status,
            })))
        }
        None => Ok(Json(None)),
    }
}

/**
 GET /api/v0/course-material/pages/:page_id/url-path - returns the page's URL path.
 # Example
 ```json
 "chapter-1/page-2"
 ```
*/
#[instrument(skip(pool))]
async fn get_url_path(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<String> {
    let mut conn = pool.acquire().await?;
    let page = crate::models::pages::get_page(&mut conn, *page_id).await?;
    Ok(page.url_path)
}

pub fn _add_pages_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{current_page_id}/next-page", web::get().to(get_next_page))
        .route("/{current_page_id}/url-path", web::get().to(get_url_path));
}
