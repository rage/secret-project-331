use std::collections::HashMap;

use chrono::NaiveDate;
use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::course_designer_plans::{
    self, CourseDesignerPlanStageStatus, CourseDesignerPlanStatus,
};
use headless_lms_models::course_designer_section_statuses::CourseDesignerSectionStatus;
use headless_lms_models::course_designer_stage_workspace::{
    CourseDesignerStageWorkspace, parse_workspace_data,
};
use headless_lms_models::{course_designer_plan_members, courses};
use headless_lms_utils::cache::Cache;

use super::{KNOWN_SECTION_KEYS, member_display_name, plan_member_requirements, stage_name};
use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotTool, ChatbotToolDeclaration, ToolProperties, no_parameters,
        tool_authorization::ToolRequirement,
    },
    prelude::*,
    user_context::ChatbotTurnContext,
};

pub type GetCoursePlanTool = ToolProperties<CoursePlanSnapshot>;

#[derive(Deserialize)]
pub struct GetCoursePlanArguments;

#[derive(Serialize)]
pub struct CoursePlanSnapshot {
    today: NaiveDate,
    plan: PlanOverview,
    members: Vec<MemberSnapshot>,
    stages: Vec<StageSnapshot>,
    known_section_keys: &'static [&'static str],
}

#[derive(Serialize)]
struct PlanOverview {
    name: Option<String>,
    status: &'static str,
    active_stage: Option<&'static str>,
    great_mooc_vision: Option<String>,
    created_course: Option<CreatedCourse>,
}

#[derive(Serialize)]
struct CreatedCourse {
    course_id: Uuid,
    name: String,
}

#[derive(Serialize)]
struct MemberSnapshot {
    user_id: Uuid,
    name: String,
    is_current_user: bool,
}

#[derive(Serialize)]
struct StageSnapshot {
    stage: &'static str,
    status: &'static str,
    planned_starts_on: NaiveDate,
    planned_ends_on: NaiveDate,
    actual_started_at: Option<DateTime<Utc>>,
    actual_completed_at: Option<DateTime<Utc>>,
    /// The stage's form as saved: `{"schema", "payload"}`, or null when nothing is saved yet.
    workspace: Option<serde_json::Value>,
    tasks: Vec<TaskSnapshot>,
    section_statuses: Vec<SectionStatusSnapshot>,
}

#[derive(Serialize)]
struct TaskSnapshot {
    task_id: Uuid,
    title: String,
    description: Option<String>,
    is_completed: bool,
    completed_at: Option<DateTime<Utc>>,
    assignee_user_id: Option<Uuid>,
    assignee_name: Option<String>,
    is_default_checklist_task: bool,
}

#[derive(Serialize)]
struct SectionStatusSnapshot {
    section_key: String,
    status: &'static str,
    comment: Option<String>,
    updated_by: Option<String>,
    updated_at: DateTime<Utc>,
}

impl ChatbotToolDeclaration for GetCoursePlanTool {
    const NAME: &'static str = "get_course_plan";

    fn offer_requirements(_user_context: &ChatbotTurnContext) -> Vec<ToolRequirement> {
        plan_member_requirements()
    }

    const CATEGORY: ToolCategory = ToolCategory::CoursePlanning;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Read the whole course design plan this conversation is about: name, status, active stage, the team's vision, members, every stage's schedule, saved form (workspace), tasks with assignees, and the ready/unfinished marks with comments on each section. Call it before giving feedback or proposing any change, and again after a change was applied or refused as stale.".to_string(),
            parameters: no_parameters(),
            strict: true,
        }
    }
}

impl ChatbotTool for GetCoursePlanTool {
    type Arguments = GetCoursePlanArguments;

