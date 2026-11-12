use std::collections::HashSet;

use indexmap::IndexMap;
use serde_json::Value;

use headless_lms_models::course_designer_plans::{self, CourseDesignerStage};
use headless_lms_models::course_designer_stage_workspace::{
    AnalysisWorkspaceV1, CourseDesignerStageWorkspace, DesignWorkspaceV1,
};
use headless_lms_utils::json_schema_types::{
    ArrayItem, ArrayProperty, JSONType, Schema, SchemaPropertyType,
};

use super::workspace_json::{fill_ids, keeps_proposed, resolve_field, same_content};
use super::{
    authorized_plan_id, parse_raw_arguments, parse_stage, plan_proposal_items,
    plan_tool_declaration_items, stale_proposal_error, text_property, updated_plan_payload,
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

const MAX_CHANGES: usize = 30;

/// Proposes edits to the saved form of the Analysis or Design stage.
pub struct ProposeWorkspaceEditTool;

pub struct ProposeWorkspaceEditArguments {
    stage: CourseDesignerStage,
    summary: String,
    changes: Vec<WorkspaceFieldChange>,
}

struct WorkspaceFieldChange {
    field: String,
    current_value: Value,
    proposed_value: Value,
}

#[derive(Deserialize)]
struct RawArguments {
    stage: String,
    summary: String,
    changes: Vec<RawChange>,
}

#[derive(Deserialize)]
struct RawChange {
    field: String,
    current_value_json: String,
    proposed_value_json: String,
}

impl ChatbotToolDeclaration for ProposeWorkspaceEditTool {
    const NAME: &'static str = "propose_workspace_edit";

    plan_tool_declaration_items!();

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Propose changes to the saved form of the analysis or design stage. The user sees each change as current vs proposed and applies or discards them together; nothing is saved before that. Fields are paths into the stage's workspace payload exactly as get_course_plan shows it. Analysis: any top-level field, e.g. course_title, credits, target_group, wishes_topics, course_type ('compulsory' or 'elective'). Design: learning_goals (list of strings), core_content_must_know, core_content_should_know, core_content_nice_to_know, content_format_notes, accessibility_notes, exercise_notes, planned_content_formats.<text|infographics|photos|videos|podcast|thinglink|simulations|chatbots> (true/false), style_guide.<file_naming|video_styles|podcast|graphics_background|colour_palette|punctuation|font|bulleted_lists|capitalization|active_passive_voice|writing_style|references_and_citations|terminology_and_acronyms|blocks>, chapters (the whole list: [{\"title\", \"learning_objectives\": [..], \"topics\": [{\"title\"}]}]), chapters.<chapter id>.title, chapters.<chapter id>.learning_objectives, chapters.<chapter id>.topics, workload_activities ([{\"title\", \"activity_type\", \"count\", \"minutes_each\"}], activity_type one of acquisition_audio, acquisition_video, acquisition_reading, discussion, collaboration, investigation, practice, production). Omit ids for new chapters, topics and activities; keep the ids of existing ones.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "stage".to_string(),
                        text_property("'analysis' or 'design'."),
                    ),
                    (
                        "summary".to_string(),
                        text_property("One short sentence in the user's language saying what the changes do. Shown as the card's heading."),
                    ),
                    (
                        "changes".to_string(),
                        SchemaPropertyType::ArrayProperty(ArrayProperty {
                            type_field: JSONType::Array,
                            items: ArrayItem::Schema(Schema::strict_object(
                                IndexMap::from([
                                    (
                                        "field".to_string(),
                                        text_property("Path of the field, e.g. style_guide.font or chapters.<chapter id>.topics."),
                                    ),
                                    (
                                        "current_value_json".to_string(),
                                        text_property("The field's current value as JSON, copied from get_course_plan (e.g. \"\\\"Old text\\\"\", \"[]\", \"null\"). Checked against the plan before anything is saved."),
                                    ),
                                    (
                                        "proposed_value_json".to_string(),
                                        text_property("The new value as JSON of the same type, e.g. \"\\\"New text\\\"\", \"true\", \"[\\\"Goal 1\\\", \\\"Goal 2\\\"]\"."),
                                    ),
                                ]),
                                None,
                            )),
                            description: Some(format!("1 to {MAX_CHANGES} changes, each to a different field.")),
                        }),
                    ),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

impl ConfirmableActionTool for ProposeWorkspaceEditTool {
    type Arguments = ProposeWorkspaceEditArguments;
    plan_proposal_items!();

    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = parse_raw_arguments(arguments)?;
        let stage = parse_stage(&raw.stage)?;
        if !matches!(
            stage,
            CourseDesignerStage::Analysis | CourseDesignerStage::Design
        ) {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "Only the analysis and design stages have a form to edit.".to_string()
            ));
        }
        let summary = raw.summary.trim().to_string();
        if summary.is_empty() {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "summary must not be empty.".to_string()
            ));
        }
        if raw.changes.is_empty() || raw.changes.len() > MAX_CHANGES {
            return Err(chatbot_err!(
                InvalidToolArguments,
                format!("Propose 1 to {MAX_CHANGES} changes.")
            ));
        }
        let mut seen_fields = HashSet::new();
        let changes = raw
            .changes
            .into_iter()
            .map(|change| {
                let field = change.field.trim().to_string();
                if field.is_empty() || field.split('.').any(str::is_empty) {
                    return Err(chatbot_err!(
                        InvalidToolArguments,
                        format!("'{field}' is not a field path.")
                    ));
                }
                if !seen_fields.insert(field.clone()) {
                    return Err(chatbot_err!(
                        InvalidToolArguments,
                        format!("The field {field} is changed more than once.")
                    ));
                }
                Ok(WorkspaceFieldChange {
                    current_value: parse_value_json(
                        &field,
                        "current_value_json",
                        &change.current_value_json,
                    )?,
                    proposed_value: parse_value_json(
                        &field,
                        "proposed_value_json",
                        &change.proposed_value_json,
                    )?,
                    field,
                })
            })
            .collect::<ChatbotResult<Vec<_>>>()?;
        Ok(ProposeWorkspaceEditArguments {
            stage,
            summary,
            changes,
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
        let (workspace, _revision) = course_designer_plans::lock_stage_workspace_for_user(
            &mut tx,
            plan_id,
            user_id,
            arguments.stage,
        )
        .await?;

        let mut payload = match (arguments.stage, workspace) {
            (_, Some(CourseDesignerStageWorkspace::AnalysisV1(analysis))) => to_value(&analysis)?,
            (_, Some(CourseDesignerStageWorkspace::DesignV1(design))) => to_value(&design)?,
            (CourseDesignerStage::Analysis, None) => to_value(&AnalysisWorkspaceV1::default())?,
            (_, None) => to_value(&DesignWorkspaceV1::default())?,
        };

        let mut proposed_values = Vec::with_capacity(arguments.changes.len());
        for change in &arguments.changes {
            let segments: Vec<&str> = change.field.split('.').collect();
            let target = resolve_field(&mut payload, &segments).map_err(|reason| {
                chatbot_err!(
                    ToolUseError,
                    format!(
                        "{} is not a field of the {} form: {reason}",
                        change.field,
                        arguments.stage.as_str()
                    )
                )
            })?;
            if !same_content(target, &change.current_value) {
                return Err(stale_proposal_error(&format!("field {}", change.field)));
            }
            let mut proposed = change.proposed_value.clone();
            fill_ids(segments.last().copied(), &mut proposed, target);
            *target = proposed.clone();
            proposed_values.push(proposed);
        }

        let workspace = match arguments.stage {
            CourseDesignerStage::Analysis => {
                CourseDesignerStageWorkspace::AnalysisV1(from_value(payload)?)
            }
            _ => CourseDesignerStageWorkspace::DesignV1(from_value(payload)?),
        };
        // Deserializing silently drops fields the form does not have.
        let mut saved = match &workspace {
            CourseDesignerStageWorkspace::AnalysisV1(analysis) => to_value(analysis)?,
            CourseDesignerStageWorkspace::DesignV1(design) => to_value(design)?,
        };
        for (change, proposed) in arguments.changes.iter().zip(&proposed_values) {
            let segments: Vec<&str> = change.field.split('.').collect();
            let survived = resolve_field(&mut saved, &segments).ok();
            if !survived.is_some_and(|value| keeps_proposed(value, proposed)) {
                return Err(chatbot_err!(
                    ToolUseError,
                    format!(
                        "The proposed value for {} has fields or types the form does not have. Nothing was saved.",
                        change.field
                    )
                ));
            }
        }

        course_designer_plans::update_locked_stage_workspace(&mut tx, plan_id, user_id, &workspace)
            .await?;
        tx.commit().await?;

        let fields = arguments
            .changes
            .iter()
            .map(|change| change.field.as_str())
            .collect::<Vec<_>>()
            .join(", ");
        Ok((
            ExecutedAction {
                output: format!(
                    "Saved the {} form: {}. Changed fields: {fields}.",
                    arguments.stage.as_str(),
                    arguments.summary
                ),
                client_payload: Some(updated_plan_payload(conn, plan_id, user_id).await?),
                audit: ActionAuditFields {
                    target_user_id: None,
                    course_id: None,
                    summary: format!(
                        "Edited the {} form of course design plan {plan_id}: {fields}",
                        arguments.stage.as_str()
                    ),
                },
            },
            (),
        ))
    }
}

fn parse_value_json(field: &str, argument: &str, json: &str) -> ChatbotResult<Value> {
    serde_json::from_str(json).map_err(|e| {
        chatbot_err!(
            InvalidToolArguments,
            format!("{argument} of {field} is not valid JSON."),
            e
        )
    })
}

fn to_value<T: Serialize>(value: &T) -> ChatbotResult<Value> {
    serde_json::to_value(value)
        .map_err(|e| chatbot_err!(Other, "Couldn't serialize the workspace.".to_string(), e))
}

fn from_value<T: serde::de::DeserializeOwned>(value: Value) -> ChatbotResult<T> {
    serde_json::from_value(value).map_err(|e| {
        chatbot_err!(
            ToolUseError,
            format!("The proposed values do not fit the form: {e}. Nothing was saved.")
        )
    })
}
