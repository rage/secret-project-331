//! Controllers for requests starting with `/api/v0/main-frontend/agent-changesets`: the review
//! page of the changes a user's AI agent staged.

use std::sync::Arc;

use headless_lms_authorization::AuthorizationToken;
use models::{
    agent_changesets::{self, AgentChangeset, AgentChangesetCounts},
    library::agent_changesets::{
        self as changesets, ChangesetReview, ChangesetSummary, DiscardOutcome, PublishOptions,
        PublishOutcome,
    },
};
use utoipa::{IntoParams, OpenApi, ToSchema};

use crate::{
    domain::{
        authorization::is_user_global_admin,
        models_requests::{self, JwtKey},
        request_id::RequestId,
    },
    prelude::*,
};

#[derive(OpenApi)]
#[openapi(paths(
    get_changesets,
    get_changeset_counts,
    get_changeset,
    publish_changeset,
    discard_changeset,
    create_preview_link
))]
pub(crate) struct MainFrontendAgentChangesetsApiDoc;

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct AgentChangesetsQuery {
    pub course_id: Uuid,
}

/// A login-free link to one page of a changeset as staged.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AgentPreviewLink {
    /// Path of the preview page in the main frontend. It stops working after a few minutes.
    pub preview_path: String,
}

/// A publish or discard of the changeset as the user reviewed it.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ReviewedRevisionRequest {
    /// `changeset.revision` of the review the user acted on.
    pub reviewed_revision: i32,
}

/// Loads the changeset and checks that it is the user's and that they may still edit its course.
pub(super) async fn authorize_own_changeset(
    conn: &mut PgConnection,
    user_id: Uuid,
    changeset_id: Uuid,
) -> Result<(AgentChangeset, AuthorizationToken), ControllerError> {
    let changeset = agent_changesets::get_by_id_for_user(conn, changeset_id, user_id).await?;
    let token = authorize(
        conn,
        Act::Edit,
        Some(user_id),
        Res::Course(changeset.course_id),
    )
    .await?;
    Ok((changeset, token))
}

/**
GET `/api/v0/main-frontend/agent-changesets?course_id=` - The signed-in user's agent changesets in
the course, newest first, with what each changes.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "",
    operation_id = "getAgentChangesets",
    tag = "agent_changesets",
    params(AgentChangesetsQuery),
    responses(
        (status = 200, description = "The user's changesets in the course", body = [ChangesetSummary])
    )
)]
async fn get_changesets(
    pool: web::Data<PgPool>,
    query: web::Query<AgentChangesetsQuery>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ChangesetSummary>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(query.course_id),
    )
    .await?;
    let summaries = changesets::get_summaries_for_user(&mut conn, user.id, query.course_id).await?;
    token.authorized_ok(web::Json(summaries))
}

/**
GET `/api/v0/main-frontend/agent-changesets/counts?course_id=` - Whether the signed-in user has agent
changesets in the course, and how many entities their open one stages, for the course management
tab and its badge.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/counts",
    operation_id = "getAgentChangesetCounts",
    tag = "agent_changesets",
    params(AgentChangesetsQuery),
    responses(
        (status = 200, description = "The user's changeset counts in the course", body = AgentChangesetCounts)
    )
)]
async fn get_changeset_counts(
    pool: web::Data<PgPool>,
    query: web::Query<AgentChangesetsQuery>,
    user: AuthUser,
) -> ControllerResult<web::Json<AgentChangesetCounts>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Course(query.course_id),
    )
    .await?;
    let counts = agent_changesets::get_counts(&mut conn, user.id, query.course_id).await?;
    token.authorized_ok(web::Json(counts))
}

/**
GET `/api/v0/main-frontend/agent-changesets/{changeset_id}` - One of the user's changesets for the
review page: what each staged entity changes, field by field and for pages as students see them,
its risk reasons, the conflicts and the agent calls that staged the changes.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{changeset_id}",
    operation_id = "getAgentChangeset",
    tag = "agent_changesets",
    params(
        ("changeset_id" = Uuid, Path, description = "Changeset id")
    ),
    responses(
        (status = 200, description = "The changeset with its entities and calls", body = ChangesetReview)
    )
)]
async fn get_changeset(
    pool: web::Data<PgPool>,
    changeset_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<ChangesetReview>> {
    let mut conn = pool.acquire().await?;
    let (changeset, token) = authorize_own_changeset(&mut conn, user.id, *changeset_id).await?;
    let review = changesets::get_review(&mut conn, changeset).await?;
    token.authorized_ok(web::Json(review))
}

/**
POST `/api/v0/main-frontend/agent-changesets/{changeset_id}/publish` - Publishes the user's open
changeset, risky changes included. Rejected without changes if the changeset is no longer open or no
longer the reviewed revision, if any staged page or entity changed live since it was staged, or if
saving a staged entity fails.
*/
#[instrument(skip(pool, app_conf, jwt_key))]
#[utoipa::path(
    post,
    path = "/{changeset_id}/publish",
    operation_id = "publishAgentChangeset",
    tag = "agent_changesets",
    params(
        ("changeset_id" = Uuid, Path, description = "Changeset id")
    ),
    request_body = ReviewedRevisionRequest,
    responses(
        (status = 200, description = "Published, or why it was not", body = PublishOutcome)
    )
)]
async fn publish_changeset(
    request_id: RequestId,
    pool: web::Data<PgPool>,
    changeset_id: web::Path<Uuid>,
    payload: web::Json<ReviewedRevisionRequest>,
    user: AuthUser,
    app_conf: web::Data<ApplicationConfiguration>,
    jwt_key: web::Data<JwtKey>,
) -> ControllerResult<web::Json<PublishOutcome>> {
    let mut conn = pool.acquire().await?;
    let (changeset, token) = authorize_own_changeset(&mut conn, user.id, *changeset_id).await?;
    let can_add_global_admin_only_exercise_services =
        is_user_global_admin(&mut conn, user.id).await?;
    let outcome = changesets::publish(
        &mut conn,
        changeset.id,
        PublishOptions {
            can_add_global_admin_only_exercise_services,
            reviewed_revision: Some(payload.reviewed_revision),
        },
        &app_conf,
        models_requests::make_spec_fetcher(
            app_conf.base_url.clone(),
            request_id.0,
            Arc::clone(&jwt_key),
        ),
        models_requests::fetch_service_info,
    )
    .await?;
    token.authorized_ok(web::Json(outcome))
}

