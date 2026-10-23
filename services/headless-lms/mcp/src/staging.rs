//! The write pipeline every write tool ends in: find what the call changed, validate written
//! blocks with the CMS, classify risk against the published course, and stage the call.

use std::collections::{HashMap, HashSet};

use headless_lms_models::{
    agent_changeset_calls::CallActor,
    agent_changeset_entities::{
        self, AgentChangesetEntityOperation, AgentChangesetEntityType,
        RiskReason as StoredRiskReason,
    },
    library::{
        agent_changesets::{StageCall, StagedEntity, stage_call},
        entity_snapshots::{EntitySnapshot, PageSnapshot},
    },
};
use serde::Serialize;
use serde_json::{Map, Value, json};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::course_state::{CourseState, CourseView, PageRecord, StudentActivity, risk_facts};
use crate::diff::{self, Diff, EntityType, Snapshot};
use crate::engine::{EditError, EditErrorCode};
use crate::hints::{self, Hint};
use crate::ids::IdGenerator;
use crate::protocol::progress::ProgressReporter;
use crate::risk;
use crate::snapshots::{self, ExerciseBundle, ExerciseCopy};
use crate::state::McpState;
use crate::tools::{Principal, RequestContext, ToolError, ToolResult};
use crate::validator::{BlockValidator, ValidationRequest, changed_roots};

/// One entity's full state after a call; `None` deletes it.
#[derive(Debug, Clone, PartialEq)]
pub struct EntityWrite {
    pub entity_type: AgentChangesetEntityType,
    pub entity_id: Uuid,
    pub after: Option<EntitySnapshot>,
}

type EntityKey = (AgentChangesetEntityType, Uuid);

impl EntityWrite {
    fn key(&self) -> EntityKey {
        (self.entity_type, self.entity_id)
    }
}

/// What a call changed between two states. Pages are listed by id: their full snapshots hold
/// exercises, which only the database has.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct StateChanges {
    pub entities: Vec<EntityWrite>,
    pub pages: Vec<Uuid>,
}

fn changed_by_id<T: Clone + PartialEq>(
    before: &[T],
    after: &[T],
    id_of: impl Fn(&T) -> Uuid,
    entity_type: AgentChangesetEntityType,
    wrap: impl Fn(T) -> EntitySnapshot,
    writes: &mut Vec<EntityWrite>,
) {
    for item in after {
        let id = id_of(item);
        if before.iter().find(|b| id_of(b) == id) != Some(item) {
            writes.push(EntityWrite {
                entity_type,
                entity_id: id,
                after: Some(wrap(item.clone())),
            });
        }
    }
    for item in before {
        let id = id_of(item);
        if !after.iter().any(|a| id_of(a) == id) {
            writes.push(EntityWrite {
                entity_type,
                entity_id: id,
                after: None,
            });
        }
    }
}

