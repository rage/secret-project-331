//! Changeset tools: listing, publishing, discarding and previewing staged changes.

use std::collections::{HashMap, hash_map::Entry};

use async_trait::async_trait;
use chrono::{Duration, Utc};
use headless_lms_authorization::{
    Action, Resource, fetch_user_roles, is_permitted, is_user_global_admin,
};
use headless_lms_models::{
    agent_changesets::{self, AgentChangeset, AgentChangesetStatus},
    library::agent_changesets::{
        ChangesetSummary, PREVIEW_TOKEN_LIFETIME_MINUTES, PublishOptions, PublishOutcome,
        PublishRejection, get_summaries_for_user, mint_preview_token, publish,
    },
    organizations,
};
use headless_lms_utils::course_url::build_course_url;
use serde_json::{Map, Value, json};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::access::{authorize_course, connection, open_course, page_in_course};
use crate::hints;
use crate::state::McpState;
use crate::tools::args::{ChangesetArgs, GetPreviewLinkArgs, ListChangesetsArgs};
use crate::tools::{
    ConfirmationRequest, RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult,
    parse_arguments, parse_id,
};

pub struct ListChangesets;
pub struct PublishChangeset;
pub struct DiscardChangeset;
pub struct GetPreviewLink;

/// Published, discarded and expired changesets listed besides the open ones.
const RECENT_CLOSED_CHANGESETS: usize = 10;

fn summary_json(state: &McpState, summary: &ChangesetSummary) -> Value {
    let changeset = &summary.changeset;
    json!({
        "id": changeset.id,
        "course": changeset.course_id,
        "status": changeset.status,
        "created_at": changeset.created_at,
        "expires_at": changeset.is_open().then_some(changeset.expires_at),
        "published_at": changeset.published_at,
        "is_expiring_soon": summary.is_expiring_soon,
        "has_risky_changes": summary.has_risky_changes,
        "review_url": state.review_url(changeset.course_id, changeset.id),
        "entities": summary.entities,
    })
}

#[async_trait]
impl ToolHandler<McpState> for ListChangesets {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: ListChangesetsArgs = parse_arguments(arguments)?;
        let user_id = ctx.principal.user_id;
        let mut conn = connection(state).await?;
        let course_id = match &args.course {
            Some(course) => {
                let course_id = parse_id(course, "course")?;
                authorize_course(&mut conn, user_id, course_id).await?;
                Some(course_id)
            }
            None => None,
        };
        let roles = fetch_user_roles(&mut conn, Some(user_id)).await?;
        let mut can_edit: HashMap<Uuid, bool> = HashMap::new();
        let mut open = Vec::new();
        let mut closed = Vec::new();
        for summary in get_summaries_for_user(&mut conn, user_id, course_id).await? {
            let course = summary.changeset.course_id;
            if let Entry::Vacant(entry) = can_edit.entry(course) {
                entry.insert(
                    is_permitted(&mut conn, Action::Edit, Resource::Course(course), &roles).await?,
                );
            }
            if !can_edit[&course] {
                continue;
            }
            if summary.changeset.is_open() {
                open.push(summary_json(state, &summary));
            } else if closed.len() < RECENT_CLOSED_CHANGESETS {
                closed.push(summary_json(state, &summary));
            }
        }
        Ok(ToolResult::success(json!({"open": open, "recent": closed})).into())
    }
}

/// The user's own changeset in the course, or not found.
async fn own_changeset(
    conn: &mut PgConnection,
    ctx: &RequestContext,
    args: &ChangesetArgs,
) -> Result<AgentChangeset, ToolError> {
    let course_id = parse_id(&args.course, "course")?;
    let changeset_id = parse_id(&args.changeset, "changeset")?;
    authorize_course(conn, ctx.principal.user_id, course_id).await?;
    let not_found = || ToolError::NotFound {
        message: format!(
            "you have no changeset {changeset_id} in course {course_id}; list_changesets lists yours"
        ),
    };
    let changeset = agent_changesets::get_by_id(conn, changeset_id)
        .await
        .map_err(|_| not_found())?;
    if changeset.user_id != ctx.principal.user_id || changeset.course_id != course_id {
        return Err(not_found());
    }
    Ok(changeset)
}

fn not_open_result(changeset: &AgentChangeset) -> ToolResult {
    let mut result = ToolResult::success(json!({
        "changeset": changeset.id,
        "status": changeset.status,
        "published": changeset.status == AgentChangesetStatus::Published,
        "message": match changeset.status {
            AgentChangesetStatus::Published => "The changeset is already published.",
            AgentChangesetStatus::Discarded => "The changeset was discarded; nothing of it was published.",
            AgentChangesetStatus::Expired => "The changeset expired; nothing of it was published.",
            AgentChangesetStatus::Open => "The changeset is still open.",
        },
    }));
    if changeset.status == AgentChangesetStatus::Published {
        result = result.with_hint(hints::published(changeset.id));
    }
    result
}

fn error_result(error: Value) -> ToolResult {
    ToolResult {
        structured: Map::from_iter([("error".to_string(), error)]),
        hints: Vec::new(),
        is_error: true,
    }
}

