use std::collections::HashMap;
use std::str::FromStr;

use headless_lms_utils::strings::truncate_utf8_at_boundary;
use serde::{Deserialize, Deserializer};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::{
    azure_chatbot::{ChatbotUserContext, JSONType, JsonItem, SchemaPropertyType},
    chatbot_tools::{
        AzureLLMFunctionToolDefinition, ChatbotTool, LLMToolParamType, LLMToolParams, LLMToolType,
        ToolProperties,
    },
    citations::parse_document_filepath,
    llm_utils::estimate_tokens,
    prelude::{BackendError, ChatbotError, ChatbotErrorType, ChatbotResult, chatbot_err},
};

pub type DocumentLookupTool = ToolProperties<DocumentLookupState, DocumentLookupArguments>;

pub struct DocumentLookupState {
    document: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct DocumentLookupArguments {
    title: String,
    filepath: Option<String>,
    #[serde(deserialize_with = "deserialize_to_optional_uuid_and_errors_to_none")]
    page_id: Option<Uuid>,
    format: String,
}

/// Deserializes an optional string field and parses it into an Uuid, doing this
/// optionally without failure. If an error occurs, a None is returned. This is
/// desired for the page_id field in DocumentLookupArguments, which is generated
/// by an LLM and can be None or a non-Uuid string in some cases. If any errors
/// should occur, they are emitted in ChatbotTools's from_db_and_arguments.
fn deserialize_to_optional_uuid_and_errors_to_none<'de, D>(
    deserializer: D,
) -> Result<Option<Uuid>, D::Error>
where
    D: Deserializer<'de>,
{
    let res = String::deserialize(deserializer)
        .ok()
        .and_then(|s| Uuid::from_str(&s).ok());
    Ok(res)
}

fn shorten_page_content(content: String) -> String {
    let page_tokens = estimate_tokens(&content);
    if page_tokens <= 25000 {
        return content.to_string();
    }
    // a token is ~4 chars and a char is ~4 bytes
    let max_bytes = ((page_tokens - 1000) * 4 * 4) as usize;

    let shortened = truncate_utf8_at_boundary(&content, max_bytes);
    shorten_page_content(shortened.to_string())
}

/// Look up a document (page) from the course the chatbot is on.
impl ChatbotTool for DocumentLookupTool {
    type State = DocumentLookupState;
    type Arguments = DocumentLookupArguments;

    fn parse_arguments(args_string: String) -> ChatbotResult<Self::Arguments> {
        serde_json::from_str::<Self::Arguments>(&args_string).map_err(|e| {
            chatbot_err!(
                InvalidToolArguments,
                format!("Couldn't parse tool arguments. Arguments: {args_string}"),
                e
            )
        })
    }

    async fn from_db_and_arguments(
        conn: &mut PgConnection,
        mut arguments: Self::Arguments,
        user_context: &ChatbotUserContext,
    ) -> ChatbotResult<Self> {
        let Some(course_id) = user_context.course_id else {
            return Err(chatbot_err!(
                ToolUseError,
                "User id is missing.".to_string()
            ));
        };
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
        let page_content =
            headless_lms_models::course_page_markdown_content::get_course_page_content_by_page_id(
                conn, page_id,
            )
            .await?;

        let document =
            // Check if the titles match and the page is part of the same course as
            // the one the user is on.
            if page_content.course_id == course_id {
                arguments.title = page_content.title;
                if arguments.format == "json" {
                    let s = shorten_page_content(serde_json::to_string(&page_content.json_content)?);
                    Some(s)
                } else {
                // use markdown content if there is any. else use json as string
                if let Some(content) = page_content.markdown_content {
                    let s = shorten_page_content(content);
                    Some(s)
                } else {
                    let base = "Markdown content not found. Page JSON content:\n\n".to_string();
                    let s = shorten_page_content(serde_json::to_string(&page_content.json_content)?);
                    Some(base + &s)
                }
                }

            } else {
                None
            };

        Ok(DocumentLookupTool {
            state: DocumentLookupState { document },
            arguments,
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
        Some("Do not return the whole document to the user. Use the document as a source of more information for answering the user etc. If you need to cite the content of this document, cite the Azure search result of the document.".to_string())
    }

    fn get_arguments(&self) -> &Self::Arguments {
        &self.arguments
    }

    fn get_tool_definition() -> AzureLLMFunctionToolDefinition {
        AzureLLMFunctionToolDefinition {
            tool_type: LLMToolType::Function,
            name: "document_lookup".to_string(),
            description: "Look up the full content of a specific document by the title and filepath or id (page_id). The needed arguments can be found from Azure search results or by using the course_structure tool. Either a filepath or a page_id is required to find the correct document, in addition to the document title. The document can be returned in Markdown or JSON format. The Markdown format is cleaner and preferred, but might have errors: if you suspect it's erroneous, you can request the JSON version.".to_string(),
            parameters: LLMToolParams {
                tool_type: LLMToolParamType::Object,
                properties: HashMap::from([
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
                    )
                ]),
                required: vec!["title".to_string(), "page_id".to_string(), "filepath".to_string(), "format".to_string()],
                additional_properties: false,
            },
            strict: true,
        }
    }
}
