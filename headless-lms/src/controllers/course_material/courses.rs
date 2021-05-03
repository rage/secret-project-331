//! Controllers for requests starting with `/api/v0/course-material/courses`.
use crate::{controllers::ApplicationResult, models::pages::Page};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use std::str::FromStr;
use uuid::Uuid;

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
  "deleted": false,
  "course_part_id": "2495ffa3-7ea9-4615-baa5-828023688c79"
}
```
*/
async fn get_course_page_by_path(
    params: web::Path<(String, String)>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Page>> {
    let (course_slug, raw_page_path) = params.into_inner();
    let path = if raw_page_path.starts_with('/') {
        raw_page_path
    } else {
        format!("/{}", raw_page_path)
    };

    let page = crate::models::pages::get_page_by_path(pool.get_ref(), course_slug, &path).await?;
    Ok(Json(page))
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
        "deleted": false
    }
]
```
*/
async fn get_course_pages(
    request_course_id: web::Path<String>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Vec<Page>>> {
    let course_id = Uuid::from_str(&request_course_id)?;

    let pages: Vec<Page> = crate::models::pages::course_pages(pool.get_ref(), course_id).await?;
    Ok(Json(pages))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_courses_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{course_id}/page-by-path/{url_path:.*}",
        web::get().to(get_course_page_by_path),
    )
    .route("/{course_id}/pages", web::get().to(get_course_pages));
}