/// The entities that differ between the two states.
pub fn state_changes(before: &CourseState, after: &CourseState) -> StateChanges {
    let mut entities = Vec::new();
    if before.settings != after.settings {
        entities.push(EntityWrite {
            entity_type: AgentChangesetEntityType::CourseSettings,
            entity_id: after.course_id,
            after: Some(EntitySnapshot::CourseSettings(after.settings.clone())),
        });
    }
    changed_by_id(
        &before.modules,
        &after.modules,
        |m| m.id,
        AgentChangesetEntityType::Module,
        EntitySnapshot::Module,
        &mut entities,
    );
    changed_by_id(
        &before.chapters,
        &after.chapters,
        |c| c.id,
        AgentChangesetEntityType::Chapter,
        EntitySnapshot::Chapter,
        &mut entities,
    );
    changed_by_id(
        &before.glossary,
        &after.glossary,
        |t| t.id,
        AgentChangesetEntityType::GlossaryTerm,
        EntitySnapshot::GlossaryTerm,
        &mut entities,
    );
    changed_by_id(
        &before.references,
        &after.references,
        |r| r.id,
        AgentChangesetEntityType::Reference,
        EntitySnapshot::Reference,
        &mut entities,
    );
    let mut pages: Vec<Uuid> = after
        .pages
        .iter()
        .filter(|p| before.page(p.id) != Some(*p))
        .map(|p| p.id)
        .collect();
    pages.extend(
        before
            .pages
            .iter()
            .filter(|p| after.page(p.id).is_none())
            .map(|p| p.id),
    );
    StateChanges { entities, pages }
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
) -> Result<Vec<EntityWrite>, ToolError> {
    let copy_sources: HashSet<Uuid> = copies.iter().map(|c| c.source_exercise_id).collect();
    let mut source_pages: Vec<Uuid> = page_ids.to_vec();
    for page in &view.staged.pages {
        let has_source = page.content.iter().any(|b| {
            crate::engine::blocks::exercise_id(b).is_some_and(|id| copy_sources.contains(&id))
        });
        if has_source && !source_pages.contains(&page.id) {
            source_pages.push(page.id);
        }
    }
    let mut current: HashMap<Uuid, PageSnapshot> = HashMap::new();
    let mut bundles: HashMap<Uuid, ExerciseBundle> = HashMap::new();
    for page_id in source_pages {
        if let Some(snapshot) = view.current_page_snapshot(conn, page_id).await? {
            bundles.extend(snapshots::exercise_bundles(&snapshot));
            current.insert(page_id, snapshot);
        }
    }
    for copy in copies {
        let source = bundles.get(&copy.source_exercise_id).ok_or_else(|| {
            ToolError::Internal(format!(
                "copied exercise {} wasn't found on any page",
                copy.source_exercise_id
            ))
        })?;
        let copied = snapshots::copy_exercise(source, copy.new_exercise_id, ids);
        bundles.insert(copy.new_exercise_id, copied);
    }

    let mut writes = Vec::new();
    for page_id in page_ids {
        let Some(record) = after.page(*page_id) else {
            writes.push(EntityWrite {
                entity_type: AgentChangesetEntityType::Page,
                entity_id: *page_id,
                after: None,
            });
            continue;
        };
        let snapshot = match current.get(page_id) {
            Some(base) if base.content == record.content => PageSnapshot {
                chapter_id: record.chapter_id,
                url_path: record.url_path.clone(),
                title: record.title.clone(),
                hidden: record.hidden,
                order_number: record.order_number,
                ..base.clone()
            },
            _ => snapshots::assemble_page_snapshot(after.course_id, record, &bundles).map_err(
                |missing| {
                    ToolError::Internal(format!(
                        "page {page_id} names exercises that weren't found: {missing:?}"
                    ))
                },
            )?,
        };
        writes.push(EntityWrite {
            entity_type: AgentChangesetEntityType::Page,
            entity_id: *page_id,
            after: Some(EntitySnapshot::Page(snapshot)),
        });
    }
    Ok(writes)
}

