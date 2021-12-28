//! Controllers for requests starting with `/api/v0/cms/course-instances`.

use crate::controllers::prelude::*;

/**
GET `/api/v8/course-instances/:course_instance` - Gets a course instance by id.

# Example
Request: `GET /api/v8/course-instances/e051ddb5-2128-4215-adda-ebd74a0ea46b`

Response
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
async fn get_organization_id(
    request_course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let organization =
        models::course_instances::get_organization_id(&mut conn, *request_course_instance_id)
            .await?;
    Ok(web::Json(organization))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{course_instance_id}/organization",
        web::get().to(get_organization_id),
    );
}
