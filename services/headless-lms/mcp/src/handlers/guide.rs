//! The `guide` tool: block schemas from the CMS, the hand-written topics and, for global admins,
//! exercise services' private spec schemas.

use async_trait::async_trait;
use headless_lms_models::exercise_service_info;
use serde_json::{Value, json};

use crate::access::connection;
use crate::guide::{self, GuideTopic};
use crate::state::McpState;
use crate::tools::args::GuideArgs;
use crate::tools::{RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult};

/// Handler of the `guide` tool.
pub struct Guide;

/// The exercise types whose services declare a private spec schema, by their cached service info.
async fn types_with_schema(state: &McpState) -> Result<Vec<String>, ToolError> {
    let mut conn = connection(state).await?;
    let mut types: Vec<String> =
        exercise_service_info::get_all_exercise_services_by_type(&mut conn)
            .await?
            .into_iter()
            .filter(|(_, (_, info))| info.private_spec_schema_endpoint_path.is_some())
            .map(|(slug, _)| slug)
            .collect();
    types.sort();
    Ok(types)
}

#[async_trait(?Send)]
impl ToolHandler<McpState> for Guide {
    type Args = GuideArgs;

    async fn call(
        &self,
        state: &McpState,
        ctx: &RequestContext,
        args: GuideArgs,
    ) -> Result<ToolOutcome, ToolError> {
        let block_types = args.block_types.unwrap_or_default();
        let topics = args.topics.unwrap_or_default();
        let exercise_types = args.exercise_types.unwrap_or_default();
        let is_admin = ctx.principal.is_global_admin;
        if !exercise_types.is_empty() && !is_admin {
            return Err(ToolError::Forbidden {
                message: "exercise_types is only for global admins".into(),
            });
        }
        let schemas =
            if block_types.is_empty() && (!topics.is_empty() || !exercise_types.is_empty()) {
                None
            } else {
                Some(state.block_schemas().await?)
            };
        let mut answer = if block_types.is_empty() && topics.is_empty() && schemas.is_none() {
            json!({})
        } else {
            guide::answer(schemas.as_deref(), &block_types, &topics)?
        };
        if is_admin && topics.contains(&GuideTopic::Exercises) {
            let types = types_with_schema(state).await?;
            if let Some(entry) = answer["topics"].as_array_mut().and_then(|topics| {
                topics
                    .iter_mut()
                    .find(|t| t["topic"] == json!(GuideTopic::Exercises))
            }) {
                entry["text"] = json!(format!(
                    "{}\n{}\nTypes serving a private spec schema: {}.",
                    entry["text"].as_str().unwrap_or_default(),
                    guide::EXERCISES_FOR_ADMINS,
                    if types.is_empty() {
                        "none".to_string()
                    } else {
                        types.join(", ")
                    }
                ));
            }
        }
        if !exercise_types.is_empty() {
            let mut served = Vec::new();
            for exercise_type in &exercise_types {
                let schema = state.private_spec_schema(exercise_type).await?;
                served.push(match schema {
                    Some(schema) => json!({"exercise_type": exercise_type, "private_spec_schema": *schema}),
                    None => json!({"exercise_type": exercise_type, "private_spec_schema": Value::Null, "note": "the service serves no schema; it checks private specs when the changeset is published"}),
                });
            }
            answer["exercise_types"] = Value::Array(served);
        }
        Ok(ToolResult::success(answer).into())
    }
}
