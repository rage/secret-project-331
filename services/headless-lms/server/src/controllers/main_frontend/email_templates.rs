//! Controllers for requests starting with `/api/v0/main-frontend/email-templates/`.

use models::email_templates::EmailTemplate;

use crate::prelude::*;

/**
GET `/api/v0/main-frontend/email-templates`
*/
#[instrument(skip(pool))]
async fn get_all_email_templates(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<EmailTemplate>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let email_templates = models::email_templates::get_all_email_templates(&mut conn).await?;
    token.authorized_ok(web::Json(email_templates))
}

/**
DELETE `/api/v0/main-frontend/email-templates/:id`
*/
#[instrument(skip(pool))]
async fn delete_email_template(
    email_template_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<EmailTemplate>> {
    let mut conn = pool.acquire().await?;
    let deleted =
        models::email_templates::delete_email_template(&mut conn, *email_template_id).await?;

    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?;
    token.authorized_ok(web::Json(deleted))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_all_email_templates)).route(
        "/{email_template_id}",
        web::delete().to(delete_email_template),
    );
}
