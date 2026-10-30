//! Changeset tools: listing, publishing, discarding and previewing staged changes.

use async_trait::async_trait;
use headless_lms_authorization::{fetch_user_roles, is_user_global_admin};
use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::{
    ModelErrorType,
    agent_changeset_entities::{self, AgentChangesetEntityOperation},
    agent_changesets::{self, AgentChangeset, AgentChangesetStatus},
    courses::{self, Course},
    error::TryToOptional,
    library::agent_changesets::{
        ChangedSinceReview, ChangesetSummary, DiscardOutcome, DiscardRejection, PublishOptions,
        PublishOutcome, PublishRejection, RiskBaseline, discard, discard_entities, get_summaries,
        mint_preview_token, preview_path, publish,
    },
    library::entity_snapshots::{ContentEntityType, EntityKey},
    organizations,
    pages::{self, Page},
};
use headless_lms_utils::course_url::course_page_url;
use serde_json::{Value, json};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::access::{authorize_course, connection, deleted_in_staged_changes, editable_courses};
use crate::explanations::{ExplainedEntity, explain_blockers};
use crate::hints;
use crate::page_readiness;
use crate::state::McpState;
use crate::tools::args::{
    ChangesetArgs, DiscardChangesetArgs, GetPreviewLinkArgs, IdArgument, ListChangesetsArgs,
};
use crate::tools::{
    ConfirmationRequest, RequestContext, ToolError, ToolErrorCode, ToolHandler, ToolOutcome,
    ToolResult,
};
use headless_lms_models::library::agent_changesets::course_state::{
    CourseParts, CourseView, load_view,
};

/// Handler of the `list_changesets` tool.
pub struct ListChangesets;
/// Handler of the `publish_changeset` tool.
pub struct PublishChangeset;
/// Handler of the `discard_changeset` tool.
pub struct DiscardChangeset;
/// Handler of the `get_preview_link` tool.
pub struct GetPreviewLink;

/// Published, discarded and expired changesets listed besides the open ones.
const RECENT_CLOSED_CHANGESETS: i64 = 10;

fn explained(entities: Vec<impl Into<ExplainedEntity>>) -> Vec<ExplainedEntity> {
    entities.into_iter().map(Into::into).collect()
}

fn summary_json(state: &McpState, summary: ChangesetSummary) -> Value {
    let changeset = &summary.changeset;
    json!({
        "id": changeset.id,
        "course": changeset.course_id,
        "status": changeset.status,
        "revision": changeset.revision,
        "created_at": changeset.created_at,
        "expires_at": changeset.is_open().then_some(changeset.expires_at),
        "published_at": changeset.published_at,
        "is_expiring_soon": summary.is_expiring_soon,
        "has_risky_changes": summary.has_risky_changes,
        "review_url": state.review_url(changeset.course_id, changeset.id),
        "entities": explained(summary.entities),
    })
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for ListChangesets {
    type Args = ListChangesetsArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: ListChangesetsArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let user_id = ctx.principal.actor.user_id;
        let mut conn = connection(state).await?;
        let course_ids = match &args.course {
            Some(course) => {
                let course_id = course.id();
                authorize_course(&mut conn, user_id, course_id).await?;
                vec![course_id]
            }
            None => {
                let roles = fetch_user_roles(&mut conn, Some(user_id)).await?;
                let course_ids =
                    agent_changesets::get_course_ids_by_user(&mut conn, user_id).await?;
                let courses = courses::get_by_ids(&mut conn, &course_ids).await?;
                editable_courses(&roles, courses)
                    .into_iter()
                    .map(|course| course.id)
                    .collect()
            }
        };
        let listed = agent_changesets::get_open_and_recent_by_user(
            &mut conn,
            user_id,
            &course_ids,
            RECENT_CLOSED_CHANGESETS,
        )
        .await?;
        let (open, closed): (Vec<ChangesetSummary>, Vec<ChangesetSummary>) =
            get_summaries(&mut conn, listed)
                .await?
                .into_iter()
                .partition(|summary| summary.changeset.is_open());
        let as_json = |summaries: Vec<ChangesetSummary>| -> Vec<Value> {
            summaries
                .into_iter()
                .map(|summary| summary_json(state, summary))
                .collect()
        };
        Ok(ToolResult::success(json!({"open": as_json(open), "recent": as_json(closed)})).into())
    }
}

