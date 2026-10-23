//! The read-only tools: course listing, structure, page content, settings, glossary.

use std::cell::OnceCell;
use std::collections::{HashMap, HashSet};

use async_trait::async_trait;
use headless_lms_authorization::{Action, fetch_user_roles, is_permitted_on_course};
use headless_lms_models::{
    courses,
    library::entity_snapshots::{ContentEntityType, EntityKey},
    organizations, peer_or_self_review_configs,
};
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::access::{connection, load_page_facts, open_course, open_course_parts, page_in_course};
use crate::diff::{self, ChangeKind};
use crate::engine::PageType;
use crate::engine::read::{ReadOptions, ReadResult, ReadState, Selector, read_page};
use crate::engine::read_structure::read_structure;
use crate::snapshots;
use crate::state::McpState;
use crate::tools::args::{CourseArgs, GetCourseStructureArgs, GetPageContentArgs, ListCoursesArgs};
use crate::tools::{RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult};
use headless_lms_models::library::agent_changesets::course_state::{
    CourseParts, CourseState, CourseView,
};

pub struct ListCourses;
pub struct GetCourseStructure;
pub struct GetPageContent;
pub struct GetCourseSettings;
pub struct GetGlossaryAndReferences;

const STRUCTURE_ENTITIES: [ContentEntityType; 3] = [
    ContentEntityType::Module,
    ContentEntityType::Chapter,
    ContentEntityType::Page,
];
/// Module rows count because the settings document holds each module's settings.
const SETTINGS_ENTITIES: [ContentEntityType; 2] =
    [ContentEntityType::CourseSettings, ContentEntityType::Module];
const GLOSSARY_ENTITIES: [ContentEntityType; 2] = [
    ContentEntityType::GlossaryTerm,
    ContentEntityType::Reference,
];

/// The entities of `entity_types` that the user's changeset stages, deleted ones included. Every
/// read tool's `has_staged_changes` comes from these rows.
fn staged_keys<'a>(
    view: &'a CourseView,
    entity_types: &'a [ContentEntityType],
) -> impl Iterator<Item = EntityKey> + 'a {
    view.staged_entities
        .keys()
        .copied()
        .filter(|(entity_type, _)| entity_types.contains(entity_type))
}

fn state_of(view: &CourseView, read_state: ReadState) -> &CourseState {
    match read_state {
        ReadState::Staged => &view.staged,
        ReadState::Published => &view.live,
    }
}

/// Blocks of the page with staged changes, for marking them in staged reads.
pub(crate) fn page_pending(view: &CourseView, page_id: Uuid) -> HashMap<Uuid, ChangeKind> {
    diff::diff_pages(&view.live, &view.staged, &[page_id])
        .into_iter()
        .filter(|b| b.kind != ChangeKind::Removed)
        .map(|b| (b.block_id, b.kind))
        .collect()
}

/// Splits the client's result budget evenly between the selectors. `pending` marks only staged
/// reads.
fn read_options<'a>(
    ctx: &RequestContext,
    selector_count: usize,
    read_state: ReadState,
    pending: &'a HashMap<Uuid, ChangeKind>,
) -> ReadOptions<'a> {
    ReadOptions {
        budget_bytes: ctx.client.result_budget_bytes() / selector_count.max(1),
        pending: match read_state {
            ReadState::Staged => Some(pending),
            ReadState::Published => None,
        },
    }
}

fn selectors_or_outline(selectors: Option<Vec<Selector>>) -> Vec<Selector> {
    match selectors {
        Some(selectors) if !selectors.is_empty() => selectors,
        _ => vec![Selector::default()],
    }
}

/// The page facts `get_page_content` reports with its reads.
#[derive(Serialize)]
struct PageInfo<'a> {
    id: Uuid,
    title: &'a str,
    url_path: &'a str,
    hidden: bool,
    page_type: PageType,
    has_staged_changes: bool,
}

