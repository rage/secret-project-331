//! Course-wide text and block replacement.

use std::collections::HashSet;

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::access::open_course;
use crate::course_state::{CourseState, CourseView};
use crate::engine::find_replace::{FindReplaceRequest, find_replace};
use crate::engine::structural_replace::structural_replace;
use crate::engine::{EngineContext, PageDocument};
use crate::ids::RandomIds;
use crate::snapshots;
use crate::staging::{self, CallRecord, WriteChecks, WriteRequest};
use crate::state::McpState;
use crate::tools::args::{ContentScope, FindReplaceArgs, StructuralReplaceArgs};
use crate::tools::{
    RequestContext, Scope, ToolError, ToolHandler, ToolOutcome, ToolResult, parse_arguments,
    parse_id,
};

pub struct FindReplace;
pub struct StructuralReplace;

/// The staged pages a scope covers: one page, one chapter's pages or the whole course.
fn pages_in_scope(
    view: &CourseView,
    scope: Option<&ContentScope>,
) -> Result<Vec<PageDocument>, ToolError> {
    let state: &CourseState = &view.staged;
    let structure = snapshots::structure(state, &HashSet::new());
    let scope = scope.cloned().unwrap_or_default();
    if let Some(course) = &scope.course
        && parse_id(course, "scope.course")? != view.course.id
    {
        return Err(ToolError::InvalidArguments {
            message: "scope.course must be the call's course".into(),
        });
    }
    if let Some(page) = &scope.page {
        let page_id = parse_id(page, "scope.page")?;
        let document = snapshots::page_document(state, &structure, page_id).ok_or_else(|| {
            ToolError::NotFound {
                message: format!("course {} has no page {page_id}", view.course.id),
            }
        })?;
        return Ok(vec![document]);
    }
    if let Some(chapter) = &scope.chapter {
        let chapter_id = parse_id(chapter, "scope.chapter")?;
        let chapter = structure
            .chapters()
            .find(|c| c.id == chapter_id)
            .ok_or_else(|| ToolError::NotFound {
                message: format!("course {} has no chapter {chapter_id}", view.course.id),
            })?;
        return Ok(chapter
            .pages
            .iter()
            .filter_map(|p| snapshots::page_document(state, &structure, p.id))
            .collect());
    }
    Ok(snapshots::page_documents(state, &structure))
}

#[async_trait]
impl ToolHandler<McpState> for FindReplace {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: FindReplaceArgs = parse_arguments(arguments)?;
        if args.replace.is_some() {
            ctx.require_scope(Scope::MaterialStage)?;
        }
        let (mut conn, view) = open_course(state, ctx, &args.course).await?;
        let pages = pages_in_scope(&view, args.scope.as_ref())?;
        let result = find_replace(
            &pages,
            &FindReplaceRequest {
                find: args.find.clone(),
                replace: args.replace.clone(),
                is_regex: args.regex.unwrap_or(false),
                attributes: args.attributes.clone(),
                expected_count: args.expected_count.map(|c| c as usize),
            },
        )?;
        let mut extra = Map::new();
        extra.insert("total".into(), json!(result.total));
        extra.insert("matches".into(), json!(result.matches));
        if !result.inflected_variants.is_empty() {
            extra.insert(
                "inflected_variants_not_changed".into(),
                json!(result.inflected_variants),
            );
        }
        if args.replace.is_none() || result.changed_pages.is_empty() {
            return Ok(ToolResult {
                structured: extra,
                hints: Vec::new(),
                is_error: false,
            }
            .into());
        }
        let mut after = view.staged.clone();
        snapshots::apply_page_documents(&mut after, &result.changed_pages);
        let ids = RandomIds;
        let report = staging::commit(
            state,
            &mut conn,
            ctx,
            &view,
            after,
            WriteRequest {
                call: CallRecord {
                    tool_name: &ctx.tool_name,
                    ops: json!({
                        "scope": args.scope,
                        "find": args.find,
                        "replace": args.replace,
                        "regex": args.regex,
                        "attributes": args.attributes,
                    }),
                    summary: Some(format!(
                        "replaced {} match(es) on {} page(s)",
                        result.total,
                        result.changed_pages.len()
                    )),
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
        Ok(report.into_result(extra).into())
    }
}

#[async_trait]
impl ToolHandler<McpState> for StructuralReplace {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: StructuralReplaceArgs = parse_arguments(arguments)?;
        let (mut conn, view) = open_course(state, ctx, &args.course).await?;
        let pages = pages_in_scope(&view, args.scope.as_ref())?;
        let ids = RandomIds;
        let engine = EngineContext::new(&ids).live(view.staged.is_live());
        let result = structural_replace(
            &pages,
            &args.pattern,
            &args.action,
            args.expected_count.map(|c| c as usize),
            &engine,
        )?;
        let mut extra = Map::new();
        extra.insert("total".into(), json!(result.matches.len()));
        extra.insert("matches".into(), json!(result.matches));
        let mut after = view.staged.clone();
        snapshots::apply_page_documents(&mut after, result.changed_pages.iter().map(|r| &r.page));
        if result.changed_pages.is_empty() {
            return Ok(ToolResult {
                structured: extra,
                hints: Vec::new(),
                is_error: false,
            }
            .into());
        }
        let report = staging::commit(
            state,
            &mut conn,
            ctx,
            &view,
            after,
            WriteRequest {
                call: CallRecord {
                    tool_name: &ctx.tool_name,
                    ops: json!({"scope": args.scope, "match": args.pattern, "action": args.action}),
                    summary: Some(format!(
                        "{} block(s) on {} page(s)",
                        result.matches.len(),
                        result.changed_pages.len()
                    )),
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
        Ok(report.into_result(extra).into())
    }
}
