//! Controllers for requests starting with `/api/v0/course_material/chapters`.

use models::chapters::ChapterLockPreview;
use models::pages::{Page, PageVisibility, PageWithExercises};
use models::user_chapter_locking_statuses::{self, ChapterLockingStatus};
use utoipa::OpenApi;

use crate::domain::authorization::authorize_access_to_course_material;
use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(
    get_public_chapter_pages,
    get_chapters_exercises,
    get_chapters_pages_without_main_frontpage,
    get_chapter_lock_preview,
    lock_chapter
))]
pub(crate) struct CourseMaterialChaptersApiDoc;

/**
GET `/api/v0/course-material/chapters/:chapter_id/pages` - Returns a list of pages in chapter.
*/
#[utoipa::path(
    get,
    path = "/{chapter_id}/pages",
    operation_id = "getCourseMaterialChapterPages",
    tag = "course-material-chapters",
    params(
        ("chapter_id" = Uuid, Path, description = "Chapter id")
    ),
    responses(
        (status = 200, description = "Public chapter pages", body = Vec<Page>)
    )
)]
#[instrument(skip(pool))]
async fn get_public_chapter_pages(
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<Page>>> {
    let mut conn = pool.acquire().await?;
    let user_id = auth.map(|u| u.id);
    let chapter = models::chapters::get_chapter(&mut conn, *chapter_id).await?;
    let token = authorize_access_to_course_material(&mut conn, user_id, chapter.course_id).await?;
    if !models::chapters::is_open(&mut conn, *chapter_id).await? {
        authorize(
            &mut conn,
            Act::ViewMaterial,
            user_id,
            Res::Course(chapter.course_id),
        )
        .await?;
    }
    let chapter_pages: Vec<Page> = models::pages::get_course_pages_by_chapter_id_and_visibility(
        &mut conn,
        *chapter_id,
        PageVisibility::Public,
    )
    .await?;
    let chapter_pages =
        models::pages::filter_course_material_pages(&mut conn, user_id, chapter_pages).await?;
    token.authorized_ok(web::Json(chapter_pages))
}

/**
GET `/api/v0/course-material/chapters/:chapter_id/exercises` - Returns a list of pages and its exercises in chapter.
*/
#[utoipa::path(
    get,
    path = "/{chapter_id}/exercises",
    operation_id = "getCourseMaterialChapterPagesWithExercises",
    tag = "course-material-chapters",
    params(
        ("chapter_id" = Uuid, Path, description = "Chapter id")
    ),
    responses(
        (status = 200, description = "Chapter pages with exercises", body = Vec<PageWithExercises>)
    )
)]
#[instrument(skip(pool))]
async fn get_chapters_exercises(
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<PageWithExercises>>> {
    let mut conn = pool.acquire().await?;
    let user_id = auth.map(|u| u.id);
    let chapter = models::chapters::get_chapter(&mut conn, *chapter_id).await?;
    let token = authorize_access_to_course_material(&mut conn, user_id, chapter.course_id).await?;
    if !models::chapters::is_open(&mut conn, *chapter_id).await? {
        authorize(
            &mut conn,
            Act::ViewMaterial,
            user_id,
            Res::Course(chapter.course_id),
        )
        .await?;
    }
    let can_view_hidden_pages = if let Some(user_id) = user_id {
        authorize(
            &mut conn,
            Act::ViewMaterial,
            Some(user_id),
            Res::Course(chapter.course_id),
        )
        .await
        .is_ok()
    } else {
        false
    };

    let chapter_pages_with_exercises =
        models::pages::get_chapters_pages_with_exercises(&mut conn, *chapter_id).await?;
    let chapter_pages_with_exercises = chapter_pages_with_exercises
        .into_iter()
        .filter(|page_with_exercises| can_view_hidden_pages || !page_with_exercises.page.hidden)
        .collect();
    let chapter_pages_with_exercises = models::pages::filter_course_material_pages_with_exercises(
        &mut conn,
        user_id,
        chapter_pages_with_exercises,
    )
    .await?;
    token.authorized_ok(web::Json(chapter_pages_with_exercises))
}

/**
GET `/api/v0/course-material/chapters/:chapter_id/pages-exclude-mainfrontpage` - Returns a list of pages in chapter mainfrontpage excluded.
*/
#[utoipa::path(
    get,
    path = "/{chapter_id}/pages-exclude-mainfrontpage",
    operation_id = "getCourseMaterialChapterPagesExcludingFrontPage",
    tag = "course-material-chapters",
    params(
        ("chapter_id" = Uuid, Path, description = "Chapter id")
    ),
    responses(
        (status = 200, description = "Visible chapter pages without main front page", body = Vec<Page>)
    )
)]
#[instrument(skip(pool))]
async fn get_chapters_pages_without_main_frontpage(
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<Page>>> {
    let mut conn = pool.acquire().await?;
    let user_id = auth.map(|u| u.id);
    let chapter = models::chapters::get_chapter(&mut conn, *chapter_id).await?;
    let token = authorize_access_to_course_material(&mut conn, user_id, chapter.course_id).await?;
    if !models::chapters::is_open(&mut conn, *chapter_id).await? {
        authorize(
            &mut conn,
            Act::ViewMaterial,
            user_id,
            Res::Course(chapter.course_id),
        )
        .await?;
    }
    let chapter_pages =
        models::pages::get_chapters_visible_pages_exclude_main_frontpage(&mut conn, *chapter_id)
            .await?;
    let chapter_pages =
        models::pages::filter_course_material_pages(&mut conn, user_id, chapter_pages).await?;
    token.authorized_ok(web::Json(chapter_pages))
}

/**
GET `/api/v0/course-material/chapters/:chapter_id/lock-preview` - Preview lock chapter

Returns information about unreturned exercises in the chapter before locking.
**/
#[utoipa::path(
    get,
    path = "/{chapter_id}/lock-preview",
    operation_id = "getCourseMaterialChapterLockPreview",
    tag = "course-material-chapters",
    params(
        ("chapter_id" = Uuid, Path, description = "Chapter id")
    ),
    responses(
        (status = 200, description = "Chapter lock preview", body = ChapterLockPreview)
    )
)]
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
#[utoipa::path(
    post,
    path = "/{chapter_id}/lock",
    operation_id = "lockCourseMaterialChapter",
    tag = "course-material-chapters",
    params(
        ("chapter_id" = Uuid, Path, description = "Chapter id")
    ),
    responses(
        (status = 200, description = "Updated chapter locking status", body = user_chapter_locking_statuses::UserChapterLockingStatus)
    )
)]
#[instrument(skip(pool))]
async fn lock_chapter(
    chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<user_chapter_locking_statuses::UserChapterLockingStatus>> {
    let mut conn = pool.acquire().await?;
    let chapter = models::chapters::get_chapter(&mut conn, *chapter_id).await?;
    let token =
        authorize_access_to_course_material(&mut conn, Some(user.id), chapter.course_id).await?;

    let course = models::courses::get_course(&mut conn, chapter.course_id).await?;

    if !course.chapter_locking_enabled {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Chapter locking is not enabled for this course.".to_string(),
            None,
        ));
    }

    let previous_chapters =
        models::chapters::get_previous_chapters_in_module(&mut conn, *chapter_id).await?;

    let mut tx = conn.begin().await?;

    let current_status = user_chapter_locking_statuses::get_or_init_status(
        &mut tx,
        user.id,
        *chapter_id,
        Some(chapter.course_id),
        Some(course.chapter_locking_enabled),
    )
    .await?;

    match current_status {
        None | Some(ChapterLockingStatus::NotUnlockedYet) => {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "This chapter is locked. Complete previous chapters first.".to_string(),
                None,
            ));
        }
        Some(ChapterLockingStatus::CompletedAndLocked) => {
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

    for prev_chapter in previous_chapters {
        let prev_status = user_chapter_locking_statuses::get_or_init_status(
            &mut tx,
            user.id,
            prev_chapter.id,
            Some(chapter.course_id),
            Some(course.chapter_locking_enabled),
        )
        .await?;

        match prev_status {
            None
            | Some(ChapterLockingStatus::Unlocked)
            | Some(ChapterLockingStatus::NotUnlockedYet) => {
                return Err(ControllerError::new(
                    ControllerErrorType::BadRequest,
                    format!(
                        "You must complete previous chapters in order. Please complete chapter \"{}\" first.",
                        prev_chapter.name
                    ),
                    None,
                ));
            }
            Some(ChapterLockingStatus::CompletedAndLocked) => {
                // Previous chapter is completed, continue
            }
        }
    }

    models::chapters::move_chapter_exercises_to_manual_review(
        &mut tx,
        *chapter_id,
        user.id,
        chapter.course_id,
    )
    .await?;

    let status = user_chapter_locking_statuses::complete_and_lock_chapter(
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
