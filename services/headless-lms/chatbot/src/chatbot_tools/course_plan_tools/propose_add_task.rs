use indexmap::IndexMap;

use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::course_designer_plan_members;
use headless_lms_models::course_designer_plans::{self, CourseDesignerStage};
use headless_lms_utils::json_schema_types::Schema;

use super::{
    DECLINED_OUTPUT, authorized_plan_id, non_blank, outcome_instructions, parse_raw_arguments,
    parse_stage, plan_member_requirements, propose_update_task::resolve_member_by_name, stage_name,
    text_property, updated_plan_payload,
};
use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotToolDeclaration,
        action_tools::{ActionAuditFields, ConfirmableActionTool, ExecutedAction},
        tool_authorization::{ToolAuthorization, ToolRequirement},
    },
    prelude::*,
    user_context::ChatbotTurnContext,
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

    fn offer_requirements(_user_context: &ChatbotTurnContext) -> Vec<ToolRequirement> {
        plan_member_requirements()
    }

    const CATEGORY: ToolCategory = ToolCategory::CoursePlanning;

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
    type Facts = ();

    fn call_requirements(
        _arguments: &Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> Vec<ToolRequirement> {
        plan_member_requirements()
    }

    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = parse_raw_arguments(arguments)?;
        let title = non_blank(&raw.title).ok_or_else(|| {
            chatbot_err!(InvalidToolArguments, "title must not be empty.".to_string())
        })?;
        Ok(ProposeAddTaskArguments {
            stage: parse_stage(&raw.stage)?,
            title,
            description: non_blank(&raw.description),
            assignee_name: non_blank(&raw.assignee_name),
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
        let details =
            course_designer_plans::get_plan_details_for_user(conn, plan_id, user_id).await?;
        let stage_id = details
            .stages
            .iter()
            .find(|s| s.stage.stage == arguments.stage)
            .map(|s| s.stage.id)
            .ok_or_else(|| {
                chatbot_err!(
                    ToolUseError,
                    "The plan has no schedule yet, so tasks cannot be added. Nothing was saved."
                        .to_string()
                )
            })?;
        let assignee = match &arguments.assignee_name {
            Some(name) => Some(resolve_member_by_name(conn, plan_id, user_id, name).await?),
            None => None,
        };

        let task = course_designer_plan_members::create_stage_task_for_user(
            conn,
            plan_id,
            stage_id,
            user_id,
            arguments.title.clone(),
            arguments.description.clone(),
        )
        .await?;
        if let Some(assignee) = assignee {
            course_designer_plan_members::set_task_assignee_for_user(
                conn,
                plan_id,
                task.id,
                user_id,
                Some(assignee),
            )
            .await?;
        }

        Ok((
            ExecutedAction {
                output: format!(
                    "Added the task \"{}\" to the {} stage{}.",
                    arguments.title,
                    stage_name(arguments.stage),
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

    fn declined_output(_arguments: &Self::Arguments) -> String {
        DECLINED_OUTPUT.to_string()
    }

    fn output_description_instructions(
        _arguments: &Self::Arguments,
        facts: Option<&()>,
        _app_config: &ApplicationConfiguration,
    ) -> Option<String> {
        Some(outcome_instructions(facts.is_some()))
    }
}
