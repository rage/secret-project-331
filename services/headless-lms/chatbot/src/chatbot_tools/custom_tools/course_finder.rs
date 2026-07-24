use std::collections::HashMap;

use headless_lms_models::{
    course_audiences::get_course_ids_by_audience,
    course_prerequisites::get_course_ids_by_prerequisite,
    courses::{self, Course, get_by_description_keywords},
};
use sqlx::PgConnection;

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
        let audience_courses = get_course_ids_by_audience(conn, &arguments.audiences).await?;
        let prerequisite_courses =
            get_course_ids_by_prerequisite(conn, &arguments.prerequisites).await?;
        let description_query_string = arguments.description.join(" OR ");

        let description_courses =
            get_by_description_keywords(conn, description_query_string).await?;

        let course_ids = [audience_courses, prerequisite_courses, description_courses].concat();
        let courses = courses::get_by_ids(conn, &course_ids).await?;
        //let course_json = serde_json::to_string(&courses);
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

    // Look up the full content of a specific document by the title and filepath or id (page_id). The needed arguments can be found from Azure search results or by using the course_structure tool. Either a filepath or a page_id is required to find the correct document, in addition to the document title.

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: "course_finder".to_string(),
            description: "Find all the courses that fit the user inquiry. The arguments should be created based on the terms with which the user wants to filter the courses. The needed arguments should therefore be parsed from the user message.".to_string(),
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
                        }),
                    ),
                    (
                        "prerequisites".to_string(),
                        SchemaPropertyType::ArrayProperty(ArrayProperty {
                                type_field: JSONType::Array,
                            description: Some("List of preliminary knowledge possessed to be suitable for a course.".to_string()),
                            items: ArrayItem::JsonItem(JsonItem {
                                    type_field: JSONType::String,
                                    description: None,
                                }),
                        }),
                    ),
                    (
                        "audiences".to_string(),
                        SchemaPropertyType::ArrayProperty(ArrayProperty {
                                type_field: JSONType::Array,
                            description: Some("LIst of audience types that a course is suitable for.".to_string()),
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

pub struct CourseFinderState {
    courses: Vec<Course>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CourseFinderArguments {
    description: Vec<String>,
    prerequisites: Vec<String>,
    audiences: Vec<String>,
}