    fn call_requirements(
        _arguments: &Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> Vec<ToolRequirement> {
        plan_member_requirements()
    }

    /// Takes no arguments, so whatever the model emitted is ignored.
    fn parse_arguments(_args_string: String) -> ChatbotResult<Self::Arguments> {
        Ok(GetCoursePlanArguments)
    }

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        _app_config: &ApplicationConfiguration,
        _cache: &Cache,
        _arguments: Self::Arguments,
        user_context: &ChatbotTurnContext,
    ) -> ChatbotResult<Self> {
        let (Some(plan_id), Some(user_id)) =
            (user_context.course_designer_plan_id, user_context.user_id)
        else {
            return Err(chatbot_err!(
                ToolUseError,
                "This conversation is not about a course design plan.".to_string()
            ));
        };
        let details =
            course_designer_plans::get_plan_details_for_user(conn, plan_id, user_id).await?;
        let members =
            course_designer_plan_members::get_plan_members_with_details(conn, plan_id, user_id)
                .await?;
        let created_course = match details.plan.created_course_id {
            Some(course_id) => {
                courses::get_course(conn, course_id)
                    .await
                    .optional()?
                    .map(|course| CreatedCourse {
                        course_id,
                        name: course.name,
                    })
            }
            None => None,
        };

        let names: HashMap<Uuid, String> = members
            .iter()
            .map(|member| (member.user_id, member_display_name(member)))
            .collect();

        let stages = details
            .stages
            .into_iter()
            .map(|stage_with_tasks| {
                let stage = stage_with_tasks.stage;
                let workspace = match parse_workspace_data(stage.workspace_data.clone()) {
                    Ok(parsed) => parsed.as_ref().map(workspace_json),
                    // Shown as stored rather than hidden, so the model can still read it.
                    Err(_) => stage.workspace_data.clone(),
                };
                StageSnapshot {
                    stage: stage_name(stage.stage),
                    status: match stage.status {
                        CourseDesignerPlanStageStatus::NotStarted => "not_started",
                        CourseDesignerPlanStageStatus::InProgress => "in_progress",
                        CourseDesignerPlanStageStatus::Completed => "completed",
                    },
                    planned_starts_on: stage.planned_starts_on,
                    planned_ends_on: stage.planned_ends_on,
                    actual_started_at: stage.actual_started_at,
                    actual_completed_at: stage.actual_completed_at,
                    workspace,
                    tasks: stage_with_tasks
                        .tasks
                        .into_iter()
                        .map(|task| TaskSnapshot {
                            task_id: task.id,
                            assignee_name: task
                                .assignee_user_id
                                .and_then(|id| names.get(&id).cloned()),
                            title: task.title,
                            description: task.description,
                            is_completed: task.is_completed,
                            completed_at: task.completed_at,
                            assignee_user_id: task.assignee_user_id,
                            is_default_checklist_task: task.is_auto_generated,
                        })
                        .collect(),
                    section_statuses: details
                        .section_statuses
                        .iter()
                        .filter(|status| status.stage == stage.stage)
                        .map(|status| SectionStatusSnapshot {
                            section_key: status.section_key.clone(),
                            status: match status.status {
                                CourseDesignerSectionStatus::Ready => "ready",
                                CourseDesignerSectionStatus::Unfinished => "unfinished",
                            },
                            comment: status.comment.clone(),
                            updated_by: names.get(&status.updated_by_user_id).cloned(),
                            updated_at: status.updated_at,
                        })
                        .collect(),
                }
            })
            .collect();

        Ok(ToolProperties {
            state: CoursePlanSnapshot {
                today: Utc::now().date_naive(),
                plan: PlanOverview {
                    name: details.plan.name,
                    status: match details.plan.status {
                        CourseDesignerPlanStatus::Draft => "draft",
                        CourseDesignerPlanStatus::Scheduling => "scheduling",
                        CourseDesignerPlanStatus::InProgress => "in_progress",
                        CourseDesignerPlanStatus::Completed => "completed",
                        CourseDesignerPlanStatus::Archived => "archived",
                    },
                    active_stage: details.plan.active_stage.map(stage_name),
                    great_mooc_vision: details.plan.great_mooc_vision,
                    created_course,
                },
                members: members
                    .iter()
                    .map(|member| MemberSnapshot {
                        user_id: member.user_id,
                        name: member_display_name(member),
                        is_current_user: member.user_id == user_id,
                    })
                    .collect(),
                stages,
                known_section_keys: &KNOWN_SECTION_KEYS,
            },
        })
    }

    fn output(&self) -> String {
        serde_json::to_string(&self.state)
            .unwrap_or_else(|_| "The plan could not be read.".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        Some("This is the plan as saved right now; base feedback on it and quote its own wording. Workspace field names are the paths propose_workspace_edit takes. A stage whose workspace is null has no saved form yet. Never show ids to the user; refer to tasks, chapters and members by name.".to_string())
    }
}

fn workspace_json(workspace: &CourseDesignerStageWorkspace) -> serde_json::Value {
    serde_json::to_value(workspace).unwrap_or(serde_json::Value::Null)
}
