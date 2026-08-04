use std::collections::HashMap;

use crate::{
    azure_chatbot::{
        ArrayItem, ArrayProperty, ChatbotUserContext, JSONType, JsonItem, SchemaPropertyType,
    },
    chatbot_tools::{
        AzureLLMFunctionToolDefinition, ChatbotTool, LLMToolParamType, LLMToolParams, LLMToolType,
        ToolProperties,
    },
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult, chatbot_err},
};
use headless_lms_models::{
    course_audiences::get_course_ids_by_audience_vector,
    course_prerequisites::get_course_ids_by_prerequisite_vector,
    courses::{self, Course, get_by_description_vector},
};
use headless_lms_utils::azure_embedding::create_embeddings;
use serde::{Deserialize, Deserializer, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

pub type CourseFinderTool = ToolProperties<CourseFinderState, CourseFinderArguments>;

impl ChatbotTool for CourseFinderTool {
    type State = CourseFinderState;
    type Arguments = CourseFinderArguments;

    fn parse_arguments(args_string: String) -> ChatbotResult<Self::Arguments> {
        serde_json::from_str::<Self::Arguments>(&args_string).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Couldn't parse tool arguments. Arguments: {args_string}"),
                e
            )
        })
    }

    fn get_arguments(&self) -> &Self::Arguments {
        &self.arguments
    }

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        arguments: Self::Arguments,
        _user_context: &ChatbotUserContext,
    ) -> ChatbotResult<Self> {
        let audience_courses = if let Some(audiences) = &arguments.audiences {
            let audience_embeddings = create_embeddings(audiences.clone()).await?.to_owned();

            let mut audience_courses = vec![];

            for index in 0..audience_embeddings.len() {
                audience_courses.extend(
                    get_course_ids_by_audience_vector(
                        conn,
                        audience_embeddings[index].clone(),
                        audiences[index].clone(),
                    )
                    .await?,
                );
            }
            audience_courses
        } else {
            vec![]
        };

        let prerequisite_courses = if let Some(prerequisites) = &arguments.prerequisites {
            let prerequisite_embeddings =
                create_embeddings(prerequisites.clone()).await?.to_owned();

            let mut prerequisite_courses = vec![];

            for index in 0..prerequisite_embeddings.len() {
                prerequisite_courses.extend(
                    get_course_ids_by_prerequisite_vector(
                        conn,
                        prerequisite_embeddings[index].clone(),
                        prerequisites[index].clone(),
                    )
                    .await?,
                );
            }
            prerequisite_courses
        } else {
            vec![]
        };

        let description_courses = if let Some(description) = &arguments.description {
            let description_embeddings = create_embeddings(description.clone()).await?.to_owned();

            let mut description_courses = vec![];

            for index in 0..description_embeddings.len() {
                description_courses.extend(
                    get_by_description_vector(
                        conn,
                        description_embeddings[index].clone(),
                        description[index].clone(),
                    )
                    .await?,
                );
            }
            description_courses
        } else {
            vec![]
        };

        let course_ids = [description_courses, audience_courses, prerequisite_courses].concat();

        let mut counts: HashMap<Uuid, usize> = HashMap::new();

        for id in &course_ids {
            *counts.entry(*id).or_insert(0) += 1;
        }

        let courses = courses::get_by_ids(conn, &course_ids).await?;

        let mut course_occurrences: Vec<CourseOccurrences> = courses
            .into_iter()
            .map(|course| CourseOccurrences {
                occurrences: counts[&course.id],
                course,
            })
            .collect();

        course_occurrences.sort_by(|a, b| b.occurrences.cmp(&a.occurrences));

        Ok(CourseFinderTool {
            state: CourseFinderState {
                courses: course_occurrences,
            },
            arguments,
        })
    }

    fn output(&self) -> String {
        serde_json::to_string(&self.state.courses)
            .unwrap_or_else(|_| "No courses found".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        Some("Do not return the whole JSON of the courses to the user. Present the most suitable courses based on the user query. Use the course names and course descriptions to give a list and a very brief and summarized description of each course to the user. If there are duplicate courses ignore them. You can also mention why the course could be suitable to the user based on their request.".to_string())
    }

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: "course_finder".to_string(),
            description: "Find suitable courses for the user if they want to find available courses for their conditions. The arguments should be created based on the terms with which the user wants to filter the courses. The needed arguments should therefore be parsed from the user message. The arguments are arrays of keywords for the parameters the user is using to search the courses. At least one of the three arguments is required. This tool is useful to find any courses if the user wants recommendations for courses they can take.".to_string(),
            parameters: LLMToolParams {
                tool_type: LLMToolParamType::Object,
                properties: HashMap::from([
                    (
                        "description".to_string(),
                         SchemaPropertyType::ArrayProperty(ArrayProperty {
                                type_field: JSONType::Array,
                            description: Some("List of keywords used to search course descriptions based on if the user tries to find courses based on what they contain or teach.".to_string()),
                            items: ArrayItem::JsonItem(JsonItem {
                                    type_field: JSONType::String,
                                    description: None,
                                }),
            })),
                    (
                        "prerequisites".to_string(),
                        SchemaPropertyType::ArrayProperty(ArrayProperty {
                                type_field: JSONType::Array,
                            description: Some("List of keywords of preliminary knowledge possessed to be suitable for a course.".to_string()),
                            items: ArrayItem::JsonItem(JsonItem {
                                    type_field: JSONType::String,
                                    description: None,
                                }),})
                    ),
                    (
                        "audiences".to_string(),
                        SchemaPropertyType::ArrayProperty(ArrayProperty {
                                type_field: JSONType::Array,
                            description: Some("List of keywords of audience types that a course is suitable for.".to_string()),
                            items: ArrayItem::JsonItem(JsonItem {
                                    type_field: JSONType::String,
                                    description: None,
                                }),
                        }),
                    ),
                ]),
                required: vec!["description".to_string(), "prerequisites".to_string(), "audiences".to_string()],
                additional_properties: false,
            },
            strict: true,
        }
    }
}

#[derive(Debug)]
pub struct CourseFinderState {
    courses: Vec<CourseOccurrences>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
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