/// Validates the top-level trees holding blocks that changed between `before` and `after` and
/// replaces them with the validator's normalised form. Pages in `skip` hold server-generated
/// content. Returns the names of the block types that were validated.
pub async fn validate_changed_blocks(
    validator: &dyn BlockValidator,
    before: &CourseState,
    after: &mut CourseState,
    skip: &HashSet<Uuid>,
    progress: &ProgressReporter,
) -> Result<Vec<String>, ToolError> {
    let before_structure = snapshots::structure(before, &HashSet::new());
    let after_structure = snapshots::structure(after, &HashSet::new());
    let mut errors = Vec::new();
    let mut validated_names = Vec::new();
    let mut normalised: Vec<(
        Uuid,
        Vec<headless_lms_utils::document_schema_processor::GutenbergBlock>,
    )> = Vec::new();
    let changed_pages: Vec<&PageRecord> = after
        .pages
        .iter()
        .filter(|page| {
            !skip.contains(&page.id)
                && before.page(page.id).map(|p| &p.content) != Some(&page.content)
        })
        .collect();
    for (index, page) in changed_pages.iter().enumerate() {
        if changed_pages.len() > 1 {
            progress.report(
                index as f64,
                Some(changed_pages.len() as f64),
                Some("validating pages"),
            );
        }
        let Some(after_document) = snapshots::page_document(after, &after_structure, page.id)
        else {
            continue;
        };
        let before_document = snapshots::page_document(before, &before_structure, page.id);
        let changes = diff::diff(
            &Snapshot {
                pages: before_document.into_iter().collect(),
                ..Default::default()
            },
            &Snapshot {
                pages: vec![after_document.clone()],
                ..Default::default()
            },
        );
        let roots = changed_roots(&after_document, &changes);
        if roots.is_empty() {
            continue;
        }
        crate::engine::blocks::walk(&roots, &mut |block, _| {
            validated_names.push(block.name.clone())
        });
        let outcome = validator
            .validate_blocks(&ValidationRequest {
                page_type: after_document.page_type,
                blocks: &roots,
                chapter_locking_enabled: after.settings.chapter_locking_enabled,
                can_add_chatbot: after.settings.can_add_chatbot,
            })
            .await?;
        if outcome.valid {
            normalised.push((page.id, outcome.blocks));
        } else {
            errors.extend(outcome.errors.into_iter().map(|e| (page.id, e)));
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
            .map(|(page_id, error)| {
                let mut value = serde_json::to_value(error).unwrap_or_default();
                value["page"] = json!(page_id);
                value
            })
            .collect();
        let mut error = EditError::new(EditErrorCode::InvalidBlocks, message)
            .with_details(Value::Array(details));
        if !first.fix.is_empty() {
            error = error.with_fix(first.fix.clone());
        }
        return Err(ToolError::Edit(error));
    }
    for (page_id, blocks) in normalised {
        if let Some(page) = after.page_mut(page_id) {
            for block in blocks {
                if let Some(slot) = page
                    .content
                    .iter_mut()
                    .find(|b| b.client_id == block.client_id)
                {
                    *slot = block;
                }
            }
        }
    }
    validated_names.sort();
    validated_names.dedup();
    Ok(validated_names)
}

fn entity_key(entity_type: EntityType, entity_id: Uuid, course_id: Uuid) -> EntityKey {
    match entity_type {
        EntityType::Page => (AgentChangesetEntityType::Page, entity_id),
        EntityType::Chapter => (AgentChangesetEntityType::Chapter, entity_id),
        EntityType::Module | EntityType::ModuleSettings => {
            (AgentChangesetEntityType::Module, entity_id)
        }
        EntityType::Course | EntityType::Audience => {
            (AgentChangesetEntityType::CourseSettings, course_id)
        }
        EntityType::GlossaryTerm => (AgentChangesetEntityType::GlossaryTerm, entity_id),
        EntityType::Reference => (AgentChangesetEntityType::Reference, entity_id),
    }
}

/// Diffs two states: structure, settings, glossary and the blocks of `page_ids`.
fn diff_states(before: &CourseState, after: &CourseState, page_ids: &[Uuid]) -> Diff {
    let side = |state: &CourseState| {
        let structure = snapshots::structure(state, &HashSet::new());
        Snapshot {
            pages: page_ids
                .iter()
                .filter_map(|id| snapshots::page_document(state, &structure, *id))
                .collect(),
            structure: Some(structure),
            settings: Some(snapshots::settings_document(state)),
            glossary: Some(snapshots::glossary_document(state)),
        }
    };
    diff::diff(&side(before), &side(after))
}

fn page_ids(writes: &[EntityWrite]) -> Vec<Uuid> {
    writes
        .iter()
        .filter(|w| w.entity_type == AgentChangesetEntityType::Page)
        .map(|w| w.entity_id)
        .collect()
}

/// The risk reasons of each written entity: the rules run on the whole difference between the
/// published course and `after`, since stored reasons replace earlier ones.
pub fn risk_reasons(
    live: &CourseState,
    after: &CourseState,
    activity: &StudentActivity,
    writes: &[EntityWrite],
) -> HashMap<EntityKey, Vec<StoredRiskReason>> {
    let changes = diff_states(live, after, &page_ids(writes));
    let written: HashSet<EntityKey> = writes.iter().map(EntityWrite::key).collect();
    let mut reasons: HashMap<EntityKey, Vec<StoredRiskReason>> = HashMap::new();
    for reason in risk::classify(&changes, &risk_facts(live, activity)) {
        let key = entity_key(reason.entity_type, reason.entity_id, after.course_id);
        if !written.contains(&key) {
            continue;
        }
        let code = serde_json::to_value(reason.code)
            .ok()
            .and_then(|v| v.as_str().map(str::to_string))
            .unwrap_or_default();
        reasons.entry(key).or_default().push(StoredRiskReason {
            code,
            message: reason.message,
            consequence: reason.consequence,
        });
    }
    reasons
}

/// Who the audit log records a call under.
pub fn call_actor(principal: &Principal) -> CallActor {
    CallActor {
        user_id: principal.user_id,
        oauth_client_id: principal.oauth_client_id,
        oauth_grant_id: principal.grant_id,
        client_name: principal
            .client_name
            .clone()
            .unwrap_or_else(|| "agent".to_string()),
    }
}

/// One entity a write call staged, as results list it.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StagedItem {
    pub entity_type: AgentChangesetEntityType,
    pub entity_id: Uuid,
    pub operation: AgentChangesetEntityOperation,
    pub label: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub risk_reasons: Vec<StoredRiskReason>,
}

