//! The write pipeline every write tool ends in: find what the call changed, validate written
//! blocks with the CMS, and stage the call, or on a dry run tell what staging it would do.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use chrono::{DateTime, Utc};
use headless_lms_models::{
    agent_changeset_entities::ChangesetEntitySummary,
    library::{
        agent_changesets::{
            FieldChange, RiskBaseline, StageCall, StageCallOutcome, StageCallResult, StagedEntity,
            StagedStateRead,
            course_state::{
                CourseState, CourseView, ExerciseEditError, ExerciseReviewConfig, PageRecord,
                load_student_activity,
            },
            stage_call, stage_call_dry_run,
        },
        entity_snapshots::{
            ContentEntityType, EntityKey, EntitySnapshot, ExerciseBundle, PageSnapshot,
        },
    },
    peer_or_self_review_configs::{self, CmsPeerOrSelfReviewConfiguration},
};
use headless_lms_utils::document_schema_processor::{
    GutenbergBlock, blocks_not_allowed_in_top_level_pages,
};
use serde::Serialize;
use serde_json::{Value, json};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::access::connection;
use crate::diff::{self, BlockChange};
use crate::engine::PageType;
use crate::engine::blocks::ExerciseCopy;
use crate::engine::{EditError, EditErrorCode};
use crate::exercises::{self, InstructionsList, InstructionsLocation};
use crate::explanations::{ExplainedEntity, explain_blockers};
use crate::hints::{self, Hint};
use crate::ids::{IdGenerator, RandomIds};
use crate::protocol::context::ClientKind;
use crate::protocol::progress::ProgressReporter;
use crate::snapshots;
use crate::state::McpState;
use crate::tools::{ErrorCode, RequestContext, ToolError, ToolResult};
use crate::validator::{
    BlockValidationError, BlockValidator, CourseBlockFeatures, PageValidationRequest,
    ValidationRequest, ValidationTarget, changed_roots,
};

/// Full page snapshots for the changed pages of a state, and the live snapshots of the pages
/// among them that the user has no staged changes to.
pub struct PageWrites {
    pub writes: Vec<StagedEntity>,
    pub live_pages: HashMap<Uuid, PageSnapshot>,
}

/// Writes the changes of `after`'s exercise records since `before` into `bundle`, if its exercise
/// has any, and tells whether it had. `page_id` is the page the bundle was read from.
fn edit_exercise(
    before: &CourseState,
    after: &CourseState,
    course_default: Option<&CmsPeerOrSelfReviewConfiguration>,
    ids: &dyn IdGenerator,
    page_id: Uuid,
    bundle: &mut ExerciseBundle,
) -> Result<bool, ToolError> {
    let exercise_id = bundle.exercise.id;
    let (Some(before), Some(after)) = (before.exercise(exercise_id), after.exercise(exercise_id))
    else {
        return Ok(false);
    };
    if after.has_same_content(before) {
        return Ok(false);
    }
    after
        .apply_to(before, bundle, course_default, || ids.new_id())
        .map_err(|error| match error {
            ExerciseEditError::ChangedSinceRead => {
                stale_read(&[(ContentEntityType::Page, page_id)])
            }
            ExerciseEditError::NoCourseDefault => ToolError::InvalidArguments {
                message: "the course has no default review config to copy".into(),
            },
            ExerciseEditError::UnsupportedReviewConfigChange => ToolError::Internal(format!(
                "exercise {exercise_id} got a review config change staging can't write"
            )),
        })?;
    Ok(true)
}

/// The course default review config with its questions, if `after` copies it to an exercise.
async fn course_default_to_copy(
    conn: &mut PgConnection,
    before: &CourseState,
    after: &CourseState,
) -> Result<Option<CmsPeerOrSelfReviewConfiguration>, ToolError> {
    let copies = after.exercises_changed_since(before).iter().any(|id| {
        matches!(
            (before.exercise(*id), after.exercise(*id)),
            (Some(before), Some(after))
                if before.review_config == ExerciseReviewConfig::CourseDefault
                    && matches!(after.review_config, ExerciseReviewConfig::Own { .. })
        )
    });
    if !copies {
        return Ok(None);
    }
    Ok(
        peer_or_self_review_configs::get_course_default_cms_peer_review_configuration(
            conn,
            after.course_id(),
        )
        .await?,
    )
}

