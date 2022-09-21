//! Controllers for requests starting with `/api/v0/cms/email-templates`.

use models::email_templates::{EmailTemplate, EmailTemplateUpdate};

use crate::prelude::*;

/**
GET `/api/v0/cms/email-templates/:id`
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_email_template(
    email_template_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<EmailTemplate>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    let email_templates =
        models::email_templates::get_email_template(&mut conn, *email_template_id).await?;
    token.authorized_ok(web::Json(email_templates))
}

/**
PUT `/api/v0/cms/email-templates/:id
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn update_email_template(
    email_template_id: web::Path<Uuid>,
    payload: web::Json<EmailTemplateUpdate>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<EmailTemplate>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    let request_update_template = payload.0;
    let updated_template = models::email_templates::update_email_template(
        &mut conn,
        *email_template_id,
        request_update_template,
    )
    .await?;
    token.authorized_ok(web::Json(updated_template))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{email_template_id}", web::get().to(get_email_template))
        .route("/{email_template_id}", web::put().to(update_email_template));
}
