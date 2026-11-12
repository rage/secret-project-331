use chrono::NaiveDate;
use indexmap::IndexMap;

use headless_lms_models::course_designer_plan_members;
use headless_lms_models::course_designer_plans::{
    CourseDesignerScheduleStageInput, validate_schedule_input,
};
use headless_lms_utils::json_schema_types::{
    ArrayItem, ArrayProperty, JSONType, Schema, SchemaPropertyType,
};
use headless_lms_utils::strings::non_empty_trimmed;

use super::{
    authorized_plan_id, parse_raw_arguments, parse_stage, plan_proposal_items,
    plan_tool_declaration_items, stale_proposal_error, text_property,
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

/// Proposes new planned dates for the stages of an in-progress plan.
pub struct ProposeScheduleAdjustmentTool;

pub struct ProposeScheduleAdjustmentArguments {
    reason: String,
    current_schedule: Vec<CourseDesignerScheduleStageInput>,
    proposed_schedule: Vec<CourseDesignerScheduleStageInput>,
}

#[derive(Deserialize)]
struct RawArguments {
    reason: String,
    current_schedule: Vec<RawStageDates>,
    proposed_schedule: Vec<RawStageDates>,
}

#[derive(Deserialize)]
struct RawStageDates {
    stage: String,
    starts_on: String,
    ends_on: String,
}

fn schedule_property(description: &str) -> SchemaPropertyType {
    SchemaPropertyType::ArrayProperty(ArrayProperty {
        type_field: JSONType::Array,
        items: ArrayItem::Schema(Schema::strict_object(
            IndexMap::from([
                (
                    "stage".to_string(),
                    text_property("analysis, design, development, implementation or evaluation."),
                ),
                (
                    "starts_on".to_string(),
                    text_property("First day of the stage, YYYY-MM-DD."),
                ),
                (
                    "ends_on".to_string(),
                    text_property("Last day of the stage, YYYY-MM-DD."),
                ),
            ]),
            None,
        )),
        description: Some(description.to_string()),
    })
}

fn parse_schedule(
    argument: &str,
    raw: Vec<RawStageDates>,
) -> ChatbotResult<Vec<CourseDesignerScheduleStageInput>> {
    let schedule = raw
        .into_iter()
        .map(|stage| {
            Ok(CourseDesignerScheduleStageInput {
                stage: parse_stage(&stage.stage)?,
                planned_starts_on: parse_date(&stage.starts_on)?,
                planned_ends_on: parse_date(&stage.ends_on)?,
            })
        })
        .collect::<ChatbotResult<Vec<_>>>()?;
    validate_schedule_input(&schedule).map_err(|e| {
        chatbot_err!(
            InvalidToolArguments,
            format!("{argument} is not a valid schedule: {}", e.message())
        )
    })?;
    Ok(schedule)
}

fn parse_date(value: &str) -> ChatbotResult<NaiveDate> {
    NaiveDate::parse_from_str(value.trim(), "%Y-%m-%d").map_err(|e| {
        chatbot_err!(
            InvalidToolArguments,
            format!("'{value}' is not a date in the form YYYY-MM-DD."),
            e
        )
    })
}

impl ChatbotToolDeclaration for ProposeScheduleAdjustmentTool {
    const NAME: &'static str = "propose_schedule_adjustment";

    plan_tool_declaration_items!();

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Propose new planned dates for the stages of a plan that is in progress. Give the whole schedule, all five stages in order, both as it is now and as proposed. Stages must follow each other without gaps or overlaps (each starts the day after the previous one ends), and completed stages must keep their dates, so when you move one stage, shift the later ones too. The user applies or discards it; nothing is saved before that.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    ("reason".to_string(), text_property("One short sentence in the user's language on why the schedule changes. Shown on the card.")),
                    ("current_schedule".to_string(), schedule_property("The five stages' dates now, copied from get_course_plan. Checked before anything is saved.")),
                    ("proposed_schedule".to_string(), schedule_property("The five stages' new dates.")),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

impl ConfirmableActionTool for ProposeScheduleAdjustmentTool {
    type Arguments = ProposeScheduleAdjustmentArguments;
    plan_proposal_items!();

    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = parse_raw_arguments(arguments)?;
        Ok(ProposeScheduleAdjustmentArguments {
            reason: non_empty_trimmed(&raw.reason)
                .map(str::to_string)
                .ok_or_else(|| {
                    chatbot_err!(
                        InvalidToolArguments,
                        "reason must not be empty.".to_string()
                    )
                })?,
            current_schedule: parse_schedule("current_schedule", raw.current_schedule)?,
            proposed_schedule: parse_schedule("proposed_schedule", raw.proposed_schedule)?,
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
        let mut tx = conn.begin().await?;
        course_designer_plan_members::lock_editable_plan_for_user(&mut tx, plan_id, user_id)
            .await?;
        let stored: Vec<CourseDesignerScheduleStageInput> =
            course_designer_plan_members::get_plan_stages(&mut tx, plan_id)
                .await?
                .into_iter()
                .map(|s| CourseDesignerScheduleStageInput {
                    stage: s.stage,
                    planned_starts_on: s.planned_starts_on,
                    planned_ends_on: s.planned_ends_on,
                })
                .collect();
        if stored != arguments.current_schedule {
            return Err(stale_proposal_error("schedule"));
        }

        let updated = course_designer_plan_members::adjust_schedule_for_user(
            &mut tx,
            plan_id,
            user_id,
            &arguments.proposed_schedule,
        )
        .await?;
        tx.commit().await?;

        Ok((
            ExecutedAction {
                output: format!("Saved the new schedule. Reason: {}", arguments.reason),
                client_payload: Some(serde_json::json!({ "plan_details": updated })),
                audit: ActionAuditFields {
                    target_user_id: None,
                    course_id: None,
                    summary: format!("Adjusted the schedule of course design plan {plan_id}"),
                },
            },
            (),
        ))
    }
}
