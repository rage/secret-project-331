//! Controllers for requests starting with `/api/v0/main-frontend/email-templates/`.

use models::email_templates::{EmailTemplate, EmailTemplateNew};
use utoipa::OpenApi;

use crate::domain::error::missing_controller_error;
use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(get_all_email_templates, create_email_template, delete_email_template))]
pub(crate) struct MainFrontendEmailTemplatesApiDoc;

/**
GET `/api/v0/main-frontend/email-templates`
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "",
    operation_id = "getEmailTemplates",
    tag = "email_templates",
    responses(
        (status = 200, description = "Email templates", body = Vec<EmailTemplate>)
    )
)]
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
POST `/api/v0/main-frontend/email-templates`

Creates a global template; rejects a second live one for the same type and language.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "",
    operation_id = "createEmailTemplate",
    tag = "email_templates",
    request_body = EmailTemplateNew,
    responses(
        (status = 200, description = "Created email template", body = EmailTemplate)
    )
)]
async fn create_email_template(
    payload: web::Json<EmailTemplateNew>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<EmailTemplate>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Administrate,
        Some(user.id),
        Res::GlobalPermissions,
    )
    .await?;
    let mut new_template = payload.into_inner();
    new_template
        .content
        .get_or_insert_with(|| serde_json::json!([]));
    let created =
        models::email_templates::insert_global_email_template_if_absent(&mut conn, new_template)
            .await?
            .ok_or_else(missing_controller_error(
                ControllerErrorType::BadRequest,
                "A template of this type and language already exists.",
            ))?;
    token.authorized_ok(web::Json(created))
}

/**
DELETE `/api/v0/main-frontend/email-templates/:id`
*/
#[instrument(skip(pool))]
#[utoipa::path(
    delete,
    path = "/{email_template_id}",
    operation_id = "deleteEmailTemplate",
    tag = "email_templates",
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
    let email_template =
        models::email_templates::get_email_template(&mut conn, *email_template_id).await?;
    let token = if let Some(course_id) = email_template.course_id {
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
    cfg.route("", web::get().to(get_all_email_templates))
        .route("", web::post().to(create_email_template))
        .route(
            "/{email_template_id}",
            web::delete().to(delete_email_template),
        );
}
