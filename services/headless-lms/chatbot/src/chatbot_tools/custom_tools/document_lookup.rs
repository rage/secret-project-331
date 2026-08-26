use indexmap::IndexMap;

use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::chatbot_configurations::ToolCategory;
use headless_lms_models::{ModelErrorType, course_page_markdown_content, pages};
use headless_lms_utils::{
    document_schema_processor::remove_sensitive_attributes,
    json_schema_types::{JSONType, JsonItem, Schema, SchemaPropertyType},
    strings::truncate_utf8_at_boundary,
};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::{
    azure_chatbot::azure::tools::{AzureLLMFunctionToolDefinition, LLMToolType},
    chatbot_tools::{
        ChatbotTool, ChatbotToolDeclaration, ToolProperties,
        argument_parsing::deserialize_to_optional_uuid_and_errors_to_none,
        course_scope::{COURSE_ID_ARGUMENT_DESCRIPTION, resolve_course_scope},
        tool_permission::ToolPermission,
    },
    citations::parse_document_filepath,
    llm_utils::estimate_tokens,
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult, chatbot_err},
    user_context::ChatbotTurnContext,
};

pub type DocumentLookupTool = ToolProperties<DocumentLookupState>;

pub struct DocumentLookupState {
    document: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct DocumentLookupArguments {
    /// Required by the tool's schema, but the lookup resolves the document by id or filepath and
    /// never reads this back; kept only so a call missing it fails to deserialize.
    #[allow(dead_code)]
    title: String,
    filepath: Option<String>,
    #[serde(deserialize_with = "deserialize_to_optional_uuid_and_errors_to_none")]
    page_id: Option<Uuid>,
    format: String,
    #[serde(deserialize_with = "deserialize_to_optional_uuid_and_errors_to_none")]
    course_id: Option<Uuid>,
}

/// Truncates page content until its estimated token count fits the budget we are willing to hand
/// to the LLM. Scaling the byte length by the token ratio always shrinks the content, so this
/// terminates in a pass or two.
fn shorten_page_content(mut content: String) -> String {
    const MAX_TOKENS: i32 = 25_000;
    loop {
        let tokens = estimate_tokens(&content);
        if tokens <= MAX_TOKENS {
            return content;
        }
        let max_bytes = content.len() * (MAX_TOKENS as usize - 1_000) / tokens as usize;
        content = truncate_utf8_at_boundary(&content, max_bytes).to_string();
    }
}

impl ChatbotToolDeclaration for DocumentLookupTool {
    const NAME: &'static str = "document_lookup";

    const PERMISSION: ToolPermission = ToolPermission::Anyone;

    const CATEGORY: ToolCategory = ToolCategory::CourseMaterial;

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: Self::NAME.to_string(),
            description: "Look up the full content of a specific document by the title and filepath or id (page_id). The needed arguments can be found from Azure search results or by using the course_structure tool. Either a filepath or a page_id is required to find the correct document, in addition to the document title. The document can be returned in Markdown or JSON format. The Markdown format is cleaner and preferred, but might have errors: if you suspect it's erroneous, you can request the JSON version.".to_string(),
            parameters: Schema::strict_object(
                IndexMap::from([
                    (
                        "filepath".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The filepath of the document to look up, as returned from Azure search. Either the filepath or page_id is required.".to_string()),
                        }),
                    ),
                    (
                        "title".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The title of the document to look up, as returned from Azure search. Optional.".to_string()),
                        }),
                    ),
                    (
                        "page_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The page_id of the document to look up. Either page_id or the filepath is required.".to_string()),
                        }),
                    ),
                    (
                        "format".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some("The format of the document. Optional. Valid values are 'json' and 'markdown'. Markdown content is human readable, but might have errors. ".to_string()),
                        }),
                    ),
                    (
                        "course_id".to_string(),
                        SchemaPropertyType::Item(JsonItem {
                            type_field: JSONType::String,
                            description: Some(COURSE_ID_ARGUMENT_DESCRIPTION.to_string()),
                        }),
                    )
                ]),
                None,
            ),
            strict: true,
        }
    }
}

