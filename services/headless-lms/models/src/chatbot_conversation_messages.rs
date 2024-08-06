use crate::prelude::*;

#[derive(Clone, PartialEq, Deserialize, Serialize)]
pub struct ChatbotConversationMessage {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub conversation_id: Uuid,
    pub message: Option<String>,
    pub is_from_chatbot: bool,
    pub message_is_complete: bool,
    pub used_tokens: i32,
}

pub async fn insert(
    conn: &mut PgConnection,
    input: ChatbotConversationMessage,
) -> ModelResult<ChatbotConversationMessage> {
    let res = sqlx::query_as!(
        ChatbotConversationMessage,
        r#"
INSERT INTO chatbot_conversation_messages (conversation_id, message, is_from_chatbot, message_is_complete, used_tokens)
VALUES ($1, $2, $3, $4, $5)
RETURNING *
        "#,
        input.conversation_id,
        input.message,
        input.is_from_chatbot,
        input.message_is_complete,
        input.used_tokens
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_conversation_id(
    conn: &mut PgConnection,
    conversation_id: Uuid,
) -> ModelResult<Vec<ChatbotConversationMessage>> {
    let mut res = sqlx::query_as!(
        ChatbotConversationMessage,
        r#"
SELECT * FROM chatbot_conversation_messages
WHERE conversation_id = $1
        "#,
        conversation_id
    )
    .fetch_all(conn)
    .await?;
    // Should have the same order as in the conversation.
    res.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    Ok(res)
}
