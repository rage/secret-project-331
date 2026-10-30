//! The four patch tools: page content, course structure, settings, glossary and references.

use std::collections::{BTreeMap, HashMap, HashSet};

use async_trait::async_trait;
use serde::Serialize;
use serde_json::Value;
use sqlx::PgConnection;
use uuid::Uuid;

use crate::access::{
    connection, load_page_facts, open_course, page_in_course, staged_page_document,
};
use crate::engine::blocks::ExerciseCopy;
use crate::engine::blocks::{copy_blocks, walk};
use crate::engine::course_structure::{self, ChapterRenumber, LinkToOldPath};
use crate::engine::glossary_references::Usage;
use crate::engine::page_content::BlockPageMove;
use crate::engine::read::{ReadOptions, ReadResult, Selector, read_page, read_structure};
use crate::engine::{
    CreatedIds, Document, DocumentKey, DocumentRef, EditError, EditErrorCode, PatchTarget, Warning,
    course_settings, glossary_references, page_content, parse_ops,
};
use crate::hints;
use crate::ids::RandomIds;
use crate::instruction_lists::{self, ExerciseTextParts};
use crate::page_readiness::PAGE_TITLE_BLOCKS;
use crate::snapshots;
use crate::staging::{self, WriteMode, WriteRequest, WriteSource};
use crate::state::McpState;
use crate::tools::args::{PatchCourseArgs, PatchCourseStructureArgs, PatchPageContentArgs};
use crate::tools::{RequestContext, ToolError, ToolHandler, ToolOutcome};
use headless_lms_models::library::agent_changesets::course_state::{CourseState, CourseView};
use headless_lms_models::library::content_management::ChapterFrontPage;
use headless_lms_models::page_language_groups::{self, PairingRefusal};
use headless_lms_models::url_redirections::CreatedRedirect;
use headless_lms_utils::document_schema_processor::GutenbergBlock;

/// Handler of the `patch_page_content` tool.
pub struct PatchPageContent;
/// Handler of the `patch_course_structure` tool.
pub struct PatchCourseStructure;
/// Handler of the `patch_course_settings` tool.
pub struct PatchCourseSettings;
/// Handler of the `patch_course_glossary_and_references` tool.
pub struct PatchGlossaryAndReferences;

fn pairing_refused(page_id: Uuid, message: String) -> ToolError {
    ToolError::Edit(
        EditError::new(EditErrorCode::InvalidValue, format!("pair_with of new page {page_id}: {message}"))
            .with_fix("pair_with takes the id of the published page this page translates, in another language version of the course (list_courses language_versions, get_course_structure page ids)"),
    )
}

/// Puts each new page of `pairings` (new page id to the page it translates) into the page
/// language group of the page it translates, which publishing joins. Refuses a page of a course
/// outside this course's language group, one not published yet, and a group that already has a
/// page in this course.
async fn pair_pages(
    conn: &mut PgConnection,
    view: &CourseView,
    pairings: &BTreeMap<Uuid, Uuid>,
    page_language_groups: &HashMap<Uuid, Uuid>,
    after: &mut CourseState,
) -> Result<(), ToolError> {
    let mut paired_groups: HashSet<Uuid> = page_language_groups
        .iter()
        .filter(|(page, _)| after.page(**page).is_some())
        .map(|(_, group)| *group)
        .chain(
            after
                .pages
                .iter()
                .filter_map(|page| page.joins_page_language_group_id),
        )
        .collect();
    for (&page_id, &source_id) in pairings {
        if view.staged.page(source_id).is_some() || view.live.page(source_id).is_some() {
            return Err(pairing_refused(
                page_id,
                format!("page {source_id} is in this course, not in another language version"),
            ));
        }
        let group = page_language_groups::resolve_pairing(
            conn,
            source_id,
            view.course.course_language_group_id,
        )
        .await?
        .map_err(|refusal| {
            pairing_refused(
                page_id,
                match refusal {
                    PairingRefusal::NotPublished => format!("no published page {source_id}; if it is a new page staged in its course, publish the source page first"),
                    PairingRefusal::NotInCourseLanguageGroup => format!("page {source_id} isn't in a language version of this course (a course in its language group)"),
                },
            )
        })?;
        if paired_groups.contains(&group) {
            return Err(pairing_refused(
                page_id,
                format!("this course already has its version of page {source_id}"),
            ));
        }
        if let Some(page) = after.page_mut(page_id) {
            page.joins_page_language_group_id = Some(group);
            paired_groups.insert(group);
        }
    }
    Ok(())
}

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

