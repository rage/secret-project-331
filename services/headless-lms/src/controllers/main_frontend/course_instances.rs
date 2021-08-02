//! Controllers for requests starting with `/api/v0/main-frontend/course-instances`.

use crate::{
    controllers::ControllerResult,
    domain::authorization::AuthUser,
    models::email_templates::{EmailTemplate, EmailTemplateNew},
};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

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
    cfg.route(
        "/{course_instance_id}/email-templates",
        web::post().to(post_new_email_template),
    )
    .route(
        "/{course_instance_id}/email-templates",
        web::get().to(get_email_templates_by_course_instance_id),
    );
}