/// Builds full page snapshots for the changed pages of `after`. Exercises follow their blocks,
/// across pages too; `copies` are created from their source exercises.
pub async fn page_writes(
    conn: &mut PgConnection,
    view: &CourseView,
    after: &CourseState,
    page_ids: &[Uuid],
    copies: &[ExerciseCopy],
    ids: &dyn IdGenerator,
) -> Result<PageWrites, ToolError> {
    let copy_sources: HashSet<Uuid> = copies.iter().map(|c| c.source_exercise_id).collect();
    let mut source_pages: Vec<Uuid> = page_ids.to_vec();
    if !copy_sources.is_empty() {
        for page in &view.staged.pages {
            let has_source = page
                .content
                .iter()
                .any(|b| b.exercise_id().is_some_and(|id| copy_sources.contains(&id)));
            if has_source && !source_pages.contains(&page.id) {
                source_pages.push(page.id);
            }
        }
    }
    let mut current = view.current_page_snapshots(conn, &source_pages).await?;
    let course_default = course_default_to_copy(conn, &view.staged, after).await?;
    let mut live_pages: HashMap<Uuid, PageSnapshot> = HashMap::new();
    let mut bundles: HashMap<Uuid, ExerciseBundle> = HashMap::new();
    let mut edited: HashSet<Uuid> = HashSet::new();
    for page_id in &source_pages {
        let Some(snapshot) = current.get(page_id) else {
            continue;
        };
        for mut bundle in snapshot.exercise_bundles() {
            if edit_exercise(
                &view.staged,
                after,
                course_default.as_ref(),
                ids,
                *page_id,
                &mut bundle,
            )? {
                edited.insert(bundle.exercise.id);
            }
            bundles.insert(bundle.exercise.id, bundle);
        }
        if view
            .staged_row((ContentEntityType::Page, *page_id))
            .is_none()
            && page_ids.contains(page_id)
        {
            live_pages.insert(*page_id, snapshot.clone());
        }
    }
    for copy in copies {
        let source = bundles.get(&copy.source_exercise_id).ok_or_else(|| {
            ToolError::Internal(format!(
                "copied exercise {} wasn't found on any page",
                copy.source_exercise_id
            ))
        })?;
        let copied = source.copy_with_new_ids(copy.new_exercise_id, || ids.new_id());
        bundles.insert(copy.new_exercise_id, copied);
    }

    let mut writes = Vec::new();
    for page_id in page_ids {
        let Some(record) = after.page(*page_id) else {
            writes.push(StagedEntity::Delete((ContentEntityType::Page, *page_id)));
            continue;
        };
        let snapshot = match current.remove(page_id) {
            Some(base) if base.content == record.content => {
                let mut snapshot = PageSnapshot {
                    chapter_id: record.chapter_id,
                    url_path: record.url_path.clone(),
                    title: record.title.clone(),
                    hidden: record.hidden,
                    order_number: record.order_number,
                    joins_page_language_group_id: record.joins_page_language_group_id,
                    ..base
                };
                if snapshot.exercises.iter().any(|e| edited.contains(&e.id)) {
                    let exercise_ids: Vec<Uuid> = snapshot.exercises.iter().map(|e| e.id).collect();
                    snapshot
                        .set_exercise_bundles(exercise_ids.iter().filter_map(|id| bundles.get(id)));
                }
                snapshot
            }
            _ => PageSnapshot::from_record_and_bundles(after.course_id(), record, &bundles)
                .map_err(|missing| {
                    ToolError::Internal(format!(
                        "page {page_id} names exercises that weren't found: {missing:?}"
                    ))
                })?,
        };
        writes.push(StagedEntity::Write(EntitySnapshot::Page(snapshot)));
    }
    Ok(PageWrites { writes, live_pages })
}

