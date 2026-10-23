//! The read-only tools: course listing, structure, page content, settings, glossary.

use std::collections::{BTreeMap, HashMap, HashSet, btree_map};

use async_trait::async_trait;
use headless_lms_authorization::{Action, Resource, fetch_user_roles, is_permitted};
use headless_lms_models::{courses, organizations};
use serde_json::{Map, Value, json};
use uuid::Uuid;

use crate::access::{connection, open_course, page_in_course};
use crate::course_state::{CourseView, load_student_activity};
use crate::diff::{self, ChangeKind, Snapshot};
use crate::engine::read::{PendingKind, ReadOptions, ReadResult, ReadState, Selector, read_page};
use crate::engine::read_structure::read_structure;
use crate::snapshots;
use crate::state::McpState;
use crate::tools::args::{CourseArgs, GetCourseStructureArgs, GetPageContentArgs, ListCoursesArgs};
use crate::tools::{
    RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult, parse_arguments,
};

pub struct ListCourses;
pub struct GetCourseStructure;
pub struct GetPageContent;
pub struct GetCourseSettings;
pub struct GetGlossaryAndReferences;

fn pending_kind(kind: ChangeKind) -> Option<PendingKind> {
    match kind {
        ChangeKind::Added => Some(PendingKind::Added),
        ChangeKind::Changed => Some(PendingKind::Changed),
        ChangeKind::Moved => Some(PendingKind::Moved),
        ChangeKind::Removed => None,
    }
}

/// Blocks of the page with staged changes, for marking them in staged reads.
pub(crate) fn page_pending(view: &CourseView, page_id: Uuid) -> HashMap<Uuid, PendingKind> {
    let side = |state| {
        let structure = snapshots::structure(state, &HashSet::new());
        Snapshot {
            pages: snapshots::page_document(state, &structure, page_id)
                .into_iter()
                .collect(),
            ..Default::default()
        }
    };
    diff::diff(&side(&view.live), &side(&view.staged))
        .blocks
        .into_iter()
        .filter_map(|b| Some((b.block_id, pending_kind(b.kind)?)))
        .collect()
}

/// Modules, chapters and pages with staged changes, including pages whose blocks changed.
pub(crate) fn structure_pending(view: &CourseView) -> HashMap<Uuid, PendingKind> {
    let side = |state| Snapshot {
        structure: Some(snapshots::structure(state, &HashSet::new())),
        ..Default::default()
    };
    let mut pending: HashMap<Uuid, PendingKind> =
        diff::diff(&side(&view.live), &side(&view.staged))
            .entities
            .into_iter()
            .filter_map(|e| Some((e.entity_id, pending_kind(e.kind)?)))
            .collect();
    for page in &view.staged.pages {
        if view
            .live
            .page(page.id)
            .is_some_and(|live| live.content != page.content)
        {
            pending.entry(page.id).or_insert(PendingKind::Changed);
        }
    }
    pending
}

/// Splits the client's result budget evenly between the selectors.
fn read_options(
    ctx: &RequestContext,
    selector_count: usize,
    pending: HashMap<Uuid, PendingKind>,
) -> ReadOptions {
    ReadOptions {
        budget_bytes: ctx.capabilities.result_budget_bytes() / selector_count.max(1),
        pending,
    }
}

fn selectors_or_outline(selectors: Option<Vec<Selector>>) -> Vec<Selector> {
    match selectors {
        Some(selectors) if !selectors.is_empty() => selectors,
        _ => vec![Selector::default()],
    }
}

#[async_trait]
impl ToolHandler<McpState> for ListCourses {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let _: ListCoursesArgs = parse_arguments(arguments)?;
        let mut conn = connection(state).await?;
        let user_id = ctx.principal.user_id;
        let roles = fetch_user_roles(&mut conn, Some(user_id)).await?;
        let mut candidates = courses::all_courses_with_roles_for_user(&mut conn, user_id).await?;
        let organization_ids: HashSet<Uuid> =
            roles.iter().filter_map(|r| r.organization_id).collect();
        for organization_id in organization_ids {
            candidates.extend(courses::get_by_organization_id(&mut conn, organization_id).await?);
        }
        candidates.sort_by(|a, b| a.name.cmp(&b.name).then(a.id.cmp(&b.id)));
        candidates.dedup_by_key(|c| c.id);

        let mut organization_names: BTreeMap<Uuid, String> = BTreeMap::new();
        let mut listed = Vec::new();
        for course in candidates {
            if course.deleted_at.is_some()
                || !is_permitted(&mut conn, Action::Edit, Resource::Course(course.id), &roles)
                    .await?
            {
                continue;
            }
            if let btree_map::Entry::Vacant(entry) =
                organization_names.entry(course.organization_id)
            {
                entry.insert(
                    organizations::get_organization(&mut conn, course.organization_id)
                        .await?
                        .name,
                );
            }
            listed.push(json!({
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
                "url": state.public_url(&format!("/manage/courses/{}", course.id)),
            }));
        }
        let mut result = json!({ "courses": listed });
        if roles.iter().any(|r| r.is_global) {
            result["note"] = json!(
                "Your account has a global role, which allows editing every course; only courses where you hold a course or organization role are listed. Any other course works by its id."
            );
        }
        Ok(ToolResult::success(result).into())
    }
}

