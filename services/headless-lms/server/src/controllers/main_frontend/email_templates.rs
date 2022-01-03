//! Controllers for requests starting with `/api/v0/main-frontend/email-templates/`.

use crate::{
    controllers::ControllerResult, domain::authorization::AuthUser,
    models::email_templates::EmailTemplate,
};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

#[instrument(skip(pool))]
async fn delete_email_template(
    request_email_template_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<Json<EmailTemplate>> {
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
    cfg.route(
        "/{email_template_id}",
        web::delete().to(delete_email_template),
    );
}