/// The course and the user's own changeset in it, or not found.
async fn own_changeset(
    conn: &mut PgConnection,
    ctx: &RequestContext,
    course_id: Uuid,
    changeset_id: Uuid,
) -> Result<(Course, AgentChangeset), ToolError> {
    let course = authorize_course(conn, ctx.principal.actor.user_id, course_id).await?;
    let not_found = || ToolError::NotFound {
        message: format!(
            "you have no changeset {changeset_id} in course {course_id}; list_changesets lists yours"
        ),
    };
    let changeset =
        agent_changesets::get_by_id_for_user(conn, changeset_id, ctx.principal.actor.user_id)
            .await
            .map_err(|error| match error.error_type() {
                ModelErrorType::NotFound | ModelErrorType::RecordNotFound => not_found(),
                _ => error.into(),
            })?;
    if changeset.course_id != course_id {
        return Err(not_found());
    }
    Ok((course, changeset))
}

/// The result for a changeset that is no longer open.
fn not_open_result(changeset_id: Uuid, status: AgentChangesetStatus) -> ToolResult {
    let mut result = ToolResult::success(json!({
        "changeset": changeset_id,
        "status": status,
        "published": status == AgentChangesetStatus::Published,
        "message": match status {
            AgentChangesetStatus::Published => "The changeset is already published.",
            AgentChangesetStatus::Discarded => "The changeset was discarded; nothing of it was published.",
            AgentChangesetStatus::Expired => "The changeset expired; nothing of it was published.",
            AgentChangesetStatus::Open => "The changeset is still open.",
        },
    }));
    if status == AgentChangesetStatus::Published {
        result = result.with_hint(hints::published(changeset_id));
    }
    result
}

