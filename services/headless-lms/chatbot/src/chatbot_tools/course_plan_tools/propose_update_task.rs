use std::collections::{HashMap, HashSet};

use indexmap::IndexMap;

use headless_lms_models::course_designer_plan_members;
use headless_lms_utils::json_schema_types::{
    ArrayItem, ArrayProperty, JSONType, Schema, SchemaPropertyType,
};
use headless_lms_utils::strings::non_empty_trimmed;

use super::{
    authorized_plan_id, parse_raw_arguments, plan_proposal_items, plan_tool_declaration_items,
    resolve_member_by_name, stale_proposal_error, text_property, updated_plan_payload,
    verify_current_value,
};
use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotToolDeclaration,
        action_tools::{ActionAuditFields, ConfirmableActionTool, ExecutedAction},
        argument_parsing::parse_required_uuid,
        tool_authorization::ToolAuthorization,
    },
    prelude::*,
};

/// Proposes changes to one task: its title, description, completion or assignee.
pub struct ProposeUpdateTaskTool;

pub struct ProposeUpdateTaskArguments {
    task_id: Uuid,
    task_title: String,
    changes: Vec<TaskFieldChange>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum TaskField {
    Title,
    Description,
    IsCompleted,
    Assignee,
}

struct TaskFieldChange {
    field: TaskField,
    current_value: String,
    proposed_value: String,
}

#[derive(Deserialize)]
struct RawArguments {
    task_id: String,
    task_title: String,
    changes: Vec<RawChange>,
}

#[derive(Deserialize)]
struct RawChange {
    field: String,
    current_value: String,
    proposed_value: String,
}

impl ChatbotToolDeclaration for ProposeUpdateTaskTool {
    const NAME: &'static str = "propose_update_task";

    plan_tool_declaration_items!();

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Propose changing an existing task: rename it, change or clear its description, mark it done or not done, or assign it to a member. The user applies or discards the changes; nothing is saved before that.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    ("task_id".to_string(), text_property("The task's id from get_course_plan.")),
                    ("task_title".to_string(), text_property("The task's current title, exactly as get_course_plan returned it. Shown to the user and checked before anything is saved.")),
                    (
                        "changes".to_string(),
                        SchemaPropertyType::ArrayProperty(ArrayProperty {
                            type_field: JSONType::Array,
                            items: ArrayItem::Schema(Schema::strict_object(
                                IndexMap::from([
                                    ("field".to_string(), text_property("title, description, is_completed or assignee.")),
                                    ("current_value".to_string(), text_property("The field's current value from get_course_plan: text for title and description, 'true' or 'false' for is_completed, the member's name for assignee. Empty string for none.")),
                                    ("proposed_value".to_string(), text_property("The new value in the same form. Empty string clears the description or unassigns the task; a title cannot be empty.")),
                                ]),
                                None,
                            )),
                            description: Some("1 to 4 changes, each to a different field.".to_string()),
                        }),
                    ),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

impl ConfirmableActionTool for ProposeUpdateTaskTool {
    type Arguments = ProposeUpdateTaskArguments;
    plan_proposal_items!();

