//! Controllers for requests starting with `/api/v0/pages`.
use std::str::FromStr;

use crate::models::pages::{NewPage, Page, PageUpdate, PageWithExercises};
use actix_web::web::ServiceConfig;
use actix_web::{
    web::{self, Json},
    Result,
};
use sqlx::PgPool;
use uuid::Uuid;

use super::ApplicationError;

/**
GET `/api/v0/pages/:page_id` - Get a page with exercises and exercise items by id.

# Example

Request: `GET /api/v0/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02`

Response:
```json
{
  "id": "40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02",
  "created_at": "2021-03-08T20:14:56.216394",
  "updated_at": "2021-03-08T20:14:56.216394",
  "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
  "content": [
    {
      "type": "x"
    }
  ],
  "url_path": "/part-1/hello-world",
  "title": "Hello world!",
  "deleted": false,
  "exercises": [
    {
      "id": "4b841091-caa7-468d-96f0-7ef828bbc757",
      "created_at": "2021-03-08T20:14:56.216394",
      "updated_at": "2021-03-08T20:20:56.261669",
      "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
      "deleted": false,
      "name": "Exercise 1",
      "deadline": null,
      "page_id": "40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02",
      "exercise_items": [
        {
          "id": "55a176f0-d0f8-40a8-a050-101ee6fb29ca",
          "created_at": "2021-03-08T20:14:56.216394",
          "updated_at": "2021-03-08T20:20:56.261669",
          "exercise_id": "4b841091-caa7-468d-96f0-7ef828bbc757",
          "exercise_type": "quiz",
          "assignment": [
            {
              "type": "y"
            }
          ],
          "deleted": false,
          "spec": {
            "has_swag": true
          },
          "spec_file_id": null
        }
      ]
    },
    {
      "id": "2a19fa3a-f105-43e5-a497-b436a88ff861",
      "created_at": "2021-03-08T20:20:56.261669",
      "updated_at": "2021-03-08T20:21:09.192175",
      "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
      "deleted": true,
      "name": "Exercise 1",
      "deadline": null,
      "page_id": "40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02",
      "exercise_items": [
        {
          "id": "f706c9f2-84bb-4e36-abc1-6df038c4055a",
          "created_at": "2021-03-08T20:20:56.261669",
          "updated_at": "2021-03-08T20:21:09.192175",
          "exercise_id": "2a19fa3a-f105-43e5-a497-b436a88ff861",
          "exercise_type": "quiz",
          "assignment": [
            {
              "type": "y"
            }
          ],
          "deleted": true,
          "spec": {
            "has_swag": true
          },
          "spec_file_id": null
        }
      ]
    }
 ]
}
```
*/

async fn get_page(
    request_page_id: web::Path<String>,
    pool: web::Data<PgPool>,
) -> Result<Json<PageWithExercises>> {
    let page_id = Uuid::from_str(&request_page_id)
        .map_err(|original_error| ApplicationError::BadRequest(original_error.to_string()))?;

    let page = crate::models::pages::get_page_with_exercises(pool.get_ref(), page_id)
        .await
        .map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
    Ok(Json(page))
}

/**
POST `/api/v0/pages` - Create a new page.

Please note that this endpoint will change all the exercise and exercise item ids you've created. Make sure the use the updated ids from the response object.

# Example:

Request:
```http
POST /api/v0/pages HTTP/1.1
Content-Type: application/json

{
  "content": [
    {
      "type": "x",
      "id": "2a4e517d-a7d2-4d82-89fb-a1333d8d01d1"
    }
  ],
  "url_path": "/part-2/best-page",
  "title": "Hello world!",
  "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
  "exercises": [
    {
      "id": "2a4e517d-a7d2-4d82-89fb-a1333d8d01d1",
      "name": "Exercise 1",
      "exercise_items": [
        {
          "id": "2c12869a-d5ee-4d79-a387-2964f5352150",
          "exercise_type": "quiz",
          "assignment": [{ "type": "y" }],
          "spec": { "has_swag": true }
        }
      ]
    }
  ]
}
```

Response:
```json
{
  "id": "d90bf7ab-181c-4aa2-a87e-5c28238cc67d",
  "created_at": "2021-03-12T09:27:36.428501",
  "updated_at": "2021-03-12T09:27:36.428501",
  "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
  "content": [
    {
      "id": "18110110-d02a-4432-8cb9-084d0c63a524",
      "type": "x"
    }
  ],
  "url_path": "/part-2/best-page",
  "title": "Hello world!",
  "deleted": false,
  "exercises": [
    {
      "id": "18110110-d02a-4432-8cb9-084d0c63a524",
      "created_at": "2021-03-12T09:27:36.428501",
      "updated_at": "2021-03-12T09:27:36.428501",
      "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
      "deleted": false,
      "name": "Exercise 1",
      "deadline": null,
      "page_id": "d90bf7ab-181c-4aa2-a87e-5c28238cc67d",
      "exercise_items": [
        {
          "id": "8b923a92-971a-4d84-a671-c5696a970ed7",
          "created_at": "2021-03-12T09:27:36.428501",
          "updated_at": "2021-03-12T09:27:36.428501",
          "exercise_id": "18110110-d02a-4432-8cb9-084d0c63a524",
          "exercise_type": "quiz",
          "assignment": [
            {
              "type": "y"
            }
          ],
          "deleted": false,
          "spec": {
            "has_swag": true
          },
          "spec_file_id": null
        }
      ]
    }
  ]
}
```

*/
async fn post_new_page(
    payload: web::Json<NewPage>,
    pool: web::Data<PgPool>,
) -> Result<Json<PageWithExercises>> {
    let new_page = payload.0;
    let page = crate::models::pages::insert_page(pool.get_ref(), new_page)
        .await
        .map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
    Ok(Json(page))
}

