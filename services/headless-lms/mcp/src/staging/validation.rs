//! Validating the blocks a call changed with the CMS, and writing back their normalised form.

use std::collections::{BTreeSet, HashMap, HashSet};
use std::sync::Arc;

use headless_lms_models::library::agent_changesets::course_state::CourseState;
use headless_lms_utils::document_schema_processor::{
    GutenbergBlock, blocks_not_allowed_in_top_level_pages,
};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use crate::diff::changed_roots;
use crate::engine::{EditError, EditErrorCode};
use crate::engine::{PageDocument, PageType};
use crate::instruction_lists::{self, InstructionsList, InstructionsLocation};
use crate::page_readiness::pages_with_content_changes;
use crate::protocol::progress::ProgressReporter;
use crate::snapshots;
use crate::tools::ToolError;
use crate::validator::{
    BlockValidationError, BlockValidator, CourseBlockFeatures, PageValidationRequest,
    ValidationRequest, ValidationTarget,
};

/// A validator finding with the page or instruction list it was found in: an error, or a warning
/// on a teacher's block the call left as it was.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct BlockFinding {
    /// `None` for the course default review instructions.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<Uuid>,
    #[serde(flatten)]
    pub instructions: Option<InstructionsLocation>,
    #[serde(flatten)]
    pub finding: BlockValidationError,
}

/// What validating a write's blocks found besides errors.
#[derive(Debug, Default)]
pub struct ValidatedBlocks {
    /// The names of the block types that were validated.
    pub block_names: Vec<String>,
    /// Problems the validator found in the teacher's blocks that the call didn't change.
    pub unchanged_block_warnings: Vec<BlockFinding>,
}

/// A list of blocks the validator checks.
#[derive(Clone, Copy)]
enum ValidatedList {
    Page { page_id: Uuid, page_type: PageType },
    Instructions(InstructionsList),
}

impl ValidatedList {
    /// `findings` located in this list of `state`.
    fn findings(
        self,
        state: &CourseState,
        findings: Vec<BlockValidationError>,
    ) -> impl Iterator<Item = BlockFinding> {
        let (page, instructions) = match self {
            ValidatedList::Page { page_id, .. } => (Some(page_id), None),
            ValidatedList::Instructions(list) => (list.page(state), Some(list.location())),
        };
        findings.into_iter().map(move |finding| BlockFinding {
            page,
            instructions: instructions.clone(),
            finding,
        })
    }
}

/// The blocks of one page or instruction list that go to the validator.
struct PageToValidate {
    list: ValidatedList,
    roots: Vec<GutenbergBlock>,
    /// Blocks sent as unchanged, whose problems only warn.
    unchanged_client_ids: Vec<Uuid>,
}

/// Every block in `blocks` by client id.
fn blocks_by_id(blocks: &[GutenbergBlock]) -> HashMap<Uuid, &GutenbergBlock> {
    let mut by_id = HashMap::new();
    crate::engine::blocks::walk(blocks, &mut |block, _| {
        by_id.insert(block.client_id, block);
    });
    by_id
}

