//! What a write call reports back: the staging summary and the hints that follow it.

use chrono::{DateTime, Utc};
use headless_lms_models::library::agent_changesets::{
    FieldChange, StageCallResult, course_state::CourseState,
};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use super::validation::BlockFinding;
use crate::diff::BlockChange;
use crate::explanations::ExplainedEntity;
use crate::hints::{self, Hint};
use crate::page_readiness;
use crate::protocol::context::ClientKind;
use crate::state::McpState;
use crate::tools::ToolResult;

/// What a write call staged, or would stage on a dry run.
pub struct WriteReport {
    pub(super) summary: StagingSummary,
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
pub(super) enum StagingSummary {
    Nothing(NothingStaged),
    DryRun(DryRunSummary),
    BriefDryRun(BriefDryRunSummary),
    Staged(StagedSummary),
}

#[derive(Serialize)]
pub(super) struct NothingStaged {
    pub(super) staged: [Value; 0],
    pub(super) message: &'static str,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(super) unchanged_block_warnings: Vec<BlockFinding>,
}

/// An entity a dry run would stage, with what the call changes of it.
#[derive(Serialize)]
pub(super) struct DryRunEntity {
    #[serde(flatten)]
    pub(super) entity: ExplainedEntity,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(super) field_changes: Vec<FieldChange>,
}

#[derive(Serialize)]
pub(super) struct DryRunSummary {
    pub(super) dry_run: bool,
    /// What a real run would list as `staged`.
    pub(super) would_stage: Vec<DryRunEntity>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(super) block_changes: Vec<BlockChange>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(super) unchanged_block_warnings: Vec<BlockFinding>,
}

/// A dry run without the per-entity and per-block detail, for calls that report their own outline.
#[derive(Serialize)]
pub(super) struct BriefDryRunSummary {
    pub(super) dry_run: bool,
    pub(super) would_stage_count: usize,
    pub(super) block_change_count: usize,
    /// The would-be staged entities that need a teacher's review.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(super) risky_entities: Vec<ExplainedEntity>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(super) unchanged_block_warnings: Vec<BlockFinding>,
}

#[derive(Serialize)]
pub(super) struct StagedSummary {
    pub(super) changeset: Uuid,
    pub(super) changeset_revision: i32,
    pub(super) call: Uuid,
    pub(super) staged: Vec<ExplainedEntity>,
    pub(super) changeset_expires_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(super) unchanged_block_warnings: Vec<BlockFinding>,
}

/// What the agent should know after staging: where to review, what a human must check and what
/// the block types `new_block_names` look like.
pub(super) async fn write_hints(
    state: &McpState,
    staged: &StageCallResult,
    is_draft: bool,
    removed_exercises_with_submissions: usize,
    new_block_names: &[&str],
) -> Vec<Hint> {
    let mut hints = vec![hints::staged(staged.changeset.id, is_draft)];
    if staged.risk_reason_count > 0 {
        let review_url = state.review_url(staged.changeset.id);
        hints.push(hints::needs_teacher_review(
            &review_url,
            staged.risk_reason_count,
        ));
    }
    if removed_exercises_with_submissions > 0 {
        hints.push(hints::submissions_affected(
            removed_exercises_with_submissions,
        ));
    }
    if !new_block_names.is_empty()
        && let Ok(schemas) = state.block_schemas().await
    {
        hints.extend(hints::format_tips(
            new_block_names.iter().copied(),
            &schemas,
        ));
    }
    hints
}

/// What the agent should know about the pages after a call changed `block_changes`: the first
/// rendering changes in the changeset, and placeholder text left in `written_pages`.
pub(super) fn page_hints(
    client: ClientKind,
    block_changes: &[BlockChange],
    live: &CourseState,
    before: &CourseState,
    after: &CourseState,
    written_pages: &[Uuid],
) -> Vec<Hint> {
    let mut hints = Vec::new();
    // publish_changeset repeats the hint with the final count.
    if !block_changes.is_empty()
        && page_readiness::pages_with_content_changes(before, live)
            .next()
            .is_none()
    {
        let changed = page_readiness::pages_with_content_changes(after, live).count();
        if changed > 0 {
            hints.push(hints::rendering_changes(changed, client));
        }
    }
    for page in written_pages.iter().filter_map(|id| after.page(*id)) {
        let placeholders = page_readiness::placeholder_texts(&page.content);
        if !placeholders.is_empty() {
            hints.push(hints::template_placeholders(page.id, &placeholders));
        }
    }
    hints
}
