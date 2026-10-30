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

#[derive(Serialize)]
pub(super) struct StagedSummary {
    pub(super) changeset: Uuid,
    pub(super) changeset_revision: i32,
    pub(super) call: Uuid,
    pub(super) staged: Vec<ExplainedEntity>,
    pub(super) review_url: String,
    pub(super) changeset_expires_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(super) unchanged_block_warnings: Vec<BlockFinding>,
}

/// What the agent should know after staging: where to review, what a human must check and what
/// the validated blocks look like.
pub(super) async fn write_hints(
    state: &McpState,
    staged: &StageCallResult,
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

/// What the agent should know about the pages after a call changed `block_changes`: unchecked
/// rendering changes in the changeset, and placeholder text left in `written_pages`.
pub(super) fn page_hints(
    client: ClientKind,
    block_changes: &[BlockChange],
    live: &CourseState,
    after: &CourseState,
    written_pages: &[Uuid],
) -> Vec<Hint> {
    let mut hints = Vec::new();
    if !block_changes.is_empty() {
        // Nothing records visual checks, so every page whose blocks differ from live counts.
        let unchecked = page_readiness::pages_with_content_changes(after, live).count();
        if unchecked > 0 {
            hints.push(hints::not_visually_checked(unchecked, client));
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
