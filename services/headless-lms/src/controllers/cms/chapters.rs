//! Controllers for requests starting with `/api/v0/cms/chapters`.
use std::str::FromStr;

use crate::{
    controllers::ApplicationResult,
    domain::authorization::AuthUser,
    models::chapters::{Chapter, ChapterUpdate, NewChapter},
};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

/**
POST `/api/v0/cms/chapters` - Create a new course part.
# Example

Request:
```http
POST /api/v0/cms/chapters HTTP/1.1
Content-Type: application/json

{
    "name": "The Basics",
    "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
    "chapter_number": 1,
    "front_page_id": null
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
  "chapter_number": 1,
  "front_page_id": null
}
```
*/
#[instrument(skip(pool))]
async fn post_new_chapter(
    pool: web::Data<PgPool>,
    payload: web::Json<NewChapter>,
    user: AuthUser,
) -> ApplicationResult<Json<Chapter>> {
    let mut conn = pool.acquire().await?;
    let new_course = payload.0;
    let chapter = crate::models::chapters::insert_chapter(&mut conn, new_course).await?;
    Ok(Json(chapter))
}

/**
DELETE `/api/v0/cms/courses-parts/:chapter_id` - Delete a course part.
# Example

```json
{
  "id": "037ec5fa-87e0-4031-be65-3790fee92954",
  "created_at": "2021-04-28T16:33:42.670935",
  "updated_at": "2021-04-28T16:33:42.670935",
  "name": "The Basics",
  "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
  "deleted_at": "2021-04-28T16:33:42.670935",
  "chapter_number": 1,
  "front_page_id": "0ebba931-b027-4154-8274-2afb00d79306"
}
```
*/
#[instrument(skip(pool))]
async fn delete_chapter(
    request_chapter_id: web::Path<String>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ApplicationResult<Json<Chapter>> {
    let mut conn = pool.acquire().await?;
    let course_id = Uuid::from_str(&request_chapter_id)?;

    let chapter = crate::models::chapters::delete_chapter(&mut conn, course_id).await?;
    Ok(Json(chapter))
}

/**
PUT `/api/v0/cms/chapters/:chapter_id` - Update course part.
# Example

Request:
```http
PUT /api/v0/cms/chapters/d332f3d9-39a5-4a18-80f4-251727693c37  HTTP/1.1
Content-Type: application/json

{
    "name": "The Basics",
    "chapter_number": 2,
    "front_page_id": "0ebba931-b027-4154-8274-2afb00d79306"
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
  "chapter_number": 2,
  "front_page_id": "0ebba931-b027-4154-8274-2afb00d79306"
}
```
*/
#[instrument(skip(payload, pool))]
async fn update_chapter(
    payload: web::Json<ChapterUpdate>,
    request_chapter_id: web::Path<String>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ApplicationResult<Json<Chapter>> {
    let mut conn = pool.acquire().await?;
    let course_id = Uuid::from_str(&request_chapter_id)?;

    let course_update = payload.0;
    let chapter =
        crate::models::chapters::update_chapter(&mut conn, course_id, course_update).await?;
    Ok(Json(chapter))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_chapters_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(post_new_chapter))
        .route("/{chapter_id}", web::delete().to(delete_chapter))
        .route("/{chapter_id}", web::put().to(update_chapter));
}
