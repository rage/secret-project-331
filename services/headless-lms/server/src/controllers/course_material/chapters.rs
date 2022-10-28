//! Controllers for requests starting with `/api/v0/course_material/chapters`.

use models::pages::{Page, PageVisibility, PageWithExercises};

use crate::prelude::*;

/**
GET `/api/v0/course-material/chapters/:chapter_id/pages` - Returns a list of pages in chapter.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_public_chapter_pages(
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<Page>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        auth.map(|u| u.id),
        Res::Chapter(*chapter_id),
    )
    .await?;
    let chapter_pages: Vec<Page> = models::pages::get_course_pages_by_chapter_id_and_visibility(
        &mut conn,
        *chapter_id,
        PageVisibility::Public,
    )
    .await?;
    token.authorized_ok(web::Json(chapter_pages))
}

/**
GET `/api/v0/course-material/chapters/:chapter_id/exercises` - Returns a list of pages and its exercises in chapter.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_chapters_exercises(
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<PageWithExercises>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        auth.map(|u| u.id),
        Res::Chapter(*chapter_id),
    )
    .await?;

    let chapter_pages_with_exercises =
        models::pages::get_chapters_pages_with_exercises(&mut conn, *chapter_id).await?;
    token.authorized_ok(web::Json(chapter_pages_with_exercises))
}

/**
GET `/api/v0/course-material/chapters/:chapter_id/pages-exclude-mainfrontpage` - Returns a list of pages in chapter mainfrontpage excluded.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_chapters_pages_without_main_frontpage(
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<Page>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        auth.map(|u| u.id),
        Res::Chapter(*chapter_id),
    )
    .await?;
    let chapter_pages =
        models::pages::get_chapters_visible_pages_exclude_main_frontpage(&mut conn, *chapter_id)
            .await?
            .into_iter()
            .collect();
    token.authorized_ok(web::Json(chapter_pages))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{chapter_id}/pages",
        web::get().to(get_public_chapter_pages),
    )
    .route(
        "/{chapter_id}/exercises",
        web::get().to(get_chapters_exercises),
    )
    .route(
        "/{chapter_id}/pages-exclude-mainfrontpage",
        web::get().to(get_chapters_pages_without_main_frontpage),
    );
}