/**
POST `/api/v0/main-frontend/agent-changesets/{changeset_id}/discard` - Drops the user's open
changeset. Nothing of it reaches the live course. Rejected without changes if the changeset is no
longer open or no longer the reviewed revision.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/{changeset_id}/discard",
    operation_id = "discardAgentChangeset",
    tag = "agent_changesets",
    params(
        ("changeset_id" = Uuid, Path, description = "Changeset id")
    ),
    request_body = ReviewedRevisionRequest,
    responses(
        (status = 200, description = "Discarded, or why it was not", body = DiscardOutcome)
    )
)]
async fn discard_changeset(
    pool: web::Data<PgPool>,
    changeset_id: web::Path<Uuid>,
    payload: web::Json<ReviewedRevisionRequest>,
    user: AuthUser,
) -> ControllerResult<web::Json<DiscardOutcome>> {
    let mut conn = pool.acquire().await?;
    let (changeset, token) = authorize_own_changeset(&mut conn, user.id, *changeset_id).await?;
    let outcome =
        changesets::discard(&mut conn, changeset.id, Some(payload.reviewed_revision)).await?;
    token.authorized_ok(web::Json(outcome))
}

/**
POST `/api/v0/main-frontend/agent-changesets/{changeset_id}/preview-link/{page_id}` - Mints a
short-lived preview link for a page of the user's changeset, so the review page can open the staged
page as students would see it.
*/
#[instrument(skip(pool, jwt_key))]
#[utoipa::path(
    post,
    path = "/{changeset_id}/preview-link/{page_id}",
    operation_id = "createAgentChangesetPreviewLink",
    tag = "agent_changesets",
    params(
        ("changeset_id" = Uuid, Path, description = "Changeset id"),
        ("page_id" = Uuid, Path, description = "Page id")
    ),
    responses(
        (status = 200, description = "The preview link", body = AgentPreviewLink)
    )
)]
async fn create_preview_link(
    pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    user: AuthUser,
    jwt_key: web::Data<JwtKey>,
) -> ControllerResult<web::Json<AgentPreviewLink>> {
    let (changeset_id, page_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let (changeset, token) = authorize_own_changeset(&mut conn, user.id, changeset_id).await?;
    let preview = changesets::mint_preview_token(&jwt_key, changeset.id, Some(page_id), user.id)?;
    token.authorized_ok(web::Json(AgentPreviewLink {
        preview_path: changesets::preview_path(&preview.token),
    }))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_changesets))
        .route("/counts", web::get().to(get_changeset_counts))
        .route("/{changeset_id}", web::get().to(get_changeset))
        .route("/{changeset_id}/publish", web::post().to(publish_changeset))
        .route("/{changeset_id}/discard", web::post().to(discard_changeset))
        .route(
            "/{changeset_id}/preview-link/{page_id}",
            web::post().to(create_preview_link),
        );
}
