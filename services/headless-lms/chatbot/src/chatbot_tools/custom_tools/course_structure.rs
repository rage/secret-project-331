use indexmap::IndexMap;
use uuid::Uuid;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::pages;
use headless_lms_utils::{
    document_schema_processor::get_learning_objectives,
    json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType},
};
use sqlx::PgConnection;

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotTool, ChatbotToolDeclaration, ToolProperties,
        argument_parsing::deserialize_to_optional_uuid_and_errors_to_none,
        course_scope::{COURSE_ID_ARGUMENT_DESCRIPTION, resolve_course_scope},
        tool_permission::ToolPermission,
    },
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult, chatbot_err},
    user_context::ChatbotUserContext,
};

pub type CourseStructureTool = ToolProperties<CourseStructureState>;

pub struct CourseStructureState {
    course_pages_info: Vec<PageDocumentInfo>,
    /// Whether `course_id` was resolved from the argument (a support admin reading a course they
    /// are not on) rather than from the chatbot's own context, which decides how the closing
    /// instructions are worded.
    course_id_from_argument: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "snake_case")]
pub enum PageType {
    CourseFrontPage,
    TopLevelPage,
    ChapterFrontPage,
    GenericPage,
}

impl PageType {
    /// Determine page type based on page's position in course structure
    fn determine(
        order_number: i32,
        chapter_number: Option<i32>,
        module_number: Option<i32>,
    ) -> Self {
        if chapter_number.is_none() && module_number.is_none() && order_number == 0 {
            PageType::CourseFrontPage
        } else if chapter_number.is_none() && module_number.is_none() && order_number != 0 {
            PageType::TopLevelPage
        } else if chapter_number.is_some() && order_number == 0 {
            PageType::ChapterFrontPage
        } else {
            PageType::GenericPage
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct PageDocumentInfo {
    pub page_id: Uuid,
    pub url_path: String,
    pub page_title: String,
    pub page_type: PageType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chapter_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chapter_number: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub learning_objectives: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct CourseStructureArguments {
    #[serde(deserialize_with = "deserialize_to_optional_uuid_and_errors_to_none")]
    course_id: Option<Uuid>,
}

impl ChatbotToolDeclaration for CourseStructureTool {
    const NAME: &'static str = "course_structure";

    const PERMISSION: ToolPermission = ToolPermission::Anyone;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Get the course structure as an ordered list of all course pages. The structure lists all pages, chapters and modules that are part of the course. Each page is listed with its title, its place in the course structure (which chapter it is inside of, if any), and its learning objectives, if any. Information about the course pages' content can be found with the document_lookup tool.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([(
                    "course_id".to_string(),
                    SchemaPropertyType::Item(JsonItem {
                        type_field: JSONType::String,
                        description: Some(COURSE_ID_ARGUMENT_DESCRIPTION.to_string()),
                    }),
                )]),
                None,
            ),
            strict: true,
        }
    }
}

impl ChatbotTool for CourseStructureTool {
    type Arguments = CourseStructureArguments;

    /// A model that treats this tool as parameterless sends an empty argument string, which is
    /// not valid JSON, so that keeps working alongside `course_id`.
    fn parse_arguments(args_string: String) -> ChatbotResult<Self::Arguments> {
        if args_string.trim().is_empty() {
            return Ok(CourseStructureArguments { course_id: None });
        }
        serde_json::from_str(&args_string).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Couldn't parse tool arguments. Arguments: {args_string}"),
                e
            )
        })
    }

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        _app_config: &ApplicationConfiguration,
        arguments: Self::Arguments,
        user_context: &ChatbotUserContext,
    ) -> ChatbotResult<Self>
    where
        Self: Sized,
    {
        let course_id_from_argument = arguments.course_id.is_some();
        let course_id = resolve_course_scope(conn, user_context, arguments.course_id).await?;

        let mut pages_info = pages::get_page_info_special_for_course(conn, course_id).await?;
        pages_info.sort_by_key(|x| {
            // map module number 0 to 1 so that pages without a module
            // are ordered first. same for chapters.
            // order by module first, then chapter, then page number.
            x.module_number.map(|x| x + 1).unwrap_or(0) * 100
                + x.chapter_number.map(|x| x + 1).unwrap_or(0) * 10
                + x.order_number
        });

        let info: Vec<PageDocumentInfo> = pages_info
            .into_iter()
            .map(|p| {
                let blocks = p.blocks_cloned();
                let Ok(b) = blocks else {
                    // no block content
                    return PageDocumentInfo {
                        page_id: p.page_id,
                        url_path: p.url_path,
                        page_title: p.page_title,
                        page_type: PageType::determine(
                            p.order_number,
                            p.chapter_number,
                            p.module_number,
                        ),
                        chapter_title: p.chapter_title,
                        learning_objectives: None,
                        chapter_number: p.chapter_number,
                        module_name: p.module_name,
                    };
                };
                let learning_objectives = get_learning_objectives(b).ok();
                PageDocumentInfo {
                    page_id: p.page_id,
                    url_path: p.url_path,
                    page_title: p.page_title,
                    page_type: PageType::determine(
                        p.order_number,
                        p.chapter_number,
                        p.module_number,
                    ),
                    chapter_title: p.chapter_title,
                    learning_objectives,
                    chapter_number: p.chapter_number,
                    module_name: p.module_name,
                }
            })
            .collect();

        Ok(CourseStructureTool {
            state: CourseStructureState {
                course_pages_info: info,
                course_id_from_argument,
            },
        })
    }

    fn output(&self) -> String {
        serde_json::to_string(&self.state.course_pages_info).unwrap_or("Not found.".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        let closing = if self.state.course_id_from_argument {
            "This is a course the admin is looking up on behalf of a user, not the one this chat is running on. Look up a listed page's content with document_lookup using its page_id, or search the course's pages with course_material_search."
        } else {
            "The user has access to the course structure, so you shouldn't give it to them: they know it already. You can give an overview if asked. Look up a listed page's content with document_lookup using its page_id, or search the course's pages with course_material_search."
        };
        Some(format!(
            "Use the course structure to find out more about the course and answer the user's questions. The learning objectives listed on the course front page or top level pages are objectives for the whole course. Learning objectives listed on a chapter front page encompass the whole chapter, and objectives listed on a generic page are for the page only. {closing}"
        ))
    }
}
