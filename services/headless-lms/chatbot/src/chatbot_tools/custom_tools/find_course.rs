use std::str::FromStr;

use indexmap::IndexMap;

use headless_lms_base::config::ApplicationConfiguration;
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
    user_context::ChatbotUserContext,
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

#[derive(serde::Deserialize)]
pub struct FindCourseArguments {
    query: String,
}

const MAX_CANDIDATES: i64 = 5;

impl ChatbotToolDeclaration for FindCourseTool {
    const NAME: &'static str = "find_course";

    const PERMISSION: ToolPermission = ToolPermission::GlobalAdmin;

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
        _user_context: &ChatbotUserContext,
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

        let mut candidates = Vec::with_capacity(courses.len());
        for course in courses {
            let instances =
                course_instances::get_course_instances_for_course(conn, course.id).await?;
            let organization =
                organizations::get_organization(conn, course.organization_id).await?;
            candidates.push(CourseCandidate {
                course,
                instances,
                organization_name: organization.name,
            });
        }

        Ok(FindCourseTool {
            state: FindCourseState { candidates },
        })
    }

    fn output(&self) -> String {
        let candidates: Vec<serde_json::Value> = self
            .state
            .candidates
            .iter()
            .map(|candidate| {
                let course = &candidate.course;
                let instances: Vec<serde_json::Value> = candidate
                    .instances
                    .iter()
                    .map(|instance| {
                        serde_json::json!({
                            "course_instance_id": instance.id,
                            "name": instance.name,
                            "starts_at": instance.starts_at,
                            "ends_at": instance.ends_at,
                            "support_email": instance.support_email,
                            "teacher_in_charge_name": instance.teacher_in_charge_name,
                            "teacher_in_charge_email": instance.teacher_in_charge_email,
                        })
                    })
                    .collect();
                serde_json::json!({
                    "course_id": course.id,
                    "name": course.name,
                    "slug": course.slug,
                    "language_code": course.language_code,
                    "organization_name": candidate.organization_name,
                    "is_draft": course.is_draft,
                    "is_test_mode": course.is_test_mode,
                    "closed_at": course.closed_at,
                    "closed_additional_message": course.closed_additional_message,
                    "closed_course_successor_id": course.closed_course_successor_id,
                    "instances": instances,
                })
            })
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
