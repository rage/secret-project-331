//! The write pipeline every write tool ends in: find what the call changed, validate written
//! blocks with the CMS, and stage the call, or on a dry run tell what staging it would do.

use std::collections::{HashMap, HashSet};

use headless_lms_models::{
    agent_changeset_entities::ChangesetEntitySummary,
    exercise_slide_submissions,
    library::{
        agent_changesets::{
            RiskBaseline, StageCall, StageCallOutcome, StagedEntity, StagedStateRead,
            course_state::{CourseState, CourseView, PageRecord},
            stage_call, stage_call_dry_run,
        },
        entity_snapshots::{ContentEntityType, EntityKey, EntitySnapshot, PageSnapshot},
    },
};
use serde_json::{Value, json};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::access::connection;
use crate::diff;
use crate::engine::blocks::ExerciseCopy;
use crate::explanations::{ExplainedEntity, explain_blockers};
use crate::ids::RandomIds;
use crate::state::McpState;
use crate::tools::{RequestContext, ToolError, ToolErrorCode};

mod page_writes;
mod report;
mod validation;

use page_writes::page_writes;
pub use report::WriteReport;
use report::{
    DryRunEntity, DryRunSummary, NothingStaged, StagedSummary, StagingSummary, page_hints,
    write_hints,
};
use validation::{ValidatedBlocks, validate_changed_blocks};

/// Where a write call's entity writes come from.
pub enum WriteSource {
    /// Found by comparing the staged state with the state after the call.
    Derived {
        exercise_copies: Vec<ExerciseCopy>,
        /// The client ids of blocks the server wrote rather than the agent, besides the exercise
        /// copies; see [`validate_changed_blocks`].
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

/// Whether a write call stages its changes or only tells what staging them would do.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum WriteMode {
    Stage,
    DryRun,
}

impl WriteMode {
    /// The mode a tool's `dry_run` argument asks for.
    pub fn from_dry_run(dry_run: bool) -> Self {
        if dry_run { Self::DryRun } else { Self::Stage }
    }
}

/// One write call for [`commit`].
pub struct WriteRequest {
    /// The operations as the agent sent them, for the audit log.
    pub ops: Value,
    pub summary: String,
    pub mode: WriteMode,
    pub source: WriteSource,
}

impl WriteRequest {
    /// A write whose changes are found by comparing states.
    pub fn new(ops: Value, summary: String, mode: WriteMode) -> Self {
        Self {
            ops,
            summary,
            mode,
            source: WriteSource::Derived {
                exercise_copies: Vec::new(),
                generated_blocks: HashSet::new(),
            },
        }
    }
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
        mode,
        source,
    } = request;
    let validated = match &source {
        WriteSource::Derived {
            exercise_copies,
            generated_blocks,
        } => {
            // A copied exercise block carries the attributes the editor stored, which agents
            // may not write.
            let server_written: HashSet<Uuid> = generated_blocks
                .iter()
                .copied()
                .chain(exercise_copies.iter().map(|copy| copy.new_block_id))
                .collect();
            validate_changed_blocks(
                state.validator.as_ref(),
                &view.live,
                &view.staged,
                &mut after,
                &server_written,
                &ctx.progress,
            )
            .await?
        }
        WriteSource::Revert { .. } => ValidatedBlocks::default(),
    };
    let mut conn = connection(state).await?;
    let DerivedWrites {
        writes,
        live_snapshots,
        revert_of_call_id,
    } = derive_writes(&mut conn, view, &after, source).await?;
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
        .filter(|key| key.entity_type == ContentEntityType::Page)
        .map(|key| key.entity_id)
        .collect();
    let block_changes = diff::diff_pages(&view.staged, &after, &written_pages);
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
    let outcome = if mode == WriteMode::DryRun {
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
                ToolErrorCode::RevertConflict,
                "Nothing was staged: reverting the call would clash with later changes to the course structure. Change the entities named here first, or revert the later calls too.",
                json!({"blockers": explain_blockers(blockers)}),
            ));
        }
    };
    let entities = staged.entities.iter().map(|row| {
        let mut entity = ExplainedEntity::from(ChangesetEntitySummary::from(row));
        let key = entity.entity.key();
        entity.is_chapter_front_page = key.entity_type == ContentEntityType::Page
            && (after.is_chapter_front_page(key.entity_id)
                || view.staged.is_chapter_front_page(key.entity_id));
        entity
    });
    if mode == WriteMode::DryRun {
        let would_stage = entities
            .map(|entity| DryRunEntity {
                field_changes: after.field_changes_since(&view.staged, entity.entity.key()),
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
        exercise_slide_submissions::get_exercise_ids_with_submissions_by_course_id(
            &mut conn,
            view.course.id,
            &removed_exercises,
        )
        .await?
        .len()
    };
    let mut hints = write_hints(
        state,
        &staged,
        removed_exercises_with_submissions,
        &validated.block_names,
    )
    .await;
    hints.extend(page_hints(
        ctx.client.client_kind(),
        &block_changes,
        &view.live,
        &after,
        &written_pages,
    ));
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

/// What a write call stages, found from its [`WriteSource`].
struct DerivedWrites {
    writes: Vec<StagedEntity>,
    /// The live state of the written entities the call read live.
    live_snapshots: HashMap<EntityKey, Option<EntitySnapshot>>,
    revert_of_call_id: Option<Uuid>,
}

async fn derive_writes(
    conn: &mut PgConnection,
    view: &CourseView,
    after: &CourseState,
    source: WriteSource,
) -> Result<DerivedWrites, ToolError> {
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
            Ok(DerivedWrites {
                writes,
                live_snapshots,
                revert_of_call_id: Some(call_id),
            })
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
            Ok(DerivedWrites {
                writes,
                live_snapshots,
                revert_of_call_id: None,
            })
        }
    }
}

fn stale_read(entities: &[EntityKey]) -> ToolError {
    ToolError::StagedStateChanged {
        message: format!(
            "Nothing was staged: another call or a live edit changed {} of the entities this call writes after this call read them. Read them again and repeat the call.",
            entities.len()
        ),
        entities: entities
            .iter()
            .map(|key| json!({"entity_type": key.entity_type, "entity_id": key.entity_id}))
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
        let EntityKey {
            entity_type,
            entity_id,
        } = key;
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
mod tests;