/// A teacher's block the call left as it was that doesn't meet what agents must write.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct UnchangedBlockWarning {
    /// `None` for the course default review instructions.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<Uuid>,
    #[serde(flatten)]
    pub instructions: Option<InstructionsLocation>,
    #[serde(flatten)]
    pub warning: BlockValidationError,
}

/// What validating a write's blocks found besides errors.
#[derive(Debug, Default)]
pub struct ValidatedBlocks {
    /// The names of the block types that were validated.
    pub block_names: Vec<String>,
    /// Problems the validator found in the teacher's blocks that the call didn't change.
    pub unchanged_block_warnings: Vec<UnchangedBlockWarning>,
}

/// A list of blocks the validator checks.
#[derive(Clone, Copy)]
enum ValidatedList {
    Page { page_id: Uuid, page_type: PageType },
    Instructions(InstructionsList),
}

/// The blocks of one page or instruction list that go to the validator.
struct PageToValidate {
    list: ValidatedList,
    /// The page the blocks are on; `None` for the course default review instructions.
    page: Option<Uuid>,
    instructions: Option<InstructionsLocation>,
    roots: Vec<GutenbergBlock>,
    /// Blocks sent as unchanged, whose problems only warn.
    unchanged_client_ids: Vec<Uuid>,
}

/// A block error as the call's error details list it.
#[derive(Serialize)]
struct BlockErrorDetail<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<Uuid>,
    #[serde(flatten)]
    instructions: Option<&'a InstructionsLocation>,
    #[serde(flatten)]
    error: &'a BlockValidationError,
}

/// Every block in `blocks` by client id.
fn blocks_by_id(blocks: &[GutenbergBlock]) -> HashMap<Uuid, &GutenbergBlock> {
    let mut by_id = HashMap::new();
    crate::engine::blocks::walk(blocks, &mut |block, _| {
        by_id.insert(block.client_id, block);
    });
    by_id
}

/// Adds the names of the blocks in `roots` to `block_names` and returns the ids of those
/// `is_unchanged` holds for, given the block and whether `live_blocks` has it as it is.
fn unchanged_blocks(
    roots: &[GutenbergBlock],
    live_blocks: &HashMap<Uuid, &GutenbergBlock>,
    block_names: &mut Vec<String>,
    is_unchanged: impl Fn(&GutenbergBlock, bool) -> bool,
) -> Vec<Uuid> {
    let mut unchanged_client_ids = Vec::new();
    crate::engine::blocks::walk(roots, &mut |block, _| {
        block_names.push(block.name.clone());
        let is_as_published = live_blocks
            .get(&block.client_id)
            .is_some_and(|live| live.name == block.name && live.attributes == block.attributes);
        if is_unchanged(block, is_as_published) {
            unchanged_client_ids.push(block.client_id);
        }
    });
    unchanged_client_ids
}

