use std::collections::HashMap;

use indexmap::IndexMap;
use serde::Deserializer;

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotTool, ChatbotToolDeclaration, ToolProperties, tool_authorization::ToolRequirement,
    },
    prelude::*,
    user_context::ChatbotTurnContext,
};
use headless_lms_models::{
    chatbot_configurations::ToolCategory,
    organizations::{self, DatabaseOrganization},
};
use headless_lms_models::{
    course_audiences::get_course_ids_by_audience_vectors,
    course_prerequisites::get_course_ids_by_prerequisite_vectors,
    courses::{self, Course, get_by_description_vectors},
    external_courses::{ExternalCourse, get_external_courses_by_embeddings},
};
use headless_lms_utils::{
    azure_embedding::create_embeddings,
    course_url::build_course_url,
    json_schema_types::{Schema, string_array_property},
};

#[derive(Debug, Serialize)]
pub struct CourseFinderState {
    courses: Vec<CourseOccurrences>,
    external_courses: Vec<ExternalCourse>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct CourseFinderArguments {
    #[serde(deserialize_with = "empty_vec_as_none")]
    description: Option<Vec<String>>,
    #[serde(deserialize_with = "empty_vec_as_none")]
    prerequisites: Option<Vec<String>>,
    #[serde(deserialize_with = "empty_vec_as_none")]
    audiences: Option<Vec<String>>,
}
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CourseOccurrences {
    course: Course,
    occurrences: usize,
    course_url: String,
}

pub type CourseFinderTool = ToolProperties<CourseFinderState>;

impl ChatbotTool for CourseFinderTool {
    type Arguments = CourseFinderArguments;

    fn call_requirements(
        _arguments: &Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> Vec<ToolRequirement> {
        Vec::new()
    }

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        app_config: &ApplicationConfiguration,
        arguments: Self::Arguments,
        _user_context: &ChatbotTurnContext,
    ) -> ChatbotResult<Self> {
        let audience_courses = if let Some(audiences) = &arguments.audiences {
            let audience_embeddings = create_embeddings(app_config, audiences.clone())
                .await?
                .to_owned();

            get_course_ids_by_audience_vectors(conn, audience_embeddings, audiences.clone()).await?
        } else {
            vec![]
        };

        let prerequisite_courses = if let Some(prerequisites) = &arguments.prerequisites {
            let prerequisite_embeddings = create_embeddings(app_config, prerequisites.clone())
                .await?
                .to_owned();

            get_course_ids_by_prerequisite_vectors(
                conn,
                prerequisite_embeddings,
                prerequisites.clone(),
            )
            .await?
        } else {
            vec![]
        };

        let (description_courses, external_courses) =
            if let Some(description) = &arguments.description {
                let description_embeddings = create_embeddings(app_config, description.clone())
                    .await?
                    .to_owned();

                let external_courses = get_external_courses_by_embeddings(
                    conn,
                    description.clone(),
                    description_embeddings.clone(),
                )
                .await?;

                let courses =
                    get_by_description_vectors(conn, description_embeddings, description.clone())
                        .await?;
                (courses, external_courses)
            } else {
                (vec![], vec![])
            };

        let course_ids = [description_courses, audience_courses, prerequisite_courses].concat();

        let mut counts: HashMap<Uuid, usize> = HashMap::new();

        for id in &course_ids {
            *counts.entry(*id).or_insert(0) += 1;
        }

        let courses = courses::get_by_ids(conn, &course_ids).await?;

        let organization_ids: Vec<Uuid> = courses
            .iter()
            .map(|course| course.organization_id)
            .collect();

        let organizations = organizations::get_by_ids(conn, &organization_ids).await?;

        let organization_by_id: HashMap<Uuid, &DatabaseOrganization> = organizations
            .iter()
            .map(|organization| (organization.id, organization))
            .collect();

        let mut course_occurrences: Vec<CourseOccurrences> = courses
            .into_iter()
            .map(|course| {
                let organization = organization_by_id
                    .get(&course.organization_id)
                    .expect("course organization should exist");

                CourseOccurrences {
                    occurrences: counts[&course.id],
                    course_url: build_course_url(
                        &app_config.base_url,
                        &organization.slug,
                        &course.slug,
                    ),
                    course,
                }
            })
            .collect();

        course_occurrences.sort_by_key(|b| std::cmp::Reverse(b.occurrences));

        Ok(CourseFinderTool {
            state: CourseFinderState {
                courses: course_occurrences,
                external_courses,
            },
        })
    }

    fn output(&self) -> String {
        serde_json::to_string(&self.state).unwrap_or_else(|_| "No courses found".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        Some("Do not return the whole JSON of the courses to the user. Courses under the 'courses'key are what you should prioritize. If in addition to those courses there is some external course that matches the user query especially well, you can recommend that as well. If you recommend an external course, mention that is hosted on another platform. Present the most suitable courses based on the user query. Use the course names and course descriptions to give a list and a very brief and summarized description of each course to the user. If there are duplicate courses ignore them. You can also mention why the course could be suitable to the user based on their request.".to_string())
    }
}

impl ChatbotToolDeclaration for CourseFinderTool {
    const NAME: &'static str = "course_finder";

    fn offer_requirements(_user_context: &ChatbotTurnContext) -> Vec<ToolRequirement> {
        Vec::new()
    }

    const CATEGORY: ToolCategory = ToolCategory::CourseCatalog;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Find suitable courses for the user if they want to find available courses for their conditions. The arguments should be created based on the terms with which the user wants to filter the courses. The needed arguments should therefore be parsed from the user message. The arguments are arrays of keywords for the parameters the user is using to search the courses. At least one of the three arguments is required. Match on any single argument will find a course so it is safe to provide all types of arguments when suitable. This tool is useful to find any courses if the user wants recommendations for courses they can take.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "description".to_string(),
                        string_array_property(Some("List of keywords used to search course descriptions based on if the user tries to find courses based on what they contain or teach.")),
                    ),
                    (
                        "prerequisites".to_string(),
                        string_array_property(Some("List of keywords of preliminary knowledge possessed to be suitable for a course.")),
                    ),
                    (
                        "audiences".to_string(),
                        string_array_property(Some("List of keywords of audience types that a course is suitable for.")),
                    ),
                ]),
                None,
            ),
            strict: true,
        }
    }
}

fn empty_vec_as_none<'de, D>(deserializer: D) -> Result<Option<Vec<String>>, D::Error>
where
    D: Deserializer<'de>,
{
    let opt = Option::<Vec<String>>::deserialize(deserializer)?;

    Ok(opt.and_then(|vec| {
        let vec: Vec<String> = vec
            .into_iter()
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty())
            .collect();

        if vec.is_empty() { None } else { Some(vec) }
    }))
}