#[async_trait]
impl ToolHandler<McpState> for PublishChangeset {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: ChangesetArgs = parse_arguments(arguments)?;
        let mut conn = connection(state).await?;
        let changeset = own_changeset(&mut conn, ctx, &args).await?;
        let review_url = state.review_url(changeset.course_id, changeset.id);
        if !changeset.is_open() {
            return Ok(not_open_result(&changeset).into());
        }
        if let Some(retry) = &ctx.retry {
            // The teacher answered on the review page; an open changeset means they didn't publish.
            let mut result = ToolResult::success(json!({
                "changeset": changeset.id,
                "published": false,
                "review_url": review_url,
                "message": "The changeset is still unpublished: it holds risky changes, which only the teacher can publish on the review page.",
                "confirmation": retry.confirmation_action(),
            }));
            result = result.with_hint(hints::needs_teacher_review(&review_url, 1));
            return Ok(result.into());
        }
        let can_add_global_admin_only_exercise_services =
            is_user_global_admin(&mut conn, ctx.principal.user_id).await?;
        let spec_fetcher = (state.exercise_services.spec_fetcher)(Uuid::new_v4());
        let outcome = publish(
            &mut conn,
            changeset.id,
            PublishOptions {
                publisher_user_id: ctx.principal.user_id,
                allow_risky: false,
                can_add_global_admin_only_exercise_services,
            },
            &state.app_conf,
            &*spec_fetcher,
            &*state.exercise_services.fetch_service_info,
        )
        .await?;
        match outcome {
            PublishOutcome::Published {
                changeset,
                redirects,
            } => Ok(ToolResult::success(json!({
                "changeset": changeset.id,
                "published": true,
                "published_at": changeset.published_at,
                "redirects": redirects,
            }))
            .with_hint(hints::published(changeset.id))
            .into()),
            PublishOutcome::Rejected {
                rejection: PublishRejection::NeedsConfirmation { risky_entities },
            } => {
                let reason_count: usize = risky_entities.iter().map(|e| e.risk_reasons.len()).sum();
                let fallback = ToolResult::success(json!({
                    "changeset": changeset.id,
                    "published": false,
                    "reason": "needs_teacher_review",
                    "risky_entities": risky_entities,
                    "review_url": review_url,
                }))
                .with_hint(hints::needs_teacher_review(&review_url, reason_count));
                Ok(ToolOutcome::NeedsConfirmation(ConfirmationRequest {
                    message: format!(
                        "{reason_count} staged change(s) could affect students. Review them and publish or discard the changeset on this page."
                    ),
                    url: review_url,
                    elicitation_id: changeset.id.to_string(),
                    state: json!({"changeset": changeset.id}),
                    fallback,
                }))
            }
            PublishOutcome::Rejected {
                rejection: PublishRejection::Conflicts { conflicts },
            } => Ok(error_result(json!({
                "code": "publish_conflict",
                "message": "Nothing was published: these staged pages or entities changed live after they were staged. Read them again, restage the changes on top of the current version (discard_changeset drops the changeset), then publish.",
                "conflicts": conflicts,
            }))
            .into()),
            PublishOutcome::Rejected {
                rejection: PublishRejection::GlobalAdminOnlyExerciseServices { service_names },
            } => Ok(error_result(json!({
                "code": "forbidden",
                "message": "Nothing was published: the staged pages add exercises of services only administrators may add.",
                "services": service_names,
            }))
            .into()),
        }
    }
}

#[async_trait]
impl ToolHandler<McpState> for DiscardChangeset {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: ChangesetArgs = parse_arguments(arguments)?;
        let mut conn = connection(state).await?;
        let changeset = own_changeset(&mut conn, ctx, &args).await?;
        if !changeset.is_open() {
            return Ok(not_open_result(&changeset).into());
        }
        let discarded = agent_changesets::discard(&mut conn, changeset.id).await?;
        Ok(ToolResult::success(json!({
            "changeset": discarded.id,
            "status": discarded.status,
            "message": "Every staged change in the changeset was dropped; the published course is unchanged.",
        }))
        .into())
    }
}

#[async_trait]
impl ToolHandler<McpState> for GetPreviewLink {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: GetPreviewLinkArgs = parse_arguments(arguments)?;
        let (mut conn, view) = open_course(state, ctx, &args.course).await?;
        let page_id = page_in_course(&view, &args.page)?;
        let Some(changeset) = view.changeset.as_ref() else {
            let page = view
                .live
                .page(page_id)
                .ok_or_else(|| ToolError::Internal("the page vanished".into()))?;
            let organization =
                organizations::get_organization(&mut conn, view.course.organization_id).await?;
            let url = format!(
                "{}{}",
                build_course_url(
                    &state.app_conf.base_url,
                    &organization.slug,
                    &view.course.slug
                ),
                page.url_path
            );
            return Ok(ToolResult::success(json!({
                "url": url,
                "is_staged": false,
                "message": "You have nothing staged in this course, so this is the published page.",
            }))
            .into());
        };
        if view.staged.page(page_id).is_none() {
            return Err(ToolError::NotFound {
                message: format!("page {page_id} is deleted in your staged changes"),
            });
        }
        let token =
            mint_preview_token(&state.jwt_key, changeset.id, page_id, ctx.principal.user_id)?;
        Ok(ToolResult::success(json!({
            "url": state.public_url(&format!("/agent-preview/{token}")),
            "is_staged": true,
            "changeset": changeset.id,
            "expires_at": Utc::now() + Duration::minutes(PREVIEW_TOKEN_LIFETIME_MINUTES),
        }))
        .into())
    }
}
