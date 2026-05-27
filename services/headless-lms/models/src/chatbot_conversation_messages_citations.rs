use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Clone, PartialEq, Deserialize, Serialize, ToSchema)]
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

/// Insert a batch of citation from the same conversation
pub async fn insert_batch(
    conn: &mut PgConnection,
    input: Vec<ChatbotConversationMessageCitation>,
    page_ids: Vec<Option<Uuid>>,
) -> ModelResult<Vec<ChatbotConversationMessageCitation>> {
    let conv_id = input[0].conversation_id;
    let cm_ids: Vec<Uuid> = input.iter().map(|x| x.conversation_message_id).collect();
    let titles: Vec<String> = input.iter().map(|x| x.title.to_owned()).collect();
    let contents: Vec<String> = input.iter().map(|x| x.content.to_owned()).collect();
    let document_urls: Vec<String> = input.iter().map(|x| x.document_url.to_owned()).collect();
    let citation_numbers: Vec<i32> = input.iter().map(|x| x.citation_number).collect();

    let res = sqlx::query_as!(
        ChatbotConversationMessageCitation,
        r#"
INSERT INTO chatbot_conversation_messages_citations (
    conversation_id,
    conversation_message_id,
    title,
    content,
    document_url,
    citation_number,
    course_material_chapter_number
  )
SELECT $1,
  lol.cm_id,
  lol.title,
  lol.content,
  lol.document_url,
  lol.citation_number,
  c.chapter_number
FROM (
    SELECT
      UNNEST($2::UUID []) cm_id,
      UNNEST($3::TEXT []) title,
      UNNEST($4::TEXT []) content,
      UNNEST($5::TEXT []) document_url,
      UNNEST($6::INTEGER []) citation_number,
      UNNEST($7::UUID []) page_id
  ) lol
  JOIN pages p ON p.id = lol.page_id
  LEFT JOIN chapters c ON p.chapter_id = c.id
WHERE c.deleted_at IS NULL
  AND p.deleted_at IS NULL
RETURNING *
        "#,
        conv_id,
        &cm_ids,
        &titles,
        &contents,
        &document_urls,
        &citation_numbers,
        &page_ids as _,
    )
    .fetch_all(conn)
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

/// Sets the correct conversation_message_id to citations. The correct id is the
/// id of the chatbot text message that uses the citations. Update the citations
/// that currently connected to a conversation_message that contains tool output
/// and has the same response_id.
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
