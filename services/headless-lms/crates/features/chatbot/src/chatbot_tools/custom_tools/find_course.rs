use headless_lms_authorization::Action;
use std::str::FromStr;

use indexmap::IndexMap;

use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::{
    course_instances::{self, CourseInstance},
    courses::{self, Course},
    organizations,
};
use headless_lms_utils::json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType};

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotTool, ChatbotToolDeclaration, ToolProperties, tool_authorization::ToolRequirement,
    },
    prelude::*,
    user_context::ChatbotTurnContext,
};

pub type FindCourseTool = ToolProperties<FindCourseState>;

pub struct FindCourseState {
    candidates: Vec<CourseCandidate>,
    base_url: String,
}

struct CourseCandidate {
    course: Course,
    instances: Vec<CourseInstance>,
    organization_name: String,
}

#[derive(Serialize)]
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

#[derive(Serialize)]
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
}

impl From<&CourseInstance> for CourseInstanceOutput {
    fn from(instance: &CourseInstance) -> Self {
        Self {
            course_instance_id: instance.id,
            name: instance.name.clone(),
            starts_at: instance.starts_at,
            ends_at: instance.ends_at,
            support_email: instance.support_email.clone(),
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

#[derive(Deserialize)]
pub struct FindCourseArguments {
    query: String,
}

const MAX_CANDIDATES: i64 = 5;

impl ChatbotToolDeclaration for FindCourseTool {
    const NAME: &'static str = "find_course";

    fn offer_requirements(_user_context: &ChatbotTurnContext) -> Vec<ToolRequirement> {
        vec![ToolRequirement::global(Action::Administrate)]
    }

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

    fn call_requirements(
        _arguments: &Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> Vec<ToolRequirement> {
        vec![ToolRequirement::global(Action::Administrate)]
    }

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
        app_config: &ApplicationConfiguration,
        arguments: Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> ChatbotResult<Self> {
        let base_url = app_config.base_url.trim_end_matches('/').to_string();
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
            state: FindCourseState {
                candidates,
                base_url,
            },
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
        let candidates = &self.state.candidates;
        let base_url = &self.state.base_url;
        let mut notes = vec![
            "If several courses match (e.g. language versions of the same course — compare \
             language_code), ask the admin which one before proceeding. The instance contact \
             emails shown here may be stale; the course_configuration tool's staff facet is the \
             fresher source."
                .to_string(),
        ];

        if !candidates.is_empty() {
            let overview_links = candidates
                .iter()
                .map(|c| {
                    format!(
                        "{} ({}): {base_url}/manage/courses/{}/overview",
                        c.course.name, c.course.language_code, c.course.id
                    )
                })
                .collect::<Vec<_>>()
                .join(", ");
            notes.push(format!(
                "Course overview pages, to confirm you and the admin are looking at the same \
                 course: {overview_links}."
            ));
        }

        if candidates.is_empty() {
            notes.push(
                "No courses matched. This means either nothing matched the query, or the \
                 course was deleted (deleted courses are excluded from this search)."
                    .to_string(),
            );
        }

        if candidates.len() == MAX_CANDIDATES as usize {
            notes.push(format!(
                "Results are capped at {MAX_CANDIDATES} and ordered exact slug match > name \
                 substring > fuzzy match; there may be more matching courses that were \
                 silently truncated from this list."
            ));
        }

        if candidates
            .iter()
            .any(|c| c.course.is_test_mode || c.course.is_draft)
        {
            notes.push(
                "Some results have is_test_mode or is_draft set. A test-mode course is a \
                 staff testing copy and a draft course is unpublished — neither is the course \
                 a student is asking about."
                    .to_string(),
            );
        }

        if candidates.iter().any(|c| c.course.closed_at.is_some()) {
            let now = chrono::Utc::now();
            let mut closed_at_note = String::from(
                "closed_at is a scheduled closing timestamp: absent means the course was \
                 never scheduled to close, a future value means it's still open, and only a \
                 past value means it's actually closed.",
            );
            if candidates.iter().any(|c| {
                c.course.closed_at.is_some_and(|t| t <= now)
                    && c.course.closed_course_successor_id.is_none()
            }) {
                closed_at_note.push_str(
                    " A closed course with no closed_course_successor_id has nowhere \
                     configured to send the student.",
                );
            }
            if candidates
                .iter()
                .any(|c| c.course.closed_course_successor_id.is_some())
            {
                closed_at_note.push_str(
                    " closed_course_successor_id is a course id, not a name — call \
                     find_course again to identify it.",
                );
            }
            notes.push(closed_at_note);
        }

        if candidates
            .iter()
            .flat_map(|c| &c.instances)
            .any(|i| i.starts_at.is_none() || i.ends_at.is_none())
        {
            notes.push(
                "Some instances are missing starts_at or ends_at. The platform itself is \
                 inconsistent about whether such an instance counts as started, so report the \
                 absence rather than asserting whether the instance is running."
                    .to_string(),
            );
        }

        let mut name_to_candidates: std::collections::HashMap<&str, Vec<&CourseCandidate>> =
            std::collections::HashMap::new();
        for candidate in candidates {
            name_to_candidates
                .entry(candidate.course.name.as_str())
                .or_default()
                .push(candidate);
        }
        if let Some(ambiguous) = name_to_candidates.values().find(|group| {
            group
                .iter()
                .map(|c| c.course.language_code.as_str())
                .collect::<std::collections::HashSet<_>>()
                .len()
                >= 2
        }) {
            // Any candidate id in the group works: the language-versions page lists the whole sibling set.
            let representative_id = ambiguous[0].course.id;
            notes.push(format!(
                "Some results share a name but differ in language_code — these are separate \
                 course rows, and a student's progress lives in exactly one of them. \
                 {base_url}/manage/courses/{representative_id}/language-versions lists the \
                 whole sibling set side by side."
            ));
        }

        Some(notes.join(" "))
    }
}