/// Validates the top-level trees holding blocks that changed between `before` and `after` and
/// replaces them with the validator's normalised form; every tree of a page whose page type
/// changed. Blocks as `live` has them, and the `generated_blocks` the server wrote, are sent as
/// unchanged, so that problems in them only warn.
pub async fn validate_changed_blocks(
    validator: &dyn BlockValidator,
    live: &CourseState,
    before: &CourseState,
    after: &mut CourseState,
    generated_blocks: &HashSet<Uuid>,
    progress: &ProgressReporter,
) -> Result<ValidatedBlocks, ToolError> {
    let changed_page_ids: Vec<(Uuid, bool)> = after
        .pages_changed_since(before)
        .filter_map(|page| {
            let is_type_changed = before
                .page(page.id)
                .is_some_and(|before| snapshots::page_type(before) != snapshots::page_type(page));
            let is_content_changed =
                before.page(page.id).map(|p| &p.content) != Some(&page.content);
            (is_type_changed || is_content_changed).then_some((page.id, is_type_changed))
        })
        .collect();
    top_level_pages_hold_no_chapter_blocks(after, changed_page_ids.iter().map(|(id, _)| *id))?;
    let mut live_blocks: HashMap<Uuid, &GutenbergBlock> = HashMap::new();
    if !changed_page_ids.is_empty() {
        // A block can only have come from a page this call or an earlier one changed.
        let mut source_pages: HashSet<Uuid> = live
            .pages_changed_since(before)
            .map(|page| page.id)
            .collect();
        source_pages.extend(changed_page_ids.iter().map(|(id, _)| *id));
        for page in live.pages.iter().filter(|p| source_pages.contains(&p.id)) {
            live_blocks.extend(blocks_by_id(&page.content));
        }
    }
    let mut validated = ValidatedBlocks::default();
    let mut pages: Vec<PageToValidate> = Vec::new();
    for (page_id, is_type_changed) in &changed_page_ids {
        let Some(after_document) = snapshots::page_document(after, *page_id) else {
            continue;
        };
        let roots = if *is_type_changed {
            after_document.blocks.clone()
        } else {
            let before_document = snapshots::page_document(before, *page_id);
            changed_roots(before_document.as_ref(), &after_document)
        };
        if roots.is_empty() {
            continue;
        }
        let unchanged_client_ids = unchanged_blocks(
            &roots,
            &live_blocks,
            &mut validated.block_names,
            // Blocks in a new kind of page are checked against what that page allows.
            |block, is_as_published| {
                (is_as_published && !is_type_changed) || generated_blocks.contains(&block.client_id)
            },
        );
        pages.push(PageToValidate {
            list: ValidatedList::Page {
                page_id: *page_id,
                page_type: after_document.page_type,
            },
            page: Some(*page_id),
            instructions: None,
            roots,
            unchanged_client_ids,
        });
    }
    for list in exercises::changed_lists(before, after) {
        let Some(after_document) = exercises::document(after, list).transpose()? else {
            continue;
        };
        let before_document = exercises::document(before, list).and_then(Result::ok);
        let roots = changed_roots(before_document.as_ref(), &after_document);
        if roots.is_empty() {
            continue;
        }
        // A fork's own review instructions start as a copy of the live course default's.
        let live_document = exercises::document(live, list).or_else(|| {
            let config = live.course_default_review_config.as_ref()?;
            matches!(list, InstructionsList::Review { .. }).then_some(())?;
            exercises::document(
                live,
                InstructionsList::CourseDefaultReview {
                    config_id: config.id,
                },
            )
        });
        let live_blocks = live_document
            .and_then(Result::ok)
            .map(|document| document.blocks)
            .unwrap_or_default();
        let unchanged_client_ids = unchanged_blocks(
            &roots,
            &blocks_by_id(&live_blocks),
            &mut validated.block_names,
            |_, is_as_published| is_as_published,
        );
        pages.push(PageToValidate {
            list: ValidatedList::Instructions(list),
            page: list.page(after),
            instructions: Some(list.location()),
            roots,
            unchanged_client_ids,
        });
    }
    if pages.is_empty() {
        return Ok(validated);
    }
    if pages.len() > 1 {
        progress.report(0.0, Some(pages.len() as f64), Some("validating pages"));
    }
    let outcomes = validator
        .validate_blocks(&ValidationRequest {
            pages: pages
                .iter()
                .map(|page| PageValidationRequest {
                    target: match page.list {
                        ValidatedList::Page { page_type, .. } => {
                            ValidationTarget::Page { page_type }
                        }
                        ValidatedList::Instructions(list) => ValidationTarget::Exercise {
                            exercise_context: list.validation_context(),
                        },
                    },
                    blocks: &page.roots,
                    unchanged_client_ids: &page.unchanged_client_ids,
                })
                .collect(),
            course_features: CourseBlockFeatures {
                chapter_locking_enabled: after.settings.chapter_locking_enabled,
                can_add_chatbot: after.settings.can_add_chatbot,
            },
        })
        .await?;
    if outcomes.len() != pages.len() {
        return Err(ToolError::Internal(format!(
            "the validator answered for {} pages of {}",
            outcomes.len(),
            pages.len()
        )));
    }
    let mut errors = Vec::new();
    let mut normalised: Vec<(ValidatedList, Vec<GutenbergBlock>)> = Vec::new();
    for (page, outcome) in pages.iter().zip(outcomes) {
        validated
            .unchanged_block_warnings
            .extend(
                outcome
                    .warnings
                    .into_iter()
                    .map(|warning| UnchangedBlockWarning {
                        page: page.page,
                        instructions: page.instructions.clone(),
                        warning,
                    }),
            );
        if outcome.errors.is_empty() {
            normalised.push((page.list, outcome.blocks));
        } else {
            errors.extend(outcome.errors.into_iter().map(|error| (page, error)));
        }
    }
    if !errors.is_empty() {
        let first = &errors[0].1;
        let message = format!(
            "{} block error(s), nothing was staged; first: {}{}",
            errors.len(),
            first.message,
            first
                .client_id
                .map(|id| format!(" (block {id})"))
                .unwrap_or_default()
        );
        let details: Vec<Value> = errors
            .iter()
            .map(|(page, error)| {
                serde_json::to_value(BlockErrorDetail {
                    page: page.page,
                    instructions: page.instructions.as_ref(),
                    error,
                })
                .unwrap_or_default()
            })
            .collect();
        let mut error = EditError::new(EditErrorCode::InvalidBlocks, message)
            .with_details(Value::Array(details));
        if !first.fix.is_empty() {
            error = error.with_fix(first.fix.clone());
        }
        return Err(ToolError::Edit(error));
    }
    for (list, blocks) in normalised {
        let page_id = match list {
            ValidatedList::Page { page_id, .. } => page_id,
            ValidatedList::Instructions(list) => {
                if let Some(Ok(mut document)) = exercises::document(after, list) {
                    replace_roots(&mut document.blocks, blocks);
                    exercises::set_blocks(after, list, &document.blocks);
                }
                continue;
            }
        };
        if let Some(page) = after.page_mut(page_id) {
            replace_roots(Arc::make_mut(&mut page.content).as_mut_slice(), blocks);
        }
    }
    validated.block_names.sort();
    validated.block_names.dedup();
    Ok(validated)
}