fn read_back_options(ctx: &RequestContext) -> ReadOptions<'static> {
    ReadOptions {
        budget_bytes: ctx.client.read_back_budget_bytes(),
        pending: None,
    }
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

/// The read-back, or why it failed. The write is staged by then, so a failed read mustn't turn
/// the result into an error.
#[derive(Serialize)]
enum ReadBack {
    #[serde(rename = "read_back")]
    Read(Box<ReadResult>),
    #[serde(rename = "read_back_error")]
    Failed(Value),
}

impl From<Result<ReadResult, ToolError>> for ReadBack {
    fn from(read: Result<ReadResult, ToolError>) -> Self {
        match read {
            Ok(read) => ReadBack::Read(Box::new(read)),
            Err(error) => ReadBack::Failed(error.into_json()),
        }
    }
}

#[derive(Serialize)]
struct PageContentSummary<'a> {
    page: Uuid,
    created: &'a [CreatedIds],
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    labels: &'a BTreeMap<String, Uuid>,
    #[serde(skip_serializing_if = "<[_]>::is_empty")]
    warnings: &'a [Warning],
    #[serde(skip_serializing_if = "<[_]>::is_empty")]
    moved_between_pages: &'a [BlockPageMove],
    #[serde(skip_serializing_if = "<[_]>::is_empty")]
    exercise_copies: &'a [ExerciseCopy],
    #[serde(flatten)]
    read_back: Option<ReadBack>,
}

/// Ids an op created, with the blocks the server added to its new pages.
#[derive(Serialize)]
struct CreatedStructure<'a> {
    #[serde(flatten)]
    ids: &'a CreatedIds,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    template_blocks: Vec<TemplateBlock>,
}

/// A top-level block the server added to a new page: its hero section, or a chapter front page's
/// standard blocks.
#[derive(Serialize)]
struct TemplateBlock {
    page: Uuid,
    block: Uuid,
    block_name: String,
}

#[derive(Serialize)]
struct StructureSummary<'a> {
    created: Vec<CreatedStructure<'a>>,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    labels: &'a BTreeMap<String, Uuid>,
    #[serde(skip_serializing_if = "<[_]>::is_empty")]
    warnings: &'a [Warning],
    #[serde(skip_serializing_if = "<[_]>::is_empty")]
    changed_paths: &'a [CreatedRedirect],
    #[serde(skip_serializing_if = "<[_]>::is_empty")]
    renumbered_chapters: &'a [ChapterRenumber],
    #[serde(skip_serializing_if = "<[_]>::is_empty")]
    links_to_old_paths: &'a [LinkToOldPath],
    #[serde(flatten)]
    read_back: Option<ReadBack>,
}

#[derive(Serialize)]
struct CreatedSummary<'a> {
    created: &'a [CreatedIds],
}

