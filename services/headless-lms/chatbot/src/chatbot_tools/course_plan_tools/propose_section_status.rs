use indexmap::IndexMap;

use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::course_designer_plans::{self, CourseDesignerStage};
use headless_lms_models::course_designer_section_statuses::{self, CourseDesignerSectionStatus};
use headless_lms_utils::json_schema_types::Schema;

use super::{
    DECLINED_OUTPUT, KNOWN_SECTION_KEYS, authorized_plan_id, non_blank, outcome_instructions,
    parse_raw_arguments, parse_stage, plan_member_requirements, stage_name, stale_proposal_error,
    text_property, updated_plan_payload, verify_current_value,
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

/// Proposes marking a section of a stage ready or unfinished, with an optional comment.
pub struct ProposeSectionStatusTool;

pub struct ProposeSectionStatusArguments {
    stage: CourseDesignerStage,
    section_key: String,
    current_status: Option<CourseDesignerSectionStatus>,
    current_comment: String,
    proposed_status: CourseDesignerSectionStatus,
    proposed_comment: Option<String>,
}

#[derive(Deserialize)]
struct RawArguments {
    stage: String,
    section_key: String,
    current_status: String,
    current_comment: String,
    proposed_status: String,
    proposed_comment: String,
}

fn parse_status(value: &str) -> ChatbotResult<Option<CourseDesignerSectionStatus>> {
    match value.trim() {
        "ready" => Ok(Some(CourseDesignerSectionStatus::Ready)),
        "unfinished" => Ok(Some(CourseDesignerSectionStatus::Unfinished)),
        "not_marked" => Ok(None),
        other => Err(chatbot_err!(
            InvalidToolArguments,
            format!(
                "'{other}' is not a section status. Valid values: ready, unfinished, not_marked."
            )
        )),
    }
}

impl ChatbotToolDeclaration for ProposeSectionStatusTool {
    const NAME: &'static str = "propose_section_status";

    fn offer_requirements(_user_context: &ChatbotTurnContext) -> Vec<ToolRequirement> {
        plan_member_requirements()
    }

    const CATEGORY: ToolCategory = ToolCategory::CoursePlanning;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: format!(
                "Propose marking a section of a stage as ready or unfinished, with an optional comment such as what is still missing. Sections: {}. The user applies or discards it; nothing is saved before that.",
                KNOWN_SECTION_KEYS.join(", ")
            ),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "stage".to_string(),
                        text_property(
                            "The stage the section belongs to; the first part of the section key.",
                        ),
                    ),
                    (
                        "section_key".to_string(),
                        text_property(
                            "One of the section keys listed in the tool description, e.g. design.learning_goals.",
                        ),
                    ),
                    (
                        "current_status".to_string(),
                        text_property(
                            "ready, unfinished, or not_marked when get_course_plan shows no mark for it. Checked before anything is saved.",
                        ),
                    ),
                    (
                        "current_comment".to_string(),
                        text_property(
                            "The mark's current comment from get_course_plan; empty string for none.",
                        ),
                    ),
                    (
                        "proposed_status".to_string(),
                        text_property("ready or unfinished."),
                    ),
                    (
                        "proposed_comment".to_string(),
                        text_property("Comment in the user's language; empty string for none."),
                    ),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

impl ConfirmableActionTool for ProposeSectionStatusTool {
    type Arguments = ProposeSectionStatusArguments;
    type Facts = ();

    fn call_requirements(
        _arguments: &Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> Vec<ToolRequirement> {
        plan_member_requirements()
    }

    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = parse_raw_arguments(arguments)?;
        let stage = parse_stage(&raw.stage)?;
        let section_key = raw.section_key.trim().to_string();
        if !KNOWN_SECTION_KEYS.contains(&section_key.as_str())
            || !section_key.starts_with(&format!("{}.", stage_name(stage)))
        {
            return Err(chatbot_err!(
                InvalidToolArguments,
                format!(
                    "'{section_key}' is not a section of the {} stage. Sections: {}.",
                    stage_name(stage),
                    KNOWN_SECTION_KEYS.join(", ")
                )
            ));
        }
        let proposed_status = parse_status(&raw.proposed_status)?.ok_or_else(|| {
            chatbot_err!(
                InvalidToolArguments,
                "proposed_status must be ready or unfinished.".to_string()
            )
        })?;
        Ok(ProposeSectionStatusArguments {
            stage,
            section_key,
            current_status: parse_status(&raw.current_status)?,
            current_comment: raw.current_comment,
            proposed_status,
            proposed_comment: non_blank(&raw.proposed_comment),
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
        let stored = details
            .section_statuses
            .iter()
            .find(|s| s.stage == arguments.stage && s.section_key == arguments.section_key);
        if stored.map(|s| s.status) != arguments.current_status {
            return Err(stale_proposal_error("section's mark"));
        }
        verify_current_value(
            "section's comment",
            stored.and_then(|s| s.comment.as_deref()).unwrap_or(""),
            &arguments.current_comment,
        )?;

        course_designer_section_statuses::upsert_for_user(
            conn,
            plan_id,
            user_id,
            arguments.stage,
            &arguments.section_key,
            arguments.proposed_status,
            arguments.proposed_comment.clone(),
        )
        .await?;

        let status = match arguments.proposed_status {
            CourseDesignerSectionStatus::Ready => "ready",
            CourseDesignerSectionStatus::Unfinished => "unfinished",
        };
        Ok((
            ExecutedAction {
                output: format!("Marked {} as {status}.", arguments.section_key),
                client_payload: Some(updated_plan_payload(conn, plan_id, user_id).await?),
                audit: ActionAuditFields {
                    target_user_id: None,
                    course_id: None,
                    summary: format!(
                        "Marked {} {status} in course design plan {plan_id}",
                        arguments.section_key
                    ),
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
