//! Controllers for requests starting with `/api/v0/courses`.
use super::ApplicationError;
use crate::models::{courses::Course, pages::Page};
use actix_web::web::ServiceConfig;
use actix_web::{
    web::{self, Json},
    Result,
};
use sqlx::PgPool;
use std::str::FromStr;
use uuid::Uuid;

/**
GET `/api/v0/courses` - Returns a list of all courses.

# Example
```json
[
    {
        "id": "a90c39f8-5d23-461f-8375-0b05a55d7ac1",
        "created_at": "2021-03-05T22:26:59.067294",
        "updated_at": "2021-03-05T22:26:59.067294",
        "name": "Introduction to Programming",
        "organization_id": "c6fbb0fe-b418-4156-8319-fc761d482dcb",
        "deleted": false
    }
]
```
 */
async fn get_all_courses(pool: web::Data<PgPool>) -> Result<Json<Vec<Course>>> {
    let courses = crate::models::courses::all_courses(pool.get_ref())
        .await
        .map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
    Ok(Json(courses))
}

/**
GET `/api/v0/courses/:course_id/pages` - Returns a list of pages in a course.
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
) -> Result<Json<Vec<Page>>> {
    let course_id = Uuid::from_str(&request_course_id)
        .map_err(|original_error| ApplicationError::BadRequest(original_error.to_string()))?;

    let pages: Vec<Page> = crate::models::pages::course_pages(pool.get_ref(), course_id)
        .await
        .map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
    Ok(Json(pages))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_courses_routes(cfg: &mut ServiceConfig) {
    cfg.route("/", web::get().to(get_all_courses))
        .route("/courses", web::get().to(get_all_courses))
        .route("/{course_id}/pages", web::get().to(get_course_pages));
}
