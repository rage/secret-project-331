//! Controllers for requests starting with `/api/v0/cms/email-templates`.

use models::email_templates::{EmailTemplate, EmailTemplateUpdate};
use utoipa::OpenApi;

use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(get_email_template, update_email_template, delete_email_template))]
pub(crate) struct CmsEmailTemplatesApiDoc;

/**
GET `/api/v0/cms/email-templates/:id`
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{email_template_id}",
    operation_id = "getCmsEmailTemplate",
    tag = "cms_email_templates",
    params(
        ("email_template_id" = Uuid, Path, description = "Email template id")
    ),
    responses(
        (status = 200, description = "Email template", body = EmailTemplate)
    )
)]
async fn get_email_template(
    email_template_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<EmailTemplate>> {
    let mut conn = pool.acquire().await?;
    let email_templates =
        models::email_templates::get_email_template(&mut conn, *email_template_id).await?;
    let token = if let Some(course_id) = email_templates.course_id {
        authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?
    } else {
        authorize(
            &mut conn,
            Act::Administrate,
            Some(user.id),
            Res::GlobalPermissions,
        )
        .await?
    };
    token.authorized_ok(web::Json(email_templates))
}

/**
PUT `/api/v0/cms/email-templates/:id
*/
#[instrument(skip(pool))]
#[utoipa::path(
    put,
    path = "/{email_template_id}",
    operation_id = "updateCmsEmailTemplate",
    tag = "cms_email_templates",
    params(
        ("email_template_id" = Uuid, Path, description = "Email template id")
    ),
    request_body = EmailTemplateUpdate,
    responses(
        (status = 200, description = "Updated email template", body = EmailTemplate)
    )
)]
async fn update_email_template(
    email_template_id: web::Path<Uuid>,
    payload: web::Json<EmailTemplateUpdate>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<EmailTemplate>> {
    let mut conn = pool.acquire().await?;
    let template =
        models::email_templates::get_email_template(&mut conn, *email_template_id).await?;
    let token = if let Some(course_id) = template.course_id {
        authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?
    } else {
        authorize(
            &mut conn,
            Act::Administrate,
            Some(user.id),
            Res::GlobalPermissions,
        )
        .await?
    };
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
DELETE `/api/v0/cms/email-templates/:id`
*/
#[instrument(skip(pool))]
#[utoipa::path(
    delete,
    path = "/{email_template_id}",
    operation_id = "deleteCmsEmailTemplate",
    tag = "cms_email_templates",
    params(
        ("email_template_id" = Uuid, Path, description = "Email template id")
    ),
    responses(
        (status = 200, description = "Deleted email template", body = EmailTemplate)
    )
)]
async fn delete_email_template(
    email_template_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<EmailTemplate>> {
    let mut conn = pool.acquire().await?;
    let template =
        models::email_templates::get_email_template(&mut conn, *email_template_id).await?;
    let token = if let Some(course_id) = template.course_id {
        authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?
    } else {
        authorize(
            &mut conn,
            Act::Administrate,
            Some(user.id),
            Res::GlobalPermissions,
        )
        .await?
    };
    let deleted =
        models::email_templates::delete_email_template(&mut conn, *email_template_id).await?;
    token.authorized_ok(web::Json(deleted))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{email_template_id}", web::get().to(get_email_template))
        .route("/{email_template_id}", web::put().to(update_email_template))
        .route(
            "/{email_template_id}",
            web::delete().to(delete_email_template),
        );
}