fn missing_page(page_id: Uuid, read_state: ReadState) -> ToolError {
    ToolError::NotFound {
        message: match read_state {
            ReadState::Staged => format!(
                "page {page_id} is deleted in your staged changes; state: published reads the live page"
            ),
            ReadState::Published => {
                format!("page {page_id} isn't published yet; it exists only in your staged changes")
            }
        },
    }
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for ListCourses {
    type Args = ListCoursesArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        _: ListCoursesArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let mut conn = connection(state).await?;
        let user_id = ctx.principal.actor.user_id;
        let roles = fetch_user_roles(&mut conn, Some(user_id)).await?;
        let courses: Vec<_> = courses::get_by_course_or_organization_role(&mut conn, user_id)
            .await?
            .into_iter()
            .filter(|c| is_permitted_on_course(&roles, Action::Edit, c.id, c.organization_id))
            .collect();
        let organization_ids: HashSet<Uuid> = courses.iter().map(|c| c.organization_id).collect();
        let organization_ids: Vec<Uuid> = organization_ids.into_iter().collect();
        let organization_names: HashMap<Uuid, String> =
            organizations::get_by_ids(&mut conn, &organization_ids)
                .await?
                .into_iter()
                .map(|organization| (organization.id, organization.name))
                .collect();
        let group_ids: HashSet<Uuid> = courses.iter().map(|c| c.course_language_group_id).collect();
        let group_ids: Vec<Uuid> = group_ids.into_iter().collect();
        let mut versions_by_group: HashMap<Uuid, Vec<courses::Course>> = HashMap::new();
        for version in courses::get_by_course_language_group_ids(&mut conn, &group_ids).await? {
            versions_by_group
                .entry(version.course_language_group_id)
                .or_default()
                .push(version);
        }
        let listed: Vec<Value> = courses
            .iter()
            .map(|course| {
                let language_versions: Vec<Value> = versions_by_group
                    .get(&course.course_language_group_id)
                    .into_iter()
                    .flatten()
                    .filter(|version| version.id != course.id)
                    .map(
                        |version| json!({"id": version.id, "language_code": version.language_code}),
                    )
                    .collect();
                json!({
                    "id": course.id,
                    "name": course.name,
                    "slug": course.slug,
                    "language_code": course.language_code,
                    "is_draft": course.is_draft,
                    "is_test_mode": course.is_test_mode,
                    "organization": {
                        "id": course.organization_id,
                        "name": organization_names.get(&course.organization_id),
                    },
                    "url": state.app_conf.public_url(&format!("/manage/courses/{}", course.id)),
                    "copied_from_id": course.copied_from,
                    "language_group_id": course.course_language_group_id,
                    "language_versions": language_versions,
                })
            })
            .collect();
        let mut result = json!({ "courses": listed });
        if roles.iter().any(|r| r.is_global) {
            result["note"] = json!(
                "Your account has a global role, which allows editing every course; only courses where you hold a course or organization role are listed. Any other course works by its id."
            );
        }
        Ok(ToolResult::success(result).into())
    }
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for GetCourseStructure {
    type Args = GetCourseStructureArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: GetCourseStructureArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let view = open_course(state, ctx, args.course.id()).await?;
        let facts = load_page_facts(state, view.course.id).await?;
        let selectors = selectors_or_outline(args.selectors);
        let pending = diff::structure_changes(&view.live, &view.staged);
        // Built only for the states the selectors read: each build walks every block.
        let (live, staged) = (OnceCell::new(), OnceCell::new());
        let mut reads: Vec<ReadResult> = Vec::with_capacity(selectors.len());
        for selector in &selectors {
            let read_state = selector.state.unwrap_or_default();
            let structure = match read_state {
                ReadState::Staged => {
                    staged.get_or_init(|| snapshots::structure(&view.staged, &facts))
                }
                ReadState::Published => {
                    live.get_or_init(|| snapshots::structure(&view.live, &facts))
                }
            };
            let options = read_options(ctx, selectors.len(), read_state, &pending);
            reads.push(read_structure(structure, selector, &options)?);
        }
        Ok(ToolResult::success(json!({
            "course": {"id": view.course.id, "name": view.staged.settings.name, "slug": view.course.slug},
            "has_staged_changes": staged_keys(&view, &STRUCTURE_ENTITIES).next().is_some(),
            "reads": reads,
        }))
        .into())
    }
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for GetPageContent {
    type Args = GetPageContentArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: GetPageContentArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let view = open_course(state, ctx, args.course.id()).await?;
        let page_id = page_in_course(&view, args.page.id())?;
        let selectors = selectors_or_outline(args.selectors);
        let pending = page_pending(&view, page_id);
        let page_in = |read_state| {
            state_of(&view, read_state)
                .page(page_id)
                .ok_or_else(|| missing_page(page_id, read_state))
        };
        let first_state = selectors[0].state.unwrap_or_default();
        let page = page_in(first_state)?;
        let page_info = PageInfo {
            id: page.id,
            title: &page.title,
            url_path: &page.url_path,
            hidden: page.hidden,
            page_type: snapshots::page_type(page),
            has_staged_changes: view
                .staged_row((ContentEntityType::Page, page_id))
                .is_some(),
        };
        let (live, staged) = (OnceCell::new(), OnceCell::new());
        let mut reads = Vec::with_capacity(selectors.len());
        for selector in &selectors {
            let read_state = selector.state.unwrap_or_default();
            let page = page_in(read_state)?;
            let document = match read_state {
                ReadState::Staged => &staged,
                ReadState::Published => &live,
            }
            .get_or_init(|| snapshots::page_ref(page).to_document());
            let options = read_options(ctx, selectors.len(), read_state, &pending);
            reads.push(read_page(document, selector, &options)?);
        }
        Ok(ToolResult::success(json!({"page": page_info, "reads": reads})).into())
    }
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for GetCourseSettings {
    type Args = CourseArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: CourseArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let view = open_course_parts(state, ctx, args.course.id(), CourseParts::Settings).await?;
        let default_peer_review =
            peer_or_self_review_configs::get_course_default_cms_peer_review_configuration(
                &mut *connection(state).await?,
                view.course.id,
            )
            .await?;
        let default_peer_review = default_peer_review.map(|mut default| {
                default
                    .peer_or_self_review_questions
                    .sort_by_key(|question| question.order_number);
                let config = &default.peer_or_self_review_config;
                json!({
                    "peer_reviews_to_give": config.peer_reviews_to_give,
                    "peer_reviews_to_receive": config.peer_reviews_to_receive,
                    "accepting_threshold": config.accepting_threshold,
                    "processing_strategy": config.processing_strategy,
                    "points_are_all_or_nothing": config.points_are_all_or_nothing,
                    "reset_answer_if_zero_points_from_review": config.reset_answer_if_zero_points_from_review,
                    "questions": default.peer_or_self_review_questions.iter().map(|question| json!({
                        "question": question.question,
                        "question_type": question.question_type,
                        "answer_required": question.answer_required,
                        "weight": question.weight,
                    })).collect::<Vec<_>>(),
                })
            });
        Ok(ToolResult::success(json!({
            "settings": snapshots::settings_document(&view.staged, &view.course),
            "default_peer_review": default_peer_review,
            "has_staged_changes": staged_keys(&view, &SETTINGS_ENTITIES).next().is_some(),
            "read_only_fields": ["slug", "language_code", "is_draft", "is_test_mode", "closed_at"],
        }))
        .into())
    }
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for GetGlossaryAndReferences {
    type Args = CourseArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: CourseArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let view = open_course_parts(state, ctx, args.course.id(), CourseParts::Glossary).await?;
        let staged_ids: Vec<Uuid> = staged_keys(&view, &GLOSSARY_ENTITIES)
            .map(|(_, id)| id)
            .collect();
        let mut result =
            serde_json::to_value(snapshots::glossary_document(&view.staged)).unwrap_or_default();
        result["staged_changes"] = json!(staged_ids);
        Ok(ToolResult::success(result).into())
    }
}