/// The audit record of a write call.
pub struct CallRecord<'a> {
    pub tool_name: &'a str,
    pub ops: Value,
    pub summary: Option<String>,
    pub revert_of_call_id: Option<Uuid>,
}

/// How a write call's changes are checked before staging.
#[derive(Default)]
pub struct WriteChecks {
    pub dry_run: bool,
    /// Off for reverts, which restore content that was valid when it was written.
    pub skip_validation: bool,
    /// Pages with server-generated content.
    pub unvalidated_pages: HashSet<Uuid>,
    pub exercise_copies: Vec<ExerciseCopy>,
}

/// What a write call staged, or would stage on a dry run.
pub struct WriteReport {
    pub result: Map<String, Value>,
    pub hints: Vec<Hint>,
    /// Pages whose blocks changed in this call.
    pub pages_with_block_changes: Vec<Uuid>,
    pub validated_block_names: Vec<String>,
    /// The state after the call, for `read_back`.
    pub after: CourseState,
}

impl WriteReport {
    /// The tool result: `extra` fields first, then the staging summary.
    pub fn into_result(self, extra: Map<String, Value>) -> ToolResult {
        let mut structured = extra;
        structured.extend(self.result);
        ToolResult {
            structured,
            hints: self.hints,
            is_error: false,
        }
    }
}

/// One write call for [`commit`].
pub struct WriteRequest<'a> {
    pub call: CallRecord<'a>,
    pub checks: WriteChecks,
    /// Replaces the writes derived from the state change; reverts know their snapshots.
    pub precomputed: Option<Vec<EntityWrite>>,
    pub ids: &'a dyn IdGenerator,
}

