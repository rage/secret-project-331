//! Course-wide text and block replacement.

use async_trait::async_trait;
use serde::Serialize;
use serde_json::json;
use uuid::Uuid;

use crate::access::{connection, open_course};
use crate::engine::find_replace::{FindReplaceRequest, InflectedVariant, TextMatch, find_replace};
use crate::engine::structural_replace::structural_replace;
use crate::engine::{BlockMatch, Document, DocumentRef, PageRef};
use crate::exercises;
use crate::ids::RandomIds;
use crate::snapshots;
use crate::staging::{self, WriteRequest};
use crate::state::McpState;
use crate::tools::args::{ContentScope, FindReplaceArgs, IdArgument, StructuralReplaceArgs};
use crate::tools::{
    McpScope, RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult, off_worker,
};
use headless_lms_models::library::agent_changesets::course_state::{CourseState, CourseView};

pub struct FindReplace;
pub struct StructuralReplace;

#[derive(Serialize)]
struct FindReplaceSummary<'a> {
    total: usize,
    matches: &'a [TextMatch],
    #[serde(
        rename = "inflected_variants_not_changed",
        skip_serializing_if = "<[_]>::is_empty"
    )]
    inflected_variants: &'a [InflectedVariant],
}

#[derive(Serialize)]
struct StructuralReplaceSummary<'a> {
    total: usize,
    matches: &'a [BlockMatch],
}

/// The pages of `state` a scope covers: one page, one chapter's pages or the whole course.
fn pages_in_scope(
    state: &CourseState,
    scope: Option<ContentScope>,
) -> Result<Vec<PageRef<'_>>, ToolError> {
    let course_id = state.course_id();
    if let Some(page_id) = scope.and_then(|s| s.page).map(IdArgument::id) {
        let page = state.page(page_id).ok_or_else(|| ToolError::NotFound {
            message: format!("course {course_id} has no page {page_id}"),
        })?;
        return Ok(vec![snapshots::page_ref(page)]);
    }
    if let Some(chapter_id) = scope.and_then(|s| s.chapter).map(IdArgument::id) {
        if !state.chapters.iter().any(|c| c.id == chapter_id) {
            return Err(ToolError::NotFound {
                message: format!("course {course_id} has no chapter {chapter_id}"),
            });
        }
        return Ok(state
            .pages_in_order(Some(chapter_id))
            .into_iter()
            .map(snapshots::page_ref)
            .collect());
    }
    Ok(snapshots::page_refs(state))
}

/// The course default review instructions are in scope for the whole course, or when an exercise
/// in scope shows them.
async fn texts_in_scope(
    state: &McpState,
    view: &mut CourseView,
    scope: Option<ContentScope>,
    with_instructions: bool,
    with_names: bool,
) -> Result<(Vec<Uuid>, Vec<Document>), ToolError> {
    let page_ids: Vec<Uuid> = pages_in_scope(&view.staged, scope)?
        .iter()
        .map(|page| page.page_id)
        .collect();
    if !with_instructions && !with_names {
        return Ok((page_ids, Vec::new()));
    }
    view.load_exercises_on_pages(&mut *connection(state).await?, &page_ids)
        .await?;
    let is_whole_course = scope.is_none_or(|s| s.page.is_none() && s.chapter.is_none());
    let texts = exercises::text_documents(
        &view.staged,
        &page_ids,
        with_instructions,
        is_whole_course,
        with_names,
    );
    Ok((page_ids, texts))
}

/// What the engine reads: the pages, then the exercise texts.
fn engine_documents<'a>(
    staged: &'a CourseState,
    page_ids: &[Uuid],
    texts: &'a [Document],
) -> Vec<DocumentRef<'a>> {
    page_ids
        .iter()
        .filter_map(|id| staged.page(*id))
        .map(|page| DocumentRef::from(snapshots::page_ref(page)))
        .chain(texts.iter().map(Document::as_document_ref))
        .collect()
}

/// Stages what a bulk edit changed as one call; when it changed nothing, the result is `summary`
/// alone.
async fn stage_changed(
    state: &McpState,
    ctx: &RequestContext,
    view: &CourseView,
    changed: Vec<Document>,
    request: WriteRequest,
    summary: &impl Serialize,
) -> Result<ToolOutcome, ToolError> {
    if changed.is_empty() {
        return Ok(ToolResult::success(summary).into());
    }
    let mut after = view.staged.clone();
    exercises::apply_documents(&mut after, changed)?;
    let report = staging::commit(state, ctx, view, after, request).await?;
    Ok(report.into_result(summary).into())
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for FindReplace {
    type Args = FindReplaceArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: FindReplaceArgs,
    ) -> Result<ToolOutcome, ToolError> {
        if args.replace.is_some() {
            ctx.require_scope(McpScope::MaterialStage)?;
        }
        let mut view = open_course(state, ctx, args.course.id()).await?;
        let audit = json!(&args);
        let (page_ids, texts) = texts_in_scope(
            state,
            &mut view,
            args.scope,
            args.include_exercise_instructions.unwrap_or(true),
            args.include_exercise_names.unwrap_or(false),
        )
        .await?;
        let request = FindReplaceRequest {
            find: args.find,
            replace: args.replace,
            is_regex: args.regex,
            attributes: args.attributes,
            expected_count: args.expected_count.map(|c| c as usize),
        };
        let staged = view.staged.clone();
        let result = off_worker(move || {
            find_replace(&engine_documents(&staged, &page_ids, &texts), &request)
        })
        .await??;
        let summary = FindReplaceSummary {
            total: result.total(),
            matches: &result.matches,
            inflected_variants: &result.inflected_variants,
        };
        let request = WriteRequest::new(
            audit,
            format!(
                "replaced {} match(es) in {} page(s) or exercise text(s)",
                summary.total,
                result.changed_pages.len()
            ),
            args.dry_run,
        );
        stage_changed(state, ctx, &view, result.changed_pages, request, &summary).await
    }
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for StructuralReplace {
    type Args = StructuralReplaceArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: StructuralReplaceArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let mut view = open_course(state, ctx, args.course.id()).await?;
        let audit = json!(&args);
        let StructuralReplaceArgs {
            scope,
            pattern,
            action,
            expected_count,
            include_exercise_instructions,
            dry_run,
            ..
        } = args;
        let (page_ids, texts) = texts_in_scope(
            state,
            &mut view,
            scope,
            include_exercise_instructions.unwrap_or(true),
            false,
        )
        .await?;
        let staged = view.staged.clone();
        let result = off_worker(move || {
            structural_replace(
                &engine_documents(&staged, &page_ids, &texts),
                &pattern,
                &action,
                expected_count.map(|c| c as usize),
                &RandomIds,
            )
        })
        .await??;
        let summary = StructuralReplaceSummary {
            total: result.matches.len(),
            matches: &result.matches,
        };
        let request = WriteRequest::new(
            audit,
            format!(
                "{} block(s) in {} page(s) or exercise text(s)",
                summary.total,
                result.changed_pages.len()
            ),
            dry_run,
        );
        stage_changed(state, ctx, &view, result.changed_pages, request, &summary).await
    }
}
