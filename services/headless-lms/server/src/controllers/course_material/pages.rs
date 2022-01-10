//! Controllers for requests starting with `/api/v0/course-material/pages`.

use models::pages::{Page, PageRoutingDataWithChapterStatus};

use crate::controllers::prelude::*;

/**
GET /api/v0/course-material/pages/exam/{page_id}
*/
#[cfg_attr(doc, doc = generated_docs!(Page))]
async fn get_by_exam_id(
    exam_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Page>> {
    let mut conn = pool.acquire().await?;
    let page = models::pages::get_by_exam_id(&mut conn, *exam_id).await?;
    Ok(web::Json(page))
}

/**
 GET /api/v0/course-material/pages/:page_id/next-page - returns next pages info.
 If current page is the last page of the chapter, returns next chapters first page.
*/
#[cfg_attr(doc, doc = generated_docs!(Page))]
#[instrument(skip(pool))]
async fn get_next_page(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Option<PageRoutingDataWithChapterStatus>>> {
    let mut conn = pool.acquire().await?;
    let next_page_data = models::pages::get_next_page(&mut conn, *page_id).await?;
    let next_page_data_with_status =
        models::pages::get_next_page_with_chapter_status(next_page_data).await?;

    Ok(web::Json(next_page_data_with_status))
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
    let page = models::pages::get_page(&mut conn, *page_id).await?;
    Ok(page.url_path)
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/exam/{page_id}", web::get().to(get_by_exam_id))
        .route("/{current_page_id}/next-page", web::get().to(get_next_page))
        .route("/{current_page_id}/url-path", web::get().to(get_url_path));
}
