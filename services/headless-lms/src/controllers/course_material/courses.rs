//! Controllers for requests starting with `/api/v0/course-material/courses`.
use crate::{
    controllers::{ControllerError, ControllerResult},
    domain::authorization::AuthUser,
    models::{
        chapters::{ChapterStatus, ChapterWithStatus},
        courses::Course,
        feedback,
        pages::{CoursePageWithUserData, PageSearchRequest},
        user_course_settings::UserCourseSettings,
    },
    models::{course_instances::CourseInstance, courses, pages::PageSearchResult},
    models::{feedback::NewFeedback, pages::Page},
};
use actix_web::web::{self, Json, ServiceConfig};
use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

/**
GET `/api/v0/main-frontend/courses/:course_id` - Get course.
*/
#[instrument(skip(pool))]
async fn get_course(
    request_course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<Json<Course>> {
    let mut conn = pool.acquire().await?;
    let course = crate::models::courses::get_course(&mut conn, *request_course_id).await?;
    Ok(Json(course))
}

/**
GET `/:course_slug/page-by-path/...` - Returns a course page by path
# Example

GET /api/v0/course-material/courses/introduction-to-everything/page-by-path//part-2/hello-world


```json
{
  "id": "d32cc3cd-adfe-456a-a25f-032ee02db4c2",
  "created_at": "2021-03-12T09:20:16.381347",
  "updated_at": "2021-03-19T15:12:33.603977",
  "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
  "content": [],
  "url_path": "/part-2/hello-world",
  "title": "Hello world!",
  "deleted_at": null,
  "chapter_id": "2495ffa3-7ea9-4615-baa5-828023688c79"
}
```
*/
#[instrument(skip(pool))]
async fn get_course_page_by_path(
    params: web::Path<(String, String)>,
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
) -> ControllerResult<Json<CoursePageWithUserData>> {
    let mut conn = pool.acquire().await?;
    let (course_slug, raw_page_path) = params.into_inner();
    let path = if raw_page_path.starts_with('/') {
        raw_page_path
    } else {
        format!("/{}", raw_page_path)
    };

    let page_with_user_data =
        crate::models::pages::get_page_with_user_data_by_path(&mut conn, user, course_slug, &path)
            .await?;

    Ok(Json(page_with_user_data))
}

/**
GET `/api/v0/course-material/courses/:course_id/current-instance` - Returns the instance of a course for the current user, if there is one.

# Example
```json
{
  "id": "e051ddb5-2128-4215-adda-ebd74a0ea46b",
  "created_at": "2021-06-28T00:21:11.780420Z",
  "updated_at": "2021-06-28T00:21:11.780420Z",
  "deleted_at": null,
  "course_id": "b8077bc2-0816-4c05-a651-d2d75d697fdf",
  "starts_at": null,
  "ends_at": null,
  "name": null,
  "description": null,
  "variant_status": "Active"
}
```
*/
#[instrument(skip(pool))]
async fn get_current_course_instance(
    pool: web::Data<PgPool>,
    request_course_id: web::Path<Uuid>,
    user: Option<AuthUser>,
) -> ControllerResult<Json<Option<CourseInstance>>> {
    let mut conn = pool.acquire().await?;
    if let Some(user) = user {
        let instance = crate::models::course_instances::current_course_instance_of_user(
            &mut conn,
            user.id,
            *request_course_id,
        )
        .await?;
        Ok(Json(instance))
    } else {
        Ok(Json(None))
    }
}

/**
GET `/api/v0/course-material/courses/:course_id/course-instances` - Returns all course instances for given course id.

# Example
```json
[
  {
    "id": "e051ddb5-2128-4215-adda-ebd74a0ea46b",
    "created_at": "2021-06-28T00:21:11.780420Z",
    "updated_at": "2021-06-28T00:21:11.780420Z",
    "deleted_at": null,
    "course_id": "b8077bc2-0816-4c05-a651-d2d75d697fdf",
    "starts_at": null,
    "ends_at": null,
    "name": null,
    "description": null,
    "variant_status": "Active"
  }
]
```
*/
async fn get_course_instances(
    pool: web::Data<PgPool>,
    request_course_id: web::Path<Uuid>,
) -> ControllerResult<Json<Vec<CourseInstance>>> {
    let mut conn = pool.acquire().await?;
    let instances = crate::models::course_instances::get_course_instances_for_course(
        &mut conn,
        *request_course_id,
    )
    .await?;
    Ok(Json(instances))
}

/**
GET `/api/v0/course-material/courses/:course_id/pages` - Returns a list of pages in a course.
# Example
```json
[
    {
        "id": "86ac4f0a-ccca-464e-89f4-ed58969b1103",
        "created_at": "2021-03-05T22:50:47.920120",
        "updated_at": "2021-03-05T22:50:47.920120",
        "course_id": "a90c39f8-5d23-461f-8375-0b05a55d7ac1",
        "content": [
            {
                "id": "55be197d-4145-444a-bc1f-ee1091c47ad9"
            }
        ],
        "url_path": "/part-1/01-loops-and-variables",
        "title": "Loops and Variables",
        "deleted_at": null
    }
]
```
*/
#[instrument(skip(pool))]
async fn get_course_pages(
    request_course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<Vec<Page>>> {
    let mut conn = pool.acquire().await?;
    let pages: Vec<Page> =
        crate::models::pages::course_pages(&mut conn, *request_course_id).await?;
    Ok(Json(pages))
}

/**
GET `/api/v0/course-material/courses/:course_id/chapters` - Returns a list of chapters in a course.
# Example
```json
[
  {
    "id": "d332f3d9-39a5-4a18-80f4-251727693c37",
    "created_at": "2021-05-15T16:49:18.689393",
    "updated_at": "2021-05-15T16:49:18.689393",
    "name": "The Basics",
    "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
    "deleted_at": null,
    "chapter_number": 1,
    "front_page_id": null
    "opens_at": null
    "status": "open"
  }
]
```
*/
#[instrument(skip(pool))]
async fn get_chapters(
    request_course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<Vec<ChapterWithStatus>>> {
    let mut conn = pool.acquire().await?;
    let chapters = crate::models::chapters::course_chapters(&mut conn, *request_course_id).await?;
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
    Ok(Json(chapters))
}

/**
GET `/api/v0/course-material/courses/:course_id/user-settings` - Returns user settings for the current course.
*/
async fn get_user_course_settings(
    pool: web::Data<PgPool>,
    request_course_id: web::Path<Uuid>,
    user: Option<AuthUser>,
) -> ControllerResult<Json<Option<UserCourseSettings>>> {
    let mut conn = pool.acquire().await?;
    if let Some(user) = user {
        let settings = crate::models::user_course_settings::get_user_course_settings_by_course_id(
            &mut conn,
            user.id,
            *request_course_id,
        )
        .await?;
        Ok(Json(settings))
    } else {
        Ok(Json(None))
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

Response:

```json
[
  {
    "id": "c89bd5b3-5f2b-4326-834a-db9f20bdaf1b",
    "title": "Introduction to everything",
    "rank": 0.6079271,
    "ts_headline": null,
    "url_path": "/"
  },
  {
    "id": "1d744426-27da-4821-80ab-7fd1fcd727f8",
    "title": "Welcome to Introduction to Everything",
    "rank": 0.6079271,
    "ts_headline": null,
    "url_path": "/"
  },
  {
    "id": "1c75eabe-8e19-456d-b107-f8e87b395c76",
    "title": "Chapter One",
    "rank": 0.24317084,
    "ts_headline": "<b>Everything</b> is a big topic",
    "url_path": "/chapter-1"
  },
  {
    "id": "c2060330-cea0-46ad-94f9-9be9858adab5",
    "title": "In the second chapter...",
    "rank": 0.24317084,
    "ts_headline": "<b>Everything</b> is a big topic.",
    "url_path": "/chapter-2"
  }
]
```
*/
#[instrument(skip(pool))]
async fn search_pages_with_phrase(
    request_course_id: web::Path<Uuid>,
    payload: web::Json<PageSearchRequest>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<Vec<PageSearchResult>>> {
    let mut conn = pool.acquire().await?;
    let res = crate::models::pages::get_page_search_results_for_phrase(
        &mut conn,
        *request_course_id,
        &*payload,
    )
    .await?;
    Ok(Json(res))
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

Response:

```json
[
  {
    "id": "c89bd5b3-5f2b-4326-834a-db9f20bdaf1b",
    "title": "Introduction to everything",
    "rank": 0.6079271,
    "ts_headline": null,
    "url_path": "/"
  },
  {
    "id": "1d744426-27da-4821-80ab-7fd1fcd727f8",
    "title": "Welcome to Introduction to Everything",
    "rank": 0.6079271,
    "ts_headline": null,
    "url_path": "/"
  },
  {
    "id": "1c75eabe-8e19-456d-b107-f8e87b395c76",
    "title": "Chapter One",
    "rank": 0.24317084,
    "ts_headline": "<b>Everything</b> is a big topic",
    "url_path": "/chapter-1"
  },
  {
    "id": "c2060330-cea0-46ad-94f9-9be9858adab5",
    "title": "In the second chapter...",
    "rank": 0.24317084,
    "ts_headline": "<b>Everything</b> is a big topic.",
    "url_path": "/chapter-2"
  }
]
```
*/
#[instrument(skip(pool))]
async fn search_pages_with_words(
    request_course_id: web::Path<Uuid>,
    payload: web::Json<PageSearchRequest>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<Vec<PageSearchResult>>> {
    let mut conn = pool.acquire().await?;
    let res = crate::models::pages::get_page_search_results_for_words(
        &mut conn,
        *request_course_id,
        &*payload,
    )
    .await?;
    Ok(Json(res))
}

/**
POST `/api/v0/course-material/courses/:course_slug/feedback` - Creates new feedback.
*/
pub async fn feedback(
    course_slug: web::Path<String>,
    new_feedback: web::Json<NewFeedback>,
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
) -> ControllerResult<String> {
    let mut conn = pool.acquire().await?;
    let f = new_feedback.into_inner();

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

    let course = courses::get_course_by_slug(&mut conn, course_slug.as_str()).await?;
    let id = feedback::insert(&mut conn, user.map(|u| u.id), course.id, f).await?;
    Ok(id.to_string())
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_courses_routes(cfg: &mut ServiceConfig) {
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
        );
}
