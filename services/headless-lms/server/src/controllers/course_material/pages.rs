//! Controllers for requests starting with `/api/v0/course-material/pages`.

use models::pages::{
    Page, PageChapterAndCourseInformation, PageNavigationInformation,
    PageRoutingDataWithChapterStatus,
};

use crate::{controllers::prelude::*, domain::authorization::skip_authorize};

/**
GET /api/v0/course-material/pages/exam/{page_id}
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_by_exam_id(
    exam_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Page>> {
    let mut conn = pool.acquire().await?;
    let page = models::pages::get_by_exam_id(&mut conn, *exam_id).await?;
    let token = skip_authorize()?;
    token.authorized_ok(web::Json(page))
}

/**
GET /api/v0/course-material/page/{page_id}
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_chapter_front_page(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Page>> {
    let mut conn = pool.acquire().await?;
    let chapter_front_page =
        models::pages::get_chapter_front_page_by_page_id(&mut conn, *page_id).await?;
    let token = skip_authorize()?;
    token.authorized_ok(web::Json(chapter_front_page))
}

/**
 GET /api/v0/course-material/pages/:page_id/next-page - returns next pages info.
 If current page is the last page of the chapter, returns next chapters first page.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_next_page(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Option<PageRoutingDataWithChapterStatus>>> {
    let mut conn = pool.acquire().await?;
    let next_page_data = models::pages::get_next_page(&mut conn, *page_id).await?;
    let next_page_data_with_status =
        models::pages::get_next_page_with_chapter_status(next_page_data).await?;

    let token = skip_authorize()?;
    token.authorized_ok(web::Json(next_page_data_with_status))
}
/**
 GET /api/v0/course-material/pages/:page_id/previous-page - returns previous pages info.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_previous_page(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Option<PageRoutingDataWithChapterStatus>>> {
    let mut conn = pool.acquire().await?;
    let previous_page_data = models::pages::get_previous_page(&mut conn, *page_id).await?;
    let previous_page_data_with_status =
        models::pages::get_previous_page_with_chapter_status(previous_page_data).await?;

    let token = skip_authorize()?;
    token.authorized_ok(web::Json(previous_page_data_with_status))
}

/**
GET /api/v0/course-material/pages/:page_id/page-navigation - return page navigator object that contains chapterFrontPage, nextPage ans previousPage data
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_page_navigation(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<PageNavigationInformation>> {
    let mut conn = pool.acquire().await?;
    let previous_page_data = models::pages::get_previous_page(&mut conn, *page_id).await?;
    let previous_page_data_with_status =
        models::pages::get_previous_page_with_chapter_status(previous_page_data).await?;

    let token = skip_authorize()?;

    let next_page_data = models::pages::get_next_page(&mut conn, *page_id).await?;
    let next_page_data_with_status =
        models::pages::get_next_page_with_chapter_status(next_page_data).await?;

    let chapter_front_page =
        models::pages::get_chapter_front_page_by_page_id(&mut conn, *page_id).await?;

    token.authorized_ok(web::Json(PageNavigationInformation {
        chapter_front_page,
        next_page: next_page_data_with_status,
        previous_page: previous_page_data_with_status,
    }))
}

/**
 GET /api/v0/course-material/pages/:page_id/chapter-and-course-information - gives the page's chapter and course information -- useful for the breadcrumbs
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_chapter_and_course_information(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<PageChapterAndCourseInformation>> {
    let mut conn = pool.acquire().await?;
    let res = models::pages::get_page_chapter_and_course_information(&mut conn, *page_id).await?;

    let token = skip_authorize()?;
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

    let token = skip_authorize()?;
    token.authorized_ok(page.url_path)
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/exam/{page_id}", web::get().to(get_by_exam_id))
        .route("/{current_page_id}/next-page", web::get().to(get_next_page))
        .route(
            "/{current_page_id}/previous-page",
            web::get().to(get_previous_page),
        )
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
            "/{current_page_id}/page-navigation",
            web::get().to(get_page_navigation),
        );
}