/// Refuses publishing while a page whose blocks the changeset changes has no page title block or
/// still holds template placeholder text.
fn check_pages_ready(view: &CourseView) -> Result<(), ToolError> {
    let mut untitled = Vec::new();
    let mut with_placeholders = Vec::new();
    for page in page_readiness::pages_with_content_changes(&view.staged, &view.live) {
        if !page_readiness::has_page_title(&page.content) {
            untitled.push(page);
        }
        let placeholders = page_readiness::placeholder_texts(&page.content);
        if !placeholders.is_empty() {
            with_placeholders.push((page, placeholders));
        }
    }
    if untitled.is_empty() && with_placeholders.is_empty() {
        return Ok(());
    }
    let mut problems = Vec::new();
    if !untitled.is_empty() {
        let pages: Vec<String> = untitled
            .iter()
            .map(|page| format!("\"{}\" ({})", page.title, page.id))
            .collect();
        problems.push(format!(
            "these pages have no page title: {}. Add a moocfi/hero-section with the page title as the first block (moocfi/landing-page-hero-section on the course front page); it is the only h1 course pages allow",
            pages.join(", ")
        ));
    }
    if !with_placeholders.is_empty() {
        let pages: Vec<String> = with_placeholders
            .iter()
            .map(|(page, placeholders)| {
                let blocks: Vec<String> = placeholders
                    .iter()
                    .map(|p| format!("{} {} \"{}\"", p.block_name, p.block, p.text))
                    .collect();
                format!("\"{}\" ({}): {}", page.title, page.id, blocks.join(", "))
            })
            .collect();
        problems.push(format!(
            "these pages still hold placeholder text from the default page template: {}. Replace it with the course's own text or remove those blocks",
            pages.join("; ")
        ));
    }
    Err(ToolError::refused(
        ToolErrorCode::PagesNotReady,
        format!(
            "Nothing was published: {}. Fix the pages with patch_page_content, then publish again.",
            problems.join("; and ")
        ),
        json!({
            "pages_without_title": untitled.iter().map(|page| page.id).collect::<Vec<_>>(),
            "pages_with_placeholders": with_placeholders
                .iter()
                .map(|(page, placeholders)| json!({"page": page.id, "placeholders": placeholders}))
                .collect::<Vec<_>>(),
        }),
    ))
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for PublishChangeset {
    type Args = ChangesetArgs;
    const ASKS_FOR_CONFIRMATION: bool = true;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: ChangesetArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let mut conn = connection(state).await?;
        let (course, changeset) =
            own_changeset(&mut conn, ctx, args.course.id(), args.changeset.id()).await?;
        if !changeset.is_open() {
            return Ok(not_open_result(changeset.id, changeset.status).into());
        }
        let view = load_view(
            &mut conn,
            ctx.principal.actor.user_id,
            course,
            CourseParts::All,
        )
        .await?;
        check_pages_ready(&view)?;
        let review_url = state.review_url(changeset.course_id, changeset.id);
        let can_add_global_admin_only_exercise_services =
            is_user_global_admin(&mut conn, ctx.principal.actor.user_id).await?;
        let spec_fetcher = (state.exercise_services.spec_fetcher)();
        let outcome = publish(
            &mut conn,
            changeset.id,
            PublishOptions {
                can_add_global_admin_only_exercise_services,
                reviewed_revision: None,
            },
            &state.app_conf,
            &*spec_fetcher,
            &*state.exercise_services.fetch_service_info,
        )
        .await?;
        let rejection = match outcome {
            PublishOutcome::Published {
                changeset,
                redirects,
            } => {
                return Ok(ToolResult::success(json!({
                    "changeset": changeset.id,
                    "published": true,
                    "published_at": changeset.published_at,
                    "redirects": redirects,
                }))
                .with_hint(hints::published(changeset.id))
                .into());
            }
            PublishOutcome::Rejected { rejection } => rejection,
        };
        match rejection {
            PublishRejection::NeedsConfirmation { risky_entities } => {
                let reason_count: usize = risky_entities.iter().map(|e| e.risk_reasons.len()).sum();
                let fallback = ToolResult::success(json!({
                    "changeset": changeset.id,
                    "published": false,
                    "reason": "needs_teacher_review",
                    "risky_entities": explained(risky_entities),
                    "review_url": review_url,
                }))
                .with_hint(hints::needs_teacher_review(&review_url, reason_count));
                if let Some(retry) = &ctx.retry {
                    // The teacher answered on the review page without publishing everything; asking
                    // again would loop.
                    let mut result = fallback;
                    result
                        .structured
                        .insert("confirmation".into(), json!(retry.confirmation_action()));
                    return Ok(result.into());
                }
                Ok(ToolOutcome::NeedsConfirmation(ConfirmationRequest {
                    message: format!(
                        "{reason_count} staged change(s) could affect students. Review them and publish or discard the changeset on this page."
                    ),
                    url: review_url,
                    elicitation_id: changeset.id.to_string(),
                    fallback,
                }))
            }
            PublishRejection::Conflicts { conflicts } => Err(ToolError::refused(
                ToolErrorCode::PublishConflict,
                "Nothing was published: these staged pages or entities changed live after they were staged. Drop them with discard_changeset and entities set to their ids, read their published state again, redo your edits to them on top of it, then publish.",
                json!({"conflicts": conflicts}),
            )),
            PublishRejection::ChangedSinceReview(_) => Err(ToolError::Internal(
                "a review-page revision check rejected an agent publish; nothing was published"
                    .into(),
            )),
            PublishRejection::GlobalAdminOnlyExerciseServices { service_names } => {
                Err(ToolError::refused(
                    ToolErrorCode::AdminOnlyExerciseServices,
                    "Nothing was published: the staged pages add exercises of services only administrators may add.",
                    json!({"services": service_names}),
                ))
            }
            PublishRejection::Blockers { blockers } => Err(ToolError::refused(
                ToolErrorCode::PublishFailed,
                "Nothing was published: with the staged changes the course would break rules publishing relies on. Fix the staged entities named here with the patch tools, or drop them with discard_changeset, then publish again.",
                json!({"blockers": explain_blockers(blockers)}),
            )),
            PublishRejection::NotOpen { status } => {
                Ok(not_open_result(changeset.id, status).into())
            }
            PublishRejection::SaveFailed { entity, message } => Err(ToolError::refused(
                ToolErrorCode::PublishFailed,
                format!(
                    "Nothing was published: saving the staged changes failed: {message}. Fix the staged entities with the patch tools, or drop them with discard_changeset, then publish again."
                ),
                json!({"entity": entity}),
            )),
        }
    }
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for DiscardChangeset {
    type Args = DiscardChangesetArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: DiscardChangesetArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let mut conn = connection(state).await?;
        let (course, changeset) =
            own_changeset(&mut conn, ctx, args.course.id(), args.changeset.id()).await?;
        if !changeset.is_open() {
            return Ok(not_open_result(changeset.id, changeset.status).into());
        }
        let Some(entity_ids) = &args.entities else {
            return match discard(&mut conn, changeset.id, args.revision).await? {
                DiscardOutcome::Discarded { changeset } => Ok(ToolResult::success(json!({
                    "changeset": changeset.id,
                    "status": changeset.status,
                    "message": "Every staged change in the changeset was dropped; the published course is unchanged.",
                }))
                .into()),
                DiscardOutcome::Rejected { rejection } => discard_rejected(changeset.id, rejection),
            };
        };
        discard_some(
            &mut conn,
            ctx,
            course,
            &changeset,
            entity_ids,
            args.revision,
        )
        .await
    }
}

