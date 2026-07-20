use std::collections::HashMap;
use std::str::FromStr;

use headless_lms_utils::url_encoding::url_decode;
use serde::{Deserialize, Deserializer};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::{
    azure_chatbot::ChatbotUserContext,
    chatbot_tools::{
        AzureLLMFunctionToolDefinition, ChatbotTool, LLMToolParamProperties, LLMToolParamType,
        LLMToolParams, LLMToolType, ToolProperties,
    },
    citations::parse_document_filepath,
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
    #[serde(deserialize_with = "parse_uuid_permissibly_optional")]
    page_id: Option<Uuid>,
}

/// Deserializes an optional string field and parses it into an Uuid, doing this
/// optionally without failure. If an error occurs, a None is returned. This is
/// desired for the page_id field in DocumentLookupArguments, which is generated
/// by an LLM and can be None or a non-Uuid string in some cases. If any errors
/// should occur, they are emitted in ChatbotTools's from_db_and_arguments.
fn parse_uuid_permissibly_optional<'de, D>(deserializer: D) -> Result<Option<Uuid>, D::Error>
where
    D: Deserializer<'de>,
{
    let res = String::deserialize(deserializer)
        .ok()
        .and_then(|s| Uuid::from_str(&s).ok());
    Ok(res)
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
        let course_id = user_context.course_id;
        let page_title = url_decode(&arguments.title)?;
        arguments.title = page_title;

        let page = headless_lms_models::chatbot_page_sync_statuses::get_latest_synced_page_content_by_page_id(conn, page_id).await?;

        let document =
            // Check if the titles match and the page is part of the same course as
            // the one the user is on.
            if page.title == arguments.title && page.course_id == course_id {
                // use markdown content if there is any. else use json as string
                if let Some(content) = page.markdown_content {
                    Some(content)
                } else if let Some(json) = page.json_content {
                    Some(serde_json::to_string(&json)?)
                } else { None }
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
            description: "Look up the full content of a specific document by the title and filepath or id (page_id). The needed arguments can be found from Azure search results or by using the course_structure tool. Either a filepath or a page_id is required to find the correct document, in addition to the document title.".to_string(),
            parameters: LLMToolParams {
                tool_type: LLMToolParamType::Object,
                properties: HashMap::from([
                    (
                        "filepath".to_string(),
                        LLMToolParamProperties {
                            param_type: "string".to_string(),
                            description: "The filepath of the document to look up, as returned from Azure search. Either the filepath or page_id is required.".to_string(),
                        },
                    ),
                    (
                        "title".to_string(),
                        LLMToolParamProperties {
                            param_type: "string".to_string(),
                            description: "The title of the document to look up, as returned from Azure search.".to_string(),
                        },
                    ),
                    (
                        "page_id".to_string(),
                        LLMToolParamProperties {
                            param_type: "string".to_string(),
                            description: "The page_id of the document to look up. Either page_id or the filepath is required.".to_string(),
                        },
                    )
                ]),
                required: vec!["title".to_string(), "page_id".to_string(), "filepath".to_string()],
                additional_properties: false,
            },
            strict: true,
        }
    }
}
