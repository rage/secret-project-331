use std::collections::HashMap;

use crate::{
    azure_chatbot::{ChatbotUserContext, JSONType, JsonItem, SchemaPropertyType},
    chatbot_tools::{
        AzureLLMFunctionToolDefinition, ChatbotTool, LLMToolParamType, LLMToolParams, LLMToolType,
        ToolProperties,
    },
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult, chatbot_err},
};
//use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{
    course_audiences::get_course_ids_by_audience_vector,
    course_prerequisites::get_course_ids_by_prerequisite_vector,
    courses::{self, Course, get_by_description_vector},
};
use headless_lms_utils::azure_embedding::create_embeddings;
use serde::{Deserialize, Deserializer, Serialize};
use sqlx::PgConnection;

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
        println!("{:#?}", arguments);
        let audience_courses = if let Some(audiences) = &arguments.audiences {
            let audience_embedding = create_embeddings(vec![audiences.clone()])
                .await?
                .first()
                .expect("Embedding returned nothing")
                .to_owned();
            get_course_ids_by_audience_vector(conn, audience_embedding).await?
        } else {
            vec![]
        };

        let prerequisite_courses = if let Some(prerequisites) = &arguments.prerequisites {
            let prerequisite_embedding = create_embeddings(vec![prerequisites.clone()])
                .await?
                .first()
                .expect("Embedding returned nothing")
                .to_owned();
            get_course_ids_by_prerequisite_vector(conn, prerequisite_embedding).await?
        } else {
            vec![]
        };

        let description_courses = if let Some(description) = &arguments.description {
            let description_embedding = create_embeddings(vec![description.clone()])
                .await?
                .first()
                .expect("Embedding returned nothing")
                .to_owned();
            get_by_description_vector(conn, description_embedding).await?
        } else {
            vec![]
        };

        let course_ids = [description_courses, audience_courses, prerequisite_courses].concat();
        let courses = courses::get_by_ids(conn, &course_ids).await?;
        Ok(CourseFinderTool {
            state: CourseFinderState { courses },
            arguments,
        })
    }

    fn output(&self) -> String {
        serde_json::to_string(&self.state.courses)
            .unwrap_or_else(|_| "No courses found".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        Some("Do not return the JSON of the courses to the user. Use the course names and course descriptions to give a list and a very brief and summarized description of each course to the user. If there are duplicate courses ignore them. You can also mention why the course could be suitable to the user based on their request.".to_string())
    }

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: "course_finder".to_string(),
            description: "Find suitable courses for the user if they want to find available courses for their conditions. The arguments should be created based on the terms with which the user wants to filter the courses. The needed arguments should therefore be parsed from the user message. The arguments are natural-language descriptions for the parameters the user is using to search the courses. At least one of the three arguments is required. This tool is useful to find any courses if the user wants recommendations for courses they can take.".to_string(),
            parameters: LLMToolParams {
                tool_type: LLMToolParamType::Object,
                properties: HashMap::from([
                    (
                        "description".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                                type_field: JSONType::String,
                            description: Some("A natural-language description of what the user wants to learn.".to_string()),

                        }),
                    ),
                    (
                        "prerequisites".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                                type_field: JSONType::String,
                            description:Some("A natural-language description of the knowledge or experience the user already has.".to_string()),
                        }),
                    ),
                    (
                        "audiences".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                                type_field: JSONType::String,
                            description: Some("A natural-language description of the type of learner the user is, if relevant.".to_string()),
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

pub struct CourseFinderState {
    courses: Vec<Course>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CourseFinderArguments {
    #[serde(deserialize_with = "empty_string_as_none")]
    description: Option<String>,
    #[serde(deserialize_with = "empty_string_as_none")]
    prerequisites: Option<String>,
    #[serde(deserialize_with = "empty_string_as_none")]
    audiences: Option<String>,
}

fn empty_string_as_none<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let opt = Option::<String>::deserialize(deserializer)?;

    Ok(opt.and_then(|s| {
        let s = s.trim();
        if s.is_empty() {
            None
        } else {
            Some(s.to_owned())
        }
    }))
}
