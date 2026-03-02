use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ChatbotConversationSuggestedMessage {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub conversation_message_id: Uuid,
    pub message: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    input: ChatbotConversationSuggestedMessage,
) -> ModelResult<ChatbotConversationSuggestedMessage> {
    let res = sqlx::query_as!(
        ChatbotConversationSuggestedMessage,
        r#"
INSERT INTO chatbot_conversation_suggested_messages (
  conversation_message_id,
  message
)
VALUES ($1, $2)
RETURNING *
        "#,
        input.conversation_message_id,
        input.message,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn insert_batch(
    conn: &mut PgConnection,
    conversation_message_id: &Uuid,
    input: Vec<String>,
) -> ModelResult<Vec<ChatbotConversationSuggestedMessage>> {
    let res = sqlx::query_as!(
        ChatbotConversationSuggestedMessage,
        r#"
INSERT INTO chatbot_conversation_suggested_messages (
  conversation_message_id,
  message
)
  SELECT $1,
  UNNEST($2::VARCHAR(32376) [])
RETURNING *
        "#,
        conversation_message_id,
        &input,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_conversation_message_id(
    conn: &mut PgConnection,
    message_id: Uuid,
) -> ModelResult<Vec<ChatbotConversationSuggestedMessage>> {
    let res = sqlx::query_as!(
        ChatbotConversationSuggestedMessage,
        r#"
SELECT * FROM chatbot_conversation_suggested_messages
WHERE conversation_message_id = $1
AND deleted_at IS NULL
        "#,
        message_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
