//! Controllers for requests starting with `/api/v0/course_material/chapters`.

use models::chapters::ChapterLockPreview;
use models::pages::{Page, PageVisibility, PageWithExercises};
use models::user_chapter_locking_statuses::{self, ChapterLockingStatus};

use crate::prelude::*;

/**
GET `/api/v0/course-material/chapters/:chapter_id/pages` - Returns a list of pages in chapter.
*/
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
GET `/api/v0/course-material/chapters/:chapter_id/lock-preview` - Preview lock chapter

Returns information about unreturned exercises in the chapter before locking.
**/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_chapter_lock_preview(
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ChapterLockPreview>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Chapter(*chapter_id),
    )
    .await?;

    let chapter = models::chapters::get_chapter(&mut conn, *chapter_id).await?;
    let preview = models::chapters::get_chapter_lock_preview(
        &mut conn,
        *chapter_id,
        user.id,
        chapter.course_id,
    )
    .await?;

    token.authorized_ok(web::Json(preview))
}

/**
POST `/api/v0/course-material/chapters/:chapter_id/lock` - Complete chapter (mark as done)

Completes a chapter for the authenticated user (marks it as done).

Validates that:
- Course has chapter_locking_enabled
- Chapter is currently unlocked (student can work on it)
- All previous chapters in the same module are completed (sequential completion)
- Moves all exercises to manual review
- Unlocks next chapters for the user
**/
#[generated_doc]
#[instrument(skip(pool))]
async fn lock_chapter(
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<user_chapter_locking_statuses::UserChapterLockingStatus>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        Some(user.id),
        Res::Chapter(*chapter_id),
    )
    .await?;

    let chapter = models::chapters::get_chapter(&mut conn, *chapter_id).await?;
    let course = models::courses::get_course(&mut conn, chapter.course_id).await?;

    if !course.chapter_locking_enabled {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Chapter locking is not enabled for this course.".to_string(),
            None,
        ));
    }

    let current_status =
        user_chapter_locking_statuses::get_status(&mut conn, user.id, *chapter_id).await?;

    match current_status {
        None => {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "This chapter is locked. Complete previous chapters first.".to_string(),
                None,
            ));
        }
        Some(ChapterLockingStatus::Completed) => {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "This chapter is already completed.".to_string(),
                None,
            ));
        }
        Some(ChapterLockingStatus::Unlocked) => {
            // Continue with completion
        }
    }

    let previous_chapters =
        models::chapters::get_previous_chapters_in_module(&mut conn, *chapter_id).await?;

    for prev_chapter in previous_chapters {
        let prev_status =
            user_chapter_locking_statuses::get_status(&mut conn, user.id, prev_chapter.id).await?;

        match prev_status {
            None | Some(ChapterLockingStatus::Unlocked) => {
                return Err(ControllerError::new(
                    ControllerErrorType::BadRequest,
                    format!(
                        "You must complete previous chapters in order. Please complete chapter \"{}\" first.",
                        prev_chapter.name
                    ),
                    None,
                ));
            }
            Some(ChapterLockingStatus::Completed) => {
                // Previous chapter is completed, continue
            }
        }
    }

    let mut tx = conn.begin().await?;

    models::chapters::move_chapter_exercises_to_manual_review(
        &mut tx,
        *chapter_id,
        user.id,
        chapter.course_id,
    )
    .await?;

    let status = user_chapter_locking_statuses::complete_chapter(
        &mut tx,
        user.id,
        *chapter_id,
        chapter.course_id,
    )
    .await?;

    models::chapters::unlock_next_chapters_for_user(
        &mut tx,
        user.id,
        *chapter_id,
        chapter.course_id,
    )
    .await?;

    tx.commit().await?;

    token.authorized_ok(web::Json(status))
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
    )
    .route(
        "/{chapter_id}/lock-preview",
        web::get().to(get_chapter_lock_preview),
    )
    .route("/{chapter_id}/lock", web::post().to(lock_chapter));
}