/// Puts each of `roots` in place of the top-level block with its id.
fn replace_roots(content: &mut [GutenbergBlock], roots: Vec<GutenbergBlock>) {
    let root_index: HashMap<Uuid, usize> = content
        .iter()
        .enumerate()
        .map(|(index, block)| (block.client_id, index))
        .collect();
    for block in roots {
        if let Some(index) = root_index.get(&block.client_id) {
            content[*index] = block;
        }
    }
}

/// Publishing refuses pages outside chapters that hold exercises or chapter listings.
fn top_level_pages_hold_no_chapter_blocks(
    after: &CourseState,
    page_ids: impl Iterator<Item = Uuid>,
) -> Result<(), ToolError> {
    for page_id in page_ids {
        let Some(page) = after.page(page_id) else {
            continue;
        };
        if page.chapter_id.is_some() {
            continue;
        }
        let disallowed: Vec<String> = blocks_not_allowed_in_top_level_pages(&page.content)
            .iter()
            .map(|block| format!("/{} ({})", block.client_id, block.name))
            .collect();
        if !disallowed.is_empty() {
            return Err(ToolError::Edit(
                EditError::new(
                    EditErrorCode::InvalidBlocks,
                    format!(
                        "page {page_id} is outside chapters, where exercises and chapter listings can't be: {}",
                        disallowed.join(", ")
                    ),
                )
                .with_fix("keep the page in a chapter, or remove those blocks from it first"),
            ));
        }
    }
    Ok(())
}

/// Where a write call's entity writes come from.
pub enum WriteSource {
    /// Found by comparing the staged state with the state after the call.
    Derived {
        exercise_copies: Vec<ExerciseCopy>,
        /// The client ids of blocks the server wrote rather than the agent; see
        /// [`validate_changed_blocks`].
        generated_blocks: HashSet<Uuid>,
    },
    /// A revert of the call `call_id`. Skips validation: it restores content that was valid when
    /// it was written.
    Revert {
        call_id: Uuid,
        writes: Vec<StagedEntity>,
        /// The state each written entity had when the caller read it: staged where the changeset
        /// has it, live otherwise.
        read_states: HashMap<EntityKey, Option<EntitySnapshot>>,
    },
}

