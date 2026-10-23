//! Controllers for requests starting with `/api/v0/main-frontend/agent-changesets`: the review
//! page of the changes a user's AI agent staged.

use std::sync::Arc;

use headless_lms_authorization::AuthorizationToken;
use models::{
    agent_changesets::{self, AgentChangeset},
    library::agent_changesets::{
        self as changesets, ChangesetReview, ChangesetSummary, PublishOptions, PublishOutcome,
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
    get_changeset,
    publish_changeset,
    discard_changeset,
    get_pending_for_page
))]
pub(crate) struct MainFrontendAgentChangesetsApiDoc;

#[derive(Debug, Deserialize, IntoParams)]
pub struct AgentChangesetsQuery {
    pub course_id: Uuid,
}

/// The user's unpublished agent changes on a page.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PendingAgentChanges {
    pub changeset_id: Uuid,
    pub course_id: Uuid,
    /// Path of the review page in the main frontend.
    pub review_path: String,
}

/// Loads the changeset and checks that it is the user's and that they may still edit its course.
async fn authorize_own_changeset(
    conn: &mut PgConnection,
    user_id: Uuid,
    changeset_id: Uuid,
) -> Result<(AgentChangeset, AuthorizationToken), ControllerError> {
    let changeset = agent_changesets::get_by_id(conn, changeset_id).await?;
    if changeset.user_id != user_id {
        return Err(controller_err!(
            NotFound,
            "No such agent changeset".to_string()
        ));
    }
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
    let summaries =
        changesets::get_summaries_for_user(&mut conn, user.id, Some(query.course_id)).await?;
    token.authorized_ok(web::Json(summaries))
}

/**
GET `/api/v0/main-frontend/agent-changesets/{changeset_id}` - One of the user's changesets for the
review page: each entity's base, staged and live snapshot, risk reasons, conflicts and the agent
calls that staged it.
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
changeset, risky changes included. Rejected without changes if any staged page or entity changed
live since it was staged.
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
    responses(
        (status = 200, description = "Published, or why it was not", body = PublishOutcome)
    )
)]
async fn publish_changeset(
    request_id: RequestId,
    pool: web::Data<PgPool>,
    changeset_id: web::Path<Uuid>,
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
            publisher_user_id: user.id,
            allow_risky: true,
            can_add_global_admin_only_exercise_services,
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
changeset. Nothing of it reaches the live course.
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
    responses(
        (status = 200, description = "The discarded changeset", body = AgentChangeset)
    )
)]
async fn discard_changeset(
    pool: web::Data<PgPool>,
    changeset_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<AgentChangeset>> {
    let mut conn = pool.acquire().await?;
    let (changeset, token) = authorize_own_changeset(&mut conn, user.id, *changeset_id).await?;
    let discarded = agent_changesets::discard(&mut conn, changeset.id).await?;
    token.authorized_ok(web::Json(discarded))
}

/**
GET `/api/v0/main-frontend/agent-changesets/pending-for-page/{page_id}` - Whether the signed-in user
has unpublished agent changes on the page, for the notice in the page editor. `null` if not.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/pending-for-page/{page_id}",
    operation_id = "getAgentChangesPendingForPage",
    tag = "agent_changesets",
    params(
        ("page_id" = Uuid, Path, description = "Page id")
    ),
    responses(
        (status = 200, description = "The open changeset changing the page, if any", body = Option<PendingAgentChanges>)
    )
)]
async fn get_pending_for_page(
    pool: web::Data<PgPool>,
    page_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Option<PendingAgentChanges>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?;
    let pending = changesets::get_open_changeset_changing_page(&mut conn, user.id, *page_id)
        .await?
        .map(|changeset| PendingAgentChanges {
            review_path: format!(
                "/manage/courses/{}/agent-changesets/{}",
                changeset.course_id, changeset.id
            ),
            changeset_id: changeset.id,
            course_id: changeset.course_id,
        });
    token.authorized_ok(web::Json(pending))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_changesets))
        .route(
            "/pending-for-page/{page_id}",
            web::get().to(get_pending_for_page),
        )
        .route("/{changeset_id}", web::get().to(get_changeset))
        .route("/{changeset_id}/publish", web::post().to(publish_changeset))
        .route("/{changeset_id}/discard", web::post().to(discard_changeset));
}
