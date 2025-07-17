use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChatbotConversationMessageCitation {
    pub id: Uuid,
    pub conversation_message_id: Uuid,
    pub conversation_id: Uuid,
    pub content: String, // TODO: option or no option? do the yneed to be nullable
    pub title: String,
    pub document_url: String,
    pub citation_number: i32,
}

pub async fn insert(
    conn: &mut PgConnection,
    input: ChatbotConversationMessageCitation,
) -> ModelResult<ChatbotConversationMessageCitation> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageCitation,
        r#"
INSERT INTO chatbot_conversation_messages_citations (
  conversation_message_id,
  conversation_id,
  content,
  title,
  document_url,
  citation_number)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *
        "#,
        input.conversation_message_id,
        input.conversation_id,
        input.content,
        input.title,
        input.document_url,
        input.citation_number
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_message_id(
    conn: &mut PgConnection,
    message_id: Uuid,
) -> ModelResult<Vec<ChatbotConversationMessageCitation>> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageCitation,
        r#"
SELECT * FROM chatbot_conversation_messages_citations
WHERE conversation_message_id = $1
        "#,
        message_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_conversation_id(
    conn: &mut PgConnection,
    conversation_id: Uuid,
) -> ModelResult<Vec<ChatbotConversationMessageCitation>> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageCitation,
        r#"
SELECT * FROM chatbot_conversation_messages_citations
WHERE conversation_id = $1
        "#,
        conversation_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