/// Runs the pipeline from the user's staged state to `after`: validate, find the written
/// entities, classify risk and stage them as one call.
pub async fn commit(
    state: &McpState,
    conn: &mut PgConnection,
    ctx: &RequestContext,
    view: &CourseView,
    mut after: CourseState,
    request: WriteRequest<'_>,
) -> Result<WriteReport, ToolError> {
    let WriteRequest {
        call,
        checks,
        precomputed,
        ids,
    } = request;
    let validated_block_names = if checks.skip_validation {
        Vec::new()
    } else {
        validate_changed_blocks(
            state.validator.as_ref(),
            &view.staged,
            &mut after,
            &checks.unvalidated_pages,
            &ctx.progress,
        )
        .await?
    };
    let writes = match precomputed {
        Some(writes) => writes,
        None => {
            let changes = state_changes(&view.staged, &after);
            let mut writes = changes.entities;
            writes.extend(
                page_writes(
                    conn,
                    view,
                    &after,
                    &changes.pages,
                    &checks.exercise_copies,
                    ids,
                )
                .await?,
            );
            writes
        }
    };
    let call_diff = diff_states(&view.staged, &after, &page_ids(&writes));
    let pages_with_block_changes = call_diff.pages_with_block_changes();
    let mut result = Map::new();
    let mut hints = Vec::new();
    if writes.is_empty() {
        result.insert("staged".into(), json!([]));
        result.insert(
            "message".into(),
            json!("The call changed nothing, so nothing was staged."),
        );
        return Ok(WriteReport {
            result,
            hints,
            pages_with_block_changes,
            validated_block_names,
            after,
        });
    }

    let activity = crate::course_state::load_student_activity(conn, view.course.id).await?;
    let mut risks = risk_reasons(&view.live, &after, &activity, &writes);
    let label = |write: &EntityWrite| {
        write
            .after
            .as_ref()
            .map(EntitySnapshot::label)
            .or_else(|| entity_label(&view.staged, write.entity_type, write.entity_id))
            .unwrap_or_default()
    };

    if checks.dry_run {
        let items: Vec<Value> = writes
            .iter()
            .map(|w| {
                let mut item = json!({
                    "entity_type": w.entity_type,
                    "entity_id": w.entity_id,
                    "label": label(w),
                    "deleted": w.after.is_none(),
                });
                if let Some(reasons) = risks.get(&w.key()) {
                    item["risk_reasons"] = json!(reasons);
                }
                item
            })
            .collect();
        result.insert("dry_run".into(), json!(true));
        result.insert("would_stage".into(), json!(items));
        result.insert("diff".into(), json!(call_diff));
        return Ok(WriteReport {
            result,
            hints,
            pages_with_block_changes,
            validated_block_names,
            after,
        });
    }

    let labels: HashMap<EntityKey, String> = writes.iter().map(|w| (w.key(), label(w))).collect();
    let actor = call_actor(&ctx.principal);
    let staged_entities = writes
        .into_iter()
        .map(|write| {
            Ok(StagedEntity {
                risk_reasons: risks.remove(&write.key()).unwrap_or_default(),
                after: write
                    .after
                    .as_ref()
                    .map(EntitySnapshot::to_value)
                    .transpose()?,
                entity_type: write.entity_type,
                entity_id: write.entity_id,
            })
        })
        .collect::<Result<Vec<_>, headless_lms_models::ModelError>>()?;
    let staged = stage_call(
        conn,
        StageCall {
            actor: &actor,
            course_id: view.course.id,
            tool_name: call.tool_name,
            ops: &call.ops,
            summary: call.summary.as_deref(),
            entities: staged_entities,
            revert_of_call_id: call.revert_of_call_id,
        },
    )
    .await?;
    let items: Vec<StagedItem> = staged
        .entities
        .iter()
        .map(|row| StagedItem {
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            operation: row.operation,
            label: labels
                .get(&(row.entity_type, row.entity_id))
                .cloned()
                .unwrap_or_default(),
            risk_reasons: row.risk_reasons.clone(),
        })
        .collect();
    let changeset_rows =
        agent_changeset_entities::get_by_changeset_id(conn, staged.changeset.id).await?;
    let risky_count: usize = changeset_rows.iter().map(|e| e.risk_reasons.len()).sum();
    let review_url = state.review_url(view.course.id, staged.changeset.id);

    result.insert("changeset".into(), json!(staged.changeset.id));
    result.insert("call".into(), json!(staged.call.id));
    result.insert("staged".into(), json!(items));
    result.insert("review_url".into(), json!(review_url));
    result.insert(
        "changeset_expires_at".into(),
        json!(staged.changeset.expires_at),
    );
    hints.push(hints::staged(staged.changeset.id));
    if risky_count > 0 {
        hints.push(hints::needs_teacher_review(&review_url, risky_count));
    }
    if !pages_with_block_changes.is_empty() {
        hints.push(hints::not_visually_checked(
            pages_with_block_changes.len(),
            ctx.capabilities.client_kind(),
        ));
    }
    let removed_exercises_with_submissions = call_diff
        .blocks
        .iter()
        .filter(|b| {
            b.kind == diff::ChangeKind::Removed
                && b.exercise_id
                    .is_some_and(|id| activity.exercises_with_submissions.contains(&id))
        })
        .count();
    if removed_exercises_with_submissions > 0 {
        hints.push(hints::submissions_affected(
            removed_exercises_with_submissions,
        ));
    }
    if !validated_block_names.is_empty()
        && let Some(schemas) = state.block_schemas().await
    {
        hints.extend(hints::format_tips(
            validated_block_names.iter().map(String::as_str),
            &schemas,
        ));
    }
    Ok(WriteReport {
        result,
        hints,
        pages_with_block_changes,
        validated_block_names,
        after,
    })
}

fn entity_label(
    state: &CourseState,
    entity_type: AgentChangesetEntityType,
    entity_id: Uuid,
) -> Option<String> {
    match entity_type {
        AgentChangesetEntityType::Page => state.page(entity_id).map(|p| p.title.clone()),
        AgentChangesetEntityType::Chapter => state
            .chapters
            .iter()
            .find(|c| c.id == entity_id)
            .map(|c| c.name.clone()),
        AgentChangesetEntityType::Module => state
            .modules
            .iter()
            .find(|m| m.id == entity_id)
            .map(|m| m.name.clone().unwrap_or_default()),
        AgentChangesetEntityType::CourseSettings => Some(state.settings.name.clone()),
        AgentChangesetEntityType::GlossaryTerm => state
            .glossary
            .iter()
            .find(|t| t.id == entity_id)
            .map(|t| t.term.clone()),
        AgentChangesetEntityType::Reference => state
            .references
            .iter()
            .find(|r| r.id == entity_id)
            .map(|r| r.citation_key.clone()),
    }
}

#[cfg(test)]
#[path = "staging_tests.rs"]
mod tests;
