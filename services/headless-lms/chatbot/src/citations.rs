use std::path::PathBuf;

use crate::{llm_utils::build_llm_headers, prelude::*};

use futures::future::try_join_all;
use headless_lms_models::chatbot_conversation_messages_citations::{
    self, ChatbotConversationMessageCitation,
};
use headless_lms_utils::{ApplicationConfiguration, url_encoding::url_decode};
use reqwest::Response;
use reqwest::header::HeaderMap;
use serde::{Deserialize, Serialize};
use tracing::{debug, error, instrument, trace, warn};
use url::Url;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CourseMaterialDocument {
    pub chunk_id: String,
    pub chunk: String,
    pub title: String,
    pub url: String,
    pub filepath: String,
}

impl CourseMaterialDocument {
    pub async fn to_chatbot_conversation_message_citation(
        &self,
        conn: &mut PgConnection,
        conversation_message_id: Uuid,
        conversation_id: Uuid,
        citation_number: i32,
    ) -> ChatbotResult<ChatbotConversationMessageCitation> {
        // Shorten the content if needed
        let content = if self.chunk.len() < 255 {
            self.chunk.clone()
        } else {
            self.chunk[0..255].to_string()
        };

        // The title and URL come from Azure Blob Storage metadata, which was URL-encoded
        // (percent-encoded) because Azure Blob Storage metadata values must be ASCII-only.
        // We decode them back to their original UTF-8 strings before storing in the database.
        let decoded_title = url_decode(&self.title)?;
        let decoded_url = url_decode(&self.url)?;

        // Get the chapter number
        let mut page_path = PathBuf::from(&self.filepath);
        page_path.set_extension("");
        let page_id_str = page_path.file_name();
        let page_id =
            page_id_str.and_then(|id_str| Uuid::parse_str(id_str.to_string_lossy().as_ref()).ok());
        let course_material_chapter_number = if let Some(id) = page_id {
            let chapter = models::chapters::get_chapter_by_page_id(conn, id)
                .await
                .ok();
            chapter.map(|c| c.chapter_number)
        } else {
            None
        };
        Ok(ChatbotConversationMessageCitation {
            conversation_message_id,
            conversation_id,
            course_material_chapter_number,
            title: decoded_title,
            content,
            document_url: decoded_url,
            citation_number,
            ..Default::default()
        })
    }
}

pub async fn chatbot_annotations_to_citations(
    conn: &mut PgConnection,
    mut get_urls: Vec<Url>,
    api_key: &str,
    conversation_message_id: Uuid,
    conversation_id: Uuid,
) -> anyhow::Result<Vec<ChatbotConversationMessageCitation>> {
    let res = for (idx, url) in get_urls.iter_mut().enumerate() {
        let document = get_course_material_document(url, api_key).await?;
        let citation_number = (idx + 1) as i32;
        let a = save_document(
            conn,
            document,
            conversation_message_id,
            conversation_id,
            citation_number,
        )
        .await?;
    };

    Ok(vec![])
}

async fn get_course_material_document(
    endpoint: &mut Url,
    api_key: &str,
) -> anyhow::Result<CourseMaterialDocument> {
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
) -> anyhow::Result<CourseMaterialDocument> {
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await?;
        error!(
            status = %status,
            error = %error_text,
            "Error fetching document from search index."
        );
        return Err(anyhow::anyhow!(
            "Error fetching document from search index: Status: {}. Error: {}",
            status,
            error_text
        ));
    }

    trace!("Processing successful LLM response");
    // Parse the response
    let document: CourseMaterialDocument = response.json().await?;

    Ok(document)
}

async fn save_document(
    conn: &mut PgConnection,
    document: CourseMaterialDocument,
    conversation_message_id: Uuid,
    conversation_id: Uuid,
    citation_number: i32,
) -> anyhow::Result<ChatbotConversationMessageCitation> {
    let citation = document
        .to_chatbot_conversation_message_citation(
            conn,
            conversation_message_id,
            conversation_id,
            citation_number,
        )
        .await?;
    Ok(chatbot_conversation_messages_citations::insert(conn, citation).await?)
}
