//! Controllers for requests starting with `/api/v0/course_material/chapters`.

use crate::controllers::ApplicationResult;
use crate::models::pages::Page;
use crate::models::pages::PageWithExercises;
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

/**
GET `/api/v0/course-material/chapters/:chapter_id/pages` - Returns a list of pages in course part.
# Example
```json
[
  {
    "id": "cfa0b214-f225-464b-a326-cc4e7d865bb4",
    "created_at": "2021-05-25T06:35:52.881313",
    "updated_at": "2021-05-25T06:35:52.881313",
    "course_id": "8f605161-125b-449b-a443-c62ffc1b077f",
    "chapter_id": "b25f849a-5b7b-4718-b0d7-88f435e2393d",
    "url_path": "/part-1",
    "title": "123",
    "deleted": false,
    "content": [
      {
        "name": "moocfi/pages-in-part",
        "isValid": true,
        "clientId": "c68f55ae-65c4-4e9b-aded-0b52e36e344a",
        "attributes": {
          "hidden": false
        },
        "innerBlocks": []
      },
      {
        "name": "moocfi/exercises-in-part",
        "isValid": true,
        "clientId": "415ecc4c-a5c6-410e-a43f-c14b8ee910ea",
        "attributes": {
          "hidden": false
        },
        "innerBlocks": []
      }
    ]
  },
  {
    "id": "2248c59e-ef3b-41d7-b5dd-0588255ac9ae",
    "created_at": "2021-05-25T06:35:56.819750",
    "updated_at": "2021-05-25T06:35:56.819750",
    "course_id": "8f605161-125b-449b-a443-c62ffc1b077f",
    "chapter_id": "b25f849a-5b7b-4718-b0d7-88f435e2393d",
    "url_path": "/part-1/asdasdasd",
    "title": "asdasdasd",
    "deleted": false,
    "content": []
  },
]
```
*/
#[instrument(skip(pool))]
async fn get_chapters_pages(
    request_chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Vec<Page>>> {
    let mut conn = pool.acquire().await?;
    let chapter_pages: Vec<Page> =
        crate::models::pages::chapter_pages(&mut conn, *request_chapter_id).await?;
    Ok(Json(chapter_pages))
}

/**
GET `/api/v0/course-material/chapters/:chapter_id/exercises` - Returns a list of pages and its exercises in course part.
# Example
```json
[
  {
    "id": "33866d5d-ec23-4a0d-91e2-59ada15341fe",
    "created_at": "2021-05-31T08:42:22.116641",
    "updated_at": "2021-05-31T08:42:41.652250",
    "course_id": "8f605161-125b-449b-a443-c62ffc1b077f",
    "chapter_id": "b25f849a-5b7b-4718-b0d7-88f435e2393d",
    "content": [
      {
        "name": "core/paragraph",
        "isValid": true,
        "clientId": "b428e394-2f25-4cd8-a2d6-ff26525e614d",
        "attributes": {
          "content": "Hi Exercise",
          "dropCap": false
        },
        "innerBlocks": []
      },
      {
        "name": "moocfi/exercise",
        "isValid": true,
        "clientId": "2638a02b-1cef-490a-855f-d566b9cfac77",
        "attributes": {
          "id": "4beec1b7-5f37-4c5b-a654-7acc9ad6e90b"
        },
        "innerBlocks": []
      }
    ],
    "url_path": "/part-1/abba",
    "title": "abba",
    "deleted_at": null,
    "exercises": [
      {
        "id": "4beec1b7-5f37-4c5b-a654-7acc9ad6e90b",
        "created_at": "2021-05-31T08:42:41.652250",
        "updated_at": "2021-05-31T08:42:41.652250",
        "course_id": "8f605161-125b-449b-a443-c62ffc1b077f",
        "deleted_at": null,
        "name": "Hello Exercise",
        "deadline": null,
        "page_id": "33866d5d-ec23-4a0d-91e2-59ada15341fe",
        "score_maximum": 1
      }
    ]
  }
]
```
*/
#[instrument(skip(pool))]
async fn get_chapters_exercises(
    request_chapter_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Vec<PageWithExercises>>> {
    let mut conn = pool.acquire().await?;
    let chapter_pages_with_exercises =
        crate::models::pages::get_chapters_pages_with_exercises(&mut conn, *request_chapter_id)
            .await?;
    Ok(Json(chapter_pages_with_exercises))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_chapters_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{chapter_id}/pages", web::get().to(get_chapters_pages))
        .route(
            "/{chapter_id}/exercises",
            web::get().to(get_chapters_exercises),
        );
}
