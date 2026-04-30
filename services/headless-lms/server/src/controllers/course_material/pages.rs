//! Controllers for requests starting with `/api/v0/course-material/pages`.

use std::collections::HashSet;

use crate::{
    domain::authorization::{
        AuthorizationToken, authorize_access_to_course_material, skip_authorize,
    },
    prelude::*,
};
use models::pages::{
    IsChapterFrontPage, Page, PageChapterAndCourseInformation, PageNavigationInformation,
    PageVisibility,
};
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(paths(
    get_by_exam_id,
    get_chapter_front_page,
    get_page_navigation,
    get_chapter_and_course_information,
    get_url_path,
    is_chapter_front_page
))]
pub(crate) struct CourseMaterialPagesApiDoc;

fn page_not_found() -> ControllerError {
    controller_err!(NotFound, "Page not found".to_string())
}

async fn authorize_page_parent_access(
    conn: &mut PgConnection,
    user_id: Option<Uuid>,
    page: &Page,
) -> Result<(AuthorizationToken, PageVisibility), ControllerError> {
    if page.deleted_at.is_some() {
        return Err(page_not_found());
    }
    if let Some(course_id) = page.course_id {
        let token = authorize_access_to_course_material(conn, user_id, course_id).await?;
        let can_view_hidden_pages = if let Some(user_id) = user_id {
            authorize(
                conn,
                Act::ViewMaterial,
                Some(user_id),
                Res::Course(course_id),
            )
            .await
            .is_ok()
        } else {
            false
        };
        if page.hidden && !can_view_hidden_pages {
            return Err(page_not_found());
        }
        let visibility = if can_view_hidden_pages {
            PageVisibility::Any
        } else {
            PageVisibility::Public
        };
        Ok((token, visibility))
    } else if let Some(exam_id) = page.exam_id {
        let user_id = user_id.ok_or_else(|| {
            controller_err!(
                Unauthorized,
                "Authentication required for exam page".to_string()
            )
        })?;
        let token = authorize(conn, Act::View, Some(user_id), Res::Exam(exam_id)).await?;
        Ok((token, PageVisibility::Any))
    } else {
        Err(page_not_found())
    }
}

async fn filter_navigation_by_visibility(
    conn: &mut PgConnection,
    mut navigation: PageNavigationInformation,
    visibility: PageVisibility,
) -> Result<PageNavigationInformation, ControllerError> {
    let page_ids = [
        navigation.chapter_front_page.as_ref(),
        navigation.next_page.as_ref(),
        navigation.previous_page.as_ref(),
    ]
    .into_iter()
    .flatten()
    .map(|page| page.page_id)
    .collect::<Vec<_>>();
    let visible_page_ids = models::pages::get_by_ids_and_visibility(conn, &page_ids, visibility)
        .await?
        .into_iter()
        .map(|page| page.id)
        .collect::<HashSet<_>>();

    if navigation
        .chapter_front_page
        .as_ref()
        .is_some_and(|page| !visible_page_ids.contains(&page.page_id))
    {
        navigation.chapter_front_page = None;
    }
    if navigation
        .next_page
        .as_ref()
        .is_some_and(|page| !visible_page_ids.contains(&page.page_id))
    {
        navigation.next_page = None;
    }
    if navigation
        .previous_page
        .as_ref()
        .is_some_and(|page| !visible_page_ids.contains(&page.page_id))
    {
        navigation.previous_page = None;
    }

    Ok(navigation)
}

/**
GET /api/v0/course-material/pages/exam/{page_id}
*/
#[utoipa::path(
    get,
    path = "/exam/{page_id}",
    operation_id = "getCourseMaterialPageByExamId",
    tag = "course-material-pages",
    params(
        ("page_id" = Uuid, Path, description = "Exam id")
    ),
    responses(
        (status = 200, description = "Exam page", body = Page)
    )
)]
#[instrument(skip(pool))]
async fn get_by_exam_id(
    exam_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth: AuthUser,
) -> ControllerResult<web::Json<Page>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::View, Some(auth.id), Res::Exam(*exam_id)).await?;
    let page = models::pages::get_by_exam_id(&mut conn, *exam_id).await?;
    let page = models::pages::filter_course_material_page(&mut conn, Some(auth.id), page).await?;
    token.authorized_ok(web::Json(page))
}

