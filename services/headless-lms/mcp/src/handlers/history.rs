//! History of agent write calls and reverting one of them.

use std::collections::{HashMap, hash_map::Entry};

use async_trait::async_trait;
use headless_lms_models::{
    agent_changeset_calls::{self, AgentChangesetCall},
    agent_changeset_entities::AgentChangesetEntityType,
    agent_changesets::{self, AgentChangesetStatus},
    library::{
        agent_changesets::{RevertPlan, plan_revert},
        entity_snapshots::{self, EntitySnapshot},
    },
};
use serde_json::{Map, Value, json};
use uuid::Uuid;

use crate::access::open_course;
use crate::course_state::CourseState;
use crate::ids::RandomIds;
use crate::staging::{self, CallRecord, EntityWrite, WriteChecks, WriteRequest};
use crate::state::McpState;
use crate::tools::args::{GetHistoryArgs, RevertChangeArgs};
use crate::tools::{
    RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult, parse_arguments, parse_id,
};

pub struct GetHistory;
pub struct RevertChange;

const DEFAULT_HISTORY_LIMIT: u32 = 20;
const MAX_HISTORY_LIMIT: u32 = 100;
/// Calls scanned for one entity's history, newest first.
const ENTITY_HISTORY_SCAN: i64 = 500;

fn snapshot_label(entity_type: AgentChangesetEntityType, value: Option<&Value>) -> String {
    value
        .and_then(|v| EntitySnapshot::from_value(entity_type, v).ok())
        .map(|s| s.label())
        .unwrap_or_default()
}

fn call_json(call: &AgentChangesetCall, changeset_status: Option<AgentChangesetStatus>) -> Value {
    let entities: Vec<Value> = call
        .entity_changes
        .iter()
        .map(|change| {
            json!({
                "entity_type": change.entity_type,
                "entity_id": change.entity_id,
                "operation": change.operation,
                "label": snapshot_label(
                    change.entity_type,
                    change.after.as_ref().or(change.before.as_ref()),
                ),
            })
        })
        .collect();
    json!({
        "call": call.id,
        "tool": call.tool_name,
        "summary": call.summary,
        "created_at": call.created_at,
        "via": call.client_name,
        "changeset": call.changeset_id,
        "changeset_status": changeset_status,
        "revert_of": call.revert_of_call_id,
        "entities": entities,
    })
}

/// Which kind of entity an id names in the course, if any.
fn entity_type_of(state: &CourseState, id: Uuid) -> Option<AgentChangesetEntityType> {
    if state.page(id).is_some() {
        Some(AgentChangesetEntityType::Page)
    } else if state.chapters.iter().any(|c| c.id == id) {
        Some(AgentChangesetEntityType::Chapter)
    } else if state.modules.iter().any(|m| m.id == id) {
        Some(AgentChangesetEntityType::Module)
    } else if state.glossary.iter().any(|t| t.id == id) {
        Some(AgentChangesetEntityType::GlossaryTerm)
    } else if state.references.iter().any(|r| r.id == id) {
        Some(AgentChangesetEntityType::Reference)
    } else if state.course_id == id {
        Some(AgentChangesetEntityType::CourseSettings)
    } else {
        None
    }
}

#[async_trait]
impl ToolHandler<McpState> for GetHistory {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: GetHistoryArgs = parse_arguments(arguments)?;
        let limit = args
            .limit
            .unwrap_or(DEFAULT_HISTORY_LIMIT)
            .clamp(1, MAX_HISTORY_LIMIT);
        let entity = args
            .entity
            .as_deref()
            .map(|e| parse_id(e, "entity"))
            .transpose()?;
        let (mut conn, view) = open_course(state, ctx, &args.course).await?;
        let user_id = ctx.principal.user_id;
        let scan = if entity.is_some() {
            ENTITY_HISTORY_SCAN
        } else {
            i64::from(limit)
        };
        let calls = agent_changeset_calls::get_recent_by_user_and_course(
            &mut conn,
            user_id,
            view.course.id,
            scan,
        )
        .await?;
        let mut statuses: HashMap<Uuid, AgentChangesetStatus> = HashMap::new();
        let mut items = Vec::new();
        for call in calls
            .iter()
            .filter(|c| entity.is_none_or(|id| c.entity_changes.iter().any(|e| e.entity_id == id)))
            .take(limit as usize)
        {
            if let Entry::Vacant(entry) = statuses.entry(call.changeset_id) {
                entry.insert(
                    agent_changesets::get_by_id(&mut conn, call.changeset_id)
                        .await?
                        .status,
                );
            }
            items.push(call_json(call, statuses.get(&call.changeset_id).copied()));
        }
        let mut result = json!({"calls": items});
        if let Some(entity_id) = entity {
            let entity_type = entity_type_of(&view.live, entity_id)
                .or_else(|| entity_type_of(&view.staged, entity_id));
            if let Some(entity_type) = entity_type
                && let Some(version) =
                    entity_snapshots::latest_version(&mut conn, entity_type, entity_id).await?
            {
                result["last_published_change"] = json!({
                    "at": version.created_at,
                    "by_user": version.author_user_id,
                    "via": version.agent_client_name.unwrap_or_else(|| "web".to_string()),
                });
            }
        }
        Ok(ToolResult::success(result).into())
    }
}

#[async_trait]
impl ToolHandler<McpState> for RevertChange {
    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: RevertChangeArgs = parse_arguments(arguments)?;
        let call_id = parse_id(&args.call, "call")?;
        let (mut conn, view) = open_course(state, ctx, &args.course).await?;
        let course_id = view.course.id;
        let not_found = || ToolError::NotFound {
            message: format!(
                "you made no call {call_id} in course {course_id}; get_history lists your calls"
            ),
        };
        let plan = plan_revert(&mut conn, call_id, ctx.principal.user_id)
            .await
            .map_err(|_| not_found())?;
        let (call, entities) = match plan {
            RevertPlan::Ready { call, entities } => (call, entities),
            RevertPlan::Conflicts(conflicts) => {
                return Ok(ToolResult {
                    structured: Map::from_iter([(
                        "error".to_string(),
                        json!({
                            "code": "revert_conflict",
                            "message": "Nothing was staged: these entities changed again after the call, so reverting it would undo later changes too.",
                            "conflicts": conflicts,
                        }),
                    )]),
                    hints: Vec::new(),
                    is_error: true,
                }
                .into());
            }
        };
        let changeset = agent_changesets::get_by_id(&mut conn, call.changeset_id).await?;
        if changeset.course_id != view.course.id {
            return Err(not_found());
        }
        let mut writes = Vec::with_capacity(entities.len());
        let mut after = view.staged.clone();
        for entity in entities {
            let snapshot = entity
                .after
                .as_ref()
                .map(|value| EntitySnapshot::from_value(entity.entity_type, value))
                .transpose()?;
            after.set_entity(entity.entity_type, entity.entity_id, snapshot.as_ref());
            writes.push(EntityWrite {
                entity_type: entity.entity_type,
                entity_id: entity.entity_id,
                after: snapshot,
            });
        }
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
                    ops: json!({"call": call.id}),
                    summary: Some(format!("revert of {} call {}", call.tool_name, call.id)),
                    revert_of_call_id: Some(call.id),
                },
                checks: WriteChecks {
                    dry_run: args.dry_run.unwrap_or(false),
                    skip_validation: true,
                    ..Default::default()
                },
                precomputed: Some(writes),
                ids: &ids,
            },
        )
        .await?;
        let mut extra = Map::new();
        extra.insert("reverted_call".into(), json!(call.id));
        Ok(report.into_result(extra).into())
    }
}