/**
PUT `/api/v0/pages/:page_id` - Update a page by id.

Please note that this endpoint will change all the exercise and exercise item ids you've created. Make sure the use the updated ids from the response object.

# Example:

Request:

```http
PUT /api/v0/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02 HTTP/1.1
Content-Type: application/json

{
  "content": [{"type": "x"}],
  "url_path": "/part-1/hello-world",
  "title": "Hello world!",
  "exercises": [
    {
      "id": "e5773229-71fc-494e-8619-b26308df74e3",
      "name": "Exercise 11",
      "exercise_items": [
        {
          "id": "3ad208d0-a22a-43e3-a395-6f9972ce873e",
          "exercise_type": "quiz",
          "assignment": [{"type": "y"}],
          "spec": { "has_swag": false }
        }
      ]
    }
  ]
}
```

Response:

```json
{
  "id": "40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02",
  "created_at": "2021-03-08T20:14:56.216394",
  "updated_at": "2021-03-08T20:14:56.216394",
  "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
  "content": [
    {
      "type": "x"
    }
  ],
  "url_path": "/part-1/hello-world",
  "title": "Hello world!",
  "deleted": false,
  "exercises": [
    {
      "id": "e5773229-71fc-494e-8619-b26308df74e3",
      "created_at": "2021-03-08T20:21:53.760852",
      "updated_at": "2021-03-08T20:22:34.199408",
      "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
      "deleted": false,
      "name": "Exercise 11",
      "deadline": null,
      "page_id": "40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02",
      "exercise_items": [
        {
          "id": "e5773229-71fc-494e-8619-b26308df74e3",
          "created_at": "2021-03-08T20:22:16.437621",
          "updated_at": "2021-03-08T20:22:34.199408",
          "exercise_id": "e5773229-71fc-494e-8619-b26308df74e3",
          "exercise_type": "quiz",
          "assignment": [
            {
              "type": "y"
            }
          ],
          "deleted": false,
          "spec": {
            "has_swag": false
          },
          "spec_file_id": null
        }
      ]
    }
  ]
}
```
*/
async fn update_page(
    payload: web::Json<PageUpdate>,
    request_page_id: web::Path<String>,
    pool: web::Data<PgPool>,
) -> Result<Json<PageWithExercises>> {
    let page_id = Uuid::from_str(&request_page_id)
        .map_err(|original_error| ApplicationError::BadRequest(original_error.to_string()))?;

    let page_update = payload.0;
    let page = crate::models::pages::update_page(pool.get_ref(), page_id, page_update)
        .await
        .map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
    Ok(Json(page))
}

/**
DELETE `/api/v0/pages/:page_id` - Delete a page, related exercises, and related exercise items by id.


# Example

Request: `DELETE /api/v0/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02`

Response:
```json
{
  "id": "40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02",
  "created_at": "2021-03-08T20:14:56.216394",
  "updated_at": "2021-03-08T20:29:22.511073",
  "course_id": "10363c5b-82b4-4121-8ef1-bae8fb42a5ce",
  "content": [
    {
      "type": "x"
    }
  ],
  "url_path": "/part-1/hello-world",
  "title": "Hello world!",
  "deleted": true
}
```
*/
async fn delete_page(
    request_page_id: web::Path<String>,
    pool: web::Data<PgPool>,
) -> Result<Json<Page>> {
    let page_id = Uuid::from_str(&request_page_id)
        .map_err(|original_error| ApplicationError::BadRequest(original_error.to_string()))?;

    let deleted_page = crate::models::pages::delete_page_and_exercises(pool.get_ref(), page_id)
        .await
        .map_err(|original_error| {
            ApplicationError::InternalServerError(original_error.to_string())
        })?;
    Ok(Json(deleted_page))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_pages_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{page_id}", web::get().to(get_page))
        .route("", web::post().to(post_new_page))
        .route("/{page_id}", web::put().to(update_page))
        .route("/{page_id}", web::delete().to(delete_page));
}