/**
GET /api/v0/course-material/page/{page_id}
*/
#[utoipa::path(
    get,
    path = "/{current_page_id}/chapter-front-page",
    operation_id = "getCourseMaterialChapterFrontPage",
    tag = "course-material-pages",
    params(
        ("current_page_id" = Uuid, Path, description = "Current page id")
    ),
    responses(
        (status = 200, description = "Chapter front page", body = Option<Page>)
    )
)]
#[instrument(skip(pool))]
async fn get_chapter_front_page(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth: Option<AuthUser>,
) -> ControllerResult<web::Json<Option<Page>>> {
    let mut conn = pool.acquire().await?;
    let user_id = auth.map(|u| u.id);
    let current_page = models::pages::get_page(&mut conn, *page_id).await?;
    let (token, visibility) =
        authorize_page_parent_access(&mut conn, user_id, &current_page).await?;
    let chapter_front_page = match current_page.chapter_id {
        Some(chapter_id) => {
            models::pages::get_front_page_by_chapter_id(&mut conn, chapter_id).await?
        }
        None => None,
    };
    let chapter_front_page = match chapter_front_page {
        Some(page) => {
            let visible_pages =
                models::pages::get_by_ids_and_visibility(&mut conn, &[page.id], visibility).await?;
            if visible_pages.is_empty() {
                None
            } else {
                Some(models::pages::filter_course_material_page(&mut conn, user_id, page).await?)
            }
        }
        None => None,
    };
    token.authorized_ok(web::Json(chapter_front_page))
}

/**
GET /api/v0/course-material/pages/:page_id/page-navigation - tells what's the next page, previous page, and the chapter front page given a page id.
*/
#[utoipa::path(
    get,
    path = "/{current_page_id}/page-navigation",
    operation_id = "getCourseMaterialPageNavigation",
    tag = "course-material-pages",
    params(
        ("current_page_id" = Uuid, Path, description = "Current page id")
    ),
    responses(
        (status = 200, description = "Page navigation information", body = PageNavigationInformation)
    )
)]
#[instrument(skip(pool))]
async fn get_page_navigation(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth: Option<AuthUser>,
) -> ControllerResult<web::Json<PageNavigationInformation>> {
    let mut conn = pool.acquire().await?;
    let user_id = auth.map(|u| u.id);
    let current_page = models::pages::get_page(&mut conn, *page_id).await?;
    let (token, visibility) =
        authorize_page_parent_access(&mut conn, user_id, &current_page).await?;
    let res = models::pages::get_page_navigation_data(&mut conn, *page_id).await?;
    let res = filter_navigation_by_visibility(&mut conn, res, visibility).await?;

    token.authorized_ok(web::Json(res))
}

/**
 GET /api/v0/course-material/pages/:page_id/chapter-and-course-information - gives the page's chapter and course information -- useful for the breadcrumbs
*/
#[utoipa::path(
    get,
    path = "/{current_page_id}/chapter-and-course-information",
    operation_id = "getCourseMaterialPageChapterAndCourseInformation",
    tag = "course-material-pages",
    params(
        ("current_page_id" = Uuid, Path, description = "Current page id")
    ),
    responses(
        (status = 200, description = "Page chapter and course information", body = PageChapterAndCourseInformation)
    )
)]
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
#[utoipa::path(
    get,
    path = "/{current_page_id}/url-path",
    operation_id = "getCourseMaterialPageUrlPath",
    tag = "course-material-pages",
    params(
        ("current_page_id" = Uuid, Path, description = "Current page id")
    ),
    responses(
        (status = 200, description = "Page URL path", body = String)
    )
)]
#[instrument(skip(pool))]
async fn get_url_path(
    page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth: Option<AuthUser>,
) -> ControllerResult<String> {
    let mut conn = pool.acquire().await?;
    let page = models::pages::get_page(&mut conn, *page_id).await?;
    let user_id = auth.map(|u| u.id);

    let (token, _) = authorize_page_parent_access(&mut conn, user_id, &page).await?;
    token.authorized_ok(page.url_path)
}

#[utoipa::path(
    get,
    path = "/{current_page_id}/is-chapter-front-page",
    operation_id = "getCourseMaterialIsPageChapterFrontPage",
    tag = "course-material-pages",
    params(
        ("current_page_id" = Uuid, Path, description = "Current page id")
    ),
    responses(
        (status = 200, description = "Whether page is chapter front page", body = IsChapterFrontPage)
    )
)]
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