#[async_trait]
impl ToolHandler<McpState> for GetCourseStructure {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: GetCourseStructureArgs = parse_arguments(arguments)?;
        let (mut conn, view) = open_course(state, ctx, &args.course).await?;
        let activity = load_student_activity(&mut conn, view.course.id).await?;
        let selectors = selectors_or_outline(args.selectors);
        let pending = structure_pending(&view);
        let mut reads: Vec<ReadResult> = Vec::with_capacity(selectors.len());
        for selector in &selectors {
            let read_state = selector.state.unwrap_or_default();
            let structure =
                snapshots::structure(view.state(read_state), &activity.pages_with_submissions);
            let options = read_options(
                ctx,
                selectors.len(),
                if read_state == ReadState::Staged {
                    pending.clone()
                } else {
                    HashMap::new()
                },
            );
            reads.push(read_structure(&structure, selector, &options)?);
        }
        Ok(ToolResult::success(json!({
            "course": {"id": view.course.id, "name": view.staged.settings.name, "slug": view.course.slug},
            "has_staged_changes": view.changeset.is_some() && !view.staged_entities.is_empty(),
            "reads": reads,
        }))
        .into())
    }
}

#[async_trait]
impl ToolHandler<McpState> for GetPageContent {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: GetPageContentArgs = parse_arguments(arguments)?;
        let (_conn, view) = open_course(state, ctx, &args.course).await?;
        let page_id = page_in_course(&view, &args.page)?;
        let selectors = selectors_or_outline(args.selectors);
        let pending = page_pending(&view, page_id);
        let mut reads = Vec::with_capacity(selectors.len());
        let mut page_info = Value::Null;
        for selector in &selectors {
            let read_state = selector.state.unwrap_or_default();
            let course_state = view.state(read_state);
            let structure = snapshots::structure(course_state, &HashSet::new());
            let document = snapshots::page_document(course_state, &structure, page_id)
                .ok_or_else(|| ToolError::NotFound {
                    message: match read_state {
                        ReadState::Staged => format!(
                            "page {page_id} is deleted in your staged changes; state: published reads the live page"
                        ),
                        ReadState::Published => format!(
                            "page {page_id} isn't published yet; it exists only in your staged changes"
                        ),
                    },
                })?;
            if page_info.is_null()
                && let Some(page) = course_state.page(page_id)
            {
                page_info = json!({
                    "id": page.id,
                    "title": page.title,
                    "url_path": page.url_path,
                    "hidden": page.hidden,
                    "page_type": document.page_type,
                    "has_staged_changes": !pending.is_empty() || view.live.page(page_id) != view.staged.page(page_id),
                });
            }
            let options = read_options(
                ctx,
                selectors.len(),
                if read_state == ReadState::Staged {
                    pending.clone()
                } else {
                    HashMap::new()
                },
            );
            reads.push(read_page(&document, selector, &options)?);
        }
        Ok(ToolResult::success(json!({"page": page_info, "reads": reads})).into())
    }
}

#[async_trait]
impl ToolHandler<McpState> for GetCourseSettings {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: CourseArgs = parse_arguments(arguments)?;
        let (_conn, view) = open_course(state, ctx, &args.course).await?;
        let staged = snapshots::settings_document(&view.staged);
        let has_staged_changes = staged != snapshots::settings_document(&view.live);
        Ok(ToolResult::success(json!({
            "settings": staged,
            "has_staged_changes": has_staged_changes,
            "read_only_fields": ["slug", "language_code", "is_draft", "is_test_mode", "closed_at"],
        }))
        .into())
    }
}

#[async_trait]
impl ToolHandler<McpState> for GetGlossaryAndReferences {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: CourseArgs = parse_arguments(arguments)?;
        let (_conn, view) = open_course(state, ctx, &args.course).await?;
        let staged = snapshots::glossary_document(&view.staged);
        let live = snapshots::glossary_document(&view.live);
        let pending: Vec<Uuid> = staged
            .glossary
            .iter()
            .filter(|t| !live.glossary.contains(t))
            .map(|t| t.id)
            .chain(
                staged
                    .references
                    .iter()
                    .filter(|r| !live.references.contains(r))
                    .map(|r| r.id),
            )
            .collect();
        let mut result = serde_json::to_value(&staged).unwrap_or_default();
        result["staged_changes"] = json!(pending);
        Ok(ToolResult::success(result).into())
    }
}