/// Look up a document (page) from the course the chatbot is on.
impl ChatbotTool for DocumentLookupTool {
    type Arguments = DocumentLookupArguments;

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        _app_config: &ApplicationConfiguration,
        arguments: Self::Arguments,
        user_context: &ChatbotTurnContext,
    ) -> ChatbotResult<Self> {
        let course_id = resolve_course_scope(conn, user_context, arguments.course_id).await?;

        let page_id = if let Some(id) = &arguments.page_id {
            id.to_owned()
        } else if let Some(f) = &arguments.filepath {
            let res = parse_document_filepath(f);
            match res {
                Ok(d) => d.page_id,
                Err(e) => Err(chatbot_err!(
                    InvalidToolArguments,
                    "Couldn't parse document file path and no valid page id was provided, unable to look up document.",
                    e
                ))?,
            }
        } else {
            return Err(chatbot_err!(
                InvalidToolArguments,
                format!(
                    "Unable to call document_lookup tool. No filepath or page id provided. One of them is needed to find the document."
                )
            ));
        };
        let document = match course_page_markdown_content::get_course_page_content_by_page_id(
            conn, page_id,
        )
        .await
        {
            // A page of another course is not the caller's to read, so it reads as not found.
            Ok(page_content) if page_content.course_id == course_id => {
                if arguments.format == "json" {
                    let s =
                        shorten_page_content(serde_json::to_string(&page_content.json_content)?);
                    Some(s)
                } else if let Some(content) = page_content.markdown_content {
                    let s = shorten_page_content(content);
                    Some(s)
                } else {
                    let base = "Markdown content not found. Page JSON content:\n\n".to_string();
                    let s =
                        shorten_page_content(serde_json::to_string(&page_content.json_content)?);
                    Some(base + &s)
                }
            }
            Ok(_) => None,
            // No chatbot has ever synced this course's markdown, which covers most courses: fall
            // back to the page's own blocks, sanitized the way the syncer would before indexing
            // them, instead of reporting the document not found.
            Err(e) if e.error_type() == &ModelErrorType::RecordNotFound => {
                match pages::get_page(conn, page_id).await {
                    Ok(page) if page.course_id == Some(course_id) && page.deleted_at.is_none() => {
                        let blocks = remove_sensitive_attributes(page.blocks_cloned()?);
                        let base = "No converted markdown exists for this course; this is raw block JSON:\n\n".to_string();
                        let s = shorten_page_content(serde_json::to_string(&blocks)?);
                        Some(base + &s)
                    }
                    _ => None,
                }
            }
            Err(e) => return Err(ChatbotError::from(e)),
        };

        Ok(DocumentLookupTool {
            state: DocumentLookupState { document },
        })
    }

    fn output(&self) -> String {
        if let Some(d) = &self.state.document {
            d.to_string()
        } else {
            "Document not found.".to_string()
        }
    }

    fn output_description_instructions(&self) -> Option<String> {
        Some("Do not return the whole document to the user. Use the document as a source of more information for answering the user etc. Cite the course_material_search result the page came from; document_lookup itself produces no citation.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shorten_page_content_shortens_prose() {
        let input = "The quick brown fox jumps over the lazy dog. ".repeat(4600);
        assert!(input.len() > 200_000);

        let shortened = shorten_page_content(input);

        assert!(estimate_tokens(&shortened) <= 25_000);
    }

    #[test]
    fn shorten_page_content_shortens_punctuation_heavy_json() {
        let input = format!(
            "[{}]",
            r#"{"id":"1","name":"block","attributes":{"content":"Hei, mitä kuuluu?"}},"#
                .repeat(2500)
        );
        assert!(input.len() > 150_000);

        let shortened = shorten_page_content(input);

        assert!(estimate_tokens(&shortened) <= 25_000);
    }

    #[test]
    fn shorten_page_content_leaves_short_content_alone() {
        let input = "Short enough.".to_string();

        assert_eq!(shorten_page_content(input.clone()), input);
    }
}
