//! Controllers for requests starting with `/api/v0/course-material/pages`.

use crate::{domain::authorization::skip_authorize, prelude::*};
use models::pages::{
    IsChapterFrontPage, Page, PageChapterAndCourseInformation, PageNavigationInformation,
};

/**
GET /api/v0/course-material/pages/exam/{page_id}
*/

#[instrument(skip(pool))]
async fn get_by_exam_id(
    exam_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Page>> {
    let mut conn = pool.acquire().await?;
    let page = models::pages::get_by_exam_id(&mut conn, *exam_id).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(page))
}

/**
GET /api/v0/course-material/page/{page_id}
*/

#[instrument(skip(pool))]
async fn get_chapter_front_page(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Option<Page>>> {
    let mut conn = pool.acquire().await?;
    let chapter_front_page =
        models::pages::get_chapter_front_page_by_page_id(&mut conn, *page_id).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(chapter_front_page))
}

/**
GET /api/v0/course-material/pages/:page_id/page-navigation - tells what's the next page, previous page, and the chapter front page given a page id.
*/

#[instrument(skip(pool))]
async fn get_page_navigation(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<PageNavigationInformation>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let res = models::pages::get_page_navigation_data(&mut conn, *page_id).await?;

    token.authorized_ok(web::Json(res))
}

/**
 GET /api/v0/course-material/pages/:page_id/chapter-and-course-information - gives the page's chapter and course information -- useful for the breadcrumbs
*/

#[instrument(skip(pool))]
async fn get_chapter_and_course_information(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<PageChapterAndCourseInformation>> {
    let mut conn = pool.acquire().await?;
    let res = models::pages::get_page_chapter_and_course_information(&mut conn, *page_id).await?;

    let token = skip_authorize();
    token.authorized_ok(web::Json(res))
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

    let token = skip_authorize();
    token.authorized_ok(page.url_path)
}

#[instrument(skip(pool))]
async fn is_chapter_front_page(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<IsChapterFrontPage>> {
    let mut conn = pool.acquire().await?;
    let is_chapter_front_page = models::pages::is_chapter_front_page(&mut conn, *page_id).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(is_chapter_front_page))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/exam/{page_id}", web::get().to(get_by_exam_id))
        .route(
            "/{current_page_id}/chapter-front-page",
            web::get().to(get_chapter_front_page),
        )
        .route("/{current_page_id}/url-path", web::get().to(get_url_path))
        .route(
            "/{current_page_id}/chapter-and-course-information",
            web::get().to(get_chapter_and_course_information),
        )
        .route(
            "/{current_page_id}/is-chapter-front-page",
            web::get().to(is_chapter_front_page),
        )
        .route(
            "/{current_page_id}/page-navigation",
            web::get().to(get_page_navigation),
        );
}