/// One write call for [`commit`].
pub struct WriteRequest {
    /// The operations as the agent sent them, for the audit log.
    pub ops: Value,
    pub summary: String,
    pub dry_run: bool,
    pub source: WriteSource,
}

impl WriteRequest {
    /// A write whose changes are found by comparing states.
    pub fn new(ops: Value, summary: String, dry_run: bool) -> Self {
        Self {
            ops,
            summary,
            dry_run,
            source: WriteSource::Derived {
                exercise_copies: Vec::new(),
                generated_blocks: HashSet::new(),
            },
        }
    }
}

/// What a write call staged, or would stage on a dry run.
pub struct WriteReport {
    summary: StagingSummary,
    pub hints: Vec<Hint>,
    /// The state after the call, for `read_back`.
    pub after: CourseState,
}

impl WriteReport {
    /// The tool result: the fields of `extra`, a struct, and the staging summary.
    pub fn into_result(self, extra: &impl Serialize) -> ToolResult {
        #[derive(Serialize)]
        struct Fields<'a, E> {
            #[serde(flatten)]
            extra: &'a E,
            #[serde(flatten)]
            summary: &'a StagingSummary,
        }
        ToolResult::success(Fields {
            extra,
            summary: &self.summary,
        })
        .with_hints(self.hints)
    }
}

#[derive(Serialize)]
#[serde(untagged)]
enum StagingSummary {
    Nothing(NothingStaged),
    DryRun(DryRunSummary),
    Staged(StagedSummary),
}

#[derive(Serialize)]
struct NothingStaged {
    staged: [Value; 0],
    message: &'static str,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    unchanged_block_warnings: Vec<UnchangedBlockWarning>,
}

/// An entity a dry run would stage, with what the call changes of it.
#[derive(Serialize)]
struct DryRunEntity {
    #[serde(flatten)]
    entity: ExplainedEntity,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    field_changes: Vec<FieldChange>,
}

#[derive(Serialize)]
struct DryRunSummary {
    dry_run: bool,
    /// What a real run would list as `staged`.
    would_stage: Vec<DryRunEntity>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    block_changes: Vec<BlockChange>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    unchanged_block_warnings: Vec<UnchangedBlockWarning>,
}

#[derive(Serialize)]
struct StagedSummary {
    changeset: Uuid,
    changeset_revision: i32,
    call: Uuid,
    staged: Vec<ExplainedEntity>,
    review_url: String,
    changeset_expires_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    unchanged_block_warnings: Vec<UnchangedBlockWarning>,
}

