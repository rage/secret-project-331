use std::collections::HashSet;

use indexmap::IndexMap;
use serde_json::{Map, Value};

use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::course_designer_plans::{self, CourseDesignerStage};
use headless_lms_models::course_designer_stage_workspace::{
    AnalysisWorkspaceV1, CourseDesignerStageWorkspace, DesignWorkspaceV1, parse_workspace_data,
};
use headless_lms_utils::json_schema_types::{
    ArrayItem, ArrayProperty, JSONType, Schema, SchemaPropertyType,
};

use super::{
    DECLINED_OUTPUT, authorized_plan_id, outcome_instructions, parse_raw_arguments, parse_stage,
    plan_member_requirements, stage_name, stale_proposal_error, text_property,
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

const MAX_CHANGES: usize = 30;

/// Lists whose items are objects with a client-generated `id`, keyed by the field holding them.
const LISTS_WITH_IDS: [&str; 3] = ["chapters", "topics", "workload_activities"];

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

    fn offer_requirements(_user_context: &ChatbotTurnContext) -> Vec<ToolRequirement> {
        plan_member_requirements()
    }

    const CATEGORY: ToolCategory = ToolCategory::CoursePlanning;

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
        let details =
            course_designer_plans::get_plan_details_for_user(conn, plan_id, user_id).await?;
        let stored = details
            .stages
            .into_iter()
            .find(|s| s.stage.stage == arguments.stage)
            .and_then(|s| s.stage.workspace_data);
        let workspace = parse_workspace_data(stored)?;

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
                        stage_name(arguments.stage)
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
                CourseDesignerStageWorkspace::AnalysisV1(from_value(payload.clone())?)
            }
            _ => CourseDesignerStageWorkspace::DesignV1(from_value(payload.clone())?),
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

        let updated = course_designer_plans::update_stage_workspace_for_user(
            conn,
            plan_id,
            user_id,
            arguments.stage,
            workspace,
        )
        .await?;

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
                    stage_name(arguments.stage),
                    arguments.summary
                ),
                client_payload: Some(serde_json::json!({ "plan_details": updated })),
                audit: ActionAuditFields {
                    target_user_id: None,
                    course_id: None,
                    summary: format!(
                        "Edited the {} form of course design plan {plan_id}: {fields}",
                        stage_name(arguments.stage)
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

/// The value at `segments`, where a segment names an object key or, inside a list with ids, the
/// `id` of an item.
fn resolve_field<'a>(root: &'a mut Value, segments: &[&str]) -> Result<&'a mut Value, String> {
    let mut current = root;
    for segment in segments {
        current = match current {
            Value::Object(map) => map
                .get_mut(*segment)
                .ok_or_else(|| format!("there is no field {segment}"))?,
            Value::Array(items) => items
                .iter_mut()
                .find(|item| item.get("id").and_then(Value::as_str) == Some(*segment))
                .ok_or_else(|| format!("there is no item with id {segment}"))?,
            _ => return Err(format!("{segment} goes inside a value that has no fields")),
        };
    }
    Ok(current)
}

/// Gives proposed list items the ids of the current items they replace, matched by title, and new
/// ids to the rest, so the model never has to invent or copy ids correctly.
fn fill_ids(key: Option<&str>, proposed: &mut Value, current: &Value) {
    match proposed {
        Value::Array(items) if key.is_some_and(|key| LISTS_WITH_IDS.contains(&key)) => {
            let current_items = current.as_array().cloned().unwrap_or_default();
            let mut used_ids = HashSet::new();
            for item in items.iter_mut() {
                if let Value::String(title) = item {
                    let mut object = Map::new();
                    object.insert("title".to_string(), Value::String(title.clone()));
                    *item = Value::Object(object);
                }
                let Value::Object(object) = item else {
                    continue;
                };
                let supplied_id = object
                    .get("id")
                    .and_then(Value::as_str)
                    .and_then(|id| Uuid::parse_str(id).ok())
                    .filter(|id| !id.is_nil());
                let matched = match supplied_id {
                    Some(id) => current_items
                        .iter()
                        .find(|candidate| id_of(candidate) == Some(id)),
                    None => {
                        let title = object
                            .get("title")
                            .and_then(Value::as_str)
                            .map(normalized_title);
                        current_items.iter().find(|candidate| {
                            id_of(candidate).is_some_and(|id| !used_ids.contains(&id))
                                && title.is_some()
                                && candidate
                                    .get("title")
                                    .and_then(Value::as_str)
                                    .map(normalized_title)
                                    == title
                        })
                    }
                };
                let id = supplied_id
                    .or_else(|| matched.and_then(id_of))
                    .unwrap_or_else(Uuid::new_v4);
                used_ids.insert(id);
                object.insert("id".to_string(), Value::String(id.to_string()));
                let matched = matched.cloned().unwrap_or(Value::Null);
                fill_nested(object, &matched);
            }
        }
        Value::Object(object) => {
            if let Some(id) = id_of(current) {
                object.insert("id".to_string(), Value::String(id.to_string()));
            }
            fill_nested(object, current);
        }
        _ => {}
    }
}

fn fill_nested(object: &mut Map<String, Value>, current: &Value) {
    for (key, value) in object.iter_mut() {
        if key != "id" {
            fill_ids(Some(key), value, current.get(key).unwrap_or(&Value::Null));
        }
    }
}

fn id_of(value: &Value) -> Option<Uuid> {
    value
        .get("id")
        .and_then(Value::as_str)
        .and_then(|id| Uuid::parse_str(id).ok())
}

fn normalized_title(title: &str) -> String {
    title.trim().to_lowercase()
}

/// Whether the model's copy of a current value describes `actual`: ids and surrounding whitespace
/// are ignored, and every empty value (null, "", [], false, 0) counts as the same.
fn same_content(actual: &Value, supplied: &Value) -> bool {
    if is_empty(actual) && is_empty(supplied) {
        return true;
    }
    match (actual, supplied) {
        (Value::String(a), Value::String(b)) => a.trim() == b.trim(),
        (Value::Number(a), Value::Number(b)) => a.as_f64() == b.as_f64(),
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(a, b)| same_content(a, b))
        }
        // A list item the model wrote as its title alone.
        (Value::Object(a), Value::String(_)) => a
            .get("title")
            .is_some_and(|title| same_content(title, supplied)),
        (Value::Object(a), Value::Object(b)) => a
            .iter()
            .filter(|(key, _)| key.as_str() != "id")
            .all(|(key, value)| same_content(value, b.get(key).unwrap_or(&Value::Null))),
        (a, b) => a == b,
    }
}

/// Whether `saved` holds everything `proposed` set. Fields `proposed` left out may have been
/// filled with defaults; numbers compare by value (`5` and `5.0`).
fn keeps_proposed(saved: &Value, proposed: &Value) -> bool {
    match (saved, proposed) {
        (Value::Number(a), Value::Number(b)) => a.as_f64() == b.as_f64(),
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(a, b)| keeps_proposed(a, b))
        }
        (Value::Object(a), Value::Object(b)) => b
            .iter()
            .all(|(key, value)| a.get(key).is_some_and(|saved| keeps_proposed(saved, value))),
        (a, b) => a == b,
    }
}

fn is_empty(value: &Value) -> bool {
    match value {
        Value::Null => true,
        Value::Bool(b) => !b,
        Value::Number(n) => n.as_f64() == Some(0.0),
        Value::String(s) => s.trim().is_empty(),
        Value::Array(items) => items.is_empty(),
        Value::Object(map) => map
            .iter()
            .all(|(key, value)| key == "id" || is_empty(value)),
    }
}
