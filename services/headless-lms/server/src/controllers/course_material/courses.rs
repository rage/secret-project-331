//! Controllers for requests starting with `/api/v0/course-material/courses`.

use chrono::Utc;
use models::{
    chapters::{ChapterStatus, ChapterWithStatus},
    course_instances::CourseInstance,
    courses,
    courses::Course,
    feedback,
    feedback::NewFeedback,
    pages::{CoursePageWithUserData, Page, PageSearchRequest, PageSearchResult},
    proposed_page_edits::{self, NewProposedPageEdits},
    user_course_settings::UserCourseSettings,
};

use crate::controllers::prelude::*;

/**
GET `/api/v0/course-material/courses/:course_id` - Get course.
*/
#[cfg_attr(doc, generated_doc)]
#[instrument(skip(pool))]
async fn get_course(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Course>> {
    let mut conn = pool.acquire().await?;
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    Ok(web::Json(course))
}

/**
GET `/:course_slug/page-by-path/...` - Returns a course page by path
# Example
GET /api/v0/course-material/courses/introduction-to-everything/page-by-path//part-2/hello-world
*/
#[cfg_attr(doc, generated_doc)]
#[instrument(skip(pool))]
async fn get_course_page_by_path(
    params: web::Path<(String, String)>,
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<CoursePageWithUserData>> {
    let mut conn = pool.acquire().await?;
    let (course_slug, raw_page_path) = params.into_inner();
    let path = if raw_page_path.starts_with('/') {
        raw_page_path
    } else {
        format!("/{}", raw_page_path)
    };

    let page_with_user_data = models::pages::get_page_with_user_data_by_path(
        &mut conn,
        user.map(|u| u.id),
        &course_slug,
        &path,
    )
    .await?;

    Ok(web::Json(page_with_user_data))
}

/**
GET `/api/v0/course-material/courses/:course_id/current-instance` - Returns the instance of a course for the current user, if there is one.
*/
#[cfg_attr(doc, generated_doc)]
#[instrument(skip(pool))]
async fn get_current_course_instance(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<Option<CourseInstance>>> {
    let mut conn = pool.acquire().await?;
    if let Some(user) = user {
        let instance = models::course_instances::current_course_instance_of_user(
            &mut conn, user.id, *course_id,
        )
        .await?;
        Ok(web::Json(instance))
    } else {
        Ok(web::Json(None))
    }
}

/**
GET `/api/v0/course-material/courses/:course_id/course-instances` - Returns all course instances for given course id.
*/
#[cfg_attr(doc, generated_doc)]
async fn get_course_instances(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<CourseInstance>>> {
    let mut conn = pool.acquire().await?;
    let instances =
        models::course_instances::get_course_instances_for_course(&mut conn, *course_id).await?;
    Ok(web::Json(instances))
}

/**
GET `/api/v0/course-material/courses/:course_id/pages` - Returns a list of pages in a course.
*/
#[cfg_attr(doc, generated_doc)]
#[instrument(skip(pool))]
async fn get_course_pages(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<Page>>> {
    let mut conn = pool.acquire().await?;
    let pages: Vec<Page> = models::pages::course_pages(&mut conn, *course_id).await?;
    Ok(web::Json(pages))
}

/**
GET `/api/v0/course-material/courses/:course_id/chapters` - Returns a list of chapters in a course.
*/
#[cfg_attr(doc, generated_doc)]
#[instrument(skip(pool))]
async fn get_chapters(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<ChapterWithStatus>>> {
    let mut conn = pool.acquire().await?;
    let chapters = models::chapters::course_chapters(&mut conn, *course_id).await?;
    let chapters = chapters
        .into_iter()
        .map(|chapter| {
            let open = chapter.opens_at.map(|o| o <= Utc::now()).unwrap_or(true);
            let status = if open {
                ChapterStatus::Open
            } else {
                ChapterStatus::Closed
            };
            ChapterWithStatus {
                id: chapter.id,
                created_at: chapter.created_at,
                updated_at: chapter.updated_at,
                name: chapter.name,
                course_id: chapter.course_id,
                deleted_at: chapter.deleted_at,
                chapter_number: chapter.chapter_number,
                front_page_id: chapter.front_page_id,
                opens_at: chapter.opens_at,
                status,
            }
        })
        .collect();
    Ok(web::Json(chapters))
}

/**
GET `/api/v0/course-material/courses/:course_id/user-settings` - Returns user settings for the current course.
*/
#[cfg_attr(doc, generated_doc)]
async fn get_user_course_settings(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<Option<UserCourseSettings>>> {
    let mut conn = pool.acquire().await?;
    if let Some(user) = user {
        let settings = models::user_course_settings::get_user_course_settings_by_course_id(
            &mut conn, user.id, *course_id,
        )
        .await?;
        Ok(web::Json(settings))
    } else {
        Ok(web::Json(None))
    }
}

/**
POST `/api/v0/course-material/courses/:course_id/search-pages-with-phrase` - Returns a list of pages given a search query.

Provided words are supposed to appear right after each other in the source document.

# Example

Request:

```http
POST /api/v0/course-material/courses/1a68e8b0-d151-4c0e-9307-bb154e9d2be1/search-pages-with-phrase HTTP/1.1
Content-Type: application/json

{
  "query": "Everything"
}
```
*/
#[cfg_attr(doc, generated_doc)]
#[instrument(skip(pool))]
async fn search_pages_with_phrase(
    course_id: web::Path<Uuid>,
    payload: web::Json<PageSearchRequest>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<PageSearchResult>>> {
    let mut conn = pool.acquire().await?;
    let res =
        models::pages::get_page_search_results_for_phrase(&mut conn, *course_id, &*payload).await?;
    Ok(web::Json(res))
}

/**
POST `/api/v0/course-material/courses/:course_id/search-pages-with-words` - Returns a list of pages given a search query.

Provided words can appear in any order in the source document.

# Example

Request:

```http
POST /api/v0/course-material/courses/1a68e8b0-d151-4c0e-9307-bb154e9d2be1/search-pages-with-words HTTP/1.1
Content-Type: application/json

{
  "query": "Everything"
}
```
*/
#[cfg_attr(doc, generated_doc)]
#[instrument(skip(pool))]
async fn search_pages_with_words(
    course_id: web::Path<Uuid>,
    payload: web::Json<PageSearchRequest>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<PageSearchResult>>> {
    let mut conn = pool.acquire().await?;
    let res =
        models::pages::get_page_search_results_for_words(&mut conn, *course_id, &*payload).await?;
    Ok(web::Json(res))
}

/**
POST `/api/v0/course-material/courses/:course_id/feedback` - Creates new feedback.
*/
#[cfg_attr(doc, generated_doc)]
pub async fn feedback(
    course_id: web::Path<Uuid>,
    new_feedback: web::Json<Vec<NewFeedback>>,
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<Uuid>>> {
    let mut conn = pool.acquire().await?;
    let fs = new_feedback.into_inner();

    // validate
    for f in &fs {
        if f.feedback_given.len() > 1000 {
            return Err(ControllerError::BadRequest(
                "Feedback given too long: max 1000".to_string(),
            ));
        }
        if f.related_blocks.len() > 100 {
            return Err(ControllerError::BadRequest(
                "Too many related blocks: max 100".to_string(),
            ));
        }
        for block in &f.related_blocks {
            if block.text.as_ref().map(|t| t.len()).unwrap_or_default() > 10000 {
                return Err(ControllerError::BadRequest(
                    "Block text too long: max 10000".to_string(),
                ));
            }
        }
    }

    let mut tx = conn.begin().await?;
    let user_id = user.as_ref().map(|u| u.id);
    let mut ids = vec![];
    for f in fs {
        let id = feedback::insert(&mut tx, user_id, *course_id, f).await?;
        ids.push(id);
    }
    tx.commit().await?;
    Ok(web::Json(ids))
}

/**
POST `/api/v0/course-material/courses/:course_slug/edit` - Creates a new edit proposal.
*/
#[cfg_attr(doc, generated_doc)]
async fn propose_edit(
    course_slug: web::Path<String>,
    edits: web::Json<NewProposedPageEdits>,
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let course = courses::get_course_by_slug(&mut conn, course_slug.as_str()).await?;
    let (id, _) = proposed_page_edits::insert(
        &mut conn,
        course.id,
        user.map(|u| u.id),
        &edits.into_inner(),
    )
    .await?;
    Ok(web::Json(id))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_id}", web::get().to(get_course))
        .route("/{course_id}/chapters", web::get().to(get_chapters))
        .route(
            "/{course_id}/course-instances",
            web::get().to(get_course_instances),
        )
        .route(
            "/{course_id}/current-instance",
            web::get().to(get_current_course_instance),
        )
        .route("/{course_id}/feedback", web::post().to(feedback))
        .route(
            "/{course_id}/page-by-path/{url_path:.*}",
            web::get().to(get_course_page_by_path),
        )
        .route("/{course_id}/pages", web::get().to(get_course_pages))
        .route(
            "/{course_id}/search-pages-with-phrase",
            web::post().to(search_pages_with_phrase),
        )
        .route(
            "/{course_id}/search-pages-with-words",
            web::post().to(search_pages_with_words),
        )
        .route(
            "/{course_id}/user-settings",
            web::get().to(get_user_course_settings),
        )
        .route("/{course_id}/propose-edit", web::post().to(propose_edit));
}