/// Runs the pipeline from the user's staged state to `after`: validate, find the written
/// entities and stage them as one call, or on a dry run tell what staging them would do. Holds no
/// pooled connection while the validator runs.
pub async fn commit(
    state: &McpState,
    ctx: &RequestContext,
    view: &CourseView,
    mut after: CourseState,
    request: WriteRequest,
) -> Result<WriteReport, ToolError> {
    let WriteRequest {
        ops,
        summary,
        dry_run,
        source,
    } = request;
    let validated = match &source {
        WriteSource::Derived {
            generated_blocks, ..
        } => {
            validate_changed_blocks(
                state.validator.as_ref(),
                &view.live,
                &view.staged,
                &mut after,
                generated_blocks,
                &ctx.progress,
            )
            .await?
        }
        WriteSource::Revert { .. } => ValidatedBlocks::default(),
    };
    let mut conn = connection(state).await?;
    let (writes, live_snapshots, revert_of_call_id) =
        derive_writes(&mut conn, view, &after, source).await?;
    let unchanged_block_warnings = validated.unchanged_block_warnings;
    if writes.is_empty() {
        return Ok(WriteReport {
            summary: StagingSummary::Nothing(NothingStaged {
                staged: [],
                message: "The call changed nothing, so nothing was staged.",
                unchanged_block_warnings,
            }),
            hints: Vec::new(),
            after,
        });
    }

    let written_pages: Vec<Uuid> = writes
        .iter()
        .map(StagedEntity::key)
        .filter(|(entity_type, _)| *entity_type == ContentEntityType::Page)
        .map(|(_, id)| id)
        .collect();
    let block_changes = diff::diff_pages(&view.staged, &after, &written_pages);
    let mut field_changes: HashMap<EntityKey, Vec<FieldChange>> = HashMap::new();
    if dry_run {
        for write in &writes {
            field_changes.insert(
                write.key(),
                after.field_changes_since(&view.staged, write.key()),
            );
        }
    }
    let read = staged_state_read(view, &writes, live_snapshots);
    let call = StageCall {
        actor: &ctx.principal.actor,
        course_id: view.course.id,
        tool_name: ctx.tool_name,
        ops: &ops,
        summary: Some(&summary),
        entities: writes,
        revert_of_call_id,
        read: &read,
        risk: &RiskBaseline::View(view),
    };
    let outcome = if dry_run {
        stage_call_dry_run(&mut conn, call).await?
    } else {
        stage_call(&mut conn, call).await?
    };
    let staged = match outcome {
        StageCallOutcome::Staged(staged) => staged,
        StageCallOutcome::ChangesetClosed => {
            return Err(ToolError::StagedStateChanged {
                message: "Nothing was staged: your changeset was published, discarded or expired while this call ran. Read the course again and repeat the call on the current state.".into(),
                entities: Vec::new(),
            });
        }
        StageCallOutcome::StaleRead { entities } => return Err(stale_read(&entities)),
        StageCallOutcome::WouldAddBlockers(blockers) => {
            return Err(ToolError::refused(
                ErrorCode::RevertConflict,
                "Nothing was staged: reverting the call would clash with later changes to the course structure. Change the entities named here first, or revert the later calls too.",
                json!({"blockers": explain_blockers(blockers)}),
            ));
        }
    };
    let entities = staged
        .entities
        .iter()
        .map(|row| ExplainedEntity::from(ChangesetEntitySummary::from(row)));
    if dry_run {
        let would_stage = entities
            .map(|entity| DryRunEntity {
                field_changes: field_changes
                    .remove(&entity.entity.key())
                    .unwrap_or_default(),
                entity,
            })
            .collect();
        return Ok(WriteReport {
            summary: StagingSummary::DryRun(DryRunSummary {
                dry_run: true,
                would_stage,
                block_changes,
                unchanged_block_warnings,
            }),
            hints: Vec::new(),
            after,
        });
    }

    let removed_exercises: Vec<Uuid> = block_changes
        .iter()
        .filter(|change| change.kind == diff::ChangeKind::Removed)
        .filter_map(|change| change.exercise_id)
        .collect();
    let removed_exercises_with_submissions = if removed_exercises.is_empty() {
        0
    } else {
        let activity = load_student_activity(&mut conn, view.course.id).await?;
        removed_exercises
            .iter()
            .filter(|id| activity.exercises_with_submissions.contains(id))
            .count()
    };
    let hints = write_hints(
        state,
        ctx.client.client_kind(),
        &staged,
        &block_changes,
        removed_exercises_with_submissions,
        &validated.block_names,
    )
    .await;
    let summary = StagedSummary {
        changeset: staged.changeset.id,
        changeset_revision: staged.changeset.revision,
        call: staged.call_id,
        staged: entities.collect(),
        review_url: state.review_url(staged.changeset.course_id, staged.changeset.id),
        changeset_expires_at: staged.changeset.expires_at,
        unchanged_block_warnings,
    };
    Ok(WriteReport {
        summary: StagingSummary::Staged(summary),
        hints,
        after,
    })
}

/// The entities a call writes, the live state of those it read live, and the call it reverts.
async fn derive_writes(
    conn: &mut PgConnection,
    view: &CourseView,
    after: &CourseState,
    source: WriteSource,
) -> Result<
    (
        Vec<StagedEntity>,
        HashMap<EntityKey, Option<EntitySnapshot>>,
        Option<Uuid>,
    ),
    ToolError,
