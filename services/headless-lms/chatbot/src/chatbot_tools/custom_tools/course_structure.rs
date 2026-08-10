use std::collections::HashMap;

use headless_lms_models::pages;
use headless_lms_utils::document_schema_processor::get_learning_objectives;
use sqlx::PgConnection;

use crate::{
    azure_chatbot::ChatbotUserContext,
    chatbot_error::chatbot_err,
    chatbot_tools::{
        AzureLLMFunctionToolDefinition, ChatbotTool, LLMToolParamType, LLMToolParams, LLMToolType,
        ToolProperties,
    },
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult},
};

pub type CourseStructureTool = ToolProperties<CourseStructureState, CourseStructureArguments>;

pub struct CourseStructureState {
    course_pages_info: Vec<PageDocumentInfo>,
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

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CourseStructureArguments {}

impl ChatbotTool for CourseStructureTool {
    type State = CourseStructureState;
    type Arguments = CourseStructureArguments;

    fn parse_arguments(_args_string: String) -> ChatbotResult<Self::Arguments> {
        Ok(CourseStructureArguments {})
    }

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        arguments: Self::Arguments,
        user_context: &ChatbotUserContext,
    ) -> ChatbotResult<Self>
    where
        Self: Sized,
    {
        let Some(course_id) = user_context.course_id else {
            return Err(chatbot_err!(
                ToolUseError,
                "Course id is missing.".to_string()
            ));
        };

        let mut pages_info = pages::get_page_info_special_for_course(conn, course_id)
            .await
            .map_err(ChatbotError::from)?;
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
            },
            arguments,
        })
    }

    fn output(&self) -> String {
        serde_json::to_string(&self.state.course_pages_info).unwrap_or("Not found.".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        Some("The user has access to the course structure, so you shouldn't give it to them: they know it already. You can give an overview if asked. Use the course structure to find out more about the course and answer the user's questions. You can look up the content of the listed course pages with the document_lookup tool. The learning objectives listed on the course front page or top level pages are objectives for the whole course. Learning objectives listed on a chapter front page encompass the whole chapter, and objectives listed on a generic page are for the page only.".to_string())
    }

    fn get_arguments(&self) -> &Self::Arguments {
        &self.arguments
    }

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: "course_structure".to_string(),
            description: "Get the course structure as an ordered list of all course pages. The structure lists all pages, chapters and modules that are part of the course. Each page is listed with its title, its place in the course structure (which chapter it is inside of, if any), and its learning objectives, if any. Information about the course pages' content can be found with the document_lookup tool.".to_string(),
            parameters: LLMToolParams {
                tool_type: LLMToolParamType::Object,
                properties: HashMap::new(),
                required: vec![],
                additional_properties: false,
            },
            strict: true,
        }
    }
}
