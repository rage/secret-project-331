//! Controllers for requests starting with `/api/v0/main-frontend/agent-preview`: the login-free,
//! read-only preview of a page as an AI agent staged it, or as published.

use models::library::agent_changesets::{
    PagePreview, resolve_changeset_preview, resolve_preview, resolve_published_course_preview,
    resolve_published_preview, validate_preview_token,
};
use utoipa::{IntoParams, OpenApi};

use super::agent_changesets::authorize_own_changeset;
use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(get_preview))]
pub(crate) struct MainFrontendAgentPreviewApiDoc;

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct AgentPreviewQuery {
    /// The page to show; for a token of several pages only. Defaults to the first.
    page: Option<Uuid>,
}

/**
GET `/api/v0/main-frontend/agent-preview/{token}` - The page a preview token points at, staged or
published, or for a token of several pages the page `page` with the list of pages. No login: the
short-lived random token stands in for it, while its user may still edit the course.
*/
#[instrument(skip(pool, token))]
#[utoipa::path(
    get,
    path = "/{token}",
    operation_id = "getAgentPagePreview",
    tag = "agent_preview",
    params(
        ("token" = String, Path, description = "Preview token"),
        AgentPreviewQuery
    ),
    responses(
        (status = 200, description = "The staged page", body = PagePreview)
    )
)]
async fn get_preview(
    pool: web::Data<PgPool>,
    token: web::Path<String>,
    query: web::Query<AgentPreviewQuery>,
) -> ControllerResult<web::Json<PagePreview>> {
    let mut conn = pool.acquire().await?;
    let claim = validate_preview_token(&mut conn, &token).await?;
    let (preview, auth) = match claim.changeset_id {
        Some(changeset_id) => {
            let (changeset, auth) =
                authorize_own_changeset(&mut conn, claim.user_id, changeset_id).await?;
            let preview = match claim.page_id {
                Some(page_id) => resolve_preview(&mut conn, &changeset, page_id).await?,
                None => resolve_changeset_preview(&mut conn, &changeset, query.page).await?,
            };
            (preview, auth)
        }
        None => {
            let auth = authorize(
                &mut conn,
                Act::Edit,
                Some(claim.user_id),
                Res::Course(claim.course_id),
            )
            .await?;
            let preview = match claim.page_id {
                Some(page_id) => {
                    resolve_published_preview(&mut conn, claim.course_id, page_id).await?
                }
                None => {
                    resolve_published_course_preview(&mut conn, claim.course_id, query.page).await?
                }
            };
            (preview, auth)
        }
    };
    auth.authorized_ok(web::Json(preview))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{token}", web::get().to(get_preview));
}
