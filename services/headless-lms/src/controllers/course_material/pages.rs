use crate::{controllers::ApplicationResult, models::pages::NextPage};
use actix_web::web::{self, Json, ServiceConfig};
use sqlx::PgPool;
use std::str::FromStr;
use uuid::Uuid;

/**
 GET /api/v0/course-material/pages/:page_id/next-page - returns next pages info.
 If current page is the last page of the chapter, returns next chapters first page.
 # Example,
```json
{
    "path": "/path-to-next/page",
    "name": "Name of the next page",
    "part": 1,
}
```
*/
async fn get_next_page(
    request_page_id: web::Path<String>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<NextPage>> {
    let pages_id = Uuid::from_str(&request_page_id)?;
    let next_page_data: NextPage =
        crate::models::pages::get_next_page(pool.get_ref(), pages_id).await?;
    Ok(Json(next_page_data))
}

pub fn _add_pages_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{current_page_id}/next-page", web::get().to(get_next_page));
}
