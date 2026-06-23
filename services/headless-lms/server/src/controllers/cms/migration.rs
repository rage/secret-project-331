//! Controllers for requests starting with `/api/v0/cms/migration`.

use crate::domain::models_requests;
use crate::domain::models_requests::JwtKey;
use models::pages::CmsPageUpdate;

use crate::{domain::request_id::RequestId, prelude::*};

/**
POST `/api/v0/cms/migration/new_page/{course_id}` - Create a new page from Gutenberg blocks.

Creates a new page in the CMS. Accepts a `CmsPageUpdate` object; if `title` or `url_path` are empty
they are derived from the first hero-section or heading block in `content`. The order number is
automatically determined.

# Example

Request:

```http
POST /api/v0/cms/migration/new_page/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa HTTP/1.1
Content-Type: application/json

{
  "content": [
    {
      "clientId": "...",
      "isValid": true,
      "name": "moocfi/hero-section",
      "attributes": {
        "title": "My Page Title"
      },
      "innerBlocks": []
    },
    {
      "clientId": "...",
      "isValid": true,
      "name": "core/paragraph",
      "attributes": {
        "content": "Page content here"
      },
      "innerBlocks": []
    }
  ],
  "exercises": [],
  "exercise_slides": [],
  "exercise_tasks": [],
  "url_path": "",
  "title": "",
  "chapter_id": null,
  "hidden": false
}
```
*/

#[instrument(skip(pool, jwt_key, app_conf, user, cms_update_json, course_id, request_id))]
async fn create_page(
    request_id: RequestId,
    cms_update_json: web::Json<CmsPageUpdate>,
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    jwt_key: web::Data<JwtKey>,
    app_conf: web::Data<ApplicationConfiguration>,
    user: AuthUser,
) -> ControllerResult<web::Json<(Uuid, Uuid)>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;

    let result = models::library::migration::create_page(
        &mut conn,
        *course_id,
        cms_update_json.into_inner(),
        user.id,
        models_requests::make_spec_fetcher(
            app_conf.base_url.clone(),
            request_id.0,
            jwt_key.into_inner(),
        ),
        models_requests::fetch_service_info,
    )
    .await?;

    token.authorized_ok(web::Json(result))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/new_page/{course_id}", web::post().to(create_page));
}
