//! Tools of the course design assistant: reading the plan the conversation is about and proposing
//! changes to it that the user applies or discards.
//!
//! Every tool acts on the turn's plan only. None takes a plan id argument, so the model cannot
//! point one at another plan.

use headless_lms_models::course_designer_plans::{
    self, CourseDesignerStage, PlanMemberWithDetails,
};
use headless_lms_utils::json_schema_types::{JSONType, JsonItem, SchemaPropertyType};
use serde::de::DeserializeOwned;

use crate::chatbot_tools::tool_authorization::{ToolAuthorization, ToolRequirement};
use crate::prelude::*;

pub mod get_course_plan;
pub mod propose_add_task;
pub mod propose_schedule_adjustment;
pub mod propose_section_status;
pub mod propose_update_task;
pub mod propose_vision_edit;
pub mod propose_workspace_edit;
mod workspace_json;

/// Section keys the plan pages mark as ready or unfinished. Mirrored by hand in the course plan
/// forms of main-frontend; a key missing there is stored but shown nowhere.
pub const KNOWN_SECTION_KEYS: [&str; 16] = [
    "analysis.my_course",
    "analysis.needs_analysis",
    "analysis.wishes",
    "analysis.market_analysis",
    "analysis.resources",
    "analysis.key_contributors",
    "design.learning_goals",
    "design.core_content",
    "design.course_structure",
    "design.content_format",
    "design.style_guide",
    "design.exercises",
    "design.learning_types",
    "development.stage",
    "implementation.stage",
    "evaluation.stage",
];

/// What every plan tool requires: membership in the turn's plan.
pub(crate) fn plan_member_requirements() -> Vec<ToolRequirement> {
    vec![ToolRequirement::CoursePlanMember]
}

/// The [ChatbotToolDeclaration](crate::chatbot_tools::ChatbotToolDeclaration) items every plan
/// tool shares: its category, and plan membership as the offer requirement.
macro_rules! plan_tool_declaration_items {
    () => {
        const CATEGORY: headless_lms_models::chatbot_configurations::ToolCategory =
            headless_lms_models::chatbot_configurations::ToolCategory::CoursePlanning;

        fn offer_requirements(
            _user_context: &$crate::user_context::ChatbotTurnContext,
        ) -> Vec<$crate::chatbot_tools::tool_authorization::ToolRequirement> {
            $crate::chatbot_tools::course_plan_tools::plan_member_requirements()
        }
    };
}

/// The [ConfirmableActionTool](crate::chatbot_tools::action_tools::ConfirmableActionTool) items
/// every proposal tool shares, so each one writes only its arguments and `execute`.
macro_rules! plan_proposal_items {
    () => {
        type Facts = ();

        fn call_requirements(
            _arguments: &Self::Arguments,
            _user_context: &$crate::user_context::ChatbotTurnContext,
        ) -> Vec<$crate::chatbot_tools::tool_authorization::ToolRequirement> {
            $crate::chatbot_tools::course_plan_tools::plan_member_requirements()
        }

        fn declined_output(_arguments: &Self::Arguments) -> String {
            $crate::chatbot_tools::course_plan_tools::DECLINED_OUTPUT.to_string()
        }

        fn output_description_instructions(
            _arguments: &Self::Arguments,
            facts: Option<&()>,
            _app_config: &headless_lms_base::config::ApplicationConfiguration,
        ) -> Option<String> {
            Some($crate::chatbot_tools::course_plan_tools::outcome_instructions(facts.is_some()))
        }
    };
}

pub(crate) use {plan_proposal_items, plan_tool_declaration_items};

/// The plan an authorized plan tool acts on.
pub(crate) fn authorized_plan_id<Tool>(
    authorization: &ToolAuthorization<Tool>,
) -> ChatbotResult<Uuid> {
    authorization.course_designer_plan_id().ok_or_else(|| {
        chatbot_err!(
            ToolUseError,
            "This conversation is not about a course design plan.".to_string()
        )
    })
}

pub(crate) fn parse_stage(value: &str) -> ChatbotResult<CourseDesignerStage> {
    value.trim().to_lowercase().parse().map_err(|_| {
        chatbot_err!(
            InvalidToolArguments,
            format!(
                "'{value}' is not a stage. Valid values: analysis, design, development, implementation, evaluation."
            )
        )
    })
}

/// Parses tool arguments into their raw shape, reporting failure to the model.
pub(crate) fn parse_raw_arguments<T: DeserializeOwned>(arguments: &str) -> ChatbotResult<T> {
    serde_json::from_str(arguments).map_err(|e| {
        chatbot_err!(
            InvalidToolArguments,
            format!("Couldn't parse tool arguments. Arguments: {arguments}"),
            e
        )
    })
}

/// The plan member going by `name` as the plan pages show it, case-insensitively.
///
/// Fails when no member, or more than one, has that name.
pub(crate) fn resolve_member_by_name(
    members: &[PlanMemberWithDetails],
    name: &str,
) -> ChatbotResult<Uuid> {
    let wanted = name.trim().to_lowercase();
    let matching: Vec<Uuid> = members
        .iter()
        .filter(|member| member.display_name().to_lowercase() == wanted)
        .map(|member| member.user_id)
        .collect();
    match matching.as_slice() {
        [user_id] => Ok(*user_id),
        [] => Err(chatbot_err!(
            ToolUseError,
            format!(
                "No plan member is named {name}. Nothing was saved. Call get_course_plan for the members' names."
            )
        )),
        _ => Err(chatbot_err!(
            ToolUseError,
            format!(
                "More than one plan member is named {name}. Nothing was saved; ask the user to assign the task themselves."
            )
        )),
    }
}

/// Refuses to apply a proposal whose "current" value no longer matches the plan, so a change
/// confirmed from a stale card cannot overwrite an edit made after the model read the plan.
pub(crate) fn verify_current_value(what: &str, actual: &str, supplied: &str) -> ChatbotResult<()> {
    if actual.trim() == supplied.trim() {
        Ok(())
    } else {
        Err(stale_proposal_error(what))
    }
}

pub(crate) fn stale_proposal_error(what: &str) -> ChatbotError {
    chatbot_err!(
        ToolUseError,
        format!(
            "The {what} has changed since the plan was read, so nothing was applied. Call get_course_plan and propose the change again."
        )
    )
}

/// What every executed plan tool sends the browser: the plan as the plan pages load it, so they
/// can show the change without refetching.
pub(crate) async fn updated_plan_payload(
    conn: &mut PgConnection,
    plan_id: Uuid,
    user_id: Uuid,
) -> ChatbotResult<serde_json::Value> {
    let details = course_designer_plans::get_plan_details_for_user(conn, plan_id, user_id).await?;
    Ok(serde_json::json!({ "plan_details": details }))
}

pub(crate) const DECLINED_OUTPUT: &str = "The user discarded the proposal. Nothing in the plan was changed. Do not propose it again unless asked to.";

/// Instructions shared by every proposal tool's outcome.
pub(crate) fn outcome_instructions(applied: bool) -> String {
    if applied {
        "The user applied the change and it is now saved in the plan. Confirm it briefly in the user's language.".to_string()
    } else {
        "Acknowledge briefly in the user's language. Never claim the change was made.".to_string()
    }
}

pub(crate) fn text_property(description: &str) -> SchemaPropertyType {
    SchemaPropertyType::Item(JsonItem {
        type_field: JSONType::String,
        description: Some(description.to_string()),
    })
}
