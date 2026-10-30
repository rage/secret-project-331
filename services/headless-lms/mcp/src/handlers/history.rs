//! History of agent write calls and reverting one of them.

use async_trait::async_trait;
use headless_lms_base::error::backend_error::BackendError;
use headless_lms_models::{
    ModelErrorType,
    agent_changeset_calls::{self, CallHistoryEntry},
    entity_history,
    library::agent_changesets::{
        RevertPlan,
        course_state::{CourseState, CourseView},
        plan_revert,
    },
};
use serde_json::{Value, json};

use crate::access::{authorize_course, connection, open_course};
use crate::snapshots;
use crate::staging::{self, WriteMode, WriteRequest, WriteSource};
use crate::state::McpState;
use crate::tools::args::{GetHistoryArgs, IdArgument, RevertChangeArgs};
use crate::tools::{
    McpScope, RequestContext, ToolError, ToolErrorCode, ToolHandler, ToolOutcome, ToolResult,
};

/// Handler of the `get_history` tool.
pub struct GetHistory;
/// Handler of the `revert_change` tool.
pub struct RevertChange;

const DEFAULT_HISTORY_LIMIT: u32 = 20;
const MAX_HISTORY_LIMIT: u32 = 100;

/// Whether turning the view's staged state into `after` changes what only the settings tool
/// writes. Decided by content, since a revert of a revert is recorded under `revert_change`.
fn changes_settings(view: &CourseView, after: &CourseState) -> bool {
    let mut written = view.staged.clone();
    snapshots::apply_settings(
        &mut written,
        &snapshots::settings_document(after, &view.course),
    );
    written != view.staged
}

fn call_json(call: CallHistoryEntry) -> Value {
    json!({
        "call": call.id,
        "tool": call.tool_name,
        "summary": call.summary,
        "created_at": call.created_at,
        "via": call.client_name,
        "changeset": call.changeset_id,
        "changeset_status": call.changeset_status,
        "revert_of": call.revert_of_call_id,
        "entities": call.entities,
    })
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for GetHistory {
    type Args = GetHistoryArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: GetHistoryArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let limit = args
            .limit
            .unwrap_or(DEFAULT_HISTORY_LIMIT)
            .clamp(1, MAX_HISTORY_LIMIT);
        let entity = args.entity.map(IdArgument::id);
        let course_id = args.course.id();
        let mut conn = connection(state).await?;
        let user_id = ctx.principal.actor.user_id;
        authorize_course(&mut conn, user_id, course_id).await?;
        let calls = agent_changeset_calls::get_history(
            &mut conn,
            user_id,
            course_id,
            entity,
            i64::from(limit),
        )
        .await?;
        let items: Vec<Value> = calls.into_iter().map(call_json).collect();
        let mut result = json!({"calls": items});
        if let Some(entity_id) = entity
            && let Some(version) =
                entity_history::latest_version(&mut conn, entity_id, Some(course_id)).await?
        {
            result["last_published_change"] = json!({
                "at": version.created_at,
                "by_user": version.author_user_id,
                "via": version.agent_client_name.unwrap_or_else(|| "web".to_string()),
            });
        }
        Ok(ToolResult::success(result).into())
    }
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for RevertChange {
    type Args = RevertChangeArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: RevertChangeArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let call_id = args.call.id();
        let view = open_course(state, ctx, args.course.id()).await?;
        let course_id = view.course.id;
        let not_found = || ToolError::NotFound {
            message: format!(
                "you made no call {call_id} in course {course_id}; get_history lists your calls"
            ),
        };
        let plan = plan_revert(
            &mut *connection(state).await?,
            &view,
            call_id,
            ctx.principal.actor.user_id,
        )
        .await
        .map_err(|error| match error.error_type() {
            ModelErrorType::NotFound | ModelErrorType::RecordNotFound => not_found(),
            _ => error.into(),
        })?;
        let (tool_name, entities, current) = match plan {
            RevertPlan::Ready {
                tool_name,
                entities,
                current,
            } => (tool_name, entities, current),
            RevertPlan::Conflicts(conflicts) => {
                return Err(ToolError::refused(
                    ToolErrorCode::RevertConflict,
                    "Nothing was staged: these entities changed again after the call, so reverting it would undo later changes too.",
                    json!({"conflicts": conflicts}),
                ));
            }
        };
        let mut after = view.staged.clone();
        for entity in &entities {
            after.set_entity(entity.key(), entity.after());
        }
        if changes_settings(&view, &after) {
            ctx.require_scope(McpScope::SettingsWrite)?;
        }
        let report = staging::commit(
            state,
            ctx,
            &view,
            after,
            WriteRequest {
                source: WriteSource::Revert {
                    call_id,
                    writes: entities,
                    read_states: current,
                },
                ..WriteRequest::new(
                    json!({"call": call_id}),
                    format!("revert of {tool_name} call {call_id}"),
                    WriteMode::from_dry_run(args.dry_run),
                )
            },
        )
        .await?;
        Ok(report
            .into_result(&json!({"reverted_call": call_id}))
            .into())
    }
}
