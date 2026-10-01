//! Controllers for requests starting with `/api/v0/cms/email-templates`.

use headless_lms_utils::email_processor::{self, EmailGutenbergBlock, EmailRenderInput};
use models::email_layouts::{self, ResolvedLayout};
use models::email_templates::{EmailTemplate, EmailTemplateUpdate};
use utoipa::{OpenApi, ToSchema};

use crate::domain::authorization::AuthorizationToken;
use crate::prelude::*;

/// More test sends than this from one user within a minute are rejected.
const MAX_TEST_SENDS_PER_MINUTE: i64 = 5;

#[derive(OpenApi)]
#[openapi(paths(
    get_email_template,
    update_email_template,
    delete_email_template,
    preview_email_template,
    send_test_email
))]
pub(crate) struct CmsEmailTemplatesApiDoc;

/// The editor's unsaved subject and body.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct EmailTemplatePreviewRequest {
    pub subject: String,
    pub content: serde_json::Value,
}

/// A template rendered as it would be sent, with sample placeholder values.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct EmailTemplatePreview {
    pub subject: String,
    /// The complete HTML document, layout included.
    pub html: String,
    pub plain_text: String,
}

/// Authorizes editing `template`: teaching its course, or global admin for a global template.
async fn authorize_template_edit(
    conn: &mut PgConnection,
    user: &AuthUser,
    template: &EmailTemplate,
) -> Result<AuthorizationToken, ControllerError> {
    let token = match template.course_id {
        Some(course_id) => {
            authorize(conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?
        }
        None => {
            authorize(
                conn,
                Act::Administrate,
                Some(user.id),
                Res::GlobalPermissions,
            )
            .await?
        }
    };
    Ok(token)
}

/// Parses an email body the way the sender will, so a body it cannot send is rejected on save.
pub(crate) fn parse_email_content(
    content: &serde_json::Value,
) -> Result<Vec<EmailGutenbergBlock>, ControllerError> {
    serde_json::from_value(content.clone()).map_err(|err| {
        ControllerError::new(
            ControllerErrorType::BadRequest,
            format!("The email content cannot be sent: {err}"),
            None,
        )
    })
}

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
    parse_email_content(&request_update_template.content)?;
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
POST `/api/v0/cms/email-templates/:id/preview`

Renders the editor's unsaved state exactly as the sender would, with sample placeholder values.
*/
#[instrument(skip(pool, app_conf, payload))]
#[utoipa::path(
    post,
    path = "/{email_template_id}/preview",
    operation_id = "previewCmsEmailTemplate",
    tag = "cms_email_templates",
    params(
        ("email_template_id" = Uuid, Path, description = "Email template id")
    ),
    request_body = EmailTemplatePreviewRequest,
    responses(
        (status = 200, description = "Rendered email", body = EmailTemplatePreview)
    )
)]
async fn preview_email_template(
    email_template_id: web::Path<Uuid>,
    payload: web::Json<EmailTemplatePreviewRequest>,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    user: AuthUser,
) -> ControllerResult<web::Json<EmailTemplatePreview>> {
    let mut conn = pool.acquire().await?;
    let template =
        models::email_templates::get_email_template(&mut conn, *email_template_id).await?;
    let token = authorize_template_edit(&mut conn, &user, &template).await?;
    let body = parse_email_content(&payload.content)?;
    let language = models::email_templates::get_language(&mut conn, template.id).await?;
    let layouts = email_layouts::get_all_live(&mut conn).await?;
    let layout = ResolvedLayout::for_language(&layouts, language.as_deref());
    let replacements = template
        .email_template_type
        .sample_placeholders(&app_conf.base_url);
    let rendered = email_processor::render_email(EmailRenderInput {
        layout_html: layout.html,
        theme: layout.theme,
        subject: &payload.subject,
        body,
        language: language.as_deref().unwrap_or_default(),
        replacements: &replacements,
    });
    token.authorized_ok(web::Json(EmailTemplatePreview {
        subject: rendered.subject,
        html: rendered.html,
        plain_text: rendered.plain_text,
    }))
}

/**
POST `/api/v0/cms/email-templates/:id/send-test`

Queues the editor's unsaved state, with sample placeholder values, to the requesting user's own
address. Returns the id of the queued delivery.
*/
#[instrument(skip(pool, app_conf, payload))]
#[utoipa::path(
    post,
    path = "/{email_template_id}/send-test",
    operation_id = "sendCmsEmailTemplateTest",
    tag = "cms_email_templates",
    params(
        ("email_template_id" = Uuid, Path, description = "Email template id")
    ),
    request_body = EmailTemplatePreviewRequest,
    responses(
        (status = 200, description = "Id of the queued test delivery", body = Uuid)
    )
)]
async fn send_test_email(
    email_template_id: web::Path<Uuid>,
    payload: web::Json<EmailTemplatePreviewRequest>,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    user: AuthUser,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let template =
        models::email_templates::get_email_template(&mut conn, *email_template_id).await?;
    let token = authorize_template_edit(&mut conn, &user, &template).await?;
    parse_email_content(&payload.content)?;
    let recent_test_sends =
        models::email_deliveries::count_test_deliveries_in_last_minute(&mut conn, user.id).await?;
    if recent_test_sends >= MAX_TEST_SENDS_PER_MINUTE {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Too many test emails sent in the last minute. Try again shortly.".to_string(),
            None,
        ));
    }
    let placeholders = serde_json::to_value(
        template
            .email_template_type
            .sample_placeholders(&app_conf.base_url),
    )?;
    let delivery_id = models::email_deliveries::insert_test_email_delivery(
        &mut conn,
        user.id,
        template.id,
        &payload.subject,
        &payload.content,
        &placeholders,
    )
    .await?;
    token.authorized_ok(web::Json(delivery_id))
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
        )
        .route(
            "/{email_template_id}/preview",
            web::post().to(preview_email_template),
        )
        .route(
            "/{email_template_id}/send-test",
            web::post().to(send_test_email),
        );
}