/// The ids of the blocks in `roots` that `is_unchanged` holds for, given the block and whether
/// `live_blocks` has it as it is.
fn unchanged_blocks(
    roots: &[GutenbergBlock],
    live_blocks: &HashMap<Uuid, &GutenbergBlock>,
    is_unchanged: impl Fn(&GutenbergBlock, bool) -> bool,
) -> Vec<Uuid> {
    let mut unchanged_client_ids = Vec::new();
    crate::engine::blocks::walk(roots, &mut |block, _| {
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
    let mut validated = ValidatedBlocks::default();
    let pages = collect_validation_targets(live, before, after, generated_blocks)?;
    if pages.is_empty() {
        return Ok(validated);
    }
    let mut block_names: BTreeSet<&str> = BTreeSet::new();
    for page in &pages {
        crate::engine::blocks::walk(&page.roots, &mut |block, _| {
            block_names.insert(&block.name);
        });
    }
    validated.block_names = block_names.into_iter().map(str::to_owned).collect();
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
            .extend(page.list.findings(after, outcome.warnings));
        if outcome.errors.is_empty() {
            normalised.push((page.list, outcome.blocks));
        } else {
            errors.extend(page.list.findings(after, outcome.errors));
        }
    }
    if let Some(error) = block_error(&errors) {
        return Err(error);
    }
    write_back_normalised(after, normalised);
    Ok(validated)
}

/// The block trees of `after` that [`validate_changed_blocks`] sends.
fn collect_validation_targets(
    live: &CourseState,
    before: &CourseState,
    after: &CourseState,
    generated_blocks: &HashSet<Uuid>,
) -> Result<Vec<PageToValidate>, ToolError> {
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
    let mut pages: Vec<PageToValidate> = Vec::new();
    for (page_id, is_type_changed) in &changed_page_ids {
        let Some(after_page) = after.page(*page_id).map(snapshots::page_ref) else {
            continue;
        };
        let roots = if *is_type_changed {
            after_page.blocks.to_vec()
        } else {
            changed_roots(before.page(*page_id).map(snapshots::page_ref), after_page)
        };
        if roots.is_empty() {
            continue;
        }
        let unchanged_client_ids = unchanged_blocks(
            &roots,
            &live_blocks,
            // Blocks in a new kind of page are checked against what that page allows.
            |block, is_as_published| {
                (is_as_published && !is_type_changed) || generated_blocks.contains(&block.client_id)
            },
        );
        pages.push(PageToValidate {
            list: ValidatedList::Page {
                page_id: *page_id,
                page_type: after_page.page_type,
            },
            roots,
            unchanged_client_ids,
        });
    }
    for list in instruction_lists::changed_lists(before, after) {
        let Some(after_document) = list.document(after).transpose()? else {
            continue;
        };
        let before_document = list.document(before).and_then(Result::ok);
        let roots = changed_roots(
            before_document.as_ref().map(PageDocument::as_page_ref),
            after_document.as_page_ref(),
        );
        if roots.is_empty() {
            continue;
        }
        // A fork's own review instructions start as a copy of the live course default's.
        let live_document = list.document(live).or_else(|| {
            let config = live.course_default_review_config.as_ref()?;
            matches!(list, InstructionsList::Review { .. }).then_some(())?;
            InstructionsList::CourseDefaultReview {
                config_id: config.id,
            }
            .document(live)
        });
        let live_blocks = live_document
            .and_then(Result::ok)
            .map(|document| document.blocks)
            .unwrap_or_default();
        let unchanged_client_ids =
            unchanged_blocks(&roots, &blocks_by_id(&live_blocks), |_, is_as_published| {
                is_as_published
            });
        pages.push(PageToValidate {
            list: ValidatedList::Instructions(list),
            roots,
            unchanged_client_ids,
        });
    }
    Ok(pages)
}

/// The block types in the trees `staged` changed from `live`, which earlier calls of the
/// changeset validated.
pub fn changeset_block_names(live: &CourseState, staged: &CourseState) -> HashSet<String> {
    let mut roots = Vec::new();
    for page in pages_with_content_changes(staged, live) {
        roots.extend(changed_roots(
            live.page(page.id).map(snapshots::page_ref),
            snapshots::page_ref(page),
        ));
    }
    for list in instruction_lists::changed_lists(live, staged) {
        let Some(Ok(staged_document)) = list.document(staged) else {
            continue;
        };
        let live_document = list.document(live).and_then(Result::ok);
        roots.extend(changed_roots(
            live_document.as_ref().map(PageDocument::as_page_ref),
            staged_document.as_page_ref(),
        ));
    }
    let mut names = HashSet::new();
    crate::engine::blocks::walk(&roots, &mut |block, _| {
        names.insert(block.name.clone());
    });
    names
}

/// The error rejecting the call for the validator's `errors`; `None` when there are none.
fn block_error(errors: &[BlockFinding]) -> Option<ToolError> {
    let first = &errors.first()?.finding;
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
        .map(|error| serde_json::to_value(error).unwrap_or_default())
        .collect();
    let mut error =
        EditError::new(EditErrorCode::InvalidBlocks, message).with_details(Value::Array(details));
    if !first.fix.is_empty() {
        error = error.with_fix(first.fix.clone());
    }
    Some(ToolError::Edit(error))
}

/// Puts the validator's normalised trees in place of the ones sent.
fn write_back_normalised(
    after: &mut CourseState,
    normalised: Vec<(ValidatedList, Vec<GutenbergBlock>)>,
) {
    for (list, blocks) in normalised {
        match list {
            ValidatedList::Page { page_id, .. } => {
                if let Some(page) = after.page_mut(page_id) {
                    replace_roots(Arc::make_mut(&mut page.content).as_mut_slice(), blocks);
                }
            }
            ValidatedList::Instructions(list) => {
                if let Some(Ok(mut document)) = list.document(after) {
                    replace_roots(&mut document.blocks, blocks);
                    list.set_blocks(after, &document.blocks);
                }
            }
        }
    }
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
