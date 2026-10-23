//! The four patch tools: page content, course structure, settings, glossary and references.

use std::collections::{BTreeMap, HashMap, HashSet};

use async_trait::async_trait;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use crate::access::{open_course, page_in_course};
use crate::course_state::load_student_activity;
use crate::engine::course_structure::{self, find_links_to_old_paths};
use crate::engine::read::{ReadOptions, Selector, read_page};
use crate::engine::read_structure::read_structure;
use crate::engine::{
    EditError, EditErrorCode, EngineContext, PageType, PatchTarget, course_settings,
    glossary_references, page_content, parse_ops,
};
use crate::hints;
use crate::ids::RandomIds;
use crate::snapshots::{self, ExerciseCopy};
use crate::staging::{self, CallRecord, WriteChecks, WriteRequest};
use crate::state::McpState;
use crate::tools::args::{PatchCourseArgs, PatchCourseStructureArgs, PatchPageContentArgs};
use crate::tools::{RequestContext, ToolError, ToolHandler, ToolOutcome, parse_arguments};

pub struct PatchPageContent;
pub struct PatchCourseStructure;
pub struct PatchCourseSettings;
pub struct PatchGlossaryAndReferences;

/// `read_back` reads the result of the write, never another state.
fn check_read_back(selector: &Option<Selector>) -> Result<(), ToolError> {
    if selector.as_ref().is_some_and(|s| s.state.is_some()) {
        return Err(ToolError::Edit(
            EditError::new(
                EditErrorCode::FieldNotAllowed,
                "read_back always reads the result of this write; it takes no state",
            )
            .with_fix("drop state from read_back"),
        ));
    }
    Ok(())
}

fn resolve_read_back(
    selector: &Selector,
    labels: &BTreeMap<String, Uuid>,
) -> Result<Selector, ToolError> {
    let mut selector = selector.clone();
    if let Some(path) = &selector.path {
        selector.path = Some(page_content::resolve_label_path(path, labels)?);
    }
    if let Some(through) = &selector.through {
        selector.through = Some(page_content::resolve_label_path(through, labels)?);
    }
    Ok(selector)
}

fn ops_value(ops: &[Value]) -> Value {
    Value::Array(ops.to_vec())
}

#[async_trait]
impl ToolHandler<McpState> for PatchPageContent {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: PatchPageContentArgs = parse_arguments(arguments)?;
        check_read_back(&args.read_back)?;
        let ops = parse_ops(&args.ops, PatchTarget::PageContent)?;
        let (mut conn, view) = open_course(state, ctx, &args.course).await?;
        let page_id = page_in_course(&view, &args.page)?;
        let structure = snapshots::structure(&view.staged, &HashSet::new());
        let page =
            snapshots::page_document(&view.staged, &structure, page_id).ok_or_else(|| {
                ToolError::NotFound {
                    message: format!("page {page_id} is deleted in your staged changes"),
                }
            })?;
        let mut others = Vec::new();
        for target in page_content::referenced_pages(&ops)? {
            if target == page_id {
                continue;
            }
            others.push(
                snapshots::page_document(&view.staged, &structure, target).ok_or_else(|| {
                    ToolError::NotFound {
                        message: format!(
                            "to_page {target} isn't a page of this course; get_course_structure lists them"
                        ),
                    }
                })?,
            );
        }
        let ids = RandomIds;
        let engine = EngineContext::new(&ids)
            .with_pages(&others)
            .live(view.staged.is_live());
        let result = page_content::apply(&page, &ops, &engine)?;

        let mut after = view.staged.clone();
        snapshots::apply_page_documents(&mut after, result.pages());
        let copies: Vec<ExerciseCopy> = result
            .exercise_copies
            .iter()
            .map(|c| ExerciseCopy {
                source_exercise_id: c.source_exercise_id,
                new_exercise_id: c.new_exercise_id,
            })
            .collect();
        let report = staging::commit(
            state,
            &mut conn,
            ctx,
            &view,
            after,
            WriteRequest {
                call: CallRecord {
                    tool_name: &ctx.tool_name,
                    ops: ops_value(&args.ops),
                    summary: Some(format!("{} op(s) on page {page_id}", ops.len())),
                    revert_of_call_id: None,
                },
                checks: WriteChecks {
                    dry_run: args.dry_run.unwrap_or(false),
                    exercise_copies: copies,
                    ..Default::default()
                },
                precomputed: None,
                ids: &ids,
            },
        )
        .await?;

