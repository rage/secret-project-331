//! Controllers for requests starting with `/api/v0/course_material/chapters`.

use models::pages::{Page, PageWithExercises};

use crate::controllers::prelude::*;

/**
GET `/api/v0/course-material/chapters/:chapter_id/pages` - Returns a list of pages in chapter.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_chapters_pages(
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<Page>>> {
    let mut conn = pool.acquire().await?;
    let chapter_pages: Vec<Page> = models::pages::chapter_pages(&mut conn, *chapter_id).await?;
    Ok(web::Json(chapter_pages))
}

/**
GET `/api/v0/course-material/chapters/:chapter_id/exercises` - Returns a list of pages and its exercises in chapter.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_chapters_exercises(
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<PageWithExercises>>> {
    let mut conn = pool.acquire().await?;
    let chapter_pages_with_exercises =
        models::pages::get_chapters_pages_with_exercises(&mut conn, *chapter_id).await?;
    Ok(web::Json(chapter_pages_with_exercises))
}

/**
GET `/api/v0/course-material/chapters/:chapter_id/pages-exclude-mainfrontpage` - Returns a list of pages in chapter mainfrontpage excluded.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_chapters_pages_without_main_frontpage(
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<Page>>> {
    let mut conn = pool.acquire().await?;
    let chapter_pages =
        models::pages::get_chapters_pages_exclude_main_frontpage(&mut conn, *chapter_id).await?;
    Ok(web::Json(chapter_pages))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{chapter_id}/pages", web::get().to(get_chapters_pages))
        .route(
            "/{chapter_id}/exercises",
            web::get().to(get_chapters_exercises),
        )
        .route(
            "/{chapter_id}/pages-exclude-mainfrontpage",
            web::get().to(get_chapters_pages_without_main_frontpage),
        );
}
