use std::path::PathBuf;

use secrecy::SecretString;

use crate::{llm_utils::build_llm_headers, prelude::*};

use headless_lms_models::chatbot_conversation_messages_citations::{
    self, ChatbotConversationMessageCitation,
};
use headless_lms_utils::strings::truncate_utf8_at_boundary;
use headless_lms_utils::url_encoding::url_decode;
use reqwest::Response;
use serde::{Deserialize, Serialize};
use tracing::{error, instrument, trace};
use url::Url;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CourseMaterialDocument {
    pub chunk_id: String,
    pub chunk: String,
    pub title: String,
    pub url: String,
    pub filepath: String,
}

pub struct DocumentProperties {
    pub page_id: Uuid,
}

/// Parse the filepath of a document from the Azure search index and return the page_id of
/// the document. The page id is the same as the id of the page in our DB.
pub fn parse_document_filepath(filepath: &str) -> ChatbotResult<DocumentProperties> {
    let mut page_path = PathBuf::from(filepath);
    page_path.set_extension("");
    let page_id_str = page_path.file_name().ok_or(chatbot_err!(
        ToolUseError,
        "Failed to parse document filepath"
    ))?;
    let page_id = Uuid::parse_str(page_id_str.to_string_lossy().as_ref()).map_err(|_| {
        chatbot_err!(
            ToolUseError,
            format!("Failed to parse document page id: {:?}", page_id_str)
        )
    })?;

    Ok(DocumentProperties { page_id })
}

impl CourseMaterialDocument {
    /// Converts the document to citation. Returns also the page_id of the cited document
    /// so we can get the correct chapter_number later.
    pub fn to_chatbot_conversation_message_citation(
        &self,
        conversation_message_id: Uuid,
        conversation_id: Uuid,
        citation_number: i32,
    ) -> ChatbotResult<(ChatbotConversationMessageCitation, Option<Uuid>)> {
        // Shorten the content if needed
        let content = if self.chunk.len() < 255 {
            self.chunk.clone()
        } else {
            truncate_utf8_at_boundary(&self.chunk, 255).to_string()
        };

        // The title and URL come from Azure Blob Storage metadata, which was URL-encoded
        // (percent-encoded) because Azure Blob Storage metadata values must be ASCII-only.
        // We decode them back to their original UTF-8 strings before storing in the database.
        let decoded_title = url_decode(&self.title)?;
        let decoded_url = url_decode(&self.url)?;

        // Get the page id
        let page_id = parse_document_filepath(&self.filepath)
            .ok()
            .map(|x| x.page_id);
        Ok((
            ChatbotConversationMessageCitation {
                conversation_message_id,
                conversation_id,
                title: decoded_title,
                content,
                document_url: decoded_url,
                citation_number,
                ..Default::default()
            },
            page_id,
        ))
    }
}

/// Get documents cited by the chatbot from the search index and save them
/// as chatbot_conversation_message_citations into the database
pub async fn chatbot_cited_documents_to_citations(
    conn: &mut PgConnection,
    test_chatbot: bool,
    mut document_urls: Vec<Url>,
    api_key: &SecretString,
    conversation_message_id: Uuid,
    conversation_id: Uuid,
) -> ChatbotResult<Vec<ChatbotConversationMessageCitation>> {
    let mut documents: Vec<(CourseMaterialDocument, i32)> = vec![];
    for (idx, url) in document_urls.iter_mut().enumerate() {
        let document = get_course_material_document(url, api_key).await?;
        let citation_number = idx as i32;
        documents.push((document, citation_number));
    }
    let res = save_documents(
        conn,
        test_chatbot,
        documents,
        conversation_message_id,
        conversation_id,
    )
    .await?;

    Ok(res)
}

/// Get a document from the search index with a LLM-provided get url
async fn get_course_material_document(
    endpoint: &mut Url,
    api_key: &SecretString,
) -> ChatbotResult<CourseMaterialDocument> {
    endpoint.set_query(Some(
        "api-version=2024-07-01&$select=chunk_id,parent_id,chunk,title,url,filepath,course_id",
    ));
    let headers = build_llm_headers(api_key)?;

    let response = REQWEST_CLIENT
        .get(endpoint.clone())
        .headers(headers)
        .send()
        .await?;

    process_course_material_document_response(response).await
}

#[instrument(skip(response), fields(status = %response.status()))]
async fn process_course_material_document_response(
    response: Response,
) -> ChatbotResult<CourseMaterialDocument> {
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        error!(
            status = %status,
            error = %error_text,
            "Error fetching document from search index."
        );
        return Err(chatbot_err!(
            FailedAzureResponse,
            format!(
                "Error fetching document from search index: Status: {}. Error: {}",
                status, error_text
            )
        ));
    }

    trace!("Processing successful LLM response");
    // Parse the response
    let document: CourseMaterialDocument = response.json().await?;

    Ok(document)
}

/// Save a course material document into the database as a citation
async fn save_documents(
    conn: &mut PgConnection,
    test_chatbot: bool,
    documents_with_citation_numbers: Vec<(CourseMaterialDocument, i32)>,
    conversation_message_id: Uuid,
    conversation_id: Uuid,
) -> ChatbotResult<Vec<ChatbotConversationMessageCitation>> {
    let (citations, page_ids): (Vec<ChatbotConversationMessageCitation>, Vec<Option<Uuid>>) =
        documents_with_citation_numbers
            .iter()
            .map(|(d, citation_number)| {
                d.to_chatbot_conversation_message_citation(
                    conversation_message_id,
                    conversation_id,
                    citation_number.to_owned(),
                )
            })
            .collect::<ChatbotResult<Vec<(ChatbotConversationMessageCitation, Option<Uuid>)>>>()?
            .into_iter()
            .unzip();
    if test_chatbot {
        return save_documents_mock(conn, citations).await;
    };
    let res =
        chatbot_conversation_messages_citations::insert_batch(conn, citations, page_ids).await?;

    Ok(res)
}

async fn save_documents_mock(
    conn: &mut PgConnection,
    citations: Vec<ChatbotConversationMessageCitation>,
) -> ChatbotResult<Vec<ChatbotConversationMessageCitation>> {
    let mut res = vec![];
    for input in citations {
        let a = chatbot_conversation_messages_citations::insert(conn, input).await?;
        res.push(a)
    }
    Ok(res)
}
