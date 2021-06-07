//! Controllers for requests starting with `/api/v0/cms/course_parts`.

use crate::{
    controllers::ApplicationResult,
    models::course_parts::{CoursePart, CoursePartUpdate, NewCoursePart},
};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

/**
POST `/api/v0/cms/course-parts` - Create a new course part.
# Example

Request:
```http
POST /api/v0/cms/course-parts HTTP/1.1
Content-Type: application/json

{
    "name": "The Basics",
    "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
    "part_number": 1,
    "page_id": null
}
```

Response:
```json
{
  "id": "037ec5fa-87e0-4031-be65-3790fee92954",
  "created_at": "2021-04-28T16:33:42.670935",
  "updated_at": "2021-04-28T16:33:42.670935",
  "name": "The Basics",
  "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
  "deleted_at": null,
  "part_number": 2,
  "page_id": null
}
```
*/
async fn post_new_course_part(
    pool: web::Data<PgPool>,
    payload: web::Json<NewCoursePart>,
) -> ApplicationResult<Json<CoursePart>> {
    let new_course = payload.0;
    let course_part = crate::models::course_parts::insert_course_part(&pool, new_course).await?;
    Ok(Json(course_part))
}

/**
DELETE `/api/v0/cms/courses-parts/:course_part_id` - Delete a course part.
# Example

```json
{
  "id": "037ec5fa-87e0-4031-be65-3790fee92954",
  "created_at": "2021-04-28T16:33:42.670935",
  "updated_at": "2021-04-28T16:33:42.670935",
  "name": "The Basics",
  "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
  "deleted_at": "2021-04-28T16:33:42.670935",
  "part_number": 1,
  "page_id": "0ebba931-b027-4154-8274-2afb00d79306"
}
```
*/
async fn delete_course_part(
    request_course_part_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<CoursePart>> {
    let course_part =
        crate::models::course_parts::delete_course_part(pool.get_ref(), *request_course_part_id)
            .await?;
    Ok(Json(course_part))
}

/**
PUT `/api/v0/cms/course-parts/:course_part_id` - Update course part.
# Example

Request:
```http
PUT /api/v0/cms/course-parts/d332f3d9-39a5-4a18-80f4-251727693c37  HTTP/1.1
Content-Type: application/json

{
    "name": "The Basics",
    "part_number": 2,
    "page_id": "0ebba931-b027-4154-8274-2afb00d79306"
}

```

Response:
```json
{
  "id": "d332f3d9-39a5-4a18-80f4-251727693c37",
  "created_at": "2021-04-28T16:11:47.477850",
  "updated_at": "2021-04-28T16:53:14.896121",
  "name": "The Basics",
  "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
  "deleted_at": null,
  "part_number": 2,
  "page_id": "0ebba931-b027-4154-8274-2afb00d79306"
}
```
*/
async fn update_course_part(
    payload: web::Json<CoursePartUpdate>,
    request_course_part_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<CoursePart>> {
    let course_update = payload.0;
    let course_part = crate::models::course_parts::update_course_part(
        pool.get_ref(),
        *request_course_part_id,
        course_update,
    )
    .await?;
    Ok(Json(course_part))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_course_parts_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(post_new_course_part))
        .route("/{course_part_id}", web::delete().to(delete_course_part))
        .route("/{course_part_id}", web::put().to(update_course_part));
}