> {
    match source {
        WriteSource::Revert {
            call_id,
            writes,
            read_states,
        } => {
            let live_snapshots = read_states
                .into_iter()
                .filter(|(key, _)| view.staged_row(*key).is_none())
                .collect();
            Ok((writes, live_snapshots, Some(call_id)))
        }
        WriteSource::Derived {
            exercise_copies, ..
        } => {
            let changes = after.changes_since(&view.staged);
            let mut writes = changes.entities;
            let pages = page_writes(
                conn,
                view,
                after,
                &changes.pages,
                &exercise_copies,
                &RandomIds,
            )
            .await?;
            writes.extend(pages.writes);
            let live_snapshots = live_snapshots(view, &writes, pages.live_pages)?;
            Ok((writes, live_snapshots, None))
        }
    }
}

/// What the agent should know after staging: where to review, what a human must check and what
/// the validated blocks look like.
async fn write_hints(
    state: &McpState,
    client: ClientKind,
    staged: &StageCallResult,
    block_changes: &[BlockChange],
    removed_exercises_with_submissions: usize,
    validated_block_names: &[String],
) -> Vec<Hint> {
    let mut hints = vec![hints::staged(staged.changeset.id)];
    if staged.risk_reason_count > 0 {
        let review_url = state.review_url(staged.changeset.course_id, staged.changeset.id);
        hints.push(hints::needs_teacher_review(
            &review_url,
            staged.risk_reason_count,
        ));
    }
    let pages_with_block_changes = diff::pages_with_block_changes(block_changes);
    if !pages_with_block_changes.is_empty() {
        hints.push(hints::not_visually_checked(
            pages_with_block_changes.len(),
            client,
        ));
    }
    if removed_exercises_with_submissions > 0 {
        hints.push(hints::submissions_affected(
            removed_exercises_with_submissions,
        ));
    }
    if !validated_block_names.is_empty()
        && let Ok(schemas) = state.block_schemas().await
    {
        hints.extend(hints::format_tips(
            validated_block_names.iter().map(String::as_str),
            &schemas,
        ));
    }
    hints
}

fn stale_read(entities: &[EntityKey]) -> ToolError {
    ToolError::StagedStateChanged {
        message: format!(
            "Nothing was staged: another call or a live edit changed {} of the entities this call writes after this call read them. Read them again and repeat the call.",
            entities.len()
        ),
        entities: entities
            .iter()
            .map(|(entity_type, entity_id)| {
                json!({"entity_type": entity_type, "entity_id": entity_id})
            })
            .collect(),
    }
}

/// The live state of each written entity the user has no staged changes to, as the call read it.
/// Pages were read twice, as blocks with the view and in full when their snapshots were built;
/// a page that changed in between is a stale read.
fn live_snapshots(
    view: &CourseView,
    writes: &[StagedEntity],
    mut live_pages: HashMap<Uuid, PageSnapshot>,
) -> Result<HashMap<EntityKey, Option<EntitySnapshot>>, ToolError> {
    let mut snapshots = HashMap::new();
    let mut stale = Vec::new();
    for write in writes {
        let key = write.key();
        if view.staged_row(key).is_some() {
            continue;
        }
        let (entity_type, entity_id) = key;
        let snapshot = if entity_type == ContentEntityType::Page {
            match (view.live.page(entity_id), live_pages.remove(&entity_id)) {
                (None, None) => None,
                (Some(read), Some(loaded)) if PageRecord::from(&loaded) == *read => {
                    Some(EntitySnapshot::Page(loaded))
                }
                _ => {
                    stale.push(key);
                    continue;
                }
            }
        } else {
            view.live.entity_snapshot(key)
        };
        snapshots.insert(key, snapshot);
    }
    if stale.is_empty() {
        Ok(snapshots)
    } else {
        Err(stale_read(&stale))
    }
}

/// The staged state `writes` were built on: the changeset rows of the view and the live state of
/// the other entities.
fn staged_state_read(
    view: &CourseView,
    writes: &[StagedEntity],
    live_snapshots: HashMap<EntityKey, Option<EntitySnapshot>>,
) -> StagedStateRead {
    StagedStateRead {
        changeset_id: view.changeset.as_ref().map(|changeset| changeset.id),
        entity_revisions: writes
            .iter()
            .filter_map(|write| Some((write.key(), view.staged_row(write.key())?.revision)))
            .collect(),
        live_snapshots,
    }
}

#[cfg(test)]
#[path = "staging_tests.rs"]
mod tests;