#[derive(Serialize)]
struct GlossarySummary<'a> {
    created: &'a [CreatedIds],
    #[serde(skip_serializing_if = "Vec::is_empty")]
    rewritten_pages: Vec<Uuid>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    rewritten_exercise_instructions: Vec<DocumentKey>,
    #[serde(skip_serializing_if = "<[_]>::is_empty")]
    usages: &'a [Usage],
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for PatchPageContent {
    type Args = PatchPageContentArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: PatchPageContentArgs,
    ) -> Result<ToolOutcome, ToolError> {
        check_read_back(&args.read_back)?;
        let ops = parse_ops(&args.ops, PatchTarget::PageContent)?;
        let view = open_course(state, ctx, args.course.id()).await?;
        let page_id = page_in_course(&view, args.page.id())?;
        let page = staged_page_document(&view.staged, page_id)?;
        let result = page_content::apply(
            page,
            &|to_page| snapshots::page_document(&view.staged, to_page),
            &ops,
            &RandomIds,
        )?;

        let mut after = view.staged.clone();
        snapshots::apply_page_documents(
            &mut after,
            std::iter::once(result.page).chain(result.other_pages),
        );
        let report = staging::commit(
            state,
            ctx,
            &view,
            after,
            WriteRequest {
                source: WriteSource::Derived {
                    exercise_copies: result.exercise_copies.clone(),
                    generated_blocks: HashSet::new(),
                },
                ..WriteRequest::new(
                    Value::Array(args.ops),
                    format!("{} op(s) on page {page_id}", ops.len()),
                    WriteMode::from_dry_run(args.dry_run),
                )
            },
        )
        .await?;

        let read_back = args.read_back.as_ref().map(|selector| {
            ReadBack::from(
                resolve_read_back(selector, &result.labels).and_then(|selector| {
                    let document = staged_page_document(&report.after, page_id)?;
                    Ok(read_page(&document, &selector, &read_back_options(ctx))?)
                }),
            )
        });
        let summary = PageContentSummary {
            page: page_id,
            created: &result.created,
            labels: &result.labels,
            warnings: &result.warnings,
            moved_between_pages: &result.moved_between_pages,
            exercise_copies: &result.exercise_copies,
            read_back,
        };
        let mut consequences = Vec::new();
        if !result.exercise_copies.is_empty() {
            consequences.push(hints::exercises_copied(result.exercise_copies.len()));
        }
        if !result.moved_between_pages.is_empty() {
            consequences.push(hints::blocks_moved_between_pages(
                result.moved_between_pages.len(),
            ));
        }
        Ok(report.into_result(&summary).with_hints(consequences).into())
    }
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for PatchCourseStructure {
    type Args = PatchCourseStructureArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: PatchCourseStructureArgs,
    ) -> Result<ToolOutcome, ToolError> {
        check_read_back(&args.read_back)?;
        let ops = parse_ops(&args.ops, PatchTarget::CourseStructure)?;
        let view = open_course(state, ctx, args.course.id()).await?;
        let facts = load_page_facts(state, view.course.id).await?;
        let before = snapshots::structure(&view.staged, &facts);
        let ids = RandomIds;
        let mut result = course_structure::apply(&before, &ops, view.staged.is_live(), &ids)?;

        let mut contents = std::mem::take(&mut result.new_pages);
        let mut generated_blocks = HashSet::new();
        let mut template_blocks = Vec::new();
        for (page_id, blocks) in contents.iter_mut() {
            if result.structure.is_chapter_front_page(*page_id) {
                if blocks.is_empty()
                    && let Some(chapter) = result.structure.chapter_of_page(*page_id)
                {
                    *blocks = ChapterFrontPage::new(&chapter.name, chapter.chapter_number).content;
                    walk(blocks, &mut |block, _| {
                        generated_blocks.insert(block.client_id);
                    });
                    template_blocks.extend(blocks.iter().map(|block| TemplateBlock {
                        page: *page_id,
                        block: block.client_id,
                        block_name: block.name.clone(),
                    }));
                }
            } else if !blocks
                .iter()
                .any(|block| PAGE_TITLE_BLOCKS.contains(&block.name.as_str()))
                && let Some(page) = result.structure.page(*page_id)
            {
                let hero = GutenbergBlock::hero_section(page.title.trim(), "");
                generated_blocks.insert(hero.client_id);
                template_blocks.push(TemplateBlock {
                    page: *page_id,
                    block: hero.client_id,
                    block_name: hero.name.clone(),
                });
                blocks.insert(0, hero);
            }
        }
        let mut copies = Vec::new();
        for copy in &result.page_copies {
            // Pages added or copied earlier in the call aren't staged yet.
            let source = match contents.get(&copy.source_page_id) {
                Some(blocks) => blocks.clone(),
                None => view
                    .staged
                    .page(copy.source_page_id)
                    .map(|p| p.content.to_vec())
                    .ok_or_else(|| {
                        ToolError::Internal(format!(
                            "the copied page {} has no blocks to copy",
                            copy.source_page_id
                        ))
                    })?,
            };
            let (blocks, exercise_copies) = copy_blocks(&source, &ids, copy.new_page_id);
            copies.extend(exercise_copies);
            contents.insert(copy.new_page_id, blocks);
        }
        let mut after =
            snapshots::apply_structure(&view.staged, &before, &result.structure, &contents);
        pair_pages(
            &mut *connection(state).await?,
            &view,
            &result.page_pairings,
            &facts.page_language_groups,
            &mut after,
        )
        .await?;
        let links = result.links_to_old_paths(&snapshots::page_refs(&after), &view.course.slug);
        let copy_count = copies.len();
        let report = staging::commit(
            state,
            ctx,
            &view,
            after,
            WriteRequest {
                source: WriteSource::Derived {
                    exercise_copies: copies,
                    generated_blocks,
                },
                ..WriteRequest::new(
                    Value::Array(args.ops),
                    format!("{} structure op(s)", ops.len()),
                    WriteMode::from_dry_run(args.dry_run),
                )
            },
        )
        .await?;

        let read_back = args.read_back.as_ref().map(|selector| {
            ReadBack::from(
                resolve_read_back(selector, &result.labels).and_then(|selector| {
                    let structure = snapshots::structure(&report.after, &facts);
                    Ok(read_structure(
                        &structure,
                        &selector,
                        &read_back_options(ctx),
                    )?)
                }),
            )
        });
        let created = result
            .created
            .iter()
            .map(|ids| {
                let (mut own, rest): (Vec<_>, Vec<_>) = std::mem::take(&mut template_blocks)
                    .into_iter()
                    .partition(|block| ids.ids.contains(&block.page));
                template_blocks = rest;
                own.sort_by_key(|block| ids.ids.iter().position(|id| *id == block.page));
                CreatedStructure {
                    ids,
                    template_blocks: own,
                }
            })
            .collect();
        let summary = StructureSummary {
            created,
            labels: &result.labels,
            warnings: &result.warnings,
            changed_paths: &result.changed_paths,
            renumbered_chapters: &result.renumbered_chapters,
            links_to_old_paths: &links,
            read_back,
        };
        let mut consequences = Vec::new();
        if !result.changed_paths.is_empty() {
            consequences.push(hints::redirects_created(result.changed_paths.len()));
        }
        let reused_links = links.iter().filter(|l| l.now_opens_page.is_some()).count();
        if links.len() > reused_links {
            consequences.push(hints::links_to_old_paths(links.len() - reused_links));
        }
        if reused_links > 0 {
            consequences.push(hints::links_to_reused_paths(reused_links));
        }
        if copy_count > 0 {
            consequences.push(hints::exercises_copied(copy_count));
        }
        Ok(report.into_result(&summary).with_hints(consequences).into())
    }
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for PatchCourseSettings {
    type Args = PatchCourseArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: PatchCourseArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let ops = parse_ops(&args.ops, PatchTarget::CourseSettings)?;
        let view = open_course(state, ctx, args.course.id()).await?;
        let ids = RandomIds;
        let result = course_settings::apply(
            &snapshots::settings_document(&view.staged, &view.course),
            &ops,
            &ids,
        )?;
        let mut after = view.staged.clone();
        snapshots::apply_settings(&mut after, &result.settings);
        let report = staging::commit(
            state,
            ctx,
            &view,
            after,
            WriteRequest::new(
                Value::Array(args.ops),
                format!("{} settings op(s)", ops.len()),
                WriteMode::from_dry_run(args.dry_run),
            ),
        )
        .await?;
        Ok(report
            .into_result(&CreatedSummary {
                created: &result.created,
            })
            .into())
    }
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for PatchGlossaryAndReferences {
    type Args = PatchCourseArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: PatchCourseArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let ops = parse_ops(&args.ops, PatchTarget::GlossaryAndReferences)?;
        let mut view = open_course(state, ctx, args.course.id()).await?;
        let ids = RandomIds;
        let document = snapshots::glossary_document(&view.staged);
        let edit = glossary_references::apply(&document, &ops, &ids)?;
        let texts = if edit.affects_pages() {
            view.load_exercises(&mut *connection(state).await?).await?;
            let page_ids: Vec<Uuid> = view.staged.pages.iter().map(|page| page.id).collect();
            instruction_lists::text_documents(
                &view.staged,
                &page_ids,
                ExerciseTextParts {
                    instructions: true,
                    course_default: true,
                    names: false,
                },
            )
        } else {
            Vec::new()
        };
        let documents: Vec<DocumentRef> = snapshots::page_refs(&view.staged)
            .into_iter()
            .map(DocumentRef::from)
            .chain(texts.iter().map(Document::as_document_ref))
            .collect();
        let result = edit.with_page_effects(&documents);
        let (rewritten_pages, rewritten_exercise_instructions) = result
            .rewritten_pages
            .iter()
            .map(|document| document.key)
            .partition::<Vec<_>, _>(|key| matches!(key, DocumentKey::Page(_)));
        let mut after = view.staged.clone();
        snapshots::apply_glossary(&mut after, &result.document);
        instruction_lists::apply_documents(&mut after, result.rewritten_pages)?;
        let report = staging::commit(
            state,
            ctx,
            &view,
            after,
            WriteRequest::new(
                Value::Array(args.ops),
                format!("{} glossary or reference op(s)", ops.len()),
                WriteMode::from_dry_run(args.dry_run),
            ),
        )
        .await?;
        Ok(report
            .into_result(&GlossarySummary {
                created: &result.created,
                rewritten_pages: rewritten_pages
                    .into_iter()
                    .filter_map(DocumentKey::page_id)
                    .collect(),
                rewritten_exercise_instructions,
                usages: &result.usages,
            })
            .into())
    }
}