        let mut extra = Map::new();
        extra.insert("page".into(), json!(page_id));
        extra.insert("created".into(), json!(result.created));
        if !result.labels.is_empty() {
            extra.insert("labels".into(), json!(result.labels));
        }
        if !result.warnings.is_empty() {
            extra.insert("warnings".into(), json!(result.warnings));
        }
        if !result.moved_between_pages.is_empty() {
            extra.insert(
                "moved_between_pages".into(),
                json!(result.moved_between_pages),
            );
        }
        if !result.exercise_copies.is_empty() {
            extra.insert("exercise_copies".into(), json!(result.exercise_copies));
        }
        if let Some(selector) = &args.read_back {
            let selector = resolve_read_back(selector, &result.labels)?;
            let after_structure = snapshots::structure(&report.after, &HashSet::new());
            let document = snapshots::page_document(&report.after, &after_structure, page_id)
                .ok_or_else(|| ToolError::Internal("the edited page disappeared".into()))?;
            let read = read_page(
                &document,
                &selector,
                &ReadOptions {
                    budget_bytes: ctx.capabilities.read_back_budget_bytes(),
                    pending: HashMap::new(),
                },
            )?;
            extra.insert("read_back".into(), json!(read));
        }
        let mut consequences = Vec::new();
        if !result.exercise_copies.is_empty() {
            consequences.push(hints::exercises_copied(result.exercise_copies.len()));
        }
        if !result.moved_between_pages.is_empty() {
            consequences.push(hints::blocks_moved_between_pages(
                result.moved_between_pages.len(),
            ));
        }
        Ok(report.into_result(extra).with_hints(consequences).into())
    }
}

#[async_trait]
impl ToolHandler<McpState> for PatchCourseStructure {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: PatchCourseStructureArgs = parse_arguments(arguments)?;
        check_read_back(&args.read_back)?;
        let ops = course_structure::parse(&args.ops)?;
        let (mut conn, view) = open_course(state, ctx, &args.course).await?;
        let activity = load_student_activity(&mut conn, view.course.id).await?;
        let before = snapshots::structure(&view.staged, &activity.pages_with_submissions);
        let ids = RandomIds;
        let mut engine = EngineContext::new(&ids).live(view.staged.is_live());
        engine.creates_redirects = !view.live.settings.is_draft;
        let result = course_structure::apply(&before, &ops, &engine)?;

        let mut contents: HashMap<Uuid, Vec<_>> = HashMap::new();
        let mut generated_pages = HashSet::new();
        for page in &result.new_pages {
            let blocks = if page.blocks.is_empty() && page.page_type == PageType::ChapterFrontPage {
                generated_pages.insert(page.page_id);
                let chapter_name = result
                    .structure
                    .chapter_of_page(page.page_id)
                    .map(|c| c.name.clone())
                    .unwrap_or_default();
                snapshots::default_chapter_front_page_content(&chapter_name)
            } else {
                page.blocks.clone()
            };
            contents.insert(page.page_id, blocks);
        }
        let mut copies = Vec::new();
        for copy in &result.page_copies {
            let source = view
                .staged
                .page(copy.source_page_id)
                .map(|p| p.content.clone())
                .unwrap_or_default();
            let (blocks, exercise_copies) = snapshots::copy_blocks(&source, &ids);
            copies.extend(exercise_copies);
            contents.insert(copy.new_page_id, blocks);
        }
        let after = snapshots::apply_structure(&view.staged, &before, &result.structure, &contents);
        let links = find_links_to_old_paths(
            &snapshots::page_documents(&after, &result.structure),
            &view.course.slug,
            &result.changed_paths,
        );
        let report = staging::commit(
            state,
            &mut conn,
            ctx,
            &view,
            after,
            WriteRequest {
                call: CallRecord {
                    tool_name: &ctx.tool_name,
                    ops: ops_value(&args.ops),
                    summary: Some(format!("{} structure op(s)", ops.len())),
                    revert_of_call_id: None,
                },
                checks: WriteChecks {
                    dry_run: args.dry_run.unwrap_or(false),
                    unvalidated_pages: generated_pages,
                    exercise_copies: copies.clone(),
                    ..Default::default()
                },
                precomputed: None,
                ids: &ids,
            },
        )
        .await?;

