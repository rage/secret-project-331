//! Controllers for requests starting with `/api/v0/course-material/pages`.
use crate::{controllers::ApplicationResult, models::pages::NextPage};
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
) -> ApplicationResult<Json<Option<NextPage>>> {
    let mut conn = pool.acquire().await?;
    let next_page_data = crate::models::pages::get_next_page(&mut conn, *request_page_id).await?;
    Ok(Json(next_page_data))
}

pub fn _add_pages_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{current_page_id}/next-page", web::get().to(get_next_page));
}
