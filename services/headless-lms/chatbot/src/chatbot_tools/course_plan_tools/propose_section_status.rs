use indexmap::IndexMap;

use headless_lms_models::course_designer_plans::CourseDesignerStage;
use headless_lms_models::course_designer_section_statuses::{self, CourseDesignerSectionStatus};
use headless_lms_utils::json_schema_types::Schema;
use headless_lms_utils::strings::non_empty_trimmed;

use super::{
    KNOWN_SECTION_KEYS, authorized_plan_id, parse_raw_arguments, parse_stage, plan_proposal_items,
    plan_tool_declaration_items, stale_proposal_error, text_property, updated_plan_payload,
    verify_current_value,
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
    section_key: String,
    current_status: String,
    current_comment: String,
    proposed_status: String,
    proposed_comment: String,
}

fn parse_status(value: &str) -> ChatbotResult<Option<CourseDesignerSectionStatus>> {
    match value.trim() {
        "not_marked" => Ok(None),
        other => other.parse().map(Some).map_err(|_| {
            chatbot_err!(
                InvalidToolArguments,
                format!(
                    "'{other}' is not a section status. Valid values: ready, unfinished, not_marked."
                )
            )
        }),
    }
}

impl ChatbotToolDeclaration for ProposeSectionStatusTool {
    const NAME: &'static str = "propose_section_status";

    plan_tool_declaration_items!();

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
    plan_proposal_items!();

    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = parse_raw_arguments(arguments)?;
        let section_key = raw.section_key.trim().to_string();
        if !KNOWN_SECTION_KEYS.contains(&section_key.as_str()) {
            return Err(chatbot_err!(
                InvalidToolArguments,
                format!(
                    "'{section_key}' is not a section. Sections: {}.",
                    KNOWN_SECTION_KEYS.join(", ")
                )
            ));
        }
        // Every known key starts with its stage's name.
        let stage = parse_stage(section_key.split('.').next().unwrap_or_default())?;
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
            proposed_comment: non_empty_trimmed(&raw.proposed_comment).map(str::to_string),
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
        let statuses = course_designer_section_statuses::get_for_plan(conn, plan_id).await?;
        let stored = statuses
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

        let status = arguments.proposed_status.as_str();
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
}
