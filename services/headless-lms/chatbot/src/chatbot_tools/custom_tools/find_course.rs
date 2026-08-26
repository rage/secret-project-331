use std::str::FromStr;

use indexmap::IndexMap;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::{
    course_instances::{self, CourseInstance},
    courses::{self, Course},
    organizations,
};
use headless_lms_utils::json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotTool, ChatbotToolDeclaration, ToolProperties, tool_permission::ToolPermission,
    },
    prelude::{
        BackendError, ChatbotError, ChatbotErrorType, ChatbotResult, TryToOptional, chatbot_err,
    },
    user_context::ChatbotTurnContext,
};

pub type FindCourseTool = ToolProperties<FindCourseState>;

pub struct FindCourseState {
    candidates: Vec<CourseCandidate>,
}

struct CourseCandidate {
    course: Course,
    instances: Vec<CourseInstance>,
    organization_name: String,
}

#[derive(serde::Serialize)]
struct CourseCandidateOutput {
    course_id: Uuid,
    name: String,
    slug: String,
    language_code: String,
    organization_name: String,
    is_draft: bool,
    is_test_mode: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    closed_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    closed_additional_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    closed_course_successor_id: Option<Uuid>,
    instances: Vec<CourseInstanceOutput>,
}

#[derive(serde::Serialize)]
struct CourseInstanceOutput {
    course_instance_id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    starts_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ends_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    support_email: Option<String>,
    teacher_in_charge_name: String,
    teacher_in_charge_email: String,
}

impl From<&CourseInstance> for CourseInstanceOutput {
    fn from(instance: &CourseInstance) -> Self {
        Self {
            course_instance_id: instance.id,
            name: instance.name.clone(),
            starts_at: instance.starts_at,
            ends_at: instance.ends_at,
            support_email: instance.support_email.clone(),
            teacher_in_charge_name: instance.teacher_in_charge_name.clone(),
            teacher_in_charge_email: instance.teacher_in_charge_email.clone(),
        }
    }
}

impl From<&CourseCandidate> for CourseCandidateOutput {
    fn from(candidate: &CourseCandidate) -> Self {
        let course = &candidate.course;
        Self {
            course_id: course.id,
            name: course.name.clone(),
            slug: course.slug.clone(),
            language_code: course.language_code.clone(),
            organization_name: candidate.organization_name.clone(),
            is_draft: course.is_draft,
            is_test_mode: course.is_test_mode,
            closed_at: course.closed_at,
            closed_additional_message: course.closed_additional_message.clone(),
            closed_course_successor_id: course.closed_course_successor_id,
            instances: candidate
                .instances
                .iter()
                .map(CourseInstanceOutput::from)
                .collect(),
        }
    }
}

#[derive(serde::Deserialize)]
pub struct FindCourseArguments {
    query: String,
}

const MAX_CANDIDATES: i64 = 5;

impl ChatbotToolDeclaration for FindCourseTool {
    const NAME: &'static str = "find_course";

    const PERMISSION: ToolPermission = ToolPermission::GlobalAdmin;

    const CATEGORY: ToolCategory = ToolCategory::AdminSupportCourses;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Find a course by UUID, exact slug, or (part of) its name. Use this to resolve which course an admin means before calling course- or user-scoped tools.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([(
                    "query".to_string(),
                    SchemaPropertyType::Item(JsonItem {
                        type_field: JSONType::String,
                        description: Some(
                            "Course UUID, exact slug, or (part of) the course name.".to_string(),
                        ),
                    }),
                )]),
                None,
            ),
            strict: true,
        }
    }
}

impl ChatbotTool for FindCourseTool {
    type Arguments = FindCourseArguments;

    fn parse_arguments(args_string: String) -> ChatbotResult<Self::Arguments> {
        let mut arguments: Self::Arguments = serde_json::from_str(&args_string).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Couldn't parse tool arguments. Arguments: {args_string}"),
                e
            )
        })?;
        arguments.query = arguments.query.trim().to_string();
        if arguments.query.is_empty() {
            return Err(chatbot_err!(
                InvalidToolArguments,
                "query must not be empty.".to_string()
            ));
        }
        Ok(arguments)
    }

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        _app_config: &ApplicationConfiguration,
        arguments: Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> ChatbotResult<Self> {
        let query = arguments.query;

        let courses = if let Ok(course_id) = Uuid::from_str(&query) {
            match courses::get_course(conn, course_id).await.optional()? {
                Some(course) => vec![course],
                None => {
                    courses::search_courses_by_slug_or_name(conn, &query, MAX_CANDIDATES).await?
                }
            }
        } else {
            courses::search_courses_by_slug_or_name(conn, &query, MAX_CANDIDATES).await?
        };

        let organization_ids: Vec<Uuid> = courses.iter().map(|c| c.organization_id).collect();
        let organization_names: std::collections::HashMap<Uuid, String> =
            organizations::get_by_ids(conn, &organization_ids)
                .await?
                .into_iter()
                .map(|org| (org.id, org.name))
                .collect();

        let mut candidates = Vec::with_capacity(courses.len());
        for course in courses {
            let instances =
                course_instances::get_course_instances_for_course(conn, course.id).await?;
            let organization_name = organization_names
                .get(&course.organization_id)
                .cloned()
                .unwrap_or_default();
            candidates.push(CourseCandidate {
                course,
                instances,
                organization_name,
            });
        }

        Ok(FindCourseTool {
            state: FindCourseState { candidates },
        })
    }

    fn output(&self) -> String {
        let candidates: Vec<CourseCandidateOutput> = self
            .state
            .candidates
            .iter()
            .map(CourseCandidateOutput::from)
            .collect();
        serde_json::to_string_pretty(&candidates).unwrap_or_else(|_| "No courses found".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        Some(
            "If several courses match (e.g. language versions of the same course — compare \
             language_code), ask the admin which one before proceeding. The instance contact \
             emails shown here may be stale; the course_configuration tool's staff facet is the \
             fresher source."
                .to_string(),
        )
    }
}
