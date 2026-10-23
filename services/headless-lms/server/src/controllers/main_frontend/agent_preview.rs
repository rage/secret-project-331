//! Controllers for requests starting with `/api/v0/main-frontend/agent-preview`: the login-free,
//! read-only preview of a page as an AI agent staged it.

use models::library::agent_changesets::{PagePreview, resolve_preview, validate_preview_token};
use utoipa::OpenApi;

use super::agent_changesets::authorize_own_changeset;
use crate::{domain::models_requests::JwtKey, prelude::*};

#[derive(OpenApi)]
#[openapi(paths(get_preview))]
pub(crate) struct MainFrontendAgentPreviewApiDoc;

/**
GET `/api/v0/main-frontend/agent-preview/{token}` - The staged page a preview token points at. No
login: the short-lived signed token stands in for it, while its user may still edit the course.
*/
#[instrument(skip(pool, jwt_key, token))]
#[utoipa::path(
    get,
    path = "/{token}",
    operation_id = "getAgentPagePreview",
    tag = "agent_preview",
    params(
        ("token" = String, Path, description = "Preview token")
    ),
    responses(
        (status = 200, description = "The staged page", body = PagePreview)
    )
)]
async fn get_preview(
    pool: web::Data<PgPool>,
    token: web::Path<String>,
    jwt_key: web::Data<JwtKey>,
) -> ControllerResult<web::Json<PagePreview>> {
    let claim = validate_preview_token(&token, &jwt_key)?;
    let mut conn = pool.acquire().await?;
    let (changeset, auth) =
        authorize_own_changeset(&mut conn, claim.user_id, claim.changeset_id).await?;
    let preview = resolve_preview(&mut conn, &changeset, claim.page_id).await?;
    auth.authorized_ok(web::Json(preview))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{token}", web::get().to(get_preview));
}