    fn parse_arguments(arguments: &str) -> ChatbotResult<Self::Arguments> {
        let raw: RawArguments = parse_raw_arguments(arguments)?;
        let task_id = parse_required_uuid("task_id", &raw.task_id)?;
        let task_title = non_empty_trimmed(&raw.task_title)
            .map(str::to_string)
            .ok_or_else(|| {
                chatbot_err!(
                    InvalidToolArguments,
                    "task_title must not be empty.".to_string()
                )
            })?;
        if raw.changes.is_empty() || raw.changes.len() > 4 {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "Propose 1 to 4 changes.".to_string()
            ));
        }
        let mut seen = HashSet::new();
        let changes = raw
            .changes
            .into_iter()
            .map(|change| {
                let field = match change.field.trim() {
                    "title" => TaskField::Title,
                    "description" => TaskField::Description,
                    "is_completed" => TaskField::IsCompleted,
                    "assignee" => TaskField::Assignee,
                    other => {
                        return Err(chatbot_err!(
                            InvalidToolArguments,
                            format!("'{other}' is not a task field. Valid values: title, description, is_completed, assignee.")
                        ));
                    }
                };
                if !seen.insert(field) {
                    return Err(chatbot_err!(
                        InvalidToolArguments,
                        "Each field can be changed only once.".to_string()
                    ));
                }
                if field == TaskField::Title && change.proposed_value.trim().is_empty() {
                    return Err(chatbot_err!(
                        InvalidToolArguments,
                        "A task title cannot be empty.".to_string()
                    ));
                }
                if field == TaskField::IsCompleted {
                    parse_bool(&change.proposed_value)?;
                }
                Ok(TaskFieldChange {
                    field,
                    current_value: change.current_value,
                    proposed_value: change.proposed_value,
                })
            })
            .collect::<ChatbotResult<Vec<_>>>()?;
        Ok(ProposeUpdateTaskArguments {
            task_id,
            task_title,
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
        let task = course_designer_plan_members::get_plan_tasks(conn, plan_id)
            .await?
            .into_iter()
            .find(|task| task.id == arguments.task_id)
            .ok_or_else(|| {
                chatbot_err!(
                    ToolUseError,
                    "The task no longer exists. Call get_course_plan again.".to_string()
                )
            })?;
        verify_current_value("task title", &task.title, &arguments.task_title)?;

        let members =
            course_designer_plan_members::get_plan_members_with_details(conn, plan_id, user_id)
                .await?;
        let names: HashMap<Uuid, String> = members
            .iter()
            .map(|member| (member.user_id, member.display_name()))
            .collect();

        let mut title = None;
        let mut description = None;
        let mut is_completed = None;
        let mut assignee = None;
        for change in &arguments.changes {
            match change.field {
                TaskField::Title => {
                    verify_current_value("task title", &task.title, &change.current_value)?;
                    title = Some(change.proposed_value.trim().to_string());
                }
                TaskField::Description => {
                    verify_current_value(
                        "task description",
                        task.description.as_deref().unwrap_or(""),
                        &change.current_value,
                    )?;
                    description = Some(change.proposed_value.trim().to_string());
                }
                TaskField::IsCompleted => {
                    if parse_bool(&change.current_value).ok() != Some(task.is_completed) {
                        return Err(stale_proposal_error("task's completion"));
                    }
                    is_completed = Some(parse_bool(&change.proposed_value)?);
                }
                TaskField::Assignee => {
                    let current_name = task
                        .assignee_user_id
                        .and_then(|id| names.get(&id).cloned())
                        .unwrap_or_default();
                    if current_name.to_lowercase() != change.current_value.trim().to_lowercase() {
                        return Err(stale_proposal_error("task's assignee"));
                    }
                    let proposed = non_empty_trimmed(&change.proposed_value)
                        .map(|name| resolve_member_by_name(&members, name))
                        .transpose()?;
                    assignee = Some(proposed);
                }
            }
        }

        let mut tx = conn.begin().await?;
        if title.is_some() || description.is_some() || is_completed.is_some() {
            course_designer_plan_members::update_stage_task_for_user(
                &mut tx,
                plan_id,
                arguments.task_id,
                user_id,
                title,
                description,
                is_completed,
            )
            .await?;
        }
        if let Some(assignee) = assignee {
            course_designer_plan_members::set_task_assignee_for_user(
                &mut tx,
                plan_id,
                arguments.task_id,
                user_id,
                assignee,
            )
            .await?;
        }
        tx.commit().await?;

        let fields = arguments
            .changes
            .iter()
            .map(|change| match change.field {
                TaskField::Title => "title",
                TaskField::Description => "description",
                TaskField::IsCompleted => "is_completed",
                TaskField::Assignee => "assignee",
            })
            .collect::<Vec<_>>()
            .join(", ");
        Ok((
            ExecutedAction {
                output: format!(
                    "Updated the task \"{}\". Changed fields: {fields}.",
                    arguments.task_title
                ),
                client_payload: Some(updated_plan_payload(conn, plan_id, user_id).await?),
                audit: ActionAuditFields {
                    target_user_id: assignee.flatten(),
                    course_id: None,
                    summary: format!(
                        "Updated task {} of course design plan {plan_id}: {fields}",
                        arguments.task_id
                    ),
                },
            },
            (),
        ))
    }
}

fn parse_bool(value: &str) -> ChatbotResult<bool> {
    match value.trim().to_lowercase().as_str() {
        "true" => Ok(true),
        "false" => Ok(false),
        other => Err(chatbot_err!(
            InvalidToolArguments,
            format!("'{other}' is not 'true' or 'false'.")
        )),
    }
}
