use indexmap::IndexMap;

use headless_lms_models::course_designer_plan_members;
use headless_lms_models::course_designer_plans::CourseDesignerStage;
use headless_lms_utils::json_schema_types::Schema;
use headless_lms_utils::strings::non_empty_trimmed;

use super::{
    authorized_plan_id, parse_raw_arguments, parse_stage, plan_proposal_items,
    plan_tool_declaration_items, resolve_member_by_name, text_property, updated_plan_payload,
};
use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotToolDeclaration,
        action_tools::{ActionAuditFields, ConfirmableActionTool, ExecutedAction},
        tool_authorization::ToolAuthorization,
    },
    prelude::*,
};

/// Proposes a new task in one of the plan's stages, optionally assigned to a member.
pub struct ProposeAddTaskTool;

pub struct ProposeAddTaskArguments {
    stage: CourseDesignerStage,
    title: String,
    description: Option<String>,
    assignee_name: Option<String>,
}

#[derive(Deserialize)]
struct RawArguments {
    stage: String,
    title: String,
    description: String,
    assignee_name: String,
}

impl ChatbotToolDeclaration for ProposeAddTaskTool {
    const NAME: &'static str = "propose_add_task";

    plan_tool_declaration_items!();

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Propose adding a task to a stage of the plan. The user applies or discards it; nothing is saved before that.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "stage".to_string(),
                        text_property("analysis, design, development, implementation or evaluation."),
                    ),
                    (
                        "title".to_string(),
                        text_property("Short task title in the user's language."),
                    ),
                    (
                        "description".to_string(),
                        text_property("Optional details; empty string for none."),
                    ),
                    (
                        "assignee_name".to_string(),
                        text_property("Optional: the member to assign, by name exactly as get_course_plan lists them; empty string to leave it unassigned."),
                    ),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

impl ConfirmableActionTool for ProposeAddTaskTool {
    type Arguments = ProposeAddTaskArguments;
    plan_proposal_items!();

    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = parse_raw_arguments(arguments)?;
        let title = non_empty_trimmed(&raw.title)
            .map(str::to_string)
            .ok_or_else(|| {
                chatbot_err!(InvalidToolArguments, "title must not be empty.".to_string())
            })?;
        Ok(ProposeAddTaskArguments {
            stage: parse_stage(&raw.stage)?,
            title,
            description: non_empty_trimmed(&raw.description).map(str::to_string),
            assignee_name: non_empty_trimmed(&raw.assignee_name).map(str::to_string),
        })
    }

    async fn execute(
        conn: &mut PgConnection,
        _app_config: &ApplicationConfiguration,
        arguments: &Self::Arguments,
        authorization: &ToolAuthorization<Self>,
    ) -> ChatbotResult<(ExecutedAction, Self::Facts)> {
        let plan_id = authorized_plan_id(authorization)?;
        let user_id = authorization.acting_user_id();
        let stage_id = course_designer_plan_members::get_plan_stages(conn, plan_id)
            .await?
            .into_iter()
            .find(|s| s.stage == arguments.stage)
            .map(|s| s.id)
            .ok_or_else(|| {
                chatbot_err!(
                    ToolUseError,
                    "The plan has no schedule yet, so tasks cannot be added. Nothing was saved."
                        .to_string()
                )
            })?;
        let assignee = match &arguments.assignee_name {
            Some(name) => {
                let members = course_designer_plan_members::get_plan_members_with_details(
                    conn, plan_id, user_id,
                )
                .await?;
                Some(resolve_member_by_name(&members, name)?)
            }
            None => None,
        };

        let mut tx = conn.begin().await?;
        let task = course_designer_plan_members::create_stage_task_for_user(
            &mut tx,
            plan_id,
            stage_id,
            user_id,
            arguments.title.clone(),
            arguments.description.clone(),
        )
        .await?;
        if let Some(assignee) = assignee {
            course_designer_plan_members::set_task_assignee_for_user(
                &mut tx,
                plan_id,
                task.id,
                user_id,
                Some(assignee),
            )
            .await?;
        }
        tx.commit().await?;

        Ok((
            ExecutedAction {
                output: format!(
                    "Added the task \"{}\" to the {} stage{}.",
                    arguments.title,
                    arguments.stage.as_str(),
                    arguments
                        .assignee_name
                        .as_ref()
                        .map(|name| format!(", assigned to {name}"))
                        .unwrap_or_default()
                ),
                client_payload: Some(updated_plan_payload(conn, plan_id, user_id).await?),
                audit: ActionAuditFields {
                    target_user_id: assignee,
                    course_id: None,
                    summary: format!("Added task {} to course design plan {plan_id}", task.id),
                },
            },
            (),
        ))
    }
}
