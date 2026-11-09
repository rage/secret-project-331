use indexmap::IndexMap;

use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::course_designer_plans;
use headless_lms_utils::json_schema_types::Schema;

use super::{
    DECLINED_OUTPUT, authorized_plan_id, non_blank, outcome_instructions, parse_raw_arguments,
    plan_member_requirements, text_property, updated_plan_payload, verify_current_value,
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

/// Proposes new text for the plan's "what makes this MOOC great" vision.
pub struct ProposeVisionEditTool;

pub struct ProposeVisionEditArguments {
    current_vision: String,
    proposed_vision: Option<String>,
}

#[derive(Deserialize)]
struct RawArguments {
    current_vision: String,
    proposed_vision: String,
}

impl ChatbotToolDeclaration for ProposeVisionEditTool {
    const NAME: &'static str = "propose_vision_edit";

    fn offer_requirements(_user_context: &ChatbotTurnContext) -> Vec<ToolRequirement> {
        plan_member_requirements()
    }

    const CATEGORY: ToolCategory = ToolCategory::CoursePlanning;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Propose new text for the team's vision of what would make this MOOC great (great_mooc_vision on the plan overview). The user applies or discards it; nothing is saved before that.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    ("current_vision".to_string(), text_property("The current vision exactly as get_course_plan returned it; empty string for none. Checked before anything is saved.")),
                    ("proposed_vision".to_string(), text_property("The whole new text, in the user's language. Empty string clears it.")),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

impl ConfirmableActionTool for ProposeVisionEditTool {
    type Arguments = ProposeVisionEditArguments;
    type Facts = ();

    fn call_requirements(
        _arguments: &Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> Vec<ToolRequirement> {
        plan_member_requirements()
    }

    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = parse_raw_arguments(arguments)?;
        Ok(ProposeVisionEditArguments {
            current_vision: raw.current_vision,
            proposed_vision: non_blank(&raw.proposed_vision),
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
        let plan = headless_lms_models::course_designer_plan_members::get_plan_for_user(
            conn, plan_id, user_id,
        )
        .await?;
        verify_current_value(
            "vision",
            plan.great_mooc_vision.as_deref().unwrap_or(""),
            &arguments.current_vision,
        )?;
        course_designer_plans::set_great_mooc_vision_for_user(
            conn,
            plan_id,
            user_id,
            arguments.proposed_vision.clone(),
        )
        .await?;
        Ok((
            ExecutedAction {
                output: "Saved the new vision.".to_string(),
                client_payload: Some(updated_plan_payload(conn, plan_id, user_id).await?),
                audit: ActionAuditFields {
                    target_user_id: None,
                    course_id: None,
                    summary: format!("Edited the vision of course design plan {plan_id}"),
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
