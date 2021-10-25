//! Controllers for requests starting with `/api/v0/cms/pages`.
use crate::{
    controllers::ControllerResult,
    domain::authorization::{authorize, Action, AuthUser, Resource},
    models::pages::{CmsPageUpdate, ContentManagementPage},
};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

/**
GET `/api/v0/cms/pages/:page_id` - Get a page with exercises and exercise tasks by id.

# Example OUTDATED

Request: `GET /api/v0/cms/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02`

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
  "deleted_at": null,
  "chapter_id": "2495ffa3-7ea9-4615-baa5-828023688c79"
}
```
*/
#[instrument(skip(pool))]
async fn get_page(
    request_page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<Json<ContentManagementPage>> {
    let mut conn = pool.acquire().await?;
    let page = crate::models::pages::get_page(&mut conn, *request_page_id).await?;
    authorize(
        &mut conn,
        Action::Edit,
        user.id,
        Resource::Course(page.course_id),
    )
    .await?;

    let exercises =
        crate::models::exercises::get_exercises_by_page_id(&mut conn, *request_page_id).await?;
    let exercise_slides = crate::models::exercise_slides::get_exercise_slides_by_exercise_ids(
        &mut conn,
        &exercises.iter().map(|x| x.id).collect::<Vec<Uuid>>(),
    )
    .await?;
    let exercise_tasks = crate::models::exercise_tasks::get_exercise_tasks_by_exercise_slide_ids(
        &mut conn,
        &exercise_slides.iter().map(|x| x.id).collect::<Vec<Uuid>>(),
    )
    .await?;

    Ok(Json(ContentManagementPage {
        page,
        exercises,
        exercise_slides,
        exercise_tasks,
    }))
}

/**
PUT `/api/v0/cms/pages/:page_id` - Update a page by id.

Please note that this endpoint will change all the exercise and exercise task ids you've created. Make sure the use the updated ids from the response object.

If optional property front_page_of_chapter_id is set, this page will become the front page of the specified course part.

# Example: OUTDATED

Request:

```http
PUT /api/v0/cms/pages/40ca9bcf-8eaa-41ba-940e-0fd5dd0c3c02 HTTP/1.1
Content-Type: application/json

{
  "content": [{"type": "x"}],
  "url_path": "/part-1/hello-world",
  "title": "Hello world!",
  "chapter_id": "2495ffa3-7ea9-4615-baa5-828023688c79"
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
  "deleted_at": null,
  "chapter_id": "2495ffa3-7ea9-4615-baa5-828023688c79",
  "front_page_of_chapter_id": null
}
```
*/
#[instrument(skip(pool))]
async fn update_page(
    payload: web::Json<CmsPageUpdate>,
    request_page_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<Json<ContentManagementPage>> {
    let mut conn = pool.acquire().await?;
    let page_update = payload.0;
    let course_id = crate::models::pages::get_course_id(&mut conn, *request_page_id).await?;
    authorize(
        &mut conn,
        Action::Edit,
        user.id,
        Resource::Course(course_id),
    )
    .await?;
    let saved =
        crate::models::pages::update_page(&mut conn, *request_page_id, page_update, user.id)
            .await?;
    Ok(Json(saved))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_pages_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{page_id}", web::get().to(get_page))
        .route("/{page_id}", web::put().to(update_page));
}
