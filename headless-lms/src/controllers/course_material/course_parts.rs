//! Controllers for requests starting with `/api/v0/course_material/course-parts`.
use std::str::FromStr;

use crate::controllers::ApplicationResult;
use crate::models::pages::Page;
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

/**
GET `/api/v0/course-material/course-parts/:course_part_id/pages` - Returns a list of pages in course part.
# Example
```json
[
  {
    "id": "cfa0b214-f225-464b-a326-cc4e7d865bb4",
    "created_at": "2021-05-25T06:35:52.881313",
    "updated_at": "2021-05-25T06:35:52.881313",
    "course_id": "8f605161-125b-449b-a443-c62ffc1b077f",
    "course_part_id": "b25f849a-5b7b-4718-b0d7-88f435e2393d",
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
    "course_part_id": "b25f849a-5b7b-4718-b0d7-88f435e2393d",
    "url_path": "/part-1/asdasdasd",
    "title": "asdasdasd",
    "deleted": false,
    "content": []
  },
]
```
*/
async fn get_course_parts_pages(
    request_course_part_id: web::Path<String>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Vec<Page>>> {
    let course_part_id = Uuid::from_str(&request_course_part_id)?;

    let course_part_pages: Vec<Page> =
        crate::models::pages::course_part_pages(pool.get_ref(), course_part_id).await?;
    Ok(Json(course_part_pages))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_course_parts_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{course_part_id}/pages",
        web::get().to(get_course_parts_pages),
    );
}
