//! Controllers for requests starting with `/api/v0/cms/email-templates`.

use crate::{
    controllers::ApplicationResult,
    domain::authorization::AuthUser,
    models::email_templates::{EmailTemplate, EmailTemplateUpdate},
};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

#[instrument(skip(pool))]
async fn get_email_template(
    request_email_template_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ApplicationResult<Json<EmailTemplate>> {
    let mut conn = pool.acquire().await?;

    let email_templates =
        crate::models::email_templates::get_email_template(&mut conn, *request_email_template_id)
            .await?;
    Ok(Json(email_templates))
}

#[instrument(skip(pool))]
async fn update_email_template(
    request_email_template_id: web::Path<Uuid>,
    payload: web::Json<EmailTemplateUpdate>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ApplicationResult<Json<EmailTemplate>> {
    let mut conn = pool.acquire().await?;
    let request_update_template = payload.0;
    let updated_template = crate::models::email_templates::update_email_template(
        &mut conn,
        *request_email_template_id,
        request_update_template,
    )
    .await?;
    Ok(Json(updated_template))
}

#[instrument(skip(pool))]
async fn delete_email_template(
    request_email_template_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ApplicationResult<Json<EmailTemplate>> {
    let mut conn = pool.acquire().await?;
    let deleted = crate::models::email_templates::delete_email_template(
        &mut conn,
        *request_email_template_id,
    )
    .await?;
    Ok(Json(deleted))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_email_templates_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{email_template_id}", web::get().to(get_email_template))
        .route("/{email_template_id}", web::put().to(update_email_template))
        .route(
            "/{email_template_id}",
            web::delete().to(delete_email_template),
        );
}
