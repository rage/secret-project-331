use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChatbotConversationMessageCitation {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub conversation_message_id: Uuid,
    pub conversation_id: Uuid,
    pub course_material_chapter_number: Option<i32>,
    pub title: String,
    pub content: String,
    pub document_url: String,
    pub citation_number: i32,
}

impl Default for ChatbotConversationMessageCitation {
    fn default() -> Self {
        Self {
            id: Uuid::nil(),
            created_at: Default::default(),
            updated_at: Default::default(),
            deleted_at: None,
            conversation_message_id: Uuid::nil(),
            conversation_id: Uuid::nil(),
            course_material_chapter_number: None,
            title: Default::default(),
            content: Default::default(),
            document_url: Default::default(),
            citation_number: Default::default(),
        }
    }
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
  course_material_chapter_number,
  title,
  content,
  document_url,
  citation_number)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *
        "#,
        input.conversation_message_id,
        input.conversation_id,
        input.course_material_chapter_number,
        input.title,
        input.content,
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
AND deleted_at IS NULL
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
AND deleted_at IS NULL
        "#,
        conversation_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn update_citation_message_ids(
    conn: &mut PgConnection,
    response_id: String,
    conversation_message_id: Uuid,
) -> ModelResult<Vec<ChatbotConversationMessageCitation>> {
    let res = sqlx::query_as!(
        ChatbotConversationMessageCitation,
        r#"
UPDATE chatbot_conversation_messages_citations
SET conversation_message_id = $1
WHERE conversation_message_id IN (
    SELECT id
    FROM chatbot_conversation_messages
    WHERE id IN (
        SELECT conversation_message_id
        FROM chatbot_conversation_message_tool_outputs
        WHERE response_id = $2
          AND deleted_at IS NULL
      )
      AND deleted_at IS NULL
  )
RETURNING *
        "#,
        conversation_message_id,
        response_id
    )
    .fetch_all(conn)
    .await?;

    Ok(res)
}