        let mut extra = Map::new();
        extra.insert("created".into(), json!(result.created));
        if !result.labels.is_empty() {
            extra.insert("labels".into(), json!(result.labels));
        }
        if !result.warnings.is_empty() {
            extra.insert("warnings".into(), json!(result.warnings));
        }
        if !result.redirects.is_empty() {
            extra.insert("redirects".into(), json!(result.redirects));
        }
        if !result.changed_paths.is_empty() {
            extra.insert("changed_paths".into(), json!(result.changed_paths));
        }
        if !result.renumbered_chapters.is_empty() {
            extra.insert(
                "renumbered_chapters".into(),
                json!(result.renumbered_chapters),
            );
        }
        if !links.is_empty() {
            extra.insert("links_to_old_paths".into(), json!(links));
        }
        if let Some(selector) = &args.read_back {
            let selector = resolve_read_back(selector, &result.labels)?;
            let structure = snapshots::structure(&report.after, &activity.pages_with_submissions);
            let read = read_structure(
                &structure,
                &selector,
                &ReadOptions {
                    budget_bytes: ctx.capabilities.read_back_budget_bytes(),
                    pending: HashMap::new(),
                },
            )?;
            extra.insert("read_back".into(), json!(read));
        }
        let mut consequences = Vec::new();
        if !result.redirects.is_empty() {
            consequences.push(hints::redirects_created(result.redirects.len()));
        }
        if !links.is_empty() {
            consequences.push(hints::links_to_old_paths(links.len()));
        }
        if !copies.is_empty() {
            consequences.push(hints::exercises_copied(copies.len()));
        }
        Ok(report.into_result(extra).with_hints(consequences).into())
    }
}

#[async_trait]
impl ToolHandler<McpState> for PatchCourseSettings {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: PatchCourseArgs = parse_arguments(arguments)?;
        let ops = course_settings::parse(&args.ops)?;
        let (mut conn, view) = open_course(state, ctx, &args.course).await?;
        let ids = RandomIds;
        let engine = EngineContext::new(&ids).live(view.staged.is_live());
        let result =
            course_settings::apply(&snapshots::settings_document(&view.staged), &ops, &engine)?;
        let mut after = view.staged.clone();
        snapshots::apply_settings(&mut after, &result.settings);
        let report = staging::commit(
            state,
            &mut conn,
            ctx,
            &view,
            after,
            WriteRequest {
                call: CallRecord {
                    tool_name: &ctx.tool_name,
                    ops: ops_value(&args.ops),
                    summary: Some(format!("{} settings op(s)", ops.len())),
                    revert_of_call_id: None,
                },
                checks: WriteChecks {
                    dry_run: args.dry_run.unwrap_or(false),
                    ..Default::default()
                },
                precomputed: None,
                ids: &ids,
            },
        )
        .await?;
        let mut extra = Map::new();
        extra.insert("created".into(), json!(result.created));
        if !result.warnings.is_empty() {
            extra.insert("warnings".into(), json!(result.warnings));
        }
        Ok(report.into_result(extra).into())
    }
}

#[async_trait]
impl ToolHandler<McpState> for PatchGlossaryAndReferences {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: PatchCourseArgs = parse_arguments(arguments)?;
        let ops = glossary_references::parse(&args.ops)?;
        let (mut conn, view) = open_course(state, ctx, &args.course).await?;
        let structure = snapshots::structure(&view.staged, &HashSet::new());
        let pages = snapshots::page_documents(&view.staged, &structure);
        let ids = RandomIds;
        let engine = EngineContext::new(&ids)
            .with_pages(&pages)
            .live(view.staged.is_live());
        let result = glossary_references::apply(
            &snapshots::glossary_document(&view.staged),
            &ops,
            &engine,
            state.bibtex.as_ref(),
        )?;
        let mut after = view.staged.clone();
        snapshots::apply_glossary(&mut after, &result.document);
        snapshots::apply_page_documents(&mut after, &result.rewritten_pages);
        let report = staging::commit(
            state,
            &mut conn,
            ctx,
            &view,
            after,
            WriteRequest {
                call: CallRecord {
                    tool_name: &ctx.tool_name,
                    ops: ops_value(&args.ops),
                    summary: Some(format!("{} glossary or reference op(s)", ops.len())),
                    revert_of_call_id: None,
                },
                checks: WriteChecks {
                    dry_run: args.dry_run.unwrap_or(false),
                    ..Default::default()
                },
                precomputed: None,
                ids: &ids,
            },
        )
        .await?;
        let mut extra = Map::new();
        extra.insert("created".into(), json!(result.created));
        if !result.warnings.is_empty() {
            extra.insert("warnings".into(), json!(result.warnings));
        }
        if !result.rewritten_pages.is_empty() {
            extra.insert(
                "rewritten_pages".into(),
                json!(
                    result
                        .rewritten_pages
                        .iter()
                        .map(|p| p.page_id)
                        .collect::<Vec<_>>()
                ),
            );
        }
        if !result.usages.is_empty() {
            extra.insert("usages".into(), json!(result.usages));
        }
        Ok(report.into_result(extra).into())
    }
}
