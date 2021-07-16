//! Controllers for requests starting with `/api/v0/cms/course-instances`.

use crate::{
    controllers::ControllerResult,
    domain::authorization::AuthUser,
    models::{
        course_instances::CourseInstance,
        email_templates::{EmailTemplate, EmailTemplateNew},
    },
};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

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
async fn get_course_instance(
    request_course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<Json<CourseInstance>> {
    let mut conn = pool.acquire().await?;
    let course_intance = crate::models::course_instances::get_course_instance(
        &mut conn,
        *request_course_instance_id,
    )
    .await?;
    Ok(Json(course_intance))
}

#[instrument(skip(payload, pool))]
async fn post_new_email_template(
    request_course_instance_id: web::Path<Uuid>,
    payload: web::Json<EmailTemplateNew>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<Json<EmailTemplate>> {
    let mut conn = pool.acquire().await?;
    let new_email_template = payload.0;
    let email_template = crate::models::email_templates::insert_email_template(
        &mut conn,
        *request_course_instance_id,
        new_email_template,
        None,
    )
    .await?;
    Ok(Json(email_template))
}

#[instrument(skip(pool))]
async fn get_email_templates_by_course_instance_id(
    request_course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<Json<Vec<EmailTemplate>>> {
    let mut conn = pool.acquire().await?;

    let email_templates =
        crate::models::email_templates::get_email_templates(&mut conn, *request_course_instance_id)
            .await?;
    Ok(Json(email_templates))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_course_instances_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_instance_id}", web::get().to(get_course_instance))
        .route(
            "/{course_instance_id}/email-templates",
            web::post().to(post_new_email_template),
        )
        .route(
            "/{course_instance_id}/email-templates",
            web::get().to(get_email_templates_by_course_instance_id),
        );
}