fn discard_rejected(
    changeset_id: Uuid,
    rejection: DiscardRejection,
) -> Result<ToolOutcome, ToolError> {
    match rejection {
        DiscardRejection::NotOpen { status } => Ok(not_open_result(changeset_id, status).into()),
        DiscardRejection::ChangedSinceReview(ChangedSinceReview { revision }) => {
            Err(ToolError::refused(
                ToolErrorCode::ChangesetChanged,
                format!(
                    "Nothing was dropped: the changeset is at revision {revision}, not the one you gave, so it holds changes you haven't seen. list_changesets shows what it holds now."
                ),
                json!({"revision": revision}),
            ))
        }
        DiscardRejection::Blockers { blockers } => Err(ToolError::refused(
            ToolErrorCode::DiscardConflict,
            "Nothing was dropped: without these entities the rest of the changeset couldn't be published. Include the entities those changes depend on, or discard the whole changeset.",
            json!({"blockers": explain_blockers(blockers)}),
        )),
    }
}

/// Drops only the listed entities, refusing if the rest would no longer publish.
async fn discard_some(
    conn: &mut PgConnection,
    ctx: &RequestContext,
    course: Course,
    changeset: &AgentChangeset,
    entity_ids: &[IdArgument],
    revision: Option<i32>,
) -> Result<ToolOutcome, ToolError> {
    if entity_ids.is_empty() {
        return Err(ToolError::InvalidArguments {
            message: "entities is empty; leave it out to discard the whole changeset".into(),
        });
    }
    let ids: Vec<Uuid> = entity_ids.iter().map(|id| id.id()).collect();
    let view = load_view(conn, ctx.principal.actor.user_id, course, CourseParts::All).await?;
    let mut keys = Vec::with_capacity(ids.len());
    let mut unknown = Vec::new();
    for id in ids {
        match view.staged_entities.keys().find(|key| key.entity_id == id) {
            Some(key) => keys.push(*key),
            None => unknown.push(id),
        }
    }
    if !unknown.is_empty() {
        return Err(ToolError::NotFound {
            message: format!(
                "the changeset has nothing staged for {unknown:?}; list_changesets lists its entities"
            ),
        });
    }
    let discarded = match discard_entities(
        conn,
        changeset.id,
        &keys,
        revision,
        &RiskBaseline::View(&view),
    )
    .await?
    {
        Ok(discarded) => discarded,
        Err(rejection) => return discard_rejected(changeset.id, rejection),
    };
    Ok(ToolResult::success(json!({
        "changeset": changeset.id,
        "status": AgentChangesetStatus::Open,
        "discarded": discarded,
        "message": "These entities were dropped from the changeset and show their published state again; the rest stays staged.",
    }))
    .with_hint(hints::staged(changeset.id))
    .into())
}

/// The page as published, if the course has it.
async fn live_page(
    conn: &mut PgConnection,
    course: &Course,
    page_id: Uuid,
) -> Result<Option<Page>, ToolError> {
    Ok(pages::get_page(conn, page_id)
        .await
        .optional()?
        .filter(|page| {
            page.course_id == Some(course.id) && page.deleted_at.is_none() && page.exam_id.is_none()
        }))
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for GetPreviewLink {
    type Args = GetPreviewLinkArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: GetPreviewLinkArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let course_id = args.course.id();
        let page_id = args.page.id();
        let user_id = ctx.principal.actor.user_id;
        let mut conn = connection(state).await?;
        let course = authorize_course(&mut conn, user_id, course_id).await?;
        let not_found = || ToolError::NotFound {
            message: format!(
                "course {course_id} has no page {page_id}; get_course_structure lists its pages"
            ),
        };
        let Some(changeset) = agent_changesets::get_open(&mut conn, user_id, course.id).await?
        else {
            let page = live_page(&mut conn, &course, page_id)
                .await?
                .ok_or_else(not_found)?;
            let organization =
                organizations::get_organization(&mut conn, course.organization_id).await?;
            let url = course_page_url(
                &state.app_conf.base_url,
                &organization.slug,
                &course.slug,
                &page.url_path,
            )
            .ok_or_else(|| ToolError::Internal("the configured base URL is invalid".into()))?;
            return Ok(ToolResult::success(json!({
                "url": url,
                "is_staged": false,
                "message": "You have nothing staged in this course, so this is the published page.",
            }))
            .into());
        };
        let key = EntityKey::new(ContentEntityType::Page, page_id);
        match agent_changeset_entities::get_operation(&mut conn, changeset.id, key).await? {
            Some(AgentChangesetEntityOperation::Delete) => {
                return Err(deleted_in_staged_changes(page_id));
            }
            Some(_) => {}
            None => {
                live_page(&mut conn, &course, page_id)
                    .await?
                    .ok_or_else(not_found)?;
            }
        }
        let preview = mint_preview_token(&state.jwt_key, changeset.id, page_id, user_id)?;
        Ok(ToolResult::success(json!({
            "url": state.app_conf.public_url(&preview_path(&preview.token)),
            "is_staged": true,
            "changeset": changeset.id,
            "expires_at": preview.expires_at,
        }))
        .into())
    }
}
