use indexmap::IndexMap;

use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::pages;
use headless_lms_utils::{
    document_schema_processor::get_learning_objectives,
    json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType},
};

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotTool, ChatbotToolDeclaration, ToolProperties,
        argument_parsing::deserialize_to_optional_uuid_and_errors_to_none,
        course_scope::{
            COURSE_ID_ARGUMENT_DESCRIPTION, material_requirements, resolve_course_scope,
        },
        output_limits::CappedList,
        tool_authorization::ToolRequirement,
    },
    prelude::*,
    user_context::ChatbotTurnContext,
};

pub type CourseStructureTool = ToolProperties<CourseStructureState>;

pub struct CourseStructureState {
    structure: CourseStructure,
    /// Whether `course_id` was resolved from the argument (a support admin reading a course they
    /// are not on) rather than from the chatbot's own context, which decides how the closing
    /// instructions are worded.
    course_id_from_argument: bool,
}

/// The most page groups a course reports and the most pages one group lists. Both are far above
/// any real course; they exist so a pathological page count degrades into a legible partial list
/// rather than into the mid-value cut the output-wide backstop would make of it.
const MAX_PAGE_GROUPS: usize = 100;
const MAX_PAGES_PER_GROUP: usize = 200;

#[derive(Serialize, Deserialize, Debug)]
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

#[derive(Serialize)]
struct CourseStructure {
    page_groups: CappedList<PageGroup>,
}

/// The pages of one chapter, or the pages of a module that sit outside any chapter.
///
/// Grouped rather than flat because the module and chapter a page belongs to are otherwise
/// repeated on every page of them, which on a large course is most of the output.
#[derive(Serialize)]
struct PageGroup {
    #[serde(skip_serializing_if = "Option::is_none")]
    module_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    chapter_number: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    chapter_title: Option<String>,
    pages: CappedList<PageDocumentInfo>,
}

/// What a group's pages are keyed by. Not serialized: the same values are on the group itself.
#[derive(PartialEq, Eq, Hash)]
struct PageGroupKey {
    module_name: Option<String>,
    chapter_number: Option<i32>,
    chapter_title: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PageDocumentInfo {
    pub page_id: Uuid,
    pub url_path: String,
    pub page_title: String,
    pub page_type: PageType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub learning_objectives: Option<String>,
}

#[derive(Deserialize)]
pub struct CourseStructureArguments {
    #[serde(deserialize_with = "deserialize_to_optional_uuid_and_errors_to_none")]
    course_id: Option<Uuid>,
}

impl ChatbotToolDeclaration for CourseStructureTool {
    const NAME: &'static str = "course_structure";

    fn offer_requirements(user_context: &ChatbotTurnContext) -> Vec<ToolRequirement> {
        material_requirements(user_context.course_id)
    }

    const CATEGORY: ToolCategory = ToolCategory::CourseInfo;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Get the course structure as the course's pages in order, grouped by the module and chapter they belong to. Each page is listed with its title and its learning objectives, if any. Information about the course pages' content can be found with the document_lookup tool.".to_string(),
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

    fn call_requirements(
        arguments: &Self::Arguments,
        user_context: &ChatbotTurnContext,
    ) -> Vec<ToolRequirement> {
        material_requirements(resolve_course_scope(user_context, arguments.course_id).ok())
    }

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
        user_context: &ChatbotTurnContext,
    ) -> ChatbotResult<Self>
    where
        Self: Sized,
    {
        let course_id_from_argument = arguments.course_id.is_some();
        let course_id = resolve_course_scope(user_context, arguments.course_id)?;

        let mut pages_info = pages::get_page_info_special_for_course(conn, course_id).await?;
        pages_info.sort_by_key(|x| {
            // map module number 0 to 1 so that pages without a module
            // are ordered first. same for chapters.
            // order by module first, then chapter, then page number.
            x.module_number.map(|x| x + 1).unwrap_or(0) * 100
                + x.chapter_number.map(|x| x + 1).unwrap_or(0) * 10
                + x.order_number
        });

        let mut grouped: IndexMap<PageGroupKey, Vec<PageDocumentInfo>> = IndexMap::new();
        for page in pages_info {
            let key = PageGroupKey {
                module_name: page.module_name.clone(),
                chapter_number: page.chapter_number,
                chapter_title: page.chapter_title.clone(),
            };
            let learning_objectives = page
                .blocks_cloned()
                .ok()
                .and_then(|blocks| get_learning_objectives(&blocks));
            grouped.entry(key).or_default().push(PageDocumentInfo {
                page_id: page.page_id,
                url_path: page.url_path,
                page_title: page.page_title,
                page_type: PageType::determine(
                    page.order_number,
                    page.chapter_number,
                    page.module_number,
                ),
                learning_objectives,
            });
        }

        let page_groups = grouped
            .into_iter()
            .map(|(key, pages)| PageGroup {
                module_name: key.module_name,
                chapter_number: key.chapter_number,
                chapter_title: key.chapter_title,
                pages: CappedList::new(pages, MAX_PAGES_PER_GROUP),
            })
            .collect();

        Ok(CourseStructureTool {
            state: CourseStructureState {
                structure: CourseStructure {
                    page_groups: CappedList::new(page_groups, MAX_PAGE_GROUPS),
                },
                course_id_from_argument,
            },
        })
    }

    fn output(&self) -> String {
        serde_json::to_string(&self.state.structure).unwrap_or("Not found.".to_string())
    }

    fn output_description_instructions(&self) -> Option<String> {
        let closing = if self.state.course_id_from_argument {
            "This is a course the admin is looking up on behalf of a user, not the one this chat is running on. Look up a listed page's content with document_lookup using its page_id, or search the course's pages with course_material_search."
        } else {
            "The user has access to the course structure, so you shouldn't give it to them: they know it already. You can give an overview if asked. Look up a listed page's content with document_lookup using its page_id, or search the course's pages with course_material_search."
        };
        let mut notes = vec![format!(
            "Pages are grouped by the module and chapter they belong to, so a page's place in the course is on its group rather than on the page. Use the course structure to find out more about the course and answer the user's questions. The learning objectives listed on the course front page or top level pages are objectives for the whole course. Learning objectives listed on a chapter front page encompass the whole chapter, and objectives listed on a generic page are for the page only. {closing}"
        )];
        if self.state.structure.page_groups.is_truncated()
            || self
                .state
                .structure
                .page_groups
                .iter()
                .any(|group| group.pages.is_truncated())
        {
            notes.push(
                "A truncated marker means this course has more pages than fit in one result, so do not answer questions about how many pages or chapters it has from this."
                    .to_string(),
            );
        }
        Some(notes.join(" "))
    }
}
